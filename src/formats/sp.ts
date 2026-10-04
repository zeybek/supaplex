// A .SP file is a level, then optionally a demo: a byte with the level's
// number and its high bit set, the keys, and 0xFF.
import { LEVEL_BYTES } from "../engine/constants.ts";
import { DEMO_END, type Run } from "../replay/run.ts";
import { isLevel } from "./level.ts";

/** A copy of the level; `null` when there is none the engine plays. */
export function fromSp(file: Uint8Array): Uint8Array | null {
  if (file.length < LEVEL_BYTES) return null;
  const bytes = file.slice(0, LEVEL_BYTES);
  return isLevel(bytes) ? bytes : null;
}

/** The demo's seed, low byte first. */
const SEED = 1534;

/** The demo and its seed; its length is not stored, so {@link runOf} cuts it to a run. */
export function spDemo(
  file: Uint8Array,
): { seed: number; demo: Uint8Array } | null {
  if (file.length <= LEVEL_BYTES + 1) return null;
  const end = file.indexOf(DEMO_END, LEVEL_BYTES + 1);
  const demo = file.slice(LEVEL_BYTES + 1, end < 0 ? file.length : end);
  if (demo.length === 0) return null;
  const seed = (file[SEED] as number) | ((file[SEED + 1] as number) << 8);
  return { seed, demo };
}

/** With a run, as a demo the original game plays too. `number` is 0 for a level of your own. */
export function toSp(
  bytes: Uint8Array,
  run: Run | null = null,
  number = 0,
): Uint8Array {
  if (!run) return bytes.slice(0, LEVEL_BYTES);
  const out = new Uint8Array(LEVEL_BYTES + run.demo.length + 2);
  out.set(bytes.subarray(0, LEVEL_BYTES));
  out[SEED] = run.seed & 0xff;
  out[SEED + 1] = (run.seed >>> 8) & 0xff;
  out[LEVEL_BYTES] = 0x80 | (number & 0x7f);
  out.set(run.demo, LEVEL_BYTES + 1);
  out[out.length - 1] = DEMO_END;
  return out;
}
