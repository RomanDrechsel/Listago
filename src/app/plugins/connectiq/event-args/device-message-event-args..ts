import { DeviceEventArgs } from "./device-event-args";

export type DeviceMessageEventArgs = {
    device: DeviceEventArgs;
    message?: string;
};
