import { registerPlugin } from "@capacitor/core";
import type { ISysInfo } from "./sys-info.interface";

const SysInfo = registerPlugin<ISysInfo>("SysInfo");
export default SysInfo;
