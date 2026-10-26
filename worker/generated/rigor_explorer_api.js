/* @ts-self-types="./rigor_explorer_api.d.ts" */
import * as wasm from "./rigor_explorer_api_bg.wasm";
import { __wbg_set_wasm } from "./rigor_explorer_api_bg.js";

__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    ContainerStartupOptions, MinifyConfig, R2Range, __worker_init_state, fetch
} from "./rigor_explorer_api_bg.js";
