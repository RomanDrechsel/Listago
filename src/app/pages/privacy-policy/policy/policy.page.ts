import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, ViewEncapsulation, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonContent, IonImg, IonSelect, IonSelectOption } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { firstValueFrom } from "rxjs";
import { MainToolbarComponent } from "../../../components/main-toolbar/main-toolbar.component";
import { Culture } from "../../../services/localization/localization.service";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-policy",
    templateUrl: "./policy.page.html",
    styleUrls: ["./policy.page.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [IonContent, IonSelect, IonSelectOption, IonImg, CommonModule, FormsModule, MainToolbarComponent, TranslateModule],
})
export class PolicyPage extends PageBase {
    @ViewChild("policy", { read: ElementRef }) private _policy!: ElementRef;

    private readonly http = inject(HttpClient);
    private _selectedCulture?: Culture = undefined;

    public get Languages(): Culture[] {
        return this.Locale.AvailableTranslations.filter(l => l.gdpr != undefined);
    }

    public get SelectedCulture(): Culture | undefined {
        return this._selectedCulture;
    }

    public override async ionViewWillEnter() {
        await this.changeLanguage(this.Locale.CurrentLanguage);
    }

    public async onSelectLanguage(culture: Culture) {
        this.changeLanguage(culture);
    }

    private async changeLanguage(culture?: Culture) {
        if (!culture?.gdpr) {
            culture = this.Locale.FallbackCulture;
        }
        this._selectedCulture = culture;
        this._policy.nativeElement.innerHTML = await firstValueFrom(this.http.get(`./assets/i18n/privacy-policy/${culture.gdpr}.html`, { responseType: "text" }));
        this.cdr.detectChanges();
    }
}
