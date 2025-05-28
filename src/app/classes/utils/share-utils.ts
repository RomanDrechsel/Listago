import { FileInfo } from "@capacitor/filesystem";
import { Share as SharePlugin } from "@capacitor/share";
import { Attachment, EmailComposer } from "capacitor-email-composer";
import { Logger } from "../../services/logging/logger";

export namespace ShareUtil {
    export const SendMail = async function(args: { sendto: string; files?: FileInfo | FileInfo[] | string | string[], title?: string; text?: string; }): Promise<boolean> {
        let attachments: Attachment[] = [];
        if (args.files) {
            if (!Array.isArray(args.files)) {
                if (typeof args.files == "string") {
                    args.files = [args.files];
                }
                else {
                    args.files = [args.files.uri];
                }
            }
            else {
                args.files = args.files.map(f => typeof f == "string" ? f : f.uri);
            }
            args.files.forEach(file => {
                attachments.push({
                    type: 'absolute',
                    path: file.replace("file:///", ""),
                });
            });
        }

        try {
            await EmailComposer.open({
                subject: args.title,
                body: args.text,
                to: [args.sendto],
                isHtml: true,
                attachments: attachments,
            });
        }
        catch (error) {
            Logger.Error(`Could not send mail to ${args.sendto}`, error);
            return false;
        }
        return true;
    };

    export const Share = async function(args: { files?: FileInfo | FileInfo[] | string | string[], title?: string; text?: string; }): Promise<boolean> {
        if (!args.files && !args.title && !args.text) {
            return false;
        }

        if (args.files) {
            if (!Array.isArray(args.files)) {
                if (typeof args.files == "string") {
                    args.files = [args.files];
                }
                else {
                    args.files = [args.files.uri];
                }
            }
            else {
                args.files = args.files.map(f => typeof f == "string" ? f : f.uri);
            }
        }

        await SharePlugin.share({
            files: args.files as string[],
            title: args.title,
            text: args.text,
        });
        return true;
    };
};
