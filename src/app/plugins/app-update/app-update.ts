import { registerPlugin } from "@capacitor/core";
import type { IAppUpdate } from "./app-update.interface";

const AppUpdate = registerPlugin<IAppUpdate>("AppUpdate");
export default AppUpdate;
