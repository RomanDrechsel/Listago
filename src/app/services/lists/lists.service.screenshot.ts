import { Injectable, WritableSignal, inject, signal } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { HelperUtils } from "../../classes/utils/helper-utils";
import { LocalizationService } from "../localization/localization.service";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";
import { KeepInTrash } from "./keep-in-trash";
import { List } from "./list";
import { Listitem, ListitemModel } from "./listitem";
import { ListitemTrashModel } from "./listitems-trash-utils";

@Injectable({
    providedIn: "root",
})
export class ListsService {
    private onTrashItemsDatasetChangedSubject = new BehaviorSubject<ListitemTrashModel | undefined>(undefined);
    public onTrashItemsDatasetChanged$ = this.onTrashItemsDatasetChangedSubject.asObservable();

    private onTrashDatasetChangedSubject = new BehaviorSubject<List[] | undefined>(undefined);
    public onTrashDatasetChanged$ = this.onTrashDatasetChangedSubject.asObservable();

    private onListChangedSubject = new BehaviorSubject<List | undefined>(undefined);
    public onListChanged$ = this.onListChangedSubject.asObservable();

    public _keepInTrashStock: KeepInTrash.Enum = KeepInTrash.Default;

    public readonly Lists: WritableSignal<List[]> = signal([]);
    private readonly _listIndex: Map<string, List> = new Map();

    private readonly Locale = inject(LocalizationService);
    private readonly Preferences = inject(PreferencesService);

    public async Initialize() {
        await this.GetLists();
        this.Preferences.onPrefChanged$.subscribe(async arg => {
            if (arg.prop == EPrefProperty.AppLanguage) {
                await this.GetLists();
            }
        });
    }

