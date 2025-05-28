import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Browser } from "@capacitor/browser";
import { IonButton, IonContent, IonIcon, IonImg, IonSegment, IonSegmentButton, IonSegmentContent, IonSegmentView, IonSelect, IonSelectOption, IonText, IonToggle } from "@ionic/angular/standalone";
import { SelectCustomEvent } from "@ionic/core";
import { TranslateModule } from "@ngx-translate/core";
import { EPrefProperty } from "../../services/storage/preferences.service";
import { PageBase } from "../page-base";

@Component({
    selector: "app-first-start",
    templateUrl: "./first-start.page.html",
    styleUrls: ["./first-start.page.scss"],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [IonSegmentButton, IonSegment, IonSegmentContent, IonSegmentView, IonButton, IonText, IonToggle, IonImg, IonContent, IonIcon, IonSelect, IonSelectOption, CommonModule, FormsModule, TranslateModule],
})
export class FirstStartPage extends PageBase {
    @ViewChild("selLanguage", { static: false, read: IonSelect }) private _selLanguage?: IonSelect;
    @ViewChild("segbtnGarmin", { static: false, read: ElementRef }) private _segbtnGarmin?: ElementRef;
    @ViewChild("segbtnGarminHint", { static: false, read: ElementRef }) private _segbtnGarminHint?: ElementRef;
    @ViewChild("segbtnFinish", { static: false, read: ElementRef }) private _segbtnFinish?: ElementRef;

    private _garminActive: boolean = true;

    public get HomepageLink(): string {
        return this.Config.Homepage;
    }

    public get GarminActive(): boolean {
        return this._garminActive;
    }

    public override async ionViewDidEnter(): Promise<void> {
        await super.ionViewDidEnter();
        await this.Preferences.Set(EPrefProperty.GarminConnectIQ, true);
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
                //no await ...
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
        this.NavController.navigateRoot("/lists", { animated: true, replaceUrl: true });
    }

    public async openApp() {
        await this.ConnectIQ.openStore();
    }

    public async openHomepage() {
        await Browser.open({ url: `https://${this.Config.Homepage}` });
    }
}
