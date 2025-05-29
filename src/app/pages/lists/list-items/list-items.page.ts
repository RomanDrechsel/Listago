import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { IonButton, IonCheckbox, IonContent, IonFab, IonFabButton, IonIcon, IonImg, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonReorder, IonReorderGroup, IonTextarea, ItemReorderEventDetail } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { Subscription } from "rxjs";
import type { EditMenuAction } from "src/app/components/main-toolbar-edit-menu-modal/main-toolbar-edit-menu-modal.component";
import { MainToolbarListsCustomMenuComponent } from "src/app/components/main-toolbar-lists-custom-menu/main-toolbar-lists-custom-menu.component";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { EMenuItemType, MenuItem, MenuitemFactory } from "../../../classes/menu-items";
import { PageAddNewComponent } from "../../../components/page-add-new/page-add-new.component";
import { PageEmptyComponent } from "../../../components/page-empty/page-empty.component";
import { List } from "../../../services/lists/list";
import { Listitem } from "../../../services/lists/listitem";
import { Locale } from "../../../services/localization/locale";
import { EPrefProperty } from "../../../services/storage/preferences.service";
import { AnimatedListPageBase } from "../animated-list-page-base";

@Component({
    selector: "app-list-items",
    templateUrl: "./list-items.page.html",
    styleUrls: ["./list-items.page.scss"],
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [IonLabel, IonCheckbox, IonImg, IonButton, IonTextarea, IonFabButton, IonFab, IonReorder, IonItem, IonItemOptions, IonItemSliding, IonIcon, IonItemOption, IonReorderGroup, IonList, IonContent, CommonModule, FormsModule, TranslateModule, MainToolbarComponent, PageAddNewComponent, PageEmptyComponent, MainToolbarListsCustomMenuComponent],
})
export class ListItemsPage extends AnimatedListPageBase {
    @ViewChild("quickAdd", { read: IonTextarea, static: false }) private quickAdd?: IonTextarea;
    private _list?: List = undefined;

    private _listSubscription?: Subscription;
    private _connectIQSubscription?: Subscription;

    private _useTrash = true;
    private _listTitle?: string = undefined;
    private _informedSyncForNewlist: string | number | undefined = undefined;
    private _preferencesSubscription?: Subscription;

    private readonly Route = inject(ActivatedRoute);

    public get List(): List | undefined {
        return this._list;
    }

    public get PageTitle(): string {
        if (!this._list) {
            if (this._listTitle?.length) {
                return this._listTitle;
            } else {
                return Locale.getText("page_listitems.loading");
            }
        } else {
            return this._list.Name;
        }
    }

    constructor() {
        super();
        this._animationDirection = "left";
    }

    public override async ionViewWillEnter() {
        await super.ionViewWillEnter();
        this._itemsInitialized = false;
        const listtitle = this.Route.snapshot.queryParamMap.get("title");
        if (listtitle) {
            this._listTitle = listtitle;
        }

        if (!this._list || this._list.isPeek) {
            (async () => {
                // no wait
                const id = Number(this.Route.snapshot.paramMap.get("id"));
                if (id && Number(id) != Number.NaN) {
                    this._list = await this.ListsService.GetList(id);
                    this.appComponent.setAppPages(this.ModifyMainMenu());
                    if (this._list) {
                        this._itemsInitialized = true;
                        this.Preferences.Set(EPrefProperty.OpenedList, this._list.Id);
                        this.onItemsChanged();
                    }
                }
            })();
        } else {
            this._itemsInitialized = true;
        }

        this._useTrash = await this.Preferences.Get<boolean>(EPrefProperty.TrashListitems, true);
        this._preferencesSubscription = this.Preferences.onPrefChanged$.subscribe(prop => {
            if (prop.prop == EPrefProperty.TrashListitems) {
                this._useTrash = prop.value as boolean;
            }
        });

        this._listSubscription = this.ListsService.onListChanged$.subscribe(async list => {
            if (list && list.equals(this._list) && list.isPeek == false) {
                this._list = list;
                this.appComponent.setAppPages(this.ModifyMainMenu());
                this._itemsInitialized = true;
                this.onItemsChanged();
            }
        });

        this._connectIQSubscription = this.ConnectIQ.onInitialized$.subscribe(async () => {
            this.appComponent.setAppPages(this.ModifyMainMenu());
        });

        if (this.List && this.List.Sync && this._informedSyncForNewlist != this.List.Id && (await this.Preferences.Get(EPrefProperty.SyncListOnDevice, false)) == false) {
            const new_created = this.Route.snapshot.queryParamMap.get("created");
            if (new_created) {
                this._informedSyncForNewlist = this.List.Id;
                await this.informSyncSettings();
            }
        }
    }

