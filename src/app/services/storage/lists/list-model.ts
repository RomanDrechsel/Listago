import type { ListSyncDevice } from "../../lists/list";
import type { ListitemModel } from "./listitem-model";

export type ListModel = {
    uuid?: string | number;
    name: string;
    created: number;
    order: number;
    updated?: number;
    deleted?: number;
    reset?: ListReset;
    sync?: boolean;
    syncDevices?: ListSyncDevice[];
    items?: ListitemModel[];
    id?: number;
    rev?: number;
};

export type ListReset = {
    active: boolean;
    interval: "daily" | "weekly" | "monthly";
    hour: number;
    minute: number;
    day: number;
    weekday: number;
};
