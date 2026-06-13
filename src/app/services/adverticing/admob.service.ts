import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { AdMob, AdMobBannerSize, AdmobConsentDebugGeography, AdmobConsentInfo, AdmobConsentRequestOptions, AdmobConsentStatus, BannerAdOptions, BannerAdPluginEvents, BannerAdPosition, BannerAdSize } from "@capacitor-community/admob";
import type { PluginListenerHandle } from "@capacitor/core";
import { Keyboard, KeyboardInfo } from "@capacitor/keyboard";
import type { Subscription } from "rxjs";
import Admob from "src/app/plugins/admob/admob";
import { environment } from "../../../environments/environment";
import { Logger } from "../logging/logger";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";
import { AdmobReserveSpace } from "./admob-reserve-space";

@Injectable({
    providedIn: "root",
})
export class AdmobService {
    /** is the banner currently shown */
    private _bannerIsShown: boolean = false;

    /** last height of the banner in px */
    public static BannerHeight: number = 56;

    private readonly _preferences = inject(PreferencesService);
    private readonly _http = inject(HttpClient);
    private _keyboardUpListerner?: PluginListenerHandle;
    private _keyboardDownListener?: PluginListenerHandle;
    private _admobBannerLoadedListener?: PluginListenerHandle;
    private _admobBannerChangedListener?: PluginListenerHandle;
    private _admobBannerFailedListener?: PluginListenerHandle;
    private _admobBannerClosedListener?: PluginListenerHandle;
    private _preferencesSubscription?: Subscription;

