import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { NavController } from "@ionic/angular/standalone";
import { BehaviorSubject, interval, Subscription } from "rxjs";
import { DebugDevices } from "../../../environments/environment";
import { StringUtils } from "../../classes/utils/string-utils";
import { SelectGarminDevice } from "../../pages/devices/devices.page";
import ConnectIQ from "../../plugins/connectiq/connect-iq";
import { ConnectIQDeviceMessage } from "../../plugins/connectiq/event-args/connect-iq-device-message.";
import { DeviceEventArgs } from "../../plugins/connectiq/event-args/device-event-args";
import { ConnectIQListener } from "../../plugins/connectiq/listeners/connect-iq-listener";
import { DeviceErrorReportListener } from "../../plugins/connectiq/listeners/device-error-report-listener";
import { DeviceLogsListener } from "../../plugins/connectiq/listeners/device-logs-listener";
import { DeviceStateListener } from "../../plugins/connectiq/listeners/device-state-listener";
import { PluginLogsListener } from "../../plugins/connectiq/listeners/plugin-logs-listener";
import { TimeoutListener } from "../../plugins/connectiq/listeners/timeout-listener";
import { TransactionListener } from "../../plugins/connectiq/listeners/transaction-listener";
import { AppService } from "../app/app.service";
import { ConfigService } from "../config/config.service";
import { Locale } from "../localization/locale";
import { LocalizationService } from "../localization/localization.service";
import { PopupsService } from "../popups/popups.service";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";
import { Logger } from "./../logging/logger";
import { ConnectIQDevice } from "./connect-iq-device";
import { ConnectIQMessageType } from "./connect-iq-message-type";

@Injectable({
    providedIn: "root",
})
export class ConnectIQService {
    private _alwaysTransmitToDevice?: ConnectIQDevice;

    private _watchListeners: Map<string, ConnectIQListener<any>[]> = new Map();
    private _pendingListenersTimeoutCheck?: Subscription;

    private _devices: ConnectIQDevice[] = [];
    private _watchOutdatedNotice: number[] = [];

    public useGarminSimulator = false;
    public useGarminDebugApp = false;

    private onInitializedSubject = new BehaviorSubject<boolean | undefined>(undefined);
    public onInitialized$ = this.onInitializedSubject.asObservable();
    private onDeviceChangedSubject = new BehaviorSubject<ConnectIQDevice | undefined>(undefined);
    public onDeviceChanged$ = this.onDeviceChangedSubject.asObservable();

    private _onlineDevices: number = 0;

    private _initialized: boolean = false;

    private readonly Preferences = inject(PreferencesService);
    private readonly Config = inject(ConfigService);
    private readonly Router = inject(Router);
    private readonly Popup = inject(PopupsService);
    private readonly Locale = inject(LocalizationService);
    private readonly NavController = inject(NavController);

    public set AlwaysTransmitToDevice(device: ConnectIQDevice | undefined) {
        this.Preferences.Set(EPrefProperty.AlwaysTransmitTo, device?.Identifier);
        this._alwaysTransmitToDevice = device;
    }

    public get AlwaysTransmitToDevice(): ConnectIQDevice | undefined {
        return this._alwaysTransmitToDevice;
    }

    public get OnlineDevices(): number {
        return this._onlineDevices;
    }

    public get Initialized(): boolean {
        return this._initialized;
    }

    /**
     * initialize service
     * @param obj use debug devices or live devices, and use garmin simulator or live phone
     */
    public async Initialize(obj?: { simulator?: boolean; debug_app?: boolean }): Promise<boolean> {
        Logger.Debug(`Start initializing ConnectIQ service...`);
        const all_listeners = Array.from(this._watchListeners.values());
        for (let i = 0; i < all_listeners.length; i++) {
            for (let j = 0; j < all_listeners[i].length; j++) {
                await all_listeners[i][j].clearListener();
            }
        }
        this._watchListeners.clear();
        this._onlineDevices = 0;

        if (Capacitor.isNativePlatform()) {
            this.addListener(new PluginLogsListener(this));
            this.addListener(new DeviceStateListener(this));
            this.addListener(new DeviceErrorReportListener(this, this.NavController, this.Popup));
            this.addListener(new DeviceLogsListener(this, this.NavController, this.Popup));
            this._devices = [];
            const init = await ConnectIQ.Initialize({ simulator: obj?.simulator ?? this.useGarminSimulator, debug_app: obj?.debug_app ?? this.useGarminDebugApp });
            if (init.success === true) {
                this.useGarminDebugApp = init.debug_app ?? false;
                this.useGarminSimulator = init.simulator ?? false;
                const defaultTransmitDevice = await this.Preferences.Get<number>(EPrefProperty.AlwaysTransmitTo, -1);
                if (defaultTransmitDevice > -1) {
                    this._alwaysTransmitToDevice = await this.GetDevice(defaultTransmitDevice);
                } else {
                    this._alwaysTransmitToDevice = undefined;
                }
                Logger.Debug("ConnectIQ initialized");
            } else {
                Logger.Error(`Could not initialize ConnectIQ service`, init);
                this.Popup.Toast.Error("service-connectiq.init_failed", undefined, true);
            }

            this._initialized = init.success;
            this.onInitializedSubject.next(init.success);
            return this._initialized;
        } else {
            Logger.Important(`Not on a native device, skipping initialization of ConnectIQ service`);
        }

        return false;
    }

