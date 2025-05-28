import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { InAppReview } from "@capacitor-community/in-app-review";
import { Browser } from "@capacitor/browser";
import { Device } from "@capacitor/device";
import { IonCol, IonContent, IonGrid, IonImg, IonItem, IonList, IonNote, IonRow, IonText } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { interval, Subscription } from "rxjs";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { FileUtils } from "../../classes/utils/file-utils";
import { WatchLoggingService } from "../../services/logging/watch-logging.service";
import { PageBase } from "../page-base";
import { AppService } from "./../../services/app/app.service";

@Component({
    selector: "app-appinfos",
    templateUrl: "./appinfos.page.html",
    styleUrls: ["./appinfos.page.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IonImg, IonNote, MainToolbarComponent, CommonModule, FormsModule, TranslateModule, IonContent, IonList, IonItem, IonText, IonGrid, IonRow, IonCol, IonContent, IonList, IonItem, IonText, IonGrid, IonRow, IonCol],
})
export class AppinfosPage extends PageBase {
    public BundleId: string = "";
    public Appversion: string = "";
    public Build: string = "";
    public Platform: string = "";
    public DatabaseSizeLists: string = "-";
    public DatabaseSizeTrash: string = "-";
    public MemoryUsage: string = "-";
    public LogsSize: string = "-";

    private GarminLogger = inject(WatchLoggingService);
    private timerSubscription?: Subscription;

    public get Homepage(): string {
        return this.Config.Homepage;
    }

    public override async ionViewWillEnter() {
        super.ionViewWillEnter();

        const meta = await this.AppService.AppMetaInfo();
        this.BundleId = meta.Package?.Name ?? "-";
        this.Appversion = meta.Package?.VersionString ?? "-";
        this.Build = String(meta.Package?.Build ?? "");
        this.Platform = AppService.AppPlatformString;

        this.timerSubscription = interval(5000).subscribe(async () => {
            await this.requestStatistics();
        });
        await this.requestStatistics();
    }

    public override async ionViewWillLeave() {
        super.ionViewWillLeave();
        this.timerSubscription?.unsubscribe();
    }

    public get isDarkmode(): boolean {
        return AppService.Darkmode;
    }

    public async bmc() {
        await Browser.open({ url: "https://buymeacoffee.com/romandrechsel" });
    }

    public async paypal() {
        const url = this.Locale.CurrentLanguage.locale == "de-DE" ? "https://www.paypal.com/donate/?hosted_button_id=T5GWXZJ9PZK4N&locale.x=de_DE" : "https://www.paypal.com/donate/?hosted_button_id=6SML79UYCTTL8";
        await Browser.open({ url: url });
    }

    public async mywebsite() {
        await Browser.open({ url: `https://${this.Config.Homepage}` });
    }

    public async writeReviewIQ() {
        await this.ConnectIQ.openStore();
    }

    public async writeReviewGoogle() {
        await InAppReview.requestReview();
    }

    private async requestStatistics() {
        this.LogsSize = FileUtils.File.FormatSize((await this.Logger.GetLogSize()).size);
        const database = await this.ListsService.BackendSize();
        this.DatabaseSizeLists = FileUtils.File.FormatSize(database.lists.size);
        this.DatabaseSizeTrash = FileUtils.File.FormatSize(database.trash.size);

        const deviceinfo = await Device.getInfo();
        if (deviceinfo.memUsed) {
            this.MemoryUsage = FileUtils.File.FormatSize(deviceinfo.memUsed);
        }
        this.cdr.detectChanges();
    }
}
