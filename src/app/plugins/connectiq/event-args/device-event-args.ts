export type DeviceEventArgs = {
    id: number;
    name: string;
    state: "Initializing" | "Ready" | "AppNotInstalled" | "CheckingApp" | "NotConnected" | "ConnectionLost" | "NotPaired" | "InvalidState" | "ServiceUnavailable";
    version?: number;
};
