import { Directory, Encoding, type FileInfo, Filesystem } from "@capacitor/filesystem";
import { Zip } from "capa-zip";
import { FileUtils } from "src/app/classes/utils/file-utils";
import { HelperUtils } from "src/app/classes/utils/helper-utils";
import { AppService } from "src/app/services/app/app.service";
import { ConnectIQService } from "src/app/services/connectiq/connect-iq.service";
import { List } from "src/app/services/lists/list";
import { ListitemModel } from "src/app/services/lists/listitem";
import type { ListsService } from "src/app/services/lists/lists.service";
import { LocalizationService } from "src/app/services/localization/localization.service";
import { Logger } from "src/app/services/logging/logger";
import { LoggingService } from "src/app/services/logging/logging.service";
import { EPrefProperty, PreferencesService } from "../../preferences.service";
import type { SqliteService } from "../../sqlite/sqlite.service";
import { ListModel } from "./../list-model";

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
            const files = await Filesystem.readdir({ path: FileUtils.JoinPaths(this._importPath, this._listsBaseDirectory) });
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
            const settings = await Filesystem.stat({ path: FileUtils.JoinPaths(this._importPath, this._settingsFile) });
            if (settings.type == "file" && settings.size > 0) {
                content.push("settings");
            }
        } catch {
            //no settings file...
        }

        return content;
    }

    public async ImportLists(listener: ProgressListener, sqlite: SqliteService, listsService: ListsService): Promise<ImportResult> {
        if (!this._importPath) {
            return { success: false };
        }

        this._running = true;
        let files = [];
        const basedir = FileUtils.JoinPaths(this._importPath, this._listsBaseDirectory, this._listsDirectory);
        try {
            files = (await Filesystem.readdir({ path: basedir })).files;
        } catch (e) {
            Logger.Error(`Importer: could not read lists directory '${basedir}' in '${Directory.Cache}':`, e);
            return { success: false };
        }

        listener.Init(files.length);

        // add the new Lists at the end
        const next_order = await listsService.BackendService.getNextListOrder();

        const ret: ImportResult = { success: true, imported: 0, failed: 0 };
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.endsWith(".json") && file.size > 0) {
                if (await this.importListFile(file, next_order, sqlite, listsService)) {
                    ret.imported!++;
                } else {
                    ret.failed!++;
                }
            } else {
                Logger.Debug(`Importer: skipping non-json list file '${file.uri}'`);
            }
            listener.oneDone();
        }

        return ret;
    }

    public async ImportTrash(listener: ProgressListener): Promise<ImportResult> {
        this._running = true;
        listener.Init(2);
        listener.oneDone();
        listener.oneDone();
        return { success: true, imported: 0, failed: 0 };
    }

    public async ImportSettings(listener: ProgressListener, services: ServicesList): Promise<ImportResult> {
        if (!this._importPath) {
            return { success: false };
        }

        this._running = true;

        const settingsPath = FileUtils.JoinPaths(this._importPath, this._settingsFile);
        let settingsFile = undefined;
        try {
            settingsFile = await Filesystem.readFile({ path: settingsPath, encoding: Encoding.UTF8 });
        } catch (e) {
            Logger.Error(`Importer: could not read settings file '${settingsPath}':`, e);
            return { success: false };
        }

        let json = undefined;
        try {
            json = JSON.parse(settingsFile.data.toString());
        } catch (e) {
            Logger.Error(`Importer: could not parse settings file '${settingsPath}':`, e);
            return { success: false };
        }

        let do_subscription = false;
        const subscription = services.preferences.onPrefChanged$.subscribe(async pref => {
            if (!do_subscription) {
                return;
            }
            if (pref.prop == EPrefProperty.GarminConnectIQ) {
                if (pref.value == true && !services.connectiq.Initialized) {
                    await services.connectiq.Initialize();
                } else if (pref.value == false && services.connectiq.Initialized) {
                    await services.connectiq.Shutdown();
                }
            } else if (pref.prop == EPrefProperty.AppLanguage) {
                await services.locale.ChangeLanguage(pref.value, false);
            } else if (pref.prop == EPrefProperty.LogMode) {
                services.logger.SetLogLevel(pref.value);
            } else if (pref.prop == EPrefProperty.LogsAutoDelete) {
                services.logger.SetAutodelete(pref.value);
            }
        });

        do_subscription = true;
        const imported = await services.preferences.Import(json, listener);
        subscription.unsubscribe();
        if (!imported) {
            Logger.Error(`Importer: could not import settings from file '${settingsPath}'`);
            return { success: false };
        }

        return { success: true, imported: Object.keys(json).length };
    }

    public async CleanUp() {
        this._running = false;
    }

    private async importListFile(file: FileInfo, order_offset: number, sqlite: SqliteService, listsService: ListsService): Promise<boolean> {
        let data = undefined;
        try {
            data = (
                await Filesystem.readFile({
                    path: file.uri,
                    encoding: Encoding.UTF8,
                })
            ).data.toString();
        } catch (e) {
            Logger.Error(`Importer: could not read file '${file.uri}':`, e);
            return false;
        }

        let json = undefined;
        try {
            json = JSON.parse(data) as ListModel;
        } catch (e) {
            Logger.Error(`Importer: could not parse file '${file.uri}':`, e);
            return false;
        }

        if (!json || !json.uuid || !json.name) {
            Logger.Error(`Importer: invalid list file '${file.uri}'`);
            return false;
        }

        let list_id = undefined;
        const res = await sqlite.Query("SELECT `id` FROM `lists` WHERE `legacy_uuid`=? LIMIT 1", [String(json.uuid)]);
        if (res && Array.isArray(res) && res.length > 0 && res[0].id) {
            list_id = Number(res[0].id);
        }

        if (!list_id || Number.isNaN(list_id)) {
            list_id = HelperUtils.RandomNegativNumber();
        }

        const items: ListitemModel[] = [];
        if (json.items?.length) {
            for (let i = 0; i < json.items.length; i++) {
                const model = json.items[i];
                let item_id = undefined;
                const res_item = await sqlite.Query("SELECT `id` FROM `listitems` WHERE `legacy_uuid`=? LIMIT 1", [String(model.uuid)]);
                if (res_item && Array.isArray(res_item) && res_item.length > 0 && res_item[0].id) {
                    item_id = Number(res_item[0].id);
                }
                if (!item_id || Number.isNaN(item_id)) {
                    item_id = HelperUtils.RandomNegativNumber();
                }
                items.push({
                    id: item_id,
                    item: model.item,
                    note: model.note,
                    list_id: list_id,
                    created: model.created,
                    modified: model.updated ?? Date.now(),
                    deleted: model.deleted,
                    order: model.order,
                    hidden: model.hidden ? 1 : undefined,
                    locked: model.locked ? 1 : undefined,
                    legacy_uuid: String(model.uuid),
                });
            }
        }

        const list = new List(
            {
                id: list_id,
                name: json.name,
                order: json.order + order_offset,
                created: json.created,
                modified: json.updated ?? Date.now(),
                deleted: json.deleted,
                sync_devices: undefined,
                legacy_uuid: String(json.uuid),
                reset: json.reset?.active === true ? 1 : json.reset?.active === false ? 0 : undefined,
                reset_day: json.reset?.day,
                reset_hour: json.reset?.hour,
                reset_minute: json.reset?.minute,
                reset_interval: json.reset?.interval,
                reset_weekday: json.reset?.weekday,
            },
            items,
            items.length,
            true,
        );

        const is_new = list.isVirtual;

        const store = await listsService.StoreList(list, true, true, false);
        if (store === true) {
            if (is_new) {
                Logger.Debug(`Importer: imported new list: ${list.toLog()} (legacy_uuid: ${list.LegacyUuid}) with ${list.Items.length} item(s)`);
            } else {
                Logger.Debug(`Importer: updated list: ${list.toLog()} (legacy_uuid: ${list.LegacyUuid}) with ${list.Items.length} item(s)`);
            }
            return true;
        }

        return store !== false;
    }
}

export type ServicesList = {
    preferences: PreferencesService;
    connectiq: ConnectIQService;
    locale: LocalizationService;
    logger: LoggingService;
};

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

export type ImportResult = {
    success: boolean;
    imported?: number;
    failed?: number;
};

export function ProgressListenerFactory(onProgressCallback: (progress: number) => void | Promise<void>): ProgressListener {
    return new (class extends ProgressListener {
        protected override async onProgress(done: number): Promise<void> {
            await onProgressCallback(done);
        }
    })();
}
