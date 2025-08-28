import { Plugin, type PluginListenerHandle } from "@capacitor/core";
import type { AppUpdateFlexibleStatus } from "./app-update-flexible-status";
import type { AppUpdateInfo, AppUpdateInfoError } from "./app-update-info";
import type { AppUpdatePerformUpdateResult } from "./app-update-perform-update-result";

export interface IAppUpdate extends Plugin {
    getAppUpdateInfo(): Promise<AppUpdateInfo | AppUpdateInfoError>;
    performUpdate(): Promise<AppUpdatePerformUpdateResult>;
    completeFlexibleUpdate(): Promise<void>;
    openAppStore(): Promise<void>;
    addListener(eventName: "onFlexibleUpdateStateChange", listenerFunc: (data: AppUpdateFlexibleStatus) => void): Promise<PluginListenerHandle>;
}
