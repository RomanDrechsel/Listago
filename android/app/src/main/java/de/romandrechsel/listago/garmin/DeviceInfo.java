package de.romandrechsel.listago.garmin;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.garmin.android.connectiq.ConnectIQ;
import com.garmin.android.connectiq.ConnectIQ.IQApplicationInfoListener;
import com.garmin.android.connectiq.IQApp;
import com.garmin.android.connectiq.IQDevice;
import com.garmin.android.connectiq.exception.InvalidStateException;
import com.garmin.android.connectiq.exception.ServiceUnavailableException;
import com.getcapacitor.JSObject;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonSyntaxException;
import com.google.gson.LongSerializationPolicy;

import java.util.ArrayList;
import java.util.List;

import de.romandrechsel.listago.logging.Logger;
import de.romandrechsel.listago.utils.DeviceUtils;

public class DeviceInfo implements ConnectIQ.IQDeviceEventListener, ConnectIQ.IQApplicationEventListener
{
    private static final String TAG = "IQDevice";

    public enum DeviceState
    {Initializing, Ready, AppNotInstalled, CheckingApp, NotConnected, ConnectionLost, NotPaired, InvalidState, ServiceUnavailable}

    public enum EMessageSendResult
    {Success, NotSend, Timeout, Failed, DeviceNotFound, InvalidState, ServiceUnavailable, MessageEmpty, InvalidPayload}

    public interface IMessageSendListener
    {
        void onMessageSendResult(@NonNull EMessageSendResult result, @Nullable ConnectIQ.IQMessageStatus iq_status);
    }

    public interface IAppOpenedListener
    {
        void onAppOpenResponse(@Nullable DeviceInfo device, boolean success);
    }

    @NonNull
    private final DeviceManager Manager;

    @Nullable
    public IQDevice device = null;
    @Nullable
    public IQApp deviceApp = null;

    @NonNull
    public DeviceState state = DeviceState.NotConnected;

    public DeviceInfo(@NonNull IQDevice device, @NonNull DeviceManager manager)
    {
        this.Manager = manager;
        this.setDevice(device);
    }

    @Override
    public void onDeviceStatusChanged(IQDevice iqDevice, IQDevice.IQDeviceStatus iqDeviceStatus)
    {
        if (iqDeviceStatus == IQDevice.IQDeviceStatus.CONNECTED)
        {
            this.setState(DeviceState.CheckingApp);

            try
            {
                this.Manager.connectIQ.getApplicationInfo(DeviceManager.AppId, this.device, new IQApplicationInfoListener()
                {
                    @Override
                    public void onApplicationInfoReceived(IQApp iqApp)
                    {
                        DeviceInfo.this.deviceApp = iqApp;
                        if (DeviceInfo.this.state != DeviceState.Ready)
                        {
                            DeviceInfo.this.setState(DeviceState.Ready);
                            try
                            {
                                DeviceInfo.this.Manager.connectIQ.registerForAppEvents(iqDevice, iqApp, DeviceInfo.this);
                                Logger.Debug(TAG, "Listening for ConnectIQ app messages for device " + DeviceInfo.this);
                            }
                            catch (InvalidStateException ex)
                            {
                                Logger.Error(TAG, "Could not register for ConnectIQ app events for device " + DeviceInfo.this + ", invalid state", ex);
                                DeviceInfo.this.setState(DeviceState.InvalidState);
                            }
                        }
                    }

                    @Override
                    public void onApplicationNotInstalled(String s)
                    {
                        DeviceInfo.this.setState(DeviceState.AppNotInstalled);
                    }
                });
            }
            catch (InvalidStateException e)
            {
                Log.e(TAG, "ConnectIQ not in valid state!");
                this.setState(DeviceState.InvalidState);
            }
            catch (ServiceUnavailableException e)
            {
                Log.e(TAG, "ConnectIQ Service unavailable!");
                this.setState(DeviceState.ServiceUnavailable);
            }
        }
        else if (iqDeviceStatus == IQDevice.IQDeviceStatus.NOT_CONNECTED)
        {
            if (this.state == DeviceState.Ready)
            {
                this.setState(DeviceState.ConnectionLost);
            }
            else
            {
                this.setState(DeviceState.NotConnected);
            }
        }
        else
        {
            this.setState(DeviceState.NotPaired);
        }
    }

