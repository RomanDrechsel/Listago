import { inject, Injectable } from "@angular/core";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { TranslateService, Translation, TranslationObject } from "@ngx-translate/core";
import { firstValueFrom } from "rxjs";
import { AppService } from "../app/app.service";
import { ConfigService } from "../config/config.service";
import { Logger } from "../logging/logger";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";

@Injectable({
    providedIn: "root",
})
export class LocalizationService {
    /** fallback language if the requested language doesn't exist  */
    public readonly FallbackCulture = new Culture(
        {
            localeFile: "en",
            locale: "en-US",
            name: "English (US)",
            firstDayOfWeek: 0,
            h24: false,
            locale_regex: /^(en-[^-GB]*)$/i,
            gdpr: "en",
            icon: "us",
        },
        this,
    );

    /** current app language */
    private _currentCulture: Culture = this.FallbackCulture;
    private _currentLocale: string = this.FallbackCulture.locale;

    public readonly Translate = inject(TranslateService);
    private readonly Preferences = inject(PreferencesService);
    private readonly Config = inject(ConfigService);

    private _availableTranslations: Culture[] = [];

    constructor() {
        this.Translate.addLangs([...new Set<string>(this.AvailableTranslations.map(l => l.localeFile))]);
        this.Translate.setDefaultLang(this.FallbackCulture.localeFile);
    }

    /** all available languages */
    public get AvailableTranslations(): Culture[] {
        if (this._availableTranslations.length == 0) {
            this._availableTranslations = [
                this.FallbackCulture,
                new Culture({ localeFile: "en", locale: "en-GB", name: "English (UK)", gdpr: "en", icon: "gb" }, this),
                new Culture({ localeFile: "de", locale: "de-DE", name: "Deutsch", locale_regex: /^de[-_][0-9A-Za-z]{2,}$/i, gdpr: "de" }, this),
                new Culture({ localeFile: "es", locale: "es-ES", name: "Español", locale_regex: /^es[-_][0-9A-Za-z]{2,}$/i, gdpr: "es" }, this),
                new Culture({ localeFile: "fr", locale: "fr-FR", name: "Français", locale_regex: /^fr[-_][0-9A-Za-z]{2,}$/i, gdpr: "fr" }, this),
                new Culture({ localeFile: "hi", locale: "hi-IN", name: "हिंदी", locale_regex: /^hi[-_][0-9A-Za-z]{2,}$/i, gdpr: "hi", icon: "in", localizedAppStore: false }, this),
                new Culture({ localeFile: "it", locale: "it-IT", name: "Italiano", locale_regex: /^it[-_][0-9A-Za-z]{2,}$/i, gdpr: "it" }, this),
                new Culture({ localeFile: "jp", locale: "ja-JP", name: "日本語", locale_regex: /^ja[-_][0-9A-Za-z]{2,}$/i, gdpr: "jp" }, this),
                new Culture({ localeFile: "uk", locale: "uk-UA", name: "Українська", locale_regex: /^uk[-_][0-9A-Za-z]{2,}$/i, gdpr: "uk", icon: "ua", localizedAppStore: false }, this),
                new Culture({ localeFile: "zhs", locale: "zh-CN", name: "中文（简体）", firstDayOfWeek: 0, locale_regex: /^(zh-CN|zh-SG|zh-MY)$/i, gdpr: "zhs", icon: "sg" }, this),
                new Culture({ localeFile: "zht", locale: "zh-TW", name: "繁體中文", h24: false, locale_regex: /^(zh-TW|zh-HK|zh-MO)$/i, gdpr: "zht", icon: "tw" }, this),
            ];
        }

        return this._availableTranslations;
    }

    /**
     * returns the current cuture for the loaded locale
     */
    public get CurrentLanguage(): Culture {
        return this._currentCulture;
    }

