import { FileInfo } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import SharePlugin from "src/app/plugins/share/share-plugin";
import { Logger } from "src/app/services/logging/logger";

export namespace ShareUtil {
    export const SendMail = async function (args: { sendto: string; files?: FileInfo | FileInfo[] | string | string[]; title?: string; text?: string; chooserTitle?: string }): Promise<boolean> {
        const attachments: string[] = [];
        if (args.files) {
            if (!Array.isArray(args.files)) {
                if (typeof args.files == "string") {
                    attachments.push(args.files);
                } else {
                    attachments.push(args.files.uri);
                }
            } else {
                attachments.push(...args.files.map(f => (typeof f == "string" ? f : f.uri)));
            }
        }

        const send = await SharePlugin.SendEmail({
            receiver: args.sendto,
            subject: args.title,
            body: args.text,
            attachments: attachments.length > 0 ? attachments : undefined,
            chooserTitle: args.chooserTitle,
        });
        if (send.success) {
            Logger.Debug(`Opened email intent for sending mail to ${args.sendto}`);
        } else {
            Logger.Error(`Failed to open email intent for sending mail: ${send.message}`);
        }
        return send.success;
    };

    export const ShareFile = async function (args: { files?: FileInfo | FileInfo[] | string | string[]; title?: string; text?: string }): Promise<boolean> {
        if (!args.files && !args.title && !args.text) {
            return false;
        }

        if (args.files) {
            if (!Array.isArray(args.files)) {
                if (typeof args.files == "string") {
                    args.files = [args.files];
                } else {
                    args.files = [args.files.uri];
                }
            } else {
                args.files = args.files.map(f => (typeof f == "string" ? f : f.uri));
            }
        }

        await Share.share({
            files: args.files as string[],
            title: args.title,
            text: args.text,
        });
        return true;
    };
}