    public async Shutdown() {
        Logger.Important(`Shutting down ConnectIQ service...`);

        this._watchListeners.clear();
        this._onlineDevices = 0;
        this._devices = [];

        if (this._initialized) {
            if (Capacitor.isNativePlatform()) {
                await ConnectIQ.Shutdown();
                const all_listeners = Array.from(this._watchListeners.values());
                for (let i = 0; i < all_listeners.length; i++) {
                    for (let j = 0; j < all_listeners[i].length; j++) {
                        await all_listeners[i][j].clearListener();
                    }
                }
                await ConnectIQ.removeAllListeners();
            }
        }

        this._initialized = false;
        this.onInitializedSubject.next(false);
    }

    /**
     * get all known devices
     * @param force_load force to reload device list and states
     * @returns list of all known devices
     */
    public async getDevices(force_load: boolean = false): Promise<ConnectIQDevice[]> {
        if (!force_load && this._devices.length > 0) {
            return this._devices;
        }
        AppService.AppToolbar?.ToggleProgressbar(true);

        const defaultTransmitDevice = await this.Preferences.Get<number>(EPrefProperty.AlwaysTransmitTo, -1);
        let devices: ConnectIQDevice[] = [];

        if (Capacitor.isNativePlatform()) {
            try {
                const res = await ConnectIQ.GetDevices({ force_reload: force_load });
                if (res && res.devices) {
                    const array = JSON.parse(res.devices);
                    if (Array.isArray(array)) {
                        array.forEach((d: any) => {
                            let device = this._devices.find(d2 => d2.Identifier == d.id);
                            if (device) {
                                device.Update(d);
                            } else {
                                device = ConnectIQDevice.FromEventArgs(d, this);
                            }

                            devices.push(device);
                        });
                    }
                }
            } catch (error) {
                Logger.Error("Could not parse device infos");
            }
        }

        if (devices.length == 0) {
            devices = DebugDevices(this);
        }

        this._alwaysTransmitToDevice = undefined;
        if (defaultTransmitDevice > 0) {
            this._alwaysTransmitToDevice = devices.find(d => d.Identifier == defaultTransmitDevice);
        }
        if (this._alwaysTransmitToDevice) {
            Logger.Debug(`Lists will be transmited to device ${this._alwaysTransmitToDevice.toLog()} by default`);
        }
        this._devices = devices;
        AppService.AppToolbar?.ToggleProgressbar(false);
        return this._devices;
    }

    /**
     * get a specific device
     * @param id unique device id
     * @returns device object
     */
    public async GetDevice(id: number): Promise<ConnectIQDevice | undefined> {
        if (this._devices.length <= 0) {
            await this.getDevices(true);
        }

        return this._devices.find(d => d.Identifier == id);
    }

    /**
     * Returns the most probable device, or let the user select one, if the device is uncertain
     * @param args btn_text: label of the select-button of the select device page, if no device is found
     *             only_ready: only return a device, if his state is "Ready"
     *             select_device_if_undefined: select a device, if the default device is undefined or not Ready
     * @returns device object
     */
    public async GetDefaultDevice(args?: { only_ready?: boolean; select_device_if_undefined?: boolean; btn_text?: string }): Promise<ConnectIQDevice | undefined> {
        if (this._alwaysTransmitToDevice && Capacitor.isNativePlatform()) {
            if (this._alwaysTransmitToDevice.State == "Ready" || !args?.only_ready) {
                return this._alwaysTransmitToDevice;
            }
        }

        const online = this._devices.filter(d => d.State == "Ready");
        if (online.length == 1) {
            return online[0];
        } else if (args?.select_device_if_undefined !== false) {
            return new Promise<ConnectIQDevice | undefined>(resolve => {
                SelectGarminDevice({ router: this.Router, callback: async (device?: ConnectIQDevice) => resolve(device), submitRoute: undefined, buttonText: args?.btn_text });
            });
        } else {
            return undefined;
        }
    }

