import { ConnectIQDevice } from "../app/services/connectiq/connect-iq-device";
import { ConnectIQService } from "../app/services/connectiq/connect-iq.service";

export const environment = {
    production: true,
    publicRelease: true,
};

export const DebugDevices = function (service: ConnectIQService): ConnectIQDevice[] {
    return [];
};
