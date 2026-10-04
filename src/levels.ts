/**
 * The original 111 levels, in an entry point of their own because they
 * add about 230 KB. They are the original authors' freeware, not MIT.
 *
 * @module
 */
import { fromBase64 } from "./formats/base64.ts";
import { type Level, parseLevel } from "./formats/level.ts";
import { readLevelSet } from "./formats/level-set.ts";
import { LEVELS_DAT } from "./generated/levels.ts";

export type { Level } from "./formats/level.ts";

let parsed: Level[] | null = null;

/** The same array and levels on every call: copy `bytes` before changing them. */
export function levels(): Level[] {
  // A test holds LEVELS.DAT to being a whole set.
  parsed ??= (readLevelSet(fromBase64(LEVELS_DAT)) as Uint8Array[]).map(
    (bytes, i) => parseLevel(bytes, i + 1),
  );
  return parsed;
}
