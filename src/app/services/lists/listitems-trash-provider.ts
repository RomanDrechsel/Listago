import { BehaviorSubject } from "rxjs";
import { Logger } from "../logging/logger";
import { ListsBackendService } from "../storage/lists/lists-backend.service";
import { Listitem, ListitemModel } from "./listitem";
import { ListitemTrashModel, ListitemTrashUtils } from "./listitems-trash-utils";

export class ListitemsTrashProvider {
    private readonly StoragePath = "trash/items";

    private _maxEntryCount: number = -1;

    public constructor(private readonly Backend: ListsBackendService, private readonly _datasetChangedSubject: BehaviorSubject<ListitemTrashModel | undefined>) {}

    /**
     * keep a maximum number of listitems in every list trash
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
     * stores one or more listitems in the trash of the list
     * @param listUuid Unique identifier of the list
     * @param items listitem or array of listitems
     * @returns was the storage successful?
     */
    public async StoreListitem(listUuid: string | number, items: Listitem | Listitem[]): Promise<boolean> {
        if (!Array.isArray(items)) {
            items = [items];
        }

        const trash = (await this.Backend.GetListitemTrash(`${listUuid}`, this.StoragePath)) ?? { uuid: listUuid, items: [] };
        items.forEach(i => {
            i.Deleted = Date.now();
            trash.items.push(i.toBackend());
        });

        if (this._maxEntryCount > 0 && trash.items.length > this._maxEntryCount) {
            ListitemTrashUtils.SortItems(trash);
            trash.items = trash.items.slice(this._maxEntryCount);
        }

        return this.Store(trash);
    }

    /**
     * returns the listitem trash of a list
     * @param uuid unique identifier of the list
     * @returns ListitemTrashModel
     */
    public GetListitemsTrash(uuid: string | number): Promise<ListitemTrashModel | undefined> {
        return this.Backend.GetListitemTrash(`${uuid}`, this.StoragePath);
    }

    /**
     * erases a listitem from trash
     * @param trash list trash, the item should be erased
     * @param items model(s) of the listitem(s) to remove
     * @returns was the erase successful
     */
    public async EraseListitem(trash: ListitemTrashModel, items: ListitemModel | ListitemModel[]): Promise<boolean> {
        const before = trash.items.length;
        const success = ListitemTrashUtils.RemoveItem(trash, items);
        if (success.items.length < before) {
            if (await this.Store(trash)) {
                Logger.Debug(`Removed listitem ${items} from trash of list ${ListitemTrashUtils.toLog(trash)}`);
                return true;
            }
        }
        return false;
    }

    /**
     * erases all listitems in trash of a list
     * @param list list, to erase the listitems in trash
     * @returns was the deletion successful? undefined if there was no trash for this list
     */
    public async EraseListitemTrash(trash: ListitemTrashModel): Promise<boolean> {
        const success = await this.Backend.RemoveAllListitems(trash, this.StoragePath);
        if (success === true) {
            trash.items = [];
            this._datasetChangedSubject.next(trash);
        }
        return success !== false;
    }

    public async EraseLists(uuids: string | string[]): Promise<number> {
        return this.Backend.RemoveLists(uuids, this.StoragePath);
    }

    /**
     * wipe all trashes of all lists
     */
    public async WipeTrashes(): Promise<void> {
        const del = await this.Backend.WipeAll(this.StoragePath);
        if (del > 0) {
            this._datasetChangedSubject.next(undefined);
            Logger.Notice(`Removed ${del} trash(s) of listitems`);
        }
    }

    /**
     * returns the number of listitems in the trash of a list
     * @param uuid Unique identifier of the list
     * @returns number of items in the trash
     */
    public async Count(uuid: string): Promise<number> {
        const trash = await this.Backend.GetListitemTrash(uuid, this.StoragePath);
        if (trash) {
            return trash.items.length;
        } else {
            return 0;
        }
    }

    /**
     * returns the number of trashes in the backend
     * @returns number of trashes
     */
    public async CountAll(): Promise<number> {
        return this.Backend.CountFiles(this.StoragePath);
    }

    /**
     * returns the total size of all files in the backend
     * @returns size in bytes and number of entries
     */
    public async BackendSize(): Promise<{ size: number; files: number }> {
        return this.Backend.GetSize(this.StoragePath);
    }

    /**
     * stores trash of listitems for a list in backend or removes it, if there are no more items in it
     * @param trash listitem trash object
     * @returns was the storage/removal successful?
     */
    private async Store(trash: ListitemTrashModel): Promise<boolean> {
        let success = false;

        if (trash.items.length > 0) {
            //store in backend
            success = await this.Backend.StoreListitemTrash(trash, this.StoragePath);
        } else {
            //no more items in trash, remove the file
            success = (await this.Backend.RemoveAllListitems(trash, this.StoragePath)) !== false;
        }
        if (success) {
            this._datasetChangedSubject.next(trash);
        }

        return success;
    }

    /**
     * limit the number of listitems in every list trash
     * @param maxcount maximum number of entries in every trash
     * @param trashes listitem trash or array of listitem trashes
     */
    private async limitEntryCount(maxcount: number, trashes?: ListitemTrashModel | ListitemTrashModel[]): Promise<void> {
        if (!trashes) {
            trashes = await this.Backend.GetListitemsTrashes(this.StoragePath);
        } else if (!Array.isArray(trashes)) {
            trashes = [trashes];
        }
        for (let i = 0; i < trashes.length; i++) {
            const trash = trashes[i];
            if (trash.items.length > maxcount) {
                const before = trash.items.length;
                ListitemTrashUtils.SortItems(trash);
                trash.items = trash.items.slice(maxcount);
                if (await this.Store(trash)) {
                    Logger.Debug(`Removed ${before - trash.items.length} listitem(s) from trash of list ${ListitemTrashUtils.toLog(trash)}`);
                }
            }
        }
    }
}
