import { ListitemModel } from "./listitem";

export namespace ListitemTrashUtils {
    /**
     * deletes a certain item from the trash
     * @param trash trash of listitems
     * @param items item(s) to delete
     * @returns ListitemTrashModal without the listitem(s)
     */
    export function RemoveItem(trash: ListitemTrashModel, items: ListitemModel | ListitemModel[]): ListitemTrashModel {
        if (!Array.isArray(items)) {
            items = [items];
        }

        const uuids = items.map(i => i.uuid);
        trash.items = trash.items.filter(i => uuids.indexOf(i.uuid) < 0);
        return trash;
    }

    /**
     * adds one or more items to the trash
     * @param trash trash of listitems
     * @param items item(s) to add
     * @returns trash of listitems
     */
    export function AddItems(trash: ListitemTrashModel, items: ListitemModel[]): ListitemTrashModel {
        trash.items = trash.items.concat(items);
        return trash;
    }

    /**
     * removes the oldest items in the trash
     * @param trash trash of listitems
     * @param count number of items to remove
     * @returns trash of listitems
     */
    export function RemoveOldestCount(trash: ListitemTrashModel, count: number = 1): ListitemTrashModel {
        trash = SortItems(trash);
        trash.items = trash.items.slice(0, count);
        return trash;
    }

    /**
     * removes items, that are older than a certain timestamp
     * @param trash trash of listitems
     * @param timestamp UNIX Timestamp in milliseconds
     * @returns trash of listitems
     */
    export function RemoveOlderThan(trash: ListitemTrashModel, timestamp: number): ListitemTrashModel {
        trash.items = trash.items.filter(i => i.deleted != undefined && i.deleted > timestamp);
        return trash;
    }

    /**
     * sort the listitems by date of deletion, most recent first
     * @param trash trash of listitems
     * @returns trash of listitems with sorted listitems
     */
    export function SortItems(trash: ListitemTrashModel): ListitemTrashModel {
        trash.items = trash.items.sort((a, b) => {
            return (b.deleted ?? 0) - (a.deleted ?? 0);
        });
        return trash;
    }

    /**
     * returns a string representation of the trash object for the log
     * @param trash object to be represented
     * @returns string representation of the object
     */
    export function toLog(trash: ListitemTrashModel | ListitemModel): string {
        return `uuid:${trash.uuid}`;
    }
}

export declare type ListitemTrashModel = {
    uuid: string | number;
    items: ListitemModel[];
};
