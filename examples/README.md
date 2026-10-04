# Examples

Each example uses the package the way your own code would, importing `@zeybek/supaplex`. They load it from this checkout's `dist/`, so build it first.

```sh
npm install
npm run build
```

## In Node

One file for each part of the package. Run them from the repository's root with `node`, and they print what they do. Files they write go to `examples/node/out/`.

| File | What it shows |
|---|---|
| [`play.js`](node/play.js) | The engine with no screen. It starts a level, holds keys tick by tick, and reads the events and the field. |
| [`save-states.js`](node/save-states.js) | Saving the game, trying each way from the same moment, and going back. Also `engine.run`, which plays many ticks in one call. |
| [`make-a-level.js`](node/make-a-level.js) | A level made with the editor's tools, its settings, `problems`, and a `.SP` file of it. |
| [`level-sets.js`](node/level-sets.js) | A `.DAT` level set split into `.SP` files, and levels joined into a new set. |
| [`pictures.js`](node/pictures.js) | PNG pictures of levels, made without a canvas. |
| [`player-lists.js`](node/player-lists.js) | The DOS game's `PLAYER.LST` and `HALLFAME.LST`, written and read back, and the level a player plays next. |
| [`links.js`](node/links.js) | A level and its solution in a link that opens at one moment, read back and checked with `verify`. |
| [`analysis.js`](node/analysis.js) | `@zeybek/supaplex/analysis` on a small level, with how precise each key press must be, which cells the run needs, and the smallest level it still wins. |

```sh
node examples/node/play.js
```

## In a browser

Plain JavaScript pages with no build step. Serve the repository's root and open `/examples/`, or see them live at [zeybek.github.io/supaplex/examples](https://zeybek.github.io/supaplex/examples/).

```sh
npx serve .
```

| Folder | What it shows |
|---|---|
| [`game/`](game) | The 111 original levels, played with the keyboard or a gamepad, in under 50 lines. |
| [`replay/`](replay) | The game's ten demos or a `.SP` file played back, with pause, speed, and going back and forth through save states. |
| [`sprites/`](sprites) | The game drawn from a sprite sheet. [`tiles.js`](sprites/tiles.js) paints the sheet, and [`main.js`](sprites/main.js) is all a game needs to use one. |
| [`editor/`](editor) | A whole level editor, with every tool, settings, playing the level, solutions, links, `.SP` files and level sets. |

## On a server

[`worker/`](worker) is a Cloudflare Worker that checks a run before a leaderboard believes it. After `npm run build` here, `npm install` and `npm run deploy` in its folder put it on your Cloudflare account, and `npm run dev` runs it locally.
