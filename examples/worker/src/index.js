// Workers cannot compile WebAssembly from bytes, so the module is imported
// as a file and compiled at deploy.

import { Engine } from "@zeybek/supaplex";
import wasm from "@zeybek/supaplex/engine.wasm";
import { handle } from "./verify.js";

let engine;

export default {
  async fetch(request) {
    engine ??= await Engine.fromModule(wasm);
    return handle(request, engine);
  },
};
