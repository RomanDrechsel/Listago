import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { IonContent, IonItem, IonLabel, IonList, IonNote, IonToggle } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { InteractionAnimation } from "src/app/animations/interaction.animation";
import { MainToolbarComponent } from "../../../components/main-toolbar/main-toolbar.component";
import { EPrefProperty } from "../../../services/storage/preferences.service";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-lists-transmission",
    templateUrl: "./lists-transmission.page.html",
    styleUrls: ["./lists-transmission.page.scss"],
    imports: [IonLabel, IonNote, IonItem, IonToggle, IonList, IonContent, CommonModule, FormsModule, TranslateModule, MainToolbarComponent],
})
export class ListsTransmissionPage extends PageBase {
    @ViewChild("content", { static: false, read: IonContent }) private readonly _content?: IonContent;
    @ViewChild("syncList", { static: false, read: ElementRef }) private readonly _syncList?: ElementRef;

    private readonly Route = inject(ActivatedRoute);

    private _openAppOnTransfer: boolean = false;
    private _deleteListOnDevice: boolean = false;
    private _syncListOnDevice: boolean = false;
    private _garminConnectIQ: boolean = true;

    private _listToSync?: number = undefined;
    private _runningAnimation?: InteractionAnimation;

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
    }

    public override async ionViewDidEnter(): Promise<void> {
        const synclist = this.Route.snapshot.queryParamMap.get("syncList");
        if (synclist !== null) {
            const id = Number(synclist);
            if (!Number.isNaN(id)) {
                this._listToSync = id;
                this.attractAttention(this._syncList?.nativeElement as HTMLElement);
            }
        }
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
            (this._syncList?.nativeElement as HTMLElement)?.classList.remove("attract-attention");
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

    private async attractAttention(ele?: HTMLElement): Promise<void> {
        if (ele) {
            const y = ele.offsetTop ?? 0;
            this._content?.scrollToPoint(0, y, 1000);
            await new Promise<void>(resolve => setTimeout(resolve, 300));
            ele.classList.add("attract-attention");
        }
    }
}
