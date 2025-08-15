import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { type Translation, type TranslocoLoader } from "@jsverse/transloco";
import { asyncScheduler, type Observable, scheduled } from "rxjs";

@Injectable({ providedIn: "root" })
export class HttpLoader implements TranslocoLoader {
    private _http = inject(HttpClient);

    public getTranslation(langPath: string): Observable<Translation> {
        if (langPath.length > 3) {
            return this._http.get<Translation>(`/assets/i18n/${langPath}.json`);
        }
        return scheduled([{}], asyncScheduler);
    }
}
