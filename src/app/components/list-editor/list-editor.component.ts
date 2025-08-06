import { CommonModule } from "@angular/common";
import { Component, inject, type OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Keyboard } from "@capacitor/keyboard";
import { IonAccordion, IonAccordionGroup, IonButton, IonButtons, IonCheckbox, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonText, IonTitle, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { ListsService } from "src/app/services/lists/lists.service";
import { ConnectIQService } from "../../services/connectiq/connect-iq.service";
import { List, ListReset, type ListSyncDevice } from "../../services/lists/list";
import { LocalizationService } from "../../services/localization/localization.service";
import { PopupsService } from "../../services/popups/popups.service";
import { DeviceSelector } from "../device-select/device-select.component";
import { SelectTimeInterval } from "../select-interval/select-interval.component";
import { AdmobService } from "./../../services/adverticing/admob.service";

@Component({
    selector: "app-list-edit",
    imports: [IonNote, IonText, IonList, IonAccordion, IonCheckbox, IonAccordionGroup, IonLabel, IonIcon, IonTitle, IonItem, IonInput, IonButton, IonButtons, IonToolbar, IonHeader, IonSelect, IonSelectOption, CommonModule, TranslateModule, ReactiveFormsModule, FormsModule],
    templateUrl: "./list-editor.component.html",
    styleUrl: "./list-editor.component.scss",
})
export class ListEditorComponent implements OnInit {
    @ViewChild("listname", { read: IonInput }) private listname?: IonInput;
    @ViewChild("reset", { read: IonCheckbox }) private reset?: IonCheckbox;
    @ViewChild("resetinterval", { read: IonSelect }) private resetinterval?: IonSelect;
    @ViewChild("sync", { read: IonCheckbox }) private sync?: IonCheckbox;
    public Params?: EditorParams;

    private readonly modalCtrl = inject(ModalController);
    private readonly ListsService = inject(ListsService);
    private readonly Locale = inject(LocalizationService);
    private readonly Popups = inject(PopupsService);
    private readonly FormBuilder = inject(FormBuilder);
    private readonly Admob = inject(AdmobService);
    private readonly ConnectIQ = inject(ConnectIQService);

    private _listReset?: ListReset = undefined;
    private _listSyncDevices?: ListSyncDevice[] = undefined;

    public Form: FormGroup;

    constructor() {
        this.Form = this.FormBuilder.group({
            listname: ["", [Validators.required]],
        });
    }

    public get ConnectIQInitialized(): boolean {
        return this.ConnectIQ.Initialized;
    }

    public set ResetActive(active: boolean) {
        if (this._listReset) {
            this._listReset.active = active;
        }
    }

    public get ResetActive(): boolean {
        return this._listReset?.active ?? false;
    }

    public get ResetInteval(): "daily" | "weekly" | "monthly" {
        return this._listReset?.interval ?? "weekly";
    }

    public set ListSyncDevices(devices: ListSyncDevice[] | undefined) {
        this._listSyncDevices = devices;
        if (this.sync) {
            this.sync.checked = devices != undefined && devices.length > 0;
        }
    }

    public get ListSyncDevices(): string {
        if (this._listSyncDevices && this._listSyncDevices.length > 0) {
            return this._listSyncDevices.map(device => device.name).join(", ");
        }
        return "";
    }

    public get SyncActive(): boolean {
        return this._listSyncDevices != undefined && this._listSyncDevices.length > 0;
    }

    public get ResetString(): string {
        let str = "";
        if (this._listReset) {
            if (this._listReset.interval == "weekly") {
                switch (this._listReset.weekday) {
                    case 1:
                        str = this.Locale.getText("date.weekday.sun");
                        break;
                    case 2:
                        str = this.Locale.getText("date.weekday.mon");
                        break;
                    case 3:
                        str = this.Locale.getText("date.weekday.tue");
                        break;
                    case 4:
                        str = this.Locale.getText("date.weekday.wed");
                        break;
                    case 5:
                        str = this.Locale.getText("date.weekday.thu");
                        break;
                    case 6:
                        str = this.Locale.getText("date.weekday.fri");
                        break;
                    case 7:
                        str = this.Locale.getText("date.weekday.sat");
                        break;
                }
            } else if (this._listReset.interval == "monthly") {
                if (this._listReset.day > 31) {
                    str = this.Locale.getText("comp-select-interval.last");
                } else {
                    str = this._listReset.day.toString().padStart(2, "0") + ".";
                }
                str += " " + this.Locale.getText("comp-select-interval.ofmonth");
            }

            if (str.length > 0) {
                str += ", ";
            }
            if (this.Locale.CurrentLanguage.h24) {
                str += this._listReset.hour.toString().padStart(2, "0") + ":" + this._listReset.minute.toString().padStart(2, "0") + " " + this.Locale.getText("comp-select-interval.oclock");
            } else {
                let ampm = "";
                if (this._listReset.hour == 0) {
                    str += "12";
                    ampm = "AM";
                } else if (this._listReset.hour < 12) {
                    str += this._listReset.hour;
                    ampm = "AM";
                } else if (this._listReset.hour == 12) {
                    str += "12";
                    ampm = "PM";
                } else {
                    str += this._listReset.hour % 12;
                    ampm = "PM";
                }
                str += ":" + this._listReset.minute.toString().padStart(2, "0") + " " + ampm;
            }
        }
        return str;
    }

    public get Title(): string {
        if (this.Params?.list) {
            return this.Locale.getText("comp-listeditor.title_edit");
        } else {
            return this.Locale.getText("comp-listeditor.title_new");
        }
    }

    public get Confirm(): string {
        if (this.Params?.list) {
            return this.Locale.getText("save");
        } else {
            return this.Locale.getText("create");
        }
    }

    public ngOnInit() {
        this._listReset = {
            interval: this.Params?.list?.Reset?.interval ?? "weekly",
            active: this.Params?.list?.Reset?.active ?? false,
            hour: this.Params?.list?.Reset?.hour ?? 0,
            minute: this.Params?.list?.Reset?.minute ?? 0,
            day: this.Params?.list?.Reset?.day ?? 1,
            weekday: this.Params?.list?.Reset?.weekday ?? this.Locale.CurrentLanguage.firstDayOfWeek,
        };
        this.Form.get("listname")?.setValue(this.Params?.list?.Name);
        this.ResetActive = this._listReset.active;
        this.ListSyncDevices = this.Params?.list?.SyncDevices ?? undefined;
    }

    public async ionViewDidEnter() {
        if (!this.Params?.list) {
            this.listname?.setFocus();
            await Keyboard.show();
        }
    }

    public async ionViewWillLeave() {
        await Keyboard.hide();
    }

    public async onSubmit() {
        const listname = this.Form.get("listname")?.value?.trim();
        if (!listname || listname.length === 0) {
            return this.cancel();
        }

        let list: List;
        if (this.Params?.list) {
            list = this.Params.list;
            list.Name = listname;
            list.Reset = this._listReset;
            list.SyncDevices = this._listSyncDevices ?? undefined;
        } else {
            list = await this.ListsService.createNewList({ name: listname, reset: this._listReset, sync: this._listSyncDevices });
        }

        return this.modalCtrl.dismiss(list, "confirm");
    }

    public async onDelete() {
        if (this.Params?.list && (await this.ListsService.DeleteLists(this.Params.list))) {
            this.cancel();
        }
    }

    public cancel() {
        return this.modalCtrl.dismiss(null, "cancel");
    }

    public toggleReset(event: any) {
        event?.stopImmediatePropagation();

        if (this._listReset) {
            this._listReset.active = event.target.checked;
        }
    }

    public async resetInfo(event: any) {
        event?.stopImmediatePropagation();
        await this.Popups.Alert.Info({ message: "comp-listeditor.reset_info", translate: true });
    }

    public async toggleSync(event: any) {
        event?.stopImmediatePropagation();
        event?.preventDefault();

        const all_devices = await this.ConnectIQ.getDevices();
        if (all_devices.length == 1) {
            //only toggle
            if (this._listSyncDevices?.length) {
                this._listSyncDevices = undefined;
            } else {
                this._listSyncDevices = [{ id: all_devices[0].Identifier, name: all_devices[0].Name }];
            }
        } else {
            const devices = await DeviceSelector(this.modalCtrl, { only_ready: true, preselect: this._listSyncDevices, devices: all_devices });
            if (devices) {
                this._listSyncDevices = devices.map(device => ({ id: device.Identifier, name: device.Name }));
            } else {
                this._listSyncDevices = undefined;
            }
        }
    }

    public async syncInfo(event: any) {
        event?.stopImmediatePropagation();
        await this.Popups.Alert.Info({
            message: "comp-listeditor.sync_info",
            translate: true,
        });
    }

    public onResetIntervalChanged(value: string) {
        this._listReset!.interval = value as "daily" | "weekly" | "monthly";
    }

    public async selectResetDate() {
        if (this.resetinterval && this._listReset) {
            const ret = await SelectTimeInterval(this.modalCtrl, this._listReset);
            if (ret) {
                this._listReset = ret;
            }
        }
    }

    public async hideAds() {
        await this.Admob.HideBanner();
    }
}

export const ListEditor = async function (modalController: ModalController, params: EditorParams): Promise<List | undefined> {
    const modal = await modalController.create({
        component: ListEditorComponent,
        componentProps: { Params: params },
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "autosize-modal",
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === "confirm") {
        return data as List;
    }
    return undefined;
};

export declare type EditorParams = {
    list?: List;
};
