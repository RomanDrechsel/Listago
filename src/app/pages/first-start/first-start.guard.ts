import { inject, Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { EPrefProperty, PreferencesService } from "../../services/storage/preferences.service";

@Injectable({
    providedIn: "root",
})
export class FirstStartGuard implements CanActivate {
    private readonly _router = inject(Router);
    private readonly Preferences = inject(PreferencesService);

    private _firststart?: boolean = undefined;

    public async canActivate(): Promise<boolean> {
        if (this._firststart === undefined) {
            const first_start = await this.Preferences.Get(EPrefProperty.FirstStart, undefined);
            if (first_start !== false) {
                this._firststart = true;
            } else {
                this._firststart = false;
            }
        }
        if (this._firststart) {
            this._router.navigateByUrl("/first-start", { replaceUrl: true });
            this._firststart = false;
            return false;
        } else {
            return true;
        }
    }
}
