import { CommonModule } from "@angular/common";
import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { IonBadge, IonButton, IonButtons, IonIcon, IonMenuButton, ModalController } from "@ionic/angular/standalone";
import { CreateEditMenuModalAnimation } from "src/app/animations/edit-menu-modal.animation";
import { AppUpdaterService } from "src/app/services/app/app-updater.service";
import { type EditMenuAction, MainToolbarEditMenuModalComponent } from "../main-toolbar-edit-menu-modal/main-toolbar-edit-menu-modal.component";

@Component({
    selector: "app-main-toolbar-lists-custom-menu",
    imports: [IonBadge, IonButton, IonButtons, IonIcon, IonMenuButton, CommonModule],
    templateUrl: "./main-toolbar-lists-custom-menu.component.html",
    styleUrl: "./main-toolbar-lists-custom-menu.component.scss",
})
export class MainToolbarListsCustomMenuComponent {
    @Input() public EditMode = false;
    @Input() public EditMenuDisabled = true;
    @Input() public EditModeMenuDisabled = true;
    @Input() public EditMenuActions: EditMenuAction[] = [];

    @Output() EditModeChange = new EventEmitter<boolean>();

    protected _editMenuModal?: HTMLIonModalElement;

    protected readonly _modalCtrl = inject(ModalController);
    private readonly _appUpdater = inject(AppUpdaterService);

    public get menuBadge(): boolean {
        return !this._appUpdater.IsUpToDate && !this._appUpdater.UpdateRunning;
    }

    public async ToggleEditMenu(): Promise<void> {
        if (this._editMenuModal) {
            await this._editMenuModal.dismiss();
        } else {
            this._editMenuModal = await this._modalCtrl.create({
                component: MainToolbarEditMenuModalComponent,
                cssClass: "edit-menu-modal",
                backdropDismiss: true,
                animated: true,
                showBackdrop: true,
                componentProps: {
                    Methods: this.EditMenuActions,
                },
                enterAnimation: (baseEl: HTMLElement) => CreateEditMenuModalAnimation(baseEl, "enter"),
                leaveAnimation: (baseEl: HTMLElement) => CreateEditMenuModalAnimation(baseEl, "leave"),
            });
            this._editMenuModal.present();
            await this._editMenuModal.onWillDismiss();
            this._editMenuModal = undefined;
        }
    }

    public enterEditMode(): void {
        this.EditMode = true;
        this.EditModeChange.emit(this.EditMode);
    }

    public leaveEditMode(): void {
        this.EditMode = false;
        this.EditModeChange.emit(this.EditMode);

        if (this._editMenuModal) {
            this._editMenuModal.dismiss();
            this._editMenuModal = undefined;
        }
    }
}
