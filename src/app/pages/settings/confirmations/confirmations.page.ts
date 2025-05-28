import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonContent, IonItem, IonList, IonNote, IonToggle } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { MainToolbarComponent } from "../../../components/main-toolbar/main-toolbar.component";
import { EPrefProperty } from "../../../services/storage/preferences.service";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-confirmations",
    templateUrl: "./confirmations.page.html",
    styleUrls: ["./confirmations.page.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IonToggle, IonNote, IonItem, IonList, IonContent, CommonModule, FormsModule, TranslateModule, MainToolbarComponent],
})
export class ConfirmationsPage extends PageBase {
    private _deleteList: boolean = true;
    private _deleteListitem: boolean = true;
    private _transmitList: boolean = true;
    private _emptyList: boolean = true;
    private _eraseList: boolean = true;
    private _eraseListitem: boolean = true;
    private _emptyTrash: boolean = true;
    private _restoreList: boolean = true;
    private _restoreListitem: boolean = true;

    public get ConnectIQInitialized(): boolean {
        return this.ConnectIQ.Initialized;
    }

    public get DeleteList(): boolean {
        return this._deleteList;
    }

    public set DeleteList(v: boolean) {
        this._deleteList = v;
        this.Preferences.Set(EPrefProperty.ConfirmDeleteList, v);
    }

    public get DeleteListitem(): boolean {
        return this._deleteListitem;
    }

    public set DeleteListitem(v: boolean) {
        this._deleteListitem = v;
        this.Preferences.Set(EPrefProperty.ConfirmDeleteListitem, v);
    }

    public get EmptyList(): boolean {
        return this._emptyList;
    }

    public set EmptyList(v: boolean) {
        this._emptyList = v;
        this.Preferences.Set(EPrefProperty.ConfirmEmptyList, v);
    }

    public get TransmitList(): boolean {
        return this._transmitList;
    }

    public set TransmitList(v: boolean) {
        this._transmitList = v;
        this.Preferences.Set(EPrefProperty.ConfirmTransmitList, v);
    }

    public get EraseList(): boolean {
        return this._eraseList;
    }

    public set EraseList(v: boolean) {
        this._eraseList = v;
        this.Preferences.Set(EPrefProperty.ConfirmEraseList, v);
    }

    public get EraseListitem(): boolean {
        return this._eraseListitem;
    }

    public set EraseListitem(v: boolean) {
        this._eraseListitem = v;
        this.Preferences.Set(EPrefProperty.ConfirmEraseListitem, v);
    }

    public get EmptyTrash(): boolean {
        return this._emptyTrash;
    }

    public set EmptyTrash(v: boolean) {
        this._emptyTrash = v;
        this.Preferences.Set(EPrefProperty.ConfirmEmptyTrash, v);
    }

    public get RestoreList(): boolean {
        return this._restoreList;
    }

    public set RestoreList(v: boolean) {
        this._restoreList = v;
        this.Preferences.Set(EPrefProperty.ConfirmRestoreList, v);
    }

    public get RestoreListitem(): boolean {
        return this._restoreListitem;
    }

    public set RestoreListitem(v: boolean) {
        this._restoreListitem = v;
        this.Preferences.Set(EPrefProperty.ConfirmRestoreListitem, v);
    }

    public override async ionViewWillEnter() {
        await super.ionViewWillEnter();
        this._deleteList = await this.Preferences.Get<boolean>(EPrefProperty.ConfirmDeleteList, true);
        this._deleteListitem = await this.Preferences.Get<boolean>(EPrefProperty.ConfirmDeleteListitem, true);
        this._transmitList = await this.Preferences.Get<boolean>(EPrefProperty.ConfirmTransmitList, true);
        this._emptyList = await this.Preferences.Get<boolean>(EPrefProperty.ConfirmEmptyList, true);
        this._eraseList = await this.Preferences.Get<boolean>(EPrefProperty.ConfirmEraseList, true);
        this._restoreList = await this.Preferences.Get<boolean>(EPrefProperty.ConfirmRestoreList, true);
        this._restoreListitem = await this.Preferences.Get<boolean>(EPrefProperty.ConfirmRestoreListitem, true);
        this.cdr.detectChanges();
    }

    public onDeleteListChanged(checked: boolean) {
        this.DeleteList = checked;
    }

    public onDeleteListItemChanged(checked: boolean) {
        this.DeleteListitem = checked;
    }

    public onEmptyListChanged(checked: boolean) {
        this.EmptyList = checked;
    }

    public onTransmitListChanged(checked: boolean) {
        this.TransmitList = checked;
    }

    public onEraseListChanged(checked: boolean) {
        this.EraseList = checked;
    }

    public onEraseListitemChanged(checked: boolean) {
        this.EraseListitem = checked;
    }

    public onEmptyTrashChanged(checked: boolean) {
        this.EmptyTrash = checked;
    }

    public onRestoreListChanged(checked: boolean) {
        this.RestoreList = checked;
    }

    public onRestoreListitemChanged(checked: boolean) {
        this.RestoreListitem = checked;
    }
}
