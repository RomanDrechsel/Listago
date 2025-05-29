import { Directory, type FileInfo, Filesystem } from "@capacitor/filesystem";
import { ModalController } from "@ionic/angular/standalone";
import { FileUtils } from "src/app/classes/utils/file-utils";
import { LegacyBackendImportComponent } from "src/app/components/legacy-backend-import/legacy-backend-import.component";
import { Logger } from "../../../logging/logger";
import { MainSqliteBackendService } from "../main-sqlite-backend.service";
import { FileBackendListModel } from "./file-backend-list-model";
import { FileBackendSqliteBackend } from "./file-backend-sqlite-backend";
import { FileBackendTrashListModel } from "./file-backend-trash-list-model";

export class FileBackendConverter {
    private readonly StorageDirectory: Directory = Directory.Data;
    private readonly StorageRoot: string = "lists";

    private _modalComponent?: LegacyBackendImportComponent;

    private _backend?: FileBackendSqliteBackend;

    constructor(private _sqliteService: MainSqliteBackendService, private _modalCtrl: ModalController) {}

    /**
     * check if a legacy backend exists in storage and try to transfer it into the new sqlite backend
     */
    public async CheckLegacyBackend(done?: () => Promise<void>): Promise<void> {
        let directories: FileInfo[] = [];
        try {
            directories = (await Filesystem.readdir({ path: this.StorageRoot, directory: this.StorageDirectory })).files;
        } catch {
            Logger.Debug("No legacy backend found.");
            return;
        }

        Logger.Important(`Found legacy backend with ${directories.length} directories`);
        const modal = await this._modalCtrl.create({
            component: LegacyBackendImportComponent,
            componentProps: {
                onReady: (instance: LegacyBackendImportComponent) => {
                    this._modalComponent = instance;
                },
            },
            focusTrap: true,
            canDismiss: true,
            keyboardClose: false,
        });
        modal.present();

        const filesCount = await this.calcFiles(directories);
        if (filesCount == 0) {
            Logger.Important(`Found no files in legacy backend`);
            modal.dismiss();
            try {
                await this.deleteDirectory((await Filesystem.getUri({ path: this.StorageRoot, directory: this.StorageDirectory })).uri);
            } catch (e) {
                Logger.Error("Error deleting legacy backend directory:", e);
            }
            return;
        }

        this.updateModal(0, filesCount);

        this._backend = new FileBackendSqliteBackend(this._sqliteService);

        const result = { lists: 0, items: 0, errors: 0 };
        const listsdir = directories.find(d => d.name === "lists" && d.type === "directory");
        if (listsdir) {
            const res = await this.convertLists(listsdir);
            result.lists += res.lists;
            result.items += res.items;
            result.errors += res.errors;
        }
        const trashdir = directories.find(d => d.name === "trash" && d.type === "directory");
        if (trashdir) {
            const res = await this.convertTrash(trashdir);
            result.lists += res.lists;
            result.items += res.items;
            result.errors += res.errors;
        }

        Logger.Important(`Legacy backend convert done: ${result.lists} list(s) with ${result.items} item(s) imported. ${result.errors} errors occured.`);
        await this.deleteDirectory((await Filesystem.getUri({ path: this.StorageRoot, directory: this.StorageDirectory })).uri);

        if (done) {
            await done();
        }

        await modal.dismiss();
    }

