import { HelperUtils } from "src/app/classes/utils/helper-utils";
import type { ListitemModel } from "src/app/services/lists/listitem";
import type { ListsService } from "src/app/services/lists/lists.service";
import type { SqliteService } from "../../sqlite/sqlite.service";

export class ModelToListitemRev1 {
    protected _sqlite: SqliteService;
    protected _listsService: ListsService;
    protected _json: any;

    public constructor(json: any, sqlite: SqliteService, listsService: ListsService) {
        this._json = json;
        this._sqlite = sqlite;
        this._listsService = listsService;
    }

    public async Import(list_id: number, force_trash: boolean): Promise<ListitemModel | undefined> {
        if (this._json.item) {
            const item_id = await this.getCorrespondingListitemId();
            return {
                id: item_id,
                item: String(this._json.item),
                note: this._json.note,
                list_id: list_id,
                created: this._json.created ?? Date.now(),
                modified: this._json.updated ?? Date.now(),
                deleted: force_trash ? this._json.deleted ?? Date.now() : this._json.deleted,
                order: this._json.order ?? 0,
                hidden: this._json.hidden ? 1 : undefined,
                locked: this._json.locked ? 1 : undefined,
                legacy_uuid: this._json.uuid ? String(this._json.uuid) : undefined,
            };
        }
        return undefined;
    }

    protected async getCorrespondingListitemId(): Promise<number> {
        if (typeof this._json.id == "number") {
            return Number(this._json.id);
        }
        const res_item = await this._sqlite.Query("SELECT `id` FROM `listitems` WHERE `legacy_uuid` = ? LIMIT 1", [String(this._json.uuid)]);
        if (res_item && Array.isArray(res_item) && res_item.length > 0 && res_item[0].id) {
            return Number(res_item[0].id);
        }

        return HelperUtils.RandomNegativNumber();
    }
}
