import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, inject } from "@angular/core";
import { IonButton, IonButtons, IonCheckbox, IonHeader, IonIcon, IonText, IonTitle, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { AppUpdaterService } from "src/app/services/app/app-updater.service";
import { EPrefProperty, PreferencesService } from "src/app/services/storage/preferences.service";

@Component({
    selector: "app-app-updater",
    imports: [IonCheckbox, IonText, IonButton, IonButtons, IonIcon, IonTitle, IonToolbar, IonHeader, TranslocoModule, CommonModule],
    templateUrl: "./app-updater.component.html",
    styleUrl: "./app-updater.component.scss",
    providers: [provideTranslocoScope({ scope: "components/app-updater", alias: "comp-appupdater" }, { scope: "common/buttons", alias: "buttons" })],
})
export class AppUpdaterComponent {
    private readonly _modalCtrl = inject(ModalController);
    private readonly _preferences = inject(PreferencesService);
    private readonly _cdr = inject(ChangeDetectorRef);
    private readonly _appupdater = inject(AppUpdaterService);

    public get AppUpdater(): AppUpdaterService {
        return this._appupdater;
    }

    public async toggleSilent(checked: boolean) {
        if (checked) {
            await this._preferences.Set(EPrefProperty.IgnoreUpdate, this._appupdater.AvailableVersion);
        } else {
            await this._preferences.Remove(EPrefProperty.IgnoreUpdate);
        }
    }

    public async ThisUpdateIgnored(): Promise<boolean> {
        const ignore = await this._preferences.Get(EPrefProperty.IgnoreUpdate, undefined);
        return ignore !== undefined && ignore == this._appupdater.AvailableVersion;
    }

    public async updateApp() {
        const self = this;
        await this._appupdater.StartAppUpdate({
            updateStatus() {
                self._cdr.detectChanges();
            },
        });
    }

    public async openGooglePlay() {
        await this._appupdater.OpenGooglePlay();
    }

    public async finishFlexibleUpdate() {
        await this._appupdater.FinishFlexibleUpdate();
    }

    public async cancel() {
        await this._modalCtrl.dismiss(null, "cancel");
    }
}

export const StartAppUpdate = async function (modalController: ModalController): Promise<HTMLIonModalElement> {
    const modal = await modalController.create({
        component: AppUpdaterComponent,
        componentProps: undefined,
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "autosize-modal",
    });
    modal.onDidDismiss().then(() => {
        (modal as any).isOpen = false;
    });

    modal.present();
    return modal;
};
