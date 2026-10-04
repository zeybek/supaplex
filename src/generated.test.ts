import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "vitest";
import { engineSourceHash } from "../scripts/engine-sources.ts";
import { ENGINE_BYTES, Engine } from "./engine/engine.ts";
import { ENGINE_SOURCE, ENGINE_WASM } from "./generated/engine.ts";
import { LEVELS_SHA256 } from "./generated/levels.ts";
import { levels } from "./levels.ts";

const root = join(import.meta.dirname, "..");

test("the WebAssembly was built from the Rust as it is now", () => {
  assert.equal(
    ENGINE_SOURCE,
    engineSourceHash(root),
    "the engine changed: run `npm run generate`",
  );
});

test("the levels are LEVELS.DAT as it is now", () => {
  const data = readFileSync(join(root, "data", "LEVELS.DAT"));
  assert.equal(
    LEVELS_SHA256,
    createHash("sha256").update(data).digest("hex"),
    "data/LEVELS.DAT changed: run `npm run generate`",
  );
});

test("the module has no way to panic", () => {
  // A panic carries its source location: a module that could panic holds
  // the path of a Rust file.
  const file = readFileSync(join(root, "src", "generated", "engine.wasm"));
  assert.equal(file.includes("crates/"), false);
});

test("the .wasm file Workers import is the module the page decodes", async () => {
  const file = readFileSync(join(root, "src", "generated", "engine.wasm"));
  assert.deepEqual(file, Buffer.from(ENGINE_WASM, "base64"));
  assert.equal(ENGINE_BYTES, file.length);
  const engine = await Engine.fromModule(new WebAssembly.Module(file));
  const first = levels()[0];
  assert.ok(first && engine.start(first.bytes));
  assert.equal(engine.needed, 19);
});
