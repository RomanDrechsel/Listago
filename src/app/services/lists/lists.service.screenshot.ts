import { inject, Injectable } from "@angular/core";
import { ModalController } from "@ionic/angular/standalone";
import { BehaviorSubject } from "rxjs";
import { ListEditor } from "src/app/components/list-editor/list-editor.component";
import type { ConnectIQDevice } from "../connectiq/connect-iq-device";
import { LocalizationService } from "../localization/localization.service";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";
import { type ListsOrder, type ListsOrderDirection, ListsSqliteBackendService } from "../storage/sqlite/lists/lists-sqlite-backend.service";
import { List, type ListReset, type ListSyncDevice } from "./list";
import { Listitem } from "./listitem";

@Injectable({
    providedIn: "root",
})
export class ListsService {
    private onTrashItemsDatasetChangedSubject = new BehaviorSubject<List | undefined>(undefined);
    public onTrashItemsDatasetChanged$ = this.onTrashItemsDatasetChangedSubject.asObservable();

    private onTrashDatasetChangedSubject = new BehaviorSubject<List[] | undefined>(undefined);
    public onTrashDatasetChanged$ = this.onTrashDatasetChangedSubject.asObservable();

    private onListChangedSubject = new BehaviorSubject<List | undefined>(undefined);
    public onListChanged$ = this.onListChangedSubject.asObservable();

    private onListsChangedSubject = new BehaviorSubject<List[] | undefined>(undefined);
    public onListsChanged$ = this.onListsChangedSubject.asObservable();

    private readonly Locale = inject(LocalizationService);
    private readonly Preferences = inject(PreferencesService);
    public readonly BackendService = inject(ListsSqliteBackendService);
    private readonly ModalCtrl = inject(ModalController);

    public async Initialize() {
        this.Preferences.onPrefChanged$.subscribe(async arg => {
            if (arg.prop == EPrefProperty.AppLanguage) {
                await this.GetLists();
            }
        });
    }

    public async GetLists(args?: { orderBy?: ListsOrder; orderDir?: ListsOrderDirection }): Promise<List[]> {
        if (this.Locale.CurrentLanguage.localeFile == "de") {
            return [
                new List({ id: 1, name: "Wocheneinkäufe", modified: Date.now() - 3456 * 1000, created: Date.now(), order: 0 }, undefined, 9),
                new List({ id: 2, name: "Muttis Geburtstags-Fete", modified: Date.now() - 60 * 60 * 36 * 1000, created: Date.now(), order: 1 }, undefined, 12),
                new List({ id: 3, name: "Putzplan", modified: Date.now() - 60 * 60 * 24 * 7 * 1000, created: Date.now(), order: 2 }, undefined, 4),
            ];
        } else {
            return [
                new List({ id: 1, name: "Weekly groceries", modified: Date.now() - 3456 * 1000, created: Date.now(), order: 0 }, undefined, 5),
                new List({ id: 2, name: "Mom's birthday party", modified: Date.now() - 60 * 60 * 36 * 1000, created: Date.now(), order: 1 }, undefined, 12),
                new List({ id: 3, name: "Cleaning plan", modified: Date.now() - 60 * 60 * 24 * 7 * 1000, created: Date.now(), order: 2 }, undefined, 4),
            ];
        }
    }

    public async GetList(id: number): Promise<List | undefined> {
        if (this.Locale.CurrentLanguage.localeFile == "de") {
            return new List(
                {
                    id: id,
                    name: "Wocheneinkäufe",
                    created: Date.now(),
                    order: 0,
                    modified: Date.now() - 3456 * 1000,
                },
                [
                    { id: 1, list_id: id, order: 0, item: "Brot", created: Date.now() - 60 * 60 * 4 * 1000, modified: Date.now() },
                    { id: 2, list_id: id, order: 1, item: "Butter", created: Date.now() - 60 * 60 * 2.1 * 1000, modified: Date.now() },
                    { id: 3, list_id: id, order: 2, item: "8 Eier", created: Date.now() - 60 * 60 * 9.2 * 1000, modified: Date.now() },
                    { id: 4, list_id: id, order: 3, item: "Milch", note: "Laktose-frei", created: Date.now() - 60 * 60 * 12.35 * 1000, modified: Date.now() },
                    { id: 5, list_id: id, order: 4, item: "Eiscreme", note: "Ist im Angebot", created: Date.now() - 60 * 60 * 0.23 * 1000, modified: Date.now() },
                    { id: 6, list_id: id, order: 5, item: "Zucker", created: Date.now() - 60 * 60 * 4.87 * 1000, modified: Date.now() },
                    { id: 7, list_id: id, order: 6, item: "Äpfel", note: "Frisch und saftig", created: Date.now(), modified: Date.now() },
                    { id: 8, list_id: id, order: 7, item: "Käse", note: "Für die Pasta", created: Date.now(), modified: Date.now() },
                    { id: 9, list_id: id, order: 8, item: "Paprika", note: "Rot und grün", created: Date.now(), modified: Date.now() },
                ],
            );
        } else {
            return new List(
                {
                    id: id,
                    name: "Weekly groceries",
                    created: Date.now(),
                    order: 0,
                    modified: Date.now() - 3456 * 1000,
                },
                [
                    { id: 1, list_id: id, order: 0, item: "Bread", created: Date.now() - 60 * 60 * 4 * 1000, modified: Date.now() },
                    { id: 2, list_id: id, order: 1, item: "Butter", created: Date.now() - 60 * 60 * 2.1 * 1000, modified: Date.now() },
                    { id: 3, list_id: id, order: 2, item: "8 Eggs", created: Date.now() - 60 * 60 * 9.2 * 1000, modified: Date.now() },
                    { id: 4, list_id: id, order: 3, item: "Milk", note: "Lactose-free", created: Date.now() - 60 * 60 * 12.35 * 1000, modified: Date.now() },
                    { id: 5, list_id: id, order: 4, item: "Ice cream", note: "On sale", created: Date.now() - 60 * 60 * 0.23 * 1000, modified: Date.now() },
                    { id: 6, list_id: id, order: 5, item: "Sugar", created: Date.now() - 60 * 60 * 4.87 * 1000, modified: Date.now() },
                    { id: 7, list_id: id, order: 6, item: "Apples", note: "Fresh and juicy", created: Date.now(), modified: Date.now() },
                    { id: 8, list_id: id, order: 7, item: "Cheese", note: "For the pasta", created: Date.now(), modified: Date.now() },
                    { id: 9, list_id: id, order: 8, item: "Peppers", note: "Red and green", created: Date.now(), modified: Date.now() },
                ],
            );
        }
    }

