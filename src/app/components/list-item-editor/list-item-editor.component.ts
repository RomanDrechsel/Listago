import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { PluginListenerHandle } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { IonButton, IonButtons, IonCheckbox, IonHeader, IonIcon, IonItem, IonLabel, IonTextarea, IonTitle, IonToggle, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { AdmobService } from "../../services/adverticing/admob.service";
import { ConnectIQService } from "../../services/connectiq/connect-iq.service";
import { List } from "../../services/lists/list";
import { Listitem } from "../../services/lists/listitem";
import { ListsService } from "../../services/lists/lists.service";
import { PopupsService } from "../../services/popups/popups.service";
import { EPrefProperty, PreferencesService } from "../../services/storage/preferences.service";
import { Locale } from "./../../services/localization/locale";

@Component({
    selector: "app-list-item-editor",
    imports: [IonTextarea, IonIcon, IonButton, IonButtons, IonTitle, IonItem, IonToolbar, IonLabel, IonHeader, IonCheckbox, IonToggle, CommonModule, TranslateModule, ReactiveFormsModule, FormsModule],
    templateUrl: "./list-item-editor.component.html",
    styleUrl: "./list-item-editor.component.scss",
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListItemEditorComponent implements OnInit {
    @ViewChild("itemname") private itemname!: IonTextarea;
    @ViewChild("addmore") private addmore?: IonToggle;

    public Params?: EditorParams;
    public Form: FormGroup;

    public readonly Popups = inject(PopupsService);
    private readonly ListsService = inject(ListsService);
    private readonly Preferences = inject(PreferencesService);
    private readonly Admob = inject(AdmobService);
    private readonly ConnectIQ = inject(ConnectIQService);

    private _listAdded = false;
    private _keyboardUpListerner?: PluginListenerHandle;
    private _keyboardDownListener?: PluginListenerHandle;

    public get ConnectIQInitialized(): boolean {
        return this.ConnectIQ.Initialized;
    }

    public get Title(): string {
        if (this.Params?.item) {
            return Locale.getText("comp-listitemeditor.title_edit");
        } else {
            return Locale.getText("comp-listitemeditor.title_new");
        }
    }

    public get Confirm(): string {
        if (this.Params?.item) {
            return Locale.getText("save");
        } else {
            return Locale.getText("create");
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

    public async ngOnInit() {
        this.Form.get("item")?.setValue(this.Params?.item?.Item ?? "");
        this.Form.get("note")?.setValue(this.Params?.item?.Note ?? "");
        this.Form.get("locked")?.setValue(this.Params?.item?.Locked ?? false);
        this.Form.get("hidden")?.setValue(this.Params?.item?.Hidden ?? false);
    }

    public async ionViewWillEnter() {
        if (this.addmore) {
            this.addmore.checked = await this.Preferences.Get(EPrefProperty.AddMoreItemsDialog, false);
        }
    }

    public async ionViewDidEnter() {
        this._keyboardUpListerner = await Keyboard.addListener("keyboardWillShow", info => this.Admob.OnKeyboardShow(info));
        this._keyboardDownListener = await Keyboard.addListener("keyboardWillHide", () => this.Admob.OnKeyboardHide());
        if (this.Params?.item == undefined) {
            this.itemname.setFocus();
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

    public async onSubmit(): Promise<boolean | undefined> {
        if (this.Params?.list == undefined) {
            this.cancel();
            return undefined;
        }

        let title = this.Form.get("item")?.value;
        if (title) {
            title = title.trim();
        } else {
            return undefined;
        }
        let note = this.Form.get("note")?.value;
        if (note) {
            note = note.trim();
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
            item = await this.ListsService.createNewListitemObj(this.Params!.list!, { item: title, note: note, hidden: hidden, locked: locked });
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
        if (this.Params?.list && this.Params?.item && (await this.ListsService.DeleteListitem(this.Params.list, this.Params.item))) {
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
        await this.Popups.Alert.Info({
            message: "comp-listitemeditor.hidden_info",
            translate: true,
        });
    }

    public async clickInfoLocked(event: any) {
        event?.stopImmediatePropagation();
        await this.Popups.Alert.Info({
            message: "comp-listitemeditor.locked_info",
            translate: true,
        });
    }

    public async onAddMoreChanged(checked: boolean) {
        await this.Preferences.Set(EPrefProperty.AddMoreItemsDialog, checked);
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
