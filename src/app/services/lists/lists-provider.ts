import { ListsBackendService } from "../storage/lists/lists-backend.service";
import { List } from "./list";

export class ListsProvider {
    protected StoragePath = "lists";

    public constructor(protected readonly Backend: ListsBackendService) {}

    /**
     * read all lists from storage
     * @returns array of all lists
     */
    public async GetLists(peek: boolean): Promise<List[]> {
        const models = await this.Backend.GetLists(this.StoragePath);
        let lists: List[] = [];
        for (let i = 0; i < models.length; i++) {
            const list = List.fromBackend(models[i], peek);
            if (list) {
                lists.push(list);
            }
        }

        return lists;
    }

    /**
     * gets a specific list with all items
     * @param uuid unique id of the list
     * @returns List object, if it was found, otherwise undefined
     */
    public async GetList(uuid: string | number): Promise<List | undefined> {
        const model = await this.Backend.GetList(`${uuid}`, this.StoragePath);
        if (model) {
            return List.fromBackend(model, false);
        }
        return undefined;
    }

    /**
     * stores a list in backend if there are any changes
     * @param list list to be stored
     * @param force store the list, even if there are no changes
     * @returns storage successful, undefined if no store was needed
     */
    public async StoreList(list: List, force: boolean = false): Promise<boolean | undefined> {
        if (list.isPeek) {
            const old = await this.GetList(list.Uuid);
            list.copyDetails(old);
        }

        const model = list.toBackend(force);
        if (model) {
            return await this.Backend.StoreList(model, this.StoragePath);
        }
        return undefined;
    }

    /**
     * removes a list from storage
     * @param list list to be removed
     * @returns was the removal successful
     */
    public async RemoveList(list: List): Promise<boolean> {
        return (await this.Backend.RemoveLists(`${list.Uuid}`, this.StoragePath)) > 0;
    }

    /**
     * checks if a list with this Uuid exists
     * @param uuid Uuid to check
     * @returns does a list with this Uuid exist
     */
    public async Exists(uuid: string | number): Promise<boolean> {
        return this.Backend.ListExists(uuid, this.StoragePath);
    }

    /**
     * returns the number of lists
     * @returns number of lists
     */
    public async Count(): Promise<number> {
        return this.Backend.CountFiles(this.StoragePath);
    }

    /**
     * returns the total size of all files in the backend
     * @returns size in bytes and number of entries
     */
    public async BackendSize(): Promise<{ size: number; files: number }> {
        return this.Backend.GetSize(this.StoragePath);
    }
}
