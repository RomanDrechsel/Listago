import { Plugin, type PluginListenerHandle } from "@capacitor/core";
import type { ClearAppCacheEventArgs } from "./event-args/clear-app-cache-event-args";

export interface ISysInfo extends Plugin {
    DisplayDensity(): Promise<{ density: number }>;
    NightMode(): Promise<{ isNightMode: boolean }>;
    Logcat(args: { level: "d" | "n" | "i" | "e"; message: string }): Promise<void>;
    ClearAppCache(): Promise<ClearAppCacheEventArgs>;
    AppInstalled(args: { packageName: string; silent?: boolean }): Promise<{ installed: boolean }>;
    AppIsReady(): Promise<{ actions?: string }>;
    addListener<T>(eventName: string, listenerFunc: (data: T) => void): Promise<PluginListenerHandle>;
}
