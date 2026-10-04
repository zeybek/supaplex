import assert from "node:assert/strict";
import { beforeAll, test } from "vitest";
import { picture } from "../../test/picture.ts";
import { Dir, Engine, Event, input, Kind, Status, WIDTH } from "../index.ts";
import { levels } from "../levels.ts";
import {
  decodeDemo,
  encodeDemo,
  type Run,
  runFromText,
  runOf,
  runToText,
  verify,
} from "./run.ts";

let engine: Engine;

beforeAll(async () => {
  engine = await Engine.load();
});

function play(bytes: Uint8Array, seed: number, plan: number[]): Run {
  engine.start(bytes, seed);
  const keys: number[] = [];
  for (const key of plan) {
    keys.push(key);
    if (engine.step(key) & Event.Win) break;
  }
  assert.equal(engine.status, Status.Won);
  return { seed, ticks: engine.tick, demo: encodeDemo(keys) };
}

const right = input(Dir.Right, false);

test("demo bytes hold a key and how long it was held", () => {
  const keys = [4, 4, 4, 0, 0, 1, ...Array(40).fill(2)];
  const demo = encodeDemo(keys);
  // 3 x right, 2 x nothing, 1 x up, then left in runs of at most 16.
  assert.deepEqual([...demo], [0x24, 0x10, 0x01, 0xf2, 0xf2, 0x72]);
  assert.deepEqual([...decodeDemo(demo)], keys);
  assert.deepEqual([...decodeDemo([0x24, 0xff, 0x31])], [4, 4, 4]);
});

test("a run plays back to the same win on the same tick", () => {
  const bytes = picture([".M.@.E"]);
  const run = play(bytes, 7, Array(200).fill(right));
  assert.ok(run.ticks > 0);
  assert.ok(run.demo.length < 10, "a straight walk is a handful of bytes");
  assert.deepEqual(verify(engine, bytes, run), { won: true, ticks: run.ticks });
});

test("a run that claims a faster time, or was changed, is not believed", () => {
  const bytes = picture(["M.@.E"]);
  const run = play(bytes, 1, Array(200).fill(right));
  assert.equal(
    verify(engine, bytes, { ...run, ticks: run.ticks - 1 }).won,
    false,
  );
  const cut = { ...run, demo: encodeDemo(decodeDemo(run.demo).slice(0, 20)) };
  assert.equal(verify(engine, bytes, cut).won, false);
});

test("a level's run replays on the real levels too, keys and seed alone", () => {
  // Not a solution: some wandering on level 9, BUG FUNNY, whose bugs
  // spark at random. The same keys and seed give the same game.
  const bytes = levels()[8]?.bytes;
  assert.ok(bytes);
  const keys = Array.from({ length: 1200 }, (_, t) => Math.floor(t / 50) % 5);
  const trace = (seed: number) => {
    engine.start(bytes, seed);
    for (const key of decodeDemo(encodeDemo(keys))) engine.step(key);
    return [engine.murphy.cell, engine.remaining, engine.status, engine.tick];
  };
  assert.deepEqual(trace(9), trace(9));
});

test("runs as text, and nothing else read as one", () => {
  const run: Run = {
    seed: 42,
    ticks: 999,
    demo: Uint8Array.from([0x24, 0xf1, 0x00]),
  };
  const text = runToText(run);
  assert.match(text, /^r1\.42\.999\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(runFromText(text), run);
  for (const bad of [
    null,
    3,
    "",
    "r2.1.2.JA",
    "r1.x.2.JA",
    "r1.1.0.JA",
    "r1.1.2.%%",
    "r1.1.2./w",
  ])
    assert.equal(runFromText(bad), null, String(bad));
});

test("level 2, EXIT!, won by a path through its maze, comes back from text", async () => {
  const entry = levels()[1];
  assert.ok(entry);
  const field = entry.bytes;
  const start = field.indexOf(Kind.Murphy);
  const exit = field.indexOf(Kind.Exit);
  const steps: [number, number][] = [
    [-WIDTH, Dir.Up],
    [-1, Dir.Left],
    [WIDTH, Dir.Down],
    [1, Dir.Right],
  ];
  const from = new Map<number, [number, number]>([[start, [-1, -1]]]);
  const queue = [start];
  while (queue.length > 0) {
    const cell = queue.shift() ?? 0;
    if (cell === exit) break;
    for (const [offset, dir] of steps) {
      const next = cell + offset;
      const kind = field[next];
      if (from.has(next) || (kind !== Kind.Space && kind !== Kind.Exit))
        continue;
      from.set(next, [cell, dir]);
      queue.push(next);
    }
  }
  const path: number[] = [];
  for (let cell = exit; cell !== start; ) {
    const [back, dir] = from.get(cell) ?? [start, 0];
    path.unshift(dir);
    cell = back;
  }
  assert.ok(path.length > 20, `a maze, ${path.length} moves`);

  // Eight ticks an arrow per cell; then on into the exit until it lets him out.
  const plan = path.flatMap((dir) => Array(8).fill(input(dir as never, false)));
  const into = input(path.at(-1) as never, false);
  const run = play(field, entry.number, [...plan, ...Array(200).fill(into)]);
  const text = runToText(run);
  assert.ok(text.length < 400, `${text.length} characters`);
  const back = runFromText(text);
  assert.ok(back);
  assert.deepEqual(verify(engine, field, back), {
    won: true,
    ticks: run.ticks,
  });

  // The ghost: the run on a second engine keeps step with a live attempt
  // making the same moves, cell for cell, on every tick.
  const live = engine;
  await Engine.load().then((second) => {
    live.start(field, back.seed);
    second.start(field, back.seed);
    const keys = decodeDemo(back.demo);
    keys.forEach((key, t) => {
      live.step(plan[t] ?? into);
      second.step(key);
      assert.equal(second.murphy.cell, live.murphy.cell, `tick ${t}`);
    });
    assert.equal(second.status, Status.Won);
  });
});

test("no keys are no demo, and a level without Murphy wins no run", () => {
  assert.deepEqual([...encodeDemo([])], []);
  assert.deepEqual([...decodeDemo([])], []);
  const nobody = picture(["@ E"]);
  const run: Run = { seed: 0, ticks: 1, demo: Uint8Array.from([0x04]) };
  assert.deepEqual(verify(engine, nobody, run), { won: false, ticks: 0 });
  assert.equal(runOf(engine, nobody, 0, run.demo), null);
});
