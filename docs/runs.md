# Runs and checking them

The engine is deterministic. The same level, seed and keys always play the same game, so a game's keys are the whole game. A `Run` is the seed, the ticks to the win, and the keys stored the way the game's own demos store them, so a minute of play is a few hundred bytes.

`verify(engine, level, run)` plays a run on a fresh start and says whether it wins, and on which tick. Two engines side by side (`Engine.load()` twice) give a replay next to a live attempt.

## On a server

A server doesn't have to believe a claimed time, because `verify` plays the run and says whether it wins on exactly the tick it claims. That makes a leaderboard that can't be cheated with a made-up time. [`examples/worker`](../examples/worker) does it in a Cloudflare Worker. A `POST { level, run }`, with an original level's number or a level's link text and a run's text, gets back `{ won, ticks, seconds }`. After `npm run build` at the repository's root, `npm install` and `npm run deploy` in its folder put it on your Cloudflare account.

## Cloudflare Workers

`Engine.load()` compiles the module from bytes bundled in the JavaScript. Cloudflare Workers won't compile WebAssembly at run time, so import the file and let the platform compile it at deploy.

```ts
import wasm from "@zeybek/supaplex/engine.wasm";
const engine = await Engine.fromModule(wasm);
```

## API

| Export | |
|---|---|
| `Run` | `{ seed, ticks, demo }`. |
| `encodeDemo(keys)`, `decodeDemo(demo)`, `DEMO_END` | Keys, one per tick, to and from the game's demo bytes. 0xFF ends a demo. |
| `verify(engine, level, run)` | `{ won, ticks }`, saying whether the run wins on exactly `run.ticks`. |
| `runOf(engine, level, seed, demo)` | A `.SP` file's demo as a `Run`, or `null` when it never wins. |
| `runToText(run)`, `runFromText(text)` | A run as text, safe for a URL. |
