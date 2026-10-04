import assert from "node:assert/strict";
import { afterEach, beforeAll, test, vi } from "vitest";
import { at, picture } from "../test/picture.ts";
import {
  drawCode,
  drawGame,
  drawLevel,
  fieldCanvas,
  gamepad,
  keyboard,
  loop,
  SIZE,
  spriteSheet,
} from "./canvas.ts";
import {
  Action,
  Dir,
  Flag,
  HEIGHT,
  input,
  Kind,
  Look,
  Phase,
  TICKS_PER_SECOND,
  WIDTH,
} from "./engine/constants.ts";
import { Engine } from "./engine/engine.ts";
import { levels } from "./levels.ts";

let engine: Engine;
beforeAll(async () => {
  engine = await Engine.load();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeContext() {
  const calls: string[] = [];
  const ctx = {
    canvas: { width: WIDTH * SIZE, height: HEIGHT * SIZE },
    fillStyle: "",
    globalAlpha: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    fillRect: (x: number, y: number) => calls.push(`rect ${x},${y}`),
    beginPath: () => {},
    arc: (x: number, y: number) => calls.push(`arc ${x},${y}`),
    fill: () => {},
    fillText: (text: string) => calls.push(`text ${text}`),
    drawImage: (
      _image: unknown,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      x: number,
      y: number,
      w: number,
      h: number,
    ) => calls.push(`image ${sx},${sy} ${sw}x${sh} to ${x},${y} ${w}x${h}`),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

test("a piece is a square or a circle, with its glyph and its own ink", () => {
  const { ctx, calls } = fakeContext();
  drawCode(ctx, 0, 0, Kind.Base);
  drawCode(ctx, 16, 0, Kind.Zonk, 0.5);
  drawCode(ctx, 32, 0, Kind.Exit);
  assert.equal(ctx.fillStyle, "#222", "the exit's own ink");
  drawCode(ctx, 48, 0, Kind.Terminal);
  assert.equal(ctx.fillStyle, "#eee", "the default ink");
  drawCode(ctx, 64, 0, Kind.Space);
  drawCode(ctx, 80, 0, Look.LampRed);
  assert.deepEqual(calls, [
    "rect 1,1",
    "arc 24,8",
    "rect 33,1",
    "text E",
    "rect 49,1",
    "text T",
    "rect 81,1",
    "text ▪",
  ]);
  assert.equal(ctx.globalAlpha, 1);
});

test("the field's canvas is sized for 60 by 24 cells", () => {
  const { ctx } = fakeContext();
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  assert.equal(fieldCanvas(canvas as unknown as HTMLCanvasElement), ctx);
  assert.deepEqual([canvas.width, canvas.height], [960, 384]);
  const none = { getContext: () => null };
  assert.throws(() => fieldCanvas(none as unknown as HTMLCanvasElement));
});

test("a level is drawn as stored, decorative pieces by their own code", () => {
  const { ctx, calls } = fakeContext();
  const level = levels()[0];
  assert.ok(level);
  drawLevel(ctx, level.bytes);
  assert.equal(calls[0], "rect 0,0", "the field cleared first");
  assert.ok(calls.includes("text ▪"));
});

function drawnWhen(level: Uint8Array, seen: () => boolean): string[] {
  engine.start(level);
  for (let t = 0; t < 200 && !seen(); t++) engine.step(0);
  assert.ok(seen(), "the moment came");
  const { ctx, calls } = fakeContext();
  drawGame(ctx, engine);
  return calls;
}

const any = (
  array: Uint8Array | Uint16Array,
  test: (v: number, c: number) => boolean,
) => array.some((value, cell) => test(value, cell));

test("a game is drawn with things between cells as they move", () => {
  drawnWhen(picture(["O ", "  ", "  ", "M "]), () =>
    any(engine.phases, (p) => p === Phase.Falling),
  );
  drawnWhen(picture(["O ", "O ", "H ", "M "]), () =>
    any(
      engine.phases,
      (p, c) =>
        p === Phase.Rolling && ((engine.flags[c] as number) & Flag.Moving) > 0,
    ),
  );
  // A Snik Snak on its way, in eighths of a turn.
  drawnWhen(picture(["S   ", "    ", "M   "]), () =>
    any(
      engine.kinds,
      (k, c) =>
        k === Kind.SnikSnak && ((engine.flags[c] as number) & Flag.Moving) > 0,
    ),
  );
  const disk = picture(["  ", "  ", "H ", "  ", "  ", "M "]);
  disk[at(1, 1)] = Kind.Orange;
  drawnWhen(disk, () => any(engine.kinds, (k) => k === Kind.Explosion));
  const level = levels()[0];
  assert.ok(level);
  engine.start(level.bytes);
  engine.step(input(Dir.Right, false));
  assert.equal(engine.murphy.action, Action.Walk);
  const { ctx, calls } = fakeContext();
  drawGame(ctx, engine);
  assert.ok(calls.includes("text ▪"));
});

test("a sprite sheet draws each piece from its tile, at the field's size", () => {
  const image = {} as CanvasImageSource;
  const sheet = spriteSheet(image, 32, 8);
  const { ctx, calls } = fakeContext();
  sheet(ctx, 16, 0, Kind.Zonk);
  sheet(ctx, 0, 16, Look.RamLeft, 0.5);
  assert.equal(ctx.globalAlpha, 1, "put back after a faded piece");
  sheet(ctx, 0, 0, Kind.Space);
  sheet(ctx, 0, 0, Kind.Vacating);
  sheet(ctx, 0, 0, Kind.RedLit);
  assert.deepEqual(calls, [
    "image 32,0 32x32 to 16,0 16x16",
    "image 64,96 32x32 to 0,16 16x16",
    "image 96,160 32x32 to 0,0 16x16",
  ]);
  const own = spriteSheet(image, 16, 4, (code) =>
    code === Kind.Murphy ? 5 : null,
  );
  const drawn = fakeContext();
  own(drawn.ctx, 0, 0, Kind.Murphy);
  own(drawn.ctx, 0, 0, Kind.Zonk);
  assert.deepEqual(drawn.calls, ["image 16,16 16x16 to 0,0 16x16"]);
  for (const [tile, columns] of [
    [0, 8],
    [32, 0],
    [1.5, 8],
    [32, Number.NaN],
  ])
    assert.throws(
      () => spriteSheet(image, tile as number, columns as number),
      RangeError,
    );
});

test("levels and games are drawn with a sprite sheet where it is given", () => {
  const sheet = spriteSheet({} as CanvasImageSource, 16, 8);
  const level = levels()[0];
  assert.ok(level);
  const drawnLevel = fakeContext();
  drawLevel(drawnLevel.ctx, level.bytes, sheet);
  assert.equal(drawnLevel.calls[0], "rect 0,0", "the field cleared first");
  assert.ok(drawnLevel.calls.slice(1).every((c) => c.startsWith("image ")));
  assert.ok(drawnLevel.calls.length > 1000);
  engine.start(level.bytes);
  const drawnGame = fakeContext();
  drawGame(drawnGame.ctx, engine, sheet);
  assert.ok(drawnGame.calls.slice(1).every((c) => c.startsWith("image ")));
  // Murphy's tile: code 3, the fourth of the first row.
  const murphy = engine.murphy;
  assert.ok(
    drawnGame.calls.includes(
      `image 48,0 16x16 to ${murphy.x * SIZE},${murphy.y * SIZE} 16x16`,
    ),
  );
});

test("the keyboard: the arrow pressed last, Space, and nothing else", () => {
  const target = new EventTarget();
  const keys = keyboard(target);
  const press = (type: string, key: string) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { key });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(keys.read(), 0);
  assert.equal(press("keydown", "ArrowLeft"), true);
  press("keydown", "ArrowUp");
  press("keydown", "ArrowUp"); // held, repeating
  assert.equal(keys.read(), input(Dir.Up, false));
  press("keyup", "ArrowUp");
  assert.equal(keys.read(), input(Dir.Left, false));
  press("keydown", " ");
  assert.equal(keys.read(), input(Dir.Left, true));
  press("keyup", " ");
  press("keyup", "ArrowDown"); // never pressed
  press("keyup", "a");
  assert.equal(press("keydown", "a"), false, "other keys are left alone");
  assert.equal(keys.read(), input(Dir.Left, false));
  keys.stop();
  press("keyup", "ArrowLeft");
  assert.equal(keys.read(), input(Dir.Left, false), "no longer listening");
});

function pad(
  pressed: number[],
  axes: number[] = [0, 0],
  connected = true,
): Gamepad {
  const buttons = Array.from({ length: 17 }, (_, b) => ({
    pressed: pressed.includes(b),
  }));
  return { connected, buttons, axes } as unknown as Gamepad;
}

test("a gamepad: the d-pad or the stick, the direction pressed last, and A for Space", () => {
  let pads: (Gamepad | null)[] = [];
  const keys = gamepad({ getGamepads: () => pads });
  assert.equal(keys.read(), 0, "no gamepad, no keys");
  pads = [pad([15])];
  assert.equal(keys.read(), input(Dir.Right, false));
  pads = [pad([15, 12])];
  assert.equal(keys.read(), input(Dir.Up, false), "up came last");
  pads = [pad([15])];
  assert.equal(keys.read(), input(Dir.Right, false), "up let go");
  pads = [pad([0], [-0.9, 0.2])];
  assert.equal(keys.read(), input(Dir.Left, true), "the stick, and A");
  pads = [pad([], [0.3, -0.4])];
  assert.equal(keys.read(), 0, "inside the dead zone");
  pads = [pad([], [0.2, 0.8])];
  assert.equal(keys.read(), input(Dir.Down, false));
  pads = [pad([], [0.2, -0.8])];
  assert.equal(keys.read(), input(Dir.Up, false));
  pads = [pad([], [0.9, 0])];
  assert.equal(keys.read(), input(Dir.Right, false));
  pads = [pad([15], [0.9, 0])];
  assert.equal(
    keys.read(),
    input(Dir.Right, false),
    "the d-pad and stick agree",
  );
});

test("the first gamepad connected, or the one asked for", () => {
  const pads = [null, pad([12], [0, 0], false), pad([14]), pad([13])];
  const source = { getGamepads: () => pads };
  assert.equal(gamepad(source).read(), input(Dir.Left, false));
  assert.equal(gamepad(source, 3).read(), input(Dir.Down, false));
  assert.equal(gamepad(source, 7).read(), 0);
  assert.equal(gamepad({}).read(), 0);
  assert.equal(gamepad().read(), 0);
});

test("the loop steps 35 times a second, catches up a little, and stops", () => {
  const frames: ((now: number) => void)[] = [];
  vi.stubGlobal("requestAnimationFrame", (f: (now: number) => void) =>
    frames.push(f),
  );
  vi.stubGlobal("performance", { now: () => 0 });
  let ticks = 0;
  let draws = 0;
  const stop = loop(
    () => ticks++,
    () => draws++,
  );
  const next = (now: number) => (frames.shift() as (now: number) => void)(now);
  next(1000); // a second late: only a quarter of a second is caught up
  assert.equal(ticks, Math.floor(250 / (1000 / TICKS_PER_SECOND)));
  assert.equal(draws, 1);
  next(1000 + 1000 / TICKS_PER_SECOND + 1);
  assert.equal(draws, 2);
  stop();
  next(3000);
  assert.equal(draws, 2, "stopped");
});
