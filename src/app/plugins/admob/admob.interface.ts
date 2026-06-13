import { Plugin, type PluginListenerHandle } from "@capacitor/core";
import { AdmobBannerClosedEventArgs } from "./admob-banner-closed-event-args";
import { AdmobBannerFailedToLoadEventArgs } from "./admob-banner-failed-to-load-event-args";
import { AdmobBannerLoadedEventArgs } from "./admob-banner-loaded-event-args";
import { AdmobBannerSizeChangedEventArgs } from "./admob-banner-size-changed-event-args";
import { AdmobBannerOptions } from "./admob-banner.options";
import { AdmobInitializeOptions } from "./admob-initialize-options";
import { AdmobInitializeResult } from "./admob-initialze-result";
import { AdmmobStateResult } from "./admob-state-result";

export interface IAdmob extends Plugin {
    Initialize(options?: AdmobInitializeOptions): Promise<AdmobInitializeResult>;
    ShowBanner(options: AdmobBannerOptions): Promise<void>;
    HideBanner(): Promise<void>;
    ResumeBanner(): Promise<void>;
    RemoveBanner(): Promise<void>;
    GetState(): Promise<AdmmobStateResult>;

    addListener(eventName: "bannerLoaded", listenerFunc: (args: AdmobBannerLoadedEventArgs) => void): Promise<PluginListenerHandle>;

    addListener(eventName: "bannerSizeChanged", listenerFunc: (args: AdmobBannerSizeChangedEventArgs) => void): Promise<PluginListenerHandle>;

    addListener(eventName: "bannerFailedToLoad", listenerFunc: (args: AdmobBannerFailedToLoadEventArgs) => void): Promise<PluginListenerHandle>;

    addListener(eventName: "bannerClosed", listenerFunc: (args: AdmobBannerClosedEventArgs) => void): Promise<PluginListenerHandle>;
}
