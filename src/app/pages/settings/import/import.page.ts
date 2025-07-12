import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CapacitorException } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FilePicker, type PickFilesResult } from "@capawesome/capacitor-file-picker";
import { IonButton, IonButtons, IonCard, IonCheckbox, IonContent, IonIcon, IonItem, IonLabel, IonList, IonProgressBar, IonText } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { FileUtils } from "src/app/classes/utils/file-utils";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { Logger } from "src/app/services/logging/logger";
import { ListsImporter, ProgressListenerFactory } from "src/app/services/storage/lists/import/lists-importer";
import { environment } from "src/environments/environment";
import { PageBase } from "../../page-base";
import { SqliteService } from "./../../../services/storage/sqlite/sqlite.service";

@Component({
    selector: "app-import",
    templateUrl: "./import.page.html",
    styleUrls: ["./import.page.scss"],
    standalone: true,
    imports: [IonItem, IonCheckbox, IonProgressBar, IonText, IonLabel, IonList, IonCard, IonIcon, IonButton, IonButtons, IonContent, CommonModule, FormsModule, TranslateModule, MainToolbarComponent],
})
export class ImportPage extends PageBase {
    private _archive?: string;

    private _importItems?: ImportItem[];

    private _importer?: ListsImporter;

    private _importDone = false;
    private _importError = false;

    private _archiveValid?: boolean;

    private readonly _sqliteService = inject(SqliteService);

    public get ImportDone(): boolean {
        return this._importDone;
    }

    public get Archive(): string | undefined {
        return this._archive;
    }

    public get SomethingEnabled(): boolean {
        return Array.from(this._importItems?.values() ?? []).some(item => item.status !== "disabled");
    }

    public get ImportItems(): ImportItem[] | undefined {
        if (this._importItems) {
            return this._importItems.sort((a, b) => a.order - b.order);
        } else {
            return undefined;
        }
    }

    public get FinishedImportItems(): ImportItem[] {
        return this._importItems?.filter(i => i.status == "success" || i.status == "failed") ?? [];
    }

    public get ArchiveValid(): boolean | undefined {
        return this._archiveValid;
    }

    public get Importer(): ListsImporter | undefined {
        return this._importer;
    }

    public get ImportError(): boolean {
        return this._importError;
    }

    public async back() {
        this._importer?.CleanUp();
        await this.NavController.navigateBack("settings/im-export");
    }

    public async selectArchive(): Promise<void> {
        this._importDone = false;
        this._archiveValid = undefined;
        this._archive = undefined;
        this._importError = false;

        if (!environment.production && !(await this.debugArchive())) {
            let files: PickFilesResult | undefined = undefined;
            try {
                files = await FilePicker.pickFiles({
                    limit: 1,
                    readData: true,
                    types: ["application/zip"],
                });
            } catch (e) {
                if (!(e instanceof CapacitorException) || !e.message.includes("canceled")) {
                    Logger.Error(`Import: could not import archive: `, e);
                    await this.error();
                }
            }

            if (!files?.files.length || !files.files[0].data?.length) {
                return;
            }

            this._archive = undefined;

            try {
                this._archive = (
                    await Filesystem.writeFile({
                        path: "import/archive.zip",
                        directory: Directory.Cache,
                        data: files.files[0].data,
                        recursive: true,
                    })
                ).uri;
            } catch (e) {
                Logger.Error(`Import: could not copy archive to cache: `, e);
                await this.error();
                return;
            }
        }

        this._importItems = [];

        this._importer = new ListsImporter();
        await this._importer.Initialize(this._archive!);
        const content = await this._importer.Analyse();
        if (content.length > 0) {
            if (content.includes("lists")) {
                this._importItems.push({ key: "lists", locale: "im-export.item_lists", status: "enabled", icon: "/assets/icons/menu/lists.svg", done: 0, order: 0 });
            }
            if (content.includes("trash")) {
                this._importItems.push({ key: "trash", locale: "im-export.item_trash", status: "enabled", icon: "/assets/icons/menu/trash.svg", done: 0, order: 1 });
            }
            if (content.includes("settings")) {
                this._importItems.push({ key: "settings", locale: "im-export.item_settings", status: "enabled", icon: "/assets/icons/menu/settings.svg", done: 0, order: 2 });
            }
            this._archiveValid = true;
        } else {
            await this._importer.CleanUp();
            this._importer = undefined;
            this._archive = undefined;
            this._archiveValid = false;
        }
    }

