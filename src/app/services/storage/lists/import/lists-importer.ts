import { Directory, Encoding, type FileInfo, Filesystem } from "@capacitor/filesystem";
import { Zip } from "capa-zip";
import { FileUtils } from "src/app/classes/utils/file-utils";
import { StringUtils } from "src/app/classes/utils/string-utils";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { ConnectIQService } from "src/app/services/connectiq/connect-iq.service";
import type { ListitemModel } from "src/app/services/lists/listitem";
import type { ListsService } from "src/app/services/lists/lists.service";
import { LocalizationService } from "src/app/services/localization/localization.service";
import { Logger } from "src/app/services/logging/logger";
import { LoggingService } from "src/app/services/logging/logging.service";
import { environment } from "src/environments/environment";
import { EPrefProperty, PreferencesService } from "../../preferences.service";
import type { SqliteService } from "../../sqlite/sqlite.service";
import type { ListitemTrashModel } from "../listitem-trash-model";
import { ListModel } from "./../list-model";
import { ModelToList, ModelToListitem } from "./model-to";

export class ListsImporter {
    private _importRunning: boolean = false;
    private _analysingRunning: boolean = false;
    private _importPath?: string;
    private _archiveValid?: boolean;

    private readonly _settingsFile = "settings.json";
    private readonly _listsBaseDirectory = "lists";
    private readonly _listsDirectory = "lists";
    private readonly _trashDirectory = "trash";
    private readonly _trashItemsDirectory = "items";

    public get isImportRunning(): boolean {
        return this._importRunning;
    }

    public get isAnalysingRunning(): boolean {
        return this._analysingRunning;
    }

    public get isArchiveValid(): boolean | undefined {
        return this._archiveValid;
    }

    public async Initialize(archive: string): Promise<boolean> {
        let ret = true;
        this._archiveValid = undefined;

        if (await FileUtils.DirExists(archive)) {
            this._importPath = archive;
        } else if (archive.endsWith(".zip")) {
            MainToolbarComponent.ToggleProgressbar(true);
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
            MainToolbarComponent.ToggleProgressbar(false);
        }

        return ret;
    }

    public async Analyse(): Promise<string[]> {
        if (!this._importPath?.length || !(await FileUtils.FileExists(this._importPath))) {
            Logger.Debug(`Importer: Source directory not found at ${this._importPath}`);
            return [];
        }

        this._analysingRunning = true;
        this._archiveValid = false;

        MainToolbarComponent.ToggleProgressbar(true);

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

        this._analysingRunning = false;
        this._archiveValid = content.length > 0;
        MainToolbarComponent.ToggleProgressbar(false);

        return content;
    }

    public async ImportLists(listener: ProgressListener, sqlite: SqliteService, listsService: ListsService): Promise<boolean> {
        if (!this._importPath) {
            return false;
        }

        this._importRunning = true;
        let files = [];
        const basedir = FileUtils.JoinPaths(this._importPath, this._listsBaseDirectory, this._listsDirectory);
        try {
            files = (await Filesystem.readdir({ path: basedir })).files;
        } catch (e) {
            Logger.Error(`Importer: could not read lists directory '${basedir}' in '${Directory.Cache}':`, e);
            return false;
        }

        const all_files = files.length;
        files = files.filter(f => f.type == "file" && f.name.endsWith(".json") && f.size > 0);
        if (all_files > files.length) {
            Logger.Debug(`Importer: skipping ${all_files - files.length} invalid entries in '${basedir}' while importing lists.`);
        }

        listener.Init(files.length);

        // add the new Lists at the end
        const next_order = await listsService.BackendService.getNextListOrder();

        for (let i = 0; i < files.length; i++) {
            if (await this.importListFile({ file: files[i], order_offset: next_order, is_trash: false }, sqlite, listsService)) {
                listener.oneSuccess();
            } else {
                listener.oneFailed();
            }
            listener.oneDone();
        }

        return true;
    }

