import { Directory, Filesystem } from "@capacitor/filesystem";
import { Zip } from "capa-zip";
import { FileUtils } from "src/app/classes/utils/file-utils";
import { StringUtils } from "src/app/classes/utils/string-utils";
import { AppService } from "src/app/services/app/app.service";
import { Logger } from "src/app/services/logging/logger";
import type { PreferencesService } from "../../preferences.service";

export class ListsImporter {
    private _running: boolean = false;
    private _importPath?: string;

    private readonly _settingsFile = "settings.json";
    private readonly _listsBaseDirectory = "lists";
    private readonly _listsDirectory = "lists";
    private readonly _trashDirectory = "trash";

    public get isRunning(): boolean {
        return this._running;
    }

    public async Initialize(archive: string): Promise<boolean> {
        let ret = true;

        if (await FileUtils.DirExists(archive)) {
            this._importPath = archive;
        } else if (archive.endsWith(".zip")) {
            AppService.AppToolbar?.ToggleProgressbar(true);
            const path = "import/unzip";
            if (await FileUtils.DirExists(path, Directory.Cache)) {
                await FileUtils.EmptyDir(path, Directory.Cache, undefined, true);
            } else if (await FileUtils.FileExists(path, Directory.Cache)) {
                await FileUtils.DeleteFile(path, Directory.Cache);
            }

            const create = await FileUtils.MkDir(path, Directory.Cache);
            if (create) {
                try {
                    await Zip.unzip({
                        sourceFile: archive,
                        destinationPath: create,
                    });
                    this._importPath = create;
                } catch (e) {
                    Logger.Error(`Importer: could not unzip archive:`, e);
                    ret = false;
                }
            } else {
                ret = false;
            }
            AppService.AppToolbar?.ToggleProgressbar(false);
        }
        if (!ret) {
            this._running = false;
        }

        return ret;
    }

    public async Analyse(): Promise<string[]> {
        if (!this._importPath?.length || !(await FileUtils.FileExists(this._importPath))) {
            Logger.Debug(`Importer: Source directory not found at ${this._importPath}`);
            return [];
        }

        const content = [];
        const hasLists = async function (path: string, recursive: boolean): Promise<boolean> {
            try {
                const files = await Filesystem.readdir({ path: path });
                for (let i = 0; i < files.files.length; i++) {
                    const file = files.files[i];
                    if (file.type == "file" && file.name.endsWith(".json") && file.size > 0) {
                        return true;
                    } else if (recursive && file.type == "directory") {
                        return await hasLists(file.uri, recursive);
                    }
                }
            } catch (e) {
                Logger.Error(`Importer: could not analyse directory ${path}:`, e);
            }
            return false;
        };

        try {
            const files = await Filesystem.readdir({ path: StringUtils.concat(this._importPath, this._listsBaseDirectory, "/") });
            for (let i = 0; i < files.files.length; i++) {
                const file = files.files[i];
                if (file.type == "directory") {
                    if (file.name == this._listsDirectory && (await hasLists(file.uri, false))) {
                        content.push("lists");
                    } else if (file.name === this._trashDirectory && (await hasLists(file.uri, true))) {
                        content.push("trash");
                    }
                }
            }
        } catch (e) {
            Logger.Error(`Importer: could not analyse directory ${this._importPath}:`, e);
        }

        try {
            const settings = await Filesystem.stat({ path: StringUtils.concat(this._importPath, this._settingsFile, "/") });
            if (settings.type == "file" && settings.size > 0) {
                content.push("settings");
            }
        } catch {
            //no settings file...
        }

        return content;
    }

    public async ImportLists(listener: ProgressListener): Promise<boolean> {
        this._running = true;
        listener.Init(2);
        listener.oneDone();
        await new Promise(resolve => setTimeout(resolve, 1000));
        listener.oneDone();
        return true;
    }

    public async ImportTrash(listener: ProgressListener): Promise<boolean> {
        this._running = true;
        listener.Init(2);
        listener.oneDone();
        await new Promise(resolve => setTimeout(resolve, 1000));
        listener.oneDone();
        return true;
    }

    public async ImportSettings(preferences: PreferencesService): Promise<boolean> {
        this._running = true;
        return true;
    }

    public async CleanUp() {
        this._running = false;
    }
}

export abstract class ProgressListener {
    protected _total: number = -1;
    protected _done: number = 0;
    public Init(total: number) {
        this._done = 0;
        this._total = total;
    }

    public oneDone() {
        this._done++;
        if (this._total > 0) {
            this.onProgress(this._done / this._total);
        }
    }

    protected abstract onProgress(done: number): Promise<void>;
}

export function ProgressListenerFactory(onProgressCallback: (progress: number) => void | Promise<void>): ProgressListener {
    return new (class extends ProgressListener {
        protected override async onProgress(done: number): Promise<void> {
            console.log("DONE:", done);

            await onProgressCallback(done);
        }
    })();
}
