import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Browser } from "@capacitor/browser";
import { IonButton, IonContent, IonIcon, IonSegment, IonSegmentButton, IonSegmentContent, IonSegmentView, IonSelect, IonSelectOption, IonText, IonToggle } from "@ionic/angular/standalone";
import { SelectCustomEvent } from "@ionic/core";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { IntentsService } from "src/app/services/intents/intents.service";
import { EPrefProperty } from "../../services/storage/preferences.service";
import { PageBase } from "../page-base";

@Component({
    selector: "app-first-start",
    templateUrl: "./first-start.page.html",
    styleUrls: ["./first-start.page.scss"],
    standalone: true,
    imports: [IonSegmentButton, IonSegment, IonSegmentContent, IonSegmentView, IonButton, IonText, IonToggle, IonContent, IonIcon, IonSelect, IonSelectOption, CommonModule, FormsModule, TranslocoModule],
    providers: [provideTranslocoScope({ scope: "pages/first-start-page", alias: "page_firststart" }, { scope: "common/buttons", alias: "buttons" })],
})
export class FirstStartPage extends PageBase {
    @ViewChild("selLanguage", { static: false, read: IonSelect }) private _selLanguage?: IonSelect;
    @ViewChild("segbtnGarmin", { static: false, read: ElementRef }) private _segbtnGarmin?: ElementRef;
    @ViewChild("segbtnGarminHint", { static: false, read: ElementRef }) private _segbtnGarminHint?: ElementRef;
    @ViewChild("segbtnFinish", { static: false, read: ElementRef }) private _segbtnFinish?: ElementRef;

    private _garminActive: boolean = true;
    private readonly _intents = inject(IntentsService);

    public StartImport?: string;

    public get HomepageLink(): string {
        return this.Config.Homepage;
    }

    public get GarminActive(): boolean {
        return this._garminActive;
    }

    public get GarminAppname(): string {
        return this.Config.GarminAppName;
    }

    public get FinishButtonText(): string {
        if (this.StartImport) {
            return this.Locale.getText("page_firststart.finish_btn_import");
        } else {
            return this.Locale.getText("page_firststart.finish_btn");
        }
    }

    public override async ionViewWillEnter(): Promise<void> {
        await super.ionViewWillEnter();
        this._intents.FirstStartPage = this;
    }

    public override async ionViewDidEnter(): Promise<void> {
        await super.ionViewDidEnter();
        this._garminActive = await this.ConnectIQ.IsConnectIQAppInstalled();
        await this.Preferences.Set(EPrefProperty.GarminConnectIQ, this._garminActive);
    }

    public override async ionViewWillLeave(): Promise<void> {
        await super.ionViewWillLeave();
        this._intents.FirstStartPage = undefined;
    }

    public async changeLanguage() {
        this._selLanguage?.open();
    }

    public onChangeLanguage(event: SelectCustomEvent) {
        this.Locale.ChangeLanguage(event.detail.value);
    }

    public async onGarminChange(check: boolean) {
        this._garminActive = check;
        await this.Preferences.Set(EPrefProperty.GarminConnectIQ, check);
        if (check) {
            await this.ConnectIQ.Initialize();
        } else {
            await this.ConnectIQ.Shutdown();
        }
    }

    public async nextLanguage() {
        this._segbtnGarmin?.nativeElement?.click();
    }

    public async nextGarmin() {
        if (this.GarminActive) {
            if (!this.ConnectIQ.Initialized) {
                if (!(await this.ConnectIQ.Initialize())) {
                    return;
                }
            }
            this._segbtnGarminHint?.nativeElement?.click();
        } else {
            this._segbtnFinish?.nativeElement?.click();
        }
    }

    public async nextGarminHint() {
        this._segbtnFinish?.nativeElement?.click();
    }

    public async Finish() {
        await this.Preferences.Set(EPrefProperty.FirstStart, false);
        if (this.GarminActive && !this.ConnectIQ.Initialized) {
            if (!(await this.ConnectIQ.Initialize())) {
                return;
            }
        }
        if (this.StartImport) {
            await this._intents.gotoImportAfterIntent({ importUri: this.StartImport, replaceUrl: true });
        } else {
            this.NavController.navigateRoot("/lists", { animated: true, replaceUrl: true });
        }
    }

    public async openApp() {
        await this.ConnectIQ.openStore();
    }

    public async openHomepage() {
        await Browser.open({ url: `https://${this.Config.Homepage}` });
    }
}
