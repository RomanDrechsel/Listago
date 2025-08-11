import { registerPlugin } from "@capacitor/core";
import type { ISharePlugin } from "./share.interface";

const SharePlugin = registerPlugin<ISharePlugin>("SharePlugin");
export default SharePlugin;
