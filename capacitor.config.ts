import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

const config: CapacitorConfig = {
    appId: "de.romandrechsel.listago",
    appName: "Listago",
    webDir: "www",
    loggingBehavior: "debug",
    zoomEnabled: false,
    plugins: {
        SplashScreen: {
            launchShowDuration: 1000,
            launchAutoHide: false,
            launchFadeOutDuration: 500,
            backgroundColor: "#008DF5FF",
            androidSplashResourceName: "splash",
            androidScaleType: "CENTER_CROP",
            showSpinner: false,
            splashFullScreen: true,
            splashImmersive: true,
            layoutName: "launch_screen",
            useDialog: true,
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
            backgroundColor: "#0077ff",
        },
    },
};

export default config;
