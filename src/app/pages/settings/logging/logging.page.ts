import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { IonButton, IonContent, IonIcon, IonItem, IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonText, SelectCustomEvent } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { Subscription, interval } from "rxjs";
import { FileUtils } from "../../../classes/utils/file-utils";
import { MainToolbarComponent } from "../../../components/main-toolbar/main-toolbar.component";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-logging",
    templateUrl: "./logging.page.html",
    styleUrls: ["./logging.page.scss"],
    imports: [IonNote, IonIcon, IonLabel, IonText, IonList, IonItem, IonContent, IonSelect, IonSelectOption, IonButton, RouterLink, CommonModule, FormsModule, TranslateModule, MainToolbarComponent],
})
export class LoggingPage extends PageBase {
    public LogsSize?: string;
    public Logfiles?: number;
    private timerSubscription?: Subscription;

    public override async ionViewWillEnter() {
        await super.ionViewWillEnter();
        this.requestLogsSize();
    }

    public override async ionViewDidEnter() {
        await super.ionViewDidEnter();
        this.timerSubscription = interval(5000).subscribe(() => {
            this.requestLogsSize();
        });
    }

    public override async ionViewWillLeave() {
        await super.ionViewWillLeave();
        if (this.timerSubscription && !this.timerSubscription.closed) {
            this.timerSubscription.unsubscribe();
        }
    }

    public onChangeLogging(event: SelectCustomEvent) {
        this.Logger.SetLogLevel(event.detail.value);
    }

    public onChangeLoggingAutoDelete(event: SelectCustomEvent) {
        this.Logger.SetAutodelete(event.detail.value);
    }

    public async onBtnDeleteLogs() {
        const count = await this.Logger.LogfilesCount();
        if (count > 0) {
            let text;
            if (count > 1) {
                text = this.Locale.getText("page_settings_logs.deleteall_confirm", { count: count });
            } else {
                text = this.Locale.getText("page_settings_logs.deleteall_confirm_single");
            }
            if (
                await this.Popups.Alert.YesNo({
                    message: text,
                    button_yes: this.Locale.getText("yes"),
                    button_no: this.Locale.getText("no"),
                })
            ) {
                const del = await this.Logger.DeleteLogs(-1);
                if (del != 1) {
                    this.Popups.Toast.Success(this.Locale.getText("page_settings_logs.deleteall_done", { count: del }));
                } else {
                    this.Popups.Toast.Success(this.Locale.getText("page_settings_logs.deleteall_done_single"));
                }

                this.requestLogsSize();
            }
        }
    }

    private async requestLogsSize() {
        const size = await this.Logger.GetLogSize();
        this.Logfiles = size.files;
        if (size.size >= 0 && size.files >= 0) {
            this.LogsSize = this.Locale.getText("page_settings_logs.size", { files: size.files, size: FileUtils.File.FormatSize(size.size) });
        } else {
            this.LogsSize = undefined;
        }
        this.cdr.detectChanges();
    }
}
