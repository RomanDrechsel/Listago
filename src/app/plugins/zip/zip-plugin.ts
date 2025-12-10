import { registerPlugin } from "@capacitor/core";
import type { IZipPlugin } from "./zip.interface";

const ZipPlugin = registerPlugin<IZipPlugin>("ZipPlugin");
export default ZipPlugin;
