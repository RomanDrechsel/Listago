import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Buffer } from "buffer";
import { Logger } from "../../services/logging/logger";
import { StringUtils } from "./string-utils";

export namespace FileUtils {
    /**
     * checks if a file or directory exists
     * @param path path to the directory
     * @param dir Capacitor-directory
     * @returns true if the file exists, else false
     */
    export async function FileExists(path: string, dir: Directory | undefined = undefined): Promise<boolean> {
        try {
            await Filesystem.stat({ path: path, directory: dir });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * returns information of a file
     * @param path path to the directory
     * @param dir Capacitor-directory
     * @returns File-object
     */
    export async function GetFileStat(path: string, dir: Directory | undefined = undefined): Promise<File> {
        try {
            let uri = path;
            if (dir) {
                uri = (await Filesystem.getUri({ path: path, directory: dir })).uri;
            }

            let stat = await Filesystem.stat({ path: uri });
            let ret = new File(stat.uri, stat.size, stat.ctime, stat.mtime);
            return ret;
        } catch (e) {
            return new File(path, -1);
        }
    }

    /**
     * returns number and size of all files in a directory
     * @param path path to the directory
     * @param dir Capacitor-directory
     * @returns object with information
     */
    export async function GetDirStat(path: string, dir: Directory | undefined = undefined): Promise<{ files: number; size: number }> {
        try {
            const files = await Filesystem.readdir({ path: path, directory: dir });
            if (files) {
                let size = 0;
                files.files.forEach(file => {
                    size += file.size;
                });
                return { files: files.files.length, size: size };
            }
        } catch (e) {
            Logger.Error(`Could not read directory '${path}' in ${dir}: `, e);
        }

        return { files: -1, size: -1 };
    }

    /**
     * returns the content of a file
     * @param path path to the directory
     * @param dir Capacitor-directory
     * @returns File-object
     */
    export async function GetFile(file: string | File, dir: Directory | undefined = undefined): Promise<File> {
        let ret: File;
        if (file instanceof File) {
            ret = file;
        } else {
            ret = new File(file, -1);
        }

        try {
            if (StringUtils.isString(file)) {
                ret = await GetFileStat(String(file), dir);
            }

            if (ret.Exists) {
                await ret.ReadContent();
            }
        } catch (e) {
            Logger.Error(`Could not read file ${StringUtils.toString(file)}`, e);
        }

        return ret;
    }

    /**
     * returns number of files in a directory
     *@param path path to the directory
     * @param dir Capacitor-directory
     * @returns number of files
     */
    export async function GetFilesCount(path: string, dir: Directory | undefined = undefined): Promise<number> {
        try {
            return (await Filesystem.readdir({ path: path, directory: dir })).files.length;
        } catch (e) {
            Logger.Error(`Could not read files count of '${path}' in ${dir}:`, e);
            return 0;
        }
    }

    /**
     * removes a file
     * @param path path to the file
     * @param dir Capacitor-directory
     */
    export async function DeleteFile(path: string, dir: Directory | undefined = undefined): Promise<boolean> {
        try {
            await Filesystem.deleteFile({ path: path, directory: dir });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * returns all files in the directory
     * @param args configuration arguments
     * @returns array of File objects
     */
    export async function GetFiles(args: { path: string; dir?: Directory; pattern?: string | RegExp; with_data?: boolean }): Promise<File[]> {
        try {
            const ret: File[] = [];
            const files = await Filesystem.readdir({ path: args.path, directory: args.dir });
            for (let i = 0; i < files.files.length; i++) {
                const f = files.files[i];
                if (f.type != "file") {
                    continue;
                }
                if (!args.pattern || (typeof args.pattern == "string" && f.name.includes(args.pattern)) || (args.pattern instanceof RegExp && args.pattern.test(f.name))) {
                    let file = await GetFileStat(f.uri);
                    if (args.with_data === true) {
                        file = await GetFile(file);
                    }
                    if (file.Exists) {
                        ret.push(file);
                    }
                }
            }

            return ret;
        } catch {
            return [];
        }
    }

    /**
     * deletes all files in a directory
     * @param path path to the directory
     * @param dir Capacitor-directory
     * @param keep_newer_than keep files, that are newer then this timestamp
     * @returns number of deleted files
     */
    export async function EmptyDir(path: string, dir?: Directory, keep_newer_than?: number, recursive?: boolean): Promise<number> {
        let files;
        try {
            files = (await Filesystem.readdir({ path: path, directory: dir })).files;
        } catch (e) {
            Logger.Error(`Could not empty directory '${path}' in ${dir}`, e);
        }
        let count = 0;
        if (files) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (recursive && file.type == "directory") {
                    const tmppath = FileUtils.JoinPaths(path, file.name);
                    count += await EmptyDir(tmppath, dir, keep_newer_than, recursive);
                    try {
                        if ((await Filesystem.readdir({ path: path, directory: dir })).files.length == 0) {
                            await Filesystem.rmdir({ path: path, directory: dir });
                        }
                    } catch (e) {
                        Logger.Error(`Could not delete direcory '${file.uri}':`, e);
                    }
                } else if (!keep_newer_than || file.mtime < keep_newer_than) {
                    try {
                        await Filesystem.deleteFile({ path: file.uri });
                        count++;
                    } catch (error) {
                        Logger.Error(`Could not delete file ${file.uri}`, error);
                    }
                }
            }
        }

        return count;
    }

    /**
     * creates a direcotry
     * @param path path to the directory
     * @param dir type of directory
     * @returns returns the absolute uri of the created directory, or false if something went wrong
     */
    export async function MkDir(path: string, dir?: Directory): Promise<string | false> {
        if (!(await DirExists(path, dir))) {
            try {
                await Filesystem.mkdir({ path: path, directory: dir });
            } catch (e) {
                Logger.Error(`Could not create '${path}' in '${dir}':`, e);
                return false;
            }
        }

        if (dir) {
            try {
                return (await Filesystem.getUri({ path: path, directory: dir })).uri;
            } catch (e) {
                Logger.Error(`Could not get uri for '${path}' in '${dir}'`, e);
                return false;
            }
        } else {
            return path;
        }
    }

    /**
     * checks if a path is a directory or not
     * @param path path
     * @param dir dir
     * @returns true if it exists and is a dir, otherwise false
     */
    export async function DirExists(path: string, dir?: Directory): Promise<boolean> {
        try {
            const stat = await Filesystem.stat({ path: path, directory: dir });
            return stat.type === "directory";
        } catch {
            return false;
        }
    }

    /**
     * returns the name of a file or directory in a path string
     * @param path path string
     * @returns base name of file or string
     */
    export function Basename(path: string, with_extension: boolean = true): string {
        const basename = path.split("/").pop();
        if (basename && !with_extension) {
            return basename.split(".").slice(undefined, -1).join(".");
        }

        return basename ?? "";
    }

    /**
     * adds different parts if a path, with no double //
     * @param paths paths to add
     * @returns path as string
     */
    export function JoinPaths(...paths: string[]): string {
        let path: string = "";
        for (const p of paths) {
            if (path.length > 0) {
                path = StringUtils.trimEnd(path, "/") + "/" + StringUtils.trimStart(p, "/");
            } else {
                path = p;
            }
        }
        return path;
    }

    export class File {
        public Filename;
        public Content: string | undefined = undefined;

        constructor(public Path: string, public Size: number = -1, public Created: number = -1, public Modified: number = -1) {
            let filename = this.Path.split("/").pop();
            this.Filename = filename ? filename : this.Path;
        }

        /**
         * does the file exist?
         */
        public get Exists() {
            return this.Size >= 0;
        }

        /**
         * reads the content of the file
         */
        public async ReadContent() {
            if (this.Exists) {
                let fileRes = await Filesystem.readFile({
                    path: this.Path,
                    encoding: Encoding.UTF8,
                });

                if (fileRes.data instanceof Blob) {
                    this.Content = StringUtils.toString(fileRes.data);
                } else {
                    this.Content = String(fileRes.data);
                }
            }
        }

        public async Base64Content(): Promise<string | undefined> {
            if (!this.Content) {
                await this.ReadContent();
            }
            if (this.Content) {
                return Buffer.from(this.Content).toString("base64");
            }
            return undefined;
        }

        /**
         * formats size of file to readable format
         * @param bytes size of the file in bytes
         * @returns formated string
         */
        public static FormatSize(bytes: number): string {
            if (bytes >= 1073741824) {
                return (bytes / 1073741824).toFixed(2) + "Gb";
            } else if (bytes >= 1048576) {
                return (bytes / 1048576).toFixed(2) + "Mb";
            } else if (bytes >= 1024) {
                return (bytes / 1024).toFixed(2) + "Kb";
            } else {
                return bytes + "b";
            }
        }
    }
}
