import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CapacitorException } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FilePicker, type PickFilesResult } from "@capawesome/capacitor-file-picker";
import { IonButton, IonButtons, IonCard, IonCheckbox, IonContent, IonIcon, IonLabel, IonList, IonProgressBar, IonText } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { Logger } from "src/app/services/logging/logger";
import { ListsImporter, ProgressListenerFactory } from "src/app/services/storage/lists/import/lists-importer";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-import",
    templateUrl: "./import.page.html",
    styleUrls: ["./import.page.scss"],
    standalone: true,
    imports: [IonCheckbox, IonProgressBar, IonText, IonLabel, IonList, IonCard, IonIcon, IonButton, IonButtons, IonContent, CommonModule, FormsModule, TranslateModule, MainToolbarComponent],
})
export class ImportPage extends PageBase {
    private _archive?: string;

    private _importItems?: Map<string, ImportItem>;

    private _importer?: ListsImporter;

    private _done: boolean = false;

    private _archiveValid?: boolean;

    public get Done(): boolean {
        return this._done;
    }

    public get Archive(): string | undefined {
        return this._archive;
    }

    public get SomethingEnabled(): boolean {
        return Array.from(this._importItems?.values() ?? []).some(item => item.status !== "disabled");
    }

    public get ImportItems(): ImportItem[] | undefined {
        if (this._importItems) {
            return Array.from(this._importItems.values()).sort((a, b) => a.order - b.order);
        } else {
            return undefined;
        }
    }

    public get ArchiveValid(): boolean | undefined {
        return this._archiveValid;
    }

    public get Importer(): ListsImporter | undefined {
        return this._importer;
    }

    public async back() {
        this._importer?.CleanUp();
        await this.NavController.navigateBack("settings/im-export");
    }

    public async selectArchive(): Promise<void> {
        this._done = false;
        this._archiveValid = undefined;

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
        }

        this._importItems = new Map<string, ImportItem>();

        this._importer = new ListsImporter();
        await this._importer.Initialize(this._archive!);
        const content = await this._importer.Analyse();
        if (content.length > 0) {
            if (content.includes("lists")) {
                this._importItems.set("lists", { locale: "im-export.item_lists", status: "enabled", icon: "/assets/icons/menu/lists.svg", done: 0, order: 0 });
            }
            if (content.includes("trash")) {
                this._importItems.set("trash", { locale: "im-export.item_trash", status: "enabled", icon: "/assets/icons/menu/trash.svg", done: 0, order: 1 });
            }
            if (content.includes("settings")) {
                this._importItems.set("settings", { locale: "im-export.item_settings", status: "enabled", icon: "/assets/icons/menu/settings.svg", done: 0, order: 2 });
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

        const keys = Array.from(this._importItems.keys());
        for (let i = 0; i < keys.length; i++) {
            const item = this._importItems.get(keys[i]);
            if (item?.status != "enabled") {
                continue;
            }

            let result = true;
            item.status = "running";

            switch (keys[i]) {
                case "lists":
                    result = await this._importer.ImportLists(
                        ProgressListenerFactory(done => {
                            item.done = done;
                        }),
                    );
                    break;
                case "trash":
                    result = await this._importer.ImportTrash(
                        ProgressListenerFactory(done => {
                            item.done = done;
                        }),
                    );
                    break;
                case "settings":
                    result = await this._importer.ImportSettings(this.Preferences);
                    break;
            }

            if (!result) {
                item.status = "failed";
                this.error();
                return;
            } else {
                item.status = "success";
            }
        }

        await this._importer?.CleanUp();
        this._importer = undefined;
        this._done = true;
    }

    public async onChangeImportItem(item: ImportItem) {
        if (item.status == "disabled") {
            item.status = "enabled";
        } else {
            item.status = "disabled";
        }
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
        this._done = false;
        this.Popups.Toast.Error("page_settings_import.select_archive_error", undefined, true);
    }
}

type ImportItem = {
    locale: string;
    status: "success" | "failed" | "running" | "disabled" | "enabled";
    icon: string;
    done: number;
    order: number;
};
