package de.romandrechsel.listago.garmin;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

import de.romandrechsel.listago.logging.Logger;
import de.romandrechsel.listago.utils.HelperUtils;

@CapacitorPlugin(name = "ConnectIQ")
public class ConnectIQPlugin extends Plugin
{
    private static final String TAG = "ConnectIQPlugin";

    private DeviceManager Manager;

    @Override
    public void load()
    {
        super.load();
        Logger.Plugin = this;
    }

    @PluginMethod
    public void Initialize(PluginCall call)
    {
        if (this.Manager == null)
        {
            this.Manager = new DeviceManager(this);

        }
        this.Manager.Initialize(this.getActivity(), call.getBoolean("simulator", false), call.getBoolean("debug_app", false), new DeviceManager.IInitializeListener()
        {
            @Override
            public void Success()
            {
                JSObject ret = new JSObject();
                ret.put("success", true);
                if (ConnectIQPlugin.this.Manager.UsingSimulator())
                {
                    ret.put("simulator", true);
                }
                if (ConnectIQPlugin.this.Manager.UsingDebugApp())
                {
                    ret.put("debug_app", true);
                }
                call.resolve(ret);
            }

            @Override
            public void Failed(String message)
            {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("message", message);
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void Shutdown(PluginCall call)
    {
        if (this.Manager != null)
        {
            this.Manager.Shutdown(this.getActivity());
            this.Manager = null;
            Logger.Important(TAG, "ConnectIQ plugin shutdown successful");
        }
        call.resolve();
    }

    @PluginMethod
    public void OpenStore(PluginCall call)
    {
        if (this.Manager != null)
        {
            this.Manager.openStore();
        }
        call.resolve();
    }

    @PluginMethod
    public void OpenApp(PluginCall call)
    {
        if (this.Manager != null)
        {
            Long device_id = HelperUtils.toLong(call.getString("device_id", null));
            boolean request = false;
            if (device_id != null)
            {
                request = this.Manager.openApp(device_id, (device, success) ->
                {
                    JSObject event = new JSObject();
                    event.put("app_opened", success);
                    event.put("device", device != null ? device.getDeviceIdentifier() : null);
                    this.emitJsEvent("APP_OPENED", event);
                });
            }

            JSObject ret = new JSObject();
            ret.put("request_send", request);
            call.resolve(ret);
        }
        else
        {
            call.resolve(null);
        }
    }

    @PluginMethod
    public void GetDevices(PluginCall call)
    {
        if (this.Manager != null)
        {
            List<DeviceInfo> devices = this.Manager.getDevices(call.getBoolean("force_reload", false));
            call.resolve(this.toJSObject(devices));
        }
        else
        {
            call.resolve(null);
        }
    }

    @PluginMethod
    public void GetDevice(PluginCall call)
    {
        if (this.Manager != null)
        {
            Long identifier = HelperUtils.toLong(call.getString("device_id", null));

            DeviceInfo device = this.Manager.getDevice(identifier);
            if (device != null)
            {
                call.resolve(device.toJSObject());
            }
            else
            {
                call.resolve();
            }
        }
        else
        {
            call.resolve();
        }
    }

    @PluginMethod
    public void SendToDevice(PluginCall call)
    {
        if (this.Manager != null)
        {
            Long device_id = HelperUtils.toLong(call.getString("device_id", null));
            String message_type = call.getString("type", null);
            String json = call.getString("json", null);

            this.Manager.SendToDevice(device_id, message_type, json, (result, iq_status) ->
            {
                JSObject ret = new JSObject();
                ret.put("success", result == DeviceInfo.EMessageSendResult.Success);
                call.resolve(ret);
            });
        }
        else
        {
            call.resolve(null);
        }
    }

    public void emitJsEvent(String event, JSObject log)
    {
        this.notifyListeners(event, log);
    }

    private JSObject toJSObject(@NonNull List<DeviceInfo> devices)
    {
        ArrayList<JSObject> list = new ArrayList<>();
        for (DeviceInfo d : devices)
        {
            JSObject obj = d.toJSObject();
            if (obj != null)
            {
                list.add(obj);
            }
        }

        if (!list.isEmpty())
        {
            JSObject ret = new JSObject();
            ret.put("devices", list);
            return ret;
        }

        return null;
    }
}
