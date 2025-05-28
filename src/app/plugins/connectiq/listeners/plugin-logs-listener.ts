import { Logger } from "../../../services/logging/logger";
import { LogEventArgs } from "../event-args/log-event-args";
import { ConnectIQListener } from "./connect-iq-listener";

export class PluginLogsListener extends ConnectIQListener<LogEventArgs> {
    public Event(): string {
        return "LOG";
    }

    protected async Callback(log: LogEventArgs): Promise<void> {
        switch (log.level) {
            case "debug":
                Logger.DebugNoLogcat(`${log.tag}: ${log.message}`, log.obj);
                break;
            case "notice":
                Logger.NoticeNoLogcat(`${log.tag}: ${log.message}`, log.obj);
                break;
            case "important":
                Logger.ImportantNoLogcat(`${log.tag}: ${log.message}`, log.obj);
                break;
            case "error":
                Logger.ErrorNoLogcat(`${log.tag}: ${log.message}`, log.obj);
                break;
        }
    }
}
