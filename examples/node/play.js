// The engine with no screen. Start a level, hold keys tick by tick, and
// read what happened from the events and the per-cell arrays.
//
//   node examples/node/play.js
import {
  Dir,
  Engine,
  Event,
  HEIGHT,
  input,
  Kind,
  Status,
  WIDTH,
} from "@zeybek/supaplex";
import { levels } from "@zeybek/supaplex/levels";

const level = levels()[0];
const engine = await Engine.load();
engine.start(level.bytes);
console.log(`Level ${level.number}, ${level.title.trim()}`);
console.log(`Infotrons needed ${engine.needed}`);

const CHARS = {
  [Kind.Space]: " ",
  [Kind.Base]: ".",
  [Kind.Murphy]: "M",
  [Kind.Zonk]: "O",
  [Kind.Infotron]: "@",
  [Kind.Exit]: "E",
  [Kind.Hardware]: "#",
  [Kind.Ram]: "=",
};

/** The cells around Murphy as text, one character a cell. */
function around(radius = 3) {
  const { x, y } = engine.murphy;
  const rows = [];
  for (let row = y - radius; row <= y + radius; row++) {
    if (row < 0 || row >= HEIGHT) continue;
    let line = "";
    for (let col = x - radius; col <= x + radius; col++) {
      if (col < 0 || col >= WIDTH) continue;
      line += CHARS[engine.kinds[row * WIDTH + col]] ?? "?";
    }
    rows.push(`  ${line}`);
  }
  return rows.join("\n");
}

console.log(around());

// A move takes 8 ticks, so 16 ticks of Up move Murphy two cells, through
// base and then onto the Infotron above it. The game runs at 35 ticks a
// second.
for (let t = 0; t < 16; t++) {
  const events = engine.step(input(Dir.Up, false));
  if (events & Event.Eat) console.log(`tick ${engine.tick}, base eaten`);
  if (events & Event.Infotron)
    console.log(`tick ${engine.tick}, Infotron taken`);
}

// Then a second with no keys held.
for (let t = 0; t < 35; t++) engine.step(input(null, false));

const { x, y } = engine.murphy;
console.log(`Murphy is at (${x}, ${y}) after ${engine.tick} ticks`);
console.log(`Infotrons still needed ${engine.remaining}`);
console.log(around());
console.log(engine.status === Status.Playing ? "Still playing" : "Over");
