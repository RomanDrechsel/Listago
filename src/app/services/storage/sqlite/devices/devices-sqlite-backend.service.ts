import { inject, Injectable } from "@angular/core";
import type { ConnectIQDevice } from "src/app/services/connectiq/connect-iq-device";
import { MainUpgradeStatements } from "../main-upgrade-statments";
import { SqliteService } from "../sqlite.service";

@Injectable({
    providedIn: "root",
})
export class DevicesSqliteBackendService {
    private readonly _sqliteService = inject(SqliteService);
    private readonly _devices_are_old = 60 * 60 * 24 * 30 * 1000;

    public async Initialize(): Promise<boolean> {
        await this._sqliteService.addUpgradeStatement(MainUpgradeStatements());
        const db = await this._sqliteService.openDatabase();
        if (db) {
            return true;
        } else {
            return false;
        }
    }

    public async DeviceOnline(device: ConnectIQDevice): Promise<void> {
        const query = "REPLACE INTO `devices` (`id`, `name`, `last_online`) VALUES (?, ?, ?)";
        await this._sqliteService.Execute(query, [device.Identifier, device.Name, Date.now()]);
    }

    public async GetOldDeviceIds(): Promise<{ id: number; name: string }[]> {
        const query = "SELECT `id`, `name` FROM `devices` WHERE `last_online` < ?";
        const res = await this._sqliteService.Query(query, [Date.now() - this._devices_are_old]);
        if (Array.isArray(res) && res.length > 0) {
            return res.map((row: any) => {
                return { id: Number(row.id), name: row.name };
            });
        }
        return [];
    }
}
