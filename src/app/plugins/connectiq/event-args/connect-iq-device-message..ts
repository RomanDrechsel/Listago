import { ConnectIQDevice } from "../../../services/connectiq/connect-iq-device";
import { ConnectIQService } from "../../../services/connectiq/connect-iq.service";
import { DeviceMessageEventArgs } from "./device-message-event-args.";

export class ConnectIQDeviceMessage {
    public Device: ConnectIQDevice;
    public Message: any;

    constructor(args: DeviceMessageEventArgs, service: ConnectIQService) {
        this.Device = new ConnectIQDevice(args.device);
        if (args.message) {
            if (args.message && typeof args.message === "string") {
                try {
                    this.Message = JSON.parse(args.message);
                } catch (ex) {
                    this.Message = args.message;
                }
            } else {
                this.Message = args.message;
            }
        } else {
            this.Message = undefined;
        }
    }
}
