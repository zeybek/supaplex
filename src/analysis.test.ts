import assert from "node:assert/strict";
import { beforeAll, test } from "vitest";
import { at, picture } from "../test/picture.ts";
import {
  influenceMap,
  levelCore,
  type TimingWindow,
  timingWindows,
} from "./analysis.ts";
import { paint } from "./editor/paint.ts";
import { CELLS, Dir, Event, input, Kind, Status } from "./engine/constants.ts";
import { Engine } from "./engine/engine.ts";
import { readSettings } from "./formats/level.ts";
import { decodeDemo, encodeDemo, type Run, verify } from "./replay/run.ts";

let engine: Engine;
beforeAll(async () => {
  engine = await Engine.load();
});

const RIGHT = input(Dir.Right, false);
const DOWN = input(Dir.Down, false);

function runOf(level: Uint8Array, plan: number[]): Run {
  engine.start(level, 1);
  const keys: number[] = [];
  for (const key of plan) {
    keys.push(key);
    if (engine.step(key) & Event.Win) break;
  }
  assert.equal(engine.status, Status.Won);
  return { seed: 1, ticks: keys.length, demo: encodeDemo(keys) };
}

const hold = (key: number, ticks: number) => Array<number>(ticks).fill(key);

/** Timing windows the slow way: every try replayed from the start. */
function slowWindows(
  level: Uint8Array,
  run: Run,
  maxShift = 8,
): TimingWindow[] {
  const keys = decodeDemo(run.demo).subarray(0, run.ticks);
  const padded = new Uint8Array(keys.length + maxShift);
  padded.set(keys);
  padded.fill(keys[keys.length - 1] as number, keys.length);
  const held = (t: number) => (t < 0 ? 0 : (keys[t] as number));
  const changes = [...keys.keys()].filter((t) => held(t) !== held(t - 1));
  const wins = (tried: Uint8Array) => {
    engine.start(level, run.seed);
    engine.run(tried);
    return engine.status === Status.Won;
  };
  return changes.map((tick, i) => {
    const before = changes[i - 1] ?? -1;
    const after = changes[i + 1] ?? padded.length;
    let early = 0;
    for (; early < maxShift && tick - early - 1 > before; early++) {
      const tried = padded.slice();
      tried.fill(held(tick), tick - early - 1, tick);
      if (!wins(tried)) break;
    }
    let late = 0;
    for (; late < maxShift && tick + late + 1 < after; late++) {
      const tried = padded.slice();
      tried.fill(held(tick - 1), tick, tick + late + 1);
      if (!wins(tried)) break;
    }
    return { tick, key: held(tick), early, late };
  });
}

test("timing windows: how far each change of keys can move, as full replays find it", () => {
  // Right, then down past a wall's corner, then right again to the exit.
  const corner = picture(["M.  ", "H.HH", "H..E"]);
  const run = runOf(corner, [
    ...hold(RIGHT, 8),
    ...hold(DOWN, 16),
    ...hold(RIGHT, 40),
  ]);
  const windows = timingWindows(engine, corner, run);
  assert.deepEqual(windows, slowWindows(corner, run));
  assert.deepEqual(windows, [
    { tick: 0, key: RIGHT, early: 0, late: 7 },
    // Down a tick late, and Murphy has gone on right, past the gap.
    { tick: 8, key: DOWN, early: 7, late: 0 },
    { tick: 24, key: RIGHT, early: 7, late: 8 },
  ]);
  assert.deepEqual(
    timingWindows(engine, corner, run, { maxShift: 20 }),
    slowWindows(corner, run, 20),
  );
  const turn = picture(["M..H", "H..E"]);
  const turned = runOf(turn, [
    ...hold(RIGHT, 16),
    ...hold(DOWN, 10),
    ...hold(RIGHT, 40),
    0,
  ]);
  assert.deepEqual(
    timingWindows(engine, turn, turned),
    slowWindows(turn, turned),
  );
});

test("timing windows ask for a winning run and a whole number of ticks", () => {
  const level = picture(["M.E"]);
  const run = runOf(level, hold(RIGHT, 40));
  assert.deepEqual(timingWindows(engine, level, run, { maxShift: 0 }), [
    { tick: 0, key: RIGHT, early: 0, late: 0 },
  ]);
  assert.equal(timingWindows(engine, picture(["M.H.E"]), run), null);
  for (const maxShift of [-1, 1.5])
    assert.throws(
      () => timingWindows(engine, level, run, { maxShift }),
      RangeError,
    );
});

