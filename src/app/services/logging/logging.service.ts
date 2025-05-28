import { formatDate } from "@angular/common";
import { Injectable, isDevMode } from "@angular/core";
import { Directory, Encoding, FileInfo, Filesystem } from "@capacitor/filesystem";
import { FileUtils } from "src/app/classes/utils/file-utils";
import SysInfo from "src/app/plugins/sysinfo/sys-info";
import { StringUtils } from "../../classes/utils/string-utils";
import { EPrefProperty, PreferencesService } from "../storage/preferences.service";

enum ELogType {
    Debug = 4,
    Notice = 3,
    Important = 2,
    Error = 1,
}
export enum EAutoDelete {
    Day = 1,
    Week = 7,
    Month = 30,
}

@Injectable({
    providedIn: "root",
})
export class LoggingService {
    /** when to delete old logs */
    public AutoDelete: EAutoDelete = EAutoDelete.Month;
    /** path to store logs on device */
    public static LogPath = "logs";
    /** capacitor directory to store logs in */
    public static LogDirectory = Directory.Data;
    /** Log level */
    public LogLevel = ELogType.Debug;
    /** current logfile, messages are stored in */
    private LogFile: string;
    /** pending messages to be stored in the logfile */
    private WriteToLogQueue: string[] = [];
    /** pending messages queue is currently processed */
    private LogfileProcessRunning = false;

    constructor(private Preferences: PreferencesService) {
        let date = formatDate(new Date(), "yyyy-MM-dd_HHmmss", "en");
        this.LogFile = `${LoggingService.LogPath}/${date}.log`;
        this.LogLevel = isDevMode() ? 4 : 2;
    }

    /**
     * gets the representation of the log level as string
     */
    public get LogLevelShort(): string {
        switch (this.LogLevel) {
            case 4:
                return "debug";
            case 3:
                return "verbose";
            default:
            case 2:
                return "normal";
            case 1:
                return "error";
        }
    }

    /**
     * Initialize service
     */
    public async Initialize() {
        this.LogLevel = await this.Preferences.Get<ELogType>(EPrefProperty.LogMode, this.LogLevel);
        const autodelete = await this.Preferences.Get(EPrefProperty.LogsAutoDelete, this.AutoDelete);
        await this.SetAutodelete(autodelete);
        this.Debug("Logging initialized");
    }

    /**
     * log an error message
     * @param message message text
     * @param obj additional objects
     */
    public Error(message: string, ...objs: any[]) {
        this.WriteInLogfile(message, ELogType.Error, ...objs);
        console.error(message, ...objs);
        this.Logcat(message, ELogType.Error, ...objs);
    }

    /**
     * log an error message without logcat entry
     * @param message message text
     * @param objs additional objects
     */
    public ErrorNoLogcat(message: string, ...objs: any[]) {
        this.WriteInLogfile(message, ELogType.Error, ...objs);
        console.error(message, ...objs);
    }

    /**
     * log a important message
     * @param message message text
     * @param objs additional objects
     */
    public Important(message: string, ...objs: any[]) {
        if (this.LogLevel >= ELogType.Important) {
            this.WriteInLogfile(message, ELogType.Important, ...objs);
            console.warn(message, ...objs);
            this.Logcat(message, ELogType.Important, ...objs);
        }
    }

    /**
     * log an important message without logcat entry
     * @param message message text
     * @param objs additional objects
     */
    public ImportantNoLogcat(message: string, ...objs: any[]) {
        if (this.LogLevel >= ELogType.Important) {
            this.WriteInLogfile(message, ELogType.Important, ...objs);
            console.warn(message, ...objs);
        }
    }

    /**
     * log a notice message
     * @param message message text
     * @param obj additional objects
     */
    public Notice(message: string, ...objs: any[]) {
        if (this.LogLevel >= ELogType.Notice) {
            this.WriteInLogfile(message, ELogType.Notice, ...objs);
            console.info(message, ...objs);
            this.Logcat(message, ELogType.Notice, ...objs);
        }
    }

    /**
     * log a notice message without logcat entry
     * @param message message text
     * @param objs additional objects
     */
    public NoticeNoLogcat(message: string, ...objs: any[]) {
        if (this.LogLevel >= ELogType.Notice) {
            this.WriteInLogfile(message, ELogType.Notice, ...objs);
            console.info(message, ...objs);
        }
    }

