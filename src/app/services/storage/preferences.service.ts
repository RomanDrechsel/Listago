import { Injectable } from "@angular/core";
import { Preferences } from "@capacitor/preferences";
import { BehaviorSubject } from "rxjs";

export enum EPrefProperty {
    "FirstStart" = "LISTS_FirstStart",
    "LastVersion" = "LISTS_LastVersion",
    "GarminConnectIQ" = "LISTS_GarminConnectIQ",
    "AppLanguage" = "LISTS_AppLanguage",
    "LogMode" = "LISTS_LogMode",
    "LogsAutoDelete" = "LISTS_LogsAutoDelete",
    "Animations" = "LISTS_Animations",
    "AlwaysTransmitTo" = "LISTS_AlwaysTransmitTo",
    "ConfirmDeleteList" = "LISTS_ConfirmDeleteList",
    "ConfirmDeleteListitem" = "LISTS_ConfirmDeleteListitem",
    "ConfirmEmptyList" = "LISTS_ConfirmEmptyList",
    "ConfirmTransmitList" = "LISTS_ConfirmTransmitList",
    "ConfirmEraseList" = "LISTS_ConfirmEraseList",
    "ConfirmEraseListitem" = "LISTS_ConfirmEraseListitem",
    "ConfirmEmptyTrash" = "LISTS_ConfirmEmptyTrash",
    "ConfirmRestoreList" = "LISTS_ConfirmRestoreList",
    "ConfirmRestoreListitem" = "LISTS_ConfirmRestoreListitem",
    "TrashLists" = "LISTS_TrashLists",
    "TrashListitems" = "LISTS_TrashListitems",
    "TrashKeepinStock" = "LISTS_TrashKeepInStock",
    "OpenAppOnTransmit" = "LISTS_OpenAppOnTransmit",
    "DeleteListOnDevice" = "LISTS_DeleteListOnDevice",
    "SyncListOnDevice" = "LISTS_SyncListOnDevice",
    "AddMoreItemsDialog" = "LISTS_AddMoreItemsDialog",
    "DebugSimulator" = "LISTS_DebugSimulator",
    "DebugApp" = "LISTS_DebugApp",
    "OpenedList" = "LISTS_OpenedList",
    "IgnoreWatchOutdated" = "LISTS_IgnoreWatchOutdated",
    "AdmobBannerHeight" = "LISTS_AdmobBannerHeight",
}

@Injectable({
    providedIn: "root",
})
export class PreferencesService {
    private onPrefChangedSubject = new BehaviorSubject<{ prop: EPrefProperty; value: any }>({ prop: EPrefProperty.LogMode, value: "" });
    public onPrefChanged$ = this.onPrefChangedSubject.asObservable();

    /**
     * stores a value in preferences
     * @param prop property
     * @param value value
     */
    public async Set(prop: EPrefProperty, value: any) {
        if (value != undefined && value != null) {
            await Preferences.set({ key: prop, value: JSON.stringify(value) });
        } else {
            await Preferences.remove({ key: prop });
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
        let pref = await Preferences.get({ key: prop });
        if (pref.value) {
            try {
                return JSON.parse(pref.value);
            } catch {}
        }

        return default_value;
    }

    /**
     * removes a value from preferences
     * @param prop property
     */
    public async Remove(prop: EPrefProperty) {
        await Preferences.remove({ key: prop });
    }
}
