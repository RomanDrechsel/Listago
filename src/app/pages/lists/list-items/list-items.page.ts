import { CommonModule } from "@angular/common";
import { Component, inject, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { IonButton, IonCheckbox, IonContent, IonFab, IonFabButton, IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonReorder, IonReorderGroup, IonTextarea, ItemReorderEventDetail } from "@ionic/angular/standalone";
import { provideTranslocoScope, Translation, TranslocoModule } from "@jsverse/transloco";
import { Subscription } from "rxjs";
import { AppComponent } from "src/app/app.component";
import type { EditMenuAction } from "src/app/components/main-toolbar-edit-menu-modal/main-toolbar-edit-menu-modal.component";
import { MainToolbarListsCustomMenuComponent } from "src/app/components/main-toolbar-lists-custom-menu/main-toolbar-lists-custom-menu.component";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { EMenuItemType, MenuItem, MenuitemFactory } from "../../../classes/menu-items";
import { PageAddNewComponent } from "../../../components/page-add-new/page-add-new.component";
import { PageEmptyComponent } from "../../../components/page-empty/page-empty.component";
import { List } from "../../../services/lists/list";
import { Listitem } from "../../../services/lists/listitem";
import { EPrefProperty } from "../../../services/storage/preferences.service";
import { AnimatedListPageBase } from "../animated-list-page-base";

@Component({
    selector: "app-list-items",
    templateUrl: "./list-items.page.html",
    styleUrls: ["./list-items.page.scss"],
    imports: [IonLabel, IonCheckbox, IonButton, IonTextarea, IonFabButton, IonFab, IonReorder, IonItem, IonItemOptions, IonItemSliding, IonIcon, IonItemOption, IonReorderGroup, IonList, IonContent, CommonModule, FormsModule, TranslocoModule, MainToolbarComponent, PageAddNewComponent, PageEmptyComponent, MainToolbarListsCustomMenuComponent],
    providers: [provideTranslocoScope({ scope: "pages/lists/list-items-page", alias: "page_listitems" }, { scope: "common/buttons", alias: "buttons" })],
})
export class ListItemsPage extends AnimatedListPageBase<Listitem> {
    @ViewChild("quickAdd", { read: IonTextarea, static: false }) private quickAdd?: IonTextarea;
    private _list?: List = undefined;

    private _listSubscription?: Subscription;
    private _connectIQSubscription?: Subscription;

    private _useTrash = true;
    private _listTitle?: string = undefined;

    private readonly Route = inject(ActivatedRoute);

    public get List(): List | undefined {
        return this._list;
    }

    public get PageTitle(): string {
        if (!this._list) {
            if (this._listTitle?.length) {
                return this._listTitle;
            } else if (this._itemsInitialized) {
                return this.Locale.getText("page_listitems.page_title");
            } else {
                return this.Locale.getText("page_listitems.loading");
            }
        } else {
            return this._list.Name;
        }
    }

    public get EditModeAllItemsLocked(): boolean {
        return this._selectedItems.find(i => !i.Locked) === undefined;
    }

    public get EditmodeAllItemsHidden(): boolean {
        return this._selectedItems.find(i => !i.Hidden) === undefined;
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

        // no wait
        const id = Number(this.Route.snapshot.paramMap.get("id"));
        if (id != Number.NaN) {
            this._list = await this._listsService.GetList(id);
            if (this._list) {
                this._preferences.Set(EPrefProperty.OpenedList, this._list.Id);
                this.onItemsChanged();
            }
            this._itemsInitialized = true;
            AppComponent.Instance?.setAppPages(this.ModifyMainMenu());
        }
        this._itemsInitialized;

        this._useTrash = await this._preferences.Get<boolean>(EPrefProperty.TrashListitems, true);

        this._listSubscription = this._listsService.onListChanged$.subscribe(async list => {
            if (this._initialSubscription) {
                this._initialSubscription = false;
                return;
            }
            if (list && list.equals(this._list) && list.isPeek == false) {
                this._list = list;
                AppComponent.Instance?.setAppPages(this.ModifyMainMenu());
                this._itemsInitialized = true;
                await this.reload();
                await this.onItemsChanged();
            }
        });

        this._connectIQSubscription = this.ConnectIQ.onInitialized$.subscribe(async () => {
            AppComponent.Instance?.setAppPages(this.ModifyMainMenu());
        });
    }

    public override async ionViewWillLeave() {
        await super.ionViewWillLeave();
        await this._preferences.Remove(EPrefProperty.OpenedList);
        this._listSubscription?.unsubscribe();
        this._connectIQSubscription?.unsubscribe();
        this.editMenu?.leaveEditMode();
    }

    public onSwipeRight(item: Listitem) {
        this.DeleteItem(item);
    }

    public onSwipeLeft(item: Listitem) {
        this.HideItem(item);
    }

    public editItem(item: Listitem) {
        if (this.List) {
            this._listsService.EditListitem(this.List, item);
        }
    }

    public async EmptyList(): Promise<boolean> {
        if (this.List) {
            const del = await this._listsService.EmptyLists(this.List, false);
            return del ?? false;
        }
        return false;
    }

    public async DeleteItem(items: Listitem | Listitem[]) {
        let success: boolean | undefined = undefined;
        if (this.List) {
            success = await this._listsService.DeleteListitem(this.List, items, false, false);
            if (success) {
                AppComponent.Instance?.setAppPages(this.ModifyMainMenu());
            }
        }
        this._itemsList?.closeSlidingItems();
        return success;
    }

    public async HideItem(items: Listitem | Listitem[], hide: boolean | undefined = undefined): Promise<boolean | undefined> {
        let success: boolean | undefined = undefined;
        if (this.List) {
            success = await this._listsService.ToggleHiddenListitem(this.List, items, hide);
        }
        this._itemsList?.closeSlidingItems();
        return success;
    }

    public async PinItem(items: Listitem | Listitem[], pin: boolean | undefined = undefined): Promise<boolean | undefined> {
        let success: boolean | undefined = undefined;
        if (this.List) {
            success = await this._listsService.ToggleLockListitem(this.List, items, pin);
        }
        this._itemsList?.closeSlidingItems();
        return success;
    }

    public async AddItem() {
        if (this.List) {
            await this._listsService.NewListitem(this.List);
            AppComponent.Instance?.setAppPages(this.ModifyMainMenu());
        }
    }

    public async HandleReorder(event: CustomEvent<ItemReorderEventDetail>) {
        if (!this._disableClick && this._initAnimationDone && this._list) {
            this._list.ReorderItems(event.detail.complete(this._list.Items) as Listitem[]);
            await this._listsService.StoreList(this._list, false, true, true);

            this._disableClick = true;
            setTimeout(() => {
                this._disableClick = false;
            }, 300);
        }
        event.stopImmediatePropagation();
    }

    public async DeleteList(): Promise<boolean> {
        if (this.List) {
            const del = await this._listsService.DeleteLists(this.List);
            if (del === true) {
                this._navController.navigateBack("/lists");
            }
            return del ?? false;
        }
        return false;
    }

    public async EditList(): Promise<boolean> {
        if (this.List) {
            AppComponent.Instance?.CloseMenu();
            await this._listsService.EditList(this.List);
            return true;
        }
        return false;
    }

    public override ModifyMainMenu(): MenuItem[] {
        const menu = [];
        if (this._list) {
            menu.push(MenuitemFactory(EMenuItemType.ListsTrash, { hidden: true }));
            if (this.ConnectIQ.Initialized) {
                menu.push(
                    MenuitemFactory(EMenuItemType.Devices, {
                        title_id: "page_listitems.menu_devices",
                        onClick: async () => {
                            this._listsService.TransferList(this.List!.Id);
                            return true;
                        },
                    }),
                );
            }
            menu.push(
                MenuitemFactory(EMenuItemType.ListitemsTrash, { url_addition: `${this._list.Id}`, disabled: !this._useTrash }),
                MenuitemFactory(EMenuItemType.EditList, { onClick: () => this.EditList() }),
                MenuitemFactory(EMenuItemType.EmptyList, { onClick: () => this.EmptyList(), disabled: this._list.Items.length <= 0 }),
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
                    this._selectedItems = this._selectedItems.filter(l => !l.equals(item));
                } else {
                    this._selectedItems.push(item);
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
            await this._listsService.AddNewListitem(this.List, { item: this.quickAdd.value.trim() });
            await this.ScrollToBottom(true);
            this._cdr.detectChanges();
            this.quickAdd.value = "";
            this.quickAdd.setFocus();
            return false;
        }
        return true;
    }

    public isItemSelected(item: Listitem): boolean {
        return this._selectedItems.indexOf(item) >= 0;
    }

    public async hideAds() {
        await this._admob.HideBanner();
    }

    protected override getEditMenuActions(): EditMenuAction[] {
        // no pinned items selected -> so pin them
        const lock_items = !this.EditModeAllItemsLocked;
        // no hidden items selected -> so hide them
        const hide_items = !this.EditmodeAllItemsHidden;

        let texts: Translation = {};
        if (this._selectedItems.length == 1) {
            texts = this.Locale.getTexts(["page_listitems.editmode-item-pin", "page_listitems.editmode-item-unpin", "page_listitems.editmode-item-hide", "page_listitems.editmode-item-show", "page_listitems.editmode-item-delete"]);
            texts["pin"] = lock_items ? texts["page_listitems.editmode-item-pin"] : texts["page_listitems.editmode-item-unpin"];
            texts["hide"] = hide_items ? texts["page_listitems.editmode-item-hide"] : texts["page_listitems.editmode-item-show"];
            texts["delete"] = texts["page_listitems.editmode-item-delete"];
        } else {
            texts = this.Locale.getTexts(["page_listitems.editmode-items-pin", "page_listitems.editmode-items-unpin", "page_listitems.editmode-items-hide", "page_listitems.editmode-items-show", "page_listitems.editmode-items-delete"], { num: this._selectedItems.length });
            texts["pin"] = lock_items ? texts["page_listitems.editmode-items-pin"] : texts["page_listitems.editmode-items-unpin"];
            texts["hide"] = hide_items ? texts["page_listitems.editmode-items-hide"] : texts["page_listitems.editmode-items-show"];
            texts["delete"] = texts["page_listitems.editmode-items-delete"];
        }

        return [
            {
                text: texts["pin"],
                icon: `/assets/icons/${lock_items ? "pin" : "pin_off"}.svg`,
                click: async () => {
                    this.editMenu?.leaveEditMode();
                    if (this.List) {
                        const pin = await this.PinItem(this._selectedItems, lock_items);
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
                    this.editMenu?.leaveEditMode();
                    if (this.List) {
                        const hide = await this.HideItem(this._selectedItems, hide_items);
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
                    this.editMenu?.leaveEditMode();
                    if (this.List) {
                        const del = await this.DeleteItem(this._selectedItems);
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

    protected override async onPreferencesChanged(prop: { prop: EPrefProperty; value: any }): Promise<void> {
        await super.onPreferencesChanged(prop);
        if (prop.prop == EPrefProperty.TrashListitems) {
            this._useTrash = prop.value as boolean;
        }
    }
}
