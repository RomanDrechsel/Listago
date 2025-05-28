import { ToastController, ToastOptions } from "@ionic/angular/standalone";
import { LocalizationService } from "../localization/localization.service";

export class Toast {

    public static readonly DURATION_NORMAL = 5000;
    public static readonly DURATION_SHORT = 1500;
    public static readonly DURATION_INFINITE = 0;

    private static _toastQueue: HTMLIonToastElement[] = [];

    public constructor(private Controller: ToastController, private Locale: LocalizationService) { }

    public async Error(message: string, duration: number = Toast.DURATION_NORMAL, translate: boolean = true): Promise<HTMLIonToastElement> {
        const toast = await this.Controller.create(this.getToastOptions(message, duration, "error", translate));
        return this.HandleToast(toast);
    }

    public async Success(message: string, duration: number = Toast.DURATION_NORMAL, translate: boolean = true): Promise<HTMLIonToastElement> {
        const toast = await this.Controller.create(this.getToastOptions(message, duration, "success", translate));
        return this.HandleToast(toast);
    }

    public async Notice(message: string, duration: number = Toast.DURATION_NORMAL, translate: boolean = true): Promise<HTMLIonToastElement> {
        const toast = await this.Controller.create(this.getToastOptions(message, duration, "notice", translate));
        return this.HandleToast(toast);
    }

    private async HandleToast(toast: HTMLIonToastElement): Promise<HTMLIonToastElement> {
        Toast._toastQueue.forEach(t => {
            t.animated = false;
            t.dismiss();
        });
        Toast._toastQueue.push(toast);
        await toast.present();
        toast.onDidDismiss().then(() => {
            Toast._toastQueue = Toast._toastQueue.filter(t => t !== toast);
        });
        return toast;
    }

    private getToastOptions(message: string, duration: number, cssClass: string, translate: boolean = true): ToastOptions {
        if (translate) {
            message = this.Locale.getText(message);
        }

        let icon: string | undefined = undefined;
        if (cssClass == "error") {
            icon = "/assets/icons/toasterror.svg";
        }
        else if (cssClass == "success") {
            icon = "/assets/icons/toastsuccess.svg";
        }

        return {
            message: message,
            duration: duration,
            icon: icon,
            animated: true,
            cssClass: `toast ${cssClass}`,
            swipeGesture: "vertical",
            buttons: [
                {
                    text: this.Locale.getText("ok"),
                    role: "cancel",
                },
            ],
        };
    }
}
