import { inject, Injectable } from "@angular/core";
import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Logger } from "src/app/services/logging/logger";
import { List, type ListModel } from "../../../lists/list";
import { Listitem, ListitemModel } from "../../../lists/listitem";
import { MainUpgradeStatements } from "../main-upgrade-statments";
import { SqliteService } from "../sqlite.service";

@Injectable({
    providedIn: "root",
})
export class ListsSqliteBackendService {
    private readonly _sqliteService = inject(SqliteService);

    public MaxTrashCount: number | undefined = undefined;

    public async Initialize(): Promise<boolean> {
        await this._sqliteService.addUpgradeStatement(MainUpgradeStatements());
        const db = await this._sqliteService.openDatabase();
        if (db) {
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
        if (!args.orderBy) {
            args.orderBy = "order";
        }
        if (!args.orderDir) {
            args.orderDir = "ASC";
        }

        const ret: List[] = [];
        const query = `SELECT * FROM \`lists\` WHERE \`deleted\` ${args.trash ? "IS NOT NULL" : "IS NULL"} ORDER BY \`${args.orderBy}\` ${args.orderDir}`;
        //const lists = (await this._database!.query(query)).values as ListModel[] | undefined;
        const lists = (await this._sqliteService.Query(query)) as ListModel[] | undefined;
        if (lists) {
            for (let i = 0; i < lists.length; i++) {
                if (args.peek === false) {
                    const queryItems = `SELECT * FROM \`listitems\` WHERE \`list_id\` = ? AND \`deleted\` IS NULL ORDER BY \`${args.orderBy}\` ${args.orderDir}`;
                    const items = (await this._sqliteService.Query(queryItems, [lists[i].id])) as ListitemModel[] | undefined;
                    if (!items) {
                        Logger.Error(`Could not query items of list ${List.toLog(lists[i])}`);
                    }
                    ret.push(new List(lists[i], items, undefined, false));
                } else {
                    const queryItems = `SELECT COUNT(*) AS \`count\` FROM \`listitems\` WHERE \`list_id\` = ? AND \`deleted\` IS NULL`;
                    const queryCount = await this._sqliteService.Query(queryItems, [lists[i].id]);
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
    public async queryList(args: { list: List | number; itemsOrderBy?: ListsOrder; itemsOrderDir?: ListsOrderDirection }): Promise<List | undefined> {
        const list_id = args.list instanceof List ? args.list.Id : args.list;
        let list: ListModel | undefined;

        const query = `SELECT * FROM \`lists\` WHERE \`id\` = ? AND \`deleted\` IS NULL LIMIT 1;`;
        const ret = (await this._sqliteService.Query(query, [list_id])) as ListModel[] | undefined;
        if (ret) {
            list = ret[0];
        } else {
            Logger.Error(`Could not query list ${list instanceof List ? list.toLog() : "id:" + list}`);
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
            const query = `SELECT * FROM \`listitems\` WHERE \`list_id\`=? AND deleted IS NULL ORDER BY \`${args.itemsOrderBy}\` ${args.itemsOrderDir}`;
            listitems = (await this._sqliteService.Query(query, [list_id])) as ListitemModel[] | undefined;
            if (!listitems) {
                Logger.Error(`Could not query listitems for list ${List.toLog(list)}`);
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
        const list_id = args.list instanceof List ? args.list.Id : args.list;
        if (!args.itemsOrderBy) {
            args.itemsOrderBy = "order";
        }
        if (!args.itemsOrderDir) {
            args.itemsOrderDir = "ASC";
        }
        const query = `SELECT * FROM \`listitems\` WHERE \`list_id\`=? AND deleted ${!args.trash ? "IS NULL" : "IS NOT NULL"} ORDER BY \`${args.itemsOrderBy}\` ${args.itemsOrderDir}`;
        const models = (await this._sqliteService.Query(query, [list_id])) as ListitemModel[] | undefined;
        if (models) {
            const items: Listitem[] = [];
            models.forEach(m => {
                items.push(new Listitem(m));
            });
            return items;
        } else {
            Logger.Error(`Could not query listitems for list ${args.list instanceof List ? args.list.toLog() : list_id}`);
            return undefined;
        }
    }

    /**
     * queries the number of lists
     * @param args.trash if true, returns the number of lists in trash
     * @returns number of lists
     */
    public async queryListsCount(args?: { trash?: boolean }): Promise<number> {
        const query = `SELECT COUNT(*) AS \`count\` FROM \`lists\` WHERE \`deleted\` ${args?.trash ? "IS NOT NULL" : "IS NULL"} `;
        const count = await this._sqliteService.Query(query);
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
        if (args.list instanceof List) {
            args.list = args.list.Id;
        }

        let query;
        if (args.list === "all") {
            if (args.trash === true) {
                query = "SELECT COUNT(*) AS `count` FROM `listitems` JOIN `lists` ON `listitems`.`list_id` = `lists`.`id` WHERE `listitems`.`deleted` IS NOT NULL OR `lists`.`deleted` IS NOT NULL";
            } else {
                query = "SELECT COUNT(*) AS `count` FROM `listitems` JOIN `lists` ON `listitems`.`list_id` = `lists`.`id` WHERE `listitems`.`deleted` IS NULL AND `lists`.`deleted` IS NULL";
            }
        } else {
            query = `SELECT COUNT(*) AS \`count\` FROM \`listitems\` WHERE \`deleted\` ${args?.trash ? "IS NOT NULL" : "IS NULL"} AND \`list_id\` = ?`;
        }

        const res = await this._sqliteService.Query(query, args.list !== "all" ? [args.list] : undefined);
        if (res && res.length > 0) {
            return Number(res[0].count);
        } else {
            Logger.Error("MainSqliteBackendService.queryListitemsCount() failed");
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

        const transaction_result = await this._sqliteService.Transaction(async (conn: SQLiteDBConnection) => {
            let list_id: number | undefined = undefined;
            if (args.list.isVirtual) {
                backend.delete("id");
                const keys = "`" + Array.from(backend.keys()).join("`, `") + "`";
                const qms = Array.from(backend.keys())
                    .map(() => "?")
                    .join(", ");
                const query = `INSERT INTO \`lists\` (${keys}) VALUES (${qms})`;
                const ret = await conn.run(query, Array.from(backend.values()), false);
                list_id = ret.changes?.lastId;
            } else {
                const query = `UPDATE \`lists\` SET ${Array.from(backend.keys())
                    .map(key => `\`${key}\`=?`)
                    .join(", ")} WHERE \`id\`=${args.list.Id}`;
                await conn.run(query, Array.from(backend.values()), false);
                list_id = args.list.Id;
            }

            const listitem_id_map = new Map<number, number>();
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
                            const ret = await conn.run(query, Array.from(itemBackend.values()), false);
                            if (ret.changes?.lastId) {
                                listitem_id_map.set(item.Id, ret.changes.lastId);
                            }
                        } else {
                            const query = `UPDATE \`listitems\` SET ${Array.from(itemBackend.keys())
                                .map(key => `\`${key}\`=?`)
                                .join(", ")} WHERE \`id\`=${item.Id}`;
                            await conn.run(query, Array.from(itemBackend.values()), false);
                        }
                    }
                }
                listitem_id_map.forEach((val: number, key: number) => {
                    const item = args.list.Items.find(i => i.Id == key);
                    if (item) {
                        item.Id = val;
                    }
                });
                args.list.Clean();
            } else {
                Logger.Error(`Could not store list ${args.list.toLog()} in backend`);
                return false;
            }
            return list_id;
        });

        if (transaction_result) {
            args.list.Id = transaction_result;
        }
        return transaction_result;
    }

