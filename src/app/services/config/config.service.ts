import { Injectable } from "@angular/core";

@Injectable({
    providedIn: "root",
})
export class ConfigService {
    /**
     * e-mail address for app related stuff
     */
    public readonly EMailAddress = "lists-app@roman-drechsel.de";

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
}
