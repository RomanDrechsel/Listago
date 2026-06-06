export interface ListPageSelectedItem {
    Id: string | number | undefined;

    equals(other: ListPageSelectedItem | null | undefined): boolean;
}
