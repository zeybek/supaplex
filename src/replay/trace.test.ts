import assert from "node:assert/strict";
import { beforeAll, test } from "vitest";
import { at, picture } from "../../test/picture.ts";
import { Dir, Engine, Event, input, Status } from "../index.ts";
import { decodeDemo, encodeDemo, type Run } from "./run.ts";
import { divergence, traceRun } from "./trace.ts";

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

test("a changed level parts from a run where Murphy first does something else", () => {
  const level = picture(["M.@..E"]);
  const right = input(Dir.Right, false);
  const run = play(level, 1, Array(200).fill(right));
  const trace = traceRun(engine, level, run);
  assert.equal(trace.murphy.length, run.ticks);
  assert.notEqual(trace.level, level, "a copy");

  assert.equal(divergence(engine, level, trace), null);
  const aside = picture(["M.@..E", "  .   "]);
  assert.equal(divergence(engine, aside, trace), null);

  // A wall in the way: Murphy stops short of it, and it is to blame, not
  // the base put further off at the same time.
  const walled = picture(["M.@.HE", "HHHHHH", "HHHHH."]);
  const parted = divergence(engine, walled, trace);
  assert.ok(parted);
  assert.equal(parted.cell, at(5, 1));
  assert.ok(parted.tick > 0 && parted.tick <= run.ticks);
  engine.start(walled, run.seed);
  engine.run(decodeDemo(run.demo).subarray(0, parted.tick - 1));
  const before = engine.murphy.cell;
  engine.start(level, run.seed);
  engine.run(decodeDemo(run.demo).subarray(0, parted.tick - 1));
  assert.equal(engine.murphy.cell, before);
});

test("a run also parts on a level with nothing in its way but its settings or its Murphy changed", () => {
  const level = picture(["M.@..E"], 1);
  const run = play(level, 1, Array(200).fill(input(Dir.Right, false)));
  const trace = traceRun(engine, level, run);
  // Needing two Infotrons, the run collects one and never leaves: no cell
  // is different there, so the blame is on Murphy's cell.
  const needy = picture(["M.@..E"], 2);
  const parted = divergence(engine, needy, trace);
  assert.ok(parted);
  engine.start(level, run.seed);
  engine.run(decodeDemo(run.demo).subarray(0, parted.tick));
  assert.equal(parted.cell, engine.murphy.cell);
  assert.deepEqual(divergence(engine, picture([" .@..E"]), trace), {
    tick: 0,
    cell: at(1, 1),
  });
});

test("a trace stops where the game does, even for a run that claims more ticks", () => {
  const level = picture(["MS  E"]);
  const trace = traceRun(engine, level, {
    seed: 1,
    ticks: 500,
    demo: encodeDemo([0]),
  });
  assert.ok(trace.murphy.length < 500);
  assert.equal(divergence(engine, level, trace), null);
});