    /**
     * opens the playstore
     */
    public async openStore() {
        //await ConnectIQ.OpenStore();
        await Browser.open({ url: `${Locale.currentLang().GarminAppStore()}/${this.Config.GarminAppStoreId}` });
    }

    /**
     * opens the app on the watch
     */
    public async openApp(device?: ConnectIQDevice, show_toast?: boolean): Promise<boolean> {
        if (!device || device.State != "Ready") {
            device = await this.GetDefaultDevice({ btn_text: this.Locale.getText("service-connectiq.openapp_btn") });
        }

        if (!device || device.State != "Ready") {
            if (show_toast) {
                await this.Popup.Toast.Error("service-connectiq.openapp_nodevice", undefined, true);
            }

            return false;
        }

        await ConnectIQ.OpenApp({ device_id: String(device.Identifier) });
        if (show_toast) {
            await this.Popup.Toast.Success("service-connectiq.openapp_success", undefined, true);
        }
        return true;
    }

    public async SendToDevice(obj: { device?: ConnectIQDevice | number; messageType: ConnectIQMessageType; data: any; response_callback?: (message?: ConnectIQDeviceMessage) => Promise<void>; timeout?: number }): Promise<number | boolean> {
        if (typeof obj.device === "number") {
            obj.device = await this.GetDevice(obj.device);
        } else if (!obj.device) {
            obj.device = await this.GetDefaultDevice();
        }

        if (!obj.device) {
            Logger.Debug(`Could not send data to device: no device found`);
            return false;
        }

        if (!obj.data) {
            obj.data = {};
        }

        AppService.AppToolbar?.ToggleProgressbar(true);
        let listener: TransactionListener | undefined;
        if (obj.response_callback) {
            let tid: number;
            do {
                tid = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
            } while (this._watchListeners.get(TransactionListener.Event) && this._watchListeners.get(TransactionListener.Event)!.filter(t => t instanceof TransactionListener && t.TId == tid).length > 0);

            listener = new TransactionListener(this, obj.device, tid, obj.response_callback);
            this.addListener(listener);
            obj.data.tid = listener.TId;
        }

        if ((await ConnectIQ.SendToDevice({ device_id: String(obj.device.Identifier), type: obj.messageType, json: JSON.stringify(obj.data) })).success) {
            AppService.AppToolbar?.ToggleProgressbar(false);
            return listener?.TId ?? true;
        } else {
            if (listener) {
                this.removeListener(listener);
            }
            AppService.AppToolbar?.ToggleProgressbar(false);
            return false;
        }
    }

    public async SendToDeviceTransaction(obj: { device?: ConnectIQDevice | number; messageType: ConnectIQMessageType; data?: any; timeout?: number }): Promise<ConnectIQDeviceMessage | undefined> {
        return await new Promise<ConnectIQDeviceMessage | undefined>(async resolve => {
            this.SendToDevice({
                device: obj.device,
                messageType: obj.messageType,
                data: obj.data,
                timeout: obj.timeout,
                response_callback: async resp => {
                    resolve(resp);
                },
            });
        });
    }

    public CancelRequest(tid: number) {
        Array.from(this._watchListeners.entries()).forEach(([key, value]) => {
            if (value.length > 0) {
                const l = value.findIndex(l => l instanceof TransactionListener && l.TId == tid);
                if (l >= 0) {
                    value.splice(l, 1);
                    if (value.length > 0) {
                        this._watchListeners.set(key, value);
                    } else {
                        this._watchListeners.delete(key);
                    }
                    return;
                }
            }
        });
    }