    /**
     * moves the given lists to trash
     * @param args.lists list of ids or List objects to move to trash
     * @returns number of moved lists, false on error
     */
    public async moveListsToTrash(args: { lists?: number[] | List[] }): Promise<number | false> {
        const list_ids = args.lists?.map(l => (l instanceof List ? l.Id : l)) ?? [];
        let query = `UPDATE \`lists\` SET \`deleted\` = ? WHERE \`deleted\` IS NULL`;
        if (list_ids.length > 0) {
            query += ` AND \`id\` IN (${list_ids.map(u => `?`).join(", ")})`;
        }

        const res = await this._sqliteService.Execute(query, [Date.now(), ...list_ids]);
        if (res?.changes?.changes) {
            return res.changes.changes;
        } else if (!res?.changes) {
            Logger.Error(`Could not move ${list_ids.length} list(s) to trash`, args.lists);
            return false;
        }
        return 0;
    }

    /**
     * finally deletes lists from backend
     * @param args.lists array of lists (or ids) to delete
     * @param args.trash if true, only lists from trash will be deleted
     * @returns number of lists deleted, or false if failed
     */
    public async deleteLists(args: { lists?: number[] | List[]; trash?: boolean }): Promise<{ lists: number; items: number } | false> {
        return await this._sqliteService.Transaction(async (conn: SQLiteDBConnection) => {
            const deleted = { lists: 0, items: 0 };

            const list_ids = args.lists?.map(l => (l instanceof List ? l.Id : l)) ?? [];
            let list_ids_delete: number[] | undefined = undefined;
            if (list_ids.length == 0) {
                const query_all = `SELECT \`id\` FROM \`lists\` WHERE \`deleted\` ${args.trash === false ? "IS NULL" : "IS NOT NULL"};`;
                const ret = await conn.query(query_all);
                if (ret.values) {
                    if (ret.values.length == 0) {
                        return deleted;
                    }

                    list_ids_delete = ret.values.map(id => id.id);
                } else {
                    return false;
                }
            }
            let query = `DELETE FROM \`lists\` WHERE \`deleted\` ${args.trash === false ? "IS NULL" : "IS NOT NULL"}`;
            if (list_ids.length > 0) {
                query += " AND `id` IN (" + list_ids.map(() => "?").join(",") + ")";
            }

            const ret = await conn.run(query, list_ids, false);
            if (list_ids.length > 0) {
                list_ids_delete = list_ids;
            }
            if (list_ids_delete) {
                if (ret.changes?.changes && ret.changes?.changes > 0) {
                    deleted.lists += ret.changes.changes;
                    query = "DELETE FROM `listitems` WHERE `list_id` IN (" + list_ids_delete.map(() => "?").join(",") + ")";
                    const ret2 = await conn.run(query, list_ids_delete, false);
                    if (ret2.changes?.changes && ret2.changes?.changes > 0) {
                        deleted.items += ret2.changes.changes;
                    }
                } else if (!ret.changes) {
                    Logger.Error(`Could not remove listitems for ${list_ids_delete.length} just deleted list(s)`);
                }
            }

            return deleted;
        });
    }

