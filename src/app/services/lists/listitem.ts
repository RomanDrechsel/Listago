import { Logger } from "../logging/logger";

export class Listitem {
    private _uuid: number | string;
    private _order: number;
    private _created: number;
    private _updated: number;
    private _item: string;
    private _note?: string;
    private _hidden: boolean = false;
    private _locked: boolean = false;
    private _deleted?: number;
    private _dirty: boolean = false;

    private constructor(obj: ListitemModel) {
        this._uuid = obj.uuid;
        this._item = obj.item;
        this._note = obj.note;
        this._order = obj.order;
        this._hidden = obj.hidden ?? false;
        this._locked = obj.locked ?? false;
        this._created = obj.created ?? Date.now();
        this._updated = obj.updated ?? Date.now();
        this._dirty = obj.dirty ?? false;
        this._deleted = obj.deleted;
    }

    /** get unique id in backend */
    public get Uuid(): string | number {
        return this._uuid;
    }

    /** set the unique id for backend */
    public set Uuid(uuid: string) {
        this._uuid = uuid;
    }

    /** get the order number */
    public get Order(): number {
        return this._order;
    }

    /** set the order number */
    public set Order(order: number) {
        if (this._order != order) {
            this._order = order;
            this._dirty = true;
        }
    }

    /** get created timestamp */
    public get Created(): number {
        return this._created;
    }

    /** set created timestamp */
    public set Created(created: number) {
        this._created = created;
    }

    /** get updated timestamp */
    public get Updated(): number | undefined {
        return this._updated;
    }

    /** set updated timestamp */
    public set Updated(updated: number) {
        if (this._updated != updated) {
            this._updated = updated;
            this._dirty = true;
        }
    }

    /** get the item text */
    public get Item(): string {
        return this._item;
    }

    /** set the item text */
    public set Item(item: string) {
        if (this._item != item) {
            this._item = item;
            this._dirty = true;
        }
    }

    /** get the item note */
    public get Note(): string | undefined {
        return this._note;
    }

    /** set the item note */
    public set Note(note: string | undefined) {
        if (this._note != note) {
            this._note = note;
            this._dirty = true;
        }
    }

    /** get the hidden state of the item */
    public get Hidden(): boolean {
        return this._hidden;
    }

    /** set the hidden state of the item */
    public set Hidden(hidden: boolean) {
        if (this._hidden != hidden) {
            this._hidden = hidden;
            this._dirty = true;
        }
    }

    /**
     * get the date of deletion as unix timestamp in milliseconds
     */
    public get Deleted(): number | undefined {
        return this._deleted;
    }

    /**
     * set or remove the date of deletion as unix timestamp in milliseconds
     */
    public set Deleted(deleted: number | undefined) {
        if (this._deleted != deleted) {
            this._deleted = deleted;
            this._dirty = true;
        }
    }

    /**
     * lock the item, so it is not deleted when emptying the list
     */
    public set Locked(lock: boolean) {
        if (this._locked != lock) {
            this._locked = lock;
            this._dirty = true;
        }
    }

    /**
     * is the item locked, so it is not deleted when emptying the list
     */
    public get Locked(): boolean {
        return this._locked;
    }

    /** any changes since the last storage */
    public get Dirty(): boolean {
        return this._dirty;
    }

    /**
     * create an object to send to a device
     * @param arr array to append to, or undefined to create a new array
     * @returns device object representation
     */
    public toDeviceObject(): string[] | undefined {
        if (!this.Hidden) {
            const ret: string[] = [`it${this._order}_uuid=${this._uuid}`, `it${this._order}_i=${this._item}`];
            if (this._note) {
                ret.push(`it${this._order}_n=${this._note}`);
            }
            return ret;
        }
        return undefined;
    }

    /**
     * create an object to store in backend, returns undefined if to changes on the list
     * @returns object for backend storage
     */
    public toBackend(): ListitemModel {
        this.Clean();

        return {
            uuid: this._uuid,
            item: this._item,
            note: this._note,
            order: this._order,
            hidden: this._hidden,
            locked: this._locked,
            created: this._created,
            updated: this._updated,
            deleted: this._deleted,
        };
    }

    /**
     * string to identify list in logfiles
     * @returns
     */
    public toLog(): string {
        return `id:${this.Uuid ?? "?"}`;
    }

    /**
     * the listitem is not longer dirty
     */
    public Clean() {
        this._dirty = false;
    }

    /**
     * check if two listitems equals
     * @param other the other listitem or undefined
     * @returns are the objects equal
     */
    public equals(other: Listitem): boolean {
        if (!other) {
            return false;
        }
        return other.Uuid === this.Uuid;
    }

    /**
     * creates a listitem object from backend
     * @param obj backend object
     * @returns Listitem object
     */
    public static fromBackend(obj: any): Listitem | undefined {
        const props = ["uuid", "item", "created", "order"];
        for (let i = 0; i < props.length; i++) {
            if (!obj.hasOwnProperty(props[i])) {
                Logger.Error(`Could not read listitem from backend, property ${props[i]} not found`);
                return undefined;
            }
        }
        return new Listitem({
            uuid: obj.uuid,
            item: obj.item,
            note: obj.note,
            order: obj.order,
            hidden: obj.hidden,
            locked: obj.locked,
            created: obj.created,
            updated: obj.updated,
            deleted: obj.deleted,
            dirty: false,
        });
    }

    public static Create(obj: ListitemModel): Listitem {
        return new Listitem(obj);
    }
}

export declare type ListitemModel = {
    uuid: number | string;
    item: string;
    note?: string;
    order: number;
    created: number;
    hidden?: boolean;
    locked?: boolean;
    updated?: number;
    deleted?: number;
    dirty?: boolean;
};
