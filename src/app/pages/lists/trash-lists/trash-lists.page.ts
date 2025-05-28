import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { IonCheckbox, IonContent, IonFab, IonFabButton, IonIcon, IonImg, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonNote, IonText } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { Subscription } from "rxjs";
import type { EditMenuAction } from "src/app/components/main-toolbar-edit-menu-modal/main-toolbar-edit-menu-modal.component";
import { MainToolbarListsCustomMenuComponent } from "src/app/components/main-toolbar-lists-custom-menu/main-toolbar-lists-custom-menu.component";
import { EMenuItemType, MenuItem, MenuitemFactory } from "../../../classes/menu-items";
import { DateUtils } from "../../../classes/utils/date-utils";
import { MainToolbarComponent } from "../../../components/main-toolbar/main-toolbar.component";
import { PageEmptyComponent } from "../../../components/page-empty/page-empty.component";
import { List } from "../../../services/lists/list";
import { AnimatedListPageBase } from "../animated-list-page-base";

@Component({
    selector: "app-trash-lists",
    templateUrl: "./trash-lists.page.html",
    styleUrls: ["./trash-lists.page.scss"],
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [IonCheckbox, IonLabel, IonContent, IonText, IonNote, IonItem, IonImg, IonIcon, IonItemOption, IonItemOptions, IonItemSliding, IonList, IonFab, IonFabButton, CommonModule, TranslateModule, MainToolbarComponent, PageEmptyComponent, MainToolbarListsCustomMenuComponent],
})
export class TrashListsPage extends AnimatedListPageBase {
    public Lists: List[] = [];
    private _trashChangedSubscription?: Subscription;

    constructor() {
        super();
        this._animationDirection = "right";
    }

    public override async ionViewWillEnter() {
        super.ionViewWillEnter();
        this._trashChangedSubscription = this.ListsService.onTrashDatasetChanged$.subscribe(lists => {
            this.Lists = lists ?? [];
            if (lists) {
                this.Lists = this.Lists.sort((a, b) => b.Deleted - a.Deleted);
                this._itemsInitialized = true;
                this.onItemsChanged();
                this.appComponent.setAppPages(this.ModifyMainMenu());
            }
        });

        this.Lists = (await this.ListsService.GetTrash()).sort((a: List, b: List) => b.Deleted - a.Deleted);
        this._itemsInitialized = true;
        this.onItemsChanged();
    }

    public override async ionViewDidLeave() {
        super.ionViewDidLeave();
        this._trashChangedSubscription?.unsubscribe();
        this._trashChangedSubscription = undefined;
    }

    public override ModifyMainMenu(): MenuItem[] {
        return [MenuitemFactory(EMenuItemType.EmptyListTrash, { onClick: () => this.emptyTrash(), disabled: this.Lists.length <= 0 })];
    }

    public async onSwipeRight(list: List) {
        await this.deleteList(list);
    }

    public async onSwipeLeft(list: List) {
        await this.restoreList(list);
    }

    public async deleteList(lists: List | List[]): Promise<boolean | undefined> {
        const success = await this.ListsService.EraseListFromTrash(lists);

        if (success) {
            this._itemsList?.closeSlidingItems();
        }
        return success;
    }

    public async restoreList(lists: List | List[]): Promise<boolean | undefined> {
        const success = await this.ListsService.RestoreListFromTrash(lists);
        if (success) {
            this._itemsList?.closeSlidingItems();
        }
        return success;
    }

    public async emptyTrash(): Promise<boolean> {
        this.appComponent.CloseMenu();
        return (await this.ListsService.WipeTrash()) !== false;
    }

    public DeletedString(list: List): string {
        if (list.Deleted) {
            return this.Locale.getText("page_trash.deleted", { date: DateUtils.formatDate(list.Deleted) });
        } else {
            return "";
        }
    }

    public isListSelected(list: List): boolean {
        return this._selectedItems.indexOf(list.Uuid) >= 0;
    }

    public clickOnItem(event: MouseEvent, list: List) {
        if (!this._disableClick && this._editMode) {
            this._disableClick = true;
            if (this.isListSelected(list)) {
                this._selectedItems = this._selectedItems.filter(l => l != list.Uuid);
            } else {
                this._selectedItems.push(list.Uuid);
            }
            setTimeout(() => {
                this._disableClick = false;
            }, 100);
        }
        event.stopImmediatePropagation();
    }

    protected override getEditMenuActions(): EditMenuAction[] {
        let texts = [];
        if (this._selectedItems.length == 1) {
            texts = this.Locale.getText(["comp-toolbar-edit-menu.list-restore", "comp-toolbar-edit-menu.trash-list-delete"]);
            texts["restore"] = texts["comp-toolbar-edit-menu.list-restore"];
            texts["delete"] = texts["comp-toolbar-edit-menu.trash-list-delete"];
        } else {
            texts = this.Locale.getText(["comp-toolbar-edit-menu.lists-restore", "comp-toolbar-edit-menu.trash-lists-delete"], { num: this._selectedItems.length });
            texts["restore"] = texts["comp-toolbar-edit-menu.lists-restore"];
            texts["delete"] = texts["comp-toolbar-edit-menu.trash-lists-delete"];
        }
        return [
            {
                icon: "/assets/icons/undo.svg",
                text: texts["restore"],
                click: async () => {
                    this.editMenu?.leaveEditMode(true);
                    const restore = await this.restoreList(this.Lists.filter(l => this._selectedItems.indexOf(l.Uuid) >= 0));
                    if (restore === true) {
                        this._selectedItems = [];
                    } else if (restore === undefined) {
                        this.editMenu?.enterEditMode();
                    }
                },
            },
            {
                icon: "/assets/icons/trash.svg",
                text: texts["delete"],
                click: async () => {
                    this.editMenu?.leaveEditMode(true);
                    const del = await this.deleteList(this.Lists.filter(l => this._selectedItems.indexOf(l.Uuid) >= 0));
                    if (del === true) {
                        this._selectedItems = [];
                    } else if (del === undefined) {
                        this.editMenu?.enterEditMode();
                    }
                },
            },
        ];
    }
}