    public async Import() {
        if (!this._archive || !this._importer || !this._importItems) {
            return;
        }

        this._importError = false;

        this._importItems.forEach(val => {
            if (val.status != "disabled") {
                val.status = "enabled";
            }
        });

        const reload_lists_service: ("lists" | "trash")[] = [];
        const keys = Array.from(this._importItems.keys());
        for (let i = 0; i < this._importItems.length; i++) {
            const item = this._importItems[i];
            if (item?.status != "enabled") {
                continue;
            }

            let result = true;
            item.status = "running";

            const listener = ProgressListenerFactory(done => {
                item.done = done;
            });

            switch (item.key) {
                case "lists":
                    result = await this._importer.ImportLists(listener, this._sqliteService, this.ListsService);
                    reload_lists_service.push("lists");
                    break;
                case "trash":
                    result = await this._importer.ImportTrash(listener, this._sqliteService, this.ListsService);
                    reload_lists_service.push("lists", "trash");
                    break;
                case "settings":
                    result = await this._importer.ImportSettings(listener, { preferences: this.Preferences, connectiq: this.ConnectIQ, locale: this.Locale, logger: this.Logger });
                    break;
            }

            if (!result) {
                item.status = "failed";
                this.Popups.Toast.Error("page_settings_import.import_error");
                this._importError = true;
                return;
            } else {
                item.status = "success";
            }

            item.success = listener.Success;
            item.failed = listener.Failed;
        }

        await this._importer?.CleanUp();

        if (reload_lists_service.length > 0) {
            await this.ListsService.ReloadListsDataset(reload_lists_service.filter((v, i, a) => i == a.indexOf(v)));
        }

        this._importer = undefined;
        this._archive = undefined;
        this._importDone = true;
        this.cdr.detectChanges();
    }

    public async onChangeImportItem(item: ImportItem) {
        if (item.status == "disabled") {
            item.status = "enabled";
        } else {
            item.status = "disabled";
        }
    }

    public async importDone() {
        await this.NavController.navigateBack("lists");
    }

    public Report(item_index: ImportKey): string {
        const item = this._importItems?.find(i => i.key == item_index);
        let ret: string[] = [];

        if (item && (item.status == "success" || item.status == "failed") && item.success !== undefined && item.failed !== undefined) {
            if (item_index == "settings") {
                if (item.failed == 0) {
                    ret.push(this.Locale.getText("page_settings_import.import_report_success_settings"));
                } else {
                    ret.push(this.Locale.getText("page_settings_import.import_report_failed_settings"));
                }
            } else {
                if (item.success == 1) {
                    ret.push(this.Locale.getText(`page_settings_import.import_report_success_${item_index}_singular`));
                } else if (item.success > 1) {
                    ret.push(this.Locale.getText(`page_settings_import.import_report_success_${item_index}`, { num: item.success }));
                }
                if (item.failed == 1) {
                    ret.push(this.Locale.getText(`page_settings_import.import_report_failed_${item_index}_singular`));
                } else if (item.failed > 1) {
                    ret.push(this.Locale.getText(`page_settings_import.import_report_failed_${item_index}`, { num: item.failed }));
                }
                if (ret.length <= 0) {
                    ret.push(this.Locale.getText(`page_settings_import.import_report_success_${item_index}`, { num: 0 }));
                }
            }
        }
        return ret.join("<br />");
    }

    public ReportIcon(item_index: ImportKey): string {
        const item = this._importItems?.find(i => i.key == item_index);
        if (item) {
            if (item.status == "success" && !item.failed) {
                return "/assets/icons/im-export/item_success.svg";
            } else if (item.status == "failed") {
                return "/assets/icons/im-export/item_failed.svg";
            }
        }

        return "/assets/icons/im-export/item_disabled.svg";
    }

    public ReportIconClass(item_index: ImportKey): string {
        const item = this._importItems?.find(i => i.key == item_index);
        if (item) {
            if (item.status == "success" && !item.failed) {
                return "success";
            } else if (item.status == "failed" || (item.status == "success" && item.failed)) {
                return "failed";
            }
        }
        return "";
    }

    private async error() {
        this._importItems?.forEach(i => {
            if (i.status != "success" && i.status != "disabled") {
                i.status = "failed";
            }
        });
        await this._importer?.CleanUp();
        this._importer = undefined;
        this._archive = undefined;
        this._importItems = undefined;
        this._importDone = false;
        this.Popups.Toast.Error("page_settings_import.select_archive_error", undefined, true);
    }

    private async debugArchive(): Promise<boolean> {
        const debug_archive = "import/lists-export.zip";
        if (await FileUtils.FileExists(debug_archive, Directory.Cache)) {
            try {
                this._archive = (await Filesystem.getUri({ path: debug_archive, directory: Directory.Cache })).uri;
                return true;
            } catch {}
        }
        return false;
    }
}

type ImportKey = "lists" | "trash" | "settings";

type ImportItem = {
    key: ImportKey;
    locale: string;
    status: "success" | "failed" | "running" | "disabled" | "enabled";
    icon: string;
    done: number;
    success?: number;
    failed?: number;
    order: number;
};
