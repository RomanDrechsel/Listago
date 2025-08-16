import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { SelectCustomEvent } from "@ionic/angular";
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonToggle } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { Subscription } from "rxjs";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { ShareUtil } from "../../../classes/utils/share-utils";
import { EPrefProperty } from "../../../services/storage/preferences.service";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-settings",
    templateUrl: "./settings.page.html",
    styleUrls: ["./settings.page.scss"],
    imports: [IonToggle, IonNote, IonIcon, IonLabel, MainToolbarComponent, CommonModule, TranslocoModule, FormsModule, RouterModule, IonContent, IonList, IonItem, IonSelect, IonSelectOption],
    providers: [provideTranslocoScope({ scope: "pages/settings/settings-page", alias: "page_settings" }, { scope: "common/buttons", alias: "buttons" }, { scope: "services/localization/localization-service", alias: "service-locale" })],
})
export class SettingsPage extends PageBase {
    private _useAnimations = true;
    private _preferencesSubscription?: Subscription;

    public get Email(): string {
        return this.Config.EMailAddress;
    }

    public get UseAnimations(): boolean {
        return this._useAnimations;
    }

    public override async ionViewWillEnter(): Promise<void> {
        await super.ionViewWillEnter();
        this._useAnimations = await this.Preferences.Get(EPrefProperty.Animations, true);
        this._preferencesSubscription = this.Preferences.onPrefChanged$.subscribe(prop => {
            if (prop.prop == EPrefProperty.Animations) {
                this._useAnimations = prop.value;
            }
        });
    }

    public override async ionViewDidLeave(): Promise<void> {
        await super.ionViewDidLeave();
        this._preferencesSubscription?.unsubscribe();
        this._preferencesSubscription = undefined;
    }

    public onChangeLanguage(event: SelectCustomEvent) {
        this.Locale.ChangeLanguage(event.detail.value);
    }

    public async onAnimationsChanged(checked: boolean) {
        this._useAnimations = checked;
        await this.Preferences.Set(EPrefProperty.Animations, checked);
    }

    public async reportTranslationMistake() {
        if (
            await this.Popups.Alert.YesNo({
                message: "page_settings.translation_error_confirm",
                translate: true,
            })
        ) {
            await ShareUtil.SendMail({ sendto: this.Config.EMailAddress, title: this.Locale.getText("page_settings.translation_error_title") });
        }
    }
}
