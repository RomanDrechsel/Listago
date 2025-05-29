import { HelperUtils } from "src/app/classes/utils/helper-utils";
import { DatabaseType } from "../storage/lists/main-sqlite-backend.service";
import { Listitem, ListitemModel } from "./listitem";

export class List {
    private _id: number;
    private _name: string;
    private _created: number;
    private _modified: number;
    private _order: number;
    private _reset?: ListReset;
    private _itemsCount?: number;
    private _items?: Listitem[];
    private _trashItemsCount?: number;
    private _itemsInTrash?: Listitem[];
    private _deleted?: number;
    private _sync: boolean = false;
    private _legacyUuid?: string;
    private _dirty: boolean = false;

    private static readonly ListRevision = 1;

    public constructor(obj: ListModel, itemsobjs?: ListitemModel[], itemcount?: number, dirty?: boolean) {
        this._id = obj.id ?? HelperUtils.RandomNegativNumber();
        this._name = obj.name;
        this._order = obj.order;
        this._created = obj.created;
        this._modified = obj.modified;
        this._deleted = obj.deleted;
        this._sync = obj.sync === 1;
        if (obj.reset !== undefined) {
            let interval: "daily" | "weekly" | "monthly";
            if (obj.reset_interval === "daily" || obj.reset_interval === "weekly" || obj.reset_interval === "monthly") {
                interval = obj.reset_interval as "daily" | "weekly" | "monthly";
            } else {
                interval = "daily";
            }

            this._reset = {
                active: obj.reset === 1,
                interval: interval,
                hour: obj.reset_hour ?? 0,
                minute: obj.reset_minute ?? 0,
                day: obj.reset_day ?? 1,
                weekday: obj.reset_weekday ?? 1,
            };
        }
        this._legacyUuid = obj.legacy_uuid;

        this._items = undefined;
        if (itemsobjs) {
            this._items = [];
            itemsobjs.forEach((el: ListitemModel) => {
                this._items!.push(new Listitem(el));
            });
        }
        this._itemsCount = this._items?.length ?? itemcount;
        this.cleanItemsOrder();
        if (dirty !== undefined) {
            this._dirty = dirty;
        }
    }

    /**
     * get unique list id
     * in older versions it was a string
     */
    public get Id(): number {
        return this._id;
    }

    /**
     * set the unique list id
     * @param id unique list id
     */
    public set Id(id: number) {
        this._id = id;
    }

    /** set list title */
    public set Name(name: string) {
        if (this._name != name) {
            this._name = name;
            this._dirty = true;
            this._modified = Date.now();
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
    public set Modified(modified: number) {
        if (this._modified != modified) {
            this._modified = modified;
            this._dirty = true;
        }
    }

    /** get updated timestamp */
    public get Modified(): number {
        return this._modified;
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

    /** how may items are in trash for this list */
    public get ItemsInTrashCount(): number {
        return this._trashItemsCount ?? 0;
    }

    /** return the listitems, that are in trash for this list */
    public get ItemsInTrash(): Listitem[] | undefined {
        return this._itemsInTrash;
    }

    /** set the items in trash for this list */
    public set ItemsInTrash(items: Listitem[] | undefined) {
        this._itemsInTrash = items;
        if (this._itemsInTrash) {
            this._trashItemsCount = this._itemsInTrash.length;
        }
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

        return this.Items.some(i => i.Dirty);
    }

    /**
     * is the list already stored in backend?
     */
    public get isVirtual(): boolean {
        return this._id < 0;
    }

    /**
     * adds a new item to the list
     * @param item item to add
     * @returns item that was added
     */
    public AddItem(item: Listitem | ListitemModel): Listitem {
        if (!(item instanceof Listitem)) {
            item = new Listitem(item);
        }

        this.cleanItemsOrder();

        item.Order = this.Items.length;
        if (!this._items) {
            this._items = [item];
        } else {
            this._items.push(item);
        }
        this._itemsCount = this._items.length;
        this.Modified = Date.now();
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

        this.cleanItemsOrder();
        this._dirty = true;
        this.Modified = Date.now();
    }

    /**
     * deletes all items of the list
     */
    public DeleteAllItems() {
        this._items = undefined;
        this._itemsCount = 0;
        this._dirty = true;
        this.Modified = Date.now();
    }

    /**
     * reorder the items
     * @param items items to order
     */
    public ReorderItems(items?: Listitem[]) {
        if (items) {
            this._items = items;
            for (let i = 0; i < items.length; i++) {
                items[i].Order = i;
            }
        }
    }

    /**
     * set the order property of all items in a row
     */
    public cleanItemsOrder() {
        if (this._items) {
            this._items = this._items.sort((a, b) => a.Order - b.Order);
            for (let i = 0; i < this._items.length; i++) {
                this._items[i].Order = i;
            }
        }
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
     * copys all information from the model to this list
     * @param model model to copy
     * @returns true if data was updated
     */
    public clone(other: List) {
        this._id = other._id;
        this._name = other._name;
        this._order = other._order;
        this._created = other._created;
        this._modified = other._modified;
        this._deleted = other._deleted;
        this._sync = other._sync;
        this._reset = other._reset;
        this._legacyUuid = other._legacyUuid;
        if (other._items) {
            this._items = other._items;
        }
        if (other._itemsInTrash) {
            this._itemsInTrash = other._itemsInTrash;
        }
        this._itemsCount = other._itemsCount;
        this._trashItemsCount = other._trashItemsCount;
        this._dirty = other._dirty;
    }

    /**
     * create an object to send to a device
     * @returns device object representation
     */
    public toDeviceObject(): string[] {
        const ret: string[] = ["uuid=" + this._id, "t=" + this._name, "d=" + this._modified, "o=" + this._order, "rev=" + List.ListRevision];

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
     * purges all unnecessary data from the list to save memory
     */
    public PurgeDetails() {
        if (this._items !== undefined) {
            this._itemsCount = this._items.length;
            this._items = undefined;
        }
        this._reset = undefined;
    }

    public toBackend(): Map<string, DatabaseType> {
        return new Map<string, DatabaseType>([
            ["id", this._id],
            ["name", this._name],
            ["order", this._order],
            ["created", this._created],
            ["modified", this._modified],
            ["deleted", this._deleted ?? null],
            ["sync", this._sync ? 1 : 0],
            ["reset", this._reset?.active ? 1 : 0],
            ["reset_interval", this._reset?.interval ?? null],
            ["reset_hour", this._reset?.hour ?? null],
            ["reset_minute", this._reset?.minute ?? null],
            ["reset_day", this._reset?.day ?? null],
            ["reset_weekday", this._reset?.weekday ?? null],
            ["legacy_uuid", this._legacyUuid ?? null],
        ]);
    }

    /**
     * string to identify list in logfiles
     * @returns
     */
    public toLog(): string {
        return `${this._name} (id:${this.Id})`;
    }

    /**
     * string to identify list in logsfiles
     * @param model  list model
     * @returns
     */
    public static toLog(model: ListModel): string {
        return `${model.name} (id:${model.id})`;
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
        return this.Id === other.Id;
    }
}

export declare type ListModel = {
    id?: number;
    name: string;
    order: number;
    created: number;
    modified: number;
    deleted?: number;
    sync?: number;
    reset?: number;
    reset_interval?: string;
    reset_hour?: number;
    reset_minute?: number;
    reset_day?: number;
    reset_weekday?: number;
    legacy_uuid?: string;
};

export declare type ListReset = {
    active: boolean;
    interval: "daily" | "weekly" | "monthly";
    hour: number;
    minute: number;
    day: number;
    weekday: number;
};
