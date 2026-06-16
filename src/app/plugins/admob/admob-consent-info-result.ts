export type AdmobConsentInfoResult = {
    canRequestAds: boolean;
    privacyOptionsRequired: boolean;
    status: "REQUIRED" | "NOT_REQUIRED" | "OBTAINED" | "UNKNOWN" | "ERROR";
};
