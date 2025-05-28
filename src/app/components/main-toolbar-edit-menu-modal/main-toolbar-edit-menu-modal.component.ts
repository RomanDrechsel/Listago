import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { IonIcon, IonItem, IonLabel, IonList, ModalController } from "@ionic/angular/standalone";

@Component({
    selector: "app-main-toolbar-edit-menu-modal",
    imports: [IonIcon, IonLabel, IonItem, IonList, CommonModule],
    templateUrl: "./main-toolbar-edit-menu-modal.component.html",
    styleUrl: "./main-toolbar-edit-menu-modal.component.scss",
})
export class MainToolbarEditMenuModalComponent {
    public Methods?: EditMenuAction[];

    private readonly modalCtrl = inject(ModalController);

    public onClick(method: () => Promise<void>) {
        if (method) {
            method();
        }
        this.modalCtrl.dismiss(undefined, "confirm");
    }
}

export type EditMenuAction = {
    text: string;
    icon: string;
    click: () => Promise<void>;
};
