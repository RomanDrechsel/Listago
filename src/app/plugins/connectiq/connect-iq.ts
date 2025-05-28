import { IConnectIQ } from "./connect-iq.interface";
import { registerPlugin } from "@capacitor/core";

const ConnectIQ = registerPlugin<IConnectIQ>("ConnectIQ");
export default ConnectIQ;
