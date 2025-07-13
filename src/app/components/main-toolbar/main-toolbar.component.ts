import { CommonModule } from "@angular/common";
import { Component, Input, ViewChild } from "@angular/core";
import { IonBackButton, IonButtons, IonMenuButton, IonProgressBar, IonTitle, IonToolbar } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";

@Component({
    selector: "app-main-toolbar",
    imports: [IonProgressBar, CommonModule, TranslateModule, IonToolbar, IonButtons, IonMenuButton, IonBackButton, IonTitle],
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

    public get ShowProgressbar(): boolean {
        return MainToolbarComponent._activeProgressbars > 0;
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
