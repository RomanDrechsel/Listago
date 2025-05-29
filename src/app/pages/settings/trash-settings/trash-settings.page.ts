import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonContent, IonItem, IonList, IonNote, IonSelect, IonSelectOption, IonToggle } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { MainToolbarComponent } from "../../../components/main-toolbar/main-toolbar.component";
import { KeepInTrash } from "../../../services/lists/keep-in-trash";
import { EPrefProperty } from "../../../services/storage/preferences.service";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-trash",
    templateUrl: "./trash-settings.page.html",
    styleUrls: ["./trash-settings.page.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IonNote, IonToggle, IonItem, IonList, IonContent, IonSelect, IonSelectOption, CommonModule, FormsModule, TranslateModule, MainToolbarComponent],
})
export class TrashSettingsPage extends PageBase {
    private _useTrash: boolean = true;
    private _useTrashListitems: boolean = true;
    private _keepInStock: KeepInTrash.Enum = KeepInTrash.Enum.LastEntries;

    public set UseTrash(value: boolean) {
        this.Preferences.Set(EPrefProperty.TrashLists, value);
        this._useTrash = value;
    }

    public get UseTrash(): boolean {
        return this._useTrash;
    }

    public set UseTrashListitems(value: boolean) {
        this.Preferences.Set(EPrefProperty.TrashListitems, value);
        this._useTrashListitems = value;
    }

    public get UseTrashListitems(): boolean {
        return this._useTrashListitems;
    }

    public set KeepInStock(value: number) {
        value = KeepInTrash.FromNumber(value) as number;
        this.Preferences.Set(EPrefProperty.TrashKeepinStock, value);
        this._keepInStock = value;
    }

    public get KeepInStock(): number {
        return this._keepInStock;
    }

    public override async ionViewWillEnter() {
        await super.ionViewWillEnter();
        this._useTrash = await this.Preferences.Get<boolean>(EPrefProperty.TrashLists, this.UseTrash);
        this._useTrashListitems = await this.Preferences.Get<boolean>(EPrefProperty.TrashListitems, this.UseTrashListitems);
        this._keepInStock = KeepInTrash.FromNumber(await this.Preferences.Get<number>(EPrefProperty.TrashKeepinStock, this._keepInStock));
        this.cdr.detectChanges();
    }

    public async onUseTrashChanged(checked: boolean) {
        this.UseTrash = checked;
        if (checked == false) {
            await this.ListsService.WipeTrash(false, true);
        }
    }

    public async onUseTrashListitemsChanged(checked: boolean) {
        this.UseTrashListitems = checked;
        if (checked == false) {
            await this.ListsService.WipeListitemTrash(false, true);
        }
    }

    public async onInStockChanged(instock: number) {
        this.KeepInStock = instock;
    }

    public GetKeepInStock(stock: string): number {
        switch (stock) {
            case "day":
                return KeepInTrash.Enum.Day as number;
            case "week":
                return KeepInTrash.Enum.Week as number;
            case "month":
                return KeepInTrash.Enum.Month as number;
            default:
            case "entries":
                return KeepInTrash.Enum.LastEntries as number;
        }
    }
}
