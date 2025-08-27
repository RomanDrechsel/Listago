import { Plugin } from "@capacitor/core";
import type { AppUpdateInfo, AppUpdateInfoError } from "./app-update-info";
import type { AppUpdatePerformUpdateResult } from "./app-update-perform-update-result";

export interface IAppUpdate extends Plugin {
    getAppUpdateInfo(): Promise<AppUpdateInfo | AppUpdateInfoError>;
    performUpdate(): Promise<AppUpdatePerformUpdateResult>;
    completeFlexibleUpdate(): Promise<void>;
    openAppStore(): Promise<void>;
}
