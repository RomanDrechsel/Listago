import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { Keyboard, KeyboardInfo } from "@capacitor/keyboard";
import type { Subscription } from "rxjs";
import { AdmobPluginEvents } from "src/app/plugins/admob/admib-plugin-events";
import AdMob from "src/app/plugins/admob/admob";
import { AdmobBannerClosedEventArgs } from "src/app/plugins/admob/admob-banner-closed-event-args";
import { AdmobBannerFailedToLoadEventArgs } from "src/app/plugins/admob/admob-banner-failed-to-load-event-args";
import { AdmobBannerLoadedEventArgs } from "src/app/plugins/admob/admob-banner-loaded-event-args";
import { AdmobBannerNewOrientationEventArgs } from "src/app/plugins/admob/admob-banner-new-orientation-event-args";
import { AdmobBannerSize } from "src/app/plugins/admob/admob-banner-size";
import { AdmobBannerSizeChangedEventArgs } from "src/app/plugins/admob/admob-banner-size-changed-event-args";
import { AdmobBannerOptions } from "src/app/plugins/admob/admob-banner.options";
import { AdmobConsentInfoResult } from "src/app/plugins/admob/admob-consent-info-result";
import { AdmobStateResult } from "src/app/plugins/admob/admob-state-result";
import { environment } from "../../../environments/environment";
import { Logger } from "../logging/logger";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";
import { AdmobReserveSpace } from "./admob-reserve-space";

@Injectable({
    providedIn: "root",
})
export class AdmobService {
    public AdmobInitialized: boolean = false;
    private _lastBannerHeight = 50;
    private readonly _preferences = inject(PreferencesService);
    private readonly _http = inject(HttpClient);
    private _keyboardUpListerner?: PluginListenerHandle;
    private _keyboardDownListener?: PluginListenerHandle;
    private _admobListeners: PluginListenerHandle[] = [];
    private _preferencesSubscription?: Subscription;

    /**
     * AdMob adId for banner, found on AdMob page
     */
    private readonly _adId = "ca-app-pub-4693945059643494/6924249345";

    /**
     * found in logcat near "This device is not registered as a test device."
     */
    private readonly _testDeviceId = "1EEF966BEC6747BF8ABBCDF00F9E7426";

    public async Initialize() {
        this._lastBannerHeight = await this._preferences.Get(EPrefProperty.AdmobBannerHeight, this._lastBannerHeight);
        await this.resizeAdMobPlaceholder(this._lastBannerHeight);
        await AdmobReserveSpace.ToggleContent(true);
        await AdmobReserveSpace.SetAdmobText(this._http);

        const initResult = await AdMob.Initialize({
            initializeForTesting: environment.publicRelease !== true,
            testingDevices: environment.publicRelease !== true ? [this._testDeviceId] : [],
            timeout: 30,
        });

        if (!initResult.initialized) {
            this.AdmobInitialized = false;
            Logger.Error(`Admob initialization failed`, initResult);
            return;
        }

        this.AdmobInitialized = true;

        await this.RequestConsent(false);

        this._admobListeners.push(
            await AdMob.addListener(AdmobPluginEvents.BannerLoaded, (args: AdmobBannerLoadedEventArgs) => {
                Logger.Debug(`Admob banner loaded: `, args);
                AdmobReserveSpace.ToggleContent(false);
            }),
        );

        this._admobListeners.push(
            await AdMob.addListener(AdmobPluginEvents.BannerSizeChanged, (args: AdmobBannerSizeChangedEventArgs) => {
                this.resizeAdMobPlaceholder(args.height);
            }),
        );

        this._admobListeners.push(
            await AdMob.addListener(AdmobPluginEvents.BannerFailedToLoad, (args: AdmobBannerFailedToLoadEventArgs) => {
                Logger.Error(`Admob banner failed to load: `, args);
                AdmobReserveSpace.ToggleContent(true);
                this.resizeAdMobPlaceholder(0);
            }),
        );

        this._admobListeners.push(
            await AdMob.addListener(AdmobPluginEvents.BannerClosed, (args: AdmobBannerClosedEventArgs) => {
                Logger.Debug(`Admob banner closed: `, args);
                this.resizeAdMobPlaceholder(0);
                AdmobReserveSpace.ToggleContent(true);
            }),
        );

        this._admobListeners.push(
            await AdMob.addListener(AdmobPluginEvents.BannerNewOrientation, (args: AdmobBannerNewOrientationEventArgs) => {
                Logger.Debug(`Admob banner reloaded, due to device orientation change from '${args.oldOrientation}' to '${args.newOrientation}'`);
            }),
        );

        if (environment.publicRelease === true) {
            Logger.Debug(`Admob initialized`);
        } else {
            Logger.Debug(`Admob initialized in test mode`);
        }

        this._preferencesSubscription = this._preferences.onPrefChanged$.subscribe(async pref => {
            if (pref.prop == EPrefProperty.AppLanguage) {
                await AdmobReserveSpace.SetAdmobText(this._http);
            }
        });

        this._keyboardUpListerner = await Keyboard.addListener("keyboardWillShow", info => this.onKeyboardShow(info));
        this._keyboardDownListener = await Keyboard.addListener("keyboardWillHide", () => this.onKeyboardHide());

        await this.RequestNewBanner();
    }

