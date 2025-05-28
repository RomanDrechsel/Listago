import { Injectable, inject } from '@angular/core';
import { AlertController, LoadingController, ToastController } from "@ionic/angular/standalone";
import { LocalizationService } from "../localization/localization.service";
import { Alert } from "./alert";
import { Loading } from "./loading";
import { Toast } from "./toast";

@Injectable({
    providedIn: 'root'
})
export class PopupsService {
    private readonly Locale = inject(LocalizationService);
    private readonly ToastCtrl = inject(ToastController);
    private readonly AlertCtrl = inject(AlertController);
    private readonly LoadingCtrl = inject(LoadingController);

    /**
     * new Toast object
     */
    public get Toast(): Toast {
        return new Toast(this.ToastCtrl, this.Locale);
    }

    /**
     * new yes/no confirm object
     */
    public get Alert(): Alert {
        return new Alert(this.AlertCtrl, this.Locale);
    }

    /**
     * new loading overlay object
     */
    public get Loading(): Loading {
        return new Loading(this.LoadingCtrl, this.Locale);
    }
}
