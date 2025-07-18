import { inject, Injectable } from "@angular/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { NavController } from "@ionic/angular/standalone";
import SysInfo from "src/app/plugins/sysinfo/sys-info";
import { Logger } from "../logging/logger";

@Injectable({
    providedIn: "root",
})
export class IntentsService {
    private readonly _navControler = inject(NavController);

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

        let importUri = undefined;
        try {
            const res = await Filesystem.copy({ from: filepath, to: "import/lists-export.zip", toDirectory: Directory.Cache });
            importUri = res.uri;
        } catch (e) {
            Logger.Error(`Failed to copy file from ${intent.extras["android.intent.extra.STREAM"]} to '"import/lists-export.zip"' in ''${Directory.Cache}': `, e);
        }

        try {
            //TODO: uncomment
            //await Filesystem.deleteFile({ path: filepath });
        } catch (e) {
            Logger.Error(`Failed to delete file '${filepath}' from SEND intent.`, e);
        }

        if (importUri) {
            Logger.Notice(`Starting import from '${importUri}' due to SEND intent...`);
            this._navControler.navigateForward("settings/import", { animated: true, queryParams: { importFile: importUri } });
        }
    }
}

type Intent = {
    action: string;
    type: string;
    extras: any;
};
