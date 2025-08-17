import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { getBrowserCultureLang, type Translation, TranslocoEvents, TranslocoService } from "@jsverse/transloco";
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

    public readonly Transloco = inject(TranslocoService);
    private readonly _preferences = inject(PreferencesService);
    private readonly _config = inject(ConfigService);
    private readonly _http = inject(HttpClient);

    private _availableTranslations: Culture[] = [];

    private _loadedScopes: { [key: string]: string | undefined } = {};

    constructor() {
        this.Transloco.setAvailableLangs([...new Set<string>(this.AvailableTranslations.map(l => l.localeFile))]);
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
        let lang: string | Culture | undefined = await this._preferences.Get<string>(EPrefProperty.AppLanguage, "");
        if (lang.length == 0) {
            if (Capacitor.isNativePlatform()) {
                lang = (await Device.getLanguageTag()).value;
                Logger.Debug(`Device language is ${lang}`);
            } else {
                lang = getBrowserCultureLang();
                Logger.Debug(`Browser language is ${lang}`);
            }
        } else {
            Logger.Debug(`User language is ${lang}`);
        }

        if (!lang || !this.AvailableTranslations.some(l => l.Match(String(lang)))) {
            lang = this.FallbackCulture;
        }

        this.Transloco.events$.subscribe((event: TranslocoEvents) => {
            if (event.type == "translationLoadFailure") {
                Logger.Error(`Could not load localization: `, event.payload);
            }
        });

        this.ChangeLanguage(lang, true);
        await this.loadScope("services/localization/localization-service", "service-locale");
        await this.loadScope("common/languages", "languages");

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
                if (init || this._currentCulture.localeFile != culture.localeFile) {
                    this._currentCulture = culture;
                    this.Transloco.setActiveLang(culture.localeFile);
                    await this.reloadScopes();
                }
            }
            await this._preferences.Set(EPrefProperty.AppLanguage, this._currentLocale);
            Logger.Debug(`Changed language to ${this._currentCulture.name} (${this._currentLocale})`);
            this.WarnForTranslation(init);
        }
    }

    /**
     * get one text part
     * @param key key, which should be fetched
     * @param params placeholder to me replaced in text
     * @returns string from localization
     */
    public getText(key: string, params: Object | undefined = undefined): string {
        return this.Transloco.translate(key, params);
    }

    /**
     * get several text parts
     * @param keys array of keys which should be fetched
     * @param params placeholder to me replaced in text
     * @returns array of string from localization
     */
    public getTexts(keys: string[], params: Object | undefined = undefined): Translation {
        let ret: string | Translation = {};
        for (const key of keys) {
            ret[key] = this.Transloco.translate(key, params);
        }

        return ret;
    }

    /**
     * display an alert, if an ai translation is used
     */
    public async WarnForTranslation(init: boolean = true) {
        if (!init && ["de", "en"].indexOf(this.CurrentLanguage.localeFile) < 0) {
            await AppService.Popups.Alert.Show({
                message: this.getText("service-locale.language_hint", { email: this._config.EMailAddress }),
            });
        }
    }

    public async loadScope(scope: string, alias?: string): Promise<void> {
        //check if scope is already loaded
        for (const [s, a] of Object.entries(this._loadedScopes)) {
            if (scope == s && alias == a) {
                return;
            }
        }

        return new Promise((resolve, reject) => {
            this._http.get<Translation>(`/assets/i18n/${scope}/${this._currentCulture.localeFile}.json`).subscribe({
                next: (translation: Translation) => {
                    for (let [key, value] of Object.entries(translation)) {
                        key = alias ? `${alias}.${key}` : key;
                        this.Transloco.setTranslationKey(key, String(value), { lang: this._currentCulture.localeFile });
                    }
                    this._loadedScopes[scope] = alias;
                    resolve();
                },
                error: error => reject(error),
            });
        });
    }

    private async reloadScopes() {
        const copy: { [key: string]: string | undefined } = { ...this._loadedScopes };
        this._loadedScopes = {};
        for (const [scope, alias] of Object.entries(copy)) {
            await this.loadScope(scope, alias);
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
