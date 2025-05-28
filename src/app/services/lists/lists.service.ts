import { inject, Injectable } from "@angular/core";
import { Keyboard } from "@capacitor/keyboard";
import { AlertInput, ModalController, NavController } from "@ionic/angular/standalone";
import { BehaviorSubject, interval, Subscription } from "rxjs";
import { HelperUtils } from "../../classes/utils/helper-utils";
import { StringUtils } from "../../classes/utils/string-utils";
import { ListEditor } from "../../components/list-editor/list-editor.component";
import { ListItemEditor, ListItemEditorMultiple } from "../../components/list-item-editor/list-item-editor.component";
import { AppService } from "../app/app.service";
import { ConnectIQDevice } from "../connectiq/connect-iq-device";
import { ConnectIQMessageType } from "../connectiq/connect-iq-message-type";
import { ConnectIQService } from "../connectiq/connect-iq.service";
import { LocalizationService } from "../localization/localization.service";
import { Logger } from "../logging/logger";
import { PopupsService } from "../popups/popups.service";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";
import { Toast } from "./../popups/toast";
import { ListsBackendService } from "./../storage/lists/lists-backend.service";
import { KeepInTrash } from "./keep-in-trash";
import { List } from "./list";
import { Listitem, ListitemModel } from "./listitem";
import { ListitemsTrashProvider } from "./listitems-trash-provider";
import { ListitemTrashModel, ListitemTrashUtils } from "./listitems-trash-utils";
import { ListsProvider } from "./lists-provider";
import { TrashProvider } from "./trash-provider";

@Injectable({
    providedIn: "root",
})
export class ListsService {
    private readonly ListsProvider: ListsProvider;
    private readonly TrashProvider: TrashProvider;
    private readonly TrashItemsProvider: ListitemsTrashProvider;
    private readonly Preferences = inject(PreferencesService);
    private readonly ModalCtrl = inject(ModalController);
    private readonly Popups = inject(PopupsService);
    private readonly NavController = inject(NavController);
    private readonly Locale = inject(LocalizationService);
    private readonly Backend = inject(ListsBackendService);
    private readonly ConnectIQ = inject(ConnectIQService);

    private _keepInTrashStock: KeepInTrash.Enum = KeepInTrash.Default;
    private _syncLists: boolean = false;
    private _removeOldTrashEntriesTimer?: Subscription;

    private _lists: List[] = [];
    private readonly _listIndex: Map<string | number, List> = new Map();

    private onTrashItemsDatasetChangedSubject = new BehaviorSubject<ListitemTrashModel | undefined>(undefined);
    public onTrashItemsDatasetChanged$ = this.onTrashItemsDatasetChangedSubject.asObservable();

    private onTrashDatasetChangedSubject = new BehaviorSubject<List[] | undefined>(undefined);
    public onTrashDatasetChanged$ = this.onTrashDatasetChangedSubject.asObservable();

    private onListChangedSubject = new BehaviorSubject<List | undefined>(undefined);
    public onListChanged$ = this.onListChangedSubject.asObservable();

    private onListsChangedSubject = new BehaviorSubject<List[] | undefined>(undefined);
    public onListsChanged$ = this.onListsChangedSubject.asObservable();

    public constructor() {
        this.ListsProvider = new ListsProvider(this.Backend);
        this.TrashItemsProvider = new ListitemsTrashProvider(this.Backend, this.onTrashItemsDatasetChangedSubject);
        this.TrashProvider = new TrashProvider(this.Backend, this.TrashItemsProvider, this.onTrashDatasetChangedSubject);
    }

    public async Initialize() {
        this.KeepInTrashStock = await this.Preferences.Get<number>(EPrefProperty.TrashKeepinStock, this._keepInTrashStock);
        this._syncLists = await this.Preferences.Get<boolean>(EPrefProperty.SyncListOnDevice, false);
        this.Preferences.onPrefChanged$.subscribe(arg => {
            if (arg.prop == EPrefProperty.TrashKeepinStock) {
                this.KeepInTrashStock = arg.value;
            } else if (arg.prop == EPrefProperty.SyncListOnDevice) {
                this._syncLists = arg.value;
            }
        });
        Logger.Debug("Lists service initialized");
        Logger.Debug(`Found ${(await this.GetLists(true)).length} list(s) in the backend`);
    }

    private set KeepInTrashStock(value: number | KeepInTrash.Enum) {
        value = KeepInTrash.FromNumber(value);
        this._keepInTrashStock = value;
        if (KeepInTrash.StockPeriod(value)) {
            this._removeOldTrashEntriesTimer?.unsubscribe();
            this._removeOldTrashEntriesTimer = interval(value * 60 * 60 * 24).subscribe(() => {
                this.TrashProvider.RemoveOldEntries(value);
            });
            this.TrashProvider.RemoveOldEntries(value);
            this.TrashProvider.MaxEntryCount = undefined;
            this.TrashItemsProvider.MaxEntryCount = undefined;
        } else {
            this._removeOldTrashEntriesTimer?.unsubscribe();
            this._removeOldTrashEntriesTimer = undefined;
            this.TrashProvider.MaxEntryCount = KeepInTrash.StockSize(value);
            this.TrashItemsProvider.MaxEntryCount = KeepInTrash.StockSize(value);
        }
    }

    /**
     * get all lists with at least peek data from backend
     * @param reload force to reload lists from backend
     * @returns array of all lists
     */
    public async GetLists(reload: boolean = false): Promise<List[]> {
        if (reload || this._lists.length == 0) {
            AppService.AppToolbar?.ToggleProgressbar(true);
            this._lists = await this.ListsProvider.GetLists(true);
            this._listIndex.clear();
            this._lists.forEach(l => {
                this._listIndex.set(l.Uuid, l);
            });
            this._lists = this.orderLists(this._lists);
            AppService.AppToolbar?.ToggleProgressbar(false);
        }
        return this._lists;
    }

