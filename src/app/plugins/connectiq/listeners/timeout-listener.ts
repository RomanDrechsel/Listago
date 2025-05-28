import { ConnectIQService } from "../../../services/connectiq/connect-iq.service";
import { ConnectIQListener } from "./connect-iq-listener";

export abstract class TimeoutListener<T> extends ConnectIQListener<T> {
    private readonly DEFAULT_TIMEOUT = 10;

    protected _started?: number;
    protected _timeout: number;
    protected _timeoutCallback?: () => Promise<void>;

    constructor(service: ConnectIQService, timeout?: number, timeout_callback?: () => Promise<void>) {
        super(service);
        this._timeout = timeout ?? this.DEFAULT_TIMEOUT;
        this._timeoutCallback = timeout_callback;
    }

    public IsTimedOut(): boolean {
        return this._started != undefined && this._started < Date.now() - this._timeout * 1000;
    }

    public override async addListener(): Promise<void> {
        this._started = Date.now();
        return super.addListener();
    }

    public async TimedOut(): Promise<void> {
        if (this._timeoutCallback) {
            return this._timeoutCallback();
        }
        this._service.removeListener(this);
    }
}
