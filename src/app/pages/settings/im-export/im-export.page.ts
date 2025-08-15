import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { IonContent, IonIcon, IonItem, IonLabel, IonList } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { SettingsPage } from "../settings/settings.page";

@Component({
    selector: "app-im-export",
    templateUrl: "./im-export.page.html",
    styleUrls: ["./im-export.page.scss"],
    standalone: true,
    imports: [IonLabel, IonIcon, IonItem, IonList, IonContent, CommonModule, FormsModule, TranslocoModule, RouterModule, MainToolbarComponent],
    providers: [provideTranslocoScope({ scope: "pages/settings/im-export-page", alias: "page_settings_imexport" })],
})
export class ImExportPage extends SettingsPage {}
