# A level editor

An editor works on a level's 1536 bytes, and everything it needs is in the package. [`examples/editor`](../examples/editor) puts it all together in one page. A piece's key picks it and the right button clears. It has brush, fill, rectangle, outline, copy, paste, flip and turn tools with undo, the level's settings and special ports, and the list of what keeps the level from playing. A win in the same page becomes the level's solution, which you can watch again. When an edit breaks it, the page says at what time the run goes another way and marks the cell to blame. The level and its solution go out as a link or a `.SP` file, a `.DAT` level set opens and saves back, and a link's solution is checked before it is believed.

Start from `blankLevel()`, which already plays, with hardware round the edge, Murphy and an exit. Or start from a copy of an original level (`levels()[0].bytes.slice()`). `levels()` hands out the same arrays every time, so never change the original itself.

## Painting

`PIECES` is the palette. It has every piece a level can hold, with its code, a name and, for the common ones, a key. `paint(bytes, cell, code)` puts a piece in a cell and keeps the level sound. Painting Murphy moves him, so there is never a second one, and the special ports' table is rebuilt to match the field. Between two pointer events a fast drag skips cells, so paint the line between them.

```ts
import { blankLevel, cellsBetween, paint, PIECES } from "@zeybek/supaplex";

const level = blankLevel();
let selected = PIECES[1].code; // base
let last = -1;

function onPointer(cell: number, dragging: boolean) {
  const cells = dragging ? cellsBetween(last, cell) : [cell];
  for (const c of cells) paint(level, c, selected);
  last = cell;
}
```

Beyond the brush, `fill` paints an area of same pieces, `rectangle` a box or its outline, and `copyRegion`, `pasteRegion`, `flipRegion` and `rotateRegion` lift a region, put it elsewhere, mirror it and turn it, turning one-way ports and half chips round with it. All of them go through `paint`, so the level stays sound.

The title, gravity and the rest are in [the level's settings](levels-and-files.md#a-levels-settings), and `problems(level)` lets the editor say what keeps the level from playing and disable its Play button. [`examples/node/make-a-level.js`](../examples/node/make-a-level.js) makes a level with these tools and no page.

## Proving a level can be won

To test a level, play it. `engine.start(level)` takes the bytes as they are. Record the keys while the player plays. When `step` returns `Event.Win`, the keys up to that tick are a `Run` that proves the level can be won.

```ts
const keys: number[] = [];
// on each tick
const key = input(heldArrow, spaceHeld);
keys.push(key);
if (engine.step(key) & Event.Win) {
  proof = { seed, ticks: engine.tick, demo: encodeDemo(keys) };
}
```

Any change to the level can make the proof stale. Keep a `traceRun(engine, level, proof)` from when it was won, and after each change `verify` the proof again. When it no longer wins, `divergence(engine, level, trace)` says at which tick the run first goes another way and the cell most likely to blame, so the editor can show the author what their change broke.

## Sharing

`sharedToHash({ level, run: proof })` gives a URL fragment, so the level never reaches a server. An original level alone takes 135 to 837 characters, 541 for the middle one, and level 5 with the game's own 164-second solution to it takes 1,536. Whoever opens the link reads it back with `sharedFromHash` and checks the proof with `verify` before believing it. Adding `at`, a tick of the run, makes the link point at that moment. After `engine.start(level, run.seed)`, `engine.run(decodeDemo(run.demo).subarray(0, at))` puts the game exactly there, as [`examples/node/links.js`](../examples/node/links.js) shows.

A `.SP` file from `toSp(level, proof)` carries the proof as its demo, and the original game plays it too.

## API

| Export | |
|---|---|
| `PIECES: readonly Piece[]` | Every piece a level can hold, with a name and a key, in a palette's order. |
| `paint(bytes, cell, code): boolean` | Puts a piece in a cell. A second Murphy moves the first, and the special ports' table follows the field. |
| `cellsBetween(from, to): number[]` | The cells on a line between two, so a fast drag leaves no gaps. |
| `fill(bytes, cell, code): boolean` | Paints the area of same pieces around a cell. |
| `rectangle(bytes, from, to, code, outline?): boolean` | Paints a box, or only its edge. |
| `copyRegion(bytes, from, to): Region` | Lifts the pieces of a box. |
| `pasteRegion(bytes, region, cell): boolean` | Puts them back with their top left corner at a cell, cut at the field's edge. |
| `flipRegion(region, axis): Region` | Mirrors them, `"horizontal"` or `"vertical"`, turning one-way pieces round. |
| `rotateRegion(region, turns = 1): Region` | Turns them clockwise by quarter turns (negative turns go the other way), turning ports and half chips with them. |
| `traceRun(engine, level, run): Trace` | What the run does on the level, tick by tick (about 4 bytes a tick), to compare with later. |
| `divergence(engine, level, trace)` | `{ tick, cell }` where the run first goes another way on a changed level, or `null` when it plays as it did. |
| `levelToText(bytes)`, `levelFromText(text)` | A level as about 500 characters, for a link. |
| `sharedToHash(shared)`, `sharedFromHash(hash)` | A URL fragment carrying a level, a run that wins it and, with `at`, a moment of that run to open at (`Shared`). |
