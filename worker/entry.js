// Entry point for the Rust worker (wasm-bindgen) on Cloudflare Workers.
// The generated bindings expect a wasm-bindgen-aware bundler; here we wire
// instantiation manually and lazily, once per isolate, without top-level await.

import wasmModule from "./generated/rigor_explorer_api_bg.wasm";
import * as bg from "./generated/rigor_explorer_api_bg.js";

let ready = null;

function ensureReady() {
  if (!ready) {
    ready = (async () => {
      const imports = {};
      const defs = WebAssembly.Module.imports(wasmModule);
      for (const imp of defs) {
        if (!imports[imp.module]) imports[imp.module] = {};
        imports[imp.module][imp.name] = bg[imp.name];
      }
      const instance = await WebAssembly.instantiate(wasmModule, imports);
      bg.__wbg_set_wasm(instance.exports);
      if (typeof instance.exports.__wbindgen_start === "function") {
        instance.exports.__wbindgen_start();
      }
    })();
  }
  return ready;
}

export default {
  async fetch(request, env, ctx) {
    await ensureReady();
    return bg.fetch(request, env, ctx);
  },
};
