import { inject, Injectable } from "@angular/core";
import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { List, type ListModel } from "../../lists/list";
import { Listitem, ListitemModel } from "../../lists/listitem";
import { Logger } from "../../logging/logger";
import { SqliteService } from "../sqlite/sqlite.service";
import { MainUpgradeStatements } from "./main-upgrade-statments";

@Injectable({
    providedIn: "root",
})
export class MainSqliteBackendService {
    public static readonly DatabaseNameMain = "main";

    private readonly _databaseVersion = 1;
    private _database?: SQLiteDBConnection;

    private readonly _sqliteService = inject(SqliteService);

    public MaxTrashCount: number | undefined = undefined;

    public get Database(): SQLiteDBConnection | undefined {
        return this._database;
    }

    public async Initialize(): Promise<boolean> {
        await this._sqliteService.addUpgradeStatement(MainUpgradeStatements());
        this._database = await this._sqliteService.openDatabase(MainSqliteBackendService.DatabaseNameMain, false, "no-encryption", this._databaseVersion, false);
        if (this._database) {
            Logger.Debug(`Found ${await this.queryListsCount()} list(s) in backend`);
            return true;
        } else {
            return false;
        }
    }

    /**
     * query all lists
     * @param args
     * @param args.peek if not false, the list only contains the number of items, not the items themselves
     * @param args.trash if true, the lists in the trash are returned
     * @param args.orderBy the order of the lists, defaults to 'order' property
     * @param args.orderDir the direction of the order, defaults to "ASC"
     * @returns array of lists
     */
    public async queryLists(args: { peek?: boolean; trash?: boolean; orderBy?: ListsOrder; orderDir?: ListsOrderDirection }): Promise<List[]> {
        if (!(await this.CheckConnection())) {
            return [];
        }

        if (!args.orderBy) {
            args.orderBy = "order";
        }
        if (!args.orderDir) {
            args.orderDir = "ASC";
        }

        const ret: List[] = [];
        const query = `SELECT * FROM \`lists\` WHERE \`deleted\` ${args.trash ? "IS NOT NULL" : "IS NULL"} ORDER BY \`${args.orderBy}\` ${args.orderDir}`;
        const lists = (await this._database!.query(query)).values as ListModel[] | undefined;
        if (lists) {
            for (let i = 0; i < lists.length; i++) {
                if (args.peek === false) {
                    const queryItems = `SELECT * FROM \`listitems\` WHERE \`list_id\` = ? AND \`deleted\` IS NULL ORDER BY \`${args.orderBy}\` ${args.orderDir}`;
                    const items = (await this._database!.query(queryItems, [lists[i].id])).values as ListitemModel[] | undefined;
                    if (!items) {
                        Logger.Error(`Could not query items of list ${List.toLog(lists[i])}`);
                    }
                    ret.push(new List(lists[i], items, undefined, false));
                } else {
                    const queryItems = `SELECT COUNT(*) AS \`count\` FROM \`listitems\` WHERE \`list_id\` = ? AND \`deleted\` IS NULL`;
                    const queryCount = (await this._database!.query(queryItems, [lists[i].id])).values;
                    if (!queryCount) {
                        Logger.Error(`Could not query number of items of list ${List.toLog(lists[i])}`);
                    }
                    const count = Number(queryCount?.[0]?.count ?? 0);
                    ret.push(new List(lists[i], undefined, count));
                }
            }
        }

        return ret;
    }

