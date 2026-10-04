import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "vitest";
import { LEVEL_BYTES } from "../engine/constants.ts";
import { blankLevel } from "./level.ts";
import { readLevelSet, writeLevelSet } from "./level-set.ts";

const DAT = new Uint8Array(
  readFileSync(join(import.meta.dirname, "..", "..", "data", "LEVELS.DAT")),
);

test("the game's LEVELS.DAT reads as 111 levels and writes back the same", () => {
  const levels = readLevelSet(DAT);
  assert.ok(levels);
  assert.equal(levels.length, 111);
  assert.deepEqual(writeLevelSet(levels), DAT);
  levels[0]?.fill(0);
  assert.notDeepEqual(readLevelSet(DAT)?.[0], levels[0]);
});

test("a set of your own levels, and what is not a set", () => {
  const set = writeLevelSet([blankLevel(), blankLevel()]);
  assert.equal(set.length, 2 * LEVEL_BYTES);
  assert.equal(readLevelSet(set)?.length, 2);
  assert.equal(readLevelSet(new Uint8Array()), null);
  assert.equal(readLevelSet(set.subarray(1)), null);
  const odd = set.slice();
  odd[LEVEL_BYTES + 100] = 99; // a code past the game's own
  assert.equal(readLevelSet(odd), null);
});
