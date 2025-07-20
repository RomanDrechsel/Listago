import { inject, Injectable } from "@angular/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { NavController } from "@ionic/angular/standalone";
import { AppComponent } from "src/app/app.component";
import { FileUtils } from "src/app/classes/utils/file-utils";
import type { FirstStartPage } from "src/app/pages/first-start/first-start.page";
import SysInfo from "src/app/plugins/sysinfo/sys-info";
import { Logger } from "../logging/logger";
import { PopupsService } from "../popups/popups.service";

@Injectable({
    providedIn: "root",
})
export class IntentsService {
    private readonly _navControler = inject(NavController);
    private readonly _popups = inject(PopupsService);
    private _firstStartPage?: FirstStartPage;

    public set FirstStartPage(page: FirstStartPage | undefined) {
        this._firstStartPage = page;
    }

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

    public async gotoImportAfterIntent(args: { importUri: string; replaceUrl?: boolean }): Promise<void> {
        Logger.Notice(`Starting import from '${args.importUri}' due to SEND intent...`);
        await this._navControler.navigateForward("settings/import", { animated: true, queryParams: { importFile: args.importUri }, replaceUrl: args.replaceUrl });
        AppComponent.Instance?.CloseMenu();
    }

    private async handleListsImport(intent: Intent): Promise<void> {
        Logger.Notice(`Received Lists export intent...`);

        const filepath = intent.extras?.["android.intent.extra.STREAM"];
        if (!filepath) {
            Logger.Error(`No file found in SEND intent.`, intent);
            this.errorListsImport();
            return;
        }

        try {
            await Filesystem.stat({ path: filepath });
        } catch (e) {
            Logger.Error(`File not found in SEND intent.`, filepath);
            this.errorListsImport();
            return;
        }

        const create = await FileUtils.MkDir("import", Directory.Cache);
        if (!create) {
            Logger.Error(`Could not import '${filepath}'...`);
            this.errorListsImport();
            return;
        }

        let importUri = undefined;
        try {
            const res = await Filesystem.copy({ from: filepath, to: "import/lists-export.zip", toDirectory: Directory.Cache });
            importUri = res.uri;
        } catch (e) {
            Logger.Error(`Failed to copy file from ${intent.extras["android.intent.extra.STREAM"]} to '"import/lists-export.zip"' in ''${Directory.Cache}': `, e);
            this.errorListsImport();
            return;
        }

        try {
            await Filesystem.deleteFile({ path: filepath });
        } catch (e) {
            Logger.Error(`Failed to delete file '${filepath}' from SEND intent.`, e);
        }

        if (importUri) {
            if (this._firstStartPage) {
                this._firstStartPage.StartImport = importUri;
            } else {
                await this.gotoImportAfterIntent({ importUri: importUri });
            }
        }
    }

    private errorListsImport() {
        this._popups.Toast.Error("service-intents.import_failed", undefined, true);
    }
}

type Intent = {
    action: string;
    type: string;
    extras: any;
};
