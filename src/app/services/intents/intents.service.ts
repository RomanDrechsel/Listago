import { Injectable } from "@angular/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import SysInfo from "src/app/plugins/sysinfo/sys-info";
import { Logger } from "../logging/logger";

@Injectable({
    providedIn: "root",
})
export class IntentsService {
    public Initialize() {
        SysInfo.addListener("INTENT", (intent: Intent) => this.onIntent(intent));
    }

    public async onIntent(intent: Intent): Promise<void> {
        if (intent.action == "android.intent.action.SEND" && intent.type == "application/zip") {
            if (intent.extras?.request == "export-from-lists") {
                await this.handleListsImport(intent);
            } else {
                Logger.Error(`Received invalid SEND intent.`, intent);
            }
        } else {
            Logger.Error(`Received invalid Intent: `, intent);
        }
    }

    private async handleListsImport(intent: Intent): Promise<void> {
        Logger.Notice(`Received Lists export intent...`);

        const filepath = intent.extras?.["android.intent.extra.STREAM"];
        if (!filepath) {
            Logger.Error(`No file found in SEND intent.`, intent);
            return;
        }

        try {
            await Filesystem.stat({ path: filepath });
        } catch (e) {
            Logger.Error(`File not found in SEND intent.`, filepath);
            return;
        }

        try {
            await Filesystem.stat({ path: "import", directory: Directory.Cache });
        } catch (e) {
            Logger.Error(`Could not create directory 'import' in '${Directory.Cache}': `, e);
            return;
        }

        try {
            await Filesystem.copy({ from: filepath, to: "import/lists-export.zip", toDirectory: Directory.Cache });
            //TODO: remove filepath
        } catch (error) {
            Logger.Error(`Failed to copy file from ${intent.extras["android.intent.extra.STREAM"]} to /lists-export.zip`, error);
        }
    }
}

type Intent = {
    action: string;
    type: string;
    extras: any;
};
