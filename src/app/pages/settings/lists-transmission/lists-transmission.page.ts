import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { IonContent, IonItem, IonList, IonNote, IonToggle } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { MainToolbarComponent } from "../../../components/main-toolbar/main-toolbar.component";
import { List } from "../../../services/lists/list";
import { EPrefProperty } from "../../../services/storage/preferences.service";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-lists-transmission",
    templateUrl: "./lists-transmission.page.html",
    styleUrls: ["./lists-transmission.page.scss"],
    imports: [IonNote, IonItem, IonToggle, IonList, IonContent, CommonModule, FormsModule, TranslateModule, MainToolbarComponent],
})
export class ListsTransmissionPage extends PageBase {
    private readonly Route = inject(ActivatedRoute);

    private _openAppOnTransfer: boolean = false;
    private _deleteListOnDevice: boolean = false;
    private _syncListOnDevice: boolean = false;
    private _garminConnectIQ: boolean = true;

    private _listToSync: List | string | null = null;

    public get OpenAppOnTransmit(): boolean {
        return this._openAppOnTransfer;
    }

    public set OpenAppOnTransmit(v: boolean) {
        this._openAppOnTransfer = v;
        this.Preferences.Set(EPrefProperty.OpenAppOnTransmit, v);
    }

    public get DeleteListOnDevice(): boolean {
        return this._deleteListOnDevice;
    }

    public set DeleteListOnDevice(v: boolean) {
        this._deleteListOnDevice = v;
        this.Preferences.Set(EPrefProperty.DeleteListOnDevice, v);
    }

    public get SyncListOnDevice(): boolean {
        return this._syncListOnDevice;
    }

    public set SyncListOnDevice(v: boolean) {
        this._syncListOnDevice = v;
        this.Preferences.Set(EPrefProperty.SyncListOnDevice, v);
        if (!v) {
            this.confirmRemoveSync();
        }
    }

    public get SupportGarminConnectIQ(): boolean {
        return this._garminConnectIQ;
    }

    public set SupportGarminConnectIQ(v: boolean) {
        this._garminConnectIQ = v;
        this.Preferences.Set(EPrefProperty.GarminConnectIQ, v);
        if (v) {
            this.ConnectIQ.Initialize();
        } else {
            this.ConnectIQ.Shutdown();
        }
    }

    public override async ionViewWillEnter() {
        this._openAppOnTransfer = await this.Preferences.Get<boolean>(EPrefProperty.OpenAppOnTransmit, false);
        this._deleteListOnDevice = await this.Preferences.Get<boolean>(EPrefProperty.DeleteListOnDevice, false);
        this._syncListOnDevice = await this.Preferences.Get<boolean>(EPrefProperty.SyncListOnDevice, false);
        this._garminConnectIQ = await this.Preferences.Get<boolean>(EPrefProperty.GarminConnectIQ, true);

        this._listToSync = this.Route.snapshot.queryParamMap.get("syncList");

        this.cdr.detectChanges();
    }

    public onOpenAppOnTransmitChanged(checked: boolean) {
        this.OpenAppOnTransmit = checked;
    }

    public onDeleteListOnDeviceChanged(checked: boolean) {
        this.DeleteListOnDevice = checked;
    }

    public async onSyncListOnDeviceChanged(checked: boolean) {
        this.SyncListOnDevice = checked;

        if (checked && this._listToSync) {
            await this.ListsService.SyncList({ list: this._listToSync, only_if_definitive_device: true, force_if_sync_is_disabled: true });
        }
    }

    public onSupportGarminConnectIQChanged(checked: boolean) {
        this.SupportGarminConnectIQ = checked;
    }

    private async confirmRemoveSync() {
        if (await this.Popups.Alert.YesNo({ message: "page_lists_transmission.synclist_disable", header: "page_lists_transmission.synclist_disable_title", translate: true })) {
            await this.ListsService.PurgeAllSyncs();
        }
    }
}