test("the influence map marks the cells a run needs, and leaves the rest", () => {
  // The run walks right along the top row; base lies below it.
  const level = picture(["M.@.E", " ... "]);
  const run = runOf(level, hold(RIGHT, 80));
  const walls = influenceMap(engine, level, run);
  assert.ok(walls);
  assert.equal(walls.length, CELLS);
  for (const x of [2, 3, 4, 5])
    assert.equal(walls[at(x, 1)], -1, `on the way, ${x}`);
  for (const x of [2, 3, 4])
    assert.equal(walls[at(x, 2)], run.ticks, `below, ${x}`);
  assert.equal(walls[at(1, 1)], 0, "Murphy is not tried");
  assert.equal(walls[at(0, 0)], 0, "hardware is already hardware");
  assert.equal(walls[at(1, 2)], run.ticks, "empty space walled");

  // Emptying base instead: only base is tried. The base under the
  // Infotron holds it up: emptied, the Infotron falls out of reach.
  const emptied = influenceMap(engine, level, run, (code) =>
    code === Kind.Base ? Kind.Space : null,
  );
  assert.ok(emptied);
  for (let cell = 0; cell < CELLS; cell++) {
    const tried = level[cell] === Kind.Base;
    const expected = cell === at(3, 2) ? -1 : tried ? run.ticks : 0;
    assert.equal(emptied[cell], expected, `cell ${cell}`);
  }
  assert.equal(influenceMap(engine, picture(["M.H.E"]), run), null);
});

test("a change that makes the run win at another time says when", () => {
  // Murphy pushes a Zonk on his way to the exit: without it, he walks.
  const level = picture(["M  O E", "   .  "]);
  const run = runOf(level, hold(RIGHT, 80));
  assert.equal(run.ticks, 48);
  const map = influenceMap(engine, level, run, Kind.Space);
  assert.ok(map);
  assert.equal(map[at(4, 1)], 33, "no Zonk to push");
  assert.equal(map[at(4, 2)], 33, "no base under it: it falls out of the way");
  assert.equal(influenceMap(engine, picture([" O E"]), run), null);
});

test("the core of a level is the least of it the run still wins", () => {
  const level = picture(["M..E", ".O..", "...."]);
  paint(level, at(2, 3), Kind.SpecialRight);
  const run = runOf(level, hold(RIGHT, 80));
  const core = levelCore(engine, level, run);
  assert.ok(core);
  const left = [...core.subarray(0, CELLS).keys()].filter(
    (cell) => core[cell] !== Kind.Hardware,
  );
  assert.deepEqual(left, [at(1, 1), at(2, 1), at(3, 1), at(4, 1)]);
  assert.equal(verify(engine, core, run).won, true);
  assert.equal(readSettings(core).specials.length, 0);
  assert.equal(readSettings(level).specials.length, 1);
  // Emptying instead of walling: Murphy walks through empty space as well
  // as base, so only he and the exit are left, walls and all gone.
  const hollow = levelCore(engine, level, run, Kind.Space);
  assert.ok(hollow);
  const kept = [...hollow.subarray(0, CELLS).keys()].filter(
    (cell) => hollow[cell] !== Kind.Space,
  );
  assert.deepEqual(kept, [at(1, 1), at(4, 1)]);
  assert.equal(verify(engine, hollow, run).won, true);
});

test("a core needs a winning run, and Murphy cannot fill it", () => {
  const level = picture(["M.E"]);
  const run = runOf(level, hold(RIGHT, 40));
  assert.equal(levelCore(engine, picture(["M.H.E"]), run), null);
  assert.throws(() => levelCore(engine, level, run, Kind.Murphy), RangeError);
  const bare = picture(["ME"]);
  const step = runOf(bare, hold(RIGHT, 40));
  const core = levelCore(engine, bare, step);
  assert.ok(core);
  assert.deepEqual([...core.subarray(0, CELLS)], [...bare.subarray(0, CELLS)]);
});
