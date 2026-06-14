import { registerPlugin } from "@capacitor/core";
import { IAdmob } from "./admob.interface";

const AdMob = registerPlugin<IAdmob>("AdMob");
export default AdMob;
