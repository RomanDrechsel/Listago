import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { IonButton, IonButtons, IonCard, IonIcon, IonItem, IonLabel, IonList, ModalController } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import type { ImportItem, ImportKey, ImportPage } from "src/app/pages/settings/import/import.page";

@Component({
    selector: "app-import-done",
    imports: [IonButton, IonButtons, IonLabel, IonCard, IonList, IonItem, IonIcon, TranslocoModule, CommonModule],
    templateUrl: "./import-done.component.html",
    styleUrl: "./import-done.component.scss",
    providers: [provideTranslocoScope({ scope: "pages/settings/import-page", alias: "page_settings_import" }, { scope: "common/buttons", alias: "buttons" })],
})
export class ImportDoneComponent {
    private readonly _modalCtrl = inject(ModalController);

    public Params?: EditorParams;

    public get FinishedImportItems(): ImportItem[] {
        return this.Params?.importPage.FinishedImportItems ?? [];
    }

    public Report(item_index: ImportKey): string {
        return this.Params?.importPage.Report(item_index) ?? "";
    }

    public ReportIcon(item_index: ImportKey): string {
        return this.Params?.importPage.ReportIcon(item_index) ?? "";
    }

    public ReportIconClass(item_index: ImportKey): string {
        return this.Params?.importPage.ReportIconClass(item_index) ?? "";
    }

    public async importDone() {
        await this._modalCtrl.dismiss(undefined, "done");
    }
}

export const ImportDonePopup = async function (modalController: ModalController, params: EditorParams): Promise<void> {
    const modal = await modalController.create({
        component: ImportDoneComponent,
        componentProps: { Params: params },
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "autosize-modal",
    });
    modal.present();

    await modal.onWillDismiss();
    return undefined;
};

export declare type EditorParams = {
    importPage: ImportPage;
};