    /**
     * query a cetain list
     * @param args.list the list to query (or the id)
     * @param args.itemsTrash if true, it queries the items in the trash of the list
     * @param args.itemsOrderBy how to order the items of the list (default is 'order' property)
     * @param args.itemsOrderDir the direction of the ordering (default is ASC)
     * @returns list, or undefined if something went wrong
     */
    public async queryList(args: { list: List | number; itemsTrash?: boolean; itemsOrderBy?: ListsOrder; itemsOrderDir?: ListsOrderDirection }): Promise<List | undefined> {
        if (!(await this.CheckConnection())) {
            return undefined;
        }
        const list_id = args.list instanceof List ? args.list.Id : args.list;
        let list: ListModel | undefined;

        try {
            const query = `SELECT * FROM \`lists\` WHERE \`id\` = ? AND \`deleted\` IS NULL LIMIT 1;`;
            const ret = (await this._database!.query(query, [list_id])).values as ListModel[] | undefined;
            if (ret) {
                list = ret[0];
            } else {
                throw "Empty result";
            }
        } catch (e) {
            Logger.Error(`Could not query list id:${list_id} from backend: `, e);
            return undefined;
        }

        if (list) {
            if (!args.itemsOrderBy) {
                args.itemsOrderBy = "order";
            }
            if (!args.itemsOrderDir) {
                args.itemsOrderDir = "ASC";
            }
            let listitems: ListitemModel[] | undefined;
            try {
                const query = `SELECT * FROM \`listitems\` WHERE \`list_id\`=? AND deleted ${!args.itemsTrash ? "IS NULL" : "IS NOT NULL"} ORDER BY \`${args.itemsOrderBy}\` ${args.itemsOrderDir}`;
                listitems = (await this._database!.query(query, [list_id])).values as ListitemModel[] | undefined;
                if (!listitems) {
                    throw "Empty result";
                }
            } catch (e) {
                Logger.Error(`Could not query listitems for list ${List.toLog(list)}: `, e);
                return undefined;
            }

            return new List(list, listitems);
        }

        return undefined;
    }

    /**
     * queries all items of a list
     * @param args.list list to query items from (or the id)
     * @param args.trash whether to query trashed items
     * @param args.orderBy how to order the items of the list (default is 'order' property)
     * @param args.orderDir the direction of the ordering (default is ASC)
     * @returns array of listitems, of undefined if something went wrong
     */
    public async queryListitems(args: { list: number | List; trash?: boolean; itemsOrderBy?: ListsOrder; itemsOrderDir?: ListsOrderDirection }): Promise<Listitem[] | undefined> {
        if (!(await this.CheckConnection())) {
            return undefined;
        }

        const list_id = args.list instanceof List ? args.list.Id : args.list;
        if (!args.itemsOrderBy) {
            args.itemsOrderBy = "order";
        }
        if (!args.itemsOrderDir) {
            args.itemsOrderDir = "ASC";
        }
        const query = `SELECT * FROM \`listitems\` WHERE \`list_id\`=? AND deleted ${!args.trash ? "IS NULL" : "IS NOT NULL"} ORDER BY \`${args.itemsOrderBy}\` ${args.itemsOrderDir}`;
        const models = (await this._database!.query(query, [list_id])).values as ListitemModel[] | undefined;
        if (models) {
            const items: Listitem[] = [];
            models.forEach(m => {
                items.push(new Listitem(m));
            });
            return items;
        }

        return undefined;
    }

    /**
     * queries the number of lists
     * @param args.trash if true, returns the number of lists in trash
     * @returns number of lists
     */
    public async queryListsCount(args?: { trash?: boolean }): Promise<number> {
        if (!(await this.CheckConnection())) {
            return 0;
        }
        const query = `SELECT COUNT(*) AS \`count\` FROM \`lists\` WHERE \`deleted\` ${args?.trash ? "IS NOT NULL" : "IS NULL"} `;
        const count = (await this._database!.query(query)).values;
        if (!count) {
            Logger.Error(`Failed to query backend: queryListsCount()`);
            return 0;
        }
        return Number(count[0].count);
    }

    /**
     * queries the number of listitems of a list, or the total number
     * @param args.list list to query, or "all" to query all lists
     * @param args.trash if true, returns the number of items in trash of a list
     * @returns number of listitems
     */
    public async queryListitemsCount(args: { list: number | List | "all"; trash?: boolean }): Promise<number> {
        if (!(await this.CheckConnection())) {
            return 0;
        }
        let query = `SELECT COUNT(*) AS \`count\` FROM \`listitems\` WHERE \`deleted\` ${args?.trash ? "IS NOT NULL" : "IS NULL"}`;
        if (args.list !== "all") {
            query += ` AND \`list_id\` = ?`;
        }

        try {
            const res = await this._database!.query(query, args.list !== "all" ? [args.list] : undefined);
            if (res.values && res.values.length > 0) {
                return Number(res.values[0].count);
            } else {
                return 0;
            }
        } catch (e) {
            Logger.Error("MainSqliteBackendService.queryListitemsCount() failed: ", e);
            return 0;
        }
    }

