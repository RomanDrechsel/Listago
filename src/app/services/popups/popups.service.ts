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
    private readonly Locale = inject(LocalizationService);
    private readonly ToastCtrl = inject(ToastController);
    private readonly AlertCtrl = inject(AlertController);
    private readonly Preferences = inject(PreferencesService);

    /**
     * new Toast object
     */
    public get Toast(): Toast {
        return new Toast(this.ToastCtrl, this.Locale, this.Preferences);
    }

    /**
     * new yes/no confirm object
     */
    public get Alert(): Alert {
        return new Alert(this.AlertCtrl, this.Locale);
    }
}
