import type { HttpClient } from "@angular/common/http";
import { Preferences } from "@capacitor/preferences";
import { firstValueFrom } from "rxjs";
import { EPrefProperty } from "../storage/preferences.service";
import { AdmobService } from "./admob.service";

export class ReserveSpace {
    private _bannerDiv?: HTMLElement | null;
    private _http: HttpClient;

    constructor(http: HttpClient) {
        this._http = http;
    }

    private get bannerDiv(): HTMLElement | null {
        if (!this._bannerDiv) {
            this._bannerDiv = document.getElementById("admob-reserved-space");
        }
        return this._bannerDiv;
    }

    public async SetAdmobHeight(height?: number) {
        if (height === undefined) {
            const pref = (await Preferences.get({ key: EPrefProperty.AdmobBannerHeight })).value;
            if (pref) {
                height = parseInt(pref);
            } else {
                height = 56;
            }
        }

        AdmobService.BannerHeight = height;
        this.bannerDiv?.style.setProperty("height", `${height}px`);

        const ionapp = document.querySelector("ion-app");
        if (ionapp) {
            ionapp.style.marginBottom = `${height}px`;
        } else {
            //happens, if ion-app is not yet initialized on startup
            const observer = new MutationObserver(() => {
                const ionApp = document.querySelector("ion-app");
                if (ionApp) {
                    ionApp.style.marginBottom = `${height}px`;
                    observer.disconnect();
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    public async SetAdmobText() {
        const textDiv = this.bannerDiv?.querySelector(".text");
        if (textDiv) {
            let locale = (await Preferences.get({ key: EPrefProperty.AppLanguage })).value;
            if (locale) {
                locale = JSON.parse(locale);
            } else {
                locale = "en-US";
            }
            let file = "en";
            switch (locale) {
                case "de-DE":
                case "es-ES":
                case "fr-FR":
                case "hi-IN":
                case "it-IT":
                case "ja-JP":
                case "uk-UA":
                    file = locale.substring(0, 2);
                    break;
                case "zh-CN":
                    file = "zhs";
                    break;
                case "zh-TW":
                    file = "zht";
                    break;
            }
            const content = (await firstValueFrom(this._http.get(`assets/i18n/ads/${file}.json`))) as any;
            if (content?.loading) {
                textDiv.innerHTML = content.loading;
            }
        }
    }
}
