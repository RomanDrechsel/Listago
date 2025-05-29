import type { FileBackendListitemModel } from "./file-backend-listitem-model";

export type FileBackendTrashListModel = {
    uuid: string | number;
    items: FileBackendListitemModel[];
};
