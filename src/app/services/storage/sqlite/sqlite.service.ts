import { Injectable } from "@angular/core";
import { CapacitorSQLite, type CapacitorSQLitePlugin, type capSQLiteUpgradeOptions, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Logger } from "../../logging/logger";

@Injectable({
    providedIn: "root",
})
export class SqliteService {
    private readonly _sqlitePlugin!: CapacitorSQLitePlugin;

    private _sqliteConnection!: SQLiteConnection;

    constructor() {
        this._sqlitePlugin = CapacitorSQLite;
        this._sqliteConnection = new SQLiteConnection(this._sqlitePlugin);
    }

    public async addUpgradeStatement(options: capSQLiteUpgradeOptions): Promise<void> {
        await this._sqlitePlugin.addUpgradeStatement(options);
    }

    public async openDatabase(dbName: string, encrypted: boolean, mode: string, version: number, readonly: boolean = false): Promise<SQLiteDBConnection | undefined> {
        try {
            const res_version = await this._sqlitePlugin.getVersion({ database: dbName });
            await this._sqlitePlugin.echo({ value: "Version: " + res_version.version });
            const res_tables = await this._sqlitePlugin.getTableList({ database: dbName });
            await this._sqlitePlugin.echo({ value: JSON.stringify(res_tables.values) });
        } catch {}

        let db: SQLiteDBConnection | undefined;
        try {
            const retCC = (await this._sqliteConnection.checkConnectionsConsistency()).result;
            let isConn = (await this._sqliteConnection.isConnection(dbName, readonly)).result;
            if (retCC && isConn) {
                db = await this._sqliteConnection.retrieveConnection(dbName, readonly);
            } else {
                db = await this._sqliteConnection.createConnection(dbName, encrypted, mode, version, readonly);
            }
            await db.open();
        } catch (e) {
            Logger.Error(`Could not create sqlite connection: `, e);
        }
        return db;
    }

    public async removeDatabase(dbName: string) {
        try {
            await this._sqlitePlugin.deleteDatabase({ database: dbName, readonly: false });
        } catch (e) {}
    }
}
