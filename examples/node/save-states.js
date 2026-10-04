// Save states keep the whole game at one moment, so you can try something
// and go back. Here Murphy tries each way from the same moment of level 1.
//
//   node examples/node/save-states.js
import { Dir, Engine, input } from "@zeybek/supaplex";
import { levels } from "@zeybek/supaplex/levels";

const engine = await Engine.load();
engine.start(levels()[0].bytes);

// Two seconds in, with no keys held.
engine.run(new Uint8Array(70));
const saved = engine.save();
console.log(`Saved at tick ${engine.tick}`);

const STATUS = ["playing", "won", "dying", "dead"];

for (const [name, dir] of Object.entries(Dir)) {
  engine.restore(saved);
  // run() plays one tick per key in a single call, much faster than a
  // step() for each, and stops early if the game ends.
  const keys = new Uint8Array(70).fill(input(dir, false));
  engine.run(keys);
  const { x, y } = engine.murphy;
  const taken = engine.needed - engine.remaining;
  console.log(
    `${name.padEnd(5)} Murphy at (${x}, ${y}), Infotrons taken ${taken}, ${STATUS[engine.status]}`,
  );
}

// Back to the saved moment, as if none of that happened.
engine.restore(saved);
console.log(`Restored to tick ${engine.tick}, ${STATUS[engine.status]}`);

// A save is cheap enough to keep one every second for rewinding.
const started = performance.now();
for (let i = 0; i < 1000; i++) engine.restore(engine.save());
const each = (performance.now() - started) / 1000;
console.log(`A save and a restore take ${(each * 1000).toFixed(0)} µs`);
