import { inject, Injectable } from "@angular/core";
import { App } from "@capacitor/app";
import { AppUpdate, AppUpdateAvailability, type AppUpdateInfo, AppUpdateResultCode, FlexibleUpdateInstallStatus, type FlexibleUpdateState } from "@capawesome/capacitor-app-update";
import { ModalController } from "@ionic/angular/standalone";
import { StartAppUpdate } from "src/app/components/app-updater/app-updater.component";
import { Logger } from "../logging/logger";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";

@Injectable({
    providedIn: "root",
})
export class AppUpdaterService {
    private _availableVersion?: string;
    private _currentVersion?: string;
    private _updateRunning = false;
    private _downloadSuccessful?: boolean;
    private _modal?: HTMLIonModalElement;
    private _updateInfo?: AppUpdateInfo;

    private _lastSilentCheck?: number;
    private _lastSilentCheckVersion?: string;
    private readonly _checkSilentEvery = 3600;

    private readonly _modalCtrl = inject(ModalController);
    private readonly _preferences = inject(PreferencesService);

    public get AvailableVersion(): string {
        return this._availableVersion ?? "";
    }

    public get UpdateRunning(): boolean {
        return this._updateRunning;
    }

    public get DownloadSuccessful(): boolean | undefined {
        return this._downloadSuccessful;
    }

    public get IsUpToDate(): boolean {
        return this._availableVersion == this._currentVersion;
    }

    public async Initialize() {
        await App.addListener("resume", () => {
            this.CheckForUpdates(false, true);
        });
    }

    public async CheckForUpdates(force: boolean = false, silent: boolean = false): Promise<void> {
        if (silent && this._updateRunning) {
            //an update is running, ignore...
            return await this.finish();
        } else if (silent && this._lastSilentCheck && Date.now() - this._checkSilentEvery > this._lastSilentCheck) {
            //the last silent check was not at least one hour ago
            return await this.finish();
        }

        if (this._modal && !this._modal.isOpen) {
            await this._modal.present();
            return;
        }

        this._updateInfo = await AppUpdate.getAppUpdateInfo();
        this._availableVersion = this._updateInfo.availableVersionCode ?? this._updateInfo.availableVersionName;
        this._currentVersion = this._updateInfo.currentVersionCode ?? this._updateInfo.currentVersionName;

        if (!force) {
            const ignore = await this._preferences.Get(EPrefProperty.IgnoreUpdate, undefined);
            if (ignore && ignore == this._availableVersion) {
                //ingore this version
                Logger.Debug(`New app update available, but the user ignores it (${this._currentVersion} -> ${this._availableVersion})`);
                return await this.finish();
            }
        }

        if (silent) {
            this._lastSilentCheck = Date.now();
            if (this._lastSilentCheckVersion == this._availableVersion) {
                //there was already an popup for this update, so we just ignore it
                return await this.finish();
            }
        }

        if (this._availableVersion && this._currentVersion && this._availableVersion > this._currentVersion) {
            Logger.Notice(`New app update available in playstore: ${this._currentVersion} -> ${this._availableVersion}`);
            if (silent) {
                this._lastSilentCheckVersion = this._availableVersion;
            }
            this._modal = await StartAppUpdate(this._modalCtrl);
            return;
        } else if (force) {
            await StartAppUpdate(this._modalCtrl);
        }
        Logger.Debug(`The app is up-to-date (${this._currentVersion} -> ${this._availableVersion})`);
        return await this.finish();
    }

    public async StartAppUpdate(listener?: AppUpdateListener) {
        this._downloadSuccessful = undefined;
        if (!this._updateInfo) {
            this._updateInfo = await AppUpdate.getAppUpdateInfo();
        }
        if (this._updateInfo.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
            this._downloadSuccessful = true;
            listener?.updateStatus();
            return await this.finish();
        }

        this._updateRunning = true;
        listener?.updateStatus();
        if (this._updateInfo.flexibleUpdateAllowed) {
            await AppUpdate.addListener("onFlexibleUpdateStateChange", async (state: FlexibleUpdateState) => {
                Logger.Debug(`Flexible update '${this._availableVersion}' checked status: `, state);
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
                } else {
                    Logger.Debug(`Flexible update status changed: `, state.installStatus);
                }
                if (reopen && !this._modal?.isOpen) {
                    //reopen popup with success message
                    this._modal = await StartAppUpdate(this._modalCtrl);
                }
            });

            const res = await AppUpdate.startFlexibleUpdate();
            listener?.updateStatus();
            if (res.code == AppUpdateResultCode.OK) {
                Logger.Debug(`User started app update to ${this._availableVersion}`);
            } else {
                Logger.Notice(`App update could not be started (${res.code})`);
                this._updateRunning = false;
                this._downloadSuccessful = false;
                return await this.finish();
            }
        } else {
            const result = await AppUpdate.performImmediateUpdate();
            switch (result.code) {
                case AppUpdateResultCode.OK:
                    Logger.Notice(`Immediate update ${this._availableVersion} was installed successful`);
                    this._downloadSuccessful = true;
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
            this._updateRunning = false;
            await this.finish();
        }
    }

    public async FinishFlexibleUpdate() {
        if ((await AppUpdate.getAppUpdateInfo()).installStatus == FlexibleUpdateInstallStatus.DOWNLOADED) {
            await AppUpdate.completeFlexibleUpdate();
            await this.finish();
        }
    }

    public async OpenGooglePlay() {
        AppUpdate.openAppStore({ appId: (await App.getInfo()).id });
    }

    private async finish() {
        Logger.Debug(`Finish update process`);
        await AppUpdate.removeAllListeners();
        this._modal = undefined;
    }
}

export type AppUpdateListener = {
    updateStatus: () => void;
};
