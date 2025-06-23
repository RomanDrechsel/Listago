import { StringUtils } from "src/app/classes/utils/string-utils";
import { Logger } from "src/app/services/logging/logger";
import { DatabaseType } from "../../sqlite/lists/lists-sqlite-backend.service";
import type { SqliteService } from "../../sqlite/sqlite.service";
import { FileBackendListModel } from "./file-backend-list-model";
import { FileBackendListitemModel } from "./file-backend-listitem-model";

export class FileBackendSqliteBackend {
    private readonly _backend: SqliteService;

    constructor(backend: SqliteService) {
        this._backend = backend;
    }

    /**
     * store a list from the old backend to the new
     * @param model list model
     * @returns true if the storage was successfull, false otherwise
     */
    public async storeList(model: FileBackendListModel): Promise<{ success: boolean; items: number }> {
        //first we check if there is already a list with the legacy uuid
        let list_id = await this.LegacyUuidToId({ legacy_uuid: model.uuid, type: "list" });
        let query;
        let params: DatabaseType[] = [model.name, model.order, model.created, model.updated ?? model.created, model.deleted ?? null, model.sync ? 1 : 0, model.reset ? 1 : 0, model.reset?.interval ?? null, model.reset?.hour ?? null, model.reset?.minute ?? null, model.reset?.day ?? null, model.reset?.weekday ?? null, model.uuid];

        if (list_id) {
            // update existing list
            query = "UPDATE `lists` SET `name`=?, `order`=?, `created`=?, `modified`=?, `deleted`=?, `sync`=?, `reset`=?, `reset_interval`=?, `reset_hour`=?, `reset_minute`=?, `reset_day`=?, `reset_weekday`=?, `legacy_uuid`=? WHERE `id`=?;";
            params.push(list_id);
        } else {
            //insert new list
            query = "INSERT INTO `lists` (`name`, `order`, `created`, `modified`, `deleted`, `sync`, `reset`, `reset_interval`, `reset_hour`, `reset_minute`, `reset_day`, `reset_weekday`, `legacy_uuid`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
        }

        const result = await this._backend.Execute(query, params);
        if (!list_id && result?.changes?.lastId) {
            list_id = result.changes.lastId;
        }

        if (list_id) {
            let items = 0;
            if (model.items?.length) {
                for (let i = 0; i < model.items.length; i++) {
                    if (await this.storeListitem(model.items[i], list_id)) {
                        items++;
                    }
                }
            }
        } else {
            Logger.Error(`Could not store legacy list '${model.name}' (uuid:${model.uuid}) in new backend`);
        }
        return { success: false, items: 0 };
    }

    /**
     * store a list item in the new backend
     * @param model listitem model
     * @returns was the storage successfull?
     */
    public async storeListitem(model: FileBackendListitemModel, list_id: number): Promise<boolean> {
        const item_id = await this.LegacyUuidToId({ legacy_uuid: model.uuid, type: "listitem" });
        let query;
        let params: DatabaseType[] = [list_id, model.item, model.note?.length ? model.note : null, model.order, model.hidden ? 1 : 0, model.locked ? 1 : 0, model.created, model.updated ?? model.created, model.deleted ?? null, model.uuid];

        if (item_id) {
            // update existing listitem
            query = "UPDATE `listitems` SET `list_id`=?, `item`=?, `note`=?, `order`=?, `hidden`=?, `locked`=?, `created`=?, `modified`=?, `deleted`=?, `legacy_uuid`=? WHERE `id`=?;";
            params.push(item_id);
        } else {
            //insert new listitem
            query = "INSERT INTO `listitems` (`list_id`, `item`, `note`, `order`, `hidden`, `locked`, `created`, `modified`, `deleted`, `legacy_uuid`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
        }

        const store = await this._backend.Execute(query, params);
        if (store?.changes?.changes) {
            return true;
        } else {
            Logger.Error(`Could not store legacy listitem '${StringUtils.shorten(model.item, 20)}' (uuid:${model.uuid}) in new backend`);
        }
        return false;
    }

    /**
     * check if there is a list in the new backend, that was imported before?
     * @param legacy_uuid uuid of the list in the old backend
     * @returns uuid of this list in new backend, undefined if there is no list, or false in something went wrong
     */
    public async LegacyUuidToId(args: { legacy_uuid: string | number; type: "list" | "listitem" }): Promise<number | false | undefined> {
        if (!this._backend) {
            return false;
        }

        let query;
        if (args.type === "list") {
            query = "SELECT `id` FROM `lists` WHERE `legacy_uuid` = ? LIMIT 1";
        } else if (args.type === "listitem") {
            query = "SELECT `id` FROM `listitems` WHERE `legacy_uuid` = ? LIMIT 1";
        } else {
            return false;
        }

        try {
            const result = await this._backend.Query(query, [args.legacy_uuid]);
            if (Array.isArray(result) && result.length > 0) {
                return parseInt(result[0].id);
            } else {
                return undefined;
            }
        } catch (e) {
            Logger.Error(`Could not read id for ${args.type} with legacy_uuid '${args.legacy_uuid}': `, e);
            return false;
        }
    }
}
