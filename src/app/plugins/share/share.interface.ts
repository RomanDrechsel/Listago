import { Plugin } from "@capacitor/core";

export interface ISharePlugin extends Plugin {
    SendEmail(args: { receiver?: string; subject?: string; body?: string; attachments?: String[]; chooserTitle?: string }): Promise<{ success: boolean; message?: string }>;
}
