# Analysis

`@zeybek/supaplex/analysis` works out what a winning run says about its level by playing it again with one thing changed, many times. It's a separate entry point, so a game that only plays never loads it.

- `timingWindows(engine, level, run)` moves each change of keys a tick earlier and later, one tick at a time, and says how far it can go and the run still win. A change with no room either way is frame-perfect. A tool can mark where a run is tight, or count the tight moments to rate a level.
- `influenceMap(engine, level, run, change?)` changes the cells one at a time, hardware by default, and gives for each the ticks the run then takes, or -1 when it no longer wins. Walls show what the run walks through. Empty space (`(code) => code === Kind.Base ? Kind.Space : null`, for example) shows what holds things up.
- `levelCore(engine, level, run, fill?)` turns as much of the level into hardware (or `fill`) as it can while the run still wins, which leaves the smallest level the same solution solves.

Each replays the run hundreds or thousands of times, so on a long run it takes seconds to minutes. All three return `null` when the run doesn't win the level. [`examples/node/analysis.js`](../examples/node/analysis.js) runs them on a small level in well under a second.

## API

| Export | |
|---|---|
| `timingWindows(engine, level, run, { maxShift? }): TimingWindow[] \| null` | For each change of keys, `{ tick, key, early, late }` with how many ticks (up to `maxShift`, 8) it can move and the run still win. |
| `influenceMap(engine, level, run, change?): Int32Array \| null` | For each cell, the ticks the run wins in with it changed, -1 when it no longer wins, 0 when not tried. `change` is a piece, or a `CellChange` function. |
| `levelCore(engine, level, run, fill?): Uint8Array \| null` | The level with as many cells as possible turned into `fill` (hardware) while the run still wins. |
