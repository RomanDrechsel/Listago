import { NavController } from "@ionic/angular/standalone";
import { ConnectIQService } from "../../../services/connectiq/connect-iq.service";
import { Logger } from "../../../services/logging/logger";
import { PopupsService } from "../../../services/popups/popups.service";
import { ConnectIQDeviceMessage } from "../event-args/connect-iq-device-message.";
import { DeviceMessageEventArgs } from "../event-args/device-message-event-args.";
import { ConnectIQListener } from "./connect-iq-listener";

export class DeviceLogsListener extends ConnectIQListener<DeviceMessageEventArgs> {
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

    protected async Callback(obj: DeviceMessageEventArgs): Promise<void> {
        const data = new ConnectIQDeviceMessage(obj, this._service);
        if (data.Message.type && data.Message.type == "logs") {
            let logs: string[] = [];
            Object.entries(data.Message).forEach(([key, value]) => {
                if (key != "type") {
                    logs.push(`${value}`);
                }
            });
            let logreport = ["", "===========", `Received logs from device ${data.Device}:`];
            logreport.push(...logs);
            logreport.push("===========", "");
            Logger.Important(logreport.join("\n"));

            if (await this._popup.Alert.YesNo({ message: "comp-watchlogs.logs_received_confirm", translate: true })) {
                await this._navController.navigateForward("settings/watch-logs", {
                    queryParams: {
                        watchLogs: logs,
                    },
                });
            }
        }
    }
}
