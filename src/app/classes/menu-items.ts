import { StringUtils } from "./utils/string-utils";

export enum EMenuItemType {
    "Lists",
    "EmptyList",
    "DeleteList",
    "EditList",
    "ListsTrash",
    "EmptyListTrash",
    "ListitemsTrash",
    "EmptyItemTrash",
    "Devices",
    "Settings",
    "OpenApp",
    "AppInfo",
    "Privacy",
}
export const MenuitemFactory = function (itemtype: EMenuItemType, options?: { title_id?: string; url_addition?: string; disabled?: boolean; hidden?: boolean; onClick?: () => Promise<boolean> }): MenuItem {
    let url: string;
    switch (itemtype) {
        case EMenuItemType.Lists:
            url = options?.url_addition ? StringUtils.concat(["/lists", options.url_addition], "/") : "/lists";
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.lists", Icon: "./assets/icons/menu/lists.svg", Url: url, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.EmptyList:
            return { Id: itemtype, TitleId: options?.title_id ?? "page_listitems.menu_empty", Icon: "./assets/icons/menu/empty.svg", Url: options?.url_addition, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.DeleteList:
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.delete_list", Icon: "./assets/icons/menu/delete.svg", Url: options?.url_addition, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.EditList:
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.edit_list", Icon: "./assets/icons/menu/edit.svg", Url: options?.url_addition, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.ListsTrash:
            url = options?.url_addition ? StringUtils.concat(["/trash", options.url_addition], "/") : "/trash";
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.trash", Icon: "./assets/icons/menu/trash.svg", Url: url, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.EmptyListTrash:
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.empty_trash", Icon: "./assets/icons/menu/empty_trash.svg", Url: options?.url_addition, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.ListitemsTrash:
            url = options?.url_addition ? StringUtils.concat(["/trash/items", options.url_addition], "/") : "/trash/items";
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.trash", Icon: "./assets/icons/menu/trash_items.svg", Url: url, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.EmptyItemTrash:
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.empty_trash", Icon: "./assets/icons/menu/empty_trash.svg", Url: options?.url_addition, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.Devices:
            url = options?.url_addition ? StringUtils.concat(["/devices", options.url_addition], "/") : "/devices";
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.devices", Icon: "./assets/icons/menu/devices.svg", Url: url, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.Settings:
            url = options?.url_addition ? StringUtils.concat(["/settings", options.url_addition], "/") : "/settings";
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.settings", Icon: "./assets/icons/menu/settings.svg", Url: url, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.OpenApp:
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.openapp", Icon: "./assets/icons/menu/openapp.svg", Url: "", Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.AppInfo:
            url = options?.url_addition ? StringUtils.concat(["/appinfo", options.url_addition], "/") : "/appinfo";
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.appinfos", Icon: "./assets/icons/menu/appinfos.svg", Url: url, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
        case EMenuItemType.Privacy:
            url = options?.url_addition ? StringUtils.concat(["/privacy-policy/privacy", options.url_addition], "/") : "/privacy-policy/privacy";
            return { Id: itemtype, TitleId: options?.title_id ?? "mainmenu.privacy", Icon: "./assets/icons/menu/privacy.svg", Url: url, Disabled: options?.disabled ?? false, Hidden: options?.hidden ?? false, onClick: options?.onClick };
    }
};

export const MenuitemFactoryList = function (itemtypes: EMenuItemType[]): MenuItem[] {
    return itemtypes.map(item => MenuitemFactory(item));
};

export declare type MenuItem = {
    Id: EMenuItemType;
    TitleId: string;
    Disabled: boolean;
    Hidden: boolean;
    Icon: string;
    Url?: string;
    onClick?: () => Promise<boolean>;
};
