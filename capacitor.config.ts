import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

const config: CapacitorConfig = {
    appId: "de.romandrechsel.listago",
    appName: "Listago",
    webDir: "www",
    loggingBehavior: "debug",
    zoomEnabled: false,
    initialFocus: true,
    plugins: {
        SplashScreen: {
            launchShowDuration: 1000,
            launchAutoHide: true,
            launchFadeOutDuration: 500,
            backgroundColor: "#E6F0FA",
            androidSplashResourceName: "splash",
            androidScaleType: "CENTER_CROP",
            showSpinner: false,
            splashFullScreen: true,
            splashImmersive: true,
            layoutName: "launch_screen",
            useDialog: false,
        },
        StatusBar: {
            overlaysWebView: true,
        },
        Keyboard: {
            resize: KeyboardResize.Body,
            style: KeyboardStyle.Default,
            resizeOnFullScreen: false,
        },
        EdgeToEdge: {
            backgroundColor: "#ffffff",
        },
        CapacitorSQLite: {
            androidIsEncryption: false,
            androidBiometric: {
                biometricAuth: false,
            },
        },
    },
};

export default config;
