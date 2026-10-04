/**
 * Drawing on a canvas, the keyboard and gamepads, and a 35-tick loop, for
 * a browser game.
 *
 * @module
 */

import { SHAPES } from "./draw/palette.ts";
import {
  Action,
  CELLS,
  Dir,
  type Direction,
  Flag,
  HEIGHT,
  input,
  Kind,
  Phase,
  SLIDE,
  STEP,
  TICKS_PER_SECOND,
  WIDTH,
} from "./engine/constants.ts";
import type { Engine } from "./engine/engine.ts";

/** Pixels a side of a cell. */
export const SIZE = 16;

/** Draws one piece by its code, top left at (`x`, `y`): {@link drawCode} or a {@link spriteSheet}. */
export type DrawPiece = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  code: number,
  alpha?: number,
) => void;

/** A coloured shape, with a glyph where colour alone would not tell pieces apart. */
export function drawCode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  code: number,
  alpha = 1,
): void {
  const shape = SHAPES[code];
  if (!shape) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = shape.fill;
  if (shape.round) {
    ctx.beginPath();
    ctx.arc(x + SIZE / 2, y + SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x + 1, y + 1, SIZE - 2, SIZE - 2);
  }
  if (shape.glyph) {
    ctx.fillStyle = shape.ink ?? "#eee";
    ctx.font = `bold ${SIZE - 5}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(shape.glyph, x + SIZE / 2, y + SIZE / 2 + 1);
  }
  ctx.globalAlpha = 1;
}

/** Sizes a canvas for the field; throws when it has no 2D context. */
export function fieldCanvas(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  canvas.width = WIDTH * SIZE;
  canvas.height = HEIGHT * SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This canvas has no 2D context");
  return ctx;
}

function clear(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** A level as stored, as an editor shows it. */
export function drawLevel(
  ctx: CanvasRenderingContext2D,
  bytes: Uint8Array,
  piece: DrawPiece = drawCode,
): void {
  clear(ctx);
  bytes.subarray(0, CELLS).forEach((code, cell) => {
    piece(ctx, (cell % WIDTH) * SIZE, Math.floor(cell / WIDTH) * SIZE, code);
  });
}

/** The way back from a move's target, as (x, y). */
const BACK: Record<Direction, [number, number]> = {
  [Dir.Up]: [0, 1],
  [Dir.Left]: [1, 0],
  [Dir.Down]: [0, -1],
  [Dir.Right]: [-1, 0],
};

/** A running game, with things in motion drawn between cells. */
export function drawGame(
  ctx: CanvasRenderingContext2D,
  engine: Engine,
  piece: DrawPiece = drawCode,
): void {
  clear(ctx);
  const { kinds, looks, dirs, progs, flags, phases, timers } = engine;
  const murphy = engine.murphy;
  const walking = murphy.action === Action.Walk;
  kinds.forEach((kind, cell) => {
    let x = (cell % WIDTH) * SIZE;
    let y = Math.floor(cell / WIDTH) * SIZE;
    if ((flags[cell] as number) & Flag.Moving) {
      const length = phases[cell] === Phase.Rolling ? SLIDE : STEP;
      const enemy = kind === Kind.SnikSnak || kind === Kind.Electron;
      const dir = (
        enemy ? (dirs[cell] as number) / 2 : dirs[cell]
      ) as Direction;
      const left = (length - (progs[cell] as number)) / length;
      x += BACK[dir][0] * left * SIZE;
      y += BACK[dir][1] * left * SIZE;
    }
    // Murphy's cell is already the one he is moving into.
    if (cell === murphy.cell && walking) {
      const left = 1 - murphy.tick / murphy.length;
      x += BACK[murphy.dir][0] * left * SIZE;
      y += BACK[murphy.dir][1] * left * SIZE;
    }
    const decor = kind === Kind.Ram || kind === Kind.Hardware;
    const alpha =
      kind === Kind.Explosion ? 0.4 + (timers[cell] as number) / 16 : 1;
    piece(ctx, x, y, decor ? (looks[cell] as number) : kind, alpha);
  });
}

/**
 * Pieces from an image of square tiles, `columns` to a row: tile n is the
 * piece with code n, unless `frame` says otherwise (`null`: not drawn).
 *
 * @throws RangeError when `tile` or `columns` is not a whole number above 0.
 */
export function spriteSheet(
  image: CanvasImageSource,
  tile: number,
  columns: number,
  frame: (code: number) => number | null = (code) =>
    SHAPES[code] ? code : null,
): DrawPiece {
  for (const value of [tile, columns])
    if (!Number.isInteger(value) || value < 1)
      throw new RangeError(`Not a whole number above 0: ${value}`);
  return (ctx, x, y, code, alpha = 1) => {
    const n = frame(code);
    if (n === null) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      image,
      (n % columns) * tile,
      Math.floor(n / columns) * tile,
      tile,
      tile,
      x,
      y,
      SIZE,
      SIZE,
    );
    ctx.globalAlpha = 1;
  };
}

export interface Keyboard {
  read(): number;
  stop(): void;
}

const ARROWS: Record<string, Direction> = {
  ArrowUp: Dir.Up,
  ArrowLeft: Dir.Left,
  ArrowDown: Dir.Down,
  ArrowRight: Dir.Right,
};

/** The arrows and Space on `target`; the arrow pressed last wins, as in the original. */
export function keyboard(target: EventTarget): Keyboard {
  const held: Direction[] = [];
  let space = false;
  const down = (event: Event) => {
    const { key } = event as KeyboardEvent;
    const dir = ARROWS[key];
    if (dir !== undefined) {
      if (!held.includes(dir)) held.push(dir);
    } else if (key === " ") {
      space = true;
    } else {
      return;
    }
    event.preventDefault();
  };
  const up = (event: Event) => {
    const { key } = event as KeyboardEvent;
    const at = held.indexOf(ARROWS[key] as Direction);
    if (at >= 0) held.splice(at, 1);
    else if (key === " ") space = false;
  };
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  return {
    read: () => input(held.at(-1) ?? null, space),
    stop() {
      target.removeEventListener("keydown", down);
      target.removeEventListener("keyup", up);
    },
  };
}

export interface GamepadSource {
  getGamepads?(): readonly (Gamepad | null)[];
}

export interface GamepadKeys {
  read(): number;
}

/** The d-pad's buttons in the standard mapping. */
const PAD_BUTTONS: [number, Direction][] = [
  [12, Dir.Up],
  [14, Dir.Left],
  [13, Dir.Down],
  [15, Dir.Right],
];
const DEAD_ZONE = 0.5;

function padDirections(pad: Gamepad): Direction[] {
  const held = PAD_BUTTONS.filter(([b]) => pad.buttons[b]?.pressed).map(
    ([, dir]) => dir,
  );
  const [x = 0, y = 0] = pad.axes;
  if (Math.max(Math.abs(x), Math.abs(y)) >= DEAD_ZONE) {
    const lean =
      Math.abs(x) > Math.abs(y)
        ? x < 0
          ? Dir.Left
          : Dir.Right
        : y < 0
          ? Dir.Up
          : Dir.Down;
    if (!held.includes(lean)) held.push(lean);
  }
  return held;
}

/**
 * The d-pad or left stick for the arrows, A for Space; the direction
 * pressed last wins. Reads the first gamepad connected, or the one at
 * `index`, each time `read` is called.
 */
export function gamepad(
  source: GamepadSource = globalThis.navigator,
  index?: number,
): GamepadKeys {
  let held: Direction[] = [];
  return {
    read() {
      const pads = source.getGamepads?.() ?? [];
      const pad =
        index === undefined ? pads.find((p) => p?.connected) : pads[index];
      if (!pad) {
        held = [];
        return input(null, false);
      }
      const now = padDirections(pad);
      held = [
        ...held.filter((dir) => now.includes(dir)),
        ...now.filter((dir) => !held.includes(dir)),
      ];
      return input(held.at(-1) ?? null, pad.buttons[0]?.pressed === true);
    },
  };
}

/** The most a loop catches up after a pause. */
const CATCH_UP_MS = 250;

/**
 * `tick` 35 times a second and `draw` once a frame, on
 * `requestAnimationFrame`, so a hidden page pauses. Returns a stop function.
 */
export function loop(tick: () => void, draw: () => void): () => void {
  const TICK_MS = 1000 / TICKS_PER_SECOND;
  let last = performance.now();
  let owed = 0;
  let running = true;
  const frame = (now: number) => {
    if (!running) return;
    owed = Math.min(owed + now - last, CATCH_UP_MS);
    last = now;
    while (owed >= TICK_MS && running) {
      owed -= TICK_MS;
      tick();
    }
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => {
    running = false;
  };
}
