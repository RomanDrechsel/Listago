import { ChangeDetectorRef, Component, inject, ViewChild } from "@angular/core";
import { NavController } from "@ionic/angular/standalone";
import { Subscription } from "rxjs";
import { AppComponent } from "../app.component";
import { MenuItem } from "../classes/menu-items";
import { MainToolbarComponent } from "../components/main-toolbar/main-toolbar.component";
import { AppService } from "../services/app/app.service";
import { ConfigService } from "../services/config/config.service";
import { ConnectIQService } from "../services/connectiq/connect-iq.service";
import { ListsService } from "../services/lists/lists.service";
import { LocalizationService } from "../services/localization/localization.service";
import { LoggingService } from "../services/logging/logging.service";
import { PopupsService } from "../services/popups/popups.service";
import { PreferencesService } from "../services/storage/preferences.service";

@Component({
    template: "",
    standalone: false,
})
export abstract class PageBase {
    @ViewChild(MainToolbarComponent) protected Toolbar?: MainToolbarComponent;

    protected readonly appComponent = inject(AppComponent);
    protected readonly Popups = inject(PopupsService);
    protected readonly ConnectIQ = inject(ConnectIQService);
    protected readonly ListsService = inject(ListsService);
    protected readonly Locale = inject(LocalizationService);
    protected readonly Logger = inject(LoggingService);
    protected readonly Preferences = inject(PreferencesService);
    protected readonly NavController = inject(NavController);
    protected readonly AppService = inject(AppService);
    protected readonly Config = inject(ConfigService);
    protected readonly cdr = inject(ChangeDetectorRef);

    private _deviceChangedSubscription?: Subscription;
    private _onlineDevices: number = 0;

    public async ionViewWillEnter() {
        this.Popups.Loading.Hide();
        this._deviceChangedSubscription = this.ConnectIQ.onDeviceChanged$.subscribe(async () => {
            if (this._onlineDevices != this.ConnectIQ.OnlineDevices) {
                this._onlineDevices = this.ConnectIQ.OnlineDevices;
                this.appComponent.setAppPages(this.ModifyMainMenu());
            }
        });
        AppService.AppToolbar = this.Toolbar;
    }

    public async ionViewDidEnter() {
        this.appComponent.setAppPages(this.ModifyMainMenu());
    }

    public async ionViewWillLeave() {
        this._deviceChangedSubscription?.unsubscribe();
        this._deviceChangedSubscription = undefined;
    }

    public async ionViewDidLeave() {}

    public ModifyMainMenu(): MenuItem[] {
        return [];
    }

    protected async reload() {
        /* else, scroll buttons won't be shown */
        await new Promise(resolve => setTimeout(resolve, 1));
        this.cdr.detectChanges();
    }
}
