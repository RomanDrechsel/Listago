export type ListitemModel = {
    uuid: number | string;
    item: string;
    note?: string;
    order: number;
    created: number;
    hidden?: boolean;
    locked?: boolean;
    updated?: number;
    deleted?: number;
};