    /**
     * stores a list in backend
     * @param args.list list object to store
     * @param args.force force storing the list, even if it is not dirty
     * @returns id of the list, or false on error, undefined if nothing needs to be stored
     */
    public async storeList(args: { list: List; force?: boolean }): Promise<number | false | undefined> {
        if (!(await this.CheckConnection())) {
            return false;
        }

        if (args.force !== true && !args.list.Dirty && !args.list.isVirtual) {
            return undefined;
        }

        if (args.list.isPeek) {
            const copy = await this.queryList({ list: args.list.Id });
            if (copy) {
                args.list.copyDetails(copy);
            }
        }

        const backend = args.list.toBackend();

        if ((await this._database!.isTransactionActive()).result) {
            Logger.Error(`Rollback old transaction in 'SqliteBackendService.storeList()'`);
            await this._database!.rollbackTransaction();
        }

        try {
            await this._database!.beginTransaction();
            if (!(await this._database!.isTransactionActive()).result) {
                Logger.Error(`Could not start sql transaction in 'SqliteBackendService.storeList()'`);
                return false;
            }
        } catch (e) {
            Logger.Error(`Could not start sql transaction in 'SqliteBackendService.storeList()'`, e);
            return false;
        }

        let list_id: number | undefined = undefined;

        try {
            if (args.list.isVirtual) {
                backend.delete("id");
                const keys = "`" + Array.from(backend.keys()).join("`, `") + "`";
                const qms = Array.from(backend.keys())
                    .map(() => "?")
                    .join(", ");
                const query = `INSERT INTO \`lists\` (${keys}) VALUES (${qms})`;
                const ret = await this._database!.run(query, Array.from(backend.values()), false);
                list_id = ret.changes?.lastId;
            } else {
                const query = `UPDATE \`lists\` SET ${Array.from(backend.keys())
                    .map(key => `\`${key}\`=?`)
                    .join(", ")} WHERE \`id\`=${args.list.Id}`;
                await this._database!.run(query, Array.from(backend.values()), false);
                list_id = args.list.Id;
            }