    /**
     * move listitems to trash
     * @param args.list list, to which the items should be moved
     * @param args.items list of items to move, or all items in the list
     * @param args.force if true, move items to trash, even if they are locked
     * @returns number of moved items, or false on error
     */
    public async moveListitemsToTrash(args: { list: number | List; items?: number[] | Listitem[]; force?: boolean }): Promise<number | false> {
        const list_id = args.list instanceof List ? args.list.Id : args.list;
        const item_ids = args.items?.map(i => (typeof i === "number" ? i : i.Id)) || [];

        let query = "UPDATE `listitems` SET `deleted` = ? WHERE `list_id` = ? AND `deleted` IS NULL";
        if (args.items?.length) {
            query += ` AND \`id\` IN (` + item_ids.map(i => "?").join(", ") + `)`;
        }
        if (args.force !== true) {
            query += " AND `locked` <> 1";
        }

        const ret = await this._sqliteService.Execute(query, [Date.now(), list_id, ...item_ids]);
        if (ret?.changes?.changes) {
            await this.updateListModified({ list: args.list });
            return ret.changes.changes;
        } else if (!ret?.changes) {
            Logger.Error(`Could not move ${item_ids.length} listitems(s) to trash for list ${args.list instanceof List ? args.list.toLog() : args.list}`);
            return false;
        }
        return 0;
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
        const list_id = args.list instanceof List ? args.list.Id : args.list;
        const item_ids = args.items?.map(i => (typeof i === "number" ? i : i.Id)) || [];

        let query = `DELETE FROM \`listitems\` WHERE \`list_id\` = ? AND \`deleted\` ${args.trash === true ? "IS NOT NULL" : "IS NULL"}`;

        if (item_ids.length > 0) {
            query += " AND `id` IN (" + item_ids.map(i => "?").join(", ") + ")";
        }
        if (args.trash !== true && args.force !== true) {
            query += " AND `locked` <> 1";
        }

        const ret = await this._sqliteService.Execute(query, [list_id, ...item_ids]);
        if (ret?.changes?.changes) {
            if (args.trash === false) {
                await this.updateListModified({ list: args.list });
            }
            return ret.changes.changes;
        } else if (!ret?.changes) {
            Logger.Error(`Could not delete ${item_ids.length} listitem(s) from list ${args.list instanceof List ? args.list.toLog() : args.list} ${args.trash ? "(trashed)" : ""}"`);
            return false;
        }

        return 0;
    }