    /**
     * read all list files from legacy backend and transfer them into sqlite backend
     * @param directory directory to scan
     * @returns number of converted lists, items and errors
     */
    private async convertLists(directory: FileInfo): Promise<{ lists: number; items: number; errors: number }> {
        const result = await Filesystem.readdir({ path: directory.uri });
        const files = result.files.filter(f => f.type === "file" && f.name.endsWith(".json"));
        const ret = { lists: 0, items: 0, errors: 0 };
        Logger.Debug(`Found ${files.length} lists in legacy backend`);
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const model = await this.getFileContent<FileBackendListModel>(file);
            if (model) {
                const res = await this._backend!.storeList(model);
                if (res.success) {
                    ret.lists++;
                    ret.items = res.items;
                } else {
                    ret.errors++;
                }
            } else {
                Logger.Error(`Could not convert legacy list at '${file.uri}' to new backend, no valid json`);
                ret.errors++;
            }
            await this.deleteFile(file.uri);
            this.updateModal();
        }
        await this.deleteDirectory(directory.uri);
        return ret;
    }

    /**
     * reads the trash directory of the legacy backend and transfer them into sqlite backend
     * @param directory directory to scan
     * @returns number of converted lists, items and errors
     */
    private async convertTrash(directory: FileInfo): Promise<{ lists: number; items: number; errors: number }> {
        const result = await Filesystem.readdir({ path: directory.uri });
        const itemtrash = result.files.find(f => f.name === "items" && f.type == "directory");
        const files = result.files.filter(f => f.type === "file" && f.name.endsWith(".json"));
        Logger.Debug(`Found ${files.length} trash lists in legacy backend`);

        const ret = { lists: 0, items: 0, errors: 0 };

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const model = await this.getFileContent<FileBackendListModel>(file);
            if (model) {
                const res = await this._backend!.storeList(model);
                if (res.success) {
                    ret.lists++;
                    ret.items += res.items;
                } else {
                    ret.errors++;
                }
            } else {
                Logger.Error(`Could not convert legacy list at '${file.uri}' to new backend, no valid json`);
                ret.errors++;
            }
            await this.deleteFile(file.uri);
            this.updateModal();
        }

        if (itemtrash) {
            const res = await this.convertItemsTrash(itemtrash);
            ret.items += res.items;
            ret.errors += res.errors;
        }

        return ret;
    }

    /**
     * converts the items in the trash of a legacy list to new backend
     * @param directory directory to scan
     * @returns number of converted items and errors
     */
    public async convertItemsTrash(directory: FileInfo): Promise<{ items: number; errors: number }> {
        const result = await Filesystem.readdir({ path: directory.uri });
        const files = result.files.filter(f => f.type == "file" && f.name.endsWith(".json"));
        Logger.Debug(`Found trash items for ${files.length} lists in legacy backend`);

        const ret = { items: 0, errors: 0 };

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const model = await this.getFileContent<FileBackendTrashListModel>(file);
            if (model) {
                const list_id = await this._backend!.LegacyUuidToId({ legacy_uuid: model.uuid, type: "list" });
                if (list_id) {
                    for (let j = 0; j < model.items.length; j++) {
                        if (await this._backend!.storeListitem(model.items[j], list_id, undefined)) {
                            ret.items++;
                        } else {
                            ret.errors++;
                        }
                    }
                } else if (list_id === undefined) {
                    Logger.Error(`Could not find list with legacy uuid '${model.uuid}' in backend, skip importing trash items from '${file.uri}'`);
                    ret.errors++;
                }
            } else {
                Logger.Error(`Could not convert legacy trash items at '${file.uri}' to new backend, no valid json`);
                ret.errors++;
            }
            await this.deleteFile(file.uri);
            this.updateModal();
        }

        return ret;
    }

    /**
     * calculates the total number of files in the legacy backend directories
     * @param directories legacy backend directories
     * @returns total number of files
     */
    private async calcFiles(directories: FileInfo[]): Promise<number> {
        let count = 0;

        for (let i = 0; i < directories.length; i++) {
            const directory = directories[i];
            if (directory.type === "directory") {
                if (["lists", "trash"].indexOf(directory.name) >= 0) {
                    count += await this.recursiveFilesCount(directory.uri);
                }
            }
        }

        Logger.Important(`Found ${count} files in legacy backend.`);

        return count;
    }

    /**
     * recursivly counts the number of files in a directory and its subdirectories.
     * @param directory directory to count files in.
     * @returns number of files
     */
    private async recursiveFilesCount(directory: string): Promise<number> {
        let count = 0;
        let unknown = 0;

        try {
            const files = (await Filesystem.readdir({ path: directory })).files;

            for (let i = 0; i < files.length; i++) {
                if (files[i].type === "file") {
                    if (files[i].name.endsWith(".json")) {
                        count++;
                    } else {
                        unknown++;
                    }
                } else {
                    count += await this.recursiveFilesCount(files[i].uri);
                }
            }
        } catch (e) {
            Logger.Error(`Could not read recursivly from directory ${directory}: `, e);
        }

        if (unknown > 0) {
            Logger.Error(`Found ${unknown} unknown files in legacy backend.`);
        }

        return count;
    }

    /**
     * update the progress bar in the modal component
     * @param done legacy items done
     * @param total total number of legacy items
     */
    private async updateModal(done?: number, total: number | undefined = undefined) {
        if (this._modalComponent) {
            if (!done && !total) {
                this._modalComponent.ItemDone++;
            } else {
                if (done) {
                    this._modalComponent.ItemDone = done;
                }
                if (total) {
                    this._modalComponent.ItemCount = total;
                }
            }
        }
    }

    /**
     * reads the content of a file as string
     * @param fileinfo file to read
     * @returns content as string
     */
    private async getFileContent<T>(fileinfo: FileInfo): Promise<T | undefined> {
        const file = new FileUtils.File(fileinfo.uri, fileinfo.size, fileinfo.ctime, fileinfo.mtime);
        await file.ReadContent();
        if (file.Content) {
            try {
                return JSON.parse(file.Content) as T;
            } catch (e) {
                Logger.Error(`Error parsing JSON content of file ${fileinfo.uri}:`, e);
            }
        } else {
            Logger.Error(`Could not read content of file ${fileinfo.uri}`);
        }
        return undefined;
    }

    private async deleteFile(file: string): Promise<void> {
        await Filesystem.deleteFile({ path: file });
        Logger.Debug(`Delete legacy file '${file}'`);
    }

    /**
     * remove the legacy backend in total
     */
    private async deleteDirectory(dir: string): Promise<void> {
        await Filesystem.rmdir({ path: dir, recursive: true });
        Logger.Important(`Deleted legacy directory '${dir}'`);
    }
}
