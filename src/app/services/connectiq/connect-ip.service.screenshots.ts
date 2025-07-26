import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { ConnectIQDeviceMessage } from "../../plugins/connectiq/event-args/connect-iq-device-message.";
import { DeviceEventArgs } from "../../plugins/connectiq/event-args/device-event-args";
import { ConnectIQListener } from "../../plugins/connectiq/listeners/connect-iq-listener";
import { Locale } from "../localization/locale";
import { ConnectIQDevice } from "./connect-iq-device";
import { ConnectIQMessageType } from "./connect-iq-message-type";

@Injectable({
    providedIn: "root",
})
export class ConnectIQService {
    public useGarminSimulator = false;
    public useGarminDebugApp = false;

    private onInitializedSubject = new BehaviorSubject<boolean | undefined>(undefined);
    public onInitialized$ = this.onInitializedSubject.asObservable();
    private onDeviceChangedSubject = new BehaviorSubject<ConnectIQDevice | undefined>(undefined);
    public onDeviceChanged$ = this.onDeviceChangedSubject.asObservable();

    public set AlwaysTransmitToDevice(device: ConnectIQDevice | undefined) {}

    public get AlwaysTransmitToDevice(): ConnectIQDevice | undefined {
        return undefined;
    }

    public get OnlineDevices(): number {
        return 1;
    }

    public get Initialized(): boolean {
        return true;
    }

    public async Initialize(obj?: { simulator?: boolean; debug_app?: boolean }): Promise<boolean> {
        await this.getDevices();
        return true;
    }

    public async Shutdown() {}

    public async getDevices(force_load: boolean = false): Promise<ConnectIQDevice[]> {
        return [
            new ConnectIQDevice({
                id: 123456789,
                name: Locale.currentLang().localeFile == "de" ? "Mandy's Uhr" : "Mandy's watch",
                state: "Ready",
            }),
        ];
    }

    public async GetDevice(id: number): Promise<ConnectIQDevice | undefined> {
        return (await this.getDevices())[0] ?? undefined;
    }

    public async GetDefaultDevice(args?: { only_ready?: boolean; select_device_if_undefined?: boolean; btn_text?: string }): Promise<ConnectIQDevice | undefined> {
        return undefined;
    }

    public async openStore() {}

    public async openApp(device?: ConnectIQDevice, show_toast?: boolean): Promise<boolean> {
        return true;
    }

    public async SendToDevice(obj: { device?: ConnectIQDevice | number; messageType: ConnectIQMessageType; data: any; response_callback?: (message?: ConnectIQDeviceMessage) => Promise<void>; timeout?: number }): Promise<number | boolean> {
        return 1;
    }

    public async SendToDeviceTransaction(obj: { device?: ConnectIQDevice | number; messageType: ConnectIQMessageType; data?: any; timeout?: number }): Promise<ConnectIQDeviceMessage | undefined> {
        return undefined;
    }

    public CancelRequest(tid: number) {}

    public async addListener(listener: ConnectIQListener<any>) {}

    public async removeListener(listener: ConnectIQListener<any>): Promise<boolean> {
        return true;
    }

    public async UpdateDevice(device_args: DeviceEventArgs) {}

    private async checkDeviceVersion(device: DeviceEventArgs) {}

    private async calcOnlineDevices(devices: ConnectIQDevice[] | undefined = undefined): Promise<number> {
        return 0;
    }
}