    public override async ionViewWillLeave() {
        await super.ionViewWillLeave();
        await this.Preferences.Remove(EPrefProperty.OpenedList);
        this._preferencesSubscription?.unsubscribe();
        this._listSubscription?.unsubscribe();
        this._connectIQSubscription?.unsubscribe();
    }

    public onSwipeRight(item: Listitem) {
        this.DeleteItem(item);
    }

    public onSwipeLeft(item: Listitem) {
        this.HideItem(item);
    }

    public editItem(item: Listitem) {
        if (this.List) {
            this.ListsService.EditListitem(this.List, item);
        }
    }

    public async EmptyList(): Promise<boolean> {
        if (this.List) {
            const del = await this.ListsService.EmptyLists(this.List, false);
            return del ?? false;
        }
        return false;
    }

    public async DeleteItem(items: Listitem | Listitem[]) {
        let success: boolean | undefined = undefined;
        if (this.List) {
            success = await this.ListsService.DeleteListitem(this.List, items, false, false);
            if (success) {
                this.appComponent.setAppPages(this.ModifyMainMenu());
            }
        }
        this._itemsList?.closeSlidingItems();
        return success;
    }

    public async HideItem(items: Listitem | Listitem[], hide: boolean | undefined = undefined): Promise<boolean | undefined> {
        let success: boolean | undefined = undefined;
        if (this.List) {
            success = await this.ListsService.ToggleHiddenListitem(this.List, items, hide);
        }
        this._itemsList?.closeSlidingItems();
        return success;
    }

    public async PinItem(items: Listitem | Listitem[], pin: boolean | undefined = undefined): Promise<boolean | undefined> {
        let success: boolean | undefined = undefined;
        if (this.List) {
            success = await this.ListsService.ToggleLockListitem(this.List, items, pin);
        }
        this._itemsList?.closeSlidingItems();
        return success;
    }

    public async AddItem() {
        if (this.List) {
            await this.ListsService.NewListitem(this.List);
            this.appComponent.setAppPages(this.ModifyMainMenu());
        }
    }

    public async HandleReorder(event: CustomEvent<ItemReorderEventDetail>) {
        if (!this._disableClick && this._initAnimationDone && this._list) {
            this._list.ReorderItems(event.detail.complete(this._list.Items) as Listitem[]);
            await this.ListsService.StoreList(this._list, false, true, true);

            this._disableClick = true;
            setTimeout(() => {
                this._disableClick = false;
            }, 300);
        }
        event.stopImmediatePropagation();
    }

    public async DeleteList(): Promise<boolean> {
        if (this.List) {
            const del = await this.ListsService.DeleteLists(this.List);
            if (del === true) {
                this.NavController.navigateBack("/lists");
            }
            return del ?? false;
        }
        return false;
    }

    public async EditList(): Promise<boolean> {
        if (this.List) {
            this.appComponent.CloseMenu();
            const edit = await this.ListsService.EditList(this.List);
            if (edit == true && this.List.Sync == true && (await this.Preferences.Get(EPrefProperty.SyncListOnDevice, false)) == false) {
                await this.informSyncSettings();
            }
            return true;
        }
        return false;
    }

    public override ModifyMainMenu(): MenuItem[] {
        const menu = [];
        if (this.List) {
            menu.push(MenuitemFactory(EMenuItemType.ListsTrash, { hidden: true }));
            if (this.ConnectIQ.Initialized) {
                menu.push(
                    MenuitemFactory(EMenuItemType.Devices, {
                        title_id: "page_listitems.menu_devices",
                        onClick: async () => {
                            this.ListsService.TransferList(this.List!.Id);
                            return true;
                        },
                    }),
                );
            }
            menu.push(
                MenuitemFactory(EMenuItemType.ListitemsTrash, { url_addition: `${this.List.Id}`, disabled: !this._useTrash }),
                MenuitemFactory(EMenuItemType.EditList, { onClick: () => this.EditList() }),
                MenuitemFactory(EMenuItemType.EmptyList, { onClick: () => this.EmptyList(), disabled: this.List.Items.length <= 0 }),
                MenuitemFactory(EMenuItemType.DeleteList, { onClick: () => this.DeleteList() }),
            );
        }
        return menu;
    }

    public clickOnItem(event: MouseEvent, item: Listitem) {
        if (!this._disableClick) {
            this._disableClick = true;
            if (this._editMode) {
                if (this.isItemSelected(item)) {
                    this._selectedItems = this._selectedItems.filter(l => l != item.Id);
                } else {
                    this._selectedItems.push(item.Id);
                }
            } else {
                this.editItem(item);
            }
            setTimeout(() => {
                this._disableClick = false;
            }, 100);
        }
        event.stopImmediatePropagation();
    }

