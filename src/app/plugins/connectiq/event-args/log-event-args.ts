export type LogEventArgs = {
    level: "debug" | "notice" | "important" | "error";
    tag: string;
    message: string;
    obj?: any;
};
