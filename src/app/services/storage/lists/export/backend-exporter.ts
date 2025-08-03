import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Zip } from "capa-zip";
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
    private _exportPath = "export";
    private _exportDir = Directory.Cache;
    private _archiveBasename = "lists-export";
    private _archiveExtension = ".zip";
    private _archiveFilename?: string = undefined;
    private _settingsFile = "settings.json";

    private get _tmpPath(): string {
        return FileUtils.JoinPaths(this._exportPath, "temp");
    }

    private get _exportArchive(): string {
        return this._archiveFilename ?? this._archiveBasename + this._archiveExtension;
    }

    public get Running(): boolean {
        return this._isRunning;
    }

    public async Initialize(): Promise<boolean> {
        //remove old export files if any exist
        if (!(await this.removeExportFolder())) {
            return false;
        }
        this._isRunning = true;
        return true;
    }

    public async Stop() {
        await this.CleanUp();
        this._isRunning = false;
    }

    public async CleanUp(delete_archive: boolean = false) {
        if (delete_archive) {
            await this.removeExportFolder();
        } else {
            await this.removeOldFiles();
        }
    }

    public async Finalize(): Promise<false | string> {
        if (this._isRunning) {
            let source,
                destination = "";
            try {
                source = (await Filesystem.getUri({ path: this._tmpPath, directory: this._exportDir })).uri;
                destination = (await Filesystem.getUri({ path: FileUtils.JoinPaths(this._exportPath, this._exportArchive, "/"), directory: this._exportDir })).uri;

                await Zip.zip({
                    sourcePath: source,
                    destinationPath: destination,
                });
                Logger.Notice(`Export: created archive at ${destination}`);
            } catch (e) {
                Logger.Error(`Export: could not export '${source}' to '${destination}': `, e);
                await this.Stop();
                return false;
            }

            try {
                if (await FileUtils.FileExists(this._exportArchive, Directory.Documents)) {
                    const now = new Date();
                    const tmp = `_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDay()).padStart(2, "0")}_${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
                    this._archiveFilename = this._archiveBasename + tmp + this._archiveExtension;
                }

                await Filesystem.copy({ from: destination, to: this._exportArchive, toDirectory: Directory.Documents });
                Logger.Notice(`Export: copied archive '${destination}' to '${this._exportArchive}' in '${Directory.Documents}'`);
            } catch (e) {
                Logger.Error(`Export: could not copy archive '${destination}' to '${this._exportArchive}' in DOCUMENTS`, e);
                return false;
            }

            await this.Stop();

            return destination;
        }
        return false;
    }

    public async ExportLists(listsService: ListsSqliteBackendService, listener?: ProgressListener): Promise<boolean> {
        const lists = await listsService.queryLists({ peek: false, trash: false });
        listener?.Init(lists.length);

        if (lists.length > 0) {
            if (!(await this.createTempDirectory("lists/lists"))) {
                return false;
            }

            for (const list of lists) {
                const json = JSON.stringify(ListToModel(list), null, 2);
                const filename = `${list.Id}-${StringUtils.shorten(StringUtils.FilesaveString(list.Name), 20, false)}.json`;
                const filepath = FileUtils.JoinPaths(this._tmpPath, "lists", "lists", filename);

                try {
                    const write = await Filesystem.writeFile({ path: filepath, directory: this._exportDir, encoding: Encoding.UTF8, recursive: true, data: json });
                    Logger.Debug(`Export: stored list '${list.toLog()}' at '${write.uri}'`);
                    listener?.oneSuccess();
                } catch (e) {
                    Logger.Error(`Export: could not store list '${list.toLog()}' at '${filepath}' in '${this._exportDir}': `, e);
                    listener?.oneFailed();
                }
                listener?.oneDone();
            }
        }

        return true;
    }

    public async ExportTrash(listsService: ListsSqliteBackendService, sqliteService: SqliteService, listener?: ProgressListener): Promise<boolean> {
        const lists = await listsService.queryLists({ peek: false, trash: true });
        const query = "SELECT * FROM `listitems` WHERE `deleted` IS NOT NULL ORDER BY `deleted` ASC";
        const models = (await sqliteService.Query(query)) as ListitemModel[] | undefined;

        listener?.Init(lists.length + (models?.length ?? 0));

        if (lists.length > 0) {
            if (!(await this.createTempDirectory("lists/trash"))) {
                return false;
            }

            for (const list of lists) {
                const json = JSON.stringify(ListToModel(list), null, 2);
                const filename = `${list.Id}-${StringUtils.shorten(StringUtils.FilesaveString(list.Name), 20, false)}.json`;
                const filepath = FileUtils.JoinPaths(this._tmpPath, "lists", "trash", filename);

                try {
                    const write = await Filesystem.writeFile({ path: filepath, directory: this._exportDir, encoding: Encoding.UTF8, recursive: true, data: json });
                    Logger.Debug(`Export: stored list '${list.toLog()}' at '${write.uri}'`);
                    listener?.oneSuccess();
                } catch (e) {
                    Logger.Error(`Export: could not store list '${list.toLog()}' at '${filepath}' in '${this._exportDir}': `, e);
                    listener?.oneFailed();
                }
                listener?.oneDone();
            }
        }

        if (models) {
            if (!(await this.createTempDirectory("lists/trash/items"))) {
                return false;
            }

            const trashMap = new Map<number, ListitemModel[]>();

            for (const model of models) {
                const array = trashMap.get(model.list_id) ?? [];
                array.push(model);
                trashMap.set(model.list_id, array);
            }

            for (const [list_id, models] of trashMap.entries()) {
                const obj = {
                    id: list_id,
                    items: models.map(m => ListitemToModel(new Listitem(m))),
                };
                const json = JSON.stringify(obj, null, 2);
                const filename = `${list_id}.json`;
                const filepath = FileUtils.JoinPaths(this._tmpPath, "lists", "trash", "items", filename);
                try {
                    const write = await Filesystem.writeFile({ path: filepath, directory: this._exportDir, encoding: Encoding.UTF8, recursive: true, data: json });
                    Logger.Debug(`Export: stored listitems in trash for list '${list_id}' at '${write.uri}'`);
                    listener?.oneSuccess(models.length);
                } catch (e) {
                    Logger.Error(`Export: could not store listitems in trash for list  '${list_id} at '${filepath}' in '${this._exportDir}': `, e);
                    listener?.oneFailed(models.length);
                }
                listener?.oneDone(models.length);
            }
        }

        return true;
    }

    public async ExportSettings(service: PreferencesService): Promise<boolean> {
        const filename = FileUtils.JoinPaths(this._tmpPath, this._settingsFile);
        const json = await service.Export();
        try {
            const write = await Filesystem.writeFile({ path: filename, directory: this._exportDir, data: json, encoding: Encoding.UTF8 });
            Logger.Debug(`Export: saved app settings to '${write.uri}'`);
        } catch (e) {
            Logger.Error(`Export failed: could not write settings file to '${filename}' in '${this._exportDir}': `, e);
            return false;
        }

        return true;
    }

    private async createTempDirectory(fullpath: string): Promise<boolean> {
        fullpath = FileUtils.JoinPaths(this._tmpPath, fullpath);
        try {
            await Filesystem.mkdir({ path: fullpath, directory: this._exportDir, recursive: true });
        } catch (e) {
            Logger.Error(`Export failed: could not create temporary directory at '${fullpath}' in '${this._exportDir}': `, e);
            return false;
        }

        return true;
    }

    private async removeOldFiles(fullpath?: string): Promise<boolean> {
        let directory;
        try {
            directory = await Filesystem.stat({ path: this._tmpPath, directory: this._exportDir });
        } catch {
            //direcory does not exist
            return true;
        }

        const exportPath = fullpath?.length ? FileUtils.JoinPaths(this._tmpPath, fullpath) : this._tmpPath;
        try {
            if (directory.type == "directory") {
                const files = (await Filesystem.readdir({ path: exportPath, directory: this._exportDir })).files;
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (file.type == "file") {
                        const path = FileUtils.JoinPaths(exportPath, file.name);
                        await Filesystem.deleteFile({ path: path, directory: this._exportDir });
                    } else {
                        const path = fullpath?.length ? FileUtils.JoinPaths(fullpath, file.name) : file.name;
                        await this.removeOldFiles(path);
                    }
                }
                await Filesystem.rmdir({ path: exportPath, directory: this._exportDir, recursive: true });
            } else {
                await Filesystem.deleteFile({ path: exportPath, directory: this._exportDir });
            }
        } catch (e) {
            Logger.Error(`Export failed: could not remove old export files from '${(await Filesystem.getUri({ path: exportPath, directory: this._exportDir })).uri}':`, e);
            return false;
        }

        return true;
    }

    private async removeExportFolder(): Promise<boolean> {
        try {
            await Filesystem.stat({ path: this._exportPath, directory: this._exportDir });
        } catch {
            //diretory does not exist...
            return true;
        }
        try {
            await Filesystem.rmdir({ path: this._exportPath, directory: this._exportDir, recursive: true });
            return true;
        } catch (e) {
            Logger.Error(`Could not remove export files from '${this._exportPath}' in '${this._exportDir}':`, e);
        }
        return false;
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
