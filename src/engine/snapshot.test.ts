import assert from "node:assert/strict";
import { beforeAll, test } from "vitest";
import { levels } from "../levels.ts";
import { Dir, input } from "./constants.ts";
import { Engine } from "./engine.ts";
import { bytesOf, keep, type Snapshot, sameSnapshot } from "./snapshot.ts";

let engine: Engine;
beforeAll(async () => {
  engine = await Engine.load();
});

test("two snapshots of the same moment are the same, and a tick later they are not", () => {
  engine.start(levels()[0]?.bytes as Uint8Array);
  const a = engine.save();
  const b = engine.save();
  assert.ok(sameSnapshot(a, b));
  engine.step(input(Dir.Right, false));
  assert.equal(sameSnapshot(a, engine.save()), false);
  const forged = Object.freeze({}) as Snapshot;
  assert.throws(() => sameSnapshot(forged, a), TypeError);
  assert.throws(() => sameSnapshot(a, forged), TypeError);
});

test("a snapshot keeps the bytes it was given, and nothing else is one", () => {
  const bytes = Uint8Array.of(1, 2, 3, 4);
  assert.equal(bytesOf(keep(bytes)), bytes);
  assert.throws(() => bytesOf(Object.freeze({}) as Snapshot), TypeError);
  // The comparison goes four bytes at a time: the module's state must be
  // a whole number of them, in a buffer of its own.
  const state = bytesOf(engine.save());
  assert.equal(state.length % 4, 0);
  assert.equal(state.byteOffset, 0);
});
