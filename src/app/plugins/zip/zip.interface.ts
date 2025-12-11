import { Plugin } from "@capacitor/core";

export interface IZipPlugin extends Plugin {
    Zip(args: { level?: number }): Promise<{ success: boolean }>;
    addFile(args: { filename: string; content: string }): Promise<{ success: boolean; path?: string }>;
    Store(args: { filename: string }): Promise<{ success: boolean; path?: string }>;
    Clear(): Promise<void>;
    Unzip(args: { archive: string; outputPath: string }): Promise<{ success: boolean; path?: string; numFiles?: number; numFolders?: number }>;
}
