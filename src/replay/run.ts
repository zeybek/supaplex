import { Status } from "../engine/constants.ts";
import type { Engine } from "../engine/engine.ts";
import { fromBase64Url, toBase64Url } from "../formats/base64.ts";

/** A recorded win: the seed and the keys replay it exactly. */
export interface Run {
  seed: number;
  ticks: number;
  /** {@link encodeDemo}'s bytes, without the closing 0xFF. */
  demo: Uint8Array;
}

export const DEMO_END = 0xff;

/** As the game's demos store keys: the key in the low 4 bits, ticks held minus one in the high 4. */
export function encodeDemo(keys: ArrayLike<number>): Uint8Array {
  const out: number[] = [];
  let key = 0;
  let held = 0;
  for (const next of Array.from(keys, (k) => k & 0x0f)) {
    if (held > 0 && next === key && held < 16) {
      held++;
      continue;
    }
    if (held > 0) out.push(((held - 1) << 4) | key);
    key = next;
    held = 1;
  }
  if (held > 0) out.push(((held - 1) << 4) | key);
  return Uint8Array.from(out);
}

/** One key per tick, up to a 0xFF. */
export function decodeDemo(demo: ArrayLike<number>): Uint8Array {
  const bytes = Array.from(demo);
  const end = bytes.indexOf(DEMO_END);
  const held = end < 0 ? bytes : bytes.slice(0, end);
  const keys: number[] = [];
  for (const byte of held)
    for (let t = 0; t <= byte >> 4; t++) keys.push(byte & 0x0f);
  return Uint8Array.from(keys);
}

/** Replays the run; `won` only when it wins on exactly `run.ticks`. Restarts `engine`. */
export function verify(
  engine: Engine,
  level: Uint8Array,
  run: Run,
): { won: boolean; ticks: number } {
  if (!engine.start(level, run.seed)) return { won: false, ticks: 0 };
  engine.run(decodeDemo(run.demo));
  return {
    won: engine.status === Status.Won && engine.tick === run.ticks,
    ticks: engine.tick,
  };
}

/** A demo cut at the tick it wins; `null` when it never does. Restarts `engine`. */
export function runOf(
  engine: Engine,
  level: Uint8Array,
  seed: number,
  demo: Uint8Array,
): Run | null {
  if (!engine.start(level, seed)) return null;
  const keys = decodeDemo(demo);
  engine.run(keys);
  if (engine.status !== Status.Won) return null;
  return {
    seed,
    ticks: engine.tick,
    demo: encodeDemo(keys.subarray(0, engine.tick)),
  };
}

/** `r1.<seed>.<ticks>.<demo>`, safe in a URL. */
export function runToText(run: Run): string {
  return `r1.${run.seed}.${run.ticks}.${toBase64Url(run.demo)}`;
}

/** Takes untrusted input; `null` for anything but a run. */
export function runFromText(text: unknown): Run | null {
  if (typeof text !== "string" || text.length > 200_000) return null;
  const [version, seed, ticks, demo] = text.split(".");
  if (version !== "r1" || demo === undefined) return null;
  const s = Number(seed);
  const t = Number(ticks);
  const bytes = fromBase64Url(demo);
  if (
    !Number.isInteger(s) ||
    s < 0 ||
    s > 0xffffffff ||
    !Number.isInteger(t) ||
    t <= 0 ||
    !bytes ||
    bytes.includes(DEMO_END)
  )
    return null;
  return { seed: s, ticks: t, demo: bytes };
}