    public async QuickAddItem(event: MouseEvent) {
        if (this.List && this.quickAdd?.value && this.quickAdd.value.trim().length > 0) {
            event.stopImmediatePropagation();
            await this.ListsService.AddNewListitem(this.List, { item: this.quickAdd.value.trim() });
            await this.ScrollToBottom(true);
            this.cdr.detectChanges();
            this.quickAdd.value = "";
            this.quickAdd.setFocus();
            return false;
        }
        return true;
    }

    public isItemSelected(item: Listitem): boolean {
        return this._selectedItems.indexOf(item.Id) >= 0;
    }

    private async informSyncSettings(): Promise<void> {
        if (await this.Popups.Alert.YesNo({ message: "comp-listeditor.sync_settings", translate: true })) {
            this.NavController.navigateForward("/settings/lists-transmission", { queryParams: { syncList: this.List } });
        }
    }

    protected override getEditMenuActions(): EditMenuAction[] {
        if (!this._list) {
            return [];
        }
        let pin_items = false;
        let hide_items = false;
        for (let i = 0; i < this._selectedItems.length; i++) {
            const item_id = this._selectedItems[i];
            const item = this._list!.Items.find(i => i.Id == item_id);
            if (item) {
                if (!item.Locked) {
                    pin_items = true;
                }
                if (!item.Hidden) {
                    hide_items = true;
                }
                if (pin_items && hide_items) {
                    break;
                }
            }
        }

        let texts = [];
        if (this._selectedItems.length == 1) {
            texts = this.Locale.getText(["comp-toolbar-edit-menu.item-pin", "comp-toolbar-edit-menu.item-unpin", "comp-toolbar-edit-menu.item-hide", "comp-toolbar-edit-menu.item-show", "comp-toolbar-edit-menu.item-delete"]);
            texts["pin"] = pin_items ? texts["comp-toolbar-edit-menu.item-pin"] : texts["comp-toolbar-edit-menu.item-unpin"];
            texts["hide"] = hide_items ? texts["comp-toolbar-edit-menu.item-hide"] : texts["comp-toolbar-edit-menu.item-show"];
            texts["delete"] = texts["comp-toolbar-edit-menu.item-delete"];
        } else {
            texts = this.Locale.getText(["comp-toolbar-edit-menu.items-pin", "comp-toolbar-edit-menu.items-unpin", "comp-toolbar-edit-menu.items-hide", "comp-toolbar-edit-menu.items-show", "comp-toolbar-edit-menu.items-delete"], { num: this._selectedItems.length });
            texts["pin"] = pin_items ? texts["comp-toolbar-edit-menu.items-pin"] : texts["comp-toolbar-edit-menu.items-unpin"];
            texts["hide"] = hide_items ? texts["comp-toolbar-edit-menu.items-hide"] : texts["comp-toolbar-edit-menu.items-show"];
            texts["delete"] = texts["comp-toolbar-edit-menu.items-delete"];
        }

        return [
            {
                text: texts["pin"],
                icon: `/assets/icons/${pin_items ? "pin" : "pin_off"}.svg`,
                click: async () => {
                    this.editMenu?.leaveEditMode(true);
                    if (this.List) {
                        const pin = await this.PinItem(
                            this.List.Items.filter(l => this._selectedItems.indexOf(l.Id!) >= 0),
                            pin_items,
                        );
                        if (pin === true) {
                            this._selectedItems = [];
                        } else if (pin === undefined) {
                            this.editMenu?.enterEditMode();
                        }
                    }
                },
            },
            {
                text: texts["hide"],
                icon: `/assets/icons/${hide_items ? "eye_off" : "eye"}.svg`,
                click: async () => {
                    this.editMenu?.leaveEditMode(true);
                    if (this.List) {
                        const hide = await this.HideItem(
                            this.List.Items.filter(l => this._selectedItems.indexOf(l.Id!) >= 0),
                            hide_items,
                        );
                        if (hide === true) {
                            this._selectedItems = [];
                        } else if (hide === undefined) {
                            this.editMenu?.enterEditMode();
                        }
                    }
                },
            },
            {
                text: texts["delete"],
                icon: "/assets/icons/menu/trash_items.svg",
                click: async () => {
                    this.editMenu?.leaveEditMode(true);
                    if (this.List) {
                        const del = await this.DeleteItem(this.List.Items.filter(l => this._selectedItems.indexOf(l.Id) >= 0));
                        if (del === true) {
                            this._selectedItems = [];
                        } else if (del === undefined) {
                            this.editMenu?.enterEditMode();
                        }
                    }
                },
            },
        ];
    }
}
