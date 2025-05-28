import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, ViewChild, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { IonButton, IonCard, IonContent, IonFab, IonFabButton, IonIcon, IonSelect, IonSelectOption, IonText, IonToggle } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { Subscription } from "rxjs";
import { MainToolbarComponent } from "src/app/components/main-toolbar/main-toolbar.component";
import { ConnectIQDevice } from "src/app/services/connectiq/connect-iq-device";
import { PageBase } from "../page-base";

@Component({
    selector: "app-devices",
    templateUrl: "./devices.page.html",
    styleUrls: ["./devices.page.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IonToggle, IonFabButton, IonIcon, IonFab, IonText, IonButton, IonCard, IonContent, IonSelect, IonSelectOption, CommonModule, FormsModule, MainToolbarComponent, TranslateModule],
})
export class DevicesPage extends PageBase {
    @ViewChild("deviceSelect") private deviceSelect!: IonSelect;

    public SelectedDevice?: ConnectIQDevice;
    public ListUuid?: string;
    public Devices: ConnectIQDevice[] = [];

    public static SubmitButton?: { callback?: (device?: ConnectIQDevice) => Promise<void>; submitRoute?: string; buttonText?: string; only_online_device?: boolean };

    private initListener?: Subscription;
    private stateListener?: Subscription;

    private readonly Route = inject(ActivatedRoute);

    public get installHint(): boolean {
        return this.SelectedDevice?.State == "AppNotInstalled";
    }

    public get AlwaysTransmitDeviceSelected(): boolean {
        return this.ConnectIQ.AlwaysTransmitToDevice != undefined && this.ConnectIQ.AlwaysTransmitToDevice.Identifier == this.SelectedDevice?.Identifier;
    }

    public get hasSubmitButton(): boolean {
        return DevicesPage.SubmitButton?.callback != undefined || DevicesPage.SubmitButton?.submitRoute != undefined;
    }

    public get SubmitButtonLabel(): string {
        if (DevicesPage.SubmitButton?.buttonText) {
            return DevicesPage.SubmitButton?.buttonText;
        } else {
            return this.Locale.getText("page_devices.select_btn");
        }
    }

    public override async ionViewWillEnter() {
        super.ionViewWillEnter();
        this.loadDevices();
        this.ListUuid = this.Route.snapshot.queryParams["transmit"];
    }

    public override async ionViewDidEnter() {
        super.ionViewDidEnter();
        this.initListener = this.ConnectIQ.onInitialized$.subscribe(async (initialized?: boolean) => {
            if (initialized) {
                await this.loadDevices();
            } else {
                this.Devices = [];
                this.SelectedDevice = undefined;
                this.selectDevice();
            }
        });

        this.stateListener = this.ConnectIQ.onDeviceChanged$.subscribe(device => {
            if (device) {
                if (device?.Identifier == this.SelectedDevice?.Identifier) {
                    this.SelectedDevice = device;
                }
                for (let i = 0; i < this.Devices.length; i++) {
                    if (this.Devices[i].Identifier == device.Identifier) {
                        this.Devices[i] = device;
                    }
                }
            }
            this.cdr.detectChanges();
        });
    }

    public override async ionViewDidLeave() {
        super.ionViewDidLeave();
        this.initListener?.unsubscribe();
        this.stateListener?.unsubscribe();
    }

    public async loadDevices() {
        this.Devices = await this.ConnectIQ.getDevices(true);
        if (this.SelectedDevice) {
            this.SelectedDevice = this.Devices.find(d => d.Identifier == this.SelectedDevice?.Identifier);
        }
        this.selectDevice();
    }

    public openStore() {
        this.ConnectIQ.openStore();
    }

    public async SubmitButton() {
        if (!DevicesPage.SubmitButton?.callback && !DevicesPage.SubmitButton?.submitRoute) {
            return;
        }
        if (this.SelectedDevice) {
            if (DevicesPage.SubmitButton?.callback) {
                await DevicesPage.SubmitButton.callback(this.SelectedDevice);
                DevicesPage.SubmitButton.callback = undefined;
            }

            if (DevicesPage.SubmitButton?.submitRoute) {
                this.NavController.navigateBack(DevicesPage.SubmitButton.submitRoute);
                DevicesPage.SubmitButton.submitRoute = undefined;
            } else {
                this.NavController.back();
            }
        }
    }

    public onDeviceChanged(id: number) {
        this.SelectedDevice = this.Devices.find(d => d.Identifier == id);
        this.cdr.detectChanges();
    }

    public onToggle(is_on: boolean) {
        if (this.SelectedDevice) {
            if (is_on) {
                this.ConnectIQ.AlwaysTransmitToDevice = this.SelectedDevice;
            } else {
                this.ConnectIQ.AlwaysTransmitToDevice = undefined;
            }
        }
    }

    private selectDevice() {
        if (!this.SelectedDevice) {
            if (this.ConnectIQ.AlwaysTransmitToDevice) {
                this.SelectedDevice = this.ConnectIQ.AlwaysTransmitToDevice;
            }
            if (!this.SelectedDevice && this.Devices.length > 0) {
                this.Devices.forEach(d => {
                    if (!this.SelectedDevice && d.State == "Ready") {
                        this.SelectedDevice = d;
                    }
                });
                if (!this.SelectedDevice) {
                    this.SelectedDevice = this.Devices[0];
                }
            }
        }

        this.deviceSelect.writeValue(this.SelectedDevice?.Identifier);
        this.cdr.detectChanges();
    }
}

export const SelectGarminDevice = function (args: { router: Router; callback: (device?: ConnectIQDevice) => Promise<void>; submitRoute?: string; buttonText?: string; only_online_device?: boolean }) {
    DevicesPage.SubmitButton = {
        callback: args.callback,
        submitRoute: args.submitRoute,
        buttonText: args.buttonText,
        only_online_device: args.only_online_device,
    };
    args.router.navigate(["/devices"]);
};