    /**
     * restores lists from trash
     * @param args.lists list ids or List objects to restore, or undefined to restore all
     * @returns number of restored lists, or false on error
     */
    public async restoreListsFromTrash(args: { lists: number[] | List[] }): Promise<number | false> {
        const list_ids = args.lists.map(l => (typeof l === "number" ? l : l.Id)) ?? [];

        let query = "UPDATE `lists` SET `deleted` = NULL, `modified` = ? WHERE `deleted` IS NOT NULL";
        if (list_ids.length > 0) {
            query += ` AND \`id\` IN (${list_ids.map(() => "?").join(",")})`;
        }

        const ret = await this._sqliteService.Execute(query, [Date.now(), ...list_ids]);
        if (ret?.changes?.changes) {
            return ret.changes.changes;
        } else if (!ret?.changes) {
            if (args.lists.length == 1) {
                Logger.Error(`Could not restore list ${args.lists[0] instanceof List ? args.lists[0].toLog() : "id: " + args.lists[0]} from trash`);
            } else {
                Logger.Error(`Could not restore ${list_ids.length} lists from trash`);
            }
            return false;
        }
        return 0;
    }

    /**
     * restore listitems from trash
     * @param args.list list or id of list to restore items from trash
     * @param args.items list of items or ids to restore from trash
     * @returns number of restored items, false on error
     */
    public async restoreListitemsFromTrash(args: { list: number | List; items?: number[] | Listitem[] }): Promise<number | false> {
        return this._sqliteService.Transaction(async (conn: SQLiteDBConnection) => {
            let start_order = await this.getNextListitemOrder({ list: args.list, transaction_conn: conn });
            const list_id = typeof args.list === "number" ? args.list : args.list.Id;
            const item_ids = args.items?.map(i => (typeof i === "number" ? i : i.Id)) || [];
            let query = "UPDATE `listitems` SET `deleted` = NULL WHERE `list_id` = ?";
            if (item_ids.length > 0) {
                query += ` AND \`id\` IN (${item_ids.map(i => "?").join(", ")})`;
            }
            let updated = 0;

            const res = await conn.run(query, [list_id, ...item_ids], false);
            if (res?.changes?.changes) {
                updated = res.changes?.changes;
            } else if (!res?.changes) {
                Logger.Error(`Could not restore ${item_ids.length} listitem(s) of list ${args.list instanceof List ? args.list.toLog() : "id: " + args.list}`);
                return false;
            }

            if (updated > 0) {
                for (let i = 0; i < item_ids.length; i++) {
                    query = "UPDATE `listitems` SET `order` = ?, `modified` = ? WHERE `list_id` = ? AND `id` = ?";
                    await conn.run(query, [start_order++, Date.now(), list_id, item_ids[i]], false);
                }
            }
            await this.updateListModified({ list: args.list, transaction_conn: conn });
            return updated;
        });
    }

    /**
     * wipe all listitems
     * @param args.trash if true, only wipe trash
     * @returns number of deleted listitems, false on error
     */
    public async wipeListitems(args?: { trash?: boolean }): Promise<number | false> {
        let query = `DELETE FROM \`listitems\` WHERE \`deleted\` ${args?.trash === false ? "IS NULL" : "IS NOT NULL"}`;
        const ret = await this._sqliteService.Execute(query);
        if (ret?.changes?.changes) {
            return ret.changes.changes;
        } else if (!ret?.changes) {
            Logger.Error(`Could not wipe listitems ${args?.trash === true ? "in trash" : ""}`);
            return false;
        }
        return 0;
    }

