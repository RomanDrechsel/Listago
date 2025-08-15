import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, ElementRef, inject, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FileInfo } from "@capacitor/filesystem";
import { IonContent, IonFab, IonFabButton, IonFabList, IonIcon, IonSelect, IonSelectOption, IonText, ModalController, ScrollDetail, SelectCustomEvent } from "@ionic/angular/standalone";
import { IonContentCustomEvent } from "@ionic/core";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { interval, Subscription } from "rxjs";
import { FileUtils } from "src/app/classes/utils/file-utils";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { InteractionAnimation } from "../../../animations/interaction.animation";
import { SelectDatetime } from "../../../components/datetime/datetime.component";
import { PageEmptyComponent } from "../../../components/page-empty/page-empty.component";
import { ShareLogfile } from "../../../components/share-log/share-log.component";
import { PageBase } from "../../page-base";
@Component({
    selector: "app-showlogs",
    templateUrl: "./showlogs.page.html",
    styleUrls: ["./showlogs.page.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PageEmptyComponent, CommonModule, TranslocoModule, MainToolbarComponent, IonIcon, IonFabButton, IonFab, IonFabList, IonContent, IonSelect, IonSelectOption, IonText],
    providers: [provideTranslocoScope({ scope: "pages/settings/showlogs-page", alias: "page_settings_showlogs" }, { scope: "common/buttons", alias: "buttons" })],
})
export class ShowlogsPage extends PageBase {
    @ViewChild("fabButton", { read: ElementRef, static: false }) fabButton?: ElementRef;
    @ViewChild("saveLogsButton", { read: ElementRef, static: false }) saveLogsButton?: ElementRef;
    @ViewChild("mainContent", { read: IonContent, static: false }) mainContent?: IonContent;
    @ViewChild("mainContent", { read: ElementRef, static: false }) mainContentRef?: ElementRef;
    @ViewChild("logContent", { read: ElementRef, static: false }) logContent?: ElementRef;

    public currentLogfile?: FileUtils.File;

    public availableLogfiles: FileInfo[] = [];

    public runningAnimation?: InteractionAnimation;

    private _timerSubscription?: Subscription;

    private _selectedDate?: Date;

    private _scrollPosition: "top" | "bottom" | number = "top";

    private readonly _modaleCtrl = inject(ModalController);
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);

    public get SelectedDayString(): string {
        return (this._selectedDate ?? new Date()).toLocaleDateString(this.Locale.CurrentLanguage.locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    }

    public get LogfilesAvailable(): boolean {
        return this.availableLogfiles.length > 0;
    }

    public get ScrollPosition(): "top" | "bottom" | number {
        return this._scrollPosition;
    }

    public get ShowScrollButtons(): boolean {
        return this.isScrollable;
    }

    public get DisableScrollToTop(): boolean {
        return this._scrollPosition == "top";
    }

    public get DisableScrollToBottom(): boolean {
        return this._scrollPosition == "bottom";
    }

    public get isScrollable(): boolean {
        return (this.logContent?.nativeElement as HTMLElement)?.scrollHeight > (this.mainContentRef?.nativeElement as HTMLElement)?.clientHeight;
    }

    public override async ionViewWillEnter() {
        await super.ionViewWillEnter();
        await this.selectLogDay(undefined);
    }

    public override async ionViewDidEnter() {
        await super.ionViewDidEnter();
        this._timerSubscription = interval(2000).subscribe(async () => {
            if (this.currentLogfile) {
                const size = this.currentLogfile?.Content?.length ?? 0;
                const scroll_to_bottom = this._scrollPosition == "bottom" || !this.isScrollable;
                this.currentLogfile = await this.Logger.GetLogfile(this.currentLogfile?.Filename);
                if (size != (this.currentLogfile?.Content?.length ?? 0)) {
                    this.cdr.detectChanges();
                    if (scroll_to_bottom) {
                        setTimeout(() => {
                            this.ScrollToBottom(false);
                        }, 1);
                    }
                }
            }
        });
        const send_errorReport = this._route.snapshot.queryParams["errorReport"];
        if (send_errorReport) {
            this._router.navigate([], { queryParams: {}, replaceUrl: true });
            this.runningAnimation = new InteractionAnimation();
            this.runningAnimation.AddStep({
                duration: 700,
                do: async () => {
                    this.fabButton?.nativeElement.click();
                    return true;
                },
            });
            this.runningAnimation.AddStep({
                duration: 700,
                do: async () => {
                    this.saveLogsButton?.nativeElement.classList.add("clicked");
                    await new Promise(resolve => setTimeout(resolve, 600));
                    this.saveLogsButton?.nativeElement.classList.remove("clicked");
                    await new Promise(resolve => setTimeout(resolve, 200));
                    this.saveLogsButton?.nativeElement.click();
                    return true;
                },
            });

            this.runningAnimation.Run();
        }
    }

    public override async ionViewWillLeave() {
        await super.ionViewWillLeave();
        this._timerSubscription?.unsubscribe();
    }

    public onChangeLogfile(event: SelectCustomEvent) {
        this.loadLogfile(event.detail.value);
    }

    public async onDelete() {
        if (this.currentLogfile) {
            const locale = this.Locale.getText(["buttons.yes", "buttons.no", "page_settings_showlogs.confirm_delete"], { filename: this.currentLogfile.Filename });
            await this.Popups.Alert.YesNo({
                message: locale["page_settings_showlogs.confirm_delete"],
                button_no: locale["buttons.no"],
                button_yes: {
                    text: locale["buttons.yes"],
                    handler: async () => {
                        await FileUtils.DeleteFile(this.currentLogfile!.Path);
                        this.Popups.Toast.Success("page_settings_showlogs.toast_deleted");
                        this.NavController.navigateBack("settings/logging");
                    },
                },
            });
        }
    }

    public async onSave() {
        if (this.currentLogfile) {
            await ShareLogfile(this._modaleCtrl, { file: this.currentLogfile, watch_logs_included: this.runningAnimation?.isRunning, do: this.runningAnimation?.isRunning ? "email" : undefined });
        }
    }

    public formatLogfile(file?: FileInfo | null): string {
        if (file) {
            return `${file.name} (${FileUtils.File.FormatSize(file.size)})`;
        } else {
            return "";
        }
    }

    public async openCalendar() {
        let minimumDate: Date | undefined = undefined;
        if (this.Logger.AutoDelete > 0) {
            minimumDate = new Date();
            minimumDate.setDate(minimumDate.getDate() - this.Logger.AutoDelete);
        }

        const date = await SelectDatetime(this._modaleCtrl, { selectedDate: this._selectedDate, maximumDate: new Date(), minimumDate: minimumDate, title: this.Locale.getText("page_settings_showlogs.select_logday_title") });
        if (date) {
            this.selectLogDay(date);
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

    private async selectLogDay(date: Date | undefined) {
        if (!date) {
            date = new Date();
        }

        this._selectedDate = date;
        this.availableLogfiles = await this.Logger.ListLogfiles(new Date(date).setHours(0, 0, 0, 0), new Date(date).setHours(23, 59, 59, 999));
        if (this.availableLogfiles.length > 0) {
            this.loadLogfile(this.availableLogfiles[0].name);
        } else {
            this.loadLogfile(undefined);
        }
    }

    private async loadLogfile(filename: string | undefined) {
        if (filename) {
            this.currentLogfile = await this.Logger.GetLogfile(filename);
        } else {
            this.currentLogfile = undefined;
        }

        setTimeout(() => {
            this.ScrollToBottom(true);
        }, 1);
    }
}