    public async GetTrash(): Promise<List[]> {
        return [];
    }

    public async GetListitemTrash(id: number | List): Promise<Listitem[] | undefined> {
        return [];
    }

    public async NewList() {
        await ListEditor(this.ModalCtrl, {});
    }

    public async EditList(list: List): Promise<boolean | undefined> {
        return undefined;
    }

    public async DeleteLists(lists: List | List[], no_prompt: boolean = false): Promise<boolean | undefined> {
        return undefined;
    }

    public async EmptyLists(lists: List | List[], force: boolean = false): Promise<boolean | undefined> {
        return undefined;
    }

    public async ReorderLists(lists: List[]): Promise<void> {}

    public async NewListitem(list: List): Promise<boolean | undefined> {
        return undefined;
    }

    public async AddNewListitem(list: List, args: { item: string; order?: number; locked?: boolean; hidden?: boolean }): Promise<boolean> {
        return false;
    }

    public async EditListitem(list: List, item: Listitem): Promise<boolean | undefined> {
        return undefined;
    }

    public async DeleteListitem(list: List, items: Listitem | Listitem[], no_prompt: boolean = false, keep_locked: boolean = true): Promise<boolean | undefined> {
        return undefined;
    }

    public async EraseListitemFromTrash(trash: List, items: Listitem | Listitem[]): Promise<boolean | undefined> {
        return undefined;
    }

    public async WipeTrash(no_prompt: boolean = false, prompt_anyway: boolean = false): Promise<boolean | undefined> {
        return undefined;
    }

    public async WipeListitemTrash(no_prompt: boolean = false, prompt_anyway: boolean = false): Promise<boolean | undefined> {
        return undefined;
    }

    public async EmptyListitemTrash(trash: List): Promise<boolean | undefined> {
        return undefined;
    }

    public async ToggleHiddenListitem(list: List, items: Listitem | Listitem[], hide: boolean | undefined = undefined): Promise<boolean | undefined> {
        return undefined;
    }

    public async ToggleLockListitem(list: List, items: Listitem | Listitem[], pin: boolean | undefined = undefined): Promise<boolean | undefined> {
        return undefined;
    }

    public async EraseListFromTrash(lists: List | List[], force: boolean = false): Promise<boolean | undefined> {
        return undefined;
    }

    public async RestoreListFromTrash(lists: List | List[]): Promise<boolean | undefined> {
        return undefined;
    }

    public async RestoreListitemFromTrash(trash: List, items: Listitem | Listitem[]): Promise<boolean | undefined> {
        return undefined;
    }

    public async StoreList(list: List, force: boolean = false, fire_event: boolean = true, progressbar: boolean = true): Promise<boolean | undefined> {
        return undefined;
    }

    public async TransferList(lists?: List | List[] | string | number, device?: ConnectIQDevice | number): Promise<boolean | undefined> {
        return undefined;
    }

    public PurgeListDetails() {}

    public async PurgeAllSyncs(): Promise<void> {}

    public async createNewList(args: { name: string; order?: number; sync?: ListSyncDevice[]; reset?: ListReset }): Promise<List> {
        return new List({ name: "dummy", created: Date.now(), modified: Date.now(), order: 0 });
    }

    public async createNewListitem(list: List | number, args: { item: string; note?: string; order?: number; hidden?: boolean; locked?: boolean }): Promise<Listitem> {
        return new Listitem({ id: -1, list_id: 1, item: "dummy", order: 0, created: Date.now(), modified: Date.now() });
    }

    public async SyncList(obj: { list: List | number; force_if_sync_is_disabled?: boolean }): Promise<void> {}

    public async ReloadListsDataset(datasets?: ("lists" | "trash")[]): Promise<void> {}
}