    /**
     * returns all lists in the trash
     * @returns array of lists in trash
     */
    public async GetTrash(): Promise<List[]> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const trash = await this.TrashProvider.GetLists(true);
        AppService.AppToolbar?.ToggleProgressbar(false);
        return trash;
    }

    /**
     * gets a specific list with all items
     * @param uuid unique id of the list
     * @returns List object
     */
    public async GetList(uuid: string | number): Promise<List | undefined> {
        if (!this._listIndex.has(uuid) || this._listIndex.get(uuid)!.isPeek) {
            AppService.AppToolbar?.ToggleProgressbar(true);
            const list = await this.ListsProvider.GetList(uuid);
            if (list) {
                this.putListInIndex(list);
            }
            AppService.AppToolbar?.ToggleProgressbar(false);
        }

        return this._listIndex.get(uuid);
    }

    /**
     * returns the listitems in trash of a list
     * @param uuid unique identifier of the list
     * @returns ListitemTrashModel object
     */
    public async GetListitemTrash(uuid: string): Promise<ListitemTrashModel | undefined> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const ret = await this.TrashItemsProvider.GetListitemsTrash(uuid);
        AppService.AppToolbar?.ToggleProgressbar(false);
        return ret;
    }

    /**
     * opens the list editor to create a new list
     */
    public async NewList() {
        const list = await ListEditor(this.ModalCtrl, {});
        if (list) {
            if (await this.StoreList(list)) {
                Logger.Notice(`Created new list ${list.toLog()}`);
                this.putListInIndex(list);
                this.NavController.navigateForward(`/lists/items/${list.Uuid}`, { queryParams: { created: true } });
            } else {
                this.Popups.Toast.Error("service-lists.store_list_error");
            }
        }
    }

    /**
     * opens the list editor to edit the list
     * @param list list to be edited
     * @param only_title if true, only the title will be edited
     * @returns true if the list was edited and stored, false is storage failed. undefined if no changes were made
     */
    public async EditList(list: List): Promise<boolean | undefined> {
        const ret = await ListEditor(this.ModalCtrl, { list: list });
        if (ret) {
            const store = await this.StoreList(list);
            if (store === true) {
                Logger.Notice(`Edited list ${list.toLog()}`);
                this.putListInIndex(list);
            } else if (store === false) {
                this.Popups.Toast.Error("service-lists.store_list_error");
            }
            return store;
        }
        return undefined;
    }

    /**
     * prompts the user to delete a list
     * @param lists list to be deleted
     * @param force delete the list without prompt
     * @returns list deletion successful? undefined if the user canceled it
     */
    public async DeleteList(lists: List | List[], force: boolean = false): Promise<boolean | undefined> {
        const del_on_watch = await this.Preferences.Get(EPrefProperty.DeleteListOnDevice, false);
        if (!force && (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmDeleteList, true))) {
            let text = "";
            if (Array.isArray(lists) && lists.length > 1) {
                text = this.Locale.getText("service-lists.delete_confirm_plural");
            } else {
                text = this.Locale.getText("service-lists.delete_confirm", { name: StringUtils.shorten(Array.isArray(lists) ? lists[0].Name : lists.Name, 40) });
            }

            const checkbox: AlertInput = {
                label: this.Locale.getText("service-lists.delete_confirm_watch"),
                type: "checkbox",
                value: "del_on_watch",
                checked: del_on_watch,
            };
            const result = await this.Popups.Alert.YesNo({ message: text, inputs: [checkbox] });
            if (result !== false) {
                const del_on_watch = Array.isArray(result) && result.includes("del_on_watch") ? true : false;
                return this.removeList(lists, del_on_watch);
            } else {
                return undefined;
            }
        } else {
            return this.removeList(lists, del_on_watch);
        }
    }

    /**
     * prompts the user to delete all items of a list
     * @param lists list to be emptied
     * @param force empty the list without prompt
     * @returns deletion successful? undefined if user canceled it
     */
    public async EmptyList(lists: List | List[], force: boolean = false): Promise<boolean | undefined> {
        if (!force && (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmEmptyList, true))) {
            let text = "";
            if (Array.isArray(lists) && lists.length > 1) {
                text = this.Locale.getText("service-lists.empty_confirm_plural");
            } else {
                text = this.Locale.getText("service-lists.empty_confirm", { name: StringUtils.shorten(Array.isArray(lists) ? lists[0].Name : lists.Name, 40) });
            }

            if (await this.Popups.Alert.YesNo({ message: text })) {
                return await this.emptyList(lists);
            } else {
                return undefined;
            }
        } else {
            return await this.emptyList(lists);
        }
    }

    /**
     * opens the listitem editor to create a new listitem
     * @param list list, the new item should be part of
     * @returns item-creation successful?
     */
    public async NewListitem(list: List): Promise<boolean | undefined> {
        if (AppService.isMobileApp) {
            Keyboard.show();
        }
        let added: boolean | undefined = undefined;
        await ListItemEditorMultiple(this.ModalCtrl, {
            list: list,
            onAddItem: async (list: List, item: Listitem, add_more: boolean) => {
                if (item) {
                    list.AddItem(item);
                }
                if (added !== false) {
                    added = await this.StoreList(list, false, true, false);
                    if (add_more) {
                        if (added) {
                            this.Popups.Toast.Success("service-lists.add_moreitems_success", undefined, true);
                        } else {
                            this.Popups.Toast.Error("service-lists.add_moreitems_error", undefined, true);
                        }
                    }
                }
            },
        });
        return added;
    }

    /**
     * adds an already created item to a list
     * @param list list, the item sould be part of
     * @param item listitem to be added
     * @returns item-adding successful?
     */
    public async AddNewListitem(list: List, args: { item: string; note?: string; hidden?: boolean; locked?: boolean }): Promise<boolean | undefined> {
        if (!list || !args) {
            return false;
        }

        const item = await this.createNewListitemObj(list, args);
        list.AddItem(item);
        const success = await this.StoreList(list, false, true, false);

        if (success) {
            this.putListInIndex(list);
            this.onListsChangedSubject.next(await this.GetLists(true));
        }

        return success;
    }

    /**
     * opens the listitem editor to edit an item
     * @param list list, the item is part of
     * @param item item to be edited
     * @returns editing successful? undefined if user canceled it
     */
    public async EditListitem(list: List, item: Listitem): Promise<boolean | undefined> {
        const obj = await ListItemEditor(this.ModalCtrl, { list: list, item: item });
        if (obj) {
            if (await this.StoreList(list, undefined, undefined, false)) {
                Logger.Debug(`Edited listitem ${item.toLog()}`);
                return true;
            } else {
                return false;
            }
        } else {
            return undefined;
        }
    }

    /**
     * prompts the user to delete an list item
     * @param list list, the item(s) are part of
     * @param items item(s) to be deleted
     * @param force delete the listitem without prompting
     * @returns deletion successful? undefined if user canceled it
     */
    public async DeleteListitem(list: List, items: Listitem | Listitem[], force: boolean = false): Promise<boolean | undefined> {
        if (!force && (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmDeleteListitem, true))) {
            let text = "";
            if (Array.isArray(items) && items.length > 1) {
                text = this.Locale.getText("service-lists.delete_item_confirm_plural");
            } else {
                text = this.Locale.getText("service-lists.delete_item_confirm", { name: StringUtils.shorten(Array.isArray(items) ? items[0].Item : items.Item, 40) });
            }
            if (await this.Popups.Alert.YesNo({ message: text })) {
                return this.removeListitem(list, items);
            } else {
                return undefined;
            }
        } else {
            return this.removeListitem(list, items);
        }
    }

    /**
     * prompts the user to finally erase a listitem from trash
     * @param trash trash of the list
     * @param items the item in Trash to be erased
     * @returns erase successful, undefined if user canceled it
     */
    public async EraseListitemFromTrash(trash: ListitemTrashModel, items: ListitemModel | ListitemModel[]): Promise<boolean | undefined> {
        if (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmEraseListitem, true)) {
            let text = "";
            if (Array.isArray(items) && items.length > 1) {
                text = this.Locale.getText("service-lists.erase_item_confirm_plural");
            } else {
                text = this.Locale.getText("service-lists.erase_item_confirm", { name: StringUtils.shorten(Array.isArray(items) ? items[0].item : items.item, 40) });
            }
            text += this.Locale.getText("service-lists.undo_warning");

            if (await this.Popups.Alert.YesNo({ message: text })) {
                return this.eraseListitemFromTrash(trash, items);
            } else {
                return undefined;
            }
        } else {
            return this.eraseListitemFromTrash(trash, items);
        }
    }

    /**
     * prompts the user to empty the lists trash
     * @param force empty the trash without prompt
     * @returns empty successfull, undefined if user canceled it
     */
    public async WipeTrash(force: boolean = false): Promise<boolean | undefined> {
        if (!force && (await this.Preferences.Get(EPrefProperty.ConfirmEmptyTrash, true))) {
            let text;
            const count = await this.TrashProvider.Count();
            if (count == 1) {
                text = this.Locale.getText("service-lists.empty_trash_confirm_single");
            } else {
                text = this.Locale.getText("service-lists.empty_trash_confirm", { count: count });
            }
            text += this.Locale.getText("service-lists.undo_warning");
            if (await this.Popups.Alert.YesNo({ message: text })) {
                return (await this.wipeListsTrash()) > 0;
            } else {
                return undefined;
            }
        } else {
            return (await this.wipeListsTrash()) > 0;
        }
    }

    /**
     * removes all listitems from trash for a certain list
     * @param trash the list, the items in trash should be removed
     * @returns removal successful? undefined if the user canceled it
     */
    public async EmptyListitemTrash(trash: ListitemTrashModel): Promise<boolean | undefined> {
        if (await this.Preferences.Get(EPrefProperty.ConfirmEmptyTrash, true)) {
            let text;
            if (trash.items.length == 1) {
                text = this.Locale.getText("service-lists.empty_trash_listitems_confirm_single");
            } else {
                text = this.Locale.getText("service-lists.empty_trash_listitems_confirm", { count: trash.items.length });
            }
            text += this.Locale.getText("service-lists.undo_warning");
            if (await this.Popups.Alert.YesNo({ message: text })) {
                return this.emptyListitemTrash(trash);
            } else {
                return undefined;
            }
        } else {
            return this.emptyListitemTrash(trash);
        }
    }

    /**
     * corrects the order numbers of lists
     * @param lists lists to be ordered
     * @returns lists with updated order numbers
     */
    public async ReorderLists(lists: List[]): Promise<List[]> {
        lists = await this.cleanOrderLists(lists);
        return lists;
    }

    /**
     * correct the order numbers of listitems
     * @param list list, the items are part of
     * @param items items to be ordered
     * @returns list with reordered listitems
     */
    public async ReorderListitems(list: List, items: Listitem[], store: boolean = true): Promise<void> {
        list.Items = items;
        for (let i = 0; i < list.Items.length; i++) {
            list.Items[i].Order = i;
        }
        if (store) {
            await this.StoreList(list);
        }
    }

    /**
     * toggles the hidden state of a listitem
     * @param list list, the item is part of
     * @param items listitem, hiddenstate should be toggled
     * @param hide hide/show the listitem(s), if undefined the state is toggled
     */
    public async ToggleHiddenListitem(list: List, items: Listitem | Listitem[], hide: boolean | undefined = undefined): Promise<boolean | undefined> {
        if (!Array.isArray(items)) {
            items = [items];
        }
        items.forEach(item => {
            if (hide === undefined) {
                item.Hidden = !item.Hidden;
            } else {
                item.Hidden = hide;
            }
        });
        return await this.StoreList(list, undefined, undefined, false);
    }

    /**
     * lock the item, so it is not deleted when emptying the list
     * @param list list, the item is part of^
     * @param items listitem(s), that should be locked/unlocked
     * @param pin lock/unlock the listitem(s), if undefined, the state is toggled
     */
    public async ToggleLockListitem(list: List, items: Listitem | Listitem[], pin: boolean | undefined = undefined): Promise<boolean | undefined> {
        if (!Array.isArray(items)) {
            items = [items];
        }
        items.forEach(item => {
            if (pin === undefined) {
                item.Locked = !item.Locked;
            } else {
                item.Locked = pin;
            }
        });
        return await this.StoreList(list, undefined, undefined, false);
    }

    /**
     * prompts the user to erase a list from trash
     * @param list list to be erased
     * @param force erase the list without user prompt
     * @returns erase successful? undefined if user canceled it
     */
    public async EraseListFromTrash(lists: List | List[], force: boolean = false): Promise<boolean | undefined> {
        if (!force && (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmEraseList, true))) {
            let text = this.Locale.getText("service-lists.undo_warning");
            if (!Array.isArray(lists) || lists.length == 1) {
                text = this.Locale.getText("service-lists.erase_confirm", { name: StringUtils.shorten(Array.isArray(lists) ? lists[0].Name : lists.Name, 40) }) + text;
            } else {
                text = this.Locale.getText("service-lists.erase_confirm_plural") + text;
            }

            if (await this.Popups.Alert.YesNo({ message: text })) {
                return this.eraseListFromTrash(lists);
            } else {
                return undefined;
            }
        } else {
            return this.eraseListFromTrash(lists);
        }
    }

    /**
     * prompts the user to restore a list from trash
     * @param lists list(s) to be restored
     * @returns restore successful? undefined if user canceled it
     */
    public async RestoreListFromTrash(lists: List | List[]): Promise<boolean | undefined> {
        if (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmRestoreList, true)) {
            let text = "";
            if (!Array.isArray(lists) || lists.length == 1) {
                text = this.Locale.getText("service-lists.restore_confirm", { name: StringUtils.shorten(Array.isArray(lists) ? lists[0].Name : lists.Name, 40) });
            } else {
                text = this.Locale.getText("service-lists.restore_confirm_plural");
            }
            if (await this.Popups.Alert.YesNo({ message: text })) {
                return this.restoreListFromTrash(lists);
            } else {
                return undefined;
            }
        } else {
            return this.restoreListFromTrash(lists);
        }
    }

    /**
     * prompts the user to restore a list item
     * @param trash list, to which the item should be restored
     * @param items item(s) in trash to be restored
     * @returns restore successful? undefined if user canceled it
     */
    public async RestoreListitemFromTrash(trash: ListitemTrashModel, items: ListitemModel | ListitemModel[]): Promise<boolean | undefined> {
        if (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmRestoreListitem, true)) {
            let text = "";
            if (!Array.isArray(items) || items.length == 1) {
                text = this.Locale.getText("service-lists.restore_item_confirm", { name: StringUtils.shorten(Array.isArray(items) ? items[0].item : items.item, 40) });
            } else {
                text = this.Locale.getText("service-lists.restore_item_confirm_plural");
            }

            if (await this.Popups.Alert.YesNo({ message: text })) {
                return this.restoreListitemFromTrash(trash, items);
            } else {
                return undefined;
            }
        } else {
            return this.restoreListitemFromTrash(trash, items);
        }
    }

    /**
     * creates a unique identifier for a list or listitem
     * @returns unique id
     */
    public async createUuid(list?: List): Promise<number> {
        let uuid = HelperUtils.RandomNumber();
        if (list) {
            //create an uuid for a listitem
            const trash = await this.TrashItemsProvider.GetListitemsTrash(list.Uuid);
            while (list.Items.some(i => i.Uuid === uuid) || trash?.items.some(i => i.uuid === uuid)) {
                uuid = HelperUtils.RandomNumber();
            }
        } else {
            //create an uuid for a list
            let uuid = HelperUtils.RandomNumber();
            while ((await this.ListsProvider.Exists(uuid)) || (await this.TrashProvider.Exists(uuid))) {
                uuid = HelperUtils.RandomNumber();
            }
        }
        return uuid;
    }

    /**
     * stores a list in backend up there are any changes
     * @param list list to be stored
     * @param force store the list, even if there are no changes
     * @returns storage successful, undefined if no storage was needed
     */
    public async StoreList(list: List, force: boolean = false, fire_event: boolean = true, progressbar: boolean = true): Promise<boolean | undefined> {
        if (progressbar) {
            AppService.AppToolbar?.ToggleProgressbar(true);
        }
        const store = await this.ListsProvider.StoreList(list, force);
        if (progressbar) {
            AppService.AppToolbar?.ToggleProgressbar(false);
        }
        if (store !== false) {
            if (store === true && fire_event) {
                this.onListChangedSubject.next(list);
            }
            if (store !== undefined) {
                //only sync, if the list was dirty
                this.syncListToWatch(list);
            }
            return store;
        } else {
            return false;
        }
    }

    /**
     * transfer a list to a device
     * @param list list to transfer (or the uuid)
     * @param device device to be transfered, if null the default device is used
     */
    public async TransferList(list?: List | List[] | string | number, device?: ConnectIQDevice | number): Promise<boolean | undefined> {
        if (typeof list === "string" || typeof list === "number") {
            list = await this.GetList(list);
        }

        if (!list) {
            return false;
        }

        if (!Array.isArray(list)) {
            list = [list];
        }

        if (typeof device === "number") {
            device = await this.ConnectIQ.GetDevice(device);
        }

        if (!device) {
            device = await this.ConnectIQ.GetDefaultDevice({ btn_text: this.Locale.getText("service-lists.transmit_send_btn") });
        }

        if (device && device.State == "Ready") {
            const text_key = list.length > 1 ? "service-lists.transmit_confirm_plural" : "service-lists.transmit_confirm";
            const confirm = await this.Preferences.Get<boolean>(EPrefProperty.ConfirmTransmitList, true);
            const locale = this.Locale.getText([text_key, "yes", "no"], { device: device.Name });
            if (!confirm || (await this.Popups.Alert.YesNo({ message: locale[text_key], button_yes: locale["yes"], button_no: locale["no"] }))) {
                const toast = await this.Popups.Toast.Notice(list.length == 1 ? "service-lists.transmit_process" : "service-lists.transmit_process_plural", Toast.DURATION_INFINITE);
                AppService.AppToolbar?.ToggleProgressbar(true);

                let errors = 0;
                for (let i = 0; i < list.length; ++i) {
                    if (device && device.State == "Ready") {
                        const l = list[i];
                        let peek = false;
                        if (l.isPeek) {
                            peek = true;
                            const copy = await this.GetList(l.Uuid);
                            if (copy) {
                                l.copyDetails(copy);
                            }
                        }
                        const payload = l.toDeviceObject();
                        const resp = await this.ConnectIQ.SendToDevice({ device: device, messageType: ConnectIQMessageType.List, data: payload });
                        if (peek) {
                            l.PurgeDetails();
                        }

                        if (resp !== false) {
                            Logger.Debug(`Transfered list ${l.toLog()} to device ${device.toLog()}`);
                            continue;
                        }
                    }
                    errors++;
                    Logger.Debug(`Could not transfer list ${list[i].toLog()} to device ${device.toLog()}`);
                }
                toast.dismiss();
                AppService.AppToolbar?.ToggleProgressbar(false);

                if (errors > 0) {
                    if (list.length == 1) {
                        this.Popups.Toast.Error("service-lists.transmit_error");
                    } else if (errors == list.length) {
                        this.Popups.Toast.Error("service-lists.transmit_error_plural");
                    } else {
                        this.Popups.Toast.Error("service-lists.transmit_error_partial");
                    }
                    return false;
                } else {
                    if (list.length == 1) {
                        this.Popups.Toast.Success("service-lists.transmit_success");
                    } else {
                        this.Popups.Toast.Success("service-lists.transmit_success_plural");
                    }
                    if (await this.Preferences.Get<boolean>(EPrefProperty.OpenAppOnTransmit, false)) {
                        this.ConnectIQ.openApp(device);
                    }
                    return true;
                }
            } else {
                return undefined;
            }
        } else if (device) {
            Logger.Debug(`Could not transfer list ${list.length} list(s) to device ${device.toLog()}: device is state ${device.State}`);
        } else {
            Logger.Debug(`Could not transfer list ${list.length} list(s), no device fould`);
        }
        if (list.length == 1) {
            this.Popups.Toast.Error("service-lists.transmit_error");
        } else {
            this.Popups.Toast.Error("service-lists.transmit_error_plural");
        }
        return false;
    }

    /**
     * wipes all listitem trashes of all lists
     */
    public async WipeListitemTrashes(): Promise<void> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        await this.TrashItemsProvider.WipeTrashes();
        AppService.AppToolbar?.ToggleProgressbar(false);
    }

    /**
     * purges all details of lists in memory
     */
    public PurgeListDetails() {
        this._lists.forEach(l => {
            l.PurgeDetails();
        });
    }

    /**
     * returns the number of lists in trash
     * @returns number of lists in trash
     */
    public async GetTrashCount(): Promise<number> {
        return this.TrashProvider.Count();
    }

    /**
     * returns the number of lists with listitems in the trash
     * @returns number of lists
     */
    public async GetItemsTrashCount(): Promise<number> {
        return this.TrashItemsProvider.CountAll();
    }

    /**
     * return the size in bytes and number of files of the lists- and trash-backends
     * @returns object with size of the lists and trashes
     */
    public async BackendSize(): Promise<{ lists: { size: number; files: number }; trash: { size: number; files: number } }> {
        const lists = await this.ListsProvider.BackendSize();
        const trash = await this.TrashProvider.BackendSize();
        const itemtrash = await this.TrashItemsProvider.BackendSize();
        trash.size += itemtrash.size;
        trash.files += itemtrash.files;

        return { lists: lists, trash: trash };
    }

    /**
     * creates a new List object
     * @param args list properties
     * @returns list object
     */
    public async createNewListObj(args: { name: string }): Promise<List> {
        return new List({ name: args.name, uuid: await this.createUuid(), created: Date.now(), order: this._listIndex.size });
    }

    /**
     * creates a new Listitem object
     * @param list  the list the item is part of
     * @param args listitem properties
     * @returns Listitem object
     */
    public async createNewListitemObj(list: List, args: { item: string; note?: string; hidden?: boolean; locked?: boolean }): Promise<Listitem> {
        return Listitem.Create({ item: args.item, note: args.note, hidden: args.hidden, locked: args.locked, order: list.ItemsCount, uuid: await this.createUuid(), created: Date.now() });
    }

    /**
     * remove automatic synchronization from all lists
     */
    public async PurgeAllSyncs(): Promise<void> {
        const lists = await this.GetLists(true);
        for (let i = 0; i < lists.length; i++) {
            lists[i].Sync = false;
            await this.StoreList(lists[i], false, true, false);
        }
        Logger.Debug(`Removed automatic synchronization of all lists`);
    }

    /**
     * sync a list to the watch
     * @param obj config for list sync
     */
    public async SyncList(obj: { list: List | string | number; only_if_definitive_device?: boolean; force_if_sync_is_disabled?: boolean }): Promise<void> {
        const list_to_sync = obj.list instanceof List ? obj.list : await this.GetList(obj.list);
        if (!list_to_sync) {
            Logger.Error(`Could not sync list ${obj.list} to watch, does not exist`);
            return;
        }
        return this.syncListToWatch(list_to_sync, obj.only_if_definitive_device, obj.force_if_sync_is_disabled);
    }

    /**
     * sync changes to a list to the watch
     * @param list List to be synced
     * @param only_if_definitive_device only sync list, if the device is unambiguous
     * @param force_in_sync_is_disabled force sync even if list-sync is disabled
     */
    private async syncListToWatch(list: List, only_if_definitive_device: boolean = false, force_in_sync_is_disabled: boolean = false): Promise<void> {
        if ((!this._syncLists || !list.Sync) && !force_in_sync_is_disabled) {
            return;
        }

        const device = await this.ConnectIQ.GetDefaultDevice({ only_ready: true, select_device_if_undefined: !only_if_definitive_device });
        if (device) {
            let peek = false;
            if (list.isPeek) {
                peek = true;
                list.copyDetails(await this.GetList(list.Uuid));
            }
            var payload = list.toDeviceObject();
            if (peek) {
                list.PurgeDetails();
            }
            if (!payload) {
                Logger.Error(`Could not sync new list to watch, list serialization failed`);
                return;
            }
            payload = ["issync", ...payload];

            if (await this.ConnectIQ.SendToDevice({ device: device, messageType: ConnectIQMessageType.List, data: payload })) {
                Logger.Debug(`Sync list ${list.toLog()} to watch ${device.toLog()}`);
            } else {
                Logger.Error(`Failed to sync list ${list.toLog()} to watch ${device.toLog()}`);
            }
        } else {
            Logger.Notice(`Could not sync list to watch, no default device`);
        }
    }

    /**
     * publish changes in a list with the signal
     * @param list list to be changed
     */
    private putListInIndex(list: List) {
        this._listIndex.set(list.Uuid, list);
        let lists = Array.from(this._listIndex.values());
        this._lists = this.orderLists(lists);
    }

    /**
     * removes a list from the index and publish it with the signal
     * @param list list to be removed
     * @param fire_event if true, will emit onListsChanged event
     * @returns was the list removed successful
     */
    private async removeListInIndex(list: List, fire_event: boolean = true): Promise<boolean> {
        if (this._listIndex.delete(list.Uuid)) {
            let lists = Array.from(this._listIndex.values());
            await this.resetOrder(lists, fire_event, false);
            return true;
        } else {
            return false;
        }
    }

    /**
     * orders the lists by 'Order' property and publish the list with the signal
     * @param lists lists array to be ordered and set in Lists-signal
     */
    private orderLists(lists: List[]): List[] {
        return lists.sort((a: List, b: List) => (a.Order > b.Order ? 1 : -1));
    }

    /**
     * set the 'Order' property of all lists, as they are in the given list
     * @param lists list to reset the 'Order' property
     * @param force_event publish the list with the signal
     */
    private async resetOrder(lists: List[], force_event: boolean = false, fire_event: boolean = true) {
        let order = 0;
        let changed = false;
        lists = lists.sort((a: List, b: List) => (a.Order > b.Order ? 1 : -1));
        for (let i = 0; i < lists.length; i++) {
            const list = lists[i];
            list.Order = order++;
            if (list.Dirty) {
                changed = true;
                await this.StoreList(list, undefined, false, false);
            }
        }
        this._lists = lists;

        if (fire_event && (force_event || changed)) {
            this.onListsChangedSubject.next(this._lists);
        }
    }

    /**
     * move list to trash or removes it completely
     * @param uuid unique identifier of the list to be removed
     * @returns was the removal successful
     */
    private async removeList(lists: List | List[], delete_on_watch: boolean = false): Promise<boolean> {
        if (!Array.isArray(lists)) {
            lists = [lists];
        }
        if (lists.length == 0) {
            return true;
        }

        AppService.AppToolbar?.ToggleProgressbar(true);

        const use_trash = await this.Preferences.Get<boolean>(EPrefProperty.TrashLists, true);
        let errors = 0;
        for (let i = 0; i < lists.length; i++) {
            const list: List | undefined = lists[i];
            if (list && this._listIndex.has(list.Uuid)) {
                if (list.isPeek) {
                    const read = await this.GetList(list.Uuid);
                    if (read) {
                        list.copyDetails(read);
                    } else {
                        errors++;
                        Logger.Error(`Could not delete list ${list.toLog()}, not found in backend...`);
                        continue;
                    }
                }

                let del = true;
                list.Deleted = Date.now();
                if (use_trash && !(await this.TrashProvider.StoreList(list, true))) {
                    del = false;
                    Logger.Error(`Could not store list {${list.toLog()}} in trash`);
                    errors++;
                    continue;
                }

                if (await this.ListsProvider.RemoveList(list)) {
                    await this.removeListInIndex(list, false);
                    Logger.Notice(`Removed list ${list.toLog()}`);
                    if (delete_on_watch) {
                        this.ConnectIQ.SendToDevice({ device: undefined, messageType: ConnectIQMessageType.DeleteList, data: list.Uuid });
                    }
                } else {
                    errors++;
                    Logger.Error(`Could not delete list ${list?.toLog()}`);
                    await this.TrashProvider.RemoveList(list);
                }
            }
        }

        this.onListsChangedSubject.next(await this.GetLists(true));

        AppService.AppToolbar?.ToggleProgressbar(false);

        if (errors > 0) {
            if (lists.length == 1) {
                this.Popups.Toast.Error("service-lists.delete_error");
            } else if (lists.length == errors) {
                this.Popups.Toast.Error("service-lists.delete_error_plural");
            } else {
                this.Popups.Toast.Error("service-lists.delete_error_partial");
            }
        } else {
            if (lists.length > 1) {
                this.Popups.Toast.Success("service-lists.delete_success");
            } else {
                this.Popups.Toast.Success("service-lists.delete_success_plural");
            }
        }

        return errors == 0;
    }

    /**
     * deletes all listitems in the list
     * @param list list to be emptied
     * @returns was the list stored successful after emptying?
     */
    private async emptyList(list: List | List[]): Promise<boolean> {
        if (!Array.isArray(list)) {
            list = [list];
        }

        if (list.length == 0) {
            return true;
        }

        const use_trash = await this.Preferences.Get<boolean>(EPrefProperty.TrashListitems, true);

        AppService.AppToolbar?.ToggleProgressbar(true);

        let errors = 0;
        for (let i = 0; i < list.length; i++) {
            let l: List | undefined = list[i];
            if (l.isPeek) {
                l = await this.GetList(l.Uuid);
            }

            if (l && l.ItemsCount > 0) {
                if (use_trash) {
                    const del = await this.TrashItemsProvider.StoreListitem(
                        l.Uuid,
                        l.Items.filter(i => !i.Locked),
                    );
                    if (!del) {
                        Logger.Error(`Could not empty list ${l.toLog()} and move items to trash`);
                        errors++;
                    }
                }
                await this.ReorderListitems(
                    l,
                    l.Items.filter(i => i.Locked),
                    false,
                );
                if (await this.StoreList(l)) {
                    this.putListInIndex(l);
                    Logger.Debug(`Emptied list ${l.toLog()}`);
                } else {
                    errors++;
                }
            } else if (!l) {
                errors++;
            }
        }

        this.onListsChangedSubject.next(await this.GetLists(true));

        if (errors > 0) {
            if (list.length == errors) {
                this.Popups.Toast.Error("service-lists.empty_error");
            } else {
                this.Popups.Toast.Error("service-lists.empty_error_partial");
            }
        } else {
            this.Popups.Toast.Success("service-lists.empty_success");
        }

        AppService.AppToolbar?.ToggleProgressbar(false);

        return errors == 0;
    }

    /**
     * removes a listitems from a list
     * @param list list, the item should be removed
     * @param items listitem to remove
     * @returns was the list stored successful after removal?
     */
    private async removeListitem(list: List, items: Listitem | Listitem[]): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        let success = false;

        if (!(await this.Preferences.Get<boolean>(EPrefProperty.TrashListitems, true)) || (await this.TrashItemsProvider.StoreListitem(list.Uuid, items))) {
            list.RemoveItem(items);
            success = (await this.StoreList(list)) !== false;
        } else {
            success = false;
        }

        AppService.AppToolbar?.ToggleProgressbar(false);
        return success;
    }

    /**
     * erases a listitem from trash
     * @param trash trash of the list, the item should be erased
     * @param items listitem(s) to be erased
     * @returns was the erase successful
     */
    private async eraseListitemFromTrash(trash: ListitemTrashModel, items: ListitemModel | ListitemModel[]): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const success = await this.TrashItemsProvider.EraseListitem(trash, items);

        if (success) {
            const text = !Array.isArray(items) || items.length == 1 ? "service-lists.erase_item_success" : "service-lists.erase_item_success_plural";
            this.Popups.Toast.Success(text);
        } else {
            const text = !Array.isArray(items) || items.length == 1 ? "service-lists.erase_item_error" : "service-lists.erase_item_error_plural";
            this.Popups.Toast.Error(text);
        }

        AppService.AppToolbar?.ToggleProgressbar(false);

        return success;
    }

    /**
     * empties the trash
     * @returns was the erase successful
     */
    private async wipeListsTrash(): Promise<number> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const del = await this.TrashProvider.WipeTrash();
        if (del > 0) {
            Logger.Notice(`Erased ${del} list(s) from trash`);
            this.Popups.Toast.Success("service-lists.empty_trash_success");
        } else {
            Logger.Error("Could not wipe lists trash");
            this.Popups.Toast.Error("service-lists.empty_trash_error");
        }

        AppService.AppToolbar?.ToggleProgressbar(false);

        return del;
    }

    /**
     * empties the listitem trash for a list
     * @param list list to empty
     * @returns was the emptying successful?
     */
    private async emptyListitemTrash(trash: ListitemTrashModel): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const ret = await this.TrashItemsProvider.EraseListitemTrash(trash);
        if (ret) {
            Logger.Notice(`Erased trash of list ${ListitemTrashUtils.toLog(trash)}`);
            this.Popups.Toast.Success("service-lists.empty_trash_success");
        } else {
            Logger.Error(`Could not erase trash of list ${ListitemTrashUtils.toLog(trash)}`);
            this.Popups.Toast.Error("service-lists.empty_trash_error");
        }
        AppService.AppToolbar?.ToggleProgressbar(false);
        return ret;
    }

    /**
     * restores a list from trash
     * @param list list to restore
     * @returns was the restore successful
     */
    private async restoreListFromTrash(lists: List | List[]): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);

        if (!Array.isArray(lists)) {
            lists = [lists];
        }

        let errors = 0;
        const all_lists = await this.GetLists(true);
        for (let i = 0; i < lists.length; i++) {
            //read the full list with all items
            const list = await this.TrashProvider.GetList(lists[i].Uuid);
            if (list) {
                //add it at the end
                list.Order = this._lists.length + i;
                if (all_lists.some(i => i.Uuid == list.Uuid)) {
                    //if there is an item with this uuid, give the restored item a new one
                    list.Uuid = await this.createUuid(list);
                }
                if (await this.ListsProvider.StoreList(list, true)) {
                    if (await this.TrashProvider.EraseLists(list.Uuid, false)) {
                        Logger.Notice(`Restored list ${list.toLog()} from trash`);
                        this.putListInIndex(list);
                        this.syncListToWatch(list);
                    } else {
                        Logger.Error(`Restored list ${list.toLog()} from trash, but could not erase it from trash`);
                    }
                } else {
                    Logger.Error(`Could not restore list ${list.toLog()} from trash - could not store as new`);
                    errors++;
                }
            } else {
                Logger.Error(`Could not restore list ${lists[i].toLog()} from trash - not found`);
                errors++;
            }
        }

        if (errors > 0) {
            if (lists.length == 1) {
                this.Popups.Toast.Error("service-lists.restore_error");
            } else if (lists.length == errors) {
                this.Popups.Toast.Error("service-lists.restore_error_plural");
            } else {
                this.Popups.Toast.Error("service-lists.restore_error_partial");
            }
        } else {
            if (lists.length == 1) {
                this.Popups.Toast.Success("service-lists.restore_success");
            } else {
                this.Popups.Toast.Success("service-lists.restore_success_plural");
            }
        }
        this.onListsChangedSubject.next(await this.GetLists(true));

        await new Promise<void>(resolve => setTimeout(resolve, 10000));

        AppService.AppToolbar?.ToggleProgressbar(false);

        return errors == 0;
    }

    /**
     * restores a listitem from the trash of a list
     * @param trash trash of the list
     * @param items listitem(s) to restore
     * @returns was the restore successful
     */
    private async restoreListitemFromTrash(trash: ListitemTrashModel, items: ListitemModel | ListitemModel[]): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const list = await this.GetList(trash.uuid);
        let success = false;
        if (list) {
            if (!Array.isArray(items)) {
                items = [items];
            }

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (list.Items.some(i => i.Uuid == item.uuid)) {
                    //if there is an item with this uuid, give the restored item a new one
                    item.uuid = await this.createUuid(list);
                }
                list.AddItem(item);
            }

            if (await this.ListsProvider.StoreList(list)) {
                await this.TrashItemsProvider.EraseListitem(trash, items);
                Logger.Debug(`Restored ${items.length} listitem(s) from trash of list ${ListitemTrashUtils.toLog(trash)}`);
                this.syncListToWatch(list);
                success = true;
                const text = !Array.isArray(items) || items.length == 1 ? "service-lists.restore_item_success" : "service-lists.restore_item_success_plural";
                this.Popups.Toast.Success(text);
            } else {
                Logger.Error(`Could not restore ${items.length} listitem(s) from trash of list ${ListitemTrashUtils.toLog(trash)}`);
                success = false;
                const text = !Array.isArray(items) || items.length == 1 ? "service-lists.restore_item_error" : "service-lists.restore_item_error_plural";
                this.Popups.Toast.Error(text);
            }
        }
        AppService.AppToolbar?.ToggleProgressbar(false);
        return success;
    }

    /**
     * erases a list from trash
     * @param lists Lists to be erased
     */
    private async eraseListFromTrash(lists: List | List[]): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        if (!Array.isArray(lists)) {
            lists = [lists];
        }
        const ret = await this.TrashProvider.EraseLists(lists.map(l => l.Uuid));

        if (ret == lists.length) {
            Logger.Debug(`Erased ${ret} list(s) from trash`);
        } else {
            Logger.Error(`Erased ${ret} list(s) from trash, but could not erase ${lists.length - ret} list(s)`);
        }

        AppService.AppToolbar?.ToggleProgressbar(false);

        return ret == lists.length;
    }

    /**
     * set new order numbers of list, depending on there position in the array
     * @param lists lists to be ordered
     * @returns reordered lists
     */
    private async cleanOrderLists(lists: List[]): Promise<List[]> {
        let update = false;
        let order = 0;
        for (let i = 0; i < lists.length; i++) {
            const list = lists[i];
            list.Order = order++;
            if (list.Dirty) {
                await this.StoreList(list);
                update = true;
            }
        }
        if (update) {
            this._lists = lists;
            this.onListsChangedSubject.next(this._lists);
        }
        return lists;
    }
}
