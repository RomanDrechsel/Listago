import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { IonButton, IonButtons, IonCheckbox, IonHeader, IonIcon, IonItem, IonList, IonTitle, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import type { ListSyncDevice } from "src/app/services/lists/list";
import { ConnectIQDevice } from "./../../services/connectiq/connect-iq-device";
import { ConnectIQService } from "./../../services/connectiq/connect-iq.service";

@Component({
    selector: "app-device-select",
    imports: [IonCheckbox, IonItem, IonList, IonIcon, IonButton, IonButtons, IonTitle, IonHeader, IonToolbar, TranslocoModule, CommonModule],
    templateUrl: "./device-select.component.html",
    styleUrl: "./device-select.component.scss",
    providers: [provideTranslocoScope({ scope: "components/device-select", alias: "comp-device-select" }, { scope: "common/buttons", alias: "buttons" })],
})
export class DeviceSelectComponent {
    private readonly modalCtrl = inject(ModalController);
    private readonly ConnectIQ = inject(ConnectIQService);

    public Params?: EditorParams;

    private _devices: ConnectIQDevice[] = [];
    private _devicesSelected: ConnectIQDevice[] = [];

    public get Devices(): ConnectIQDevice[] {
        return this._devices;
    }

    public get SelectedDevices(): ConnectIQDevice[] {
        return this._devicesSelected;
    }

    public async ionViewWillEnter() {
        let devices = this.Params?.devices ?? (await this.ConnectIQ.getDevices());
        if (this.Params?.only_ready) {
            devices = devices.filter(device => device.State == "Ready");
        }
        this._devices = devices;
        if (this.Params?.preselect && this._devices.length > 0) {
            if (typeof this.Params.preselect[0] === "number") {
                this._devicesSelected = devices.filter(device => (this.Params!.preselect! as number[])!.indexOf(device.Identifier) >= 0);
            } else {
                this._devicesSelected = devices.filter(device => (this.Params!.preselect! as ListSyncDevice[]).some(id => id.id == device.Identifier));
            }
        }
    }

    public onDeactivate() {
        this.modalCtrl.dismiss([], "confirm");
    }

    public onSelect() {
        this.modalCtrl.dismiss(this._devicesSelected, "confirm");
    }

    public onCheckboxChanged(checked: boolean, device: ConnectIQDevice) {
        if (checked && this._devicesSelected.indexOf(device) < 0) {
            this._devicesSelected.push(device);
        } else {
            this._devicesSelected = this._devicesSelected.filter(d => d.Identifier !== device.Identifier);
        }
    }

    public cancel() {
        return this.modalCtrl.dismiss(null, "cancel");
    }
}

export const DeviceSelector = async function (modalController: ModalController, params: EditorParams): Promise<ConnectIQDevice[] | undefined> {
    if (params.devices && params.devices.length == 1) {
        return [params.devices[0]];
    }

    const modal = await modalController.create({
        component: DeviceSelectComponent,
        componentProps: { Params: params },
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "autosize-modal",
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === "confirm") {
        return data as ConnectIQDevice[] | undefined;
    }
    return undefined;
};

export declare type EditorParams = {
    only_ready?: boolean;
    preselect?: number[] | ListSyncDevice[];
    devices?: ConnectIQDevice[];
};
