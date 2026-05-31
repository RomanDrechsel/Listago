import { Plugin, type PluginListenerHandle } from "@capacitor/core";

export interface ISysInfo extends Plugin {
    NightMode(): Promise<{ isNightMode: boolean }>;
    AppInstalled(args: { packageName: string; silent?: boolean }): Promise<{ installed: boolean }>;
    AppIsReady(): Promise<{ actions?: string }>;
    requestApplyInsets(): Promise<void>;
    addListener<T>(eventName: string, listenerFunc: (data: T) => void): Promise<PluginListenerHandle>;
}
