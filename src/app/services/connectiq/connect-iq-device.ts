import { DeviceEventArgs } from "src/app/plugins/connectiq/event-args/device-event-args";
import { Locale } from "../localization/locale";
import { ConnectIQService } from "./connect-iq.service";

export class ConnectIQDevice {
    public Name!: string;
    public State: "Initializing" | "Ready" | "AppNotInstalled" | "CheckingApp" | "NotConnected" | "ConnectionLost" | "NotPaired" | "InvalidState" | "ServiceUnavailable" = "InvalidState";
    public Identifier!: number;

    private constructor(arg: DeviceEventArgs, private Service: ConnectIQService) {
        this.Update(arg);
    }

    /**
     * state as a readable string
     */
    public get StateLocale(): string {
        return Locale.getText("page_devices.device_state." + this.State);
    }

    /**
     * device in error state?
     */
    public get Error(): boolean {
        return ["ConnectionLost", "InvalidState", "ServiceUnavailable"].indexOf(this.State) >= 0;
    }

    /**
     * update the device state
     * @param arg
     */
    public Update(arg: DeviceEventArgs) {
        this.Name = arg.name;
        this.State = arg.state;
        this.Identifier = arg.id;
    }

    public toString(): string {
        return JSON.stringify({ Name: this.Name, State: this.State, Identifier: this.Identifier });
    }

    public toLog(): string {
        return `${this.Name} (${this.Identifier})`;
    }

    public equals(device: any): boolean {
        if (device instanceof ConnectIQDevice) {
            return device.Identifier === this.Identifier;
        } else {
            return false;
        }
    }

    /**
     * create a new object from device state plugin response
     * @param args
     * @param service
     * @returns
     */
    public static FromEventArgs(args: DeviceEventArgs, service: ConnectIQService): ConnectIQDevice {
        return new ConnectIQDevice(args, service);
    }
}
