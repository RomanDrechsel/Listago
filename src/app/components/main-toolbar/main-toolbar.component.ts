import { CommonModule } from "@angular/common";
import { Component, inject, Input, ViewChild } from "@angular/core";
import { IonBackButton, IonBadge, IonButtons, IonMenuButton, IonProgressBar, IonTitle, IonToolbar } from "@ionic/angular/standalone";
import { AppUpdaterService } from "src/app/services/app/app-updater.service";

@Component({
    selector: "app-main-toolbar",
    imports: [IonBadge, IonProgressBar, CommonModule, IonToolbar, IonButtons, IonMenuButton, IonBackButton, IonTitle],
    templateUrl: "./main-toolbar.component.html",
    styleUrl: "./main-toolbar.component.scss",
})
export class MainToolbarComponent {
    @Input("title") pageTitle: string = "";
    @Input("back") backButton?: string = undefined;
    @Input("displayMenu") displayMenu: boolean = true;
    @Input("displayCustomMenu") displayCustomMenu: boolean = false;
    @ViewChild("backbutton", { read: IonBackButton }) private backBtn?: IonBackButton;

    private static _activeProgressbars: number = 0;

    private readonly _appUpdater = inject(AppUpdaterService);

    public get ShowProgressbar(): boolean {
        return MainToolbarComponent._activeProgressbars > 0;
    }

    public get menuBadge(): boolean {
        return !this._appUpdater.IsUpToDate && !this._appUpdater.UpdateRunning;
    }

    public set ShowProgressbar(v: boolean) {
        if (v) {
            MainToolbarComponent._activeProgressbars++;
        } else {
            MainToolbarComponent._activeProgressbars--;
            if (MainToolbarComponent._activeProgressbars < 0) {
                MainToolbarComponent._activeProgressbars = 0;
            }
        }
    }

    public get BackLink(): string | undefined {
        return this.backBtn?.defaultHref;
    }

    public static ToggleProgressbar(show: boolean) {
        MainToolbarComponent._activeProgressbars += show ? 1 : -1;
        if (MainToolbarComponent._activeProgressbars < 0) {
            MainToolbarComponent._activeProgressbars = 0;
        }
    }
}
