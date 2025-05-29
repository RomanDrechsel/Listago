import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, ViewChild } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { PluginListenerHandle } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { IonAccordion, IonAccordionGroup, IonButton, IonButtons, IonCheckbox, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonText, IonTitle, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { ListsService } from "src/app/services/lists/lists.service";
import { ConnectIQService } from "../../services/connectiq/connect-iq.service";
import { List, ListReset } from "../../services/lists/list";
import { LocalizationService } from "../../services/localization/localization.service";
import { PopupsService } from "../../services/popups/popups.service";
import { SelectTimeInterval } from "../select-interval/select-interval.component";
import { AdmobService } from "./../../services/adverticing/admob.service";

@Component({
    selector: "app-list-edit",
    imports: [IonText, IonList, IonAccordion, IonCheckbox, IonAccordionGroup, IonLabel, IonIcon, IonTitle, IonItem, IonInput, IonButton, IonButtons, IonToolbar, IonHeader, IonSelect, IonSelectOption, CommonModule, TranslateModule, ReactiveFormsModule, FormsModule],
    templateUrl: "./list-editor.component.html",
    styleUrl: "./list-editor.component.scss",
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListEditorComponent {
    @ViewChild("listname", { read: IonInput }) private listname?: IonInput;
    @ViewChild("resetAccordion", { read: IonAccordionGroup }) private resetAccordion?: IonAccordionGroup;
    @ViewChild("reset", { read: IonCheckbox }) private reset?: IonCheckbox;
    @ViewChild("resetinterval", { read: IonSelect }) private resetinterval?: IonSelect;
    @ViewChild("sync", { read: IonCheckbox }) private sync?: IonCheckbox;
    public Params?: EditorParams;

    private readonly modalCtrl = inject(ModalController);
    private readonly ListsService = inject(ListsService);
    private readonly Locale = inject(LocalizationService);
    private readonly Popups = inject(PopupsService);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly FormBuilder = inject(FormBuilder);
    private readonly Admob = inject(AdmobService);
    private readonly ConnectIQ = inject(ConnectIQService);

    private _listReset?: ListReset = undefined;
    private _listSync?: boolean;
    private _keyboardUpListerner?: PluginListenerHandle;
    private _keyboardDownListener?: PluginListenerHandle;

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
            this.cdr.detectChanges();
        }
    }

    public get ResetActive(): boolean {
        return this._listReset?.active ?? false;
    }

    public get ResetInteval(): "daily" | "weekly" | "monthly" {
        return this._listReset?.interval ?? "weekly";
    }

    public set SyncActive(active: boolean) {
        this._listSync = active;
        if (this.sync) {
            this.sync.checked = active;
            this.cdr.detectChanges();
        }
    }

    public get SyncActive(): boolean {
        return this._listSync ?? false;
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

    public async ionViewWillEnter() {
        if (this.Params?.list?.Reset) {
            this._listReset = this.Params.list.Reset;
        }
        if (!this._listReset) {
            this._listReset = { interval: "weekly", active: false, hour: 0, minute: 0, day: 1, weekday: this.Locale.CurrentLanguage.firstDayOfWeek };
        }
        this.Form.get("listname")?.setValue(this.Params?.list?.Name);
        this.ResetActive = this._listReset.active;
        this.SyncActive = this.Params?.list?.Sync ?? false;
    }

    public async ionViewDidEnter() {
        this._keyboardUpListerner = await Keyboard.addListener("keyboardDidShow", info => this.Admob.OnKeyboardShow(info));
        this._keyboardDownListener = await Keyboard.addListener("keyboardWillHide", () => {
            this.Admob.OnKeyboardHide();
        });
        if (!this.Params?.list) {
            this.listname?.setFocus();
            await Keyboard.show();
        }
    }

    public ionViewWillLeave() {
        this._keyboardUpListerner?.remove();
        this._keyboardUpListerner = undefined;
        this._keyboardDownListener?.remove();
        this._keyboardDownListener = undefined;
        Keyboard.hide();
        this.Admob.OnKeyboardHide();
    }

    public async onSubmit() {
        const listname = this.Form.get("listname")?.value;
        if (!listname || listname.length === 0) {
            return this.cancel();
        }

        let list: List;
        if (this.Params?.list) {
            list = this.Params.list;
            list.Name = listname;
            list.Reset = this._listReset;
            list.Sync = this._listSync ?? false;
        } else {
            list = await this.ListsService.createNewList({ name: listname, reset: this._listReset, sync: this._listSync ?? false });
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
        if (this.resetAccordion && this.reset) {
            this.resetAccordion.value = this.reset.checked ? "reset" : undefined;
            if (this._listReset) {
                this._listReset.active = this.reset.checked ?? false;
            }
        }
        event?.stopImmediatePropagation();
    }

    public async resetInfo(event: any) {
        event?.stopImmediatePropagation();
        await this.Popups.Alert.Info({
            message: "comp-listeditor.reset_info",
            translate: true,
        });
    }

    public toggleSync(event: any) {
        this._listSync = event?.detail.checked ?? false;
        event?.stopImmediatePropagation();
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
        this.cdr.detectChanges();
    }

    public async selectResetDate() {
        if (this.resetinterval && this._listReset) {
            const ret = await SelectTimeInterval(this.modalCtrl, this._listReset);
            if (ret) {
                this._listReset = ret;
                this.cdr.detectChanges();
            }
        }
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
