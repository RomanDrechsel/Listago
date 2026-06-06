import { Component, ViewChild } from "@angular/core";
import { Browser } from "@capacitor/browser";
import { IonContent, IonItem, IonList, IonToggle } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { AppService } from "src/app/services/app/app.service";
import { EPrefProperty } from "src/app/services/storage/preferences.service";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-advertisement",
    templateUrl: "./advertisement.page.html",
    styleUrls: ["./advertisement.page.scss"],
    standalone: true,
    imports: [IonList, IonItem, IonToggle, IonContent, MainToolbarComponent, TranslocoModule],
    providers: [provideTranslocoScope({ scope: "pages/settings/advertisement-page", alias: "page_settings_advertisement" })],
})
export class AdvertisementPage extends PageBase {
    @ViewChild("adsToggle", { read: IonToggle }) private _adsToggle?: IonToggle;

    public get AdvertisementActive(): boolean {
        return this._admob.Initialized;
    }

    public get AdvertisementText(): string {
        if (this.AdvertisementActive) {
            return "page_settings_advertisement.activated";
        } else {
            return "page_settings_advertisement.deactivated";
        }
    }

    public get isDarkmode(): boolean {
        return AppService.Darkmode;
    }

    public async toggleAdvertisements(event: MouseEvent) {
        event.stopImmediatePropagation();
        event.preventDefault();

        if (!this._adsToggle) {
            return;
        }
        if (this._adsToggle.checked && this.AdvertisementActive) {
            const confirm = await this._popups.Alert.YesNo({
                message: "page_settings_advertisement.deactivate_confirm",
                translate: true,
            });
            if (confirm) {
                await this._admob.Shutdown();
                this._preferences.Set(EPrefProperty.AdmobActive, false);
                this._popups.Toast.Success("page_settings_advertisement.deactivated_success", undefined, true);
            }
        } else if (!this._adsToggle.checked && !this.AdvertisementActive) {
            await this._admob.Initialize();
            this._preferences.Set(EPrefProperty.AdmobActive, true);
            this._popups.Toast.Success("page_settings_advertisement.activated_success", undefined, true);
        }
    }

    public async bmc() {
        await Browser.open({ url: this._config.BuyMeACoffeeLink });
    }

    public async paypal() {
        const url = this.Locale.CurrentLanguage.locale == "de-DE" ? this._config.PaypalDELink : this._config.PaypalLink;
        await Browser.open({ url: url });
    }
}
