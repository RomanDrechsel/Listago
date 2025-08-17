import { CommonModule } from "@angular/common";
import { Component, inject, ViewChild } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Keyboard } from "@capacitor/keyboard";
import { IonButton, IonButtons, IonCheckbox, IonHeader, IonIcon, IonItem, IonLabel, IonTextarea, IonTitle, IonToggle, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { ListsService } from "src/app/services/lists/lists.service";
import { LocalizationService } from "src/app/services/localization/localization.service";
import { AdmobService } from "../../services/adverticing/admob.service";
import { ConnectIQService } from "../../services/connectiq/connect-iq.service";
import { List } from "../../services/lists/list";
import { Listitem } from "../../services/lists/listitem";
import { PopupsService } from "../../services/popups/popups.service";
import { EPrefProperty, PreferencesService } from "../../services/storage/preferences.service";

@Component({
    selector: "app-list-item-editor",
    imports: [IonTextarea, IonIcon, IonButton, IonButtons, IonTitle, IonItem, IonToolbar, IonLabel, IonHeader, IonCheckbox, IonToggle, CommonModule, TranslocoModule, ReactiveFormsModule, FormsModule],
    templateUrl: "./list-item-editor.component.html",
    styleUrl: "./list-item-editor.component.scss",
    providers: [provideTranslocoScope({ scope: "components/list-item-editor", alias: "comp-listitemeditor" }, { scope: "common/buttons", alias: "buttons" })],
})
export class ListItemEditorComponent {
    @ViewChild("itemname") private itemname!: IonTextarea;
    @ViewChild("addmore") private addmore?: IonToggle;

    public Params?: EditorParams;
    public Form: FormGroup;

    public readonly _popups = inject(PopupsService);
    private readonly _listsService = inject(ListsService);
    private readonly _preferences = inject(PreferencesService);
    private readonly _admob = inject(AdmobService);
    private readonly _connectIQ = inject(ConnectIQService);
    private readonly _locale = inject(LocalizationService);

    private _listAdded = false;

    public get ConnectIQInitialized(): boolean {
        return this._connectIQ.Initialized;
    }

    public get Title(): string {
        if (this.Params?.item) {
            return this._locale.getText("comp-listitemeditor.title_edit");
        } else {
            return this._locale.getText("comp-listitemeditor.title_new");
        }
    }

    public get Confirm(): string {
        if (this.Params?.item) {
            return this._locale.getText("buttons.save");
        } else {
            return this._locale.getText("buttons.create");
        }
    }

    constructor(private modalCtrl: ModalController, formbuilder: FormBuilder) {
        this.Form = formbuilder.group({
            item: ["", [Validators.required]],
            note: [""],
            hidden: [false],
            locked: [false],
        });
    }

    public async ionViewWillEnter() {
        if (this.addmore) {
            this.addmore.checked = await this._preferences.Get(EPrefProperty.AddMoreItemsDialog, false);
        }
        this.Form.get("item")?.setValue(this.Params?.item?.Item ?? "");
        this.Form.get("note")?.setValue(this.Params?.item?.Note ?? "");
        this.Form.get("locked")?.setValue(this.Params?.item?.Locked ?? false);
        this.Form.get("hidden")?.setValue(this.Params?.item?.Hidden ?? false);
    }

    public async ionViewDidEnter() {
        if (this.Params?.item == undefined) {
            this.itemname.setFocus();
            await Keyboard.show();
        }
    }

    public async ionViewWillLeave() {
        await Keyboard.hide();
    }

    public async onSubmit(): Promise<boolean | undefined> {
        if (this.Params?.list == undefined) {
            this.cancel();
            return undefined;
        }

        let title = this.Form.get("item")?.value?.trim();
        if (!title) {
            return undefined;
        }
        let note = this.Form.get("note")?.value?.trim();
        if (note) {
            if (note.length <= 0) {
                note = undefined;
            }
        }

        const hidden = (this.Form.get("hidden")?.value as boolean) ?? false;
        const locked = (this.Form.get("locked")?.value as boolean) ?? false;

        let item: Listitem;
        if (this.Params?.item) {
            item = this.Params.item;
            item.Item = title;
            item.Note = note;
            item.Hidden = hidden;
            item.Locked = locked;
        } else {
            item = await this._listsService.createNewListitem(this.Params!.list!, { item: title, note: note, hidden: hidden, locked: locked });
        }

        if (this.Params?.onAddItem) {
            await this.Params.onAddItem(this.Params.list, item, this.addmore?.checked ?? false);
            if (this.addmore?.checked) {
                this.resetForm();
                this._listAdded = true;
                return false;
            } else {
                return this.modalCtrl.dismiss(true, "confirm");
            }
        } else {
            return this.modalCtrl.dismiss(item, "confirm");
        }
    }

    public async onDelete() {
        if (this.Params?.list && this.Params?.item && (await this._listsService.DeleteListitem(this.Params.list, this.Params.item))) {
            this.cancel();
        }
    }

    public cancel() {
        if (this.Params?.onAddItem && this._listAdded) {
            return this.modalCtrl.dismiss(true, "confirm");
        } else {
            return this.modalCtrl.dismiss(null, "cancel");
        }
    }

    public async clickInfoHidden(event: any) {
        event?.stopImmediatePropagation();
        await this._popups.Alert.Info({
            message: "comp-listitemeditor.hidden_info",
            translate: true,
        });
    }

    public async clickInfoLocked(event: any) {
        event?.stopImmediatePropagation();
        await this._popups.Alert.Info({
            message: "comp-listitemeditor.locked_info",
            translate: true,
        });
    }

    public async onAddMoreChanged(checked: boolean) {
        await this._preferences.Set(EPrefProperty.AddMoreItemsDialog, checked);
    }

    public async hideAds() {
        await this._admob.HideBanner();
    }

    private resetForm() {
        this.Form.reset();
    }
}

export const ListItemEditor = async function (modalController: ModalController, params: EditorParams): Promise<Listitem | undefined> {
    const modal = await modalController.create({
        component: ListItemEditorComponent,
        componentProps: { Params: params },
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "autosize-modal",
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === "confirm") {
        return data;
    }
    return undefined;
};

export const ListItemEditorMultiple = async function (modalController: ModalController, params: EditorParams): Promise<boolean> {
    const modal = await modalController.create({
        component: ListItemEditorComponent,
        componentProps: { Params: params },
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "autosize-modal",
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();
    return data;
};

type EditorParams = {
    list: List;
    item?: Listitem;
    onAddItem?: (list: List, listitem: Listitem, add_more: boolean) => Promise<void>;
};
