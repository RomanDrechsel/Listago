export namespace KeepInTrash {
    export enum Enum {
        Unlimited = -1,
        Day = 1,
        Week = 7,
        Month = 30,
        LastEntries = 10000,
    }

    export const Default = Enum.LastEntries;

    /**
     * return KeepInTrash Enum from a number
     * @param number number representation
     * @returns KeepInTrash.Enum
     */
    export const FromNumber = function (number: number | string | Enum): Enum {
        if (typeof number == "string") {
            number = parseInt(number);
        }
        number = number as number;

        switch (number) {
            case 1:
                return Enum.Day;
            case 7:
                return Enum.Week;
            case 30:
                return Enum.Month;
            case 10000:
                return Enum.LastEntries;
            default:
                return Default;
        }
    };

    /**
     * returns the number of days after which old entries should be deleted
     * @param number Enum representation or number
     * @returns number of days after which old entries should be deleted, undefined if no period is set
     */
    export const StockPeriod = function (number: number | Enum): number | undefined {
        number = number as number;
        if (number <= 30) {
            return number;
        } else {
            return undefined;
        }
    };

    /**
     * returns the maximum number of entries in trash, if a maximum number is set
     * @param number Enum representation or number
     * @returns maximum number of entries, undefined if no number is set
     */
    export const StockSize = function (number: number | Enum): number | undefined {
        number = number as number;
        if (number == Enum.LastEntries) {
            return 100;
        } else {
            return undefined;
        }
    };
}
