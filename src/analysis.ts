/**
 * What a winning run says about its level, found by replaying it many
 * times with one thing changed; seconds to minutes on a long run. Each
 * function restarts `engine` and returns `null` when `run` does not win
 * `level`.
 *
 * @module
 */
import { CELLS, Kind, Status } from "./engine/constants.ts";
import type { Engine, Snapshot } from "./engine/engine.ts";
import { sameSnapshot } from "./engine/snapshot.ts";
import { readSettings, specialsFor, writeSettings } from "./formats/level.ts";
import { decodeDemo, type Run } from "./replay/run.ts";

function wins(
  engine: Engine,
  level: Uint8Array,
  seed: number,
  keys: Uint8Array,
): boolean {
  if (!engine.start(level, seed)) return false;
  engine.run(keys);
  return engine.status === Status.Won;
}

/** How far one change of keys can move, in ticks, and the run still win. */
export interface TimingWindow {
  tick: number;
  /** The keys from then on; 0 when they are let go. */
  key: number;
  early: number;
  late: number;
}

/**
 * For every change of keys in the run, how far it can move earlier and
 * later, at most `maxShift` ticks and never past its neighbours, and the
 * run still win, up to `maxShift` ticks late. 0 both ways is frame-perfect.
 *
 * @throws RangeError when `maxShift` is not a whole number.
 */
export function timingWindows(
  engine: Engine,
  level: Uint8Array,
  run: Run,
  { maxShift = 8 }: { maxShift?: number } = {},
): TimingWindow[] | null {
  if (!Number.isInteger(maxShift) || maxShift < 0)
    throw new RangeError(`Not a whole number of ticks: ${maxShift}`);
  const keys = decodeDemo(run.demo).subarray(0, run.ticks);
  if (!wins(engine, level, run.seed, keys)) return null;
  // Its last keys held longer, so a try that wins a little late counts.
  const padded = new Uint8Array(keys.length + maxShift);
  padded.set(keys);
  padded.fill(keys[keys.length - 1] as number, keys.length);
  const held = (t: number) => (t < 0 ? 0 : (keys[t] as number));
  const changes: number[] = [];
  const saved = new Map<number, Snapshot>();
  engine.start(level, run.seed);
  saved.set(0, engine.save());
  for (let t = 0; t < keys.length; t++) {
    if (held(t) !== held(t - 1)) {
      changes.push(t);
      if (t > 0) saved.set(t, engine.save());
    }
    engine.step(held(t));
  }

  // From `same` on, `tried` holds the run's keys: a game that matches the
  // run's at a change from there plays out as the run did.
  const holds = (tried: Uint8Array, from: number, same: number): boolean => {
    engine.restore(saved.get(from) as Snapshot);
    let at = from;
    for (const next of [...changes.filter((c) => c > from), tried.length]) {
      at += engine.run(tried.subarray(at, next));
      if (engine.status !== Status.Playing) return engine.status === Status.Won;
      const was = saved.get(next);
      if (next >= same && was && sameSnapshot(engine.save(), was)) return true;
    }
    return false;
  };

  return changes.map((tick, i) => {
    const before = changes[i - 1] ?? -1;
    const after = changes[i + 1] ?? padded.length;
    const key = held(tick);
    let early = 0;
    while (early < maxShift && tick - early - 1 > before) {
      const tried = padded.slice();
      tried.fill(key, tick - early - 1, tick);
      if (!holds(tried, Math.max(before, 0), tick)) break;
      early++;
    }
    let late = 0;
    while (late < maxShift && tick + late + 1 < after) {
      const tried = padded.slice();
      tried.fill(held(tick - 1), tick, tick + late + 1);
      if (!holds(tried, tick, tick + late + 1)) break;
      late++;
    }
    return { tick, key, early, late };
  });
}

/** A copy with `cells` turned into `code`, its special ports' table rebuilt. */
function changed(
  level: Uint8Array,
  cells: Iterable<number>,
  code: number,
): Uint8Array {
  const out = level.slice();
  for (const cell of cells) out[cell] = code;
  const settings = readSettings(out);
  writeSettings(out, {
    ...settings,
    specials: specialsFor(out, settings.specials),
  });
  return out;
}

/** What a cell becomes; `null` leaves it. */
export type CellChange = (code: number, cell: number) => number | null;

/**
 * Changes the cells one at a time and replays the run. Murphy's cell is
 * not tried.
 *
 * @returns Per cell: the ticks the run then wins in, -1 when it no longer
 *   wins, 0 when not tried.
 */
export function influenceMap(
  engine: Engine,
  level: Uint8Array,
  run: Run,
  change: number | CellChange = Kind.Hardware,
): Int32Array | null {
  const keys = decodeDemo(run.demo);
  if (!wins(engine, level, run.seed, keys)) return null;
  const to = typeof change === "number" ? () => change : change;
  const map = new Int32Array(CELLS);
  for (let cell = 0; cell < CELLS; cell++) {
    const code = level[cell] as number;
    const next = to(code, cell);
    if (code === Kind.Murphy || next === null || next === code) continue;
    const tried = changed(level, [cell], next);
    map[cell] = wins(engine, tried, run.seed, keys) ? engine.tick : -1;
  }
  return map;
}

/**
 * The level with as many cells as possible turned into `fill` while the run
 * still wins: large blocks first, then smaller ones, as in delta debugging.
 *
 * @throws RangeError when `fill` is Murphy.
 */
export function levelCore(
  engine: Engine,
  level: Uint8Array,
  run: Run,
  fill: number = Kind.Hardware,
): Uint8Array | null {
  if (fill === Kind.Murphy) throw new RangeError("Murphy cannot fill a level");
  const keys = decodeDemo(run.demo);
  if (!wins(engine, level, run.seed, keys)) return null;
  let keep: number[] = [];
  for (let cell = 0; cell < CELLS; cell++) {
    const code = level[cell] as number;
    if (code !== fill && code !== Kind.Murphy) keep.push(cell);
  }
  let core: Uint8Array = level.slice();
  let parts = 2;
  while (keep.length > 0) {
    const size = Math.ceil(keep.length / parts);
    let removed = false;
    for (let from = 0; from < keep.length; from += size) {
      const block = keep.slice(from, from + size);
      const tried = changed(core, block, fill);
      if (!wins(engine, tried, run.seed, keys)) continue;
      core = tried;
      keep = [...keep.slice(0, from), ...keep.slice(from + size)];
      parts = Math.max(parts - 1, 2);
      removed = true;
      break;
    }
    if (removed) continue;
    // Nothing went: smaller blocks, down to single cells.
    if (size === 1) break;
    parts = Math.min(parts * 2, keep.length);
  }
  return core;
}