    public async Shutdown(): Promise<void> {
        await this.DestroyBanner();
        this.resizeAdMobPlaceholder(0);
        AdmobReserveSpace.ToggleContent(true);

        for (const listener of this._admobListeners) {
            listener.remove();
        }
        this._admobListeners = [];

        this._preferencesSubscription?.unsubscribe();
        this._preferencesSubscription = undefined;
        this._keyboardDownListener?.remove();
        this._keyboardDownListener = undefined;
        this._keyboardUpListerner?.remove();
        this._keyboardUpListerner = undefined;

        if (environment.publicRelease === true) {
            Logger.Notice(`Admob shut down`);
        } else {
            Logger.Notice(`Admob test mode shut down`);
        }
        this.AdmobInitialized = false;
    }

    /**
     * Shows the Admob banner, destorying the old one if it exists.
     */
    public async RequestNewBanner(): Promise<void> {
        const admobState = await this.getState();
        if (!admobState.isAdMobInitialized || !admobState.areBannersAllowed) {
            await this.DestroyBanner();
            return;
        }
        const options: AdmobBannerOptions = {
            adId: this._adId,
            gravity: "BOTTOM",
            isTesting: environment.publicRelease !== true,
        };

        try {
            await AdMob.RequestNewBanner(options);
        } catch (ex: any) {
            Logger.Error(`Could not request new AdMob banner: `, ex);
        }
    }

    /**
     * Hides the Admob banner if it's currently shown.
     */
    public async HideBanner(): Promise<void> {
        const admobState = await this.getState();
        if (!admobState.isAdMobInitialized) {
            await this.DestroyBanner();
            return;
        }

        try {
            await AdMob.HideBanner();
        } catch {}
        this.resizeAdMobPlaceholder(0);
    }

    /**
     * Resumes the banner
     */
    private async ResumeBanner() {
        const admobState = await this.getState();
        if (!admobState.isAdMobInitialized || !admobState.areBannersAllowed) {
            await this.DestroyBanner();
            return;
        }

        try {
            await AdMob.ResumeBanner();
            this.resizeAdMobPlaceholder(this._lastBannerHeight);
        } catch {
            this.resizeAdMobPlaceholder(0);
            await this.RequestNewBanner();
        }
    }

    /**
     * Removes the AdMob banner, not just hide it
     */
    public async DestroyBanner(): Promise<void> {
        await AdMob.DestroyBanner();
        this.resizeAdMobPlaceholder(0);
    }

    /**
     * Requests consent for personalized advertising.
     * @param resetConsent If true, forces the consent form to be shown even if it's not required.
     * @returns true if consent is obtained or not required, false otherwise.
     */
    public async RequestConsent(resetConsent: boolean = true): Promise<boolean> {
        try {
            if (resetConsent) {
                await AdMob.ResetConsentInfo();
            }

            const consentInfo = await this.getConsentStatus();
            const consentInfoForm = await AdMob.LoadAndShowConsentFormIfRequired();
            Logger.Debug(`AdMob constent info: ${consentInfo}`);

            if (consentInfo.status !== consentInfoForm.status) {
                Logger.Notice(`Admob consent status changed: ${consentInfo.status} -> ${consentInfoForm.status}`);
            }

            if (consentInfo.canRequestAds && !consentInfoForm.canRequestAds) {
                Logger.Important(`Unfortunately no AdMob banners are allowed to present, due to users consent settings.`, consentInfoForm.canRequestAds);
            } else if (!consentInfo.canRequestAds && consentInfoForm.canRequestAds) {
                Logger.Important(`Fortunately AdMob banners are now allowed to present, due to users consent settings.`, consentInfoForm);
            }

            return consentInfo.canRequestAds;
        } catch (error) {
            Logger.Error(`Could not request Admob consent: `, error);
            return false;
        }
    }

    /**
     * Retrieves the current consent status for personalized advertising.
     *
     * @returns  object containing the current consent status.
     */
    public async getConsentStatus(): Promise<AdmobConsentInfoResult> {
        return AdMob.RequestConsentInfo({ debug: environment.publicRelease !== true, testDeviceId: this._testDeviceId });
    }

    /**
     * returns the state of the AdMob plugin
     * @returns state information of the AdMob plugin
     */
    public async getState(): Promise<AdmobStateResult> {
        return AdMob.GetState();
    }

    /**
     * hide the ad, if the keyboard is too big
     * @param info height of the keyboard
     */
    private async onKeyboardShow(_info: KeyboardInfo): Promise<void> {
        await this.HideBanner();
    }

    /**
     * show the ad, if the keyboard is closed
     */
    private async onKeyboardHide(): Promise<void> {
        await this.ResumeBanner();
    }

    /**
     * resizes the space for the banner
     * @param height banner height in px
     */
    private async resizeAdMobPlaceholder(size: AdmobBannerSize | number) {
        const height = typeof size === "number" ? size : size.height;
        if (height > 0) {
            this._lastBannerHeight = height;
            this._preferences.Set(EPrefProperty.AdmobBannerHeight, height);
        }
        await AdmobReserveSpace.SetAdmobHeight(height);
    }
}
