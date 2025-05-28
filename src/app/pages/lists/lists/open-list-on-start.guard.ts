import { inject, Injectable } from "@angular/core";
import { type CanActivate, Router } from "@angular/router";
import { EPrefProperty, PreferencesService } from "src/app/services/storage/preferences.service";

@Injectable({
    providedIn: "root",
})
export class OpenListOnStartGuard implements CanActivate {
    private readonly _router = inject(Router);
    private readonly _preferences = inject(PreferencesService);
    private static _check = false;

    public async canActivate(): Promise<boolean> {
        if (!OpenListOnStartGuard._check) {
            OpenListOnStartGuard._check = true;
            const openend_list = await this._preferences.Get(EPrefProperty.OpenedList, undefined);
            if (openend_list) {
                this._router.navigateByUrl(`/lists/items/${openend_list}`, { replaceUrl: false });
                return false;
            }
        }
        return true;
    }
}
