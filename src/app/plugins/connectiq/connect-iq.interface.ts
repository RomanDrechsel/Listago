import { Plugin, PluginListenerHandle } from "@capacitor/core";
import { DeviceEventArgs } from "./event-args/device-event-args";
import { DevicesEventArgs } from "./event-args/devices-event-args";
import { InitializeEventArgs } from "./event-args/initialize-event-args";
import { TransmitDataEventArgs } from "./event-args/transmit-data-event-args";

export interface IConnectIQ extends Plugin {
    Initialize(opts: { simulator: boolean; debug_app: boolean }): Promise<InitializeEventArgs>;
    Shutdown(): Promise<void>;

    GetDevices(opts: { force_reload: boolean }): Promise<DevicesEventArgs>;

    GetDevice(opts: { device_id: string }): Promise<DeviceEventArgs>;

    SendToDevice(opts: { device_id: string; type?: string; json: String }): Promise<TransmitDataEventArgs>;

    OpenStore(): Promise<void>;

    OpenApp(opts: { device_id: string }): Promise<void>;

    addListener<T>(eventName: string, listenerFunc: (data: T) => void): Promise<PluginListenerHandle>;
}
