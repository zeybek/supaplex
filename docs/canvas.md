# Drawing on a canvas

`@zeybek/supaplex/canvas` draws the game on a canvas, reads the keyboard and gamepads, and steps the engine 35 times a second, for a browser game.

```ts
import { drawGame, fieldCanvas, keyboard, loop } from "@zeybek/supaplex/canvas";

const ctx = fieldCanvas(document.querySelector("canvas")!);
const keys = keyboard(window);
loop(
  () => engine.step(keys.read()), // 35 times a second
  () => drawGame(ctx, engine), // once a display frame
);
```

Pieces are coloured shapes. For sprites, give `drawGame` a `spriteSheet(image, tile, columns)`. The image is a grid of square tiles, and tile n is the piece whose code is n. Each tile is drawn at the field's 16 pixels whatever its size in the image, and `frame` maps codes to tiles for a sheet laid out another way. `drawGame(ctx, engine, sheet)` and `drawLevel(ctx, bytes, sheet)` then draw everything with it, moving things included. [`examples/sprites`](../examples/sprites) draws the game from a sheet it paints itself.

`keyboard(window)` reads the arrows and Space, and `gamepad()` a gamepad's d-pad or left stick and its A button. `keys.read() || pad.read()` takes whichever is held.

## API

| Export | |
|---|---|
| `fieldCanvas(canvas)` | Sizes a canvas for the field (16 pixels a cell, `SIZE`) and returns its 2D context. |
| `drawGame(ctx, engine, piece?)` | Draws a running game, with things between cells as they move. |
| `drawLevel(ctx, bytes, piece?)` | Draws a level as stored, as an editor shows it. |
| `drawCode(ctx, x, y, code, alpha?)` | Draws one piece as a coloured shape. Both draw functions use it as their `DrawPiece` unless given another. |
| `spriteSheet(image, tile, columns, frame?): DrawPiece` | Draws pieces from an image of `tile`-pixel tiles, `columns` to a row, tile n for code n unless `frame` says otherwise. |
| `keyboard(target): Keyboard` | Follows the arrows and Space. `read()` gives the keys for `step`, and `stop()` lets go. |
| `gamepad(source?, index?): GamepadKeys` | Follows a gamepad's d-pad or left stick and its A button the same way. Call `read()` once a tick. |
| `loop(tick, draw)` | Calls `tick` 35 times a second and `draw` once a display frame, and returns a function that stops it. |
