import { BehaviorSubject } from "rxjs";
import { Logger } from "../logging/logger";
import { ListsBackendService } from "../storage/lists/lists-backend.service";
import { List } from "./list";
import { ListitemsTrashProvider } from "./listitems-trash-provider";
import { ListsProvider } from "./lists-provider";

export class TrashProvider extends ListsProvider {
    protected override StoragePath = "trash";
    private _maxEntryCount: number = -1;

    public constructor(backend: ListsBackendService, private ListitemsTrash: ListitemsTrashProvider, private _datasetChangedSubject: BehaviorSubject<List[] | undefined>) {
        super(backend);
    }

    /**
     * keep a maximum number of lists in trash
     */
    public set MaxEntryCount(value: number | undefined) {
        if (!value) {
            value = -1;
        }
        if (this._maxEntryCount != value) {
            this._maxEntryCount = value;
            this.limitEntryCount(value);
        }
    }

    /**
     * remove all lists from trash, that are older than a certain number of seconds
     * @param seconds maximum age of the files in seconds
     */
    public async RemoveOldEntries(days: number): Promise<void> {
        const oldlists = await this.Backend.GetOldEntries(days * 60 * 60 * 24, this.StoragePath);
        if (oldlists.length > 0) {
            const removed = await this.Backend.RemoveLists(oldlists, this.StoragePath);
            if (removed > 0) {
                //remove old listitems trashes from Backend
                await this.ListitemsTrash.EraseLists(oldlists);
                Logger.Notice(`Removed ${removed} old lists from trash, as if they are older than ${days} days`);
                this._datasetChangedSubject.next(await this.GetLists(true));
            }
        }
    }

    /**
     * erase a list from trash and also all listitems in trash
     * @param uuids list or array of lists to be removed
     * @returns how many lists where deleted?
     */
    public async EraseLists(uuids: string | number | (string | number)[], erase_itemtrash: boolean = true): Promise<number> {
        if (!Array.isArray(uuids)) {
            uuids = [`${uuids}`];
        }
        const del_uuids = uuids.map(uuid => `${uuid}`);

        const del = await this.Backend.RemoveLists(del_uuids, this.StoragePath);
        if (erase_itemtrash) {
            await this.ListitemsTrash.EraseLists(del_uuids);
        }
        this._datasetChangedSubject.next(await this.GetLists(true));
        return del;
    }

    /**
     * wipes all lists from trash
     * @returns number of deleted lists
     */
    public async WipeTrash(): Promise<number> {
        const lists = await this.Backend.GetLists(this.StoragePath);
        await this.Backend.WipeAll(this.StoragePath);
        await this.ListitemsTrash.EraseLists(lists.map(l => `${l.uuid}`));
        this._datasetChangedSubject.next(await this.GetLists(true));
        return lists.length;
    }

    /**
     * removes the oldes entries in trash due to a certain number
     * @param maxcount maximum number of lists in trash
     */
    private async limitEntryCount(maxcount: number): Promise<void> {
        if (maxcount > 0) {
            let alllists = await this.Backend.GetLists(this.StoragePath);
            if (alllists.length > maxcount) {
                alllists = alllists.sort((a, b) => {
                    if (!a.deleted) {
                        a.deleted = 0;
                    }
                    if (!b.deleted) {
                        b.deleted = 0;
                    }
                    return b.deleted - a.deleted;
                });
                const uuids = alllists.splice(maxcount).map(l => `${l.uuid}`);
                const del = await this.Backend.RemoveLists(uuids, this.StoragePath);
                await this.ListitemsTrash.EraseLists(uuids);
                if (del == uuids.length) {
                    Logger.Notice(`Removed ${del} old lists from trash due to the limit of ${maxcount} lists`);
                    this._datasetChangedSubject.next(await this.GetLists(true));
                } else if (del > 0) {
                    Logger.Error(`Removed ${del} old lists from trash due to the limit of ${maxcount} lists, but ${uuids.length - del} list(s) could not be removed`);
                    this._datasetChangedSubject.next(await this.GetLists(true));
                } else {
                    Logger.Error(`Could not remove ${uuids.length} list(s) from trash due to the limit of ${maxcount} lists`, uuids);
                }
            }
        }
    }
}