            const listid_map = new Map<number, number>();
            if (list_id) {
                for (let i = 0; i < args.list.Items.length; i++) {
                    const item = args.list.Items[i];
                    if (item.isVirtual || item.Dirty || args.force) {
                        const itemBackend = item.toBackend();
                        itemBackend.set("list_id", list_id);
                        if (item.isVirtual) {
                            itemBackend.delete("id");
                            const keys = "`" + Array.from(itemBackend.keys()).join("`, `") + "`";
                            const qms = Array.from(itemBackend.keys())
                                .map(() => "?")
                                .join(", ");
                            const query = `INSERT INTO \`listitems\` (${keys}) VALUES (${qms})`;
                            const ret = await this._database!.run(query, Array.from(itemBackend.values()), false);
                            if (ret.changes?.lastId) {
                                listid_map.set(item.Id, ret.changes.lastId);
                            }
                        } else {
                            const query = `UPDATE \`listitems\` SET ${Array.from(itemBackend.keys())
                                .map(key => `\`${key}\`=?`)
                                .join(", ")} WHERE \`id\`=${item.Id}`;
                            await this._database!.run(query, Array.from(itemBackend.values()), false);
                        }
                    }
                }
            } else {
                throw "no id";
            }

            await this._database!.commitTransaction();
            args.list.Id = list_id;
            listid_map.forEach((val: number, key: number) => {
                const item = args.list.Items.find(i => i.Id == key);
                if (item) {
                    item.Id = val;
                }
            });
            args.list.Clean();
        } catch (e) {
            await this._database!.rollbackTransaction();
            Logger.Error(`Could not store list ${args.list.toLog()} in backend:`, e);
            return false;
        }

        return list_id;
    }

    /**
     * moves the given lists to trash
     *
     * @param args.lists list of ids or List objects to move to trash
     * @returns number of moved lists, false on error
     */
    public async moveListsToTrash(args: { lists?: number[] | List[] }): Promise<number | false> {
        if (!(await this.CheckConnection())) {
            return false;
        }

        const list_ids = args.lists?.map(l => (l instanceof List ? l.Id : l)) ?? [];
        let query = `UPDATE \`lists\` SET \`deleted\` = ? WHERE \`deleted\` IS NULL`;
        if (list_ids.length > 0) {
            query += ` AND \`id\` IN (${list_ids.map(u => `?`).join(", ")})`;
        }

        try {
            const res = await this._database!.run(query, [Date.now(), ...list_ids]);
            if (res.changes?.changes) {
                return res.changes.changes;
            }
        } catch (e) {
            Logger.Error(`MainSqliteBackendService.moveListsToTrash() failed: `, e, list_ids);
        }

        return false;
    }

    /**
     * finally deletes lists from backend
     * @param args.lists array of lists (or ids) to delete
     * @param args.trash if true, only lists from trash will be deleted
     * @returns number of lists deleted, or false if failed
     */
    public async deleteLists(args: { lists?: number[] | List[]; trash?: boolean }): Promise<{ lists: number; items: number } | false> {
        if (!(await this.CheckConnection())) {
            return false;
        }

        if ((await this._database!.isTransactionActive()).result) {
            Logger.Error(`Rollback old transaction in 'SqliteBackendService.deleteLists()'`);
            await this._database!.rollbackTransaction();
        }

        try {
            await this._database!.beginTransaction();
            if (!(await this._database!.isTransactionActive()).result) {
                Logger.Error(`Could not start sql transaction in 'SqliteBackendService.deleteLists()'`);
                return false;
            }
        } catch (e) {
            Logger.Error(`Could not start sql transaction in 'SqliteBackendService.deleteLists()'`, e);
            return false;
        }

        const deleted = { lists: 0, items: 0 };

        const list_ids = args.lists?.map(l => (l instanceof List ? l.Id : l)) ?? [];
        let list_ids_delete: number[] | undefined = undefined;
        if (list_ids.length == 0) {
            const query_all = `SELECT \`id\` FROM \`lists\` WHERE \`deleted\` ${args.trash === false ? "IS NULL" : "IS NOT NULL"};`;
            try {
                const ret = await this._database!.query(query_all);
                if (ret.values) {
                    if (ret.values.length == 0) {
                        return deleted;
                    }

                    list_ids_delete = ret.values.map(id => id.id);
                } else {
                    return false;
                }
            } catch (e) {
                Logger.Error(`Could not get all list UUIDs in 'SqliteBackendService.deleteLists()'`, e);
                return false;
            }
        }

        let query = `DELETE FROM \`lists\` WHERE \`deleted\` ${args.trash === false ? "IS NULL" : "IS NOT NULL"}`;
        if (list_ids.length > 0) {
            query += " AND `id` IN (" + list_ids.map(() => "?").join(",") + ")";
        }

        try {
            const ret = await this._database!.run(query, list_ids, false);
            if (list_ids.length > 0) {
                list_ids_delete = list_ids;
            }
            if (ret.changes?.changes && ret.changes?.changes > 0) {
                deleted.lists += ret.changes.changes;
                query = "DELETE FROM `listitems` WHERE `list_id` IN (" + list_ids_delete!.map(() => "?").join(",") + ")";
                const ret2 = await this._database!.run(query, list_ids_delete!, false);
                if (ret2.changes?.changes && ret2.changes?.changes > 0) {
                    deleted.items += ret2.changes.changes;
                }
            }
            await this._database!.commitTransaction();

            return deleted;
        } catch (e) {
            await this._database!.rollbackTransaction();
            Logger.Error(`Could not delete ${args.lists?.length ?? "all"} list(s) in backend:`, e);
            return false;
        }
    }

    /**
     * move listitems to trash
     * @param args.list list, to which the items should be moved
     * @param args.items list of items to move, or all items in the list
     * @param args.force if true, move items to trash, even if they are locked
     * @returns number of moved items, or false on error
     */
    public async moveListitemsToTrash(args: { list: number | List; items?: number[] | Listitem[]; force?: boolean }): Promise<number | false> {
        if (!(await this.CheckConnection())) {
            return false;
        }
        const list_id = args.list instanceof List ? args.list.Id : args.list;
        const item_ids = args.items?.map(i => (typeof i === "number" ? i : i.Id)) || [];

        let query = "UPDATE `listitems` SET `deleted` = ? WHERE `list_id` = ? AND `deleted` IS NULL";
        if (args.items?.length) {
            query += ` AND \`id\` IN (` + item_ids.map(i => "?").join(", ") + `)`;
        }
        if (args.force !== true) {
            query += " AND `locked` <> 1";
        }

        try {
            const ret = await this._database!.run(query, [Date.now(), list_id, ...item_ids]);
            if (ret.changes?.changes) {
                await this.updateListModified({ list: args.list });
                return ret.changes.changes;
            }
            return 0;
        } catch (e) {
            Logger.Error(`MainSqliteBackendService.moveListitemsToTrash() failed: `, e);
            return false;
        }
    }

    /**
     * finally delete listitems
     * @param args.list list or id, from which the items should be deleted
     * @param args.items list of items or ids to delete, if not set all items will be deleted from the list
     * @param args.trash if set to true, the items will be deleted from the trash
     * @param args.force if set to true, locked items will also be deleted (only if not trash)
     * @returns number of deleted items, false on error
     */
    public async deleteListitems(args: { list: number | List; items?: number[] | Listitem[]; trash?: boolean; force?: boolean }): Promise<number | false> {
        if (!(await this.CheckConnection())) {
            return false;
        }

        const list_id = args.list instanceof List ? args.list.Id : args.list;
        const item_ids = args.items?.map(i => (typeof i === "number" ? i : i.Id)) || [];

        let query = `DELETE FROM \`listitems\` WHERE \`list_id\` = ? AND \`deleted\` ${args.trash === true ? "IS NOT NULL" : "IS NULL"}`;

        if (item_ids.length > 0) {
            query += ` AND \`id\` IN (` + item_ids.map(i => "?").join(", ") + `)`;
        }
        if (args.trash !== true && args.force !== true) {
            query += " AND `locked` <> 1";
        }

        const ret = await this._database!.run(query, [list_id, ...item_ids]);
        if (ret.changes?.changes) {
            if (args.trash === false) {
                await this.updateListModified({ list: args.list });
            }
            return ret.changes.changes;
        }

        return false;
    }

    /**
     * restores lists from trash
     * @param args.lists list ids or List objects to restore, or undefined to restore all
     * @returns number of restored lists, or false on error
     */
    public async restoreListsFromTrash(args: { lists?: number[] | List[] }): Promise<number | false> {
        if (!(await this.CheckConnection())) {
            return false;
        }

        const list_ids = args.lists?.map(l => (typeof l === "number" ? l : l.Id)) ?? [];

        let query = `UPDATE \`lists\` SET \`deleted\` = NULL, \`modified\` = ? WHERE \`deleted\` IS NOT NULL`;
        if (list_ids.length > 0) {
            query += ` AND \`id\` IN (${list_ids.map(() => "?").join(",")})`;
        }

        try {
            const ret = await this._database!.run(query, [Date.now(), ...list_ids]);
            if (ret.changes?.changes) {
                return ret.changes.changes;
            }
            return 0;
        } catch (e) {
            Logger.Error("MainSqliteBackendService.restoreListsFromTrash() failed", e, list_ids);
            return false;
        }
    }

    /**
     * restore listitems from trash
     * @param args.list list or id of list to restore items from trash
     * @param args.items list of items or ids to restore from trash
     * @returns number of restored items, false on error
     */
    public async restoreListitemsFromTrash(args: { list: number | List; items?: number[] | Listitem[] }): Promise<number | false> {
        if (!(await this.CheckConnection())) {
            return false;
        }
        let start_order = await this.getNextListitemOrder({ list: args.list });
        const list_id = typeof args.list === "number" ? args.list : args.list.Id;
        const item_ids = args.items?.map(i => (typeof i === "number" ? i : i.Id)) || [];
        let query = `UPDATE \`listitems\` SET \`deleted\` = NULL WHERE \`list_id\` = ?`;
        if (item_ids.length > 0) {
            query += ` AND \`id\` IN (${item_ids.map(i => "?").join(", ")})`;
        }
        let updated = 0;
        try {
            const res = await this._database!.run(query, [list_id, ...item_ids]);
            if (res.changes?.changes) {
                updated = res.changes?.changes;
            }
        } catch (e) {
            Logger.Error("SqliteBackendService.restoreListitemsFromTrash() failed", e, args);
            return false;
        }

        if (updated > 0) {
            for (let i = 0; i < item_ids.length; i++) {
                query = `UPDATE \`listitems\` SET \`order\` = ?, \`modified\` = ? WHERE \`list_id\` = ? AND \`id\` = ?`;
                await this._database!.run(query, [start_order++, Date.now(), list_id, item_ids[i]]);
            }
            await this.updateListModified({ list: args.list });
        }

        return updated;
    }

    /**
     * wipe all listitems
     * @param args.trash if true, only wipe trash
     * @returns number of deleted listitems, false on error
     */
    public async wipeListitems(args?: { trash?: boolean }): Promise<number | false> {
        if (!(await this.CheckConnection())) {
            return false;
        }

        let query = `DELETE FROM \`listitems\` WHERE \`deleted\` ${args?.trash === false ? "IS NULL" : "IS NOT NULL"}`;
        try {
            const ret = await this._database!.run(query);
            if (ret.changes?.changes) {
                return ret.changes.changes;
            } else {
                return 0;
            }
        } catch (e) {
            Logger.Error("MainSqliteBackendService.wipeListitems() failed: ", e);
            return false;
        }
    }

    /**
     * removes trash lists and items, older than a certain amount of seconds
     * @param args.olderThan number of seconds, lists and items should not be older than
     * @param args.maxCount number of lists or items, that are maximally stored in trash
     * @returns number of removed lists or items, false on error
     */
    public async cleanUp(args: { olderThan?: number; maxCount?: number }): Promise<number | false> {
        if (!(await this.CheckConnection())) {
            Logger.Error("MainSqliteBackendService.cleanUp() failed: no connection to database");
            return false;
        }

        const deleted: { lists: number; items: number } = {
            lists: 0,
            items: 0,
        };

        if (args.olderThan) {
            const ts = Date.now() - args.olderThan * 1000;

            //First, remove all old lists from trash...
            let list_ids: number[] = [];
            try {
                const get_lists = `SELECT \`id\` FROM \`lists\` WHERE \`deleted\` IS NOT NULL AND \`deleted\` < ?`;
                const lists = await this._database!.query(get_lists, [ts]);
                list_ids = lists.values?.map((v: any) => Number(v.id)) ?? [];
            } catch (e) {
                Logger.Error(`MainSqliteBackendService.cleanUp() failed at getting list ids to clean up trash:`, e);
            }

            if (list_ids.length > 0) {
                const del = await this.deleteLists({ lists: list_ids, trash: true });
                if (del !== false) {
                    deleted.lists += del.lists;
                    deleted.items += del.items;
                } else {
                    Logger.Error(`Could not cleanUp trash lists older than ${new Date(ts).toLocaleString()}`);
                }
            }

            try {
                // now delete all listitems of lists, that are not in trash
                const query = `DELETE FROM \`listitems\` WHERE \`deleted\` IS NOT NULL AND \`deleted\` < ?`;
                const delitems = await this._database!.run(query, [ts]);
                if (delitems.changes?.changes) {
                    deleted.items += delitems.changes.changes;
                }
            } catch (e) {
                Logger.Error(`MainSqliteBackendService.cleanUp() failed at deleting trash listitems:`, e);
            }

            if (deleted.lists > 0 || deleted.items > 0) {
                Logger.Notice(`Deleted ${deleted.lists} list(s) and ${deleted.items} listitem(s) older than ${new Date(ts).toLocaleString()} from trash`);
            }
        }

        if (args.maxCount && args.maxCount > 0) {
            let list_ids: number[] = [];
            let del_lists = 0;
            let del_items = 0;
            try {
                const get_lists = `SELECT \`id\` FROM \`lists\` WHERE \`deleted\` IS NOT NULL ORDER BY \`deleted\` ASC LIMIT 50, -1`;
                const lists = await this._database!.query(get_lists);
                list_ids = lists.values?.map((v: any) => Number(v.id)) ?? [];
            } catch (e) {
                Logger.Error(`MainSqliteBackendService.cleanUp() failed at getting list ids to clean up trash:`, e);
            }

            if (list_ids.length > 0) {
                const del = await this.deleteLists({ lists: list_ids, trash: true });
                if (del !== false) {
                    del_lists = del.lists;
                    del_items += del.items;
                } else {
                    Logger.Error(`Could not cleanUp trash lists with maximum number of ${args.maxCount}`);
                }
            }

            const query = `DELETE FROM \`listitems\`
                WHERE \`id\` IN (
                    SELECT \`id\`
                    FROM (
                        SELECT \`id\`, ROW_NUMBER() OVER (PARTITION BY \`list_id\` ORDER BY \`deleted\` DESC) AS \`row_num\` FROM \`listitems\` WHERE \`deleted\` IS NOT NULL
                    )
                    WHERE \`row_num\` > ?
                );`;
            try {
                const del = await this._database!.run(query, [args.maxCount]);
                if (del.changes?.changes) {
                    del_items += del.changes.changes;
                }
            } catch (e) {
                Logger.Error(`Could not cleanUp trash listitems with maximum number of ${args.maxCount}:`, e);
            }

            if (del_lists > 0 || del_items > 0) {
                Logger.Notice(`Deleted ${del_lists} list(s) and ${del_items} listitem(s) due to not the latest ${args.maxCount} in trash`);
                deleted.lists += del_lists;
                deleted.items += del_items;
            }
        }

        const query = "DELETE FROM `listitems` WHERE `list_id` NOT IN (SELECT id FROM `lists`)";
        try {
            const del = await this._database!.run(query);
            if (del.changes?.changes) {
                deleted.items += del.changes.changes;
                Logger.Notice(`Deleted ${del.changes.changes} orphan listitem(s) in backend`);
            }
        } catch (e) {
            Logger.Error("Could not cleanUp orphan listitems:", e);
        }

        if (deleted.lists > 0 || deleted.items > 0) {
            Logger.Notice(`Cleaned up ${deleted.lists} list(s) and ${deleted.items} item(s) in backend`);
        }

        return deleted.lists + deleted.items;
    }

    /**
     * gets the value of the next 'order' property for a list
     * @returns order property
     */
    public async getNextListOrder(): Promise<number> {
        if (!(await this.CheckConnection())) {
            return 0;
        }

        const query = `SELECT \`order\` FROM \`lists\` WHERE \`deleted\` IS NULL ORDER BY \`order\` DESC LIMIT 1`;
        try {
            const ret = await this._database!.query(query);
            if (ret.values?.[0]?.order) {
                return ret.values[0].order + 1;
            }
        } catch (e) {
            Logger.Error("MainSqliteBackendService.getNextListOrder() failed", e);
        }
        return 0;
    }

    /**
     * gets the value of the next 'order' property for a listitem in a list
     * @param args.list id or list object
     * @returns order property
     */
    public async getNextListitemOrder(args: { list: number | List }): Promise<number> {
        if (!(await this.CheckConnection())) {
            return 0;
        }

        const list_id = args.list instanceof List ? args.list.Id : args.list;
        const query = `SELECT \`order\` FROM \`listitems\` WHERE \`list_id\`=? AND \`deleted\` IS NULL ORDER BY \`order\` DESC LIMIT 1`;
        try {
            const ret = await this._database!.query(query, [list_id]);
            if (ret.values?.[0]?.order) {
                return ret.values[0].order + 1;
            }
        } catch (e) {
            Logger.Error(`MainSqliteBackendService.getNextListitemOrder failed:`, e);
        }
        return 0;
    }

    /**
     * updates the 'modified' property of a list to the current time
     * @param args.list the list to update
     */
    private async updateListModified(args: { list: number | List }): Promise<void> {
        if (!(await this.CheckConnection())) {
            return;
        }
        const list_id = args.list instanceof List ? args.list.Id : args.list;
        const query = `UPDATE \`lists\` SET \`modified\` = ? WHERE \`id\` = ?`;
        await this._database!.run(query, [Date.now(), list_id]);
    }

    private async CheckConnection(): Promise<boolean> {
        if (this._database) {
            return true;
        }
        Logger.Error(`No SQLite connection available. Retrying connection...`);
        return await this.Initialize();
    }
}

export type ListsOrder = "created" | "modified" | "deleted" | "order";
export type ListsOrderDirection = "ASC" | "DESC";
export type DatabaseType = string | number | null;
