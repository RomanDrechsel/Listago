import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, ElementRef, inject, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { IonContent, IonFab, IonFabButton, IonIcon, IonSelect, IonSelectOption, IonText, ScrollDetail, SelectCustomEvent } from "@ionic/angular/standalone";
import { IonContentCustomEvent } from "@ionic/core";
import { TranslateModule } from "@ngx-translate/core";
import { Subscription } from "rxjs";
import { MainToolbarComponent } from "../../../components/main-toolbar/main-toolbar.component";
import { PageEmptyComponent } from "../../../components/page-empty/page-empty.component";
import { ConnectIQDevice } from "../../../services/connectiq/connect-iq-device";
import { WatchLoggingService } from "../../../services/logging/watch-logging.service";
import { PageBase } from "../../page-base";

@Component({
    selector: "app-show-watch-logs",
    templateUrl: "./show-watch-logs.page.html",
    styleUrls: ["./show-watch-logs.page.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IonFabButton, IonFab, IonText, IonIcon, IonContent, IonSelect, IonSelectOption, CommonModule, FormsModule, TranslateModule, MainToolbarComponent, PageEmptyComponent],
})
export class ShowWatchLogsPage extends PageBase {
    @ViewChild("mainContent", { read: IonContent, static: false }) mainContent?: IonContent;
    @ViewChild("mainContent", { read: ElementRef, static: false }) mainContentRef?: ElementRef;
    @ViewChild("logContent", { read: ElementRef, static: false }) logContent?: ElementRef;

    public Device?: ConnectIQDevice = undefined;
    public DeviceLog?: string;

    public availableDevices: ConnectIQDevice[] = [];

    private readonly WatchLogs = inject(WatchLoggingService);
    private readonly Route = inject(ActivatedRoute);
    private readonly Router = inject(Router);

    private _deviceListener?: Subscription;
    private _scrollPosition: "top" | "bottom" | number = "top";

    public get ShowScrollButtons(): boolean {
        return (this.logContent?.nativeElement as HTMLElement)?.scrollHeight > (this.mainContentRef?.nativeElement as HTMLElement)?.clientHeight;
    }

    public get DisableScrollToTop(): boolean {
        return this._scrollPosition == "top";
    }

    public get DisableScrollToBottom(): boolean {
        return this._scrollPosition == "bottom";
    }

    public override async ionViewWillEnter() {
        await super.ionViewWillEnter();
        const logs = this.Route.snapshot.queryParams["watchLogs"];
        if (logs) {
            this.Router.navigate([], { queryParams: {}, replaceUrl: true });
            this.DeviceLog = logs.join("\n");
            this.cdr.detectChanges();
            await new Promise(resolve => setTimeout(resolve, 1));
            this.cdr.detectChanges();
            this.ScrollToBottom();
        }
        this._deviceListener = this.ConnectIQ.onDeviceChanged$.subscribe(async () => {
            await this.loadDevices();
        });
    }

    public override async ionViewWillLeave() {
        await super.ionViewWillLeave();
        this._deviceListener?.unsubscribe();
        this._deviceListener = undefined;
    }

    public async loadLog() {
        if (this.Device) {
            const logs = await this.WatchLogs.RequestGarminWatchLogs(this.Device.Identifier);
            if (logs) {
                this.DeviceLog = logs.join("\n");
                this.cdr.detectChanges();
                this.ScrollToBottom();
                /* else, scroll buttons won't be shown */
                await new Promise(resolve => setTimeout(resolve, 1));
                this.cdr.detectChanges();
                return;
            }
        }
        this.DeviceLog = undefined;
        this.cdr.detectChanges();
        this.ScrollToBottom();
    }

    public async onChangeDevice(event: SelectCustomEvent) {
        if (!this.Device?.equals(event.detail.value)) {
            await this.loadLog();
        }
    }

    public onScroll(event: IonContentCustomEvent<ScrollDetail>) {
        if (event.detail.scrollTop == 0) {
            this._scrollPosition = "top";
        } else if (event.detail.scrollTop >= (this.logContent?.nativeElement as HTMLElement)?.scrollHeight - event.target.scrollHeight || (this.logContent?.nativeElement as HTMLElement)?.scrollHeight < event.target.scrollHeight) {
            this._scrollPosition = "bottom";
        } else {
            this._scrollPosition = event.detail.scrollTop;
        }
    }

    public async ScrollToTop() {
        await this.mainContent?.scrollToTop(300);
        this.cdr.detectChanges();
    }

    public async ScrollToBottom(instant: boolean = true) {
        await this.mainContent?.scrollToBottom(instant ? 0 : 300);
        this.cdr.detectChanges();
    }

    private async loadDevices() {
        this.availableDevices = (await this.ConnectIQ.getDevices()).filter(d => d.State == "Ready");
        if (this.Device) {
            if (this.availableDevices.filter(d => d.Identifier === this.Device!.Identifier).length == 0) {
                this.Device = undefined;
                this.DeviceLog = undefined;
            }
        } else {
            if (this.availableDevices.length > 0) {
                this.Device = this.availableDevices[0];
            }
        }
        if (this.Device && !this.DeviceLog) {
            await this.loadLog();
        }
        this.cdr.detectChanges();
    }
}
