// `.DAT` level sets: levels of 1536 bytes, one after another.
import { LEVEL_BYTES } from "../engine/constants.ts";
import { isLevel } from "./level.ts";

/** Copies of its levels; `null` unless the file is whole levels the engine plays. */
export function readLevelSet(file: Uint8Array): Uint8Array[] | null {
  if (file.length === 0 || file.length % LEVEL_BYTES !== 0) return null;
  const levels: Uint8Array[] = [];
  for (let at = 0; at < file.length; at += LEVEL_BYTES) {
    const level = file.slice(at, at + LEVEL_BYTES);
    if (!isLevel(level)) return null;
    levels.push(level);
  }
  return levels;
}

export function writeLevelSet(levels: readonly Uint8Array[]): Uint8Array {
  const file = new Uint8Array(levels.length * LEVEL_BYTES);
  levels.forEach((level, i) => {
    file.set(level.subarray(0, LEVEL_BYTES), i * LEVEL_BYTES);
  });
  return file;
}
