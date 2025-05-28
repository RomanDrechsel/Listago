import { inject, Injectable } from "@angular/core";
import { AdMob, AdMobBannerSize, AdmobConsentDebugGeography, AdmobConsentInfo, AdmobConsentRequestOptions, AdmobConsentStatus, BannerAdOptions, BannerAdPluginEvents, BannerAdPosition, BannerAdSize } from "@capacitor-community/admob";
import { KeyboardInfo } from "@capacitor/keyboard";
import { EdgeToEdge } from "@capawesome/capacitor-android-edge-to-edge-support";
import SysInfo from "src/app/plugins/sysinfo/sys-info";
import { environment } from "../../../environments/environment";
import { Logger } from "../logging/logger";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";

@Injectable({
    providedIn: "root",
})
export class AdmobService {
    /** is the banner currently shown */
    private _bannerIsShown: boolean = false;

    /** last height of the banner in px */
    private _bannerHeight: number = 56;

    private _isInitialized: boolean = false;

    private readonly Preferences = inject(PreferencesService);

    public get Initialized(): boolean {
        return this._isInitialized;
    }

    public async Initialize() {
        this._isInitialized = false;

        this._bannerHeight = await this.Preferences.Get(EPrefProperty.AdmobBannerHeight, this._bannerHeight);
        await this.resizeContainer(this._bannerHeight);

        await AdMob.initialize({
            initializeForTesting: environment.publicRelease !== true,
            testingDevices: ["83906043-1167-4ca6-8f7c-10ca1ad1abe1"],
        });

        await this.RequestConsent(false);

        AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
            Logger.Debug(`Admob banner loaded`);
            this._bannerIsShown = true;
        });

        AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
            this.resizeContainer(size.height);
        });

        AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error: any) => {
            Logger.Error(`Admob banner error: `, error);
            this._bannerIsShown = false;
        });

        AdMob.addListener(BannerAdPluginEvents.Closed, () => {
            Logger.Debug(`Admob banner closed`);
            this._bannerIsShown = false;
        });

        if (environment.publicRelease === true) {
            Logger.Debug(`Admob initialized`);
        } else {
            Logger.Debug(`Admob initialized in test mode`);
        }

        this._isInitialized = true;

        await this.ShowBanner();
    }

    /**
     * Shows the Admob banner if it's not already shown.
     */
    public async ShowBanner(): Promise<void> {
        if (this._bannerIsShown === false) {
            const options: BannerAdOptions = {
                adId: "ca-app-pub-4693945059643494/5993520446",
                adSize: BannerAdSize.ADAPTIVE_BANNER,
                position: BannerAdPosition.BOTTOM_CENTER,
                margin: await this.saveAreaBottom(),
                isTesting: environment.publicRelease !== true,
                //npa: true
            };
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
        this.resizeContainer(0);
        this._bannerIsShown = false;
    }

    /**
     * Requests consent for personalized advertising.     *
     * @param reset_consent If true, forces the consent form to be shown even if it's not required.
     * @returns true if consent is obtained or not required, false otherwise.
     */
    public async RequestConsent(reset_consent: boolean = true): Promise<boolean> {
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
    public async OnKeyboardShow(info: KeyboardInfo): Promise<void> {
        await this.HideBanner();
    }

    /**
     * show the ad, if the keyboard is closed
     */
    public async OnKeyboardHide(): Promise<void> {
        await this.resumeBanner();
    }

    /** resumes the banner */
    private async resumeBanner() {
        await AdMob.resumeBanner();
        this._bannerIsShown = true;
        this.resizeContainer(this._bannerHeight);
    }

    /**
     * resizes the space for the banner
     * @param height banner height in px
     */
    private async resizeContainer(height: number) {
        const container = document.querySelector("ion-app") as HTMLElement;
        if (container) {
            if (height > 0) {
                if (this._bannerHeight !== height) {
                    Logger.Debug(`Admob banner height changed to ${height}px`);
                }
                this._bannerHeight = height;
                this.Preferences.Set(EPrefProperty.AdmobBannerHeight, height);
            }
            container.style.marginBottom = height + "px";
        }
    }

    private async saveAreaBottom(): Promise<number> {
        const result = await EdgeToEdge.getInsets();
        const density = await SysInfo.DisplayDensity();
        if (density.density < 1) {
            Logger.Error(`Could not get screen density: `, density);
            return 0;
        }
        return result.bottom / density.density;
    }
}
