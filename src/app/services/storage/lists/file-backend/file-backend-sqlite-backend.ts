import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Logger } from "src/app/services/logging/logger";
import { DatabaseType, MainSqliteBackendService } from "../main-sqlite-backend.service";
import { FileBackendListModel } from "./file-backend-list-model";
import { FileBackendListitemModel } from "./file-backend-listitem-model";

export class FileBackendSqliteBackend {
    private readonly _database?: SQLiteDBConnection;

    constructor(service: MainSqliteBackendService) {
        this._database = service.Database;
    }

    /**
     * store a list from the old backend to the new
     * @param model list model
     * @returns true if the storage was successfull, false otherwise
     */
    public async storeList(model: FileBackendListModel): Promise<{ success: boolean; items: number }> {
        if (!this._database) {
            Logger.Error(`Could not store legacy list ${model.name} (uuid:${model.uuid}) in new backend: backend not initalized`);
            return { success: false, items: 0 };
        }

        if ((await this._database!.isTransactionActive()).result) {
            Logger.Error(`Rollback old transaction in 'FileBackendSqliteBackend.storeList()'`);
            await this._database!.rollbackTransaction();
        }

        try {
            await this._database!.beginTransaction();
            if (!(await this._database!.isTransactionActive()).result) {
                Logger.Error(`Could not start sql transaction in 'FileBackendSqliteBackend.storeList()'`);
                return { success: false, items: 0 };
            }
        } catch (e) {
            Logger.Error(`Could not start sql transaction in 'FileBackendSqliteBackend.storeList()'`, e);
            return { success: false, items: 0 };
        }

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

        try {
            const result = await this._database?.run(query, params, false);
            if (!list_id && result.changes?.lastId) {
                list_id = result.changes.lastId;
            }
        } catch (e) {
            Logger.Error(`Could not store legacy list '${model.name}' (uuid:${model.uuid}) in new backend`, e);
            await this._database.rollbackTransaction();
            return { success: false, items: 0 };
        }

        if (list_id) {
            let items = 0;
            if (model.items?.length) {
                for (let i = 0; i < model.items.length; i++) {
                    if (await this.storeListitem(model.items[i], list_id, false)) 7;
                    items++;
                }
            }
            try {
                await this._database.commitTransaction();
                Logger.Notice(`Transfered list ${model.name} (${model.uuid}) with ${model.items?.length ?? 0} items to new backend`);
                return { success: true, items: items };
            } catch (e) {
                Logger.Error(`Could not commit transaction in 'FileBackendSqliteBackend.storeList()': `, e);
            }
        } else {
            await this._database.rollbackTransaction();
        }
        return { success: false, items: 0 };
    }

    /**
     * store a list item in the new backend
     * @param model listitem model
     * @returns was the storage successfull?
     */
    public async storeListitem(model: FileBackendListitemModel, list_id: number, transaction?: boolean): Promise<boolean> {
        if (!this._database) {
            return false;
        }

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

        try {
            await this._database.run(query, params, transaction);
            return true;
        } catch (e) {
            Logger.Error(`Could not store legacy listitem '${model.item}' (uuid:${model.uuid}) in new backend`, e);
        }
        return false;
    }

    /**
     * check if there is a list in the new backend, that was imported before?
     * @param legacy_uuid uuid of the list in the old backend
     * @returns uuid of this list in new backend, undefined if there is no list, or false in something went wrong
     */
    public async LegacyUuidToId(args: { legacy_uuid: string | number; type: "list" | "listitem" }): Promise<number | false | undefined> {
        if (!this._database) {
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
            const result = await this._database.query(query, [args.legacy_uuid]);
            if (result.values && result.values.length > 0) {
                return parseInt(result.values[0].id);
            } else {
                return undefined;
            }
        } catch (e) {
            Logger.Error(`Could not read id for ${args.type} with legacy_uuid '${args.legacy_uuid}': `, e);
            return false;
        }
    }
}
