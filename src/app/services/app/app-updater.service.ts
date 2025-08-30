import { inject, Injectable } from "@angular/core";
import { App } from "@capacitor/app";
import { ModalController } from "@ionic/angular/standalone";
import { StartAppUpdate } from "src/app/components/app-updater/app-updater.component";
import AppUpdate from "src/app/plugins/app-update/app-update";
import { AppUpdateFlexibleInstallStatus, type AppUpdateFlexibleStatus } from "src/app/plugins/app-update/app-update-flexible-status";
import type { AppUpdateInfo } from "../../plugins/app-update/app-update-info";
import { LocalizationService } from "../localization/localization.service";
import { Logger } from "../logging/logger";
import { PopupsService } from "../popups/popups.service";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";

@Injectable({
    providedIn: "root",
})
export class AppUpdaterService {
    private _updateRunning = false;
    private _downloadSuccessful?: boolean;
    private _modal?: HTMLIonModalElement;
    private _updateInfo?: AppUpdateInfo;

    private _lastSilentCheck?: number;
    private _lastSilentCheckVersion?: number;
    private readonly _checkSilentEvery = 3600;

    private readonly _modalCtrl = inject(ModalController);
    private readonly _preferences = inject(PreferencesService);
    private readonly _locale = inject(LocalizationService);
    private readonly _popups = inject(PopupsService);

    public get AvailableVersion(): number {
        return this._updateInfo?.availableVersionCode ?? -1;
    }

    public get CurrentVersion(): number {
        return this._updateInfo?.currentVersionCode ?? -1;
    }

    public get UpdateRunning(): boolean {
        return this._updateRunning;
    }

    public get DownloadSuccessful(): boolean | undefined {
        return this._downloadSuccessful;
    }

    public get IsUpToDate(): boolean {
        return this._updateInfo ? this._updateInfo?.availableVersionCode == this._updateInfo?.currentVersionCode : true;
    }

    public async Initialize() {
        this._locale.loadScope("services/app-update", "app-update", true);
        await App.addListener("resume", () => {
            this.CheckForUpdates(false, true);
        });
    }

    public async CheckForUpdates(force: boolean = false, silent: boolean = false): Promise<void> {
        if (silent && this._updateRunning) {
            //an update is running, ignore...
            return;
        } else if (silent && this._lastSilentCheck && Date.now() - this._checkSilentEvery > this._lastSilentCheck) {
            //the last silent check was not at least one hour ago
            return await this.finish();
        }

        if (!(await this.getAppUpdateInfo())) {
            if (force) {
                this._popups.Toast.Error("app-update.error", undefined, true);
            }
            return await this.finish();
        }

        if (!force) {
            const ignore = await this._preferences.Get(EPrefProperty.IgnoreUpdate, undefined);
            if (ignore && ignore == this._updateInfo!.availableVersionCode) {
                //user want ingore this version
                Logger.Debug(`New app update available, but the user ignores it (${this.CurrentVersion} -> ${this.AvailableVersion})`);
                return await this.finish();
            }
        }

        if (silent) {
            this._lastSilentCheck = Date.now();
            if (this._lastSilentCheckVersion == this._updateInfo?.availableVersionCode) {
                //there was already an popup for this update, so we just ignore it
                return await this.finish();
            }
        }

        if (this.AvailableVersion > this.CurrentVersion) {
            Logger.Notice(`New app update available in playstore: ${this.CurrentVersion} -> ${this.AvailableVersion}`, this._updateInfo);

            if (silent) {
                this._lastSilentCheckVersion = this._updateInfo!.availableVersionCode;
            }
            this._modal = await StartAppUpdate(this._modalCtrl);
            return;
        } else if (force) {
            await StartAppUpdate(this._modalCtrl);
        }
        Logger.Debug(`The app is up-to-date (${this.CurrentVersion} -> ${this.AvailableVersion})`);
        return await this.finish();
    }

    public async StartAppUpdate(listener?: AppUpdateListener) {
        this._downloadSuccessful = undefined;
        if (!(await this.getAppUpdateInfo()) || !this._updateInfo?.updateAvailable) {
            this._downloadSuccessful = false;
            this._updateRunning = false;
            listener?.updateStatus();
            return await this.finish();
        }

        this._updateRunning = true;
        listener?.updateStatus();
        if (this._updateInfo.flexibleUpdateAllowed) {
            const handler = await AppUpdate.addListener("onFlexibleUpdateStateChange", (state: AppUpdateFlexibleStatus) => {
                let reopen = false;
                if (state.installStatus == AppUpdateFlexibleInstallStatus.Canceled) {
                    Logger.Notice(`Flexible update '${this.AvailableVersion}' was canceled by the user`);
                    this._updateRunning = false;
                    this._downloadSuccessful = false;
                    listener?.updateStatus();
                    reopen = true;
                } else if (state.installStatus == AppUpdateFlexibleInstallStatus.Failed) {
                    Logger.Error(`Flexible update '${this.AvailableVersion}' could not be installed`);
                    this._downloadSuccessful = false;
                    this._updateRunning = false;
                    listener?.updateStatus();
                    reopen = true;
                } else if (state.installStatus == AppUpdateFlexibleInstallStatus.Downloaded) {
                    Logger.Debug(`Flexible update '${this.AvailableVersion}' was downloaded successful and can be installed`);
                    this._downloadSuccessful = true;
                    this._updateRunning = false;
                    listener?.updateStatus();
                    reopen = true;
                }
                if (reopen && !this._modal?.isOpen) {
                    //reopen popup with success message
                    StartAppUpdate(this._modalCtrl);
                }
            });
        }

        const res = await AppUpdate.performUpdate();
        if (res.accepted) {
            Logger.Debug(`User started ${res.type} app update to ${this.AvailableVersion}`);
        } else {
            this._updateRunning = false;
            this._downloadSuccessful = false;
            listener?.updateStatus();
            if (res.accepted === false) {
                Logger.Notice(`User canceled ${res.type} app update to ${this.AvailableVersion}`);
            } else {
                Logger.Notice(`App update could not be started (${res.type})`);
            }
            await this.finish();
        }
    }

    public async FinishFlexibleUpdate() {
        await AppUpdate.completeFlexibleUpdate();
        this._updateRunning = false;
        this._downloadSuccessful = undefined;
        await this.finish();
    }

    public async OpenGooglePlay() {
        await AppUpdate.openAppStore();
    }

    private async finish() {
        await AppUpdate.removeAllListeners();
        this._modal = undefined;
    }

    private async getAppUpdateInfo(): Promise<boolean> {
        const updateinfo = await AppUpdate.getAppUpdateInfo();
        if ("error" in updateinfo) {
            Logger.Error(`Could not fetch app update: ${updateinfo.error}`);
            return false;
        }
        this._updateInfo = updateinfo;
        return true;
    }
}

export type AppUpdateListener = {
    updateStatus: () => void;
};
