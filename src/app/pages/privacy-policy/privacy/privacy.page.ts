import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonNote } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { MainToolbarComponent } from "../../../components/main-toolbar/main-toolbar.component";
import { AdmobService } from "../../../services/adverticing/admob.service";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-privacy",
    templateUrl: "./privacy.page.html",
    styleUrls: ["./privacy.page.scss"],
    imports: [IonIcon, IonLabel, IonNote, IonItem, IonList, IonContent, CommonModule, FormsModule, MainToolbarComponent, TranslateModule, RouterModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPage extends PageBase {
    private readonly Admob = inject(AdmobService);

    public async admob_consent_form() {
        await this.Admob.RequestConsent();
    }
}