    public async addListener(listener: ConnectIQListener<any>) {
        const arr = this._watchListeners.get(listener.Event());
        if (arr && arr.indexOf(listener) < 0) {
            arr.push(listener);
            this._watchListeners.set(listener.Event(), arr);
        } else if (!arr) {
            this._watchListeners.set(listener.Event(), [listener]);
        } else {
            //the listener is already added
            return;
        }
        await listener.addListener();

        if (listener instanceof TimeoutListener && !this._pendingListenersTimeoutCheck) {
            this._pendingListenersTimeoutCheck = interval(1000).subscribe(async () => {
                let timeout_listeners = false;
                const listeners = Array.from(this._watchListeners.entries());
                for (let i = 0; i < listeners.length; i++) {
                    const [key, value] = listeners[i];
                    for (let j = 0; j < value.length; j++) {
                        const l = value[j];
                        if (l instanceof TimeoutListener) {
                            if (l.IsTimedOut()) {
                                await l.TimedOut();
                            }
                        } else {
                            timeout_listeners = true;
                        }
                    }
                }

                if (this._pendingListenersTimeoutCheck && !timeout_listeners) {
                    this._pendingListenersTimeoutCheck.unsubscribe();
                    this._pendingListenersTimeoutCheck = undefined;
                }
            });
        }
    }

    public async removeListener(listener: ConnectIQListener<any>): Promise<boolean> {
        let arr = this._watchListeners.get(listener.Event());
        if (arr) {
            const index = arr.findIndex(l => l === listener);
            if (index >= 0) {
                arr.splice(index, 1);
                await listener.clearListener();
                if (arr.length > 0) {
                    this._watchListeners.set(listener.Event(), arr);
                } else {
                    this._watchListeners.delete(listener.Event());
                }
                return true;
            }
        }
        return false;
    }

    public async UpdateDevice(device_args: DeviceEventArgs) {
        let device = this._devices.find(d => d.Identifier == device_args.id);
        if (!device) {
            device = ConnectIQDevice.FromEventArgs(device_args, this);
        }
        device.Update(device_args);
        await this.calcOnlineDevices();
        this.onDeviceChangedSubject.next(device);
        this.checkDeviceVersion(device_args);
    }

    private async checkDeviceVersion(device: DeviceEventArgs) {
        if (device.state == "Ready" && (device.version ?? 0) > 0 && !this._watchOutdatedNotice.includes(device.id)) {
            this._watchOutdatedNotice.push(device.id);
            type ignore_device = { device: number; version: number; check: number };
            let all_ignore = await this.Preferences.Get<ignore_device[] | undefined>(EPrefProperty.IgnoreWatchOutdated, undefined);
            if (!device.version || device.version < this.Config.GarminAppVersion) {
                if (!Array.isArray(all_ignore)) {
                    all_ignore = [];
                }

                //remove old entries, older than 180 days...
                all_ignore = all_ignore.filter(d => d.device == device.id || d.check > Date.now() - 1000 * 60 * 60 * 24 * 180);

                const ignore = all_ignore.find(d => d.device == device.id);
                if (!ignore || ignore.version < this.Config.GarminAppVersion) {
                    Logger.Notice(`Old lists app found on device ${StringUtils.toString(device)}, up-to-date version is ${this.Config.GarminAppVersion}`);
                    const res = await this.Popup.Alert.Show({
                        message: this.Locale.getText("service-connectiq.watch_outdated", { device: device.name }),
                        buttons: [
                            {
                                text: this.Locale.getText("service-connectiq.watch_outdated_ignore"),
                                role: "confirm",
                            },
                            {
                                text: this.Locale.getText("service-connectiq.watch_outdated_button"),
                                handler: () => this.openStore(),
                                role: "confirm",
                            },
                        ],
                        inputs: [
                            {
                                type: "checkbox",
                                label: this.Locale.getText("service-connectiq.watch_outdated_dontremind"),
                                value: "ignore",
                                checked: ignore != undefined,
                            },
                        ],
                    });
                    if (Array.isArray(res) && res.includes("ignore")) {
                        if (ignore) {
                            all_ignore?.forEach(d => {
                                if (d.device == device.id) {
                                    d.version = this.Config.GarminAppVersion;
                                    d.check = Date.now();
                                }
                            });
                        } else {
                            all_ignore.push({ device: device.id, version: this.Config.GarminAppVersion, check: Date.now() });
                        }
                    } else {
                        all_ignore = undefined;
                    }
                }
            }
            if (all_ignore && all_ignore.length > 0) {
                await this.Preferences.Set(EPrefProperty.IgnoreWatchOutdated, all_ignore);
            } else {
                await this.Preferences.Remove(EPrefProperty.IgnoreWatchOutdated);
            }
        }
    }

    private async calcOnlineDevices(devices: ConnectIQDevice[] | undefined = undefined): Promise<number> {
        if (!devices || devices.length == 0) {
            devices = await this.getDevices();
        }

        let count = 0;
        devices.forEach(d => {
            if (d.State == "Ready") {
                count++;
            }
        });

        this._onlineDevices = count;
        return count;
    }
}
