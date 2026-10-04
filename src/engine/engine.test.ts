import assert from "node:assert/strict";
import { beforeAll, test } from "vitest";
import { at, picture } from "../../test/picture.ts";
import {
  Cause,
  CELLS,
  Dir,
  Engine,
  Event,
  Flag,
  input,
  Kind,
  Phase,
  type Snapshot,
  STEP,
  Status,
} from "../index.ts";
import { levels } from "../levels.ts";

let engine: Engine;

beforeAll(async () => {
  engine = await Engine.load();
});

test("all 111 levels, with their titles", () => {
  const all = levels();
  assert.equal(all.length, 111);
  assert.equal(all[0]?.title, "WARM UP");
  assert.equal(all[0]?.needed, 19);
  assert.equal(all[110]?.title, "BRAINMAN!");
  assert.equal(all[20]?.title, "GRAVITY");
  assert.equal(all[20]?.gravity, true);
});

test("every level starts in the WebAssembly engine", () => {
  for (const level of levels()) {
    assert.ok(engine.start(level.bytes), `level ${level.number}`);
    assert.equal(engine.needed, level.needed, `level ${level.number}`);
    assert.equal(engine.kinds[engine.murphy.cell], Kind.Murphy);
  }
});

test("the fancy pieces behave as plain ones and keep their look", () => {
  const level = levels()[0];
  assert.ok(level);
  engine.start(level.bytes);
  for (let c = 0; c < CELLS; c++) {
    const code = level.bytes[c] ?? 0;
    if (code === 26) {
      assert.equal(engine.kinds[c], Kind.Ram);
      assert.equal(engine.looks[c], 26);
    }
  }
});

test("Murphy walks a cell in eight ticks", () => {
  const level = levels()[0];
  assert.ok(level);
  engine.start(level.bytes);
  const from = engine.murphy;
  // Level 1 has base all round Murphy's start.
  const right = input(Dir.Right, false);
  let events = 0;
  for (let t = 0; t < STEP; t++) events |= engine.step(right);
  assert.equal(engine.murphy.cell, from.cell + 1);
  assert.ok(events & Event.Eat);
  assert.equal(engine.status, Status.Playing);
});

test("the same keys play the same game", () => {
  const level = levels()[8];
  assert.ok(level);
  const play = () => {
    engine.start(level.bytes, 9);
    let trace = 0;
    for (let t = 0; t < 1500; t++) {
      engine.step(Math.floor(t / 40) % 5);
      trace = (trace * 31 + engine.murphy.cell + engine.remaining) >>> 0;
    }
    return trace;
  };
  assert.equal(play(), play());
});

test("keys are the demo bytes", () => {
  assert.equal(input(null, false), 0);
  assert.equal(input(Dir.Up, false), 1);
  assert.equal(input(Dir.Right, false), 4);
  assert.equal(input(Dir.Left, true), 6);
  assert.equal(input(null, true), 9);
});

test("a falling Zonk: the cell it leaves, and its fall in the arrays", () => {
  engine.start(picture(["O", " ", " ", " ", "M"]));
  const from = at(1, 1);
  const below = at(1, 2);
  engine.step(0);
  assert.equal(engine.phases[from], Phase.Settling);
  engine.step(0);
  assert.equal(engine.kinds[from], Kind.Vacating);
  assert.equal(engine.kinds[below], Kind.Zonk);
  assert.equal(engine.dirs[below], Dir.Down);
  assert.equal(engine.phases[below], Phase.Falling);
  assert.ok((engine.flags[below] ?? 0) & Flag.Moving);
  const progress = engine.progs[below] ?? 0;
  engine.step(0);
  assert.equal(engine.progs[below], progress + 1);
});

