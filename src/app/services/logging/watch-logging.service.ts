import { inject, Injectable } from "@angular/core";
import { ModalController } from "@ionic/angular/standalone";
import { RequestWatchLogs } from "../../components/request-watch-log/request-watch-log.component";
import { ConnectIQDevice } from "../connectiq/connect-iq-device";
import { ConnectIQService } from "../connectiq/connect-iq.service";
import { Logger } from "./logger";

@Injectable({
    providedIn: "root",
})
export class WatchLoggingService {
    private readonly ConnectIQ = inject(ConnectIQService);
    private readonly ModalCtrl = inject(ModalController);

    /**
     * returns logs of the garmin watch
     * @returns logs as string array, or undefined if something goes wrong
     */
    public async RequestGarminWatchLogs(uuid?: string | number): Promise<string[]> {
        if (typeof uuid === "string") {
            try {
                uuid = Number(uuid);
            } catch {
                uuid = undefined;
            }
        }

        let devices: ConnectIQDevice[] = [];
        if (uuid) {
            const device = await this.ConnectIQ.GetDevice(Number(uuid));
            if (device) {
                devices = [device];
            }
        }
        if (devices.length == 0) {
            devices = (await this.ConnectIQ.getDevices()).filter(d => d.State == "Ready");
        }
        if (devices.length == 0) {
            return ["-----------------", "No Garmin devices found!", "-----------------"];
        }

        let ret: string[] = ["-----------------"];
        for (let i = 0; i < devices.length; i++) {
            let logs = [`Garmin Device ${i}:`, devices[i].toString()];
            if (devices[i].State != "Ready" && devices.length == 1) {
                logs = logs.concat(["-----------------", "Device is not ready!", "-----------------"]);
                break;
            } else if (devices[i].State == "Ready") {
                logs = logs.concat(await RequestWatchLogs(this.ModalCtrl, { device: devices[i] }));
                logs = logs.concat(["-----------------"]);
            }
            ret = ret.concat(logs);
        }

        Logger.Important(`Watch Logs:\n${ret.join("\n")}`);

        return ret;
    }
}