    /**
     * removes trash lists and items, older than a certain amount of seconds
     * @param args.olderThan number of seconds, lists and items should not be older than
     * @param args.maxCount number of lists or items, that are maximally stored in trash
     * @returns number of removed lists or items, false on error
     */
    public async cleanUp(args: { olderThan?: number; maxCount?: number }): Promise<number | false> {
        const deleted: { lists: number; items: number } = {
            lists: 0,
            items: 0,
        };

        if (args.olderThan) {
            const ts = Date.now() - args.olderThan * 1000;

            //First, remove all old lists from trash...
            let list_ids: number[] = [];
            const get_lists = "SELECT `id` FROM `lists` WHERE `deleted` IS NOT NULL AND `deleted` < ?";
            const lists = await this._sqliteService.Query(get_lists, [ts]);
            if (lists) {
                list_ids = lists.map((v: any) => Number(v.id)) ?? [];
            } else {
                Logger.Error("Backend cleanup: failed at getting list ids to clean up trash");
            }

            if (list_ids.length > 0) {
                const del = await this.deleteLists({ lists: list_ids, trash: true });
                if (del !== false) {
                    deleted.lists += del.lists;
                    deleted.items += del.items;
                } else {
                    Logger.Error(`Backend cleanup: could not cleanUp trash lists older than ${new Date(ts).toLocaleString()}`);
                }
            }

            // now delete all listitems of lists, that are not in trash
            const query = "DELETE FROM `listitems` WHERE `deleted` IS NOT NULL AND `deleted` < ?";
            const delitems = await this._sqliteService.Execute(query, [ts]);
            if (delitems?.changes?.changes) {
                deleted.items += delitems.changes.changes;
            } else if (!delitems?.changes) {
                Logger.Error(`Backend cleanup: failed at deleting trash listitems older than ${new Date(ts).toLocaleString()}`);
            }

            if (deleted.lists > 0 || deleted.items > 0) {
                Logger.Notice(`Backend cleanup: deleted ${deleted.lists} list(s) and ${deleted.items} listitem(s) older than ${new Date(ts).toLocaleString()} from trash`);
            }
        }

        if (args.maxCount && args.maxCount > 0) {
            let list_ids: number[] = [];
            let del_lists = 0;
            let del_items = 0;

            const get_lists = `SELECT \`id\` FROM \`lists\` WHERE \`deleted\` IS NOT NULL ORDER BY \`deleted\` DESC LIMIT ${args.maxCount}, -1`;
            const lists = await this._sqliteService.Query(get_lists);
            if (lists) {
                list_ids = lists.map((v: any) => Number(v.id)) ?? [];
            } else {
                Logger.Error(`Backend cleanup: failed at getting list ids to clean up trash:`);
            }

            if (list_ids.length > 0) {
                const del = await this.deleteLists({ lists: list_ids, trash: true });
                if (del !== false) {
                    del_lists = del.lists;
                    del_items += del.items;
                } else {
                    Logger.Error(`Backend cleanup: could not cleanUp trash lists with maximum number of ${args.maxCount}`);
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

            const del = await this._sqliteService.Execute(query, [args.maxCount]);
            if (del?.changes?.changes) {
                del_items += del.changes.changes;
            } else if (!del?.changes) {
                Logger.Error("Backend cleanup: could not cleanUp trash listitems with maximum number of ${args.maxCount}");
            }

            if (del_lists > 0 || del_items > 0) {
                Logger.Notice(`Backend cleanup: deleted ${del_lists} list(s) and ${del_items} listitem(s) due to not the latest ${args.maxCount} in trash`);
                deleted.lists += del_lists;
                deleted.items += del_items;
            }
        }

        //next, remove orphan listitems
        const query = "DELETE FROM `listitems` WHERE `list_id` NOT IN (SELECT id FROM `lists`)";

        const del = await this._sqliteService.Execute(query);
        if (del?.changes?.changes) {
            deleted.items += del.changes.changes;
            Logger.Notice(`Deleted ${del.changes.changes} orphan listitem(s) in backend`);
        } else if (!del?.changes) {
            Logger.Error("Backend cleanup: could not cleanUp orphan listitems:");
        }

        if (deleted.lists > 0 || deleted.items > 0) {
            Logger.Notice(`Backend cleanup: cleaned up ${deleted.lists} list(s) and ${deleted.items} item(s) in backend`);
        }

        return deleted.lists + deleted.items;
    }

    /**
     * gets the value of the next 'order' property for a list
     * @returns order property
     */
    public async getNextListOrder(args?: { transaction_conn?: SQLiteDBConnection }): Promise<number> {
        const query = "SELECT `order` FROM `lists` WHERE `deleted` IS NULL ORDER BY `order` DESC LIMIT 1";

        if (args?.transaction_conn) {
            const ret = await args.transaction_conn.query(query);
            if (ret.values?.[0]?.order) {
                return ret.values[0].order + 1;
            } else if (!ret.values) {
                Logger.Error("Could not query next list order number");
            }
        } else {
            const ret = await this._sqliteService.Query(query);
            if (ret?.[0]?.order) {
                return ret[0].order + 1;
            } else if (!ret) {
                Logger.Error("Could not query next list order number");
            }
        }

        return 0;
    }

    /**
     * gets the value of the next 'order' property for a listitem in a list
     * @param args.list id or list object
     * @returns order property
     */
    public async getNextListitemOrder(args: { list: number | List; transaction_conn?: SQLiteDBConnection }): Promise<number> {
        const list_id = args.list instanceof List ? args.list.Id : args.list;
        const query = "SELECT `order` FROM `listitems` WHERE `list_id`=? AND `deleted` IS NULL ORDER BY `order` DESC LIMIT 1";
        if (args.transaction_conn) {
            const ret = await args.transaction_conn.query(query, [list_id]);
            if (ret.values?.[0]?.order) {
                return ret.values[0].order + 1;
            } else if (!ret.values) {
                Logger.Error("Could not query next listitem order number");
            }
        } else {
            const ret = await this._sqliteService.Query(query, [list_id]);
            if (ret?.[0]?.order) {
                return ret[0].order + 1;
            } else if (!ret.values) {
                Logger.Error("Could not query next listitem order number");
            }
        }
        return 0;
    }

    /**
     * returns the size of the database file
     * @returns size of the database in bytes
     */
    public async DatabaseSize(): Promise<number> {
        try {
            const file = await Filesystem.stat({ path: `../databases/${SqliteService.DatabaseNameMain}SQLite.db`, directory: Directory.Library });
            return file.size;
        } catch (e) {
            Logger.Error(`Could not get database size: `, e);
            return -1;
        }
    }

    /**
     * returns the number of lists and items in the backend
     * @returns number of lists and items (in and out of trash)
     */
    public async DatabaseStats(): Promise<{ lists: { lists: number; items: number }; trash: { lists: number; items: number } }> {
        const lists = await this.queryListsCount({ trash: false });
        const items = await this.queryListitemsCount({ list: "all", trash: false });
        const trash_lists = await this.queryListsCount({ trash: true });
        const trash_items = await this.queryListitemsCount({ list: "all", trash: true });

        return { lists: { lists: lists, items: items }, trash: { lists: trash_lists, items: trash_items } };
    }

    /**
     * updates the 'modified' property of a list to the current time
     * @param args.list the list to update
     */
    private async updateListModified(args: { list: number | List; transaction_conn?: SQLiteDBConnection }): Promise<void> {
        const list_id = args.list instanceof List ? args.list.Id : args.list;
        const query = `UPDATE \`lists\` SET \`modified\` = ? WHERE \`id\` = ?`;
        if (args.transaction_conn) {
            await args.transaction_conn.run(query, [Date.now(), list_id], false);
        } else {
            await this._sqliteService.Execute(query, [Date.now(), list_id]);
        }
    }
}

export type ListsOrder = "created" | "modified" | "deleted" | "order";
export type ListsOrderDirection = "ASC" | "DESC";
export type DatabaseType = string | number | null;