    /**
     * initialize service
     */
    public async Initialize() {
        let lang: string | Culture | undefined = await this.Preferences.Get<string>(EPrefProperty.AppLanguage, "");
        if (lang.length == 0) {
            if (Capacitor.isNativePlatform()) {
                lang = (await Device.getLanguageTag()).value;
                Logger.Debug(`Device language is ${lang}`);
            } else {
                lang = this.Translate.getBrowserCultureLang();
                Logger.Debug(`Browser language is ${lang}`);
            }
        } else {
            Logger.Debug(`User language is ${lang}`);
        }

        if (!lang || !this.AvailableTranslations.some(l => l.Match(String(lang)))) {
            lang = this.FallbackCulture;
        }

        this.ChangeLanguage(lang, true);
        Logger.Debug("Locale initialized");
    }

    /**
     * change the current app language
     * @param culture new language
     */
    public async ChangeLanguage(locale: string | Culture | undefined, init: boolean = false) {
        let culture: Culture | undefined = undefined;
        if (locale instanceof Culture) {
            culture = locale;
        } else if (typeof locale == "string") {
            culture = this.AvailableTranslations.find(l => l.Match(String(locale)));
        }
        if (!culture) {
            Logger.Important(`Not supported language ${locale}, staying with ${this._currentLocale}`);
            return;
        }

        locale = typeof locale == "string" ? locale : culture.locale;
        if (locale != this._currentLocale) {
            this._currentLocale = locale;

            if (!this._currentCulture.Match(this._currentLocale)) {
                if (this._currentCulture.localeFile != culture.localeFile) {
                    await firstValueFrom(this.Translate.use(culture.localeFile));
                }
                this._currentCulture = culture;
            }
            await this.Preferences.Set(EPrefProperty.AppLanguage, this._currentLocale);
            Logger.Debug(`Changed language to ${this._currentCulture.name} (${this._currentLocale})`);
            this.WarnForTranslation(init);
        }
    }

    /**
     * get one or more text parts
     * @param keys key or keys, which should be fetched
     * @param params placeholder to me replaced in text
     * @returns string or array of string from localization
     */
    public getText(keys: string | string[], params: Object | undefined = undefined): Translation | TranslationObject {
        return this.Translate.instant(keys, params);
    }

    /**
     * display an alert, if an ai translation is used
     */
    public async WarnForTranslation(init: boolean = true) {
        if (["de", "en"].indexOf(this.CurrentLanguage.localeFile) < 0) {
            if (!init) {
                await AppService.Popups.Alert.Show({
                    message: this.getText("page_settings.language_hint", { email: this.Config.EMailAddress }),
                });
            }
        }
    }
}

export class Culture {
    public localeFile: string;
    public locale: string;
    public locale_regex?: RegExp;
    public name: string;
    public firstDayOfWeek: number;
    public h24: boolean;
    public gdpr: string;
    public localizationKey?: string;
    private _icon: string;
    private _localizationService?: LocalizationService;
    private _hasLocalizedGarminAppStore = false;

    public constructor(obj: { localeFile: string; locale: string; locale_regex?: RegExp; name: string; firstDayOfWeek?: number; h24?: boolean; gdpr?: string; icon?: string; localizationKey?: string; localizedAppStore?: boolean }, service: LocalizationService) {
        this.localeFile = obj.localeFile;
        this.locale = obj.locale;
        this.locale_regex = obj.locale_regex;
        this.name = obj.name;
        this.firstDayOfWeek = obj.firstDayOfWeek ?? 1;
        this.h24 = obj.h24 ?? true;
        this.gdpr = obj.gdpr ?? "en";
        this.localizationKey = obj.localizationKey;
        this._icon = obj.icon ?? obj.localeFile;
        this._localizationService = service;
        this._hasLocalizedGarminAppStore = obj.localizedAppStore ?? true;
    }

    public get Icon() {
        return `/assets/icons/countries/${this._icon}.png`;
    }

    public get LocalizedString(): string {
        const key = `languages.${this.locale}`;
        let locale = String(this._localizationService?.getText(key));
        if (locale == key || locale.length == 0 || locale == this.name) {
            return this.name;
        } else {
            return `${locale} - ${this.name}`;
        }
    }

    public Match(locale: string): boolean {
        return this.locale == locale || (this.locale_regex ? this.locale_regex.test(locale) : false);
    }

    public GarminAppStore(): string {
        if (this._hasLocalizedGarminAppStore) {
            return `https://apps.garmin.com/${this.locale}/apps/`;
        }

        return "https://apps.garmin.com/apps/";
    }
}
