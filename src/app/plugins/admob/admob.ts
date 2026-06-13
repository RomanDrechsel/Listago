import { registerPlugin } from "@capacitor/core";
import { IAdmob } from "./admob.interface";

const Admob = registerPlugin<IAdmob>("AdMob");
export default Admob;
