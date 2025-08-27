export type AppUpdateInfo = {
    currentVersionCode: number;
    availableVersionCode: number;
    updateAvailable: boolean;
    flexibleUpdateAllowed: boolean;
    installStatus: number;
};

export type AppUpdateInfoError = {
    error: string;
};
