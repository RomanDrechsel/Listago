import { Culture, LocalizationService } from "./localization.service";

export class Locale {
    private static Service: LocalizationService;

    /**
     * initialize service
     * @param service LocalizationService
     */
    public static async Initialize(service: LocalizationService) {
        Locale.Service = service;
        await service.Initialize();
    }

    /**
     * get current language
     * @returns short language
     */
    public static currentLang(): Culture {
        return Locale.Service.CurrentLanguage;
    }

    /**
     * get one or more text parts
     * @param keys key or keys, which should be fetched
     * @param params placeholder to me replaced in text
     * @returns string or array of string from localization
     */
    public static getText(keys: string | string[], params: Object | undefined = undefined): any {
        return Locale.Service.Translate.instant(keys, params);
    }
}
