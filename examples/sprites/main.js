// Drawing the game with your own sprites. spriteSheet() takes any image of
// square tiles in which tile n is the piece whose code is n, and draws each
// at the field's 16 pixels whatever its size in the image.
//
// A game would load a PNG.
//
//   const image = new Image();
//   image.src = "sheet.png";
//   await image.decode();
//   const sheet = spriteSheet(image, 32, 8);
//
// This page has no image to ship, so tiles.js paints one on a canvas.
import { Engine } from "@zeybek/supaplex";
import {
  drawCode,
  drawGame,
  fieldCanvas,
  keyboard,
  loop,
  spriteSheet,
} from "@zeybek/supaplex/canvas";
import { levels } from "@zeybek/supaplex/levels";
import { paintSheet } from "./tiles.js";

const sheetCanvas = document.getElementById("sheet");
paintSheet(sheetCanvas);

// A canvas is an image too. Its tiles are 32 pixels, 8 to a row.
const sheet = spriteSheet(sheetCanvas, 32, 8);

const ctx = fieldCanvas(document.getElementById("field"));
const engine = await Engine.load();
const keys = keyboard(window);
const start = () => engine.start(levels()[0].bytes);
start();
addEventListener("keydown", (event) => {
  if (event.key === "r") start();
});

let piece = sheet;
const toggle = document.getElementById("toggle");
toggle.addEventListener("click", () => {
  piece = piece === sheet ? drawCode : sheet;
  toggle.textContent =
    piece === sheet
      ? "Draw with coloured shapes"
      : "Draw with the sprite sheet";
  toggle.blur();
});

loop(
  () => engine.step(keys.read()),
  () => drawGame(ctx, engine, piece),
);
