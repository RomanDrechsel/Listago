package de.romandrechsel.listago.garmin;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.garmin.android.connectiq.ConnectIQ;
import com.garmin.android.connectiq.IQDevice;
import com.garmin.android.connectiq.exception.InvalidStateException;
import com.garmin.android.connectiq.exception.ServiceUnavailableException;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.LongSerializationPolicy;

import org.jetbrains.annotations.NotNull;

import java.util.ArrayList;
import java.util.List;

import de.romandrechsel.listago.logging.Logger;

public class DeviceManager implements ConnectIQ.ConnectIQListener
{
    public interface IInitializeListener
    {
        void Success();

        void Failed(String message);
    }

    @NonNull
    public ConnectIQPlugin Plugin;
    public ConnectIQ connectIQ;
    private static final String AppIdDebug = "64655bbc-555c-484d-827b-4aef68ff6f5e";
    private static final String AppIdRelease = "f9b0d002-4a4d-45ab-9330-bbed2c3af49f";
    public static String AppId = DeviceManager.AppIdRelease;

    private Boolean _useGarminSimulator = false;

    private static final String TAG = "IQDeviceManager";
    public boolean sdkReady = false;

    private final List<DeviceInfo> devices = new ArrayList<>();

    @Nullable
    private IInitializeListener _initListener = null;

    public DeviceManager(@NonNull ConnectIQPlugin plugin)
    {
        this.Plugin = plugin;
    }

    public void Initialize(Activity activity, @Nullable Boolean simulator, @Nullable Boolean debug_app, @Nullable IInitializeListener listener)
    {
        if (this.connectIQ != null)
        {
            this.Shutdown(activity);
        }

        this._initListener = listener;
        this.DisconnectAllDevices();

        if (debug_app != null && debug_app)
        {
            DeviceManager.AppId = DeviceManager.AppIdDebug;
            Logger.Debug(TAG, "Using garmin debug app...");
        }
        else
        {
            DeviceManager.AppId = DeviceManager.AppIdRelease;
        }

        if (simulator != null && simulator)
        {
            //get debugging devices
            this._useGarminSimulator = true;
            this.connectIQ = ConnectIQ.getInstance(activity, ConnectIQ.IQConnectType.TETHERED);
            this.connectIQ.setAdbPort(7381);
            Logger.Debug(TAG, "Initialize simulator devices...");
        }
        else
        {
            //get live devices
            this._useGarminSimulator = false;
            this.connectIQ = ConnectIQ.getInstance(activity, ConnectIQ.IQConnectType.WIRELESS);
        }
        this.connectIQ.initialize(activity, true, this);

        try
        {
            this.connectIQ.unregisterAllForEvents();
        }
        catch (InvalidStateException ignored)
        {
        }
    }

    public void Shutdown(Activity activity)
    {
        this.DisconnectAllDevices();
        try
        {
            this.connectIQ.shutdown(activity);
        }
        catch (InvalidStateException ignore)
        {
        }
        try
        {
            this.connectIQ.unregisterAllForEvents();
        }
        catch (InvalidStateException ignore)
        {
        }
        this.connectIQ = null;
        this._initListener = null;
        Logger.Notice(TAG, "ConnectIQ shutdown successful");
    }

    @Override
    public void onSdkReady()
    {
        this.sdkReady = true;
        Logger.Debug(TAG, "ConnectIQ initialization successful");
        if (this._initListener != null)
        {
            this._initListener.Success();
            this._initListener = null;
        }
    }

    @Override
    public void onInitializeError(ConnectIQ.IQSdkErrorStatus errStatus)
    {
        Logger.Error(TAG, "ConnectIQ initialization failed: " + errStatus.toString());
        this.sdkReady = false;
        this.DisconnectAllDevices();
        if (this._initListener != null)
        {
            this._initListener.Failed(errStatus.toString());
            this._initListener = null;
        }
    }

    @Override
    public void onSdkShutDown()
    {
        this.sdkReady = false;
        if (this.connectIQ != null)
        {
            Logger.Debug(TAG, "ConnectIQ sdk shut down");
            this.DisconnectAllDevices();
        }
    }

    /**
     * opens browser to the Garmin App-Store
     */
    public void openStore()
    {
        try
        {
            if (this.connectIQ != null)
            {
                this.connectIQ.openStore(AppId);
            }
        }
        catch (InvalidStateException | UnsupportedOperationException | ServiceUnavailableException ignored)
        {
        }
    }

    public boolean openApp(@NonNull Long deviceId, @Nullable DeviceInfo.IAppOpenedListener listener)
    {
        DeviceInfo device = this.getDevice(deviceId);
        if (device != null)
        {
            return device.openApp(listener);
        }
        else if (listener != null)
        {
            listener.onAppOpenResponse(null, false);
        }
        return false;
    }

