import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CapacitorException } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { IonButton, IonButtons, IonCard, IonContent, IonIcon, IonLabel, IonList, IonProgressBar, IonSegment, IonSegmentButton, IonSegmentContent, IonSegmentView, IonText, IonToggle } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { Logger } from "src/app/services/logging/logger";
import { ListsSqliteBackendService } from "src/app/services/storage/sqlite/lists/lists-sqlite-backend.service";
import { SqliteService } from "src/app/services/storage/sqlite/sqlite.service";
import { PageBase } from "../../page-base";
import { BackendExporter, ProgressListenerFactory } from "./../../../services/storage/lists/export/backend-exporter";

@Component({
    selector: "app-export",
    templateUrl: "./export.page.html",
    styleUrls: ["./export.page.scss"],
    standalone: true,
    imports: [IonSegmentButton, IonSegment, IonButtons, IonProgressBar, IonText, IonLabel, IonList, IonCard, IonButton, IonIcon, IonToggle, IonContent, IonSegmentView, IonSegmentContent, CommonModule, FormsModule, TranslocoModule, MainToolbarComponent],
    providers: [provideTranslocoScope({ scope: "pages/settings/export-page", alias: "page_settings_export" }, { scope: "pages/settings/im-export", alias: "im-export" }, { scope: "common/buttons", alias: "buttons" })],
})
export class ExportPage extends PageBase {
    @ViewChild("segbtnLists", { static: false, read: ElementRef }) private _segbtnLists?: ElementRef;
    @ViewChild("segbtnTrash", { static: false, read: ElementRef }) private _segbtnTrash?: ElementRef;
    @ViewChild("segbtnSettings", { static: false, read: ElementRef }) private _segbtnSettings?: ElementRef;
    @ViewChild("segbtnFinish", { static: false, read: ElementRef }) private _segbtnFinish?: ElementRef;

    private _exportItems: ExportItem[];
    private _exporter?: BackendExporter;
    private _exportArchive?: string;
    private readonly _listsService: ListsSqliteBackendService = inject(ListsSqliteBackendService);
    private readonly _sqliteService: SqliteService = inject(SqliteService);

    public get ExportItems(): ExportItem[] | undefined {
        return this._exportItems.sort((a, b) => a.order - b.order);
    }

    public get SomethingEnabled(): boolean {
        return this._exportItems.some(item => item.status !== "disabled");
    }

    public get ExportRunning(): boolean {
        return this._exporter?.Running ?? false;
    }

    public get ExportDone(): boolean {
        return this._exportArchive !== undefined;
    }

    public get ExportLists(): boolean {
        const item = this._exportItems.find(item => item.key === "lists");
        if (item && item.status != "disabled") {
            return true;
        }
        return false;
    }

    public get ExportTrash(): boolean {
        const item = this._exportItems.find(item => item.key === "trash");
        if (item && item.status != "disabled") {
            return true;
        }
        return false;
    }

    public get ExportSettings(): boolean {
        const item = this._exportItems.find(item => item.key === "settings");
        if (item && item.status != "disabled") {
            return true;
        }
        return false;
    }

    constructor() {
        super();
        this._exportItems = [
            { key: "lists", locale: "im-export.item_lists", status: "enabled", icon: "/assets/icons/menu/lists.svg", done: 0, order: 0 },
            { key: "trash", locale: "im-export.item_trash", status: "enabled", icon: "/assets/icons/menu/trash.svg", done: 0, order: 1 },
            { key: "settings", locale: "im-export.item_settings", status: "enabled", icon: "/assets/icons/menu/settings.svg", done: 0, order: 2 },
        ];
    }

    public toLists() {
        this._segbtnLists?.nativeElement?.click();
    }

    public toTrash() {
        this._segbtnTrash?.nativeElement?.click();
    }

    public toSettings() {
        this._segbtnSettings?.nativeElement?.click();
    }

    public toFinish() {
        this._segbtnFinish?.nativeElement?.click();
    }

    public toggleLists(checked: boolean) {
        for (const item of this._exportItems) {
            if (item.key === "lists") {
                item.status = checked ? "enabled" : "disabled";
            }
        }
    }

    public toggleTrash(checked: boolean) {
        for (const item of this._exportItems) {
            if (item.key === "trash") {
                item.status = checked ? "enabled" : "disabled";
            }
        }
    }

    public toggleSettings(checked: boolean) {
        for (const item of this._exportItems) {
            if (item.key === "settings") {
                item.status = checked ? "enabled" : "disabled";
            }
        }
    }

    public async cancel(delete_archive: boolean = true) {
        this._exporter?.CleanUp(delete_archive);
        this._exporter = undefined;
        this.NavController.back();
    }

    public async stopExport() {
        await this._exporter?.Stop();
    }

    public async exportToZip() {
        this._exportItems.forEach((i, key) => {
            if (i.status != "disabled") {
                i.status = "enabled";
            }
        });

        this._exporter = new BackendExporter();
        if (!(await this._exporter.Initialize())) {
            this.error();
            return;
        }

        for (const item of this._exportItems) {
            if (item?.status != "enabled") {
                continue;
            }

            let result = true;
            item.status = "running";
            switch (item.key) {
                case "lists":
                    result = await this._exporter.ExportLists(
                        this._listsService,
                        ProgressListenerFactory(done => {
                            item.done = done;
                        }),
                    );
                    break;
                case "trash":
                    result = await this._exporter.ExportTrash(
                        this._listsService,
                        this._sqliteService,
                        ProgressListenerFactory(done => {
                            item.done = done;
                        }),
                    );
                    break;
                case "settings":
                    result = await this._exporter.ExportSettings(this.Preferences);
                    if (result) {
                        item.done = 1;
                    }
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

        const archive = await this._exporter.Finalize();
        if (archive) {
            this._exportArchive = archive;
        }
    }

    public async Share() {
        if (!this._exportArchive) {
            return;
        }
        const title = this.Locale.getText("page_settings_export.export_success_share_title");
        try {
            await Share.share({
                files: [this._exportArchive],
                dialogTitle: title,
                title: title,
            });
        } catch (e) {
            if (!(e instanceof CapacitorException) || !e.message.includes("canceled")) {
                Logger.Error(`Export: could not share '${this._exportArchive}': `, e);
            }
        }
    }

    private async error() {
        this._exportItems.forEach(i => {
            if (i.status != "success" && i.status != "disabled") {
                i.status = "failed";
            }
        });
        await this._exporter?.CleanUp();
        this._exporter = undefined;
        await this.Popups.Toast.Error("page_settings_export.export_error", undefined, true);
    }
}

export type ImportKey = "lists" | "trash" | "settings";

export type ExportItem = {
    key: ImportKey;
    locale: string;
    status: "success" | "failed" | "running" | "disabled" | "enabled";
    icon: string;
    done: number;
    success?: number;
    failed?: number;
    order: number;
};
