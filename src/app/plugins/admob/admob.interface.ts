import { Plugin, type PluginListenerHandle } from "@capacitor/core";
import { AdmobPluginEvents } from "./admib-plugin-events";
import { AdmobBannerClosedEventArgs } from "./admob-banner-closed-event-args";
import { AdmobBannerFailedToLoadEventArgs } from "./admob-banner-failed-to-load-event-args";
import { AdmobBannerLoadedEventArgs } from "./admob-banner-loaded-event-args";
import { AdmobBannerNewOrientationEventArgs } from "./admob-banner-new-orientation-event-args";
import { AdmobBannerSizeChangedEventArgs } from "./admob-banner-size-changed-event-args";
import { AdmobBannerOptions } from "./admob-banner.options";
import { AdmobConsentInfoResult } from "./admob-consent-info-result";
import { AdmobInitializeOptions } from "./admob-initialize-options";
import { AdmobInitializeResult } from "./admob-initialze-result";
import { AdmobRequestConsentInfoOptions } from "./admob-request-consent-info-options";
import { AdmobStateResult } from "./admob-state-result";

export interface IAdmob extends Plugin {
    Initialize(options: AdmobInitializeOptions): Promise<AdmobInitializeResult>;
    RequestNewBanner(options: AdmobBannerOptions): Promise<void>;
    HideBanner(): Promise<void>;
    ResumeBanner(): Promise<void>;
    DestroyBanner(): Promise<void>;
    GetState(): Promise<AdmobStateResult>;
    RequestConsentInfo(options: AdmobRequestConsentInfoOptions): Promise<AdmobConsentInfoResult>;
    LoadAndShowConsentFormIfRequired(): Promise<AdmobConsentInfoResult>;
    ResetConsentInfo(): Promise<void>;
    ShowPrivacyOptionsFormU(): Promise<void>;

    addListener(eventName: AdmobPluginEvents.BannerLoaded, listenerFunc: (args: AdmobBannerLoadedEventArgs) => void): Promise<PluginListenerHandle>;
    addListener(eventName: AdmobPluginEvents.BannerSizeChanged, listenerFunc: (args: AdmobBannerSizeChangedEventArgs) => void): Promise<PluginListenerHandle>;
    addListener(eventName: AdmobPluginEvents.BannerFailedToLoad, listenerFunc: (args: AdmobBannerFailedToLoadEventArgs) => void): Promise<PluginListenerHandle>;
    addListener(eventName: AdmobPluginEvents.BannerClosed, listenerFunc: (args: AdmobBannerClosedEventArgs) => void): Promise<PluginListenerHandle>;
    addListener(eventName: AdmobPluginEvents.BannerNewOrientation, listenerFunc: (args: AdmobBannerNewOrientationEventArgs) => void): Promise<PluginListenerHandle>;
}