    public void SendToDevice(@Nullable Long deviceId, @Nullable String message_type, @Nullable String json, @Nullable DeviceInfo.IMessageSendListener listener)
    {
        if (deviceId == null)
        {
            Logger.Error(TAG, "Could not send json to device, no device identifier provided");
            if (listener != null)
            {
                listener.onMessageSendResult(DeviceInfo.EMessageSendResult.DeviceNotFound, null);
            }
            return;
        }

        DeviceInfo device = this.getDevice(deviceId);
        if (device != null)
        {
            if (json == null || json.isEmpty())
            {
                Logger.Error(TAG, "Could not send empty json to device " + device);
                if (listener != null)
                {
                    listener.onMessageSendResult(DeviceInfo.EMessageSendResult.NotSend, null);
                }
                return;
            }

            device.SendJson(message_type, json, listener);
            if (this._useGarminSimulator && message_type != null && message_type.equals("req_logs"))
            {
                this.debugLogResponse(device, json);
            }
        }
        else if (listener != null)
        {
            listener.onMessageSendResult(DeviceInfo.EMessageSendResult.DeviceNotFound, null);
        }
    }

    /**
     * get all known devices
     *
     * @param force_reload reload device list
     * @return List of all known devices
     */
    public List<DeviceInfo> getDevices(Boolean force_reload)
    {
        if (this.devices.isEmpty() || force_reload)
        {
            this.listDevices();
        }

        return this.devices;
    }

    /**
     * gets information for a single device
     *
     * @param identifier unique identifier
     * @return DeviceInfo object
     */
    @Nullable
    public DeviceInfo getDevice(Long identifier)
    {
        if (this.sdkReady && identifier != null)
        {
            for (DeviceInfo d : this.devices)
            {
                if (d.getDeviceIdentifier() == identifier)
                {
                    return d;
                }
            }
        }
        return null;
    }

    public boolean UsingSimulator()
    {
        return this._useGarminSimulator;
    }

    public boolean UsingDebugApp()
    {
        return DeviceManager.AppId.equals(DeviceManager.AppIdDebug);
    }

    /**
     * a device changed its state
     *
     * @param device the device
     */
    public void notifyDeviceStateChanged(DeviceInfo device)
    {
        this.Plugin.emitJsEvent("DEVICE", device.toJSObject());
    }

    /**
     * gets all known devices
     */
    private void listDevices()
    {
        this.DisconnectAllDevices();

        if (this.sdkReady)
        {
            try
            {
                List<IQDevice> devices = this.connectIQ.getKnownDevices();
                for (IQDevice d : devices)
                {
                    DeviceInfo info = this.getDevice(d.getDeviceIdentifier());
                    if (info == null)
                    {
                        info = new DeviceInfo(d, this);
                        this.devices.add(info);
                    }
                    else
                    {
                        info.setDevice(d);
                    }
                }
            }
            catch (InvalidStateException e)
            {
                Logger.Error(TAG, "ConnectIQ not in valid state!");
                this.DisconnectAllDevices();
            }
            catch (ServiceUnavailableException e)
            {
                Logger.Error(TAG, "ConnectIQ Service unavailable!");
                this.DisconnectAllDevices();
            }
        }

        if (this.devices.size() == 1)
        {
            Logger.Notice(TAG, "1 device found");
        }
        else
        {
            Logger.Notice(TAG, this.devices.size() + " device(s) found");
        }
    }

    /**
     * disconnects all devices
     */
    private void DisconnectAllDevices()
    {
        if (!this.devices.isEmpty())
        {
            for (DeviceInfo device : this.devices)
            {
                device.disconnect();
            }
            this.devices.clear();
        }
    }

    private static boolean IsDebug()
    {
        return DeviceManager.AppId.equals(DeviceManager.AppIdDebug);
    }

    private void debugLogResponse(@NotNull DeviceInfo device, @NotNull String json)
    {
        if (device.device == null)
        {
            return;
        }
        Gson gson = new GsonBuilder().setLongSerializationPolicy(LongSerializationPolicy.STRING).create();
        Object obj = gson.fromJson(json, JsonElement.class);
        if (obj instanceof JsonObject jsonobj)
        {
            String tid = jsonobj.has("tid") ? jsonobj.get("tid").getAsString() : null;
            new Handler(Looper.getMainLooper()).postDelayed(() ->
            {
                List<Object> resp = new ArrayList<>();
                if (tid != null)
                {
                    resp.add("tid=" + tid);
                }
                resp.add("0=Hallo");
                resp.add("1=Welt");
                resp.add("2=!");
                resp.add("3=");
                resp.add("4");
                device.onMessageReceived(device.device, device.deviceApp, resp, ConnectIQ.IQMessageStatus.SUCCESS);
            }, 5000);
        }
    }
}
