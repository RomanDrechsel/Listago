import { Injectable } from "@angular/core";
import { Preferences } from "@capacitor/preferences";
import { BehaviorSubject } from "rxjs";
import { ProgressListener } from "src/app/services/storage/lists/import/lists-importer";
import { Logger } from "../logging/logger";

export enum EPrefProperty {
    FirstStart = "LISTAGO_FirstStart",
    LastVersion = "LISTAGO_LastVersion",
    GarminConnectIQ = "LISTAGO_GarminConnectIQ",
    AppLanguage = "LISTAGO_AppLanguage",
    LogMode = "LISTAGO_LogMode",
    LogsAutoDelete = "LISTAGO_LogsAutoDelete",
    Animations = "LISTAGO_Animations",
    AlwaysTransmitTo = "LISTAGO_AlwaysTransmitTo",
    ConfirmDeleteList = "LISTAGO_ConfirmDeleteList",
    ConfirmDeleteListitem = "LISTAGO_ConfirmDeleteListitem",
    ConfirmEmptyList = "LISTAGO_ConfirmEmptyList",
    ConfirmTransmitList = "LISTAGO_ConfirmTransmitList",
    ConfirmEraseList = "LISTAGO_ConfirmEraseList",
    ConfirmEraseListitem = "LISTAGO_ConfirmEraseListitem",
    ConfirmEmptyTrash = "LISTAGO_ConfirmEmptyTrash",
    ConfirmRestoreList = "LISTAGO_ConfirmRestoreList",
    ConfirmRestoreListitem = "LISTAGO_ConfirmRestoreListitem",
    TrashLists = "LISTAGO_TrashLists",
    TrashListitems = "LISTAGO_TrashListitems",
    TrashKeepinStock = "LISTAGO_TrashKeepInStock",
    OpenAppOnTransmit = "LISTAGO_OpenAppOnTransmit",
    DeleteListOnDevice = "LISTAGO_DeleteListOnDevice",
    SyncListOnDevice = "LISTAGO_SyncListOnDevice",
    AddMoreItemsDialog = "LISTAGO_AddMoreItemsDialog",
    DebugSimulator = "LISTAGO_DebugSimulator",
    DebugApp = "LISTAGO_DebugApp",
    OpenedList = "LISTAGO_OpenedList",
    IgnoreWatchOutdated = "LISTAGO_IgnoreWatchOutdated",
    AdmobBannerHeight = "LISTAGO_AdmobBannerHeight",
}

@Injectable({
    providedIn: "root",
})
export class PreferencesService {
    private onPrefChangedSubject = new BehaviorSubject<{ prop: EPrefProperty; value: any }>({ prop: EPrefProperty.LogMode, value: "" });
    public onPrefChanged$ = this.onPrefChangedSubject.asObservable();

    private _prefsCache = new Map<EPrefProperty, any>();

    /**
     * stores a value in preferences
     * @param prop property
     * @param value value
     */
    public async Set(prop: EPrefProperty, value: any) {
        if (value != undefined && value != null) {
            await Preferences.set({ key: prop, value: JSON.stringify(value) });
            this._prefsCache.set(prop, value);
        } else {
            await Preferences.remove({ key: prop });
            this._prefsCache.delete(prop);
        }
        this.onPrefChangedSubject.next({ prop: prop, value: value });
    }

    /**
     * gets a value from preferences
     * @param prop property
     * @param default_value default value, if the property doesn't exist in preferences
     * @returns value from preferences or default_value
     */
    public async Get<T>(prop: EPrefProperty, default_value: T): Promise<T> {
        if (this._prefsCache.has(prop)) {
            return this._prefsCache.get(prop) as T;
        }

        let pref = await Preferences.get({ key: prop });
        if (pref.value) {
            try {
                const parsed = JSON.parse(pref.value);
                this._prefsCache.set(prop, parsed);
                return parsed;
            } catch {}
        }

        return default_value;
    }

    /**
     * removes a value from preferences
     * @param prop property
     */
    public async Remove(prop: EPrefProperty) {
        this._prefsCache.delete(prop);
        await Preferences.remove({ key: prop });
    }

    /**
     * import app settings from a json object
     * @param json json object
     * @returns true is import was successfull, false otherwise
     */
    public async Import(json?: { [key: string]: any }, listener?: ProgressListener): Promise<boolean> {
        if (json) {
            const ignore = ["FirstStart", "LastVersion", "DebugSimulator", "DebugApp", "OpenedList"];

            const json_keys = Object.keys(json);
            listener?.Init(json_keys.length);

            const imported: string[] = [];
            const pref_keys = Object.keys(EPrefProperty);

            for await (const key of Object.keys(json)) {
                if (!ignore.includes(key)) {
                    if (pref_keys.includes(key)) {
                        const val = json[key];
                        await this.Set(EPrefProperty[key as keyof typeof EPrefProperty], val);
                        imported.push(key);
                        listener?.oneSuccess();
                    } else {
                        listener?.oneFailed();
                    }
                }
                listener?.oneDone();
            }
            if (imported.length > 0) {
                Logger.Debug(`Imported ${imported.length} settings:`, imported);
            }

            return true;
        }
        return false;
    }
}
