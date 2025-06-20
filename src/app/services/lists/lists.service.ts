import { inject, Injectable } from "@angular/core";
import { Keyboard } from "@capacitor/keyboard";
import { AlertInput, ModalController, NavController } from "@ionic/angular/standalone";
import { BehaviorSubject, interval, type Subscription } from "rxjs";
import { HelperUtils } from "src/app/classes/utils/helper-utils";
import { StringUtils } from "src/app/classes/utils/string-utils";
import { ListEditor } from "src/app/components/list-editor/list-editor.component";
import { ListItemEditor, ListItemEditorMultiple } from "src/app/components/list-item-editor/list-item-editor.component";
import { AppService } from "../app/app.service";
import type { ConnectIQDevice } from "../connectiq/connect-iq-device";
import { ConnectIQMessageType } from "../connectiq/connect-iq-message-type";
import { ConnectIQService } from "../connectiq/connect-iq.service";
import { LocalizationService } from "../localization/localization.service";
import { Logger } from "../logging/logger";
import { PopupsService } from "../popups/popups.service";
import { FileBackendConverter } from "../storage/lists/file-backend/file-backend-converter";
import { type ListsOrder, type ListsOrderDirection, MainSqliteBackendService } from "../storage/lists/main-sqlite-backend.service";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";
import { KeepInTrash } from "./keep-in-trash";
import { List, type ListReset, type ListSyncDevice } from "./list";
import { Listitem } from "./listitem";

@Injectable({
    providedIn: "root",
})
export class ListsService {
    private readonly Preferences = inject(PreferencesService);
    private readonly ModalCtrl = inject(ModalController);
    private readonly Popups = inject(PopupsService);
    private readonly NavController = inject(NavController);
    private readonly Locale = inject(LocalizationService);
    private readonly ConnectIQ = inject(ConnectIQService);
    public readonly BackendService = inject(MainSqliteBackendService);

    private _keepInTrashStock: KeepInTrash.Enum = KeepInTrash.Default;
    private _syncLists: boolean = false;
    private _removeOldTrashEntriesTimer?: Subscription;
    private readonly _listIndex: Map<number, List> = new Map();

    private _informedAboutNoReadyDevice: boolean = false;

    /**
     * if automatic syncing is disabled in preferences and a list ist stored as sync list,
     * then open a popup. But only once per list...
     */
    private _lastSyncInformList?: number;

    private onTrashItemsDatasetChangedSubject = new BehaviorSubject<List | undefined>(undefined);
    public onTrashItemsDatasetChanged$ = this.onTrashItemsDatasetChangedSubject.asObservable();

    private onTrashDatasetChangedSubject = new BehaviorSubject<List[] | undefined>(undefined);
    public onTrashDatasetChanged$ = this.onTrashDatasetChangedSubject.asObservable();

    private onListChangedSubject = new BehaviorSubject<List | undefined>(undefined);
    public onListChanged$ = this.onListChangedSubject.asObservable();

    private onListsChangedSubject = new BehaviorSubject<List[] | undefined>(undefined);
    public onListsChanged$ = this.onListsChangedSubject.asObservable();

    public async Initialize() {
        await this.BackendService.Initialize();
        this._syncLists = await this.Preferences.Get<boolean>(EPrefProperty.SyncListOnDevice, false);
        this.Preferences.onPrefChanged$.subscribe(arg => {
            if (arg.prop == EPrefProperty.TrashKeepinStock) {
                this.removeOldTrash(arg.value);
            } else if (arg.prop == EPrefProperty.SyncListOnDevice) {
                this._syncLists = arg.value;
            }
        });
        await this.removeOldTrash(await this.Preferences.Get<number>(EPrefProperty.TrashKeepinStock, this._keepInTrashStock));
        await new FileBackendConverter(this.BackendService, this.ModalCtrl).CheckLegacyBackend(async () => {
            await this.GetLists();
        });
        Logger.Debug(`Lists service initialized`);
    }

    /**
     * get all lists with at least peek data from backend
     * @param reload force to reload lists from backend
     * @returns array of all lists
     */
    public async GetLists(args?: { orderBy?: ListsOrder; orderDir?: ListsOrderDirection }): Promise<List[]> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const lists = await this.BackendService.queryLists({ peek: true, trash: false, orderBy: args?.orderBy, orderDir: args?.orderDir });
        lists.forEach(l => {
            const list = this._listIndex.get(l.Id!);
            if (list) {
                list.clone(l);
            } else {
                this._listIndex.set(l.Id!, l);
            }
        });
        Array.from(this._listIndex.keys()).forEach(id => {
            if (!lists.some(l => l.Id == id)) {
                this._listIndex.delete(id);
            }
        });

