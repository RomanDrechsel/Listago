import { inject, Injectable } from "@angular/core";
import { AlertController, ToastController } from "@ionic/angular/standalone";
import { LocalizationService } from "../localization/localization.service";
import { PreferencesService } from "../storage/preferences.service";
import { Alert } from "./alert";
import { Toast } from "./toast";

@Injectable({
    providedIn: "root",
})
export class PopupsService {
    private readonly _locale = inject(LocalizationService);
    private readonly _toastCtrl = inject(ToastController);
    private readonly _alertCtrl = inject(AlertController);
    private readonly _preferences = inject(PreferencesService);

    constructor() {
        this._locale.loadScope("common/buttons", "buttons");
    }

    /**
     * new Toast object
     */
    public get Toast(): Toast {
        return new Toast(this._toastCtrl, this._locale, this._preferences);
    }

    /**
     * new yes/no confirm object
     */
    public get Alert(): Alert {
        return new Alert(this._alertCtrl, this._locale);
    }
}
