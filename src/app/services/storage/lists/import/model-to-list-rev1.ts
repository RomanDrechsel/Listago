import { HelperUtils } from "src/app/classes/utils/helper-utils";
import { List } from "src/app/services/lists/list";
import type { ListitemModel } from "src/app/services/lists/listitem";
import type { ListsService } from "src/app/services/lists/lists.service";
import { Logger } from "src/app/services/logging/logger";
import type { SqliteService } from "../../sqlite/sqlite.service";
import { ModelToListitem } from "./model-to";

export class ModelToListRev1 {
    protected _sqlite: SqliteService;
    protected _listsService: ListsService;
    protected _json: any;
    protected _file: string;

    public constructor(json: any, sqlite: SqliteService, listsService: ListsService, file: string) {
        this._json = json;
        this._sqlite = sqlite;
        this._listsService = listsService;
        this._file = file;
    }

    public async Import(is_trash: boolean = false): Promise<List | undefined> {
        if (!this._json.name) {
            return undefined;
        }

        const list_id = await this.getCorrespondingListId();

        const items: ListitemModel[] = [];
        if (Array.isArray(this._json.items)) {
            for (let i = 0; i < this._json.items.length; i++) {
                const model = this._json.items[i];
                try {
                    const item = await ModelToListitem(model, list_id, this._sqlite, this._listsService, false);
                    if (item) {
                        items.push(item);
                    }
                } catch (e) {
                    Logger.Error(`Importer: unknown rev ${model.rev} of listitem file '${this._file}'`);
                }
            }
        }

        return new List(
            {
                id: list_id,
                name: this._json.name,
                order: this._json.order ?? 0,
                created: this._json.created ?? Date.now(),
                modified: this._json.updated ?? Date.now(),
                deleted: is_trash ? this._json.deleted ?? Date.now() : this._json.deleted,
                sync_devices: undefined,
                legacy_uuid: this._json.uuid ? String(this._json.uuid) : undefined,
                reset: this._json.reset?.active === true ? 1 : this._json.reset?.active === false ? 0 : undefined,
                reset_day: this._json.reset?.day,
                reset_hour: this._json.reset?.hour,
                reset_minute: this._json.reset?.minute,
                reset_interval: this._json.reset?.interval,
                reset_weekday: this._json.reset?.weekday,
            },
            items,
            items.length,
            true,
        );
    }

    protected async getCorrespondingListId(): Promise<number> {
        if (this._json.id && typeof this._json.id === "number") {
            return this._json.id;
        } else if (this._json.uuid) {
            const res = await this._sqlite.Query("SELECT `id` FROM `lists` WHERE `legacy_uuid`=? LIMIT 1", [String(this._json.uuid)]);
            if (res && Array.isArray(res) && res.length > 0 && res[0].id) {
                return Number(res[0].id);
            }
        }
        return HelperUtils.RandomNegativNumber();
    }
}