    public async ImportTrash(listener: ProgressListener, sqlite: SqliteService, listsService: ListsService): Promise<boolean> {
        if (!this._importPath) {
            return false;
        }

        this._importRunning = true;

        const trash_path = FileUtils.JoinPaths(this._importPath, this._listsBaseDirectory, this._trashDirectory);

        let trash_lists: FileInfo[] = [];
        let trash_items: FileInfo[] = [];
        let files = [];
        try {
            files = (await Filesystem.readdir({ path: trash_path })).files;
        } catch (e) {
            Logger.Error(`Importer: could not read trash directory at '${trash_path}': `, e);
            return false;
        }

        let ignore_lists = 0;
        let ignore_items = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type == "file" && file.name.endsWith(".json") && file.size > 0) {
                trash_lists.push(file);
            } else if (file.type == "directory" && file.name == this._trashItemsDirectory) {
                let item_files: FileInfo[] = [];
                try {
                    item_files = (await Filesystem.readdir({ path: file.uri })).files;
                } catch (e) {
                    Logger.Error(`Importer: could not read trash items directory at '${file.uri}': `, e);
                }
                trash_items = item_files.filter(f => f.type == "file" && f.name.endsWith(".json") && f.size > 0);
                ignore_items = item_files.length - trash_items.length;
            } else {
                ignore_lists++;
            }
        }

        listener.Init(trash_lists.length + trash_items.length);

        if (ignore_lists > 0) {
            Logger.Debug(`Importer: ignoring ${ignore_lists} invalid entries in '${trash_path}' while importing lists trash.`);
        }
        for (let i = 0; i < trash_lists.length; i++) {
            if (await this.importListFile({ file: trash_lists[i], order_offset: 0, is_trash: true }, sqlite, listsService)) {
                listener.oneSuccess();
            } else {
                listener.oneFailed();
            }

            listener.oneDone();
        }

        if (ignore_items > 0) {
            Logger.Debug(`Importer: ignoring ${ignore_items} invalid entries in '${FileUtils.JoinPaths(trash_path, this._trashItemsDirectory)}' while importing listitems trash.`);
        }

        for (let i = 0; i < trash_items.length; i++) {
            const imported = await this.importListitemTrashFile({ file: trash_items[i] }, sqlite, listsService);
            if (imported) {
                listener.oneSuccess(imported);
            } else {
                listener.oneFailed();
            }
            listener.oneDone();
        }

        return true;
    }

    public async ImportSettings(listener: ProgressListener, services: ServicesList): Promise<boolean> {
        if (!this._importPath) {
            return false;
        }

        this._importRunning = true;

        const settingsPath = FileUtils.JoinPaths(this._importPath, this._settingsFile);
        let settingsFile = undefined;
        try {
            settingsFile = await Filesystem.readFile({ path: settingsPath, encoding: Encoding.UTF8 });
        } catch (e) {
            Logger.Error(`Importer: could not read settings file '${settingsPath}':`, e);
            return false;
        }

        let json = undefined;
        try {
            json = JSON.parse(settingsFile.data.toString());
        } catch (e) {
            Logger.Error(`Importer: could not parse settings file '${settingsPath}':`, e);
            return false;
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
            return false;
        }

        return true;
    }

    public async CleanUp() {
        this._importRunning = false;

        if (this._importPath && environment.production) {
            try {
                await Filesystem.rmdir({ path: this._importPath, recursive: true });
            } catch (e) {
                Logger.Error(`Importer: could not clean up import directory at '${this._importPath}': `, e);
            }
        }
    }

    private async importListFile(args: { file: FileInfo; order_offset: number; is_trash: boolean }, sqlite: SqliteService, listsService: ListsService): Promise<boolean> {
        const json = await this.getFileJson<ListModel>(args.file);

        if (!json) {
            Logger.Error(`Importer: could not read JSON from file '${args.file.uri}'`);
            return false;
        }

        try {
            const list = await ModelToList(json, sqlite, listsService, args.file.uri, args.is_trash);
            if (list) {
                list.Order += args.order_offset;
                const is_new = list.isVirtual;

                const store = await listsService.StoreList(list, true, true, false);
                if (store === true) {
                    if (is_new) {
                        Logger.Debug(`Importer: imported new list: ${list.toLog()} (legacy_uuid: ${list.LegacyUuid}) with ${list.Items.length} item(s)` + (args.is_trash ? " in trash" : ""));
                    } else {
                        Logger.Debug(`Importer: updated list: ${list.toLog()} (legacy_uuid: ${list.LegacyUuid}) with ${list.Items.length} item(s)` + (args.is_trash ? " in trash" : ""));
                    }
                    return true;
                }

                return store !== false;
            } else {
                Logger.Error(`Importer: invalid json of list in file '${args.file.uri}'`);
            }
        } catch (e) {
            Logger.Debug(`Importer: unknown rev ${json.rev} of list file '${args.file.uri}'`, e);
        }

        return false;
    }

    private async importListitemTrashFile(args: { file: FileInfo }, sqlite: SqliteService, ListsService: ListsService): Promise<false | number> {
        const json = await this.getFileJson<ListitemTrashModel>(args.file);
        if (!json || (!json.uuid && !json.id)) {
            Logger.Error(`Importer: invalid listitems trash file '${args.file.uri}'`);
            return false;
        }

        if (json.items) {
            const items: ListitemModel[] = [];

            let list_id = -1;
            if (json.id) {
                list_id = json.id;
            } else if (json.uuid) {
                const res = await sqlite.Query("SELECT `id` FROM `lists` WHERE `legacy_uuid` = ? LIMIT 1", [String(json.uuid)]);
                if (!res || !Array.isArray(res) || res.length <= 0 || !res[0].id) {
                    Logger.Error(`Importer: could not import listitem trash for legacy_uuid '${json.uuid}' - no list found`);
                    return false;
                }
                list_id = Number(res[0].id);
            } else {
                Logger.Error(`Importer: could not import listitem trash - no corresponding list found for '${json.id ? "id: " + json.id : "legacy_uuid: " + json.uuid}'`);
                return false;
            }

            for (let i = 0; i < json.items.length; i++) {
                let item: ListitemModel | undefined;
                try {
                    item = await ModelToListitem(json.items[i], list_id, sqlite, ListsService, true);
                } catch (e) {
                    Logger.Error(`Importer: could not import listitem 'id: ${json.items[i].id}' ('legacy_uuid: ${json.items[i].uuid})': `, e);
                    continue;
                }
                if (item) {
                    //check if this listitem is already in trash...
                    if (item.id < 0) {
                        //insert new listitem
                        const res3 = await sqlite.Execute("INSERT INTO `listitems` (`list_id`,`item`, `note`, `order`,`hidden`, `locked`, `created`, `modified`,`deleted`,`legacy_uuid`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
                            list_id,
                            item.item,
                            item.note ?? null,
                            item.order,
                            item.hidden ? "1" : "0",
                            item.locked ? "1" : "0",
                            item.created,
                            item.modified,
                            item.deleted ?? Date.now(),
                            item.legacy_uuid,
                        ]);
                        if (res3?.changes?.lastId && res3.changes.lastId > 0) {
                            Logger.Debug(`Importer: added new listitem '${StringUtils.shorten(item.item, 30)}' with '${item.id ? "id: " + item.id : "legacy_uuid: " + item.legacy_uuid}' to trash (id: ${res3.changes.lastId})`);
                        } else {
                            Logger.Error(`Importer: could not add new listitem '${StringUtils.shorten(item.item, 30)}' with '${item.id ? "id: " + item.id : "legacy_uuid: " + item.legacy_uuid}' to trash`);
                            return false;
                        }
                    } else {
                        //update listitem
                        const res3 = await sqlite.Execute(
                            `UPDATE
                            \`listitems\`
                        SET
                            \`list_id\` = ?,
                            \`item\` = ?,
                            \`note\` = ?,
                            \`order\` = ?,
                            \`hidden\` = ?,
                            \`locked\` = ?,
                            \`created\` = ?,
                            \`modified\` = ?,
                            \`deleted\` = ?,
                            \`legacy_uuid\` = ?
                        WHERE
                            \`id\` = ?`,
                            [list_id, item.item, item.note ?? null, item.order, item.hidden ? "1" : "0", item.locked ? "1" : "0", item.created, item.modified, item.deleted, String(item.legacy_uuid), item.id],
                        );
                        if (res3?.changes) {
                            Logger.Debug(`Importer: updated listitem '${StringUtils.shorten(item.item, 30)}' with '${item.id > 0 ? "id: " + item.id : "legacy_uuid: " + item.legacy_uuid}' in trash (id: ${item.id})`);
                        } else {
                            Logger.Error(`Importer: could not update listitem '${StringUtils.shorten(item.item, 30)}' with '${item.id > 0 ? "id: " + item.id : "legacy_uuid: " + item.legacy_uuid}' in trash (id: ${item.id})`);
                            return false;
                        }
                    }
                }
            }

            return json.items.length;
        }

        return 0;
    }

    private async getFileJson<T>(file: FileInfo): Promise<T | undefined> {
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
            return undefined;
        }

        let json = undefined;
        try {
            json = JSON.parse(data) as T;
        } catch (e) {
            Logger.Error(`Importer: could not parse file '${file.uri}':`, e);
            return undefined;
        }

        if (!json) {
            Logger.Error(`Importer: invalid import file '${file.uri}'`);
            return undefined;
        }

        return json;
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

    public oneDone() {
        this._done++;
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

    protected abstract onProgress(done: number): Promise<void>;
}

export function ProgressListenerFactory(onProgressCallback: (progress: number) => void | Promise<void>): ProgressListener {
    return new (class extends ProgressListener {
        protected override async onProgress(done: number): Promise<void> {
            await onProgressCallback(done);
        }
    })();
}
