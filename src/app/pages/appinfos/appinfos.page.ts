import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { InAppReview } from "@capacitor-community/in-app-review";
import { Browser } from "@capacitor/browser";
import { Device } from "@capacitor/device";
import { IonCol, IonContent, IonGrid, IonImg, IonItem, IonList, IonNote, IonRow, IonText } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { interval, Subscription } from "rxjs";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { ListsSqliteBackendService } from "src/app/services/storage/sqlite/lists/lists-sqlite-backend.service";
import { FileUtils } from "../../classes/utils/file-utils";
import { PageBase } from "../page-base";
import { AppService } from "./../../services/app/app.service";

@Component({
    selector: "app-appinfos",
    templateUrl: "./appinfos.page.html",
    styleUrls: ["./appinfos.page.scss"],
    imports: [IonImg, IonNote, MainToolbarComponent, CommonModule, FormsModule, TranslateModule, IonContent, IonList, IonItem, IonText, IonGrid, IonRow, IonCol, IonContent, IonList, IonItem, IonText, IonGrid, IonRow, IonCol],
})
export class AppinfosPage extends PageBase {
    public BundleId: string = "";
    public Appversion: string = "";
    public Build: string = "";
    public Platform: string = "";
    public DatabaseSizeLists: string = "-<br /><br />";
    public DatabaseSizeTrash: string = "-<br /><br />";
    public MemoryUsage: string = "-";
    public LogsSize: string = "-<br /><br />";
    public DatabaseFileSize: string = "";

    private timerSubscription?: Subscription;

    private readonly BackendService = inject(ListsSqliteBackendService);

    public get Homepage(): string {
        return this.Config.Homepage;
    }

    public override async ionViewWillEnter() {
        super.ionViewWillEnter();

        this.requestStatistics();
        this.timerSubscription = interval(5000).subscribe(async () => {
            await this.requestStatistics();
        });

        const meta = await this.AppService.AppMetaInfo({ device: true, settings: false, garmin: false, storage: false });
        this.BundleId = meta.Package?.Name ?? "-";
        this.Appversion = meta.Package?.VersionString ?? "-";
        this.Build = String(meta.Package?.Build ?? "");
        this.Platform = AppService.AppPlatformString;
    }

    public override async ionViewWillLeave() {
        super.ionViewWillLeave();
        this.timerSubscription?.unsubscribe();
        this.timerSubscription = undefined;
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
        const logs = await this.Logger.GetLogSize();
        if (logs.files == 1) {
            this.LogsSize = this.Locale.getText("page_appinfos.database_logs_txt2", { size: FileUtils.File.FormatSize(logs.size) });
        } else {
            this.LogsSize = this.Locale.getText("page_appinfos.database_logs_txt1", { size: FileUtils.File.FormatSize(logs.size), files: logs.files });
        }

        const backendsize = await this.BackendService.DatabaseSize();
        if (backendsize > 0) {
            this.DatabaseFileSize = FileUtils.File.FormatSize(backendsize);
        } else {
            this.DatabaseFileSize = "";
        }

        const numbers = await this.BackendService.DatabaseStats();
        let txt = "";
        if (numbers.lists.lists >= 0 && numbers.lists.items >= 0) {
            if (numbers.lists.lists == 1) {
                if (numbers.lists.items == 1) {
                    txt = this.Locale.getText("page_appinfos.database_lists_txt3");
                } else {
                    txt = this.Locale.getText("page_appinfos.database_lists_txt2", { items: numbers.lists.items });
                }
            } else {
                if (numbers.lists.items == 1) {
                    txt = this.Locale.getText("page_appinfos.database_lists_txt4", { lists: numbers.lists.lists });
                } else {
                    txt = this.Locale.getText("page_appinfos.database_lists_txt1", { lists: numbers.lists.lists, items: numbers.lists.items });
                }
            }
        }
        this.DatabaseSizeLists = txt;
        txt = "";
        if (numbers.trash.lists >= 0 && numbers.trash.items >= 0) {
            if (numbers.trash.lists == 1) {
                if (numbers.trash.items == 1) {
                    txt = this.Locale.getText("page_appinfos.database_trash_txt3");
                } else {
                    txt = this.Locale.getText("page_appinfos.database_trash_txt2", { items: numbers.trash.items });
                }
            } else {
                if (numbers.trash.items == 1) {
                    txt = this.Locale.getText("page_appinfos.database_trash_txt4", { lists: numbers.trash.lists });
                } else {
                    txt = this.Locale.getText("page_appinfos.database_trash_txt1", { lists: numbers.trash.lists, items: numbers.trash.items });
                }
            }
        }
        this.DatabaseSizeTrash = txt;

        const deviceinfo = await Device.getInfo();
        if (deviceinfo.memUsed) {
            this.MemoryUsage = FileUtils.File.FormatSize(deviceinfo.memUsed);
        }
    }
}
