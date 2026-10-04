import { CELLS, LEVEL_BYTES, Status, WIDTH } from "../engine/constants.ts";
import type { Engine } from "../engine/engine.ts";
import { decodeDemo, type Run } from "./run.ts";

/** What a run does on its level, tick by tick, for {@link divergence}. */
export interface Trace {
  level: Uint8Array;
  run: Run;
  /** Per tick, packed: Murphy's cell, action and direction, Infotrons left, status. */
  murphy: Uint32Array;
}

function murphySign(engine: Engine): number {
  const { cell, action, dir } = engine.murphy;
  return (
    (cell |
      (action << 11) |
      (dir << 15) |
      (engine.remaining << 17) |
      (engine.status << 25)) >>>
    0
  );
}

/** About 4 bytes a tick. Restarts `engine`. */
export function traceRun(engine: Engine, level: Uint8Array, run: Run): Trace {
  const keys = decodeDemo(run.demo);
  const murphy = new Uint32Array(run.ticks);
  engine.start(level, run.seed);
  let t = 0;
  while (t < run.ticks && engine.status === Status.Playing) {
    engine.step(keys[t] ?? 0);
    murphy[t++] = murphySign(engine);
  }
  return {
    level: level.slice(0, LEVEL_BYTES),
    run,
    murphy: murphy.slice(0, t),
  };
}

/**
 * The first tick Murphy or the game does otherwise on a changed level, and
 * the changed cell nearest where Murphy was (his own cell if none). The
 * whole field is not compared: a changed level differs from the start.
 * Restarts `engine`.
 *
 * @returns `null` when the run plays as it did.
 */
export function divergence(
  engine: Engine,
  level: Uint8Array,
  trace: Trace,
): { tick: number; cell: number } | null {
  const { run, murphy } = trace;
  const keys = decodeDemo(run.demo);
  const expected = (t: number) => (murphy[t - 1] as number) & 0x7ff;
  if (!engine.start(level, run.seed)) {
    engine.start(trace.level, run.seed);
    return { tick: 0, cell: engine.murphy.cell };
  }
  for (let t = 1; t <= murphy.length; t++) {
    engine.step(keys[t - 1] ?? 0);
    if (murphySign(engine) === murphy[t - 1]) continue;
    const changed = engine.kinds.slice();
    engine.start(trace.level, run.seed);
    engine.run(keys.subarray(0, t));
    const was = engine.kinds;
    const at = expected(t);
    let cell = at;
    let nearest = Number.POSITIVE_INFINITY;
    for (let c = 0; c < CELLS; c++) {
      if (changed[c] === was[c]) continue;
      const away =
        Math.abs((c % WIDTH) - (at % WIDTH)) +
        Math.abs(Math.floor(c / WIDTH) - Math.floor(at / WIDTH));
      if (away < nearest) {
        nearest = away;
        cell = c;
      }
    }
    return { tick: t, cell };
  }
  return null;
}
