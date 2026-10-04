import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, test } from "vitest";
import {
  blankLevel,
  decodeDemo,
  Engine,
  fromSp,
  LEVEL_BYTES,
  levelFromText,
  levelToText,
  type Run,
  runOf,
  Status,
  sharedFromHash,
  sharedToHash,
  spDemo,
  toSp,
} from "../index.ts";
import { levels } from "../levels.ts";

let engine: Engine;
beforeAll(async () => {
  engine = await Engine.load();
});

test("levels travel as .SP files and as link text", async () => {
  for (const entry of [levels()[0], levels()[110]]) {
    assert.ok(entry);
    assert.deepEqual(fromSp(toSp(entry.bytes)), entry.bytes);
    const text = await levelToText(entry.bytes);
    assert.ok(text.length < 1200, `${entry.title}: ${text.length} characters`);
    assert.deepEqual(await levelFromText(text), entry.bytes);
  }
  // A .SP with a demo after the level is still the level.
  const withDemo = new Uint8Array(LEVEL_BYTES + 5);
  withDemo.set(blankLevel());
  assert.ok(fromSp(withDemo));
  assert.equal(fromSp(new Uint8Array(100)), null);
});

test("a shared link carries the level and the maker's run", async () => {
  const level = blankLevel();
  const run = { seed: 0, ticks: 50, demo: Uint8Array.from([0x74]) };
  const hash = await sharedToHash({ level, run });
  assert.match(hash, /^l=l1\.[A-Za-z0-9_-]+&r=r1\.0\.50\./);
  assert.deepEqual(await sharedFromHash(`#${hash}`), { level, run });
  assert.deepEqual(await sharedFromHash(hash.split("&")[0] ?? ""), {
    level,
    run: null,
  });
});

test("a link can open at a moment of the run, and only at one", async () => {
  const level = blankLevel();
  const run = { seed: 0, ticks: 50, demo: Uint8Array.from([0x74]) };
  for (const at of [0, 17, 50]) {
    const hash = await sharedToHash({ level, run, at });
    assert.match(hash, new RegExp(`&t=${at}$`));
    assert.deepEqual(await sharedFromHash(hash), { level, run, at });
  }
  for (const at of [-1, 51, 2.5, Number.NaN])
    await assert.rejects(sharedToHash({ level, run, at }), RangeError);
  await assert.rejects(sharedToHash({ level, run: null, at: 0 }), RangeError);
  const hash = await sharedToHash({ level, run });
  for (const t of ["51", "-1", "1e1", "", "x", "12345678"])
    assert.deepEqual(await sharedFromHash(`${hash}&t=${t}`), { level, run });
  const bare = await sharedToHash({ level, run: null });
  assert.deepEqual(await sharedFromHash(`${bare}&t=3`), { level, run: null });
});

test("a moment is reached by playing the run's keys up to it", async () => {
  const demo5 = new Uint8Array(
    readFileSync(join(import.meta.dirname, "..", "..", "data", "DEMO5.BIN")),
  );
  const level = fromSp(demo5) as Uint8Array;
  const { seed, demo } = spDemo(demo5) as { seed: number; demo: Uint8Array };
  const run = runOf(engine, level, seed, demo) as Run;
  const shared = await sharedFromHash(
    await sharedToHash({ level, run, at: 1000 }),
  );
  assert.equal(shared?.at, 1000);
  engine.start(level, run.seed);
  engine.run(decodeDemo(run.demo).subarray(0, shared?.at));
  assert.equal(engine.tick, 1000);
  assert.equal(engine.status, Status.Playing);
});

test("nothing else reads as a level", async () => {
  for (const bad of [
    null,
    "",
    "l2.AAAA",
    "l1.%%%",
    "l1.AAAA",
    `l1.${"A".repeat(9000)}`,
  ])
    assert.equal(await levelFromText(bad), null, String(bad).slice(0, 20));
  const odd = blankLevel();
  odd[100] = 99;
  assert.equal(await levelFromText(await levelToText(odd)), null);
  assert.equal(await sharedFromHash("#x=1"), null);
});

test("a link that inflates past a level is refused, not read", async () => {
  const stream = new Blob([new Uint8Array(LEVEL_BYTES * 4)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  let text = "";
  for (const byte of packed) text += String.fromCharCode(byte);
  const link = `l1.${btoa(text).replace(/\+/g, "-").replace(/\//g, "_")}`;
  assert.equal(await levelFromText(link), null);
});

test("a shared level without a run is just the level", async () => {
  const level = blankLevel();
  const hash = await sharedToHash({ level, run: null });
  assert.doesNotMatch(hash, /&r=/);
  assert.deepEqual(await sharedFromHash(hash), { level, run: null });
});