        AppService.AppToolbar?.ToggleProgressbar(false);
        return lists;
    }

    /**
     * returns all lists in the trash
     * @returns array of lists in trash
     */
    public async GetTrash(): Promise<List[]> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const trash = await this.BackendService.queryLists({ peek: true, trash: true, orderBy: "deleted", orderDir: "DESC" });
        AppService.AppToolbar?.ToggleProgressbar(false);
        return trash;
    }

    /**
     * gets a specific list with all items
     * @param id unique id of the list
     * @returns List object
     */
    public async GetList(id: number): Promise<List | undefined> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const list = await this.BackendService.queryList({ list: id });
        if (list) {
            const index = this._listIndex.get(list.Id);
            if (index) {
                index.clone(list);
            } else {
                this._listIndex.set(list.Id, list);
            }
        } else {
            this._listIndex.delete(id);
        }
        AppService.AppToolbar?.ToggleProgressbar(false);

        return this._listIndex.get(id);
    }

    /**
     * returns the listitems in trash of a list
     * @param id unique identifier of the list
     * @returns ListitemTrashModel object
     */
    public async GetListitemTrash(id: number | List): Promise<Listitem[] | undefined> {
        AppService.AppToolbar?.ToggleProgressbar(false);
        const trash = await this.BackendService.queryListitems({ list: id, trash: true, itemsOrderBy: "deleted", itemsOrderDir: "DESC" });
        AppService.AppToolbar?.ToggleProgressbar(false);
        return trash;
    }

    /**
     * opens the list editor to create a new list
     */
    public async NewList() {
        const list = await ListEditor(this.ModalCtrl, {});
        if (list) {
            if (await this.StoreList(list)) {
                Logger.Notice(`Created new list ${list.toLog()}`);
                await this.addListToIndex(list);
                await this.cleanOrderLists();
                this.onListsChangedSubject.next(await this.GetLists());
                this.NavController.navigateForward(`/lists/items/${list.Id}`);
                this.informAboutDisabledSyncPref(list);
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
                this.informAboutDisabledSyncPref(list);
            } else if (store === false) {
                this.Popups.Toast.Error("service-lists.store_list_error");
            }
            return store;
        }
        return undefined;
    }

    /**
     * prompts the user to delete a list
     * @param lists list(s) to be deleted
     * @param no_prompt delete the list without prompt
     * @returns list deletion successful? undefined if the user canceled it
     */
    public async DeleteLists(lists: List | List[], no_prompt: boolean = false): Promise<boolean | undefined> {
        const del_on_watch = await this.Preferences.Get(EPrefProperty.DeleteListOnDevice, false);
        if (!no_prompt && (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmDeleteList, true))) {
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
                return this.removeLists(lists, del_on_watch);
            } else {
                return undefined;
            }
        } else {
            return this.removeLists(lists, del_on_watch);
        }
    }

    /**
     * prompts the user to delete all items of a list
     * @param lists list to be emptied
     * @param force empty the list without prompt
     * @returns deletion successful? undefined if user canceled it
     */
    public async EmptyLists(lists: List | List[], force: boolean = false): Promise<boolean | undefined> {
        if (!force && (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmEmptyList, true))) {
            let text = "";
            if (Array.isArray(lists) && lists.length > 1) {
                text = this.Locale.getText("service-lists.empty_confirm_plural");
            } else {
                text = this.Locale.getText("service-lists.empty_confirm", { name: StringUtils.shorten(Array.isArray(lists) ? lists[0].Name : lists.Name, 40) });
            }

            if (await this.Popups.Alert.YesNo({ message: text })) {
                return await this.emptyLists(lists);
            } else {
                return undefined;
            }
        } else {
            return await this.emptyLists(lists);
        }
    }

    /**
     * reorder the lists
     * @param lists
     */
    public async ReorderLists(lists: List[]): Promise<void> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        for (let i = 0; i < lists.length - 1; ++i) {
            lists[i].Order = i;
            await this.StoreList(lists[i], false, false, false);
        }
        AppService.AppToolbar?.ToggleProgressbar(false);
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
     * @param args information about listitem to be added
     * @returns item-adding successful?
     */
    public async AddNewListitem(list: List, args: { item: string; order?: number; locked?: boolean; hidden?: boolean }): Promise<boolean> {
        list.AddItem({ id: HelperUtils.RandomNegativNumber(), list_id: list.Id, item: args.item, order: args.order ?? -1, locked: args.locked ? 1 : 0, hidden: args.hidden ? 1 : 0, created: Date.now(), modified: Date.now() });
        if (await this.StoreList(list, false, true, true)) {
            this.onListsChangedSubject.next(await this.GetLists());
            return true;
        }

        return false;
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
            if (await this.StoreList(list, undefined, true, false)) {
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
     * @param no_prompt delete the listitem without prompting
     * @returns deletion successful? undefined if user canceled it
     */
    public async DeleteListitem(list: List, items: Listitem | Listitem[], no_prompt: boolean = false, keep_locked: boolean = true): Promise<boolean | undefined> {
        if (!no_prompt && (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmDeleteListitem, true))) {
            let text = "";
            if (Array.isArray(items) && items.length > 1) {
                text = this.Locale.getText("service-lists.delete_item_confirm_plural");
            } else {
                text = this.Locale.getText("service-lists.delete_item_confirm", { name: StringUtils.shorten(Array.isArray(items) ? items[0].Item : items.Item, 40) });
            }
            if (await this.Popups.Alert.YesNo({ message: text })) {
                return this.removeListitem(list, items, keep_locked);
            } else {
                return undefined;
            }
        } else {
            return this.removeListitem(list, items, keep_locked);
        }
    }

    /**
     * prompts the user to finally erase a listitem from trash
     * @param trash trash of the list
     * @param items the item in Trash to be erased
     * @returns erase successful, undefined if user canceled it
     */
    public async EraseListitemFromTrash(trash: List, items: Listitem | Listitem[]): Promise<boolean | undefined> {
        if (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmEraseListitem, true)) {
            let text = "";
            if (Array.isArray(items) && items.length > 1) {
                text = this.Locale.getText("service-lists.erase_item_confirm_plural");
            } else {
                text = this.Locale.getText("service-lists.erase_item_confirm", { name: StringUtils.shorten(Array.isArray(items) ? items[0].Item : items.Item, 40) });
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
     * @param no_prompt empty the trash without prompt
     * @returns empty successfull, undefined if user canceled it
     */
    public async WipeTrash(no_prompt: boolean = false, prompt_anyway: boolean = false): Promise<boolean | undefined> {
        if (prompt_anyway || (!no_prompt && (await this.Preferences.Get(EPrefProperty.ConfirmEmptyTrash, true)))) {
            let text;
            const count = await this.BackendService.queryListsCount({ trash: true });
            if (count > 0) {
                if (count == 1) {
                    text = this.Locale.getText("service-lists.empty_trash_confirm_single");
                } else {
                    text = this.Locale.getText("service-lists.empty_trash_confirm", { count: count });
                }
                text += this.Locale.getText("service-lists.undo_warning");
                if (await this.Popups.Alert.YesNo({ message: text })) {
                    return (await this.wipeListsTrash()) >= 0;
                } else {
                    return undefined;
                }
            } else {
                return true;
            }
        } else {
            return (await this.wipeListsTrash()) >= 0;
        }
    }

    public async WipeListitemTrash(no_prompt: boolean = false, prompt_anyway: boolean = false): Promise<boolean | undefined> {
        if (prompt_anyway || (!no_prompt && (await this.Preferences.Get(EPrefProperty.ConfirmEmptyTrash, true)))) {
            const count = await this.BackendService.queryListitemsCount({ list: "all", trash: true });
            if (
                count > 0 &&
                (await this.Popups.Alert.YesNo({
                    message: "page_settings_trash.confirm_clearitemstrash",
                    button_yes: "page_settings_trash.confirm_clearitemstrash_ok",
                    button_no: "page_settings_trash.confirm_clearitemstrash_cancel",
                    translate: true,
                }))
            ) {
                return (await this.wipeListitemTrash()) >= 0;
            }
            return undefined;
        } else {
            return (await this.wipeListitemTrash()) >= 0;
        }
    }

    /**
     * removes all listitems from trash for a certain list
     * @param trash the list, the items in trash should be removed
     * @returns removal successful? undefined if the user canceled it
     */
    public async EmptyListitemTrash(trash: List): Promise<boolean | undefined> {
        if (await this.Preferences.Get(EPrefProperty.ConfirmEmptyTrash, true)) {
            let text;
            if (trash.ItemsInTrashCount == 1) {
                text = this.Locale.getText("service-lists.empty_trash_listitems_confirm_single");
            } else {
                text = this.Locale.getText("service-lists.empty_trash_listitems_confirm", { count: trash.ItemsInTrashCount });
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
    public async RestoreListitemFromTrash(trash: List, items: Listitem | Listitem[]): Promise<boolean | undefined> {
        if (await this.Preferences.Get<boolean>(EPrefProperty.ConfirmRestoreListitem, true)) {
            let text = "";
            if (!Array.isArray(items) || items.length == 1) {
                text = this.Locale.getText("service-lists.restore_item_confirm", { name: StringUtils.shorten(Array.isArray(items) ? items[0].Item : items.Item, 40) });
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
     * stores a list in backend up there are any changes
     * @param list list to be stored
     * @param force store the list, even if there are no changes
     * @returns storage successful, undefined if no storage was needed
     */
    public async StoreList(list: List, force: boolean = false, fire_event: boolean = true, progressbar: boolean = true): Promise<boolean | undefined> {
        if (progressbar) {
            AppService.AppToolbar?.ToggleProgressbar(true);
        }
        let store: boolean | undefined;
        await this.cleanOrderListitems(list, false);
        if (!list.Id || list.Dirty || force) {
            const list_id = await this.BackendService.storeList({ list: list, force: force });
            if (list_id === false) {
                store = false;
            } else if (list_id) {
                list.Id = list_id;
                list.Clean();
                store = true;
            } else {
                store = undefined;
            }
        }

        if (store) {
            if (fire_event) {
                this.onListChangedSubject.next(list);
            }
            if (store !== undefined) {
                //only sync, if the list was dirty
                this.syncListToWatch(list);
            }
        }

        if (progressbar) {
            AppService.AppToolbar?.ToggleProgressbar(false);
        }

        return store;
    }

    /**
     * transfer a list to a device
     * @param lists list to transfer (or the uuid)
     * @param device device to be transfered, if null the default device is used
     */
    public async TransferList(lists?: List | List[] | string | number, device?: ConnectIQDevice | number): Promise<boolean | undefined> {
        if (typeof lists == "string") {
            lists = parseInt(lists, 10);
        }
        if (typeof lists === "number") {
            lists = await this.GetList(lists);
        }

        if (!lists) {
            return false;
        }

        if (!Array.isArray(lists)) {
            lists = [lists];
        }

        if (typeof device === "number") {
            device = await this.ConnectIQ.GetDevice(device);
        }

        if (!device) {
            device = await this.ConnectIQ.GetDefaultDevice({ select_device_if_undefined: true, btn_text: this.Locale.getText("service-lists.transmit_send_btn") });
        }

        if (device && device.State == "Ready") {
            const text_key = lists.length > 1 ? "service-lists.transmit_confirm_plural" : "service-lists.transmit_confirm";
            const confirm = await this.Preferences.Get<boolean>(EPrefProperty.ConfirmTransmitList, true);
            const locale = this.Locale.getText([text_key, "yes", "no"], { device: device.Name });
            if (!confirm || (await this.Popups.Alert.YesNo({ message: locale[text_key], button_yes: locale["yes"], button_no: locale["no"] }))) {
                AppService.AppToolbar?.ToggleProgressbar(true);

                let errors = 0;
                for (let i = 0; i < lists.length; ++i) {
                    if (device && device.State == "Ready") {
                        const l = lists[i];
                        let peek = false;
                        if (l.isPeek) {
                            peek = true;
                            const copy = await this.GetList(l.Id);
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
                    Logger.Debug(`Could not transfer list ${lists[i].toLog()} to device ${device.toLog()}`);
                }

                AppService.AppToolbar?.ToggleProgressbar(false);

                if (errors > 0) {
                    if (lists.length == 1) {
                        this.Popups.Toast.Error("service-lists.transmit_error");
                    } else if (errors == lists.length) {
                        this.Popups.Toast.Error("service-lists.transmit_error_plural");
                    } else {
                        this.Popups.Toast.Error("service-lists.transmit_error_partial");
                    }
                    return false;
                } else {
                    if (lists.length == 1) {
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
            Logger.Debug(`Could not transfer list ${lists.length} list(s) to device ${device.toLog()}: device is state ${device.State}`);
        } else {
            Logger.Debug(`Could not transfer list ${lists.length} list(s), no device fould`);
        }
        if (lists.length == 1) {
            this.Popups.Toast.Error("service-lists.transmit_error");
        } else {
            this.Popups.Toast.Error("service-lists.transmit_error_plural");
        }
        return false;
    }

    /**
     * purges all details of lists in memory
     */
    public PurgeListDetails() {
        this._listIndex.forEach(l => {
            l.PurgeDetails();
        });
    }

    /**
     * returns the number of lists in trash
     * @returns number of lists in trash
     */
    public async GetTrashCount(): Promise<number> {
        return this.BackendService.queryListsCount({ trash: true });
    }

    /**
     * return the number of listitems in the trash of a list
     * @param list the list
     * @returns number of listitems in trash
     */
    public async GetTrashitemsCount(list: List): Promise<number> {
        return this.BackendService.queryListitemsCount({ list: list, trash: true });
    }

    /**
     * remove automatic synchronization from all lists
     */
    public async PurgeAllSyncs(): Promise<void> {
        const lists = await this.GetLists();
        for (let i = 0; i < lists.length; i++) {
            lists[i].SyncDevices = undefined;
            await this.StoreList(lists[i], false, true, false);
        }
        const trash = await this.GetTrash();
        for (let i = 0; i < trash.length; i++) {
            trash[i].SyncDevices = undefined;
            await this.StoreList(trash[i], false, true, false);
        }
        Logger.Debug(`Removed automatic synchronization of all lists`);
    }

    public async createNewList(args: { name: string; order?: number; sync?: ListSyncDevice[]; reset?: ListReset }): Promise<List> {
        return new List(
            {
                name: args.name,
                order: args.order ?? (await this.BackendService.getNextListOrder()),
                created: Date.now(),
                modified: Date.now(),
                sync_devices: args.sync ? JSON.stringify(args.sync) : undefined,
                reset: args.reset ? (args.reset.active ? 1 : 0) : 0,
                reset_interval: args.reset ? args.reset.interval : "daily",
                reset_hour: args.reset?.hour ?? 0,
                reset_minute: args.reset?.minute ?? 0,
                reset_day: args.reset?.day ?? 0,
                reset_weekday: args.reset?.weekday ?? 0,
            },
            [],
            undefined,
            true,
        );
    }

    public async createNewListitem(list: List | number, args: { item: string; note?: string; order?: number; hidden?: boolean; locked?: boolean }): Promise<Listitem> {
        return new Listitem({
            id: HelperUtils.RandomNegativNumber(),
            list_id: typeof list === "number" ? list : list.Id,
            item: args.item,
            note: args.note,
            order: args.order ?? (await this.BackendService.getNextListitemOrder({ list: list })),
            created: Date.now(),
            modified: Date.now(),
            hidden: args.hidden ? 1 : 0,
            locked: args.locked ? 1 : 0,
        });
    }

    /**
     * sync a list to the watch
     * @param obj config for list sync
     */
    public async SyncList(obj: { list: List | number; force_if_sync_is_disabled?: boolean }): Promise<void> {
        const list_to_sync = obj.list instanceof List ? obj.list : await this.GetList(obj.list);
        if (!list_to_sync) {
            Logger.Error(`Could not sync list ${obj.list} to watch, does not exist`);
            return;
        }
        return this.syncListToWatch(list_to_sync, obj.force_if_sync_is_disabled);
    }

    private async addListToIndex(list: List) {
        if (!list.Id) {
            await this.StoreList(list, true, true, true);
        }
        if (list.Id) {
            this._listIndex.set(list.Id, list);
        } else {
            Logger.Error(`Could not store list ${list.toLog()} in index, no Uuid`);
        }
    }

    /**
     * sync changes to a list to the watch
     * @param list List to be synced
     * @param force_if_sync_is_disabled force sync even if list-sync is disabled
     */
    private async syncListToWatch(list: List, force_if_sync_is_disabled: boolean = false): Promise<void> {
        if ((!this._syncLists || !list.Sync) && !force_if_sync_is_disabled) {
            return;
        }

        const devices = (await this.ConnectIQ.getDevices()).filter(device => list.SyncDevices?.some(d => device.Identifier == d.id));
        if (devices.length == 0) {
            Logger.Debug(`No device only for syncing ${list.toLog()}, skipping sync`);
            if (!this._informedAboutNoReadyDevice) {
                //TODO: toast here...
            }
            return;
        }

        let peek = false;
        if (list.isPeek && list.Id) {
            list.copyDetails(await this.GetList(list.Id));
            peek = true;
        }

        var payload = list.toDeviceObject();
        if (peek) {
            list.PurgeDetails();
        }

        if (!payload) {
            Logger.Error(`Could not sync ${list.toLog()}, list serialization failed`);
            return;
        }

        payload = ["issync", ...payload];

        const sendToDevicePromises = devices.map(device =>
            this.ConnectIQ.SendToDevice({ device: device, messageType: ConnectIQMessageType.List, data: payload }).then(success => {
                if (success) {
                    Logger.Debug(`Sync list ${list.toLog()} to watch ${device.toLog()}`);
                } else {
                    Logger.Error(`Failed to sync list ${list.toLog()} to watch ${device.toLog()}`);
                }
            }),
        );

        await Promise.all(sendToDevicePromises);
    }

    /**
     * set the 'Order' property of all lists, as they are in the given list
     * @param lists list to reset the 'Order' property
     * @param force_event publish the list with the signal
     */
    private async cleanOrderLists(force_event: boolean = false, fire_event: boolean = true) {
        let order = 0;
        let changed = false;
        let lists = Array.from(this._listIndex.values());
        lists = lists.sort((a: List, b: List) => a.Order - b.Order);
        for (let i = 0; i < lists.length; i++) {
            const list = lists[i];
            list.Order = order++;
            if (list.Dirty) {
                changed = true;
                await this.StoreList(list, false, false, false);
            }
        }

        if (fire_event && (force_event || changed)) {
            this.onListsChangedSubject.next(await this.GetLists());
        }
    }

    /**
     * correct the order numbers of listitems
     * @param list list, the items are part of
     * @param items items to be ordered
     * @returns list with reordered listitems
     */
    private async cleanOrderListitems(list: List, store: boolean = true): Promise<void> {
        list.cleanItemsOrder();
        if (store) {
            await this.StoreList(list);
        }
    }

    /**
     * move list to trash or removes it completely
     * @param lists list(s) to remove
     * @param delete_on_watch if the list should be deleted on watch
     * @returns was the removal successful
     */
    private async removeLists(lists: List | List[], delete_on_watch: boolean = false): Promise<boolean> {
        if (!Array.isArray(lists)) {
            lists = [lists];
        }
        if (lists.length == 0) {
            return true;
        }

        AppService.AppToolbar?.ToggleProgressbar(true);

        const use_trash = await this.Preferences.Get<boolean>(EPrefProperty.TrashLists, true);

        let deleted: number | false = false;
        if (use_trash) {
            deleted = await this.BackendService.moveListsToTrash({ lists: lists });
            if (deleted === false) {
                if (lists.length == 1) {
                    Logger.Error(`Could not move list {${lists[0].toLog()}} to trash`);
                } else {
                    Logger.Error(`Could not move ${lists.length} lists to trash`);
                }
            } else {
                if (lists.length == 1) {
                    Logger.Debug(`Moved list {${lists[0].toLog()}} to trash`);
                } else {
                    Logger.Debug(`Moved ${lists.length} lists to trash`);
                }
                lists.forEach(l => {
                    l.Deleted = Date.now();
                });
            }
        } else {
            const del = await this.BackendService.deleteLists({ lists: lists, trash: false });
            if (del === false) {
                deleted = false;
                if (lists.length == 1) {
                    Logger.Error(`Could not delete list {${lists[0].toLog()}}`);
                } else {
                    Logger.Error(`Could not delete ${lists.length} lists`);
                }
            } else {
                deleted = del.lists;
                if (lists.length == 1) {
                    Logger.Debug(`Deleted list {${lists[0].toLog()}}`);
                } else {
                    Logger.Debug(`Deleted ${lists.length} lists`);
                }
            }
        }

        if (deleted && deleted > 0) {
            lists.forEach(l => {
                this._listIndex.delete(l.Id);
            });
            await this.cleanOrderLists();
            lists.forEach(l => {
                this.onListChangedSubject.next(l);
                if (delete_on_watch) {
                    this.ConnectIQ.SendToDevice({ device: undefined, messageType: ConnectIQMessageType.DeleteList, data: l.Id });
                }
            });
            this.onListsChangedSubject.next(await this.GetLists());
        }

        if (deleted !== false) {
            if (deleted == 1) {
                this.Popups.Toast.Success("service-lists.delete_success");
            } else if (deleted > 1) {
                this.Popups.Toast.Success("service-lists.delete_success_plural");
            }
        } else {
            if (lists.length == 1) {
                this.Popups.Toast.Error("service-lists.delete_error");
            } else {
                this.Popups.Toast.Error("service-lists.delete_error_plural");
            }
        }

        AppService.AppToolbar?.ToggleProgressbar(false);

        return deleted !== false;
    }

    /**
     * deletes all listitems in the list
     * @param lists list to be emptied
     * @returns was the list stored successful after emptying?
     */
    private async emptyLists(lists: List | List[]): Promise<boolean> {
        if (!Array.isArray(lists)) {
            lists = [lists];
        }

        if (lists.length == 0) {
            return true;
        }

        AppService.AppToolbar?.ToggleProgressbar(true);

        const use_trash = await this.Preferences.Get<boolean>(EPrefProperty.TrashListitems, true);

        let errors = 0;
        let deleted: number | false = 0;
        for (let i = 0; i < lists.length; i++) {
            let list = lists[i];
            if (use_trash) {
                deleted = await this.BackendService.moveListitemsToTrash({ list: list, force: false });
                if (deleted === false) {
                    Logger.Error(`Could not empty list ${list.toLog()} and move items to trash`);
                    errors++;
                } else {
                    Logger.Debug(`Emptied list ${list.toLog()} and moved ${deleted} items to trash`);
                }
            } else {
                deleted = await this.BackendService.deleteListitems({ list: list, items: undefined, trash: false, force: false });
                if (deleted === false) {
                    Logger.Error(`Could not empty list ${list.toLog()}`);
                    errors++;
                } else {
                    Logger.Debug(`Emptied list ${list.toLog()} and deleted ${deleted} items`);
                }
            }
            await this.refreshList(list);
            await this.cleanOrderListitems(list, true);
            if (deleted && deleted > 0) {
                this.onListChangedSubject.next(list);
                if (use_trash) {
                    this.onTrashItemsDatasetChangedSubject.next(list);
                }
            }
        }

        this.onListsChangedSubject.next(await this.GetLists());

        if (errors > 0) {
            if (lists.length == errors) {
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
    private async removeListitem(list: List, items: Listitem | Listitem[], keep_locked: boolean = true): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);

        if (!Array.isArray(items)) {
            items = [items];
        }

        let deleted: number | false = false;
        if (await this.Preferences.Get<boolean>(EPrefProperty.TrashListitems, true)) {
            deleted = await this.BackendService.moveListitemsToTrash({ list: list, items: items, force: !keep_locked });
            if (deleted) {
                Logger.Debug(`Moved ${items.length} listitem(s) of list ${list.toLog()} to trash`);
            } else {
                Logger.Error(`Could not move ${items.length} listitem(s) of list ${list.toLog()} to trash`);
            }
        } else {
            deleted = await this.BackendService.deleteListitems({ list: list, items: items, trash: false, force: !keep_locked });
            if (deleted) {
                Logger.Debug(`Deleted ${deleted} listitem(s) from list ${list.toLog()}`);
            } else {
                Logger.Error(`Could not delete ${items.length} listitem(s) from list ${list.toLog()}`);
            }
        }

        if (deleted && deleted > 0) {
            items.forEach(i => {
                i.Deleted = Date.now();
            });
            list.Items = list.Items.filter(i => !i.Deleted);
            await this.cleanOrderListitems(list, true);
            this.onListChangedSubject.next(list);
            this.onTrashItemsDatasetChangedSubject.next(list);
            this.Popups.Toast.Success(items.length == 1 ? "service-lists.delete_item_success" : "service-lists.delete_item_success_plural", undefined, true);
        } else {
            this.Popups.Toast.Error(items.length == 1 ? "service-lists.delete_item_error" : "service-lists.delete_item_error_plural", undefined, true);
        }

        AppService.AppToolbar?.ToggleProgressbar(false);
        return deleted ? deleted > 0 : false;
    }

    /**
     * erases a listitem from trash
     * @param trash trash of the list, the item should be erased
     * @param items listitem(s) to be erased
     * @returns was the erase successful
     */
    private async eraseListitemFromTrash(trash: List, items: Listitem | Listitem[]): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        if (!Array.isArray(items)) {
            items = [items];
        }
        const del = await this.BackendService.deleteListitems({ list: trash, items: items, trash: true });

        if (del) {
            Logger.Notice(`Erased ${del} listitem(s) from trash of list ${trash.toLog()}`);
            const text = !Array.isArray(items) || items.length == 1 ? "service-lists.erase_item_success" : "service-lists.erase_item_success_plural";
            this.Popups.Toast.Success(text);
            trash.ItemsInTrash = undefined;
            this.onTrashItemsDatasetChangedSubject.next(trash);
        } else {
            Logger.Error(`Could not erease ${items.length} listitem(s) from trash of list ${trash.toLog()}`);
            const text = !Array.isArray(items) || items.length == 1 ? "service-lists.erase_item_error" : "service-lists.erase_item_error_plural";
            this.Popups.Toast.Error(text);
        }

        AppService.AppToolbar?.ToggleProgressbar(false);
        return del ? del >= 0 : false;
    }

    /**
     * empties the trash
     * @returns number of deleted lists
     */
    private async wipeListsTrash(): Promise<number> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const del = await this.BackendService.deleteLists({ lists: undefined, trash: true });
        if (del !== false) {
            Logger.Notice(`Erased ${del.lists} list(s) with ${del.items} item(s) from trash`);
            this.Popups.Toast.Success("service-lists.empty_trash_success");
        } else {
            Logger.Error("Could not wipe lists trash");
            this.Popups.Toast.Error("service-lists.empty_trash_error");
        }

        AppService.AppToolbar?.ToggleProgressbar(false);
        return del !== false ? del.lists : -1;
    }

    private async wipeListitemTrash(): Promise<number> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const del = await this.BackendService.wipeListitems({ trash: true });
        if (del !== false) {
            Logger.Debug(`All ${del} listitem(s) in trash were erased`);
            this.Popups.Toast.Success("service-lists.erase_item_success_plural", undefined, true);
        } else {
            Logger.Error(`Could not wipe listitems trash`);
            this.Popups.Toast.Error("service-lists.erase_item_error_plural", undefined, true);
        }
        AppService.AppToolbar?.ToggleProgressbar(false);
        return del ? del : -1;
    }

    /**
     * empties the listitem trash for a list
     * @param list list to empty
     * @returns was the emptying successful?
     */
    private async emptyListitemTrash(trash: List): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        const ret = await this.BackendService.deleteListitems({ list: trash, items: undefined, force: true, trash: true });
        if (ret !== false) {
            trash.ItemsInTrash = [];
            if (trash) {
                Logger.Notice(`Erased trash of list ${trash.toLog()}`);
            } else {
                Logger.Notice(`Erased trash of all lists`);
            }
            this.Popups.Toast.Success("service-lists.empty_trash_success");
            if (ret > 0) {
                this.onTrashItemsDatasetChangedSubject.next(trash);
            }
        } else {
            if (trash) {
                Logger.Error(`Could not erase trash of list ${trash.toLog()}`);
            } else {
                Logger.Error(`Could not erase trash of all lists`);
            }
            this.Popups.Toast.Error("service-lists.empty_trash_error");
        }
        AppService.AppToolbar?.ToggleProgressbar(false);
        return ret !== false;
    }

    /**
     * restores a list from trash
     * @param list list to restore
     * @returns was the restore successful
     */
    private async restoreListFromTrash(lists: List | List[]): Promise<boolean> {
        if (!Array.isArray(lists)) {
            lists = [lists];
        }

        if (lists.length == 0) {
            return true;
        }

        AppService.AppToolbar?.ToggleProgressbar(true);

        let success = false;
        if (await this.BackendService.restoreListsFromTrash({ lists: lists })) {
            for (let i = 0; i < lists.length; i++) {
                const list = lists[i];
                await this.refreshList(list);
                await this.addListToIndex(list);
            }
            await this.cleanOrderLists(false, false);
            for (let i = 0; i < lists.length; i++) {
                await this.StoreList(lists[i]);
            }

            if (lists.length == 1) {
                Logger.Debug(`Restored list ${lists[0].toLog()} from trash`);
                this.Popups.Toast.Success("service-lists.restore_success");
            } else {
                Logger.Debug(`Restored  ${lists.length} lists from trash`);
                this.Popups.Toast.Success("service-lists.restore_success_plural");
            }
            success = true;
        } else {
            if (lists.length == 1) {
                Logger.Error(`Could not restore list ${lists[0].toLog()} from trash`);
                this.Popups.Toast.Error("service-lists.restore_error");
            } else {
                Logger.Error(`Could not restore ${lists.length} lists from trash`);
                this.Popups.Toast.Error("service-lists.restore_error_plural");
            }
        }
        this.onListsChangedSubject.next(await this.GetLists());
        this.onTrashDatasetChangedSubject.next(await this.GetTrash());

        AppService.AppToolbar?.ToggleProgressbar(false);

        return success;
    }

    /**
     * restores a listitem from the trash of a list
     * @param list list, the items to restore are in
     * @param items listitem(s) to restore
     * @returns was the restore successful
     */
    private async restoreListitemFromTrash(list: List, items: Listitem | Listitem[]): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);

        if (!Array.isArray(items)) {
            items = [items];
        }

        const restore = await this.BackendService.restoreListitemsFromTrash({ list: list, items: items });
        if (restore && restore >= 0) {
            Logger.Debug(`Restored ${restore} listitem(s) from trash of list ${list.toLog()}`);
            await this.refreshList(list);
            await this.cleanOrderListitems(list, true);
            this.syncListToWatch(list);
            const text = !Array.isArray(items) || items.length == 1 ? "service-lists.restore_item_success" : "service-lists.restore_item_success_plural";
            this.Popups.Toast.Success(text);
            list.ItemsInTrash = list.ItemsInTrash?.filter(i => !items.includes(i));
            this.onListChangedSubject.next(list);
            this.onTrashItemsDatasetChangedSubject.next(list);
        } else {
            Logger.Error(`Could not restore ${items.length} listitem(s) from trash of list ${list.toLog()}`);
            const text = items.length == 1 ? "service-lists.restore_item_error" : "service-lists.restore_item_error_plural";
            this.Popups.Toast.Error(text);
        }

        AppService.AppToolbar?.ToggleProgressbar(false);
        return restore !== false && restore >= 0;
    }

    /**
     * erases lists from trash
     * @param lists Lists to be erased
     */
    private async eraseListFromTrash(lists: List | List[]): Promise<boolean> {
        AppService.AppToolbar?.ToggleProgressbar(true);
        if (!Array.isArray(lists)) {
            lists = [lists];
        }
        const del = await this.BackendService.deleteLists({ lists: lists, trash: true });

        if (del !== false) {
            if (del.lists > 0) {
                if (del.lists == 1) {
                    this.Popups.Toast.Success("service-lists.erase_success", undefined, true);
                } else {
                    this.Popups.Toast.Success("service-lists.erase_success_plural", undefined, true);
                }
                Logger.Debug(`Erased ${del.lists} list(s) with ${del.items} item(s) from trash`);
                this.onTrashDatasetChangedSubject.next(await this.GetTrash());
            }
        } else {
            if (lists.length == 1) {
                Logger.Error(`Could not erase list '${lists[0].toLog()}' from trash`);
                this.Popups.Toast.Error("service-lists.erase_error", undefined, true);
            } else {
                Logger.Error(`Could not erased ${lists.length} lists from trash`);
                this.Popups.Toast.Error("service-lists.erase_error_plural", undefined, true);
            }
        }

        AppService.AppToolbar?.ToggleProgressbar(false);

        return del !== false;
    }

    private async refreshList(list: List): Promise<void> {
        if (!list.Id) {
            return;
        }
        const copy = await this.GetList(list.Id);
        if (copy) {
            list.clone(copy);
        }
    }

    private async removeOldTrash(value: number | KeepInTrash.Enum) {
        value = KeepInTrash.FromNumber(value);
        if (KeepInTrash.StockPeriod(value)) {
            this._removeOldTrashEntriesTimer?.unsubscribe();
            this._removeOldTrashEntriesTimer = interval(value * 60 * 60 * 24).subscribe(() => {
                this.BackendService.cleanUp({ olderThan: value * 60 * 60 * 24 });
            });
            await this.BackendService.cleanUp({ olderThan: value * 60 * 60 * 24 });
            this.BackendService.MaxTrashCount = undefined;
        } else {
            this._removeOldTrashEntriesTimer?.unsubscribe();
            this._removeOldTrashEntriesTimer = undefined;
            this.BackendService.MaxTrashCount = KeepInTrash.StockSize(value);
            await this.BackendService.cleanUp({ maxCount: KeepInTrash.StockSize(value) });
        }
    }

    /**
     * if automatic sync is disabled in preferences, but a list sould be automaticly synced, then inform the user and ask him to enable the sync preference
     * @param list the list which should be synced automatically
     */
    private async informAboutDisabledSyncPref(list: List): Promise<void> {
        if (list.Sync == true && this._lastSyncInformList != list.Id && (await this.Preferences.Get(EPrefProperty.SyncListOnDevice, false)) == false) {
            if (await this.Popups.Alert.YesNo({ message: "comp-listeditor.sync_settings", translate: true })) {
                this.NavController.navigateForward("/settings/lists-transmission", { queryParams: { syncList: list.Id } });
            }
            this._lastSyncInformList = list.Id;
        }
    }
}
