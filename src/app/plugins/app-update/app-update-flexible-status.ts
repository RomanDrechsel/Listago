export type AppUpdateFlexibleStatus = {
    installStatus: number;
    bytesDownloaded?: number;
    totalBytesToDownload?: number;
};

export enum AppUpdateFlexibleInstallStatus {
    Unknown = 0,
    Pending = 1,
    Downloading = 2,
    Installing = 3,
    Installed = 4,
    Failed = 5,
    Canceled = 6,
    Downloaded = 11,
}
