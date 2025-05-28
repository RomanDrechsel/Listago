import { Logger } from "../logging/logger";
import { Listitem, ListitemModel } from "./listitem";

export class List {
    private _uuid: string | number;
    private _name: string;
    private _created: number;
    private _updated: number;
    private _order: number;
    private _reset?: ListReset;
    private _itemsCount?: number;
    private _items?: Listitem[];
    private _deleted?: number;
    private _sync: boolean = false;
    private _dirty: boolean = false;

    private static readonly ListRevision = 1;

    public constructor(obj: ListModel, itemcount?: number) {
        this._uuid = obj.uuid;
        this._name = obj.name;
        this._order = obj.order;
        this._created = obj.created;
        this._updated = obj.updated ?? Date.now();
        this._items = undefined;
        if (obj.items) {
            let items: Listitem[] = [];
            obj.items.forEach((el: ListitemModel) => {
                const i = Listitem.fromBackend(el);
                if (i) {
                    items.push(i);
                }
            });
            this._items = items;
        }
        this._itemsCount = this._items?.length ?? itemcount;
        this._reset = obj.reset;
        this._deleted = obj.deleted;
        this._sync = obj.sync ?? false;
        this._dirty = true;
    }

    /**
     * get unique list id
     * in newer versions, the uuid is a number
     * in older versions it was a string
     */
    public get Uuid(): string | number {
        return this._uuid;
    }

    /**
     * set the unique list id
     * @param uuid unique list id
     */
    public set Uuid(uuid: string | number) {
        this._uuid = uuid;
    }

    /** set list title */
    public set Name(name: string) {
        if (this._name != name) {
            this._name = name;
            this._dirty = true;
            this._updated = Date.now();
        }
    }

    /** get list title */
    public get Name(): string {
        return this._name;
    }

    /** get created timestamp */
    public get Created(): number {
        return this._created;
    }

    /** set updated timestamp */
    public set Updated(updated: number) {
        if (this._updated != updated) {
            this._updated = updated;
            this._dirty = true;
        }
    }

    /** get updated timestamp */
    public get Updated(): number | undefined {
        return this._updated;
    }

    /** set order number */
    public set Order(order: number) {
        if (this._order != order) {
            this._order = order;
            this._dirty = true;
        }
    }

    /** get order number */
    public get Order(): number {
        return this._order;
    }

    /** get number of items of this list */
    public get ItemsCount(): number {
        if (this._items) {
            return this._items.length;
        } else {
            return this._itemsCount ?? 0;
        }
    }

    /** set the list of all items */
    public set Items(items: Listitem[] | undefined) {
        this._items = items;
        if (this._items) {
            this._itemsCount = this._items.length;
        }
        this._dirty = true;
    }

    /** get the list of all items */
    public get Items(): Listitem[] {
        if (this._items) {
            return this._items;
        } else {
            return [];
        }
    }

    /** set the delete timestamp */
    public set Deleted(date: number) {
        if (this._deleted != date) {
            this._dirty = true;
            this._deleted = date;
        }
    }

    /** get the deleted timestamp */
    public get Deleted(): number {
        return this._deleted ?? 0;
    }

    /** set the interval, the list gets resettet automatiacally */
    public set Reset(reset: ListReset | undefined) {
        if (this._reset != reset) {
            this._reset = reset;
            this._dirty = true;
        }
    }

    /** when does the list get reset automagically? */
    public get Reset(): ListReset | undefined {
        return this._reset;
    }

    /** set, if the list should be automatiacally synced to watch */
    public set Sync(sync: boolean) {
        if (this._sync != sync) {
            this._sync = sync;
            this._dirty = true;
        }
    }

    /** should the list be synced automatically to watch */
    public get Sync(): boolean {
        return this._sync;
    }

    /** are only peek information loaded */
    public get isPeek(): boolean {
        return this._items == undefined;
    }

