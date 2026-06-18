import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonCheckbox, IonContent, IonFab, IonFabButton, IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonReorder, IonReorderGroup, ItemReorderEventDetail } from "@ionic/angular/standalone";
import { provideTranslocoScope, type Translation, TranslocoModule } from "@jsverse/transloco";
import { type Subscription } from "rxjs";
import { type EditMenuAction } from "src/app/components/main-toolbar-edit-menu-modal/main-toolbar-edit-menu-modal.component";
import { MainToolbarListsCustomMenuComponent } from "src/app/components/main-toolbar-lists-custom-menu/main-toolbar-lists-custom-menu.component";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { List } from "src/app/services/lists/list";
import { DateUtils } from "../../../classes/utils/date-utils";
import { PageAddNewComponent } from "../../../components/page-add-new/page-add-new.component";
import { PageEmptyComponent } from "../../../components/page-empty/page-empty.component";
import { AnimatedListPageBase } from "../animated-list-page-base";

@Component({
    selector: "app-lists",
    templateUrl: "./lists.page.html",
    styleUrls: ["./lists.page.scss"],
    imports: [IonCheckbox, IonLabel, IonReorderGroup, IonItemOption, IonItemOptions, IonItemSliding, IonIcon, IonFabButton, IonFab, IonItem, IonReorder, IonList, IonContent, MainToolbarComponent, PageAddNewComponent, CommonModule, FormsModule, TranslocoModule, PageEmptyComponent, MainToolbarListsCustomMenuComponent],
    providers: [provideTranslocoScope({ scope: "pages/lists/lists-page", alias: "page_lists" }, { scope: "common/date", alias: "date" }, { scope: "common/buttons", alias: "buttons" })],
})
export class ListsPage extends AnimatedListPageBase<List> {
    private _lists: List[] | undefined;
    private _listsSubscription?: Subscription;

    public get Lists(): List[] {
        return this._lists ?? [];
    }

    constructor() {
        super();
        this._animationDirection = "top";
    }

    public override async ionViewWillEnter(): Promise<void> {
        await super.ionViewWillEnter();
        this._lists = await this._listsService.GetLists({ orderBy: "order", orderDir: "ASC" });
        this._itemsInitialized = true;
        this._listsSubscription = this._listsService.onListsChanged$.subscribe(async _ => {
            if (this._initialSubscription) {
                this._initialSubscription = false;
                return;
            }
            this._lists = await this._listsService.GetLists({ orderBy: "order", orderDir: "ASC" });
            this._itemsInitialized = true;
            await this.reload();
            await this.onItemsChanged();
        });
        this.onItemsChanged();
    }

    public override async ionViewWillLeave(): Promise<void> {
        await super.ionViewWillLeave();
        if (this._listsSubscription) {
            this._listsSubscription.unsubscribe();
            this._listsSubscription = undefined;
        }
        this.editMenu?.leaveEditMode();
    }

    public onSwipeRight(list: List) {
        this._itemsList?.closeSlidingItems();
        this.deleteLists(list);
    }

    public async addList() {
        await this._listsService.NewList();
    }

    public onSwipeLeft(list: List) {
        this._itemsList?.closeSlidingItems();
        this.transmitLists(list);
    }

    public async deleteLists(lists: List | List[]): Promise<boolean | undefined> {
        this._itemsList?.closeSlidingItems();
        const success = await this._listsService.DeleteLists(lists);
        if (success === true) {
            this._selectedItems = [];
            this.EditMode = false;
            this.reload();
        }
        return success;
    }

    public async emptyLists(lists: List | List[]): Promise<boolean | undefined> {
        this._itemsList?.closeSlidingItems();
        const success = await this._listsService.EmptyLists(lists);
        if (success === true) {
            this._selectedItems = [];
            this.EditMode = false;
            this.reload();
        }
        return success;
    }

    public async transmitLists(lists: List | List[]): Promise<boolean | undefined> {
        this._itemsList?.closeSlidingItems();
        const success = await this._listsService.TransferList(lists);
        if (success === true) {
            this._selectedItems = [];
            this.EditMode = false;
        }
        return success;
    }

    public async editList(event: MouseEvent, list: List) {
        event.stopImmediatePropagation();
        await this._listsService.EditList(list);
    }

    public clickOnItem(event: MouseEvent, list: List) {
        if (!this._disableClick && this._initAnimationDone) {
            this._disableClick = true;
            if (this._editMode) {
                if (this.isListSelected(list)) {
                    this._selectedItems = this._selectedItems.filter(l => !l.equals(list));
                } else {
                    this._selectedItems.push(list);
                }
            } else {
                this._navController.navigateForward(`/lists/items/${list.Id}`, { queryParams: { title: list.Name } });
            }
            setTimeout(() => {
                this._disableClick = false;
            }, 100);
        }
        event.stopImmediatePropagation();
    }

    public async handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
        await this._listsService.ReorderLists(event.detail.complete(this._lists));
        event.stopImmediatePropagation();
    }

    public UpdatedString(list: List): string {
        return this.Locale.getText("page_lists.updated", { date: DateUtils.formatDate(list.Modified ?? list.Created) });
    }

    public isListSelected(list: List): boolean {
        return this._selectedItems.indexOf(list) >= 0;
    }

    public getEditMenuActions(): EditMenuAction[] {
        let texts: Translation = {};
        if (this._selectedItems.length == 1) {
            texts = this.Locale.getTexts(["page_lists.editmode-list-transmit", "page_lists.editmode-list-empty", "page_lists.editmode-list-delete"]);
            texts["transmit"] = texts["page_lists.editmode-list-transmit"];
            texts["delete"] = texts["page_lists.editmode-list-delete"];
            texts["empty"] = texts["page_lists.editmode-list-empty"];
        } else {
            texts = this.Locale.getTexts(["page_lists.editmode-lists-transmit", "page_lists.editmode-lists-empty", "page_lists.editmode-lists-delete"], { num: this._selectedItems.length });
            texts["transmit"] = texts["page_lists.editmode-lists-transmit"];
            texts["delete"] = texts["page_lists.editmode-lists-delete"];
            texts["empty"] = texts["page_lists.editmode-lists-empty"];
        }

        return [
            {
                text: texts["transmit"],
                icon: "/assets/icons/menu/devices.svg",
                click: async () => {
                    this.editMenu?.leaveEditMode();
                    const transmit = await this.transmitLists(this._selectedItems);
                    if (transmit === undefined) {
                        this.editMenu?.enterEditMode();
                    }
                },
            },
            {
                text: texts["empty"],
                icon: "/assets/icons/menu/empty.svg",
                click: async () => {
                    this.editMenu?.leaveEditMode();
                    const empty = await this.emptyLists(this._selectedItems);
                    if (empty === undefined) {
                        this.editMenu?.enterEditMode();
                    }
                },
            },
            {
                text: texts["delete"],
                icon: "/assets/icons/trash.svg",
                click: async () => {
                    this.editMenu?.leaveEditMode();
                    const del = await this.deleteLists(this._selectedItems);
                    if (del === undefined) {
                        this.editMenu?.enterEditMode();
                    }
                },
            },
        ];
    }
}
