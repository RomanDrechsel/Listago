import { inject, Injectable, isDevMode } from "@angular/core";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { EdgeToEdge } from "@capawesome/capacitor-android-edge-to-edge-support";
import { Platform } from "@ionic/angular";
import { FileUtils } from "src/app/classes/utils/file-utils";
import type { ClearAppCacheEventArgs } from "src/app/plugins/sysinfo/event-args/clear-app-cache-event-args";
import type { NightModeEventArgs } from "src/app/plugins/sysinfo/event-args/night-mode-event-args";
import SysInfo from "src/app/plugins/sysinfo/sys-info";
import { environment } from "../../../environments/environment";
import { StringUtils } from "../../classes/utils/string-utils";
import { MainToolbarComponent } from "../../components/main-toolbar/main-toolbar.component";
import { AdmobService } from "../adverticing/admob.service";
import { ConnectIQService } from "../connectiq/connect-iq.service";
import { IntentsService } from "../intents/intents.service";
import { ListsService } from "../lists/lists.service";
import { Locale } from "../localization/locale";
import { LocalizationService } from "../localization/localization.service";
import { Logger } from "../logging/logger";
import { LoggingService } from "../logging/logging.service";
import { PopupsService } from "../popups/popups.service";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";

@Injectable({
    providedIn: "root",
})
export class AppService {
    public static AppToolbar?: MainToolbarComponent;

    private readonly _logger = inject(LoggingService);
    private readonly _locale = inject(LocalizationService);
    private readonly _listsService = inject(ListsService);
    private readonly _connectIQ = inject(ConnectIQService);
    private readonly _platform = inject(Platform);
    private readonly _preferences = inject(PreferencesService);
    private readonly _admob = inject(AdmobService);
    private readonly _popups = inject(PopupsService);
    private readonly _intents = inject(IntentsService);
    public static Popups: PopupsService;

    /** platform as short string (android, ios, web) */
    public static get AppPlatform(): string {
        return Capacitor.getPlatform();
    }

    /** get platform as a readable string  */
    public static get AppPlatformString(): string {
        const platform = Capacitor.getPlatform();
        if (platform == "ios") {
            return "iOS";
        } else {
            return StringUtils.capitalize(platform);
        }
    }

    /** app running on a native device? */
    public static get isMobileApp(): boolean {
        const platform = AppService.AppPlatform;
        return platform === "ios" || platform === "android";
    }

    /** app running on a webbrowser? */
    public static get isWebApp(): boolean {
        return AppService.AppPlatform === "web";
    }

    constructor() {
        AppService.Popups = this._popups;
    }

    /**
     * initialize app services
     */
    public async InitializeApp() {
        await this._platform.ready();

        const last_version = await this._preferences.Get<number>(EPrefProperty.LastVersion, -1);
        const build = Number((await App.getInfo()).build);
        let clear_cache: ClearAppCacheEventArgs | undefined = undefined;
        if (last_version >= 0 && !Number.isNaN(build) && build > last_version) {
            clear_cache = await SysInfo.ClearAppCache();
        }
        await this._preferences.Set(EPrefProperty.LastVersion, build);

        await Logger.Initialize(this._logger);

        if (clear_cache) {
            const text = `Removed ${clear_cache.files ?? 0} file(s) in ${clear_cache.directories ?? 0} directory(ies), total of ${FileUtils.File.FormatSize(clear_cache.size ?? 0)}.`;
            if (clear_cache?.success) {
                Logger.Notice(`Cleared app cache due to new app version (${last_version} -> ${build}). ${text}`);
            } else {
                Logger.Error(`Tryed to clear app cache due to new app version (${last_version} -> ${build}), but not everything could be deleted... ${text}`);
            }
        }

        await EdgeToEdge.enable();
        this.handleNightmode((await SysInfo.NightMode()).isNightMode);
        SysInfo.addListener<NightModeEventArgs>("NIGHTMODE", (data: NightModeEventArgs) => {
            this.handleNightmode(data.isNightMode);
        });

        await Locale.Initialize(this._locale);

        try {
            await this._listsService.Initialize();
        } catch (e) {
            Logger.Error(`Could not initialize lists service: `, e);
        }

        //no await ...
        (async () => {
            try {
                if ((await this._preferences.Get(EPrefProperty.FirstStart, true)) == false && (await this._preferences.Get<boolean>(EPrefProperty.GarminConnectIQ, true)) !== false) {
                    const garmin_simulator = isDevMode() ? await this._preferences.Get<boolean>(EPrefProperty.DebugSimulator, true) : false;
                    const garmin_debugapp = isDevMode() ? await this._preferences.Get<boolean>(EPrefProperty.DebugApp, false) : false;
                    await this._connectIQ.Initialize({ simulator: garmin_simulator, debug_app: garmin_debugapp });
                } else {
                    this._logger.Notice(`Starting without ConnectIQ support`);
                }
            } catch (e) {
                Logger.Error(`Could not initialize ConnectIQ service: `, e);
            }
        })();

        //no await...
        (async () => {
            try {
                await this._admob.Initialize();
            } catch (e) {
                Logger.Error(`Could not initialize Admob service: `, e);
            }
        })();

        this._intents.Initialize();

        await SplashScreen.hide({ fadeOutDuration: 500 });
    }

