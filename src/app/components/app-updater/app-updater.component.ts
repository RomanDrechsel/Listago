import { ChangeDetectorRef, Component, inject } from "@angular/core";
import { IonButton, IonButtons, IonCheckbox, IonHeader, IonIcon, IonText, IonTitle, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { AppUpdaterService } from "src/app/services/app/app-updater.service";
import { EPrefProperty, PreferencesService } from "src/app/services/storage/preferences.service";

@Component({
    selector: "app-app-updater",
    imports: [IonCheckbox, IonText, IonButton, IonButtons, IonIcon, IonTitle, IonToolbar, IonHeader, TranslocoModule],
    templateUrl: "./app-updater.component.html",
    styleUrl: "./app-updater.component.scss",
    providers: [provideTranslocoScope({ scope: "components/app-updater", alias: "comp-appupdater" }, { scope: "common/buttons", alias: "buttons" })],
})
export class AppUpdaterComponent {
    private readonly _modalCtrl = inject(ModalController);
    private readonly _preferences = inject(PreferencesService);
    private readonly _cdr = inject(ChangeDetectorRef);
    private readonly _appupdater = inject(AppUpdaterService);

    private _ignoreUpdate?: number;

    public get AppUpdater(): AppUpdaterService {
        return this._appupdater;
    }

    public get ThisUpdateIgnored(): boolean {
        return this._ignoreUpdate !== undefined && this._ignoreUpdate == this._appupdater.AvailableVersion;
    }

    public async ionViewWillEnter() {
        this._ignoreUpdate = await this._preferences.Get<number | undefined>(EPrefProperty.IgnoreUpdate, undefined);
        component = this;
    }

    public async toggleSilent(checked: boolean) {
        if (checked) {
            await this._preferences.Set(EPrefProperty.IgnoreUpdate, this._appupdater.AvailableVersion);
        } else {
            await this._preferences.Remove(EPrefProperty.IgnoreUpdate);
        }
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

    public async restart() {
        this._appupdater.Reset();
        await this._appupdater.CheckForUpdates(true, false);
    }

    public async cancel() {
        await this._modalCtrl.dismiss(null, "cancel");
    }

    public reloadUI() {
        this._cdr.detectChanges();
    }
}

let static_modal: HTMLIonModalElement | undefined = undefined;
let component: AppUpdaterComponent | undefined = undefined;

export const StartAppUpdate = async function (modalController: ModalController): Promise<void> {
    if (!static_modal) {
        static_modal = await modalController.create({
            component: AppUpdaterComponent,
            componentProps: undefined,
            animated: true,
            backdropDismiss: true,
            showBackdrop: true,
            cssClass: "autosize-modal",
        });
        static_modal.present();

        await static_modal.onDidDismiss();
        static_modal = undefined;
        component = undefined;
    } else {
        component?.reloadUI();
    }
};
