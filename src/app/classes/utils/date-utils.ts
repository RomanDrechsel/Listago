import { Locale } from "../../services/localization/locale";

export namespace DateUtils {
    /**
     * format a date
     * @param ts UNIX timestamp in seconds of milliseconds
     * @returns formated date as string
     */
    export const formatDate = (ts: number, separator?: string) => {
        if (ts < 9999999999) {
            ts *= 1000;
        }

        if (!separator) {
            separator = " ";
        }

        const date = new Date(ts);

        const seconds = Math.floor((Date.now() - ts) / 1000);
        if (seconds < 10800) {
            //max 3 Stunden her
            let str = "";
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);

            if (hours == 1) {
                str = "1" + Locale.getText("date.hour_short") + " ";
            } else if (hours >= 2) {
                str = hours + Locale.getText("date.hours_short") + " ";
            }

            if (str.length == 0 && minutes < 1) {
                //Weniger als 1 Minute --> "< 1 Min." zurückgeben
                str = "<1" + Locale.getText("date.min_short");
            } else if (minutes == 1) {
                str += "1" + Locale.getText("date.min_short") + " ";
            } else if (minutes >= 2) {
                str += minutes + Locale.getText("date.min_short") + " ";
            }

            return Locale.getText("date.ago", { date: str.trim() });
        }

        if (isToday(date)) {
            const options: Intl.DateTimeFormatOptions = {
                hour: "2-digit",
                minute: "2-digit",
            };
            return Locale.getText("date.today") + ", " + date.toLocaleTimeString(Locale.currentLang().locale, options) + Locale.getText("date.date_add");
        } else if (isYesterday(date)) {
            const options: Intl.DateTimeFormatOptions = {
                hour: "2-digit",
                minute: "2-digit",
            };
            return Locale.getText("date.yesterday") + ", " + date.toLocaleTimeString(Locale.currentLang().locale, options) + Locale.getText("date.date_add");
        } else {
            const options: Intl.DateTimeFormatOptions = {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            };
            return date.toLocaleString(Locale.currentLang().locale, options) + Locale.getText("date.date_add");
        }
    };

    /**
     * is the date today
     * @param someDate date
     * @returns today or not
     */
    const isToday = (someDate: Date) => {
        const today = new Date();
        return someDate.getDate() == today.getDate() && someDate.getMonth() == today.getMonth() && someDate.getFullYear() == today.getFullYear();
    };

    /**
     * is the date yesterday
     * @param someDate date
     * @returns yesterday or not
     */
    const isYesterday = (someDate: Date) => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return someDate.getDate() == yesterday.getDate() && someDate.getMonth() == yesterday.getMonth() && someDate.getFullYear() == yesterday.getFullYear();
    };
}
