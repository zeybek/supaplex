# @zeybek/supaplex

[![CI](https://github.com/zeybek/supaplex/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/zeybek/supaplex/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/@zeybek/supaplex)](https://www.npmjs.com/package/@zeybek/supaplex)
[![license](https://img.shields.io/npm/l/@zeybek/supaplex)](https://github.com/zeybek/supaplex/blob/main/LICENSE)

Supaplex in 16 KB of WebAssembly, with what a game or a level editor of your own needs.

A level played here goes exactly as it went in the original game (1991, the SpeedFix 6.3 version), down to the random numbers. The rules are written in Rust from Cillié Malan's MIT-licensed disassembly of the original, and the game's own demos and 6894 solutions recorded by its players play back the same. The module has no way to panic, its memory never grows, and it runs in a browser, in Node and on Cloudflare Workers. It runs [zeybek.dev/supaplex](https://zeybek.dev/supaplex).

[Try the game and the editor in your browser](https://zeybek.github.io/supaplex/examples/).

## Install

```sh
npm install @zeybek/supaplex
```

It needs WebAssembly, and `CompressionStream` for level links, so any current browser, Node 22 or later, or Cloudflare Workers.

## Usage

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

Your code calls `step` 35 times a second with the keys held, draws what the engine's arrays say, and plays sounds for the events `step` returns. In a browser, `@zeybek/supaplex/canvas` does the first two, with coloured shapes or your own sprites.

```ts
import { drawGame, fieldCanvas, keyboard, loop } from "@zeybek/supaplex/canvas";

const ctx = fieldCanvas(document.querySelector("canvas")!);
const keys = keyboard(window);
loop(
  () => engine.step(keys.read()), // 35 times a second
  () => drawGame(ctx, engine), // once a display frame
);
```

## What it has

- [Playing a level](https://github.com/zeybek/supaplex/blob/main/docs/playing.md) covers the engine, its save states, and the call that plays a whole run at once.
- [Levels and files](https://github.com/zeybek/supaplex/blob/main/docs/levels-and-files.md) has the 111 original levels, the level, `.SP`, level set, player list and hall of fame formats, and PNG pictures of levels.
- [A level editor](https://github.com/zeybek/supaplex/blob/main/docs/editor.md) has the palette, painting, filling, copying, flipping and turning, the checks, solutions that prove a level can be won and say where an edit breaks them, and links that carry a level.
- [Runs and checking them](https://github.com/zeybek/supaplex/blob/main/docs/runs.md) shows how a server checks a run before it believes a time.
- [Drawing on a canvas](https://github.com/zeybek/supaplex/blob/main/docs/canvas.md) covers sprite sheets, the keyboard and gamepads.
- [Analysis](https://github.com/zeybek/supaplex/blob/main/docs/analysis.md) finds how precise a solution must be, and which cells of a level it depends on.
- [Command line](https://github.com/zeybek/supaplex/blob/main/docs/command-line.md) is the `supaplex` command, which lists, checks, links, pictures, splits and joins levels.
- [The WebAssembly module](https://github.com/zeybek/supaplex/blob/main/docs/webassembly.md) lists the module's own exports.

Sound and menus are up to you. Every export is documented in the type declarations, which editors show on hover. [How it is checked](https://github.com/zeybek/supaplex/blob/main/docs/how-it-is-checked.md) covers the tests against the original.

## Examples

[`examples/`](https://github.com/zeybek/supaplex/tree/main/examples) has a short Node script for each part of the package, from playing with no screen to save states, level files, pictures, links and analysis. It also has four pages in plain JavaScript with no build step, a game, a replay viewer, a game drawn from sprites and a level editor, and a Cloudflare Worker that checks runs. The pages run live at [zeybek.github.io/supaplex/examples](https://zeybek.github.io/supaplex/examples/).

To run them, clone the repository and build it.

```sh
npm install
npm run build
node examples/node/play.js
npx serve .           # then open /examples/
```

## Contributing

Questions and bug reports go to the [issue tracker](https://github.com/zeybek/supaplex/issues). A level and its keys reproduce any game exactly, so a bug report with a `.SP` file or a run from `runToText` can be replayed. [CONTRIBUTING.md](https://github.com/zeybek/supaplex/blob/main/CONTRIBUTING.md) covers the rules for a change, the development setup and how releases work.

## License

[MIT](https://github.com/zeybek/supaplex/blob/main/LICENSE) © Ahmet Zeybek. The rules also carry Cillié Malan's notice for the disassembly they were written from. The levels and demos in `data/`, and the levels in `@zeybek/supaplex/levels`, belong to the original game's authors and are distributed as freeware. The MIT license does not cover them.
