import { LoadingController } from "@ionic/angular/standalone";
import { LocalizationService } from "../localization/localization.service";

export class Loading {
    private static currentLoading?: HTMLIonLoadingElement;

    public constructor(private Controller: LoadingController, private Locale: LocalizationService) { }

    /**
     * display the loading overlay
     * @param message message to ne shown
     * @param translate translate the message
     * @returns loading overlay handle
     */
    public async Show(message: string, translate: boolean = true): Promise<HTMLIonLoadingElement> {
        if (translate) {
            message = this.Locale.getText(message);
        }

        if (Loading.currentLoading) {
            Loading.currentLoading.message = message;
        } else {
            Loading.currentLoading = await this.Controller.create({
                message: message,
                duration: 0,
                backdropDismiss: false,
                showBackdrop: true,
                spinner: "bubbles",
                cssClass: "loading-overlay",
            });
            Loading.currentLoading.present();
        }

        return Loading.currentLoading;
    }

    /**
     * hide the current loading overlay
     */
    public async Hide() {
        if (Loading.currentLoading) {
            Loading.currentLoading.dismiss();
            Loading.currentLoading = undefined;
        }
    }
}
