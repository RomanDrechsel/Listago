export type ListitemModel = {
    id?: number;
    uuid?: number | string;
    item: string;
    note?: string;
    order: number;
    created: number;
    hidden?: boolean;
    locked?: boolean;
    updated?: number;
    deleted?: number;
    rev?: number;
};
