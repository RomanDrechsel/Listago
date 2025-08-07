import { Injectable } from "@angular/core";

@Injectable({
    providedIn: "root",
})
export class ConfigService {
    /**
     * e-mail address for app related stuff
     */
    public readonly EMailAddress = "listago@roman-drechsel.de";

    /**
     * link to my website
     */
    public readonly Homepage = "roman-drechsel.de";

    /**
     * build version of the garmin app
     */
    public readonly GarminAppVersion = 19;

    /**
     * app-id for the Garmin ConnectIQ store
     */
    public readonly GarminAppStoreId = "c04a5671-7e39-46e7-b911-1911dbb2fe05";

    /**
     * name of the garmin app
     */
    public readonly GarminAppName = "Listago";

    /**
     * link to my buy-me-a-coffee page
     */
    public readonly BuyMeACoffeeLink = "https://buymeacoffee.com/romandrechsel";

    /**
     * link to my german paypal donation page
     */
    public readonly PaypalDELink = "https://www.paypal.com/donate/?hosted_button_id=T5GWXZJ9PZK4N&locale.x=de_DE";

    /**
     * link to my paypal donation page
     */
    public readonly PaypalLink = "https://www.paypal.com/donate/?hosted_button_id=6SML79UYCTTL8";
}