    public async GetLists(reload: boolean = false): Promise<List[]> {
        let lists: List[] = [];
        if (this.Locale.CurrentLanguage.localeFile == "de") {
            lists = [
                List.fromBackend({ uuid: "1", name: "Wocheneinkäufe", created: Date.now(), order: 0, updated: Date.now() - 3456 * 1000, items: [1, 2, 3, 4, 5] }, true)!,
                List.fromBackend({ uuid: "2", name: "Muttis Geburtstags-Fete", created: Date.now(), order: 1, updated: Date.now() - 60 * 60 * 36 * 1000, items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, true)!,
                List.fromBackend({ uuid: "3", name: "Putzplan", created: Date.now(), order: 2, updated: Date.now() - 60 * 60 * 24 * 7 * 1000, items: [1, 2, 3, 4] }, true)!,
            ];
        } else {
            lists = [
                List.fromBackend({ uuid: "1", name: "Weekly groceries", created: Date.now(), order: 0, updated: Date.now() - 3456 * 1000, items: [1, 2, 3, 4, 5] })!,
                List.fromBackend({ uuid: "2", name: "Mom's birthday party", created: Date.now(), order: 1, updated: Date.now() - 60 * 60 * 36 * 1000, items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, true)!,
                List.fromBackend({ uuid: "3", name: "Cleaning plan", created: Date.now(), order: 2, updated: Date.now() - 60 * 60 * 24 * 7 * 1000, items: [1, 2, 3, 4] }, true)!,
            ];
        }

        lists.forEach(l => {
            this._listIndex.set(l.Uuid, l);
        });

        this.Lists.set(lists);
        return lists;
    }

    public async GetList(uuid: string): Promise<List | null> {
        if (this.Locale.CurrentLanguage.localeFile == "de") {
            if (uuid == "2") {
                return List.fromBackend({
                    uuid: "2",
                    name: "Muttis Geburtstags-Fete",
                    created: Date.now(),
                    order: 1,
                    updated: Date.now() - 60 * 60 * 36 * 1000,
                    items: [
                        { uuid: "1", order: 0, item: "Brot", created: Date.now() - 60 * 60 * 4 * 1000 },
                        { uuid: "2", order: 1, item: "Butter", created: Date.now() - 60 * 60 * 2.1 * 1000 },
                        { uuid: "3", order: 2, item: "Eier", created: Date.now() - 60 * 60 * 9.2 * 1000 },
                        { uuid: "4", order: 3, item: "Milch", note: "Laktose-frei", created: Date.now() - 60 * 60 * 12.35 * 1000 },
                        { uuid: "5", order: 4, item: "Eiscreme", note: "Ist im Angebot", created: Date.now() - 60 * 60 * 0.23 * 1000 },
                        { uuid: "6", order: 5, item: "Brot", created: Date.now() - 60 * 60 * 4 * 1000 },
                        { uuid: "7", order: 6, item: "Butter", created: Date.now() - 60 * 60 * 2.1 * 1000 },
                        { uuid: "8", order: 7, item: "Eier", created: Date.now() - 60 * 60 * 9.2 * 1000 },
                        { uuid: "9", order: 8, item: "Milch", note: "Laktose-frei", created: Date.now() - 60 * 60 * 12.35 * 1000 },
                        { uuid: "10", order: 9, item: "Eiscreme", note: "Ist im Angebot", created: Date.now() - 60 * 60 * 0.23 * 1000 },
                        { uuid: "11", order: 10, item: "Brot", created: Date.now() - 60 * 60 * 4 * 1000 },
                        { uuid: "12", order: 11, item: "Butter", created: Date.now() - 60 * 60 * 2.1 * 1000 },
                    ],
                })!;
            } else if (uuid == "3") {
                return List.fromBackend({
                    uuid: "3",
                    name: "Putzplan",
                    created: Date.now(),
                    order: 2,
                    updated: Date.now() - 60 * 60 * 24 * 7 * 1000,
                    items: [
                        { uuid: "1", order: 0, item: "Brot", created: Date.now() - 60 * 60 * 4 * 1000 },
                        { uuid: "2", order: 1, item: "Butter", created: Date.now() - 60 * 60 * 2.1 * 1000 },
                        { uuid: "3", order: 2, item: "Eier", created: Date.now() - 60 * 60 * 9.2 * 1000 },
                        { uuid: "4", order: 3, item: "Milch", note: "Laktose-frei", created: Date.now() - 60 * 60 * 12.35 * 1000 },
                    ],
                })!;
            } else {
                return List.fromBackend({
                    uuid: uuid,
                    name: "Wocheneinkäufe",
                    created: Date.now(),
                    order: 0,
                    updated: Date.now() - 3456 * 1000,
                    items: [
                        { uuid: "1", order: 0, item: "Brot", created: Date.now() - 60 * 60 * 4 * 1000 },
                        { uuid: "2", order: 1, item: "Butter", created: Date.now() - 60 * 60 * 2.1 * 1000 },
                        { uuid: "3", order: 2, item: "8 Eier", created: Date.now() - 60 * 60 * 9.2 * 1000 },
                        { uuid: "4", order: 3, item: "Milch", note: "Laktose-frei", created: Date.now() - 60 * 60 * 12.35 * 1000 },
                        { uuid: "5", order: 4, item: "Eiscreme", note: "Ist im Angebot", created: Date.now() - 60 * 60 * 0.23 * 1000 },
                    ],
                })!;
            }
        } else {
            if (uuid == "2") {
                return List.fromBackend({
                    uuid: "2",
                    name: "Mom's birthday party",
                    created: Date.now(),
                    order: 1,
                    updated: Date.now() - 60 * 60 * 36 * 1000,
                    items: [
                        { uuid: "1", order: 0, item: "bread", created: Date.now() - 60 * 60 * 4 * 1000 },
                        { uuid: "2", order: 1, item: "butter", created: Date.now() - 60 * 60 * 2.1 * 1000 },
                        { uuid: "3", order: 2, item: "8 eggs", created: Date.now() - 60 * 60 * 9.2 * 1000 },
                        { uuid: "4", order: 3, item: "milk", note: "lactose-free", created: Date.now() - 60 * 60 * 12.35 * 1000 },
                        { uuid: "5", order: 4, item: "Ice cream", note: "on sale", created: Date.now() - 60 * 60 * 0.23 * 1000 },
                        { uuid: "6", order: 5, item: "bread", created: Date.now() - 60 * 60 * 4 * 1000 },
                        { uuid: "7", order: 6, item: "butter", created: Date.now() - 60 * 60 * 2.1 * 1000 },
                        { uuid: "8", order: 7, item: "8 eggs", created: Date.now() - 60 * 60 * 9.2 * 1000 },
                        { uuid: "9", order: 8, item: "milk", note: "lactose-free", created: Date.now() - 60 * 60 * 12.35 * 1000 },
                        { uuid: "10", order: 9, item: "Ice cream", note: "on sale", created: Date.now() - 60 * 60 * 0.23 * 1000 },
                        { uuid: "11", order: 10, item: "bread", created: Date.now() - 60 * 60 * 4 * 1000 },
                        { uuid: "12", order: 11, item: "butter", created: Date.now() - 60 * 60 * 2.1 * 1000 },
                    ],
                })!;
            } else if (uuid == "3") {
                return List.fromBackend({
                    uuid: "3",
                    name: "Cleaning plan",
                    created: Date.now(),
                    order: 2,
                    updated: Date.now() - 60 * 60 * 24 * 7 * 1000,
                    items: [
                        { uuid: "1", order: 0, item: "bread", created: Date.now() - 60 * 60 * 4 * 1000 },
                        { uuid: "2", order: 1, item: "butter", created: Date.now() - 60 * 60 * 2.1 * 1000 },
                        { uuid: "3", order: 2, item: "8 eggs", created: Date.now() - 60 * 60 * 9.2 * 1000 },
                        { uuid: "4", order: 3, item: "milk", note: "lactose-free", created: Date.now() - 60 * 60 * 12.35 * 1000 },
                    ],
                })!;
            } else {
                return List.fromBackend({
                    uuid: "1",
                    name: "Weekly groceries",
                    created: Date.now(),
                    order: 0,
                    updated: Date.now() - 3456 * 1000,
                    items: [
                        { uuid: "1", order: 0, item: "bread", created: Date.now() - 60 * 60 * 4 * 1000 },
                        { uuid: "2", order: 1, item: "butter", created: Date.now() - 60 * 60 * 2.1 * 1000 },
                        { uuid: "3", order: 2, item: "8 eggs", created: Date.now() - 60 * 60 * 9.2 * 1000 },
                        { uuid: "4", order: 3, item: "milk", note: "lactose-free", created: Date.now() - 60 * 60 * 12.35 * 1000 },
                        { uuid: "5", order: 4, item: "Ice cream", note: "on sale", created: Date.now() - 60 * 60 * 0.23 * 1000 },
                    ],
                })!;
            }
        }
    }

    public async GetTrash(): Promise<List[]> {
        return [];
    }

    public async GetListitemTrash(uuid: string): Promise<ListitemTrashModel | undefined> {
        return {
            uuid: await this.createUuid(),
            items: [],
        };
    }

    public async GetListItemsFromTrash(uuid: string): Promise<List | undefined> {
        return undefined;
    }

    public async NewList() {}

    public async EditList(list: List) {}

    public async DeleteList(list: List, force: boolean = false): Promise<boolean | undefined> {
        return undefined;
    }

    public async EmptyList(list: List, force: boolean = false): Promise<boolean | undefined> {
        return undefined;
    }

    public async NewListitem(list: List): Promise<boolean | undefined> {
        return undefined;
    }

    public async EditListitem(list: List, item: Listitem): Promise<boolean | undefined> {
        return undefined;
    }

    public async DeleteListitem(list: List, item: Listitem, force: boolean = false): Promise<boolean | undefined> {
        return undefined;
    }

    public async EraseListitemFromTrash(trash: ListitemTrashModel, item: ListitemModel): Promise<boolean | undefined> {
        return undefined;
    }

    public async EmptyTrash(): Promise<boolean | undefined> {
        return undefined;
    }

    public async EmptyListitemTrash(trash: ListitemTrashModel): Promise<boolean | undefined> {
        return undefined;
    }

    public async ReorderLists(lists: List[]): Promise<List[]> {
        return lists;
    }

    public async ReorderListitems(list: List, items: Listitem[]): Promise<List> {
        return list;
    }

    public async ToggleHiddenListitem(list: List, item: Listitem) {}

    public async EraseListFromTrash(list: List, force: boolean = false): Promise<boolean | undefined> {
        return undefined;
    }

    public async RestoreListFromTrash(list: List): Promise<boolean | undefined> {
        return undefined;
    }

    public async RestoreListitemFromTrash(trash: ListitemTrashModel, item: ListitemModel): Promise<boolean | undefined> {
        return undefined;
    }

    public async BackendSize(): Promise<{ lists: { size: number; files: number }; trash: { size: number; files: number } }> {
        return { lists: { size: 1234, files: 2 }, trash: { size: 31243, files: 15 } };
    }

    public async ToggleLockListitem(list: List, item: Listitem): Promise<void> {}

    public async RenameList(list: List) {}

    public async WipeTrash(force: boolean = false): Promise<boolean | undefined> {
        return undefined;
    }

    public async GetTrashCount(): Promise<number> {
        return 0;
    }

    public async GetItemsTrashCount(): Promise<number> {
        return 0;
    }

    public async WipeListitemTrashes(): Promise<void> {}

    public PurgeListDetails() {}

    public async createUuid(): Promise<string> {
        return HelperUtils.RandomNumber(20);
    }
}