    /**
     * log a debug message
     * @param message message text
     * @param obj additional objects
     */
    public Debug(message: string, ...objs: any[]) {
        if (this.LogLevel >= ELogType.Debug) {
            this.WriteInLogfile(message, ELogType.Debug, ...objs);
            console.log(message, ...objs);
            this.Logcat(message, ELogType.Debug, ...objs);
        }
    }

    /**
     * log a debug message without logcat entry
     * @param message message text
     * @param objs additional objects
     */
    public DebugNoLogcat(message: string, ...objs: any[]) {
        if (this.LogLevel >= ELogType.Debug) {
            this.WriteInLogfile(message, ELogType.Debug, ...objs);
            console.log(message, ...objs);
        }
    }

    /**
     * log a debug message
     * @param message message text
     * @param obj additional objects
     */
    public Console(message: string, ...objs: any[]) {
        if (this.LogLevel >= ELogType.Debug && isDevMode()) {
            console.log(message, ...objs);
        }
    }

    /**
     * writes a logcat entry to android
     * @param message message text
     * @param type logcat type
     * @param objs additional objects
     */
    public async Logcat(message: string, type: ELogType, ...objs: any[]) {
        if (objs.length > 0) {
            objs.forEach(obj => {
                if (obj) {
                    if (obj instanceof Error) {
                        message += "\nError: " + obj.name;
                        message += "\nMessage: " + obj.message;
                        if (obj.stack) {
                            message += "\nStacktrace:\n" + obj.stack;
                        }
                    } else {
                        message += "\n" + StringUtils.toString(obj);
                    }
                }
            });
        }
        let logcat_level: "d" | "n" | "i" | "e" = "d";
        switch (type) {
            case ELogType.Debug:
                logcat_level = "d";
                break;
            case ELogType.Notice:
                logcat_level = "n";
                break;
            case ELogType.Important:
                logcat_level = "i";
                break;
            case ELogType.Error:
                logcat_level = "e";
                break;
        }

        await SysInfo.Logcat({ level: logcat_level, message: message });
    }

    /**
     * process the pending messages queue
     */
    private async ProcessQueue() {
        if (this.LogfileProcessRunning) {
            return;
        }
        this.LogfileProcessRunning = true;
        if (this.WriteToLogQueue.length > 0) {
            //Log-Datei erstellen, falls nicht vorhanden
            if (!(await FileUtils.FileExists(this.LogFile, LoggingService.LogDirectory))) {
                let loglevel: string;
                switch (this.LogLevel) {
                    case ELogType.Error:
                        loglevel = "only errors";
                        break;
                    case ELogType.Important:
                        loglevel = "normal";
                        break;
                    case ELogType.Notice:
                        loglevel = "verbose";
                        break;
                    default:
                        loglevel = "debug";
                        break;
                }
                try {
                    const date = formatDate(new Date(), "yyyy-MM-ddTHH:mm:ss.SSS", "en");
                    await Filesystem.writeFile({
                        path: this.LogFile,
                        data: `${date} Log-Level: ${loglevel}\n`,
                        directory: LoggingService.LogDirectory,
                        encoding: Encoding.UTF8,
                        recursive: true,
                    });
                } catch (e) {
                    console.error("Could not write log", e);
                }
            }

            while (this.WriteToLogQueue.length > 0) {
                const message = this.WriteToLogQueue.shift();
                try {
                    //In Log-Datei schreiben
                    await Filesystem.appendFile({
                        path: this.LogFile,
                        data: message + "\n",
                        directory: LoggingService.LogDirectory,
                        encoding: Encoding.UTF8,
                    });
                } catch (e) {
                    console.error("Could not write log", e);
                }
            }
        }
        this.LogfileProcessRunning = false;
    }

    /**
     * writes a message to message queue
     * @param message message text
     * @param type message level
     * @param objs additional objects
     */
    private WriteInLogfile(message: string, type?: ELogType, ...objs: any[]) {
        let date = formatDate(new Date(), "yyyy-MM-ddTHH:mm:ss.SSS", "en");
        let prefix: string = "";
        switch (type) {
            case ELogType.Error:
                prefix = "[E]";
                break;
            case ELogType.Important:
                prefix = "[I]";
                break;
            case ELogType.Notice:
                prefix = "[N]";
                break;
            case ELogType.Debug:
                prefix = "[D]";
                break;
        }

        message = `${prefix}${date}: ${message}`;
        if (objs.length > 0) {
            objs.forEach(obj => {
                if (obj) {
                    if (obj instanceof Error) {
                        message += "\nError: " + obj.name;
                        message += "\nMessage: " + obj.message;
                        if (obj.stack) {
                            message += "\nStacktrace:\n" + obj.stack;
                        }
                    } else {
                        message += "\n" + StringUtils.toString(obj);
                    }
                }
            });
        }

        this.WriteToLogQueue.push(message);
        this.ProcessQueue();
    }

