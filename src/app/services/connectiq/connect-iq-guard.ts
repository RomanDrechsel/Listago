import { inject, Injectable } from "@angular/core";
import { CanActivate } from "@angular/router";
import { ConnectIQService } from "./connect-iq.service";

@Injectable({
    providedIn: "root",
})
export class ConnectIQGuard implements CanActivate {
    private readonly ConnectIQ = inject(ConnectIQService);

    public async canActivate(): Promise<boolean> {
        return this.ConnectIQ.Initialized;
    }
}