    /**
     * width of display resolution
     */
    public get DeviceWidth(): number {
        return this._platform.width();
    }

    /**
     * height of display resolution
     */
    public get DeviceHeight(): number {
        return this._platform.height();
    }

    /**
     * is the device in darkmode?
     */
    public static get Darkmode(): boolean {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    /**
     * get info about the app instance and the device
     * @returns app meta information
     */
    public async AppMetaInfo(query?: { device?: boolean; settings?: boolean; storage?: boolean; garmin?: boolean }): Promise<AppMetaInfo> {
        const meta: AppMetaInfo = {};
        if (!query || query.device !== false) {
            const deviceinfo = await Device.getInfo();
            meta.Device = {
                Identifier: (await Device.getId()).identifier,
                Model: deviceinfo.model,
                Platform: deviceinfo.platform,
                OperatingSystem: {
                    OS: deviceinfo.operatingSystem,
                    Version: deviceinfo.osVersion,
                    AndroidSDKVersion: deviceinfo.androidSDKVersion,
                },
                Resolution: `${this.DeviceWidth}x${this.DeviceHeight}`,
                Manufacturer: deviceinfo.manufacturer,
                isVirtual: deviceinfo.isVirtual,
                MemoryUsed: deviceinfo.memUsed,
                WebViewVersion: deviceinfo.webViewVersion,
            };
        }

        if (!query || query.settings !== false) {
            meta.Settings = {
                LogMode: this._logger.LogLevelShort,
                AppLanguage: this._locale.CurrentLanguage.locale,
                AdmobStatus: {
                    Initialized: this._admob.Initialized,
                    Status: await this._admob.getConsentStatus(),
                },
            };
        }

        if (!query || query.storage !== false) {
            const database = await this._listsService.BackendService.DatabaseStats();
            const logs = await this._logger.GetLogSize();
            meta.Storage = {
                Backend: {
                    Size: await this._listsService.BackendService.DatabaseSize(),
                    Lists: {
                        Lists: database.lists.lists,
                        Items: database.lists.items,
                    },
                    Trash: {
                        Lists: database.trash.lists,
                        Items: database.trash.items,
                    },
                },
                Logs: {
                    Count: logs.files,
                    Size: logs.size,
                },
            };
        }

        if (AppService.isMobileApp) {
            const info = await App.getInfo();
            meta.Package = {
                AppName: info.name,
                Name: info.id,
                VersionString: info.version,
                Build: parseInt(info.build),
                Environment: environment.production ? "Production" : "Development",
                Release: environment.publicRelease,
            };
        }

        if (this._connectIQ.Initialized) {
            const devices = query?.garmin
                ? (await this._connectIQ.getDevices()).map(device => {
                      return {
                          Identifier: device.Identifier,
                          Name: device.Name,
                          State: device.State,
                      };
                  })
                : undefined;

            meta.ConnectIQ = {
                Initialized: true,
                Devices: devices,
            };
        } else {
            meta.ConnectIQ = {
                Initialized: false,
            };
        }

        return meta;
    }

    private handleNightmode(isNightMode: boolean | undefined) {
        this._logger.Debug(`NightMode set to '${isNightMode}'`);
        if (isNightMode === true) {
            EdgeToEdge.setBackgroundColor({ color: "#002794" });
            StatusBar.setStyle({ style: Style.Dark });
        } else {
            EdgeToEdge.setBackgroundColor({ color: "#0050d8" });
            StatusBar.setStyle({ style: Style.Dark });
        }
    }
}

export declare type AppMetaInfo = {
    Settings?: {
        LogMode: string;
        AppLanguage: string;
        AdmobStatus: {
            Initialized: boolean;
            Status: any;
        };
    };
    Device?: {
        Identifier: string;
        Resolution: string;
        Model: string;
        Platform: "android" | "ios" | "web";
        OperatingSystem: {
            OS: string;
            Version: string;
            AndroidSDKVersion: number | undefined;
        };
        Manufacturer: string;
        isVirtual: boolean;
        MemoryUsed: number | undefined;
        WebViewVersion: string;
    };
    Storage?: {
        Backend: {
            Size: number;
            Lists: {
                Lists: number;
                Items: number;
            };
            Trash: {
                Lists: number;
                Items: number;
            };
        };
        Logs: {
            Count: number;
            Size: number;
        };
    };
    Package?: {
        Name: string;
        AppName: string;
        VersionString: string;
        Build: number;
        Environment: "Production" | "Development";
        Release: boolean;
    };
    ConnectIQ?: {
        Initialized: boolean;
        Devices?: any;
    };
};
