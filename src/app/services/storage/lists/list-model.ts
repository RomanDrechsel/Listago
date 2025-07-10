import type { ListitemModel } from "./listitem-model";

export type ListModel = {
    uuid: string | number;
    name: string;
    created: number;
    order: number;
    updated?: number;
    deleted?: number;
    reset?: ListReset;
    sync?: boolean;
    items?: ListitemModel[];
};

export type ListReset = {
    active: boolean;
    interval: "daily" | "weekly" | "monthly";
    hour: number;
    minute: number;
    day: number;
    weekday: number;
};