    @Override
    public void onMessageReceived(IQDevice iqDevice, IQApp iqApp, List<Object> data, ConnectIQ.IQMessageStatus iqMessageStatus)
    {
        if (iqDevice.getDeviceIdentifier() != this.getDeviceIdentifier() || !iqApp.getApplicationId().equals(this.deviceApp.getApplicationId()))
        {
            String device_string = iqDevice.getDeviceIdentifier() + " (" + iqDevice.getFriendlyName() + ")";
            Logger.Debug(TAG, "Received data from other device " + device_string + " - ignoring for device " + this);
            return;
        }

        if (iqMessageStatus != ConnectIQ.IQMessageStatus.SUCCESS || data == null)
        {
            Logger.Error(TAG, "Could not receive data from device " + this + ": " + iqMessageStatus.name());
        }
        else
        {
            DeviceMessage msg = DeviceUtils.DeserializeStringArray(data.get(0));
            if (msg != null)
            {
                Logger.Debug(TAG, "Received data from device " + this + ": " + msg.Size + " bytes");
                JSObject event_args = new JSObject();
                event_args.put("device", this.toJSObject());
                event_args.put("message", msg.Json());
                this.Manager.Plugin.emitJsEvent("RECEIVE", event_args);
            }
            else
            {
                Logger.Error(TAG, "Received invalid data from device " + this);
            }
        }
    }

    public void setDevice(IQDevice device)
    {
        if (device != this.device)
        {
            this.disconnect();

            this.device = device;
            this.setState(DeviceState.Initializing);

            try
            {
                this.onDeviceStatusChanged(device, this.Manager.connectIQ.getDeviceStatus(device));
                this.Manager.connectIQ.registerForDeviceEvents(device, this);
            }
            catch (InvalidStateException e)
            {
                Log.e(TAG, "ConnectIQ not in valid state!");
                this.setState(DeviceState.InvalidState);
            }
            catch (ServiceUnavailableException e)
            {
                Log.e(TAG, "ConnectIQ Service unavailable!");
                this.setState(DeviceState.ServiceUnavailable);
            }
        }
    }

    public void disconnect()
    {
        if (this.device != null)
        {
            try
            {
                this.Manager.connectIQ.unregisterForEvents(this.device);
            }
            catch (InvalidStateException e)
            {
                this.setState(DeviceState.InvalidState);
            }
            this.device = null;
        }
    }

    /**
     * sends an object to a device
     *
     * @param message_type type of the message, will always be in line 0 of the send string array
     * @param data         data object
     * @param sendListener listener for send success or failure
     */
    public void Send(@Nullable String message_type, @Nullable Object data, @Nullable IMessageSendListener sendListener)
    {
        if (this.device == null)
        {
            Logger.Debug(TAG, "Could not send to undefined device");
            return;
        }

        ArrayList<String> send;
        if (data != null)
        {
            send = DeviceUtils.SerializeToStringArray(data);
        }
        else
        {
            send = new ArrayList<>();
        }

        if (message_type != null && !message_type.isEmpty())
        {
            send.add(0, message_type);
        }

        if (send.isEmpty())
        {
            if (sendListener != null)
            {
                sendListener.onMessageSendResult(EMessageSendResult.MessageEmpty, null);
            }
        }
        else
        {
            this.transmitToDevice(send, sendListener);
        }
    }

    /**
     * sends a json object to a device
     *
     * @param message_type type of the message, will always be in line 0 of the send string array
     * @param json         json data string
     * @param sendListener listener for send success or failure
     */
    public void SendJson(@Nullable String message_type, @Nullable String json, @Nullable IMessageSendListener sendListener)
    {
        Object obj;
        if (json != null)
        {
            try
            {
                Gson gson = new GsonBuilder().setLongSerializationPolicy(LongSerializationPolicy.STRING).create(); //parse long numbers as string
                obj = gson.fromJson(json, JsonElement.class);
            }
            catch (JsonSyntaxException ex)
            {
                Logger.Error(TAG, "Could not deserialize json data: " + ex.getMessage());
                if (sendListener != null)
                {
                    sendListener.onMessageSendResult(EMessageSendResult.InvalidPayload, null);
                }
                return;
            }
        }
        else
        {
            obj = null;
        }
        this.Send(message_type, obj, sendListener);
    }

