import { Injectable } from "@angular/core";
import { CapacitorSQLite, type CapacitorSQLitePlugin, type capSQLiteChanges, type capSQLiteUpgradeOptions, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Mutex } from "async-mutex";
import { Logger } from "../../logging/logger";

@Injectable({
    providedIn: "root",
})
export class SqliteService {
    public static readonly DatabaseNameMain = "main";
    private static readonly _databaseVersion = 1;

    private readonly _sqlitePlugin: CapacitorSQLitePlugin;
    private _sqliteConnection: SQLiteConnection;
    private _mainDatabaseConnection?: SQLiteDBConnection;

    private readonly _databaseMutex = new Mutex();

    constructor() {
        this._sqlitePlugin = CapacitorSQLite;
        this._sqliteConnection = new SQLiteConnection(this._sqlitePlugin);
    }

    public async addUpgradeStatement(options: capSQLiteUpgradeOptions): Promise<void> {
        await this._sqlitePlugin.addUpgradeStatement(options);
    }

    public async openDatabase(): Promise<SQLiteDBConnection | undefined> {
        try {
            if (this._mainDatabaseConnection) {
                if ((await this._mainDatabaseConnection.isDBOpen()).result) {
                    return this._mainDatabaseConnection;
                } else {
                    await this._mainDatabaseConnection.close();
                }
            }
        } catch {}

        this._mainDatabaseConnection = undefined;
        Logger.Debug(`Opening backend connection to '${SqliteService.DatabaseNameMain}' ...`);

        try {
            const res_version = await this._sqlitePlugin.getVersion({ database: SqliteService.DatabaseNameMain });
            Logger.Debug(`Using main backend version '${res_version.version}'`);
            const res_tables = await this._sqlitePlugin.getTableList({ database: SqliteService.DatabaseNameMain });
            Logger.Debug(`Found backend tables: ${JSON.stringify(res_tables.values)}`);
        } catch {}

        try {
            const retCC = (await this._sqliteConnection.checkConnectionsConsistency()).result;
            let isConn = (await this._sqliteConnection.isConnection(SqliteService.DatabaseNameMain, false)).result;
            if (retCC && isConn) {
                this._mainDatabaseConnection = await this._sqliteConnection.retrieveConnection(SqliteService.DatabaseNameMain, false);
            } else {
                this._mainDatabaseConnection = await this._sqliteConnection.createConnection(SqliteService.DatabaseNameMain, false, "no-encryption", SqliteService._databaseVersion, false);
            }
            await this._mainDatabaseConnection.open();
        } catch (e) {
            Logger.Error(`Could not create sqlite connection: `, e);
        }
        return this._mainDatabaseConnection;
    }

    public async Query(sql: string, params?: any[]): Promise<any> {
        return await this._databaseMutex.runExclusive(async () => {
            if (!(await this.CheckConnection())) {
                return undefined;
            }
            try {
                return (await this._mainDatabaseConnection!.query(sql, params)).values;
            } catch (e) {
                Logger.Error(`Database query failed: ${sql}`, e);
            }
            if (this._mainDatabaseConnection && !(await this._mainDatabaseConnection.isDBOpen()).result) {
                try {
                    await this._mainDatabaseConnection.close();
                } catch {}
                this._mainDatabaseConnection = undefined;
            }
            return undefined;
        });
    }

    public async Execute(sql: string, params?: any[]): Promise<capSQLiteChanges | undefined> {
        return await this._databaseMutex.runExclusive(async () => {
            if (!(await this.CheckConnection())) {
                return undefined;
            }
            try {
                return await this._mainDatabaseConnection!.run(sql, params);
            } catch (e) {
                Logger.Error(`Database execute failed: ${sql}`, e);
            }
            if (this._mainDatabaseConnection && !(await this._mainDatabaseConnection.isDBOpen()).result) {
                try {
                    await this._mainDatabaseConnection.close();
                } catch {}
                this._mainDatabaseConnection = undefined;
            }
            return undefined;
        });
    }

    public async Transaction(callback: (connection: SQLiteDBConnection) => Promise<any>): Promise<any> {
        return await this._databaseMutex.runExclusive(async () => {
            if (!(await this.CheckConnection())) {
                return false;
            }
            try {
                if ((await this._mainDatabaseConnection!.isTransactionActive()).result) {
                    Logger.Error(`Rollback old transaction in 'SqliteService.Transaction()'`);
                    await this._mainDatabaseConnection!.rollbackTransaction();
                }

                await this._mainDatabaseConnection!.beginTransaction();
                if (!(await this._mainDatabaseConnection!.isTransactionActive()).result) {
                    Logger.Error(`Could not start sql transaction in 'SqliteService.Transaction()'`);
                    return false;
                }
                const ret = await callback(this._mainDatabaseConnection!);
                await this._mainDatabaseConnection!.commitTransaction();
                return ret;
            } catch (e) {
                await this._mainDatabaseConnection!.rollbackTransaction();
                Logger.Error(`Database transaction failed: `, e);
            }
            return false;
        });
    }

    private async CheckConnection(): Promise<boolean> {
        if (this._mainDatabaseConnection) {
            return true;
        }
        Logger.Error(`No SQLite connection available. Retrying connection...`);
        return (await this.openDatabase()) !== undefined;
    }
}
