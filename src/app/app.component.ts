import { CommonModule } from "@angular/common";
import { type AfterViewInit, ChangeDetectorRef, Component, inject, isDevMode, OnInit, ViewChild } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { App } from "@capacitor/app";
import { IonApp, IonContent, IonFooter, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonRouterOutlet, IonSplitPane, IonToggle, NavController, Platform } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { EMenuItemType, MenuItem, MenuitemFactory, MenuitemFactoryList } from "./classes/menu-items";
import { IconWithBadgeComponent } from "./components/icon-with-badge/icon-with-badge.component";
import type { MainToolbarComponent } from "./components/main-toolbar/main-toolbar.component";
import { AppUpdaterService } from "./services/app/app-updater.service";
import { AppService } from "./services/app/app.service";
import { ConnectIQService } from "./services/connectiq/connect-iq.service";
import { EPrefProperty, PreferencesService } from "./services/storage/preferences.service";

@Component({
    selector: "app-root",
    templateUrl: "app.component.html",
    styleUrls: ["app.component.scss"],
    imports: [IonToggle, IonFooter, IonApp, IonSplitPane, IonMenu, IonContent, IonList, IonItem, IonIcon, IonLabel, IonRouterOutlet, TranslocoModule, RouterLink, RouterLinkActive, CommonModule, IconWithBadgeComponent],
    providers: [provideTranslocoScope({ scope: "common/mainmenu", alias: "mainmenu" })],
})
export class AppComponent implements OnInit, AfterViewInit {
    private _appPages: MenuItem[] = [];
    private _useTrash: boolean = true;
    private _firstStart: boolean = true;

    private static _instance?: AppComponent;

    public readonly ConnectIQ = inject(ConnectIQService);
    private readonly _platform = inject(Platform);
    private readonly _preferences = inject(PreferencesService);
    private readonly _app = inject(AppService);
    private readonly _navController = inject(NavController);
    private readonly _cdr = inject(ChangeDetectorRef);
    private readonly _appupdater = inject(AppUpdaterService);
    private _currentToolbar?: MainToolbarComponent = undefined;

    @ViewChild("router_outlet") private routerOutlet!: IonRouterOutlet;

    @ViewChild("mainMenu") private MainMenu!: IonMenu;

    public get isDevMode(): boolean {
        return isDevMode();
    }

    public get menuSide(): string {
        return this._app.DeviceWidth < 1024 ? "end" : "start";
    }

    public get FirstStart(): boolean {
        return this._firstStart;
    }

    public get SystemPages(): MenuItem[] {
        const ret: MenuItem[] = [];
        if (!this._appupdater.IsUpToDate) {
            ret.push(
                MenuitemFactory(EMenuItemType.InstallUpdate, {
                    onClick: async () => {
                        this._appupdater.CheckForUpdates(true, false);
                        return true;
                    },
                }),
            );
        }
        ret.push(...MenuitemFactoryList([EMenuItemType.Settings, EMenuItemType.AppInfo, EMenuItemType.Privacy]));
        return ret;
    }

    public get AppPages(): MenuItem[] {
        return this._appPages;
    }

    public static get Instance(): AppComponent | undefined {
        return AppComponent._instance;
    }

    public async ngOnInit() {
        AppComponent._instance = this;
        //exit app if back-stack is empty
        this._platform.backButton.subscribeWithPriority(-1, async () => {
            await this.tapBack();
        });

        this._preferences.onPrefChanged$.subscribe(prop => {
            if (prop.prop == EPrefProperty.TrashLists) {
                this._useTrash = prop.value as boolean;
                this.setAppPages();
            } else if (prop.prop == EPrefProperty.FirstStart) {
                this._firstStart = prop.value as boolean;
                this._cdr.detectChanges();
            }
        });
        this.ConnectIQ.onInitialized$.subscribe(() => {
            this.setAppPages();
        });

        this._useTrash = await this._preferences.Get<boolean>(EPrefProperty.TrashLists, true);
        this._firstStart = await this._preferences.Get<boolean>(EPrefProperty.FirstStart, true);
        this.setAppPages();
    }

    public async ngAfterViewInit(): Promise<void> {
        await this._app.AppIsReady();
        await this._appupdater.CheckForUpdates(false, false);
    }

    public async onMenuItemClick(item: MenuItem) {
        let close = true;
        if (item.onClick) {
            close = await item.onClick();
        }
        if (close) {
            await this.MainMenu?.close();
        }
    }

    public onGarminSimulator(checked: boolean) {
        this.ConnectIQ.AlwaysTransmitToDevice = undefined;
        this._preferences.Set(EPrefProperty.DebugSimulator, checked);
        this.ConnectIQ.Initialize({ simulator: checked });
    }

    public onGarminDebugApp(checked: boolean) {
        this.ConnectIQ.AlwaysTransmitToDevice = undefined;
        this._preferences.Set(EPrefProperty.DebugApp, checked);
        this.ConnectIQ.Initialize({ debug_app: checked });
    }

    public setAppPages(menu: MenuItem[] = []) {
        let required = MenuitemFactoryList([EMenuItemType.Lists]);
        if (this.ConnectIQ.Initialized) {
            required.push(
                MenuitemFactory(EMenuItemType.Devices),
                MenuitemFactory(EMenuItemType.OpenApp, {
                    disabled: this.ConnectIQ.OnlineDevices == 0,
                    onClick: () => {
                        this.MainMenu?.close();
                        return this.ConnectIQ.openApp(undefined, true);
                    },
                }),
            );
        }

        required.push(MenuitemFactory(EMenuItemType.ListsTrash, { disabled: !this._useTrash }));
        for (let i = required.length - 1; i >= 0; i--) {
            if (!menu?.find(m => m.Id == required[i].Id)) {
                menu?.unshift(required[i]);
            }
        }
        this._appPages = menu.filter(m => m.Hidden !== true);
        this._cdr.detectChanges();
    }

    public setToolbar(toolbar?: MainToolbarComponent) {
        this._currentToolbar = toolbar;
    }

    public async CloseMenu(): Promise<void> {
        if (this.MainMenu) {
            await this.MainMenu.close();
        }
    }

    public async onMainMenuOpen() {
        await AppService.Popups.Toast.CloseAll();
    }

    private async tapBack() {
        if (this.routerOutlet) {
            if (!this.routerOutlet.canGoBack()) {
                const backlink = this._currentToolbar?.BackLink;
                if (backlink) {
                    if (!(await this._navController.navigateBack(backlink))) {
                        await this._navController.navigateBack(backlink);
                    }
                } else {
                    await App.minimizeApp();
                }
            }
        }
    }
}
