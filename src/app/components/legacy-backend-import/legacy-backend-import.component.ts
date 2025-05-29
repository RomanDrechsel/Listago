import { Component, Input, type OnInit } from "@angular/core";
import { IonContent, IonIcon, IonProgressBar, IonText, IonToolbar } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";

@Component({
    selector: "app-legacy-backend-import",
    imports: [IonIcon, IonText, IonContent, IonToolbar, IonProgressBar, TranslateModule],
    templateUrl: "./legacy-backend-import.component.html",
    styleUrl: "./legacy-backend-import.component.scss",
})
export class LegacyBackendImportComponent implements OnInit {
    @Input() ItemCount: number = 1;
    @Input() ItemDone: number = 0;
    @Input() onReady?: (instance: LegacyBackendImportComponent) => void;

    ngOnInit(): void {
        if (this.onReady) {
            this.onReady(this);
        }
    }
}
