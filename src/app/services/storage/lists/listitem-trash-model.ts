import type { ListitemModel } from "./listitem-model";

export type ListitemTrashModel = {
    uuid?: string | number;
    items?: ListitemModel[];
};
