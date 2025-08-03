import type { List } from "src/app/services/lists/list";
import type { ListitemModel } from "src/app/services/lists/listitem";
import type { ListsService } from "src/app/services/lists/lists.service";
import { SqliteService } from "src/app/services/storage/sqlite/sqlite.service";
import { ModelToListRev1 } from "./model-to-list-rev1";
import { ModelToListitemRev1 } from "./model-to-listitem-rev1";

export const ModelToList = async (json: any, sqliteService: SqliteService, listsService: ListsService, file: string, force_trash: boolean): Promise<List | undefined> => {
    if (!json.rev || json.rev == 1) {
        return await new ModelToListRev1(json, sqliteService, listsService, file).Import(force_trash);
    }
    throw new Error(`Unsupported import revision '${json.rev ?? "unknown"}'.`);
};

export const ModelToListitem = async (json: any, list_id: number, sqliteService: SqliteService, listsService: ListsService, force_trash: boolean): Promise<ListitemModel | undefined> => {
    if (!json.rev || json.rev == 1) {
        return await new ModelToListitemRev1(json, sqliteService, listsService).Import(list_id, force_trash);
    }
    throw new Error(`Unsupported import revision '${json.rev ?? "unknown"}'.`);
};
