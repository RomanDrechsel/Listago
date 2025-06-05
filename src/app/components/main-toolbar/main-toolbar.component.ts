import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input, ViewChild } from "@angular/core";
import { IonBackButton, IonButtons, IonMenuButton, IonProgressBar, IonTitle, IonToolbar } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";

@Component({
    selector: "app-main-toolbar",
    imports: [IonProgressBar, CommonModule, TranslateModule, IonToolbar, IonButtons, IonMenuButton, IonBackButton, IonTitle],
    templateUrl: "./main-toolbar.component.html",
    styleUrl: "./main-toolbar.component.scss",
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainToolbarComponent {
    @Input("title") pageTitle: string = "";
    @Input("back") backButton?: string = undefined;
    @Input("displayMenu") displayMenu: boolean = true;
    @Input("displayCustomMenu") displayCustomMenu: boolean = false;

    @ViewChild("backbutton", { read: IonBackButton }) private backBtn?: IonBackButton;

    private readonly cdr = inject(ChangeDetectorRef);
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
        this.cdr.detectChanges();
    }

    public get BackLink(): string | undefined {
        return this.backBtn?.defaultHref;
    }

    public ToggleProgressbar(show: boolean) {
        this.ShowProgressbar = show;
    }
}