    /**
     * opens the lists app on the device
     *
     * @param listener listener if the app was open successful
     * @return true, if the request was send to the device, else false
     */
    public boolean openApp(@Nullable IAppOpenedListener listener)
    {
        if (this.device == null || this.deviceApp == null)
        {
            return false;
        }

        if (this.Manager.connectIQ != null && this.Manager.sdkReady)
        {
            try
            {
                this.Manager.connectIQ.openApplication(this.device, this.deviceApp, (device, app, status) ->
                {
                    boolean success = false;
                    if (status == ConnectIQ.IQOpenApplicationStatus.APP_IS_ALREADY_RUNNING || status == ConnectIQ.IQOpenApplicationStatus.PROMPT_SHOWN_ON_DEVICE)
                    {
                        success = true;
                        Logger.Debug(TAG, "Opened App on device " + this + ":", status);

                    }
                    else
                    {
                        Logger.Error(TAG, "Could not open app on device " + this + ":", status);
                    }
                    if (listener != null)
                    {
                        listener.onAppOpenResponse(this, success);
                    }
                });
                return true;
            }
            catch (InvalidStateException ex)
            {
                Logger.Error(TAG, "Could not open app on device " + this + ": invalid state", ex);
            }
            catch (ServiceUnavailableException ex)
            {
                Logger.Error(TAG, "Could not open app on device " + this + ": service unavailable", ex);
            }
        }
        else
        {
            Logger.Error(TAG, "Could not open app on device " + this + ": sdk not ready");
        }
        return false;
    }

    public long getDeviceIdentifier()
    {
        if (this.device != null)
        {
            return this.device.getDeviceIdentifier();
        }
        else
        {
            return -1;
        }
    }

    public JSObject toJSObject()
    {
        if (this.device != null)
        {
            JSObject ret = new JSObject();
            ret.put("id", this.device.getDeviceIdentifier());
            ret.put("name", this.device.getFriendlyName());
            ret.put("state", this.state.name());
            ret.put("version", this.deviceApp != null ? this.deviceApp.version() : 0);
            return ret;
        }

        return null;
    }

    @NonNull
    @Override
    public String toString()
    {
        if (this.device != null)
        {
            return this.getDeviceIdentifier() + " (" + this.device.getFriendlyName() + ")";
        }
        else
        {
            return "undefined";
        }
    }

    private void setState(DeviceState state)
    {
        this.state = state;
        this.Manager.notifyDeviceStateChanged(this);
    }

    /**
     * transmits data to the device
     *
     * @param data     data map of type Array<String>
     *                 other formats are known to fail to send on some devices
     * @param listener listener for result
     */
    private void transmitToDevice(@NonNull ArrayList<String> data, @Nullable IMessageSendListener listener)
    {
        final Handler timeoutHandler = new Handler(Looper.getMainLooper());
        final boolean[] messageSent = {false};

        Runnable timeoutRunnable = () ->
        {
            if (!messageSent[0])
            {
                Logger.Error(TAG, "Timeout: Failed to transmit data to device " + this + " within 30 seconds");
                if (listener != null)
                {
                    listener.onMessageSendResult(EMessageSendResult.Timeout, null);
                }
            }
        };

        if (this.state == DeviceState.Ready)
        {
            try
            {
                Logger.Debug(TAG, "Trying to transmit data to device " + this + ": ", data);

                this.Manager.connectIQ.sendMessage(this.device, this.deviceApp, data, (device, app, status) ->
                {
                    messageSent[0] = true;
                    timeoutHandler.removeCallbacks(timeoutRunnable);
                    if (status == ConnectIQ.IQMessageStatus.SUCCESS)
                    {
                        Logger.Debug(TAG, "Transmitted data to device " + this);

                    }
                    else
                    {
                        Logger.Error(TAG, "Failed to transmit data to device " + this + ": " + status.name());
                    }

                    if (listener != null)
                    {
                        listener.onMessageSendResult(status == ConnectIQ.IQMessageStatus.SUCCESS ? EMessageSendResult.Success : EMessageSendResult.Failed, status);
                    }
                });
            }
            catch (InvalidStateException e)
            {
                Logger.Error(TAG, "Failed to transmit data to device " + this + ": Invalid state");
                if (listener != null)
                {
                    listener.onMessageSendResult(EMessageSendResult.InvalidState, null);
                }
            }
            catch (ServiceUnavailableException e)
            {
                Logger.Error(TAG, "Failed to transmit data to device " + this + ": Service unavailable");
                if (listener != null)
                {
                    listener.onMessageSendResult(EMessageSendResult.ServiceUnavailable, null);
                }
            }
            catch (Exception ex)
            {
                Logger.Error(TAG, "Failed to transmit data to device " + this + ": " + ex.getMessage());
                if (listener != null)
                {
                    listener.onMessageSendResult(EMessageSendResult.Failed, null);
                }
            }
        }
        else
        {
            Logger.Error(TAG, "Failed to transmit data to device " + this + ": Device is in state " + this.state);
            if (listener != null)
            {
                listener.onMessageSendResult(EMessageSendResult.Failed, ConnectIQ.IQMessageStatus.FAILURE_INVALID_DEVICE);
            }
        }
    }
}