    /**
     * Is the list needed to be stored in backend?
     */
    public get Dirty(): boolean {
        if (this._dirty == true) {
            return true;
        }

        if (this._items) {
            for (let i = 0; i < this._items.length; i++) {
                if (this._items[i].Dirty) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * adds a new item to the list
     * @param item item to add
     * @returns item that was added
     */
    public AddItem(item: Listitem | ListitemModel): Listitem {
        if (!(item instanceof Listitem)) {
            item = Listitem.Create(item);
        }

        item.Order = this.Items.length;
        if (!this._items) {
            this._items = [item];
        } else {
            this._items.push(item);
        }
        this._itemsCount = this._items.length;
        this.Updated = Date.now();
        this._dirty = true;
        return item;
    }

    /**
     * removes a item from the list
     * @param item item to remove
     */
    public RemoveItem(items: Listitem | Listitem[]) {
        if (!this._items) {
            return;
        }
        if (!Array.isArray(items)) {
            items = [items];
        }

        this._items = this._items.filter(el => {
            return items.find(el2 => el.equals(el2)) == undefined;
        });
        this._itemsCount = this._items.length;

        let order = 0;
        this._items.forEach(i => {
            i.Order = order++;
        });
        this._dirty = true;
        this.Updated = Date.now();
    }

    /**
     * deletes all items of the list
     */
    public DeleteAllItems() {
        this._items = undefined;
        this._itemsCount = 0;
        this._dirty = true;
        this.Updated = Date.now();
    }

    /**
     * the list is not longer dirty
     */
    public Clean() {
        this._dirty = false;
        this._items?.forEach(i => i.Clean());
    }

    /**
     * get detailed information of another list, but not override peek details
     * @param list the other list
     */
    public copyDetails(list: List | undefined) {
        if (list && !list.isPeek) {
            this.Items = list.Items;
            this.Reset = list.Reset;
        }
    }

    /**
     * create an object to send to a device
     * @returns device object representation
     */
    public toDeviceObject(): string[] {
        const ret: string[] = ["uuid=" + this._uuid, "t=" + this._name, "d=" + this._updated, "o=" + this._order, "rev=" + List.ListRevision];

        if (this._items) {
            for (let i = 0; i < this._items.length; i++) {
                const item = this._items[i].toDeviceObject();
                if (item) {
                    ret.push(...item);
                }
            }
        }

        if (this._reset && this._reset.active) {
            ret.push(...["r_a=" + this._reset.active, "r_i=" + (this._reset.interval?.charAt(0) ?? undefined), "r_h=" + this._reset.hour, "r_m=" + this._reset.minute]);
            if (this._reset.interval == "weekly") {
                ret.push("r_w=" + this._reset.weekday);
            } else if (this._reset.interval == "monthly") {
                ret.push("r_d=" + this._reset.day);
            }
        }

        return ret;
    }

    /**
     * create an object to store in backend, returns undefined if to changes on the list
     * @param force force to create an object, even if nothing changed
     * @returns object for backend storage, undefined if no changes
     */
    public toBackend(force: boolean = false): ListModel | undefined {
        if (!this.Dirty && !force) {
            return undefined;
        } else {
            const ret: ListModel = {
                uuid: this._uuid,
                name: this._name,
                items: [],
                created: this._created,
                updated: this._updated ?? undefined,
                deleted: this._deleted ?? undefined,
                order: this._order,
                reset: this._reset,
                sync: this._sync,
            };

            if (this._items && this._items.length > 0) {
                this._items.forEach(item => {
                    ret.items!.push(item.toBackend());
                });
            }

            this.Clean();
            return ret;
        }
    }

    /**
     * purges all unnecessary data from the list to save memory
     */
    public PurgeDetails() {
        if (this._items !== undefined) {
            this._itemsCount = this._items.length;
            this._items = undefined;
        }
        this._reset = undefined;
    }

    /**
     * string to identify list in logfiles
     * @returns
     */
    public toLog(): string {
        return `uuid:${this.Uuid}`;
    }

    /**
     * check if two list objects are equal
     * @param other other list object or undefined
     * @returns are the lists equal
     */
    public equals(other: List | null | undefined): boolean {
        if (!other) {
            return false;
        }
        return this.Uuid === other.Uuid;
    }

    /**
     * creates a list object from backend
     * @param obj backend object
     * @returns List object
     */
    public static fromBackend(obj: any, only_peek: boolean = false): List | undefined {
        const props = ["uuid", "name", "created", "order"];
        for (let i = 0; i < props.length; i++) {
            if (!obj.hasOwnProperty(props[i])) {
                Logger.Error(`List could not been read from backend, property ${props[i]} not found}`);
                return undefined;
            }
        }

        const itemscount = obj.items?.length ?? 0;
        if (only_peek) {
            //remove items from memory...
            obj.items = undefined;
            obj.reset = undefined;
        }

        const list = new List(
            {
                uuid: obj.uuid,
                name: obj.name,
                created: obj.created,
                order: obj.order,
                updated: obj.updated,
                deleted: obj.deleted,
                items: obj.items,
                reset: obj.reset,
                sync: obj.sync,
            },
            itemscount,
        );
        list.Clean();

        return list;
    }
}

export declare type ListModel = {
    uuid: string | number;
    name: string;
    created: number;
    order: number;
    updated?: number;
    deleted?: number;
    reset?: ListReset;
    sync?: boolean;
    items?: ListitemModel[];
};

export declare type ListReset = {
    active: boolean;
    interval: "daily" | "weekly" | "monthly";
    hour: number;
    minute: number;
    day: number;
    weekday: number;
};
