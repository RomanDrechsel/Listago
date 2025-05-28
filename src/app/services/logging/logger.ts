import { LoggingService } from "src/app/services/logging/logging.service";

export class Logger {
    private static Service: LoggingService;

    /**
     * Initialize service
     * @param logger LoggingService
     */
    static async Initialize(logger: LoggingService) {
        Logger.Service = logger;
        await Logger.Service.Initialize();
    }

    /**
     * log an error message
     * @param message message text
     * @param obj additional objects
     */
    static Error(message: string, ...obj: any[]) {
        Logger.Service.Error(message, ...obj);
    }

    static ErrorNoLogcat(message: string, ...obj: any[]) {
        Logger.Service.ErrorNoLogcat(message, ...obj);
    }

    /**
     * log an important message
     * @param message message text
     * @param obj additional objects
     */
    static Important(message: string, ...obj: any[]) {
        Logger.Service.Important(message, ...obj);
    }

    static ImportantNoLogcat(message: string, ...obj: any[]) {
        Logger.Service.ImportantNoLogcat(message, ...obj);
    }

    /**
     * log an notice message
     * @param message message text
     * @param obj additional objects
     */
    static Notice(message: string, ...obj: any[]) {
        Logger.Service.Notice(message, ...obj);
    }

    static NoticeNoLogcat(message: string, ...obj: any[]) {
        Logger.Service.NoticeNoLogcat(message, ...obj);
    }

    /**
     * log an debug message
     * @param message message text
     * @param obj additional objects
     */
    static Debug(message: string, ...obj: any[]) {
        Logger.Service.Debug(message, ...obj);
    }

    static DebugNoLogcat(message: string, ...obj: any[]) {
        Logger.Service.DebugNoLogcat(message, ...obj);
    }

    static Console(message: string, ...objs: any[]) {
        Logger.Service.Console(message, ...objs);
    }
}
