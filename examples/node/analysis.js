// What a winning run says about its level, from @zeybek/supaplex/analysis:
// how precise each key press must be, which cells the run depends on, and
// the smallest level the same run still wins.
//
// The level here is a corridor. Murphy stops under an Infotron, takes it
// without moving (Space and Up, a snap), and walks on to the exit. Each
// function replays the run many times, so on a long run they take seconds
// to minutes.
//
//   node examples/node/analysis.js
import {
  Action,
  CELLS,
  Dir,
  Engine,
  Event,
  encodeDemo,
  input,
  Kind,
  LEVEL_BYTES,
  paint,
  Status,
  WIDTH,
  writeSettings,
} from "@zeybek/supaplex";
import {
  influenceMap,
  levelCore,
  timingWindows,
} from "@zeybek/supaplex/analysis";

const at = (x, y) => y * WIDTH + x;

const level = new Uint8Array(LEVEL_BYTES).fill(Kind.Hardware, 0, CELLS);
for (let x = 2; x <= 20; x++) paint(level, at(x, 10), Kind.Base);
paint(level, at(2, 10), Kind.Murphy);
paint(level, at(20, 10), Kind.Exit);
paint(level, at(10, 9), Kind.Infotron);
paint(level, at(10, 8), Kind.Zonk);
writeSettings(level, {
  title: "snap",
  gravity: false,
  freezeZonks: false,
  needed: 1,
  specials: [],
});

// Playing it once, and keeping the keys, gives the run.
const engine = await Engine.load();
engine.start(level, 1);
const keys = [];
const hold = (key) => {
  keys.push(key);
  return engine.step(key);
};
// Right until Murphy stands still under the Infotron.
while (engine.murphy.x < 10 || engine.murphy.action !== Action.Idle)
  hold(input(Dir.Right, false));
// Space and Up until it is taken.
while (!(hold(input(Dir.Up, true)) & Event.Infotron));
// Right again, to the exit.
while (engine.status === Status.Playing) hold(input(Dir.Right, false));
const run = { seed: 1, ticks: engine.tick, demo: encodeDemo(keys) };
console.log(`The run wins in ${run.ticks} ticks`);

// For each change of keys, how many ticks earlier or later it could come
// and the run still win. 0 is frame-perfect.
const NAMES = {
  [input(Dir.Right, false)]: "Right",
  [input(Dir.Up, true)]: "Space and Up",
};
for (const { tick, key, early, late } of timingWindows(engine, level, run))
  console.log(
    `  tick ${String(tick).padStart(3)}, ${NAMES[key].padEnd(12)} ${early} early, ${late} late`,
  );

// Each cell turned into hardware in turn. "!" marks where the run then
// loses, "~" where it wins in another time, and "#" where there was
// hardware already.
const map = influenceMap(engine, level, run);
function mark(cell) {
  if (map[cell] === -1) return "!";
  if (map[cell] === 0) return "#";
  return map[cell] === run.ticks ? " " : "~";
}
for (let y = 7; y <= 11; y++) {
  let row = "  ";
  for (let x = 1; x <= 21; x++) row += mark(at(x, y));
  console.log(row);
}

// As much of the level as possible turned into hardware, the run still
// winning. The Zonk goes, because this run never needs it.
const core = levelCore(engine, level, run);
const kept = (bytes) =>
  bytes.subarray(0, CELLS).filter((code) => code !== Kind.Hardware).length;
console.log(
  `The core keeps ${kept(core)} of the ${kept(level)} cells that are not hardware`,
);
console.log(
  core[at(10, 8)] === Kind.Hardware ? "The Zonk is gone" : "The Zonk stays",
);
