import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, test } from "vitest";
import {
  blankLevel,
  Engine,
  fromSp,
  LEVEL_BYTES,
  runOf,
  spDemo,
  toSp,
} from "../index.ts";

let engine: Engine;
beforeAll(async () => {
  engine = await Engine.load();
});

test("a .SP file's demo plays here as it did in the game, and goes back out", () => {
  // The game's own DEMO5.BIN: level 5, EASY DEAL, and a solution to it.
  const file = new Uint8Array(
    readFileSync(join(import.meta.dirname, "..", "..", "data", "DEMO5.BIN")),
  );
  const level = fromSp(file);
  const demo = spDemo(file);
  assert.ok(level && demo);
  const run = runOf(engine, level, demo.seed, demo.demo);
  assert.ok(run, "the game's solution wins here too");
  // Won on reaching the exit; the demo goes on while he leaves.
  assert.equal(run.ticks, 5760);

  const sp = toSp(level, run, 5);
  assert.equal(sp[LEVEL_BYTES], 0x85);
  assert.equal(sp.at(-1), 0xff);
  const again = spDemo(sp);
  assert.ok(again);
  assert.equal(again.seed, run.seed);
  assert.deepEqual(
    runOf(engine, fromSp(sp) ?? level, again.seed, again.demo),
    run,
  );

  assert.equal(spDemo(toSp(level)), null, "a level alone has no demo");
  assert.equal(
    runOf(engine, level, demo.seed, demo.demo.subarray(0, 40)),
    null,
  );
});

test("a .SP file whose level holds codes past the game's own is no level", () => {
  const file = blankLevel();
  file[100] = 99;
  assert.equal(fromSp(file), null);
});

test("a .SP demo without its 0xFF runs to the end of the file, and an empty one is none", () => {
  const level = blankLevel();
  const open = new Uint8Array(LEVEL_BYTES + 3);
  open.set(level);
  open[LEVEL_BYTES] = 0x80;
  open[LEVEL_BYTES + 1] = 0x24;
  open[LEVEL_BYTES + 2] = 0x31;
  assert.deepEqual([...(spDemo(open)?.demo ?? [])], [0x24, 0x31]);
  const empty = new Uint8Array(LEVEL_BYTES + 2);
  empty.set(level);
  empty[LEVEL_BYTES + 1] = 0xff;
  assert.equal(spDemo(empty), null);
});
