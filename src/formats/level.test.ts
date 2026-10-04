import assert from "node:assert/strict";
import { beforeAll, test } from "vitest";
import {
  blankLevel,
  Engine,
  formatTitle,
  isLevel,
  Kind,
  MAX_SPECIALS,
  problems,
  readSettings,
  specialsFor,
  WIDTH,
  writeSettings,
} from "../index.ts";
import { levels } from "../levels.ts";

let engine: Engine;
beforeAll(async () => {
  engine = await Engine.load();
});

test("titles are written the game's way", () => {
  assert.equal(formatTitle("warm up"), "------- WARM UP -------");
  assert.equal(formatTitle("é? ok!"), "-------- ? OK! --------");
  assert.equal(formatTitle(""), "-".repeat(23));
  assert.equal(formatTitle("x".repeat(40)).length, 23);
});

test("the settings read back as the game's own levels have them", () => {
  const gravity = levels()[20];
  assert.ok(gravity);
  const settings = readSettings(gravity.bytes);
  assert.equal(settings.title, "GRAVITY");
  assert.equal(settings.gravity, true);
  const copy = gravity.bytes.slice();
  writeSettings(copy, settings);
  assert.deepEqual(
    copy.subarray(1444, 1532),
    gravity.bytes.subarray(1444, 1532),
  );
  const ports = levels()[100];
  assert.ok(ports);
  assert.equal(readSettings(ports.bytes).specials.length, 6);
});

test("a blank level plays, and says what is missing when it would not", () => {
  const blank = blankLevel();
  assert.deepEqual(problems(blank), []);
  assert.ok(engine.start(blank));
  assert.equal(readSettings(blank).title, "UNTITLED");
  const broken = blank.slice();
  broken[2 * WIDTH + 2] = Kind.Base;
  broken[21 * WIDTH + 57] = Kind.Base;
  assert.deepEqual(problems(broken), [
    "Murphy is not in it",
    "there is no exit",
  ]);
});

test("the special ports' table follows the ports on the field", () => {
  const bytes = blankLevel();
  bytes[5 * WIDTH + 5] = Kind.SpecialRight;
  bytes[6 * WIDTH + 5] = Kind.SpecialDown;
  const first = specialsFor(bytes, []);
  assert.deepEqual(
    first.map((p) => p.cell),
    [5 * WIDTH + 5, 6 * WIDTH + 5],
  );
  const kept = specialsFor(bytes, [
    {
      ...first[1],
      cell: 6 * WIDTH + 5,
      gravity: false,
      freezeZonks: true,
      freezeEnemies: true,
    },
  ]);
  assert.equal(kept[1]?.freezeZonks, true);
  bytes[5 * WIDTH + 5] = Kind.Base;
  assert.equal(specialsFor(bytes, kept).length, 1);
});

test("settings written and read back, special ports and limits included", () => {
  const bytes = blankLevel();
  const specials = [
    { cell: 61, gravity: false, freezeZonks: true, freezeEnemies: false },
    { cell: 1378, gravity: true, freezeZonks: false, freezeEnemies: true },
  ];
  writeSettings(bytes, {
    title: "my level",
    gravity: true,
    freezeZonks: true,
    needed: 300,
    specials,
  });
  assert.deepEqual(readSettings(bytes), {
    title: "MY LEVEL",
    gravity: true,
    freezeZonks: true,
    needed: 255,
    specials,
  });
  const many = Array.from({ length: MAX_SPECIALS + 3 }, (_, i) => ({
    ...specials[0],
    cell: 100 + i,
    gravity: false,
    freezeZonks: false,
    freezeEnemies: false,
  }));
  writeSettings(bytes, { ...readSettings(bytes), needed: -5, specials: many });
  assert.equal(readSettings(bytes).needed, 0);
  assert.equal(readSettings(bytes).specials.length, MAX_SPECIALS);
});

test("what keeps a level from playing: two Murphies, too many special ports", () => {
  const bytes = blankLevel();
  bytes[3 * WIDTH + 3] = Kind.Murphy;
  for (let i = 0; i < MAX_SPECIALS + 1; i++)
    bytes[5 * WIDTH + 2 + i] = Kind.SpecialLeft;
  assert.deepEqual(problems(bytes), [
    "more than one Murphy: all of them die when one does",
    `${MAX_SPECIALS + 1} special ports; the game keeps ${MAX_SPECIALS}`,
  ]);
  assert.equal(specialsFor(bytes, []).length, MAX_SPECIALS);
  assert.equal(isLevel(bytes.subarray(0, 100)), false);
});

test("a level that needs more Infotrons than it could ever hold cannot be won", () => {
  const bytes = blankLevel();
  bytes[5 * WIDTH + 5] = Kind.Infotron;
  bytes[5 * WIDTH + 7] = Kind.Electron;
  writeSettings(bytes, { ...readSettings(bytes), needed: 10 });
  assert.deepEqual(problems(bytes), []);
  writeSettings(bytes, { ...readSettings(bytes), needed: 11 });
  assert.deepEqual(problems(bytes), [
    "it needs 11 Infotrons, but has at most 10",
  ]);
});
