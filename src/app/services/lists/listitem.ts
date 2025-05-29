import { HelperUtils } from "src/app/classes/utils/helper-utils";
import type { DatabaseType } from "../storage/lists/main-sqlite-backend.service";

export class Listitem {
    private _id: number;
    private _order: number;
    private _created: number;
    private _modified: number;
    private _item: string;
    private _note?: string;
    private _hidden: boolean = false;
    private _locked: boolean = false;
    private _deleted?: number;
    private _dirty: boolean = false;
    private _legacyUuid?: string;

    constructor(obj: ListitemModel) {
        this._id = obj.id ?? HelperUtils.RandomNegativNumber();
        this._item = obj.item;
        this._note = obj.note;
        this._order = obj.order;
        this._hidden = obj.hidden === 1;
        this._locked = obj.locked === 1;
        this._created = obj.created;
        this._modified = obj.modified;
        this._deleted = obj.deleted;
        this._dirty = true;
    }

    /** get unique id in backend */
    public get Id(): number {
        return this._id;
    }

    /** set the unique id for backend */
    public set Id(id: number) {
        this._id = id;
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
    public get Modified(): number {
        return this._modified;
    }

    /** set updated timestamp */
    public set Modified(updated: number) {
        if (this._modified != updated) {
            this._modified = updated;
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
     * is the item already stored in backend?
     */
    public get isVirtual(): boolean {
        return this._id < 0;
    }

    /**
     * create an object to send to a device
     * @param arr array to append to, or undefined to create a new array
     * @returns device object representation
     */
    public toDeviceObject(): string[] | undefined {
        if (!this.Hidden) {
            const ret: string[] = [`it${this._order}_uuid=${this._id}`, `it${this._order}_i=${this._item}`];
            if (this._note) {
                ret.push(`it${this._order}_n=${this._note}`);
            }
            return ret;
        }
        return undefined;
    }

    public toBackend(): Map<string, DatabaseType> {
        return new Map<string, DatabaseType>([
            ["id", this._id],
            ["item", this._item],
            ["note", this._note ?? null],
            ["order", this._order],
            ["hidden", this._hidden ? 1 : 0],
            ["locked", this._locked ? 1 : 0],
            ["created", this._created],
            ["modified", this._modified],
            ["deleted", this._deleted ?? null],
            ["legacy_uuid", this._legacyUuid ?? null],
        ]);
    }

    /**
     * string to identify list in logfiles
     * @returns
     */
    public toLog(): string {
        return `id:${this.Id}`;
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
        return other.Id === this.Id;
    }
}

export declare type ListitemModel = {
    id: number;
    list_id: number;
    item: string;
    note?: string;
    order: number;
    hidden?: number;
    locked?: number;
    created: number;
    modified: number;
    deleted?: number;
    legacy_uuid?: string;
};
