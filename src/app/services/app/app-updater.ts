import { App } from "@capacitor/app";
import { AppUpdate, AppUpdateAvailability, type AppUpdateInfo, AppUpdateResultCode, FlexibleUpdateInstallStatus, type FlexibleUpdateState } from "@capawesome/capacitor-app-update";
import { ModalController } from "@ionic/angular/standalone";
import { StartAppUpdate } from "src/app/components/app-updater/app-updater.component";
import { Logger } from "../logging/logger";
import { EPrefProperty, type PreferencesService } from "../storage/preferences.service";

export class AppUpdater {
    private _availableVersion?: string;
    private _updateRunning = false;
    private _downloadSuccessful?: boolean;
    private _modal?: HTMLIonModalElement;
    private _updateInfo?: AppUpdateInfo;

    private readonly _modalCtrl: ModalController;
    private readonly _preferences: PreferencesService;

    public get AvailableVersion(): string {
        return this._availableVersion ?? "";
    }

    public get UpdateRunning(): boolean {
        return this._updateRunning;
    }

    public get DownloadSuccessful(): boolean | undefined {
        return this._downloadSuccessful;
    }

    constructor(modalCtrl: ModalController, pref: PreferencesService) {
        this._modalCtrl = modalCtrl;
        this._preferences = pref;
    }

    public async CheckForUpdates(force: boolean = false): Promise<void> {
        this._updateInfo = await AppUpdate.getAppUpdateInfo();
        this._availableVersion = this._updateInfo.availableVersionCode ?? this._updateInfo.availableVersionName;
        const currentVersion = this._updateInfo.currentVersionCode ?? this._updateInfo.currentVersionName;

        if (!force) {
            const ignore = await this._preferences.Get(EPrefProperty.IgnoreUpdate, undefined);
            if (ignore && ignore == this._availableVersion) {
                //ingore this version
                Logger.Debug(`New app update available, but the user ignores it (${currentVersion} -> ${this._availableVersion})`);
                return;
            }
        }

        if (this._availableVersion && currentVersion && this._availableVersion > currentVersion) {
            Logger.Notice(`New app update available in playstore: ${currentVersion} -> ${this._availableVersion}`);
            this._modal = await StartAppUpdate(this._modalCtrl, { updater: this });
        } else if (force) {
            await StartAppUpdate(this._modalCtrl, { updater: this, uptodate: true });
            Logger.Debug(`The app is up-to-date (${currentVersion} -> ${this._availableVersion})`);
        } else {
            Logger.Debug(`The app is up-to-date (${currentVersion} -> ${this._availableVersion})`);
        }
    }

    public async StartAppUpdate(listener?: AppUpdateListener) {
        this._downloadSuccessful = undefined;
        if (!this._updateInfo) {
            this._updateInfo = await AppUpdate.getAppUpdateInfo();
        }
        if (this._updateInfo.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
            this._downloadSuccessful = true;
            listener?.updateStatus();
            return;
        }

        this._updateRunning = true;
        listener?.updateStatus();
        const handle = await AppUpdate.addListener("onFlexibleUpdateStateChange", (state: FlexibleUpdateState) => {
            let reopen = false;
            if (state.installStatus == FlexibleUpdateInstallStatus.CANCELED) {
                Logger.Notice(`Flexible update '${this._availableVersion}' was canceled by the user`);
                this._downloadSuccessful = false;
                listener?.updateStatus();
                reopen = true;
            } else if (state.installStatus == FlexibleUpdateInstallStatus.FAILED) {
                Logger.Error(`Flexible update '${this._availableVersion}' could not be installed`);
                this._downloadSuccessful = false;
                listener?.updateStatus();
                reopen = true;
            } else if (state.installStatus == FlexibleUpdateInstallStatus.DOWNLOADED) {
                Logger.Debug(`Flexible update '${this._availableVersion}' was downloaded successful and can be installed`);
                this._downloadSuccessful = true;
                listener?.updateStatus();
                reopen = true;
            }
            if (reopen && !this._modal?.isOpen) {
                //reopen popup with success message
                StartAppUpdate(this._modalCtrl, { updater: this });
            }
        });
        if (this._updateInfo.flexibleUpdateAllowed) {
            await AppUpdate.startFlexibleUpdate();
        } else {
            const result = await AppUpdate.performImmediateUpdate();
            switch (result.code) {
                case AppUpdateResultCode.OK:
                    Logger.Notice(`Immediate update ${this._availableVersion} was installed successfil`);
                    listener?.updateStatus();
                    break;
                case AppUpdateResultCode.CANCELED:
                    Logger.Notice(`Immediate update ${this._availableVersion} was canceled by user`);
                    this._downloadSuccessful = false;
                    listener?.updateStatus();
                    break;
                default:
                    Logger.Error(`Immediate update ${this._availableVersion} failed (${result.code})`);
                    this._downloadSuccessful = false;
                    listener?.updateStatus();
                    break;
            }
        }
        this._updateRunning = false;
        await handle.remove();
    }

    public async FinishFlexibleUpdate() {
        if ((await AppUpdate.getAppUpdateInfo()).installStatus == FlexibleUpdateInstallStatus.DOWNLOADED) {
            await AppUpdate.completeFlexibleUpdate();
        }
    }

    public async OpenGooglePlay() {
        AppUpdate.openAppStore({ appId: (await App.getInfo()).id });
    }
}

export type AppUpdateListener = {
    updateStatus: () => void;
};
