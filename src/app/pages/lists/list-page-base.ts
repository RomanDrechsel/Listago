import { Component, ElementRef, inject, ViewChild } from "@angular/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { IonContent, IonList, ModalController } from "@ionic/angular/standalone";
import { IonContentCustomEvent, type ScrollDetail } from "@ionic/core";
import { type EditMenuAction } from "src/app/components/main-toolbar-edit-menu-modal/main-toolbar-edit-menu-modal.component";
import { MainToolbarListsCustomMenuComponent } from "src/app/components/main-toolbar-lists-custom-menu/main-toolbar-lists-custom-menu.component";
import { PageBase } from "../page-base";

@Component({
    template: "",
})
export abstract class ListPageBase extends PageBase {
    @ViewChild("mainContent", { read: IonContent, static: false }) protected mainContent?: IonContent;
    @ViewChild("mainContent", { read: ElementRef, static: false }) protected mainContentRef?: ElementRef;
    @ViewChild("itemsList", { read: IonList, static: false }) protected _itemsList?: IonList;
    @ViewChild("itemsList", { read: ElementRef, static: false }) protected _itemsListRef?: ElementRef;
    @ViewChild(MainToolbarListsCustomMenuComponent, { read: MainToolbarListsCustomMenuComponent, static: false }) protected editMenu?: MainToolbarListsCustomMenuComponent;

    protected readonly _modalCtrl = inject(ModalController);
    protected _disableClick = false;

    protected _scrollPosition: "top" | "bottom" | number = "top";
    protected _itemsInitialized = false;

    protected _editMode = true;
    protected _selectedItems: (Number | String)[] = [];

    protected _keyboardShow = false;
    private _keyboardShowListener?: PluginListenerHandle;
    private _keyboardHideListener?: PluginListenerHandle;

    public get EditMode(): boolean {
        return this._editMode;
    }

    public set EditMode(val: boolean) {
        this._editMode = val;
    }

    public get ScrollPosition(): "top" | "bottom" | number {
        return this._scrollPosition;
    }

    public get ShowScrollButtons(): boolean {
        if (!this._itemsInitialized || this._keyboardShow || !this._itemsListRef || !this.mainContentRef) {
            return false;
        }
        return (this._itemsListRef.nativeElement as HTMLElement)?.scrollHeight > (this.mainContentRef.nativeElement as HTMLElement)?.clientHeight;
    }

    public get DisableScrollToTop(): boolean {
        return this._scrollPosition == "top";
    }

    public get DisableScrollToBottom(): boolean {
        return this._scrollPosition == "bottom";
    }

    public get ItemsInitialized(): boolean {
        return this._itemsInitialized;
    }

    public get ShowAddButton(): boolean {
        return this._itemsInitialized && !this._keyboardShow && !this.EditMode;
    }

    public override async ionViewWillEnter(): Promise<void> {
        await super.ionViewWillEnter();
        this._editMode = false;
        this._selectedItems = [];
        this._keyboardShowListener = await Keyboard.addListener("keyboardWillShow", () => {
            this._keyboardShow = true;
            this.reload();
        });
        this._keyboardHideListener = await Keyboard.addListener("keyboardWillHide", () => {
            this._keyboardShow = false;
            this.reload();
        });
    }

    public override async ionViewDidEnter(): Promise<void> {
        await super.ionViewDidEnter();
    }

    public override async ionViewWillLeave(): Promise<void> {
        await super.ionViewWillLeave();
        this._editMode = false;
        this._selectedItems = [];
        this._keyboardShowListener?.remove();
        this._keyboardShowListener = undefined;
        this._keyboardHideListener?.remove();
        this._keyboardHideListener = undefined;
    }

    public EditMenuDisabled(): boolean {
        return !this._editMode || this._selectedItems.length == 0;
    }

    public onScroll(event: IonContentCustomEvent<ScrollDetail>) {
        if (event.detail.scrollTop == 0) {
            this._scrollPosition = "top";
        } else if (Math.ceil(event.detail.scrollTop) >= (this._itemsListRef?.nativeElement as HTMLElement)?.scrollHeight - event.target.scrollHeight || (this._itemsListRef?.nativeElement as HTMLElement)?.scrollHeight < event.target.scrollHeight) {
            this._scrollPosition = "bottom";
        } else {
            this._scrollPosition = event.detail.scrollTop;
        }
    }

    public async ScrollToTop() {
        await this.mainContent?.scrollToTop(300);
        this.cdr.detectChanges();
    }

    public async ScrollToBottom(instant: boolean = true) {
        await this.mainContent?.scrollToBottom(instant ? 0 : 300);
        this.cdr.detectChanges();
    }

    protected abstract getEditMenuActions(): EditMenuAction[];
}