    public async Initialize() {
        AdmobService.BannerHeight = await this._preferences.Get(EPrefProperty.AdmobBannerHeight, AdmobService.BannerHeight);
        await this.resizeContainer(AdmobService.BannerHeight);

        const initResult = await Admob.Initialize({
            initializeForTesting: environment.publicRelease !== true,
            testingDevices: ["1EEF966BEC6747BF8ABBCDF00F9E7426"],
        });

        if (!initResult.initialized) {
            Logger.Error(`Admob initialization failed`, initResult);
            return;
        }

        await this.RequestConsent(false);

        this._admobBannerLoadedListener = await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
            Logger.Debug(`Admob banner loaded`);
            this._bannerIsShown = true;
        });

        this._admobBannerChangedListener = await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
            if (size.height > 0) {
                this._bannerIsShown = true;
            } else {
                this._bannerIsShown = false;
            }
            this.resizeContainer(size.height);
        });

        this._admobBannerFailedListener = await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error: any) => {
            Logger.Error(`Admob banner error: `, error);
            this._bannerIsShown = false;
            this.resizeContainer(0);
        });

        this._admobBannerClosedListener = await AdMob.addListener(BannerAdPluginEvents.Closed, () => {
            Logger.Debug(`Admob banner closed`);
            this._bannerIsShown = false;
            this.resizeContainer(0);
        });

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

        this._isInitialized = true;

        await this.ShowBanner();
    }

    public async Shutdown(): Promise<void> {
        await this.HideBanner();
        this._keyboardDownListener?.remove();
        this._keyboardDownListener = undefined;
        this._keyboardUpListerner?.remove();
        this._keyboardUpListerner = undefined;
        this._admobBannerChangedListener?.remove();
        this._admobBannerChangedListener = undefined;
        this._admobBannerClosedListener?.remove();
        this._admobBannerClosedListener = undefined;
        this._admobBannerFailedListener?.remove();
        this._admobBannerFailedListener = undefined;
        this._admobBannerLoadedListener?.remove();
        this._admobBannerLoadedListener = undefined;
        this._preferencesSubscription?.unsubscribe();
        this._preferencesSubscription = undefined;

        if (environment.publicRelease === true) {
            Logger.Notice(`Admob shut down`);
        } else {
            Logger.Notice(`Admob test mode shut down`);
        }

        this._isInitialized = false;
    }

    /**
     * Shows the Admob banner if it's not already shown.
     */
    public async ShowBanner(): Promise<void> {
        if (this._bannerIsShown === false) {
            const options: BannerAdOptions = {
                adId: "ca-app-pub-4693945059643494/6924249345",
                adSize: BannerAdSize.ADAPTIVE_BANNER,
                position: BannerAdPosition.BOTTOM_CENTER,
                margin: 0,
                isTesting: environment.publicRelease !== true,
                //npa: true
            };
            console.log("DEBUG", options);
            try {
                await AdMob.removeBanner();
                await AdMob.showBanner(options);
            } catch {
                await AdMob.resumeBanner();
            }
        }
    }

    /**
     * Hides the Admob banner if it's currently shown.
     */
    public async HideBanner(): Promise<void> {
        if (this._bannerIsShown === true) {
            await AdMob.hideBanner();
        }
        this._bannerIsShown = false;
        this.resizeContainer(0);
    }

    /**
     * Requests consent for personalized advertising.     *
     * @param reset_consent If true, forces the consent form to be shown even if it's not required.
     * @returns true if consent is obtained or not required, false otherwise.
     */
    public async RequestConsent(reset_consent: boolean = true): Promise<boolean> {
        try {
            const authorizationStatus = (await AdMob.trackingAuthorizationStatus()).status;
            Logger.Debug(`Admob tracking authorization status: ${authorizationStatus}`);

            if (authorizationStatus === "notDetermined" || reset_consent) {
                await AdMob.requestTrackingAuthorization();
            }

            if ((await AdMob.trackingAuthorizationStatus()).status == "authorized") {
                let consentInfo = await this.getConsentStatus();
                if (consentInfo.status == AdmobConsentStatus.NOT_REQUIRED) {
                    Logger.Debug(`Admob constent status: ${consentInfo.status}`);
                } else {
                    const before = consentInfo.status;
                    if (consentInfo.isConsentFormAvailable && (consentInfo.status === AdmobConsentStatus.REQUIRED || reset_consent)) {
                        Logger.Debug(`Show Admob ConsentForm...`);
                        if (reset_consent) {
                            await AdMob.resetConsentInfo();
                            return this.RequestConsent(false);
                        }
                        consentInfo = await AdMob.showConsentForm();
                    }
                    if (before !== consentInfo.status) {
                        Logger.Debug(`Admob consent status changed: ${before} -> ${consentInfo.status}`);
                    }
                }

                return consentInfo.status === AdmobConsentStatus.OBTAINED || consentInfo.status === AdmobConsentStatus.NOT_REQUIRED;
            } else {
                return false;
            }
        } catch (e) {
            Logger.Error(`Could not check Admob tracking authorization status: `, e);
            return false;
        }
    }

    /**
     * Retrieves the current consent status for personalized advertising.
     *
     * @returns  object containing the current consent status.
     */
    public async getConsentStatus(): Promise<AdmobConsentInfo> {
        let options: AdmobConsentRequestOptions = {};
        if (environment.publicRelease !== true) {
            options = {
                debugGeography: AdmobConsentDebugGeography.EEA,
                testDeviceIdentifiers: ["83906043-1167-4ca6-8f7c-10ca1ad1abe1"],
            };
        }
        return AdMob.requestConsentInfo(options);
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
        await this.resumeBanner();
    }

    /** resumes the banner */
    private async resumeBanner() {
        await AdMob.resumeBanner();
        this._bannerIsShown = true;
        this.resizeContainer(AdmobService.BannerHeight);
    }

    /**
     * resizes the space for the banner
     * @param height banner height in px
     */
    private async resizeContainer(height: number) {
        if (height > 0) {
            if (AdmobService.BannerHeight !== height) {
                Logger.Debug(`Admob banner height changed to ${height}px`);
                AdmobService.BannerHeight = height;
                this._preferences.Set(EPrefProperty.AdmobBannerHeight, height);
            }
        }
        await AdmobReserveSpace.SetAdmobHeight(height);
        await AdmobReserveSpace.ToggleContent(!this._bannerIsShown);
    }
}
