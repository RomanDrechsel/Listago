export type AppUpdateInfo = {
    currentVersionCode: number;
    availableVersionCode: number;
    updateAvailable: boolean;
    flexibleUpdateAllowed: boolean;
};

export type AppUpdateInfoError = {
    error: string;
};
