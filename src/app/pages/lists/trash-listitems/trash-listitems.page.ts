import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { IonCheckbox, IonContent, IonFab, IonFabButton, IonIcon, IonImg, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonText } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { Subscription } from "rxjs";
import type { EditMenuAction } from "src/app/components/main-toolbar-edit-menu-modal/main-toolbar-edit-menu-modal.component";
import { MainToolbarListsCustomMenuComponent } from "src/app/components/main-toolbar-lists-custom-menu/main-toolbar-lists-custom-menu.component";
import type { List } from "src/app/services/lists/list";
import { EMenuItemType, MenuItem, MenuitemFactory } from "../../../classes/menu-items";
import { MainToolbarComponent } from "../../../components/main-toolbar/main-toolbar.component";
import { PageEmptyComponent } from "../../../components/page-empty/page-empty.component";
import { type Listitem } from "../../../services/lists/listitem";
import { AnimatedListPageBase } from "../animated-list-page-base";

@Component({
    selector: "app-trash-listitems",
    templateUrl: "./trash-listitems.page.html",
    styleUrls: ["./trash-listitems.page.scss"],
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [IonCheckbox, IonLabel, IonText, IonItem, IonIcon, IonItemOption, IonItemOptions, IonItemSliding, IonList, IonContent, IonImg, CommonModule, IonFab, IonFabButton, TranslateModule, MainToolbarComponent, PageEmptyComponent, MainToolbarListsCustomMenuComponent],
})
export class TrashListitemsPage extends AnimatedListPageBase {
    public Trash?: List = undefined;

    private _listUuid?: number = undefined;

    private _trashChangedSubscription?: Subscription;

    private Route = inject(ActivatedRoute);

    public get BackLink(): string {
        if (this._listUuid) {
            return `/lists/items/${this._listUuid}`;
        } else {
            return "/lists";
        }
    }

    constructor() {
        super();
        this._animationDirection = "right";
    }

    public override async ionViewWillEnter() {
        await super.ionViewWillEnter();
        const listid = Number(this.Route.snapshot.paramMap.get("id"));
        if (listid && !Number.isNaN(listid)) {
            this._listUuid = listid;
            this.Trash = await this.ListsService.GetList(listid);
            if (this.Trash) {
                this.Trash.ItemsInTrash = await this.ListsService.GetListitemTrash(this.Trash);
            }
            this._itemsInitialized = true;
            this.onItemsChanged();
        }

        this._trashChangedSubscription = this.ListsService.onTrashItemsDatasetChanged$.subscribe(async trash => {
            if (trash && trash.equals(this.Trash)) {
                this.Trash = trash;
                this.Trash.ItemsInTrash = await this.ListsService.GetListitemTrash(this.Trash);
                this._itemsInitialized = true;
                this.onItemsChanged();
                this.appComponent.setAppPages(this.ModifyMainMenu());
            }
        });
    }

    public override async ionViewDidLeave() {
        await super.ionViewDidLeave();
        this._trashChangedSubscription?.unsubscribe();
        if (this.Trash) {
            this.Trash.ItemsInTrash = undefined;
            this.Trash = undefined;
        }
    }

    public override ModifyMainMenu(): MenuItem[] {
        return [MenuitemFactory(EMenuItemType.ListsTrash, { hidden: true }), MenuitemFactory(EMenuItemType.EmptyItemTrash, { disabled: this.Trash?.ItemsInTrash ? this.Trash.ItemsInTrash.length <= 0 : true, onClick: () => this.emptyTrash() })];
    }

    public onSwipeRight(item: Listitem) {
        this.deleteItems(item);
    }

    public onSwipeLeft(item: Listitem) {
        this.restoreItems(item);
    }

    public clickOnItem(event: MouseEvent, item: Listitem) {
        if (!this._disableClick && this._editMode) {
            this._disableClick = true;
            if (this.isItemSelected(item)) {
                this._selectedItems = this._selectedItems.filter(l => l != item.Id);
            } else {
                this._selectedItems.push(item.Id);
            }
            setTimeout(() => {
                this._disableClick = false;
            }, 100);
        }
        event.stopImmediatePropagation();
    }

    public async deleteItems(items: Listitem | Listitem[]): Promise<boolean | undefined> {
        let success: boolean | undefined;
        if (this.Trash) {
            success = await this.ListsService.EraseListitemFromTrash(this.Trash, items);
        }
        this._itemsList?.closeSlidingItems();
        return success;
    }

    public async restoreItems(items: Listitem | Listitem[]): Promise<boolean | undefined> {
        let success: boolean | undefined;
        if (this.Trash) {
            success = await this.ListsService.RestoreListitemFromTrash(this.Trash, items);
        }
        this._itemsList?.closeSlidingItems();
        return success;
    }

    public async emptyTrash(): Promise<boolean> {
        if (this.Trash) {
            this.ListsService.EmptyListitemTrash(this.Trash);
        }
        return true;
    }

    public isItemSelected(item: Listitem): boolean {
        return this._selectedItems.indexOf(item.Id) >= 0;
    }

    protected override getEditMenuActions(): EditMenuAction[] {
        let texts = [];
        if (this._selectedItems.length == 1) {
            texts = this.Locale.getText(["comp-toolbar-edit-menu.trash-item-restore", "comp-toolbar-edit-menu.trash-item-delete"]);
            texts["restore"] = texts["comp-toolbar-edit-menu.trash-item-restore"];
            texts["delete"] = texts["comp-toolbar-edit-menu.trash-item-delete"];
        } else {
            texts = this.Locale.getText(["comp-toolbar-edit-menu.trash-items-restore", "comp-toolbar-edit-menu.trash-items-delete"], { num: this._selectedItems.length });
            texts["restore"] = texts["comp-toolbar-edit-menu.trash-items-restore"];
            texts["delete"] = texts["comp-toolbar-edit-menu.trash-items-delete"];
        }
        return [
            {
                icon: "/assets/icons/undo.svg",
                text: texts["restore"],
                click: async () => {
                    if (this.Trash?.ItemsInTrash) {
                        this.editMenu?.leaveEditMode(true);
                        const restore = await this.restoreItems(this.Trash.ItemsInTrash.filter(l => this._selectedItems.indexOf(l.Id) >= 0));
                        if (restore === true) {
                            this._selectedItems = [];
                        } else if (restore === undefined) {
                            this.editMenu?.enterEditMode();
                        }
                    }
                },
            },
            {
                icon: "/assets/icons/trash.svg",
                text: texts["delete"],
                click: async () => {
                    if (this.Trash?.ItemsInTrash) {
                        this.editMenu?.leaveEditMode(true);
                        const del = await this.deleteItems(this.Trash.ItemsInTrash.filter(l => this._selectedItems.indexOf(l.Id) >= 0));
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
