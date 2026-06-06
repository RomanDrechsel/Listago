import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { SelectCustomEvent } from "@ionic/angular";
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonToggle } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { ShareUtil } from "../../../classes/utils/share-utils";
import { EPrefProperty } from "../../../services/storage/preferences.service";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-settings",
    templateUrl: "./settings.page.html",
    styleUrls: ["./settings.page.scss"],
    imports: [IonToggle, IonNote, IonIcon, IonLabel, MainToolbarComponent, TranslocoModule, FormsModule, RouterModule, IonContent, IonList, IonItem, IonSelect, IonSelectOption],
    providers: [provideTranslocoScope({ scope: "pages/settings/settings-page", alias: "page_settings" }, { scope: "common/buttons", alias: "buttons" }, { scope: "services/localization/localization-service", alias: "service-locale" })],
})
export class SettingsPage extends PageBase {
    public get Email(): string {
        return this._config.EMailAddress;
    }

    public onChangeLanguage(event: SelectCustomEvent) {
        this.Locale.ChangeLanguage(event.detail.value);
    }

    public async onAnimationsChanged(checked: boolean) {
        await this._preferences.Set(EPrefProperty.Animations, checked);
    }

    public async reportTranslationMistake() {
        if (
            await this._popups.Alert.YesNo({
                message: "page_settings.translation_error_confirm",
                translate: true,
            })
        ) {
            await ShareUtil.SendMail({ sendto: this._config.EMailAddress, title: this.Locale.getText("page_settings.translation_error_title") });
        }
    }
}
