import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, inject } from "@angular/core";
import { IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController } from "@ionic/angular/standalone";
import { provideTranslocoScope, TranslocoModule } from "@jsverse/transloco";
import { ConnectIQDevice } from "../../services/connectiq/connect-iq-device";
import { ConnectIQMessageType } from "../../services/connectiq/connect-iq-message-type";
import { ConnectIQService } from "../../services/connectiq/connect-iq.service";
import { Logger } from "../../services/logging/logger";

@Component({
    selector: "app-request-watch-log",
    imports: [IonButton, IonButtons, IonTitle, IonToolbar, IonIcon, IonHeader, CommonModule, TranslocoModule],
    templateUrl: "./request-watch-log.component.html",
    styleUrl: "./request-watch-log.component.scss",
    providers: [provideTranslocoScope({ scope: "components/request-watch-logs", alias: "comp-watchlogs" }, { scope: "common/buttons", alias: "buttons" })],
})
export class RequestWatchLogComponent implements AfterViewInit {
    public Params!: RequestWatchLogsParams;
    private readonly _modalCtrl = inject(ModalController);
    private readonly _connectIQ = inject(ConnectIQService);
    private _stop: boolean = true;

    public async ngAfterViewInit(): Promise<void> {
        await this.requestLog();
    }

    public cancel() {
        this._stop = true;
        this._modalCtrl.dismiss(undefined, "cancel");
    }

    public proceedWithoutLogs() {
        this._stop = true;
        this._modalCtrl.dismiss(["Log request canceled"], "confirm");
    }

    public async openApp() {
        await this._connectIQ.openApp(this.Params.device);
    }

    private async requestLog(): Promise<void> {
        this._stop = false;
        const logs = await new Promise<string[]>(async resolve => {
            while (!this._stop) {
                const resp = await this._connectIQ.SendToDeviceTransaction({
                    device: this.Params.device,
                    messageType: ConnectIQMessageType.RequestWatchLogs,
                    data: undefined,
                    timeout: 5,
                });

                if (!this._stop) {
                    if (resp?.Message) {
                        let logs: string[] = [];
                        Object.entries(resp.Message).forEach(([key, value]) => {
                            if (key != "tid") {
                                logs.push(`${value}`);
                            }
                        });
                        this._stop = true;
                        resolve(logs);
                    } else {
                        Logger.Debug(`Could not receive logs from device, app not running...`);
                    }
                }
            }
        });

        this._stop = true;

        if (logs) {
            this._modalCtrl.dismiss(logs, "confirm");
        } else {
            this._modalCtrl.dismiss(undefined, "cancel");
        }
    }
}

export const RequestWatchLogs = async function (modalController: ModalController, params: RequestWatchLogsParams): Promise<string[]> {
    const modal = await modalController.create({
        component: RequestWatchLogComponent,
        componentProps: { Params: params },
        animated: true,
        backdropDismiss: true,
        showBackdrop: true,
        cssClass: "autosize-modal",
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === "confirm") {
        if (data) {
            return data as string[];
        }
    }
    return ["Log request canceled"];
};

declare type RequestWatchLogsParams = {
    device: ConnectIQDevice;
};
