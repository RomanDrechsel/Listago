import { NavController } from "@ionic/angular/standalone";
import { ConnectIQService } from "../../../services/connectiq/connect-iq.service";
import { Logger } from "../../../services/logging/logger";
import { PopupsService } from "../../../services/popups/popups.service";
import { ConnectIQDeviceMessage } from "../event-args/connect-iq-device-message.";
import { DeviceMessageEventArgs } from "../event-args/device-message-event-args.";
import { ConnectIQListener } from "./connect-iq-listener";

export class DeviceErrorReportListener extends ConnectIQListener<DeviceMessageEventArgs> {
    private readonly _navController: NavController;
    private readonly _popup: PopupsService;

    constructor(service: ConnectIQService, nav: NavController, popup: PopupsService) {
        super(service);
        this._navController = nav;
        this._popup = popup;
    }

    public override Event(): string {
        return "RECEIVE";
    }

    protected override async Callback(obj: DeviceMessageEventArgs): Promise<void> {
        const data = new ConnectIQDeviceMessage(obj, this._service);
        if (data.Message.type && data.Message.type == "reportError") {
            let logreport = ["", "===========", `Received error report from device ${data.Device}:`];
            logreport.push("===========", "");
            logreport.push(...this.processMessage(data.Message));
            Logger.Error(logreport.join("\n"));

            if (await this._popup.Alert.YesNo({ message: "comp-sharelog.error_report_confirm", translate: true })) {
                await this._navController.navigateForward("settings/logs", {
                    queryParams: {
                        errorReport: true,
                    },
                });
            }
        }
    }

    protected processMessage(data: any): string[] {
        var errorMsg = "";
        var errorCode = "0x0000";
        var Payload: { [key: number]: string } = {};
        var logs: string[] = [];

        var payloadError = 999999999;
        var logError = 999999999;
        Object.entries(data).forEach(([key, value]) => {
            if (key == "msg") {
                errorMsg = `${value}`;
            } else if (key == "code") {
                errorCode = `${value}`;
            } else if (key.startsWith("payload")) {
                let index = Number(key.substring(7));
                if (Number.isNaN(index)) {
                    index = payloadError--;
                }
                Payload[index] = `${value}`;
            } else if (key.startsWith("log")) {
                let index = Number(key.substring(3));
                if (Number.isNaN(index)) {
                    index = logError--;
                }
                logs[index] = `${value}`;
            }
        });

        const ret: string[] = [];
        ret.push("Message: " + errorMsg);
        ret.push("Code: " + errorCode);
        if (Object.entries(Payload).length > 0) {
            ret.push("");
            ret.push("Payload:");
            Object.keys(Payload)
                .map(Number)
                .sort((a, b) => a - b)
                .map(key => Payload[key])
                .forEach(val => {
                    ret.push(`${val}`);
                });
        }
        if (Object.entries(logs).length > 0) {
            ret.push("");
            ret.push("Watch logs:");
            Object.keys(logs)
                .map(Number)
                .sort((a, b) => a - b)
                .map(key => logs[key])
                .forEach(val => {
                    ret.push(`${val}`);
                });
        }

        return ret;
    }
}
