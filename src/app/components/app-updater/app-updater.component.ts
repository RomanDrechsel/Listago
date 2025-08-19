import { ChangeDetectorRef, Component, inject } from "@angular/core";
import { IonButton, IonButtons, IonCheckbox, IonHeader, IonIcon, IonText, IonTitle, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import type { AppUpdater } from "src/app/services/app/app-updater";
import { EPrefProperty, PreferencesService } from "src/app/services/storage/preferences.service";

@Component({
    selector: "app-app-updater",
    imports: [IonCheckbox, IonText, IonButton, IonButtons, IonIcon, IonTitle, IonToolbar, IonHeader, TranslocoModule],
    templateUrl: "./app-updater.component.html",
    styleUrl: "./app-updater.component.scss",
    providers: [provideTranslocoScope({ scope: "components/app-updater", alias: "comp-appupdater" }, { scope: "common/buttons", alias: "buttons" })],
})
export class AppUpdaterComponent {
    public Params!: UpdaterParams;
    private _modalCtrl = inject(ModalController);
    private _preferences = inject(PreferencesService);
    private _cdr = inject(ChangeDetectorRef);

    public async toggleSilent(checked: boolean) {
        if (checked) {
            await this._preferences.Set(EPrefProperty.IgnoreUpdate, this.Params.updater.AvailableVersion);
        } else {
            await this._preferences.Remove(EPrefProperty.IgnoreUpdate);
        }
    }

    public async updateApp() {
        const self = this;
        await this.Params.updater.StartAppUpdate({
            onDone(finished) {
                self._cdr.detectChanges();
            },
        });
    }

    public async openGooglePlay() {
        await this.Params.updater.OpenGooglePlay();
    }

    public async cancel() {
        await this._modalCtrl.dismiss(null, "cancel");
    }
}

export const StartAppUpdate = async function (modalController: ModalController, params: UpdaterParams): Promise<HTMLIonModalElement> {
    const modal = await modalController.create({
        component: AppUpdaterComponent,
        componentProps: { Params: params },
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "autosize-modal",
    });
    modal.present();
    return modal;
};

export declare type UpdaterParams = {
    updater: AppUpdater;
    uptodate?: boolean;
};
