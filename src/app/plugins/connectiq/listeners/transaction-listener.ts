import { StringUtils } from "../../../classes/utils/string-utils";
import { ConnectIQDevice } from "../../../services/connectiq/connect-iq-device";
import { ConnectIQService } from "../../../services/connectiq/connect-iq.service";
import { Logger } from "../../../services/logging/logger";
import { ConnectIQDeviceMessage } from "../event-args/connect-iq-device-message.";
import { DeviceMessageEventArgs } from "../event-args/device-message-event-args.";
import { TimeoutListener } from "./timeout-listener";

export class TransactionListener extends TimeoutListener<DeviceMessageEventArgs> {
    private _tid: number;
    private _callback: (message?: ConnectIQDeviceMessage) => Promise<void>;
    private _device: ConnectIQDevice;
    public static Event = "RECEIVE";

    public constructor(service: ConnectIQService, device: ConnectIQDevice, tid: number, callback: (message?: ConnectIQDeviceMessage) => Promise<void>, timeout?: number) {
        super(service, timeout);

        this._tid = tid;
        this._device = device;
        this._callback = callback;
    }

    public get TId(): number {
        return this._tid;
    }

    public Event(): string {
        return TransactionListener.Event;
    }

    public override async TimedOut(): Promise<void> {
        if (this._callback) {
            this._callback(undefined);
        }
        super.TimedOut();
    }

    protected async Callback(obj: DeviceMessageEventArgs): Promise<void> {
        const message = new ConnectIQDeviceMessage(obj, this._service);
        if (message.Device.equals(this._device) && message.Message?.tid) {
            const tid = Number(message.Message.tid);
            if (!Number.isNaN(tid) && tid === this._tid) {
                Logger.Debug(`Received watch response for request ${tid} with ${StringUtils.toString(message.Message).length} bytes from device ${message.Device.toString()} after ${Date.now() - (this._started ?? -1)} ms`);
                await this._callback(message);
                this._service.removeListener(this);
                return;
            }
        }
    }
}
