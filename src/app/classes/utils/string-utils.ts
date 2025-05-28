export namespace StringUtils {
    /**
     * Removes all occurrences of a character at the beginning of a string
     * @param input String to be trimmed
     * @param charToRemove character to be removed from the string
     * @returns trimmed string
     */
    export function trimStart(input: string, charToRemove: string): string {
        const regex = new RegExp(`^(${charToRemove})+`);
        return input.replace(regex, "");
    }

    /**
     * Removes all occurrences of a character at the end of a string
     * @param input String to be trimmed
     * @param charToRemove character to be removed from the string
     * @returns trimmed string
     */
    export function trimEnd(input: string, charToRemove: string): string {
        const regex = new RegExp(`(${charToRemove})+$`);
        return input.replace(regex, "");
    }

    /**
     * Removes all occurrences of a character at the beginning and end of a string
     * @param input String to be trimmed
     * @param charToRemove character to be removed from the string
     * @returns trimmed string
     */
    export function trim(input: string, charToRemove: string): string {
        input = trimStart(input, charToRemove);
        return trimEnd(input, charToRemove);
    }

    /**
     * concatenate two or more objects as string
     * @param arg1 object or array of objects
     * @param arg2 object or separater, if arg1 = array
     * @param separator  separator, if arg1 and arg2 are objects
     * @returns concatenated string
     */
    export function concat(arg1: string | object, arg2: string = "", arg3: string = ""): string {
        if (Array.isArray(arg1)) {
            // array of objects
            return arg1.map(item => String(item)).join(String(arg2));
        } else if (arg2 !== undefined) {
            // two objects
            return `${String(arg1)}${arg3}${String(arg2)}`;
        } else {
            // only one object
            return String(arg1);
        }
    }

    /**
     * Converts the first character to upper case
     * @param str string
     * @returns converted string
     */
    export function capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    export function shorten(str: string, max_length: number): string {
        if (str.length <= max_length) {
            return str;
        }
        return str.substring(0, max_length - 3) + "...";
    }

    /**
     * checks if a variable is a string
     * @param arg variable
     * @returns true, if it is a string, else false
     */
    export function isString(arg: any): boolean {
        if (typeof arg === "string" || arg instanceof String) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * replace all non alphanumberical characters in a string with _ to use them as filename
     * @param str non filesave string
     * @returns filesave string
     */
    export function FilesaveString(str: string) {
        return str.replace(/[^a-zA-Z0-9_]/g, "_");
    }

    /**
     * casts a variable to a string
     * @param obj variable
     * @returns string representation
     */
    export function toString(obj: any): string {
        if (isString(obj)) {
            return obj;
        } else {
            try {
                return JSON.stringify(obj);
            } catch (ex) {
                return "[Object]";
            }
        }
    }
}