test("a red disk: picked up, set down by holding Space, and its blast", () => {
  engine.start(picture(["MR   "]));
  let events = 0;
  while (!(events & Event.RedPicked))
    events = engine.step(input(Dir.Right, false));
  assert.equal(engine.redDisks, 1);
  // Space alone arms only after a tick with no key, standing still.
  for (let t = 0; t < 12; t++) engine.step(0);
  const cell = engine.murphy.cell;
  let ticks = 0;
  while (!(engine.step(input(null, true)) & Event.RedDropped)) ticks++;
  assert.ok(ticks > 30, `held Space for ${ticks} ticks`);
  assert.equal(engine.redDisks, 0);
  const planted = engine.planted;
  assert.ok(planted);
  assert.equal(planted.cell, cell);
  engine.step(0);
  assert.equal(engine.planted?.fuse, planted.fuse - 1);

  while (engine.status === Status.Playing) events = engine.step(0);
  assert.equal(engine.status, Status.Dying);
  assert.deepEqual(engine.death, { cause: Cause.Blast, cell });
  assert.equal(engine.planted, null);
  assert.equal(engine.kinds[cell], Kind.Explosion);
  assert.ok((engine.timers[cell] ?? 0) > 0);
  while (engine.status === Status.Dying) engine.step(0);
  assert.equal(engine.status, Status.Dead);
});

test("a Snik Snak that reaches Murphy kills him, and says so", () => {
  engine.start(picture(["M S"]));
  let events = 0;
  while (engine.status === Status.Playing) events |= engine.step(0);
  assert.ok(events & Event.Death);
  assert.deepEqual(engine.death, { cause: Cause.Enemy, cell: at(1, 1) });
});

test("an Infotron counts down to an open exit, and the exit wins", () => {
  engine.start(picture(["M@E"], 1));
  assert.equal(engine.needed, 1);
  assert.equal(engine.remaining, 1);
  let events = 0;
  for (let t = 0; t < 40 && engine.status === Status.Playing; t++)
    events |= engine.step(input(Dir.Right, false));
  assert.ok(events & Event.Infotron);
  assert.ok(events & Event.ExitOpen);
  assert.ok(events & Event.Win);
  assert.equal(engine.remaining, 0);
  assert.equal(engine.status, Status.Won);
  assert.equal(engine.death.cause, Cause.None);
});

test("a level's settings start as the level says", () => {
  const bytes = picture(["M"]);
  bytes[1444] = 1;
  bytes[1469] = 2;
  engine.start(bytes);
  assert.equal(engine.gravity, true);
  assert.equal(engine.frozenZonks, true);
  assert.equal(engine.frozenEnemies, false);
  engine.start(picture(["M"]));
  assert.equal(engine.gravity, false);
  assert.equal(engine.frozenZonks, false);
});

test("a level without Murphy does not start", () => {
  assert.equal(engine.start(picture(["@"])), false);
});

test("a saved game restores to the same tick, in this engine or another", async () => {
  const level = levels()[0];
  assert.ok(level);
  engine.start(level.bytes, 5);
  for (let t = 0; t < 30; t++) engine.step(input(Dir.Right, false));
  const saved = engine.save();
  const at = { tick: engine.tick, murphy: engine.murphy.cell };
  const kinds = engine.kinds.slice();
  for (let t = 0; t < 50; t++) engine.step(input(Dir.Down, false));
  assert.notEqual(engine.tick, at.tick);

  engine.restore(saved);
  assert.deepEqual({ tick: engine.tick, murphy: engine.murphy.cell }, at);
  assert.deepEqual(engine.kinds, kinds);

  const other = await Engine.load();
  other.restore(saved);
  for (let t = 0; t < 50; t++) {
    engine.step(input(Dir.Down, false));
    other.step(input(Dir.Down, false));
  }
  assert.equal(other.murphy.cell, engine.murphy.cell);
  assert.deepEqual(other.kinds, engine.kinds);
});

test("only a snapshot from save restores", () => {
  assert.throws(() => engine.restore(Object.freeze({}) as Snapshot), TypeError);
});

test("run plays a long stretch of keys, and stops when the game does", () => {
  engine.start(picture(["M  "]));
  // More keys than the module takes at once.
  assert.equal(engine.run(new Uint8Array(10_000)), 10_000);
  assert.equal(engine.tick, 10_000);

  engine.start(picture(["M S"]));
  const played = engine.run(new Uint8Array(500));
  assert.ok(played < 500, `stopped after ${played} ticks`);
  assert.equal(engine.status, Status.Dying);
});

test("a bug says when it starts sparking", () => {
  const bytes = picture(["M  ", "   "]);
  bytes[at(2, 2)] = Kind.Bug;
  engine.start(bytes);
  let events = 0;
  for (let t = 0; t < 1000; t++) events |= engine.step(0);
  assert.ok(events & Event.BugSpark);
});
