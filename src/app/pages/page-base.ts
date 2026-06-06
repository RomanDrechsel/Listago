import { ChangeDetectorRef, Component, inject, ViewChild } from "@angular/core";
import { NavController } from "@ionic/angular/standalone";
import { Subscription } from "rxjs";
import { AppComponent } from "../app.component";
import { MenuItem } from "../classes/menu-items";
import { MainToolbarComponent } from "../components/main-toolbar/main-toolbar.component";
import { AdmobService } from "../services/adverticing/admob.service";
import { AppService } from "../services/app/app.service";
import { ConfigService } from "../services/config/config.service";
import { ConnectIQService } from "../services/connectiq/connect-iq.service";
import { ListsService } from "../services/lists/lists.service";
import { LocalizationService } from "../services/localization/localization.service";
import { LoggingService } from "../services/logging/logging.service";
import { PopupsService } from "../services/popups/popups.service";
import { EPrefProperty, PreferencesService } from "../services/storage/preferences.service";

@Component({
    template: "",
    standalone: false,
})
export abstract class PageBase {
    @ViewChild(MainToolbarComponent, { static: false }) private _mainToolbar?: MainToolbarComponent;
    public readonly Locale = inject(LocalizationService);
    public readonly Logger = inject(LoggingService);
    public readonly ConnectIQ = inject(ConnectIQService);
    protected readonly _popups = inject(PopupsService);
    protected readonly _listsService = inject(ListsService);
    protected readonly _preferences = inject(PreferencesService);
    protected readonly _navController = inject(NavController);
    protected readonly _appService = inject(AppService);
    protected readonly _admob = inject(AdmobService);
    protected readonly _config = inject(ConfigService);
    protected readonly _cdr = inject(ChangeDetectorRef);

    private _deviceChangedSubscription?: Subscription;
    private _onlineDevices: number = 0;

    protected _animationsEnabled: boolean = false;
    private _preferencesSubscription?: Subscription = undefined;

    public get AnimationsEnabled(): boolean {
        return this._animationsEnabled;
    }

    public async ionViewWillEnter() {
        this._deviceChangedSubscription = this.ConnectIQ.onDeviceChanged$.subscribe(async () => {
            if (this._onlineDevices != this.ConnectIQ.OnlineDevices) {
                this._onlineDevices = this.ConnectIQ.OnlineDevices;
                AppComponent.Instance?.setAppPages(this.ModifyMainMenu());
            }
        });
        AppComponent?.Instance?.setToolbar(this._mainToolbar);

        this._preferencesSubscription = this._preferences.onPrefChanged$.subscribe(async pref => {
            if (pref.prop === EPrefProperty.Animations) {
                this._animationsEnabled = pref.value as boolean;
            }
            await this.onPreferencesChanged(pref);
        });
        this._animationsEnabled = await this._preferences.Get(EPrefProperty.Animations, true);
    }

    public async ionViewDidEnter() {
        AppComponent.Instance?.setAppPages(this.ModifyMainMenu());
    }

    public async ionViewWillLeave() {
        this._deviceChangedSubscription?.unsubscribe();
        this._deviceChangedSubscription = undefined;
        this._preferencesSubscription?.unsubscribe();
        this._preferencesSubscription = undefined;
    }

    public async ionViewDidLeave() {}

    public ModifyMainMenu(): MenuItem[] {
        return [];
    }

    protected async reload() {
        /* else, scroll buttons won't be shown */
        await new Promise(resolve => setTimeout(resolve, 1));
        this._cdr.detectChanges();
    }

    protected async onPreferencesChanged(_: { prop: EPrefProperty; value: any }) {}
}
