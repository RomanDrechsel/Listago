import { List } from "src/app/services/lists/list";
import { Listitem } from "src/app/services/lists/listitem";
import { ListModel } from "../list-model";
import { ListitemModel } from "../listitem-model";

export const ListToModel = (list: List): ListModel => {
    return {
        id: list.Id != null ? list.Id : undefined,
        name: list.Name,
        order: list.Order,
        items: list.Items.map(item => ListitemToModel(item)),
        created: list.Created,
        deleted: list.Deleted ? list.Deleted : undefined,
        updated: list.Modified,
        reset: list.Reset,
        syncDevices: list.SyncDevices,
        uuid: list.LegacyUuid,
        rev: List.ListRevision,
    };
};

export const ListitemToModel = (item: Listitem): ListitemModel => {
    return {
        id: item.Id != null ? item.Id : undefined,
        item: item.Item,
        note: item.Note != null ? item.Note : undefined,
        order: item.Order,
        created: item.Created,
        hidden: item.Hidden,
        locked: item.Locked,
        updated: item.Modified,
        deleted: item.Deleted ? item.Deleted : undefined,
        uuid: item.LegacyUuid,
        rev: Listitem.ListitemRevision,
    };
};
