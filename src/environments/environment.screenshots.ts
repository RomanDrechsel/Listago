import { ConnectIQDevice } from "../app/services/connectiq/connect-iq-device";
import { ConnectIQService } from "../app/services/connectiq/connect-iq.service";
import { Locale } from "../app/services/localization/locale";

export const environment = {
    production: false,
    publicRelease: false,
};

export const DebugDevices = function(service: ConnectIQService): ConnectIQDevice[] {
    return [ConnectIQDevice.FromEventArgs({ id: 123456789, name: Locale.currentLang().localeFile == "de" ? "Mandy's Uhr" : "Mandy's watch", state: "Ready" }, service)];
};
