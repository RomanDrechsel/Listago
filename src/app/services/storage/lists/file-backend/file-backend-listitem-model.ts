export type FileBackendListitemModel = {
    uuid: number | string;
    item: string;
    note?: string;
    order: number;
    created: number;
    hidden?: boolean;
    locked?: boolean;
    updated?: number;
    deleted?: number;
    dirty?: boolean;
};
