import { Directory, Filesystem } from "@capacitor/filesystem";
import { FileUtils } from "src/app/classes/utils/file-utils";
import { StringUtils } from "src/app/classes/utils/string-utils";
import ZipPlugin from "src/app/plugins/zip/zip-plugin";
import { Listitem, type ListitemModel } from "src/app/services/lists/listitem";
import { Logger } from "src/app/services/logging/logger";
import type { PreferencesService } from "../../preferences.service";
import type { ListsSqliteBackendService } from "../../sqlite/lists/lists-sqlite-backend.service";
import { SqliteService } from "./../../sqlite/sqlite.service";
import { ListitemToModel, ListToModel } from "./to-model";

export class BackendExporter {
    private _isRunning = false;
    private _exportDir = Directory.Cache;
    private _exportPath = "export";
    private _archiveBasename = "lists-export";
    private _archiveExtension = ".zip";
    private _archiveFilename?: string = undefined;
    private _settingsFile = "settings.json";
    private _cancelRequested = false;

    private get _exportArchive(): string {
        return this._archiveFilename ?? this._archiveBasename + this._archiveExtension;
    }

    public get Running(): boolean {
        return this._isRunning;
    }

    public async Initialize(): Promise<boolean> {
        const init = await ZipPlugin.Zip({ level: 6 });
        if (init.success) {
            await this.CleanUp();
            this._isRunning = true;
            this._cancelRequested = false;
            return true;
        }
        return false;
    }

    public async Stop() {
        this._cancelRequested = true;
        this._isRunning = false;
        await ZipPlugin.Clear();
    }

    public async CleanUp() {
        try {
            await Filesystem.rmdir({ path: this._exportPath, directory: this._exportDir, recursive: true });
        } catch {}
    }

