import assert from "node:assert/strict";
import { test } from "vitest";
import {
  CELLS,
  Dir,
  Event,
  input,
  Kind,
  Status,
  WIDTH,
} from "../engine/constants.ts";
import { Engine } from "../engine/engine.ts";
import {
  blankLevel,
  isLevel,
  readSettings,
  writeSettings,
} from "../formats/level.ts";
import { sharedFromHash, sharedToHash } from "../formats/link.ts";
import { encodeDemo, verify } from "../replay/run.ts";
import { cellsBetween, fill, PIECES, paint, rectangle } from "./paint.ts";

test("every piece has a code of its own, a level can hold it, and keys are not shared", () => {
  const codes = PIECES.map((p) => p.code);
  assert.equal(new Set(codes).size, codes.length);
  const keys = PIECES.flatMap((p) => (p.key ? [p.key] : []));
  assert.equal(new Set(keys).size, keys.length);
  const bytes = blankLevel();
  for (const piece of PIECES) {
    paint(bytes, 3 * WIDTH + 3, piece.code);
    assert.ok(isLevel(bytes), piece.name);
  }
});

test("there is one Murphy: painting him moves him", () => {
  const bytes = blankLevel();
  assert.ok(paint(bytes, 10 * WIDTH + 10, Kind.Murphy));
  const murphies = bytes.subarray(0, CELLS).filter((b) => b === Kind.Murphy);
  assert.equal(murphies.length, 1);
  assert.equal(bytes[10 * WIDTH + 10], Kind.Murphy);
  assert.equal(paint(bytes, 10 * WIDTH + 10, Kind.Murphy), false, "no change");
  assert.equal(paint(bytes, CELLS, Kind.Base), false, "off the field");
});

test("special ports go into the table as they are painted", () => {
  const bytes = blankLevel();
  paint(bytes, 5 * WIDTH + 5, Kind.SpecialRight);
  assert.equal(readSettings(bytes).specials.length, 1);
  paint(bytes, 5 * WIDTH + 5, Kind.Base);
  assert.equal(readSettings(bytes).specials.length, 0);
});

test("a drag fills the cells between two it passed", () => {
  assert.deepEqual(cellsBetween(0, 3), [0, 1, 2, 3]);
  assert.deepEqual(cellsBetween(3, 0), [3, 2, 1, 0]);
  assert.deepEqual(cellsBetween(0, 2 * WIDTH), [0, WIDTH, 2 * WIDTH]);
  assert.equal(cellsBetween(0, 3 * WIDTH + 3).length, 4);
});

test("a level made here, won, shared as a link and opened elsewhere", async () => {
  const level = blankLevel();
  for (let y = 1; y < 20; y++) paint(level, y * WIDTH + 30, Kind.Hardware);
  writeSettings(level, { ...readSettings(level), title: "round the wall" });

  // Going out through the exit takes a moment.
  const engine = await Engine.load();
  engine.start(level, 0);
  const plan = [
    ...Array(18 * 8).fill(input(Dir.Down, false)),
    ...Array(55 * 8).fill(input(Dir.Right, false)),
    ...Array(80).fill(input(Dir.Down, false)),
  ];
  const keys: number[] = [];
  for (const key of plan) {
    keys.push(key);
    if (engine.step(key) & Event.Win) break;
  }
  assert.equal(engine.status, Status.Won);
  const run = { seed: 0, ticks: engine.tick, demo: encodeDemo(keys) };

  const hash = await sharedToHash({ level, run });
  assert.ok(hash.length < 900, `${hash.length} characters`);
  const opened = await sharedFromHash(`#${hash}`);
  assert.ok(opened?.run);
  assert.deepEqual(opened.level, level);
  assert.equal(readSettings(opened.level).title, "ROUND THE WALL");
  assert.deepEqual(verify(engine, opened.level, opened.run), {
    won: true,
    ticks: run.ticks,
  });
});

const count = (bytes: Uint8Array, code: number) =>
  bytes.subarray(0, CELLS).filter((c) => c === code).length;

test("fill paints the area of same pieces, edge to edge, and nothing past it", () => {
  const bytes = blankLevel();
  // The hardware round the edge is one area, touching every side.
  const ring = count(bytes, Kind.Hardware);
  assert.ok(fill(bytes, 0, Kind.Ram));
  assert.equal(count(bytes, Kind.Ram), ring);
  assert.equal(count(bytes, Kind.Hardware), 0);
  assert.equal(fill(bytes, 0, Kind.Ram), false);
  assert.equal(fill(bytes, -1, Kind.Zonk), false);
  assert.equal(fill(bytes, CELLS, Kind.Zonk), false);
});

test("filling with Murphy puts him in one cell", () => {
  const bytes = blankLevel();
  assert.ok(fill(bytes, 10 * WIDTH + 10, Kind.Murphy));
  assert.equal(count(bytes, Kind.Murphy), 1);
  assert.equal(bytes[10 * WIDTH + 10], Kind.Murphy);
});

test("a rectangle is painted whole, or only its edge", () => {
  const bytes = blankLevel();
  const from = 5 * WIDTH + 5;
  const to = 8 * WIDTH + 10; // 6 wide, 4 high
  assert.ok(rectangle(bytes, to, from, Kind.Zonk));
  assert.equal(count(bytes, Kind.Zonk), 24);
  const edged = blankLevel();
  assert.ok(rectangle(edged, from, to, Kind.Zonk, true));
  assert.equal(count(edged, Kind.Zonk), 24 - 8);
  assert.equal(rectangle(edged, from, to, Kind.Zonk, true), false);
});
