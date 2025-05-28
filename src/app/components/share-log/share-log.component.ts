import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, ViewChild } from "@angular/core";
import { FileOpener } from "@capacitor-community/file-opener";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { AccordionGroupCustomEvent, IonAccordion, IonAccordionGroup, IonButton, IonButtons, IonCheckbox, IonHeader, IonIcon, IonItem, IonList, IonNote, IonSelect, IonSelectOption, IonTitle, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { FileUtils } from "../../classes/utils/file-utils";
import { ShareUtil } from "../../classes/utils/share-utils";
import { StringUtils } from "../../classes/utils/string-utils";
import { ConfigService } from "../../services/config/config.service";
import { ConnectIQService } from "../../services/connectiq/connect-iq.service";
import { LocalizationService } from "../../services/localization/localization.service";
import { Logger } from "../../services/logging/logger";
import { WatchLoggingService } from "../../services/logging/watch-logging.service";
import { PopupsService } from "../../services/popups/popups.service";
import { AppService } from "./../../services/app/app.service";

@Component({
    selector: "app-share-log",
    imports: [IonNote, IonList, IonCheckbox, IonItem, IonAccordionGroup, IonAccordion, IonButtons, IonButton, IonTitle, IonIcon, IonToolbar, IonHeader, IonSelect, IonSelectOption, CommonModule, TranslateModule],
    templateUrl: "./share-log.component.html",
    styleUrl: "./share-log.component.scss",
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreLogComponent {
    public Params!: ShareLogParams;

    @ViewChild("do", { read: IonSelect }) do?: IonSelect;
    @ViewChild("attachMeta", { read: IonCheckbox }) attachMeta?: IonCheckbox;
    @ViewChild("attachMetaDevice", { read: IonCheckbox }) attachMetaDevice?: IonCheckbox;
    @ViewChild("attachMetaSettings", { read: IonCheckbox }) attachMetaSettings?: IonCheckbox;
    @ViewChild("attachMetaStorage", { read: IonCheckbox }) attachMetaStorage?: IonCheckbox;
    @ViewChild("attachMetaGarmin", { read: IonCheckbox }) attachMetaGarmin?: IonCheckbox;
    @ViewChild("attachWatchLogs", { read: IonCheckbox }) attachWatchLogs?: IonCheckbox;

    private readonly Locale = inject(LocalizationService);
    private readonly Popups = inject(PopupsService);
    private readonly modalCtrl = inject(ModalController);
    private readonly AppService = inject(AppService);
    private readonly WatchLogs = inject(WatchLoggingService);
    private readonly Config = inject(ConfigService);
    private readonly ConnectIQ = inject(ConnectIQService);

    public get IsWebApp(): boolean {
        return AppService.isWebApp;
    }

    public get ConnectIQInitialized(): boolean {
        return this.ConnectIQ.Initialized;
    }

    public cancel() {
        this.modalCtrl.dismiss(null, "cancel");
    }

    public async storeFile() {
        if (this.attachWatchLogs?.checked && !this.Params.watch_logs_included) {
            await this.WatchLogs.RequestGarminWatchLogs();
        }

        if (this.Params.file && this.Params.file.Exists) {
            if (this.do) {
                const meta_device = this.attachMetaDevice?.checked ?? false;
                const meta_settings = this.attachMetaSettings?.checked ?? false;
                const meta_storage = this.attachMetaStorage?.checked ?? false;
                const meta_garmin = this.attachMetaGarmin?.checked ?? false;
                const meta = await this.AppService.AppMetaInfo({ device: meta_device, settings: meta_settings, storage: meta_storage, garmin: meta_garmin });

                if (this.attachMeta?.checked === true) {
                    await this.addToLog(StringUtils.toString(meta));
                }

                if (this.do.value == "store") {
                    try {
                        AppService.AppToolbar?.ToggleProgressbar(true);
                        const result = await Filesystem.copy({ from: this.Params.file.Path, to: `${this.Params.file.Filename}.txt`, toDirectory: Directory.Documents });
                        AppService.AppToolbar?.ToggleProgressbar(false);
                        Logger.Debug(`Stored log ${this.Params.file.Filename} in DOCUMENTS`);

                        await FileOpener.open({ filePath: result.uri, contentType: "text/plain" });
                        this.Popups.Toast.Success("comp-sharelog.store_success");
                        this.modalCtrl.dismiss(null, "confirm");
                    } catch (error) {
                        Logger.Error(`Could not store log ${this.Params.file.Filename} in DOCUMENTS: `, error);
                        this.modalCtrl.dismiss(null, "cancel");
                        this.Popups.Toast.Error("comp-sharelog.store_error");
                    }
                } else if (this.do.value == "share") {
                    try {
                        if (await ShareUtil.Share({ files: this.Params.file.Path })) {
                            Logger.Debug(`Shared log ${this.Params.file.Filename}`);
                            this.modalCtrl.dismiss(null, "confirm");
                        } else {
                            Logger.Error(`Could not share log ${this.Params.file.Filename}`);
                            this.modalCtrl.dismiss(null, "cancel");
                        }
                    } catch (error) {
                        Logger.Error(`Could not share log ${this.Params.file.Filename}: `, error);
                        this.modalCtrl.dismiss(null, "cancel");
                    }
                } else if (this.do.value == "email") {
                    const email_title = this.Locale.getText("comp-sharelog.share_email.title", { package: meta.Package?.Name, platform: meta.Device?.Platform, file: this.Params.file.Filename, size: FileUtils.File.FormatSize(this.Params.file.Size) });
                    if (await ShareUtil.SendMail({ sendto: this.Config.EMailAddress, files: this.Params.file.Path, title: email_title, text: this.Locale.getText("comp-sharelog.share_email.text") })) {
                        Logger.Debug(`Shared log ${this.Params.file.Filename} via e-mail`);
                        this.modalCtrl.dismiss(null, "confirm");
                    } else {
                        Logger.Error(`Could not share log ${this.Params.file.Filename} via e-mail`);
                        this.modalCtrl.dismiss(null, "cancel");
                        this.Popups.Toast.Error("page_settings_showlogs.store_error");
                    }
                }
            }
        }
    }

    private async addToLog(add: string | string[]) {
        if (Array.isArray(add)) {
            add = add.join("\n");
        }
        try {
            await Filesystem.appendFile({
                path: this.Params.file.Path,
                data: "\n" + add + "\n",
                encoding: Encoding.UTF8,
            });
            this.Params.file.ReadContent();
        } catch (e) {
            console.error(`Could not attach string to logfile ${this.Params.file.Filename}:`, e);
        }
    }

    public accordionGroupChange = (ev: AccordionGroupCustomEvent) => {
        if (this.attachMeta) {
            if (ev.detail.value) {
                this.attachMeta.checked = true;
            } else {
                this.attachMeta.checked = false;
            }
        }
    };
}

export const ShareLogfile = async function (modalController: ModalController, params: ShareLogParams): Promise<boolean> {
    const modal = await modalController.create({
        component: StoreLogComponent,
        componentProps: { Params: params },
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "autosize-modal",
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === "confirm") {
        return true;
    }
    return false;
};

declare type ShareLogParams = {
    file: FileUtils.File;
    watch_logs_included?: boolean;
    do?: "store" | "share" | "email";
};
