import { Directory, Filesystem } from "@capacitor/filesystem";
import { strToU8, zip, type DeflateOptions } from "fflate";
import { FileUtils } from "src/app/classes/utils/file-utils";
import { StringUtils } from "src/app/classes/utils/string-utils";
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

    private _zipData: Map<string, Uint8Array> = new Map();
    private readonly _zipOptions: DeflateOptions = { level: 9, mem: 8 };

    private get _exportArchive(): string {
        return this._archiveFilename ?? this._archiveBasename + this._archiveExtension;
    }

    public get Running(): boolean {
        return this._isRunning;
    }

    public async Initialize(): Promise<boolean> {
        this._zipData.clear();
        await this.CleanUp();
        this._isRunning = true;
        this._cancelRequested = false;
        return true;
    }

    public async Stop() {
        this._cancelRequested = true;
        this._isRunning = false;
    }

    public async CleanUp() {
        try {
            await Filesystem.rmdir({ path: this._exportPath, directory: this._exportDir, recursive: true });
        } catch {}
    }

    public async Finalize(): Promise<false | string> {
        if (this._isRunning) {
            try {
                if (await FileUtils.FileExists(this._exportArchive, Directory.Documents)) {
                    const now = new Date();
                    const tmp = `_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDay()).padStart(2, "0")}_${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
                    this._archiveFilename = this._archiveBasename + tmp + this._archiveExtension;
                }
            } catch (e) {
                Logger.Error(`Export: could not copy zip archive to '${this._exportArchive}' in CACHE`, e);
                return false;
            }
            const structure: { [key: string]: Uint8Array } = Object.fromEntries(this._zipData.entries());

            const data = await new Promise<Uint8Array>((resolve, reject) => {
                zip(structure, this._zipOptions, (err, data) => {
                    if (err) {
                        Logger.Error(`Export: could not create zip archive: ${err}`);
                        reject();
                    } else {
                        resolve(data);
                    }
                });
            });

            let archive: string | boolean = false;

            try {
                await Filesystem.mkdir({ path: this._exportPath, directory: this._exportDir, recursive: true });
            } catch {}

            if (data) {
                try {
                    //write file to CACHE folder
                    const res = await Filesystem.writeFile({
                        path: FileUtils.JoinPaths(this._exportPath, this._exportArchive),
                        directory: this._exportDir,
                        data: btoa(String.fromCharCode(...data)),
                    });
                    archive = res.uri;
                    Logger.Debug(`Export: created zip archive at '${archive}'`);
                } catch (e) {
                    Logger.Error(`Export: could not store zip archive to '${this._exportArchive}' in '${this._exportDir}': `, e);
                }

                try {
                    //copy it to DOCUMENTS folder
                    const res = await Filesystem.copy({ from: FileUtils.JoinPaths(this._exportPath, this._exportArchive), directory: this._exportDir, to: this._exportArchive, toDirectory: Directory.Documents });
                    Logger.Debug(`Export: copied zip archive to '${res.uri}'`);
                } catch (e) {
                    Logger.Error("Export: could not copy zip archive to DOCUMENTS folder: ", e);
                }
            }

            return archive;
        }
        return false;
    }

    public async ExportLists(listsService: ListsSqliteBackendService, listener?: ProgressListener): Promise<boolean> {
        const lists = await listsService.queryLists({ peek: false, trash: false });
        listener?.Init(lists.length);

        for (const list of lists) {
            if (this._cancelRequested) {
                this.cancel();
                return false;
            }
            const json = JSON.stringify(ListToModel(list), null, 2);
            const filename = `${list.Id}-${StringUtils.shorten(StringUtils.FilesaveString(list.Name), 20, false)}.json`;
            const dir = FileUtils.JoinPaths("lists", "lists", filename);

            try {
                this._zipData.set(dir, strToU8(json, false));
                Logger.Debug(`Export: stored list '${list.toLog()}' at '${dir}' in zip archive`);
                listener?.oneSuccess();
            } catch (e) {
                Logger.Error(`Export: could not store list '${list.toLog()}' at '${dir}' in zip archive:`, e);
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
                this.cancel();
                return false;
            }
            const json = JSON.stringify(ListToModel(list), null, 2);
            const filename = `${list.Id}-${StringUtils.shorten(StringUtils.FilesaveString(list.Name), 20, false)}.json`;
            const dir = FileUtils.JoinPaths("lists", "trash", filename);

            try {
                this._zipData.set(dir, strToU8(json, false));
                Logger.Debug(`Export: stored list '${list.toLog()}' at '${dir}' in zip archive`);
                listener?.oneSuccess();
            } catch (e) {
                Logger.Error(`Export: could not store list '${list.toLog()}' at '${dir}' in zip archive: `, e);
                listener?.oneFailed();
            }
            listener?.oneDone();
        }

        if (models) {
            const trashMap = new Map<number, ListitemModel[]>();

            for (const model of models) {
                const array = trashMap.get(model.list_id) ?? [];
                array.push(model);
                trashMap.set(model.list_id, array);
            }

            for (const [list_id, models] of trashMap.entries()) {
                if (this._cancelRequested) {
                    this.cancel();
                    return false;
                }
                const obj = {
                    id: list_id,
                    items: models.map(m => ListitemToModel(new Listitem(m))),
                };
                const json = JSON.stringify(obj, null, 2);
                const filename = `${list_id}.json`;
                const dir = FileUtils.JoinPaths("lists", "trash", "items", filename);
                try {
                    this._zipData.set(dir, strToU8(json, false));
                    Logger.Debug(`Export: stored listitems in trash for list '${list_id}' at '${dir}' in zip archive`);
                    listener?.oneSuccess();
                } catch (e) {
                    Logger.Error(`Export: could not store listitems in trash for list  '${list_id} at '${dir}' in zip archive: `, e);
                    listener?.oneFailed(models.length);
                }
                listener?.oneDone(models.length);
            }
        }

        return true;
    }

    public async ExportSettings(service: PreferencesService): Promise<boolean> {
        const json = await service.Export();

        try {
            this._zipData.set(this._settingsFile, strToU8(json, false));
            Logger.Debug(`Export: saved app settings to '${this._settingsFile}' in zip archive`);
        } catch (e) {
            Logger.Error(`Export failed: could not write settings file to '${this._settingsFile}' in zip archive: `, e);
            return false;
        }

        return true;
    }

    private cancel() {
        this._zipData.clear();
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
