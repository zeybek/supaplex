# Playing a level

```ts
import { Dir, Engine, input, Status } from "@zeybek/supaplex";
import { levels } from "@zeybek/supaplex/levels";

const engine = await Engine.load();
engine.start(levels()[0].bytes); // level 1, WARM UP

const events = engine.step(input(Dir.Right, false)); // one tick, 35 a second
engine.kinds; // what is in each cell, a Uint8Array(1440)
engine.murphy; // { cell, x, y, dir, action, tick, length }
engine.status === Status.Playing;
```

The engine runs the game. Your code calls `step` 35 times a second with the keys held, draws what the engine's arrays say, and plays sounds for the events `step` returns. In a browser, [`@zeybek/supaplex/canvas`](canvas.md) does the first two. This page is what those calls do, for a game that does them its own way. [`examples/node/play.js`](../examples/node/play.js) runs them with no screen.

## The game loop

The original ran at 35 ticks a second, and so does the game. Step it on a fixed clock that does not follow the display's frames.

```ts
const TICK_MS = 1000 / TICKS_PER_SECOND;
let owed = 0;
function frame(elapsed: number) {
  owed += elapsed;
  while (owed >= TICK_MS) {
    owed -= TICK_MS;
    const events = engine.step(input(heldArrow, spaceHeld));
    // play sounds for `events`
  }
  // draw
}
```

## Keys

`input(direction, space)` gives the key byte the engine takes, from an arrow (`Dir.Up`, `Dir.Left`, `Dir.Down`, `Dir.Right` or `null`) and whether Space is held. Space with an arrow is a snap. Murphy eats or takes the cell beside him without moving. Space alone, pressed after a tick with no key and held for 64 ticks, sets a red disk down.

## Drawing

The field is `WIDTH` by `HEIGHT` (60 by 24) cells, row by row from the top left, so cell `c` is at `x = c % WIDTH`, `y = Math.floor(c / WIDTH)`. After every `step`, these arrays (1440 entries, one per cell) say what to draw.

| Array | Holds |
|---|---|
| `kinds` | What is in the cell, such as `Kind.Zonk`, `Kind.Murphy` or `Kind.Explosion`. |
| `looks` | The level file's code for how it looks. The decorative chips and hardware are `Look` codes but play as `Kind.Ram` and `Kind.Hardware`. |
| `flags` | `Flag` bits. With `Flag.Moving`, the thing is still arriving from the cell behind its direction. |
| `dirs` | The way it moves or faces (`Dir`). For Snik Snaks and Electrons it is in eighths of a turn (0 up, 2 left, 4 down, 6 right, odd values halfway through a turn), so halve it for a `Dir`. |
| `progs` | Ticks into its move, out of `STEP` (8), or out of `SLIDE` (6) when `phases` says `Phase.Rolling`. |
| `phases` | Where a Zonk, Infotron or orange disk is in its fall (`Phase`). |
| `timers` | Ticks an explosion still burns. |

To move things smoothly, draw a moving cell short of its place by `(STEP - progs[c]) / STEP` of a cell, back against `dirs[c]`. Murphy is drawn from `engine.murphy`, which has his cell (already the one he is moving into), the way he faces, his `Action`, and `tick` out of `length` for its animation. `engine.planted` is the red disk he set down and its fuse.

The arrays are views into the module's memory, so reading them costs nothing. They change with every `step`. To keep one, copy it with `slice()`.

## Sound

`step` returns the tick's `Event` bits, which are `Infotron`, `Explosion`, `Push`, `Eat`, `Death`, `Win`, `Terminal`, `Port`, `Gravity`, `RedPicked`, `RedDropped`, `ExitOpen`, `Landed` (a falling Zonk or Infotron coming to rest) and `BugSpark`. They are made to be played as sounds.

## The end of a level

`engine.status` is `Status.Playing`, then `Won`, or `Dying` and then `Dead`. `engine.death` says why Murphy died (`Cause.Crushed`, `Enemy`, `Blast` or `Bug`) and where. The rest of the panel comes from `engine.remaining` (Infotrons still needed), `engine.needed`, `engine.redDisks`, `engine.gravity` and `engine.tick`.

## Save states

`engine.save()` takes the whole game as it is now, and `engine.restore(saved)` goes back to it, in the same engine or another. Use it to rewind, to keep checkpoints, or to try a move and take it back. A snapshot is about 21 KB and takes microseconds. Only `save` makes snapshots, so `restore` can never be handed a broken game.

`engine.run(keys)` plays a stretch of keys, one a tick, in one call into the module, and stops when the game ends. It's much faster than calling `step` for each key, for replaying or checking runs. [`examples/node/save-states.js`](../examples/node/save-states.js) uses both, and [`examples/replay`](../examples/replay) goes back and forth through a recorded game with them.

## API

| Export | |
|---|---|
| `Engine.load(): Promise<Engine>` | A new engine. The bundled module is compiled once and shared. |
| `Engine.fromModule(module): Promise<Engine>` | An engine from a module compiled elsewhere, such as `@zeybek/supaplex/engine.wasm` ([runs](runs.md#cloudflare-workers)). |
| `engine.start(level, seed = 1): boolean` | Starts a level from its 1536 bytes, with the seed's low 16 bits. `false` when the level has no Murphy. |
| `engine.step(key): number` | One tick with the keys from `input`. Returns its `Event` bits. |
| `engine.run(keys): number` | One tick per key in one call, stopping when the game ends, and returns the ticks played. |
| `engine.save(): Snapshot`, `engine.restore(saved)` | The whole game now, and back to it, in this engine or another. |
| `engine.kinds` `looks` `dirs` `progs` `flags` `phases` | Per-cell `Uint8Array`s, described under [Drawing](#drawing). |
| `engine.timers` | A per-cell `Uint16Array` of the ticks each explosion still burns. |
| `engine.murphy: MurphyState` | `{ cell, x, y, dir, action, tick, length }`. |
| `engine.status`, `engine.death` | A `Status`, and `{ cause, cell }` with a `Cause`. |
| `engine.tick` `needed` `remaining` `redDisks` | Ticks since the start, Infotrons needed and still to collect, red disks carried. |
| `engine.gravity` `frozenZonks` `frozenEnemies` | The settings special ports can change during play. |
| `engine.planted` | `{ cell, fuse }` of the red disk set down, or `null`. |
| `ENGINE_BYTES` | The module's size in bytes. |
| `WIDTH`, `HEIGHT`, `CELLS` | 60, 24 and 1440. |
| `LEVEL_BYTES` | 1536, which is the cells and then 96 bytes of settings. |
| `TICKS_PER_SECOND`, `STEP`, `SLIDE` | 35 ticks a second, 8 ticks a move, 6 ticks a sideways roll. |
| `input(direction, space): number` | The keys held, as `step` takes them. |
| `Kind`, `Look`, `Dir`, `Flag`, `Phase` | The per-cell arrays' values. |
| `Status`, `Action`, `Cause`, `Event` | The game's, Murphy's and the tick's. |