    public async Finalize(): Promise<false | string> {
        if (this._isRunning) {
            if (await FileUtils.FileExists(this._exportArchive, Directory.Documents)) {
                const now = new Date();
                const tmp = `_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDay()).padStart(2, "0")}_${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
                this._archiveFilename = this._archiveBasename + tmp + this._archiveExtension;
            }

            const res = await ZipPlugin.Store({ filename: FileUtils.JoinPaths(this._exportPath, this._exportArchive) });
            if (res.success) {
                try {
                    //copy it to DOCUMENTS folder
                    const res = await Filesystem.copy({ from: FileUtils.JoinPaths(this._exportPath, this._exportArchive), directory: this._exportDir, to: this._exportArchive, toDirectory: Directory.Documents });
                    Logger.Debug(`Export: copied zip archive to '${res.uri}'`);
                } catch (e) {
                    Logger.Error("Export: could not copy zip archive to DOCUMENTS folder: ", e);
                }
                Logger.Debug(`Export: created zip archive at '${res.path}' in CACHE`);

                try {
                    const uri = await Filesystem.getUri({ path: res.path!, directory: Directory.Cache });
                    return uri.uri;
                } catch (e) {
                    Logger.Debug(`Export: could not get uri of zip archive in '${res.path}': `, e);
                }
            } else {
                Logger.Error(`Export: could not store zip archive to '${this._exportArchive}' in '${this._exportDir}': `);
            }
        }

        return false;
    }

    public async ExportLists(listsService: ListsSqliteBackendService, listener?: ProgressListener): Promise<boolean> {
        const lists = await listsService.queryLists({ peek: false, trash: false });
        listener?.Init(lists.length);

        for (const list of lists) {
            if (this._cancelRequested) {
                return false;
            }
            const json = JSON.stringify(ListToModel(list), null, 2);
            const filename = `${list.Id}-${StringUtils.shorten(StringUtils.FilesaveString(list.Name), 20, false)}.json`;
            const dir = FileUtils.JoinPaths("lists", "lists", filename);

            const res = await ZipPlugin.addFile({ filename: dir, content: json });
            if (res.success) {
                Logger.Debug(`Export: stored list '${list.toLog()}' at '${res.path}' in zip archive`);
                listener?.oneSuccess();
            } else {
                Logger.Error(`Export: could not store list '${list.toLog()}' at '${res.path}' in zip archive:`);
                listener?.oneFailed();
            }
            listener?.oneDone();
        }

        return true;
    }

    public async ExportTrash(listsService: ListsSqliteBackendService, sqliteService: SqliteService, listener?: ProgressListener): Promise<boolean> {
        const lists = await listsService.queryLists({ peek: false, trash: true });
        const query = "SELECT * FROM `listitems` WHERE `deleted` IS NOT NULL ORDER BY `deleted` ASC";
        const models = (await sqliteService.Query(query)) as ListitemModel[] | undefined;

        listener?.Init(lists.length + (models?.length ?? 0));

        for (const list of lists) {
            if (this._cancelRequested) {
                return false;
            }
            const json = JSON.stringify(ListToModel(list), null, 2);
            const filename = `${list.Id}-${StringUtils.shorten(StringUtils.FilesaveString(list.Name), 20, false)}.json`;
            const dir = FileUtils.JoinPaths("lists", "trash", filename);

            const res = await ZipPlugin.addFile({ filename: dir, content: json });
            if (res.success) {
                Logger.Debug(`Export: stored trash list '${list.toLog()}' at '${res.path}' in zip archive`);
                listener?.oneSuccess();
            } else {
                Logger.Error(`Export: could not store trash list '${list.toLog()}' at '${res.path}' in zip archive: `);
                listener?.oneFailed();
            }
            listener?.oneDone();
        }

        if (models) {
            const trashMap = new Map<number, ListitemModel[]>();

            for (const model of models) {
                if (model.list_id) {
                    const array = trashMap.get(model.list_id) ?? [];
                    array.push(model);
                    trashMap.set(model.list_id, array);
                }
            }

            for (const [list_id, models] of trashMap.entries()) {
                if (this._cancelRequested) {
                    return false;
                }
                const obj = {
                    id: list_id,
                    items: models.map(m => ListitemToModel(new Listitem(m))),
                };
                const json = JSON.stringify(obj, null, 2);
                const filename = `${list_id}.json`;
                const dir = FileUtils.JoinPaths("lists", "trash", "items", filename);

                const res = await ZipPlugin.addFile({ filename: dir, content: json });
                if (res.success) {
                    Logger.Debug(`Export: stored listitems in trash for list '${list_id}' at '${res.path}' in zip archive`);
                    listener?.oneSuccess();
                } else {
                    Logger.Error(`Export: could not store listitems in trash for list  '${list_id} at '${res.path}' in zip archive: `);
                    listener?.oneFailed(models.length);
                }
                listener?.oneDone(models.length);
            }
        }

        return true;
    }

    public async ExportSettings(service: PreferencesService): Promise<boolean> {
        const json = await service.Export();

        const res = await ZipPlugin.addFile({ filename: this._settingsFile, content: json });
        if (res.success) {
            Logger.Debug(`Export: saved app settings to '${res.path}' in zip archive`);
        } else {
            Logger.Error(`Export failed: could not write settings file to '${res.path}' in zip archive: `);
            return false;
        }
        return true;
    }
}

export class ProgressListener {
    protected _total: number = -1;
    protected _done: number = 0;
    protected _success: number = 0;
    protected _failed: number = 0;

    public get Success(): number {
        return this._success;
    }

    public get Failed(): number {
        return this._failed;
    }

    public Init(total: number) {
        this._done = 0;
        this._total = total;
    }

    public oneDone(number: number = 1) {
        this._done += number;
        if (this._total > 0) {
            this.onProgress(this._done / this._total);
        }
    }

    public oneSuccess(number: number = 1) {
        this._success += number;
    }

    public oneFailed(number: number = 1) {
        this._failed += number;
    }

    protected onProgress(done: number): Promise<void> {
        return Promise.resolve();
    }
}

export function ProgressListenerFactory(onProgressCallback: (progress: number) => void | Promise<void>): ProgressListener {
    return new (class extends ProgressListener {
        protected override async onProgress(done: number): Promise<void> {
            await onProgressCallback(done);
        }
    })();
}