    /**
     * sets the loglevel from a string representation
     * @param logging log level
     */
    public async SetLogLevel(logging: string) {
        if (this.LogLevelShort != logging) {
            switch (logging) {
                case "debug":
                    this.LogLevel = ELogType.Debug;
                    break;
                case "verbose":
                    this.LogLevel = ELogType.Notice;
                    break;
                case "normal":
                    this.LogLevel = ELogType.Important;
                    break;
                case "error":
                    this.LogLevel = ELogType.Error;
                    break;
            }
            this.Notice(`Changed logging to ${logging} (${this.LogLevel})`);
            this.Preferences.Set(EPrefProperty.LogMode, this.LogLevel);
        }
    }

    /**
     * set the autodelete time periode and deletes old logfiles if needed
     * @param autodelete new time periode
     */
    public async SetAutodelete(autodelete: EAutoDelete) {
        if (this.AutoDelete != autodelete) {
            this.AutoDelete = autodelete;
            this.Notice(`Changed logging autodelete to ${autodelete} days`);
            this.Preferences.Set(EPrefProperty.LogsAutoDelete, this.AutoDelete);
            this.DeleteLogs(this.AutoDelete);
        }
    }

    /**
     * get a list of all logfiles on the device in the given time periode
     * @param from logfiles newer the this timestamp
     * @param to logfiles older then this timestamp
     */
    public async ListLogfiles(from: number, to: number): Promise<FileInfo[]> {
        try {
            let ret: FileInfo[] = [];
            let files = (await Filesystem.readdir({ path: LoggingService.LogPath, directory: LoggingService.LogDirectory })).files;
            files = files.filter(f => (f.ctime ?? f.mtime) >= from && (f.ctime ?? f.mtime) <= to);
            files.sort((a, b) => b.mtime - a.mtime);
            return files;
        } catch {}

        try {
            let logfile = await Filesystem.stat({ path: this.LogFile, directory: LoggingService.LogDirectory });
            if (logfile) {
                return [logfile as FileInfo];
            }
        } catch {}
        return [];
    }

    /**
     * gehts a specific logfile with content
     * @param name filename of the logfile
     * @returns File object
     */
    public async GetLogfile(name?: string): Promise<FileUtils.File> {
        if (name == undefined) {
            name = this.LogFile;
        } else {
            name = `${LoggingService.LogPath}/${name}`;
        }

        let file = await FileUtils.GetFile(name, LoggingService.LogDirectory);

        if (!file.Exists) {
            file.Content = "";
        }

        return file;
    }

    /**
     * deletes old logs
     * @param older_then delete only logs that are older the a particular number of days. < 0 meens delete all, 0 = don't delete logs
     */
    public async DeleteLogs(older_then: number): Promise<number> {
        let delete_before_ts: number | undefined;
        if (older_then < 0) {
            //Alle Logs löschen
            delete_before_ts = undefined;
        } else if (older_then == 0) {
            //Keine Logs löschen
            return 0;
        } else {
            delete_before_ts = Date.now() - older_then * 60 * 60 * 24 * 1000;
        }
        let count = await FileUtils.EmptyDir(LoggingService.LogPath, LoggingService.LogDirectory, delete_before_ts);
        if (count > 0) {
            this.Notice(`Removed ${count} old logfile(s)`);
        }
        return count;
    }

    /**
     * get the number of all logfiles on the device
     * @returns number of all logsfiles
     */
    public async LogfilesCount(): Promise<number> {
        return FileUtils.GetFilesCount(LoggingService.LogPath, LoggingService.LogDirectory);
    }

    /**
     * get the size and file count of all logfiles on the device
     * @returns size in bytes and number of logfiles
     */
    public async GetLogSize(): Promise<{ size: number; files: number }> {
        return FileUtils.GetDirStat(LoggingService.LogPath, LoggingService.LogDirectory);
    }
}
