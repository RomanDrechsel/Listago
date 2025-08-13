import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { type Translation, type TranslocoLoader } from "@jsverse/transloco";

@Injectable({ providedIn: "root" })
export class HttpLoader implements TranslocoLoader {
    private _http = inject(HttpClient);

    public getTranslation(langPath: string, zweite: any) {
        return this._http.get<Translation>(`/assets/i18n/${langPath}.json`);
    }
}
