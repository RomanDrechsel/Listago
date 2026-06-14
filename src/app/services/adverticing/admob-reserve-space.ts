import type { HttpClient } from "@angular/common/http";
import { Preferences } from "@capacitor/preferences";
import { firstValueFrom } from "rxjs";
import { EPrefProperty } from "../storage/preferences.service";
import { AdmobService } from "./admob.service";

export class AdmobReserveSpace {
    private static get _bannerPlaceholder(): HTMLElement | null {
        return document.getElementById("admob-placeholder") as HTMLElement | null;
    }

    public static async SetAdmobHeight(height?: number): Promise<void> {
        if (height === undefined) {
            const pref = (await Preferences.get({ key: EPrefProperty.AdmobBannerHeight })).value;
            if (pref) {
                height = parseInt(pref);
            } else {
                height = 56;
            }
        }

        document.documentElement.style.setProperty("--admob-placeholder-height", `${height}px`);
        AdmobService.AdmobBannerHeight = height;
    }

    public static async SetAdmobText(http: HttpClient): Promise<void> {
        const textDiv = AdmobReserveSpace._bannerPlaceholder?.querySelector(".text");
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
            const content = (await firstValueFrom(http.get(`assets/i18n/ads/${file}.json`))) as any;
            if (content?.loading) {
                textDiv.innerHTML = content.loading;
            }
        }
    }

    public static async ToggleContent(show: boolean): Promise<void> {
        for (const child of Array.from(AdmobReserveSpace._bannerPlaceholder?.children ?? [])) {
            if (child instanceof HTMLElement) {
                (child as HTMLElement).style.visibility = show ? "visible" : "hidden";
            }
        }
    }
}
