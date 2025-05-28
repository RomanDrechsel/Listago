import { CommonModule } from "@angular/common";
import { Component, inject, ViewChild } from "@angular/core";
import { IonButton, IonButtons, IonHeader, IonPicker, IonPickerColumn, IonPickerColumnOption, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { ListReset } from "../../services/lists/list";
import { LocalizationService } from "../../services/localization/localization.service";
import { EPrefProperty, PreferencesService } from "../../services/storage/preferences.service";

@Component({
    selector: "app-select-interval",
    imports: [IonPicker, IonButton, IonButtons, IonToolbar, IonHeader, IonPickerColumn, IonPickerColumnOption, CommonModule, TranslateModule],
    templateUrl: "./select-interval.component.html",
    styleUrl: "./select-interval.component.scss",
})
export class SelectIntervalComponent {
    @ViewChild("pickerHour", { read: IonPickerColumn }) pickerHour?: IonPickerColumn;
    @ViewChild("pickerMinute", { read: IonPickerColumn }) pickerMinute?: IonPickerColumn;
    @ViewChild("pickerDay", { read: IonPickerColumn }) pickerDay?: IonPickerColumn;
    @ViewChild("pickerWeekday", { read: IonPickerColumn }) pickerWeekday?: IonPickerColumn;

    public readonly Locale = inject(LocalizationService);
    private readonly modalCtrl = inject(ModalController);
    private readonly Preferences = inject(PreferencesService);

    private _hours?: { v: number; s: string }[] = undefined;
    private _minutes?: { v: number; s: string }[] = undefined;
    private _weekdays?: { v: number; s: string }[] = undefined;
    private _days?: { v: number; s: string }[] = undefined;

    public Params!: ListReset;

    public get Hours(): { v: number; s: string }[] {
        if (!this._hours) {
            this._hours = [];
            if (this.Locale.CurrentLanguage.h24) {
                for (let i = 0; i < 24; ++i) {
                    this._hours.push({ v: i, s: i.toString().padStart(2, "0") });
                }
            } else {
                let v = 0;
                [" AM", " PM"].forEach(ampm => {
                    this._hours!.push({ v: v++, s: 12 + ampm });
                    for (let i = 1; i < 12; i++) {
                        this._hours!.push({ v: v++, s: (i % 12).toString() + ampm });
                    }
                });
            }
        }
        return this._hours;
    }

    public get Minutes(): { v: number; s: string }[] {
        if (!this._minutes) {
            this._minutes = [];
            for (let i = 0; i < 60; i += 5) {
                this._minutes.push({ v: i, s: i.toString().padStart(2, "0") });
            }
        }
        return this._minutes;
    }

    public get Days(): { v: number; s: string }[] {
        if (!this._days) {
            this._days = [];
            for (let i = 1; i <= 31; ++i) {
                this._days.push({ v: i, s: i.toString().padStart(2, "0") + "." });
            }
            this._days.push({ v: 99, s: this.Locale.getText("comp-select-interval.last") });
        }
        return this._days;
    }

    public get Weekdays(): { v: number; s: string }[] {
        if (!this._weekdays || this._weekdays.length == 0) {
            const locale = this.Locale.getText(["date.weekday.mon", "date.weekday.tue", "date.weekday.wed", "date.weekday.thu", "date.weekday.fri", "date.weekday.sat", "date.weekday.sun"]);
            this._weekdays = [];
            let day = this.Locale.CurrentLanguage.firstDayOfWeek;
            for (let i = 1; i <= 7; i++) {
                let weekday: string;
                let v = (i + day - 1) % 7;
                if (v == 0) {
                    v = 7;
                }
                switch (v) {
                    case 1:
                        weekday = locale["date.weekday.sun"];
                        break;
                    case 2:
                        weekday = locale["date.weekday.mon"];
                        break;
                    case 3:
                        weekday = locale["date.weekday.tue"];
                        break;
                    case 4:
                        weekday = locale["date.weekday.wed"];
                        break;
                    case 5:
                        weekday = locale["date.weekday.thu"];
                        break;
                    case 6:
                        weekday = locale["date.weekday.fri"];
                        break;
                    case 7:
                        weekday = locale["date.weekday.sat"];
                        break;
                    default:
                        weekday = locale[6];
                }
                this._weekdays.push({ v: v, s: weekday });
            }
        }
        return this._weekdays;
    }

    public async ionViewWillEnter() {
        if (this.pickerHour) {
            this.pickerHour.value = this.Params.hour ?? 0;
        }
        if (this.pickerMinute) {
            this.pickerMinute.value = this.Params.minute ?? 0;
        }
        if (this.pickerDay) {
            this.pickerDay.value = this.Params.day ?? 1;
        }
        if (this.pickerWeekday) {
            this.pickerWeekday.value = this.Params.weekday ?? this.Locale.CurrentLanguage.firstDayOfWeek;
        }

        this.Preferences.onPrefChanged$.subscribe(prop => {
            if (prop.prop == EPrefProperty.AppLanguage) {
                this._hours = undefined;
                this._weekdays = undefined;
            }
        });
    }

    public async cancel() {
        this.modalCtrl.dismiss(null, "cancel");
    }

    public async select() {
        const obj: ListReset = {
            active: this.Params.active,
            interval: this.Params.interval,
            hour: Number(this.pickerHour?.value) ?? this.Params.hour ?? 0,
            minute: Number(this.pickerMinute?.value) ?? this.Params.minute ?? 0,
            day: (this.Params.interval == "monthly" ? Number(this.pickerDay?.value) ?? this.Params.day : this.Params.day) ?? 1,
            weekday: (this.Params.interval == "weekly" ? Number(this.pickerWeekday?.value) ?? this.Params.weekday : this.Params.weekday) ?? this.Locale.CurrentLanguage.firstDayOfWeek,
        };
        this.modalCtrl.dismiss(obj, "confirm");
    }
}

export const SelectTimeInterval = async function (modalController: ModalController, params: ListReset) {
    const modal = await modalController.create({
        component: SelectIntervalComponent,
        componentProps: { Params: params },
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "bottom-modal",
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === "confirm") {
        return data as ListReset;
    }
    return undefined;
};
