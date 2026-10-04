// A level set, such as LEVELS.DAT, is levels of 1536 bytes one after
// another. Split one into .SP files, and join levels into a new set.
//
//   node examples/node/level-sets.js [LEVELS.DAT]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  parseLevel,
  readLevelSet,
  toSp,
  writeLevelSet,
} from "@zeybek/supaplex";
import { levels } from "@zeybek/supaplex/levels";

const out = new URL("out/", import.meta.url);
mkdirSync(out, { recursive: true });

// Without a file, the package's own copy of the original levels.
const path = process.argv[2];
const set = path
  ? readLevelSet(new Uint8Array(readFileSync(path)))
  : levels().map((level) => level.bytes);
if (!set) throw new Error(`${path} is not a level set`);
console.log(`${set.length} levels`);

for (const [i, bytes] of set.slice(0, 5).entries()) {
  const level = parseLevel(bytes, i + 1);
  const gravity = level.gravity ? ", gravity" : "";
  console.log(
    `${level.number}. ${level.title.trim()}, ${level.needed} Infotrons${gravity}`,
  );
  // The number goes into the .SP file, so the original game knows the level.
  writeFileSync(
    new URL(`level-${level.number}.sp`, out),
    toSp(bytes, null, i + 1),
  );
}

// A new set of the first five levels, in reverse order.
const mine = set.slice(0, 5).reverse();
writeFileSync(new URL("MINE.DAT", out), writeLevelSet(mine));
console.log(`Saved ${new URL("MINE.DAT", out).pathname} and five .SP files`);
