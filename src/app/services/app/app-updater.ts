import { App } from "@capacitor/app";
import { AppUpdate, AppUpdateAvailability, type AppUpdateInfo, FlexibleUpdateInstallStatus, type FlexibleUpdateState } from "@capawesome/capacitor-app-update";
import { ModalController } from "@ionic/angular/standalone";
import { StartAppUpdate } from "src/app/components/app-updater/app-updater.component";
import { Logger } from "../logging/logger";
import { EPrefProperty, type PreferencesService } from "../storage/preferences.service";

export class AppUpdater {
    private _availableVersion?: number;
    private _updateRunning = false;
    private _updateSuccessful?: boolean;
    private _modal?: HTMLIonModalElement;
    private _updateInfo?: AppUpdateInfo;

    private readonly _modalCtrl: ModalController;
    private readonly _preferences: PreferencesService;

    public get AvailableVersion(): number {
        return this._availableVersion ?? -1;
    }

    public get UpdateRunning(): boolean {
        return this._updateRunning;
    }

    public get UpdateSuccessful(): boolean | undefined {
        return this._updateSuccessful;
    }

    constructor(modalCtrl: ModalController, pref: PreferencesService) {
        this._modalCtrl = modalCtrl;
        this._preferences = pref;
    }

    public async CheckForUpdates(force: boolean = false): Promise<void> {
        this._updateInfo = await AppUpdate.getAppUpdateInfo();
        const currentVersion = this._updateInfo.availableVersionCode ?? this._updateInfo.availableVersionName;
        const availableVersion = this._updateInfo.currentVersionCode ?? this._updateInfo.currentVersionName;

        if (!force) {
            const ignore = await this._preferences.Get(EPrefProperty.IgnoreUpdate, undefined);
            if (ignore && ignore == availableVersion) {
                //ingore this version
                return;
            }
        }

        if (availableVersion && currentVersion && availableVersion > currentVersion) {
            Logger.Notice(`New app update available in playstore: ${currentVersion} -> ${availableVersion}`);
            this._modal = await StartAppUpdate(this._modalCtrl, { updater: this });
        } else if (force) {
            Logger.Debug(`The app is up-to-date (${currentVersion})`);
            await StartAppUpdate(this._modalCtrl, { updater: this, uptodate: true });
        }
    }

    public async StartAppUpdate(listener?: AppUpdateListener) {
        this._updateSuccessful = undefined;
        if (!this._updateInfo) {
            this._updateInfo = await AppUpdate.getAppUpdateInfo();
        }
        if (this._updateInfo.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
            this._updateSuccessful = true;
            listener?.onDone("success");
            return;
        }

        this._updateRunning = true;
        AppUpdate.addListener("onFlexibleUpdateStateChange", (state: FlexibleUpdateState) => {
            let reopen = false;
            if (state.installStatus == FlexibleUpdateInstallStatus.CANCELED) {
                listener?.onDone("canceled");

                this._updateSuccessful = false;
                reopen = true;
            } else if (state.installStatus == FlexibleUpdateInstallStatus.FAILED) {
                listener?.onDone("error");
                this._updateSuccessful = false;
                reopen = true;
            } else if (state.installStatus == FlexibleUpdateInstallStatus.INSTALLED) {
                listener?.onDone("success");
                this._updateSuccessful = true;
                reopen = true;
                this._preferences.Remove(EPrefProperty.IgnoreUpdate);
            }
            if (!this._modal && reopen) {
                //reopen popup with success message
                StartAppUpdate(this._modalCtrl, { updater: this });
            }
        });
        if (this._updateInfo.flexibleUpdateAllowed) {
            await AppUpdate.startFlexibleUpdate();
        } else {
            await AppUpdate.performImmediateUpdate();
        }
        this._updateRunning = false;
    }

    public async OpenGooglePlay() {
        AppUpdate.openAppStore({ appId: (await App.getInfo()).id });
    }
}

export type AppUpdateListener = {
    onDone: (finished: "success" | "canceled" | "error") => void;
};
