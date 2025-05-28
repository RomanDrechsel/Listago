import { CommonModule } from "@angular/common";
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { IonButton, IonButtons, IonDatetime, ModalController } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { timer } from "rxjs";
import { LocalizationService } from "../../services/localization/localization.service";

@Component({
    selector: 'app-datetime',
    imports: [
        IonDatetime, IonButtons, IonButton, CommonModule, TranslateModule,
    ],
    templateUrl: './datetime.component.html',
    styleUrl: './datetime.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None
})
export class DatetimeComponent implements AfterViewInit {
    @ViewChild('datetime', { read: ElementRef, static: false }) datetime?: ElementRef;

    public selectedDate: string | undefined;

    private readonly ModalCtrl = inject(ModalController);

    private readonly Locale = inject(LocalizationService);

    public Params?: EditorParams;

    public get LocaleString(): string {
        return this.Locale.CurrentLanguage.locale;
    }

    public get FirstDayOfWeek(): number {
        return this.Locale.CurrentLanguage.firstDayOfWeek;
    }

    public get Today(): string {
        return new Date().toISOString();
    }

    public ngAfterViewInit() {
        timer(200).subscribe(() => {
            const shadow: DocumentFragment = this.datetime?.nativeElement.shadowRoot;
            if (shadow) {
                shadow.querySelector('.calendar-days-of-week')?.setAttribute('part', 'days-of-week');
                shadow.querySelectorAll('.calendar-next-prev ion-button').forEach(el => el.setAttribute('part', 'calender-next-prev-button'));
                shadow.querySelector('.datetime-header')?.setAttribute('part', 'header');
                shadow.querySelector('ion-picker')?.setAttribute('part', 'picker');
            }
        });
    }

    public async selectToday() {
        if (this.datetime) {
            const datetime = this.datetime.nativeElement as IonDatetime;
            datetime.value = new Date().toISOString();
            datetime.confirm();
        }
    }

    public cancel() {
        this.ModalCtrl.dismiss(null, "cancel");
    }

    public async onChange(date: string | string[] | null | undefined) {
        if (typeof (date) == "string") {
            this.ModalCtrl.dismiss(new Date(date), "confirm");
        }
        else {
            this.ModalCtrl.dismiss(null, "cancel");
        }
    }
}

export const SelectDatetime = async function(modalController: ModalController, params?: EditorParams): Promise<Date | undefined> {
    const modal = await modalController.create({
        component: DatetimeComponent,
        componentProps: { Params: params },
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "autosize-modal",
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === "confirm") {
        return data;
    }
    return undefined;
};

declare type EditorParams = {
    selectedDate?: Date;
    minimumDate?: Date;
    maximumDate?: Date;
    title?: string;
};
