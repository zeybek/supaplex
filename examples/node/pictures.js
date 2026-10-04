// PNG pictures of levels, made without a canvas, so they work in Node, a
// browser or a Worker, for a link's preview, a gallery or a thumbnail.
//
//   node examples/node/pictures.js
import { mkdirSync, writeFileSync } from "node:fs";
import { levelPicture } from "@zeybek/supaplex";
import { levels } from "@zeybek/supaplex/levels";

const out = new URL("out/", import.meta.url);
mkdirSync(out, { recursive: true });

const all = levels();

// The second argument is pixels a cell. It is 4 by default, so 240 by 96.
writeFileSync(new URL("level-1.png", out), await levelPicture(all[0].bytes));
writeFileSync(
  new URL("level-1-large.png", out),
  await levelPicture(all[0].bytes, 16),
);

// One small picture for every level.
const started = performance.now();
for (const level of all) {
  const png = await levelPicture(level.bytes, 2);
  writeFileSync(new URL(`level-${level.number}-small.png`, out), png);
}
const ms = performance.now() - started;
console.log(
  `${all.length} pictures in ${ms.toFixed(0)} ms, in ${out.pathname}`,
);
