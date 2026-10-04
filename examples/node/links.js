// A level and a run that wins it, carried in a link. The link is written,
// read back, checked before it is believed, and opened at one moment.
//
//   node examples/node/links.js [solution.sp]
import { readFileSync } from "node:fs";
import {
  decodeDemo,
  Engine,
  fromSp,
  runOf,
  runToText,
  sharedFromHash,
  sharedToHash,
  spDemo,
  TICKS_PER_SECOND,
  verify,
} from "@zeybek/supaplex";

// The original game's DEMO5.BIN is a .SP file with level 5 and a solution.
const path =
  process.argv[2] ?? new URL("../../data/DEMO5.BIN", import.meta.url);
const file = new Uint8Array(readFileSync(path));
const level = fromSp(file);
const demo = spDemo(file);
if (!level || !demo) throw new Error("Not a .SP file with a demo");

// A demo cut at its win is a run, made of a seed, the ticks and the keys.
const engine = await Engine.load();
const run = runOf(engine, level, demo.seed, demo.demo);
if (!run) throw new Error("The demo does not win its level");
const seconds = (ticks) => (ticks / TICKS_PER_SECOND).toFixed(2);
console.log(`The run wins in ${run.ticks} ticks, ${seconds(run.ticks)} s`);
console.log(`As text it is ${runToText(run).length} characters`);

// A link that opens one minute into the run.
const minute = 60 * TICKS_PER_SECOND;
const hash = await sharedToHash({ level, run, at: minute });
const url = `https://example.com/play#${hash}`;
console.log(`The link is ${url.length} characters`);

// Whoever opens it reads it back, and replays the run before believing it.
const shared = await sharedFromHash(new URL(url).hash);
if (!shared?.run) throw new Error("No level and run in the link");
const { won, ticks } = verify(engine, shared.level, shared.run);
console.log(won ? `Checked, it wins in ${ticks} ticks` : "It does not win");

// Then plays the run up to the moment the link points at.
engine.start(shared.level, shared.run.seed);
engine.run(decodeDemo(shared.run.demo).subarray(0, shared.at));
const { x, y } = engine.murphy;
console.log(
  `At ${seconds(engine.tick)} s Murphy is at (${x}, ${y}), with ${engine.remaining} Infotrons still needed`,
);
