import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonContent, IonImg, IonSelect, IonSelectOption } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
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
    imports: [IonContent, IonSelect, IonSelectOption, IonImg, CommonModule, FormsModule, MainToolbarComponent, TranslocoModule],
    providers: [provideTranslocoScope({ scope: "pages/privacy-policy/policy-page", alias: "page_policy" }, { scope: "common/buttons", alias: "buttons" })],
})
export class PolicyPage extends PageBase {
    private readonly http = inject(HttpClient);
    private _selectedCulture?: Culture = undefined;

    public get Languages(): Culture[] {
        return this.Locale.AvailableTranslations.filter(l => l.gdpr != undefined);
    }

    public get SelectedCulture(): Culture | undefined {
        return this._selectedCulture;
    }

    public override async ionViewWillEnter() {
        await super.ionViewWillEnter();
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
        const observer = new MutationObserver(async () => {
            const container = document.getElementById("policy-container");
            if (container) {
                container.innerHTML = await firstValueFrom(this.http.get(`./assets/i18n/privacy-policy/${culture.gdpr}.html`, { responseType: "text" }));
                observer.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }
}
