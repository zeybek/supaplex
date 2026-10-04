import { CELLS, Kind, Look, WIDTH } from "../engine/constants.ts";
import { readSettings, specialsFor, writeSettings } from "../formats/level.ts";

export interface Piece {
  code: number;
  name: string;
  /** A keyboard shortcut, for the common pieces. */
  key?: string;
}

/** Every piece a level can hold, in a palette's order. */
export const PIECES: readonly Piece[] = [
  { code: Kind.Space, name: "empty", key: "x" },
  { code: Kind.Base, name: "base", key: "b" },
  { code: Kind.Murphy, name: "Murphy", key: "m" },
  { code: Kind.Exit, name: "exit", key: "e" },
  { code: Kind.Infotron, name: "Infotron", key: "i" },
  { code: Kind.Zonk, name: "Zonk", key: "z" },
  { code: Kind.Hardware, name: "hardware", key: "h" },
  { code: Kind.Ram, name: "RAM chip", key: "c" },
  { code: Kind.SnikSnak, name: "Snik Snak", key: "s" },
  { code: Kind.Electron, name: "Electron", key: "n" },
  { code: Kind.Bug, name: "bug", key: "u" },
  { code: Kind.Orange, name: "orange disk", key: "o" },
  { code: Kind.Yellow, name: "yellow disk", key: "y" },
  { code: Kind.Red, name: "red disk", key: "r" },
  { code: Kind.Terminal, name: "terminal", key: "t" },
  { code: Kind.PortRight, name: "port →", key: "1" },
  { code: Kind.PortDown, name: "port ↓", key: "2" },
  { code: Kind.PortLeft, name: "port ←", key: "3" },
  { code: Kind.PortUp, name: "port ↑", key: "4" },
  { code: Kind.PortHorizontal, name: "port ↔", key: "5" },
  { code: Kind.PortVertical, name: "port ↕", key: "6" },
  { code: Kind.PortCross, name: "port ✛", key: "7" },
  { code: Kind.SpecialRight, name: "special port →" },
  { code: Kind.SpecialDown, name: "special port ↓" },
  { code: Kind.SpecialLeft, name: "special port ←" },
  { code: Kind.SpecialUp, name: "special port ↑" },
  { code: Kind.Invisible, name: "invisible wall" },
  { code: Look.RamLeft, name: "chip, left half" },
  { code: Look.RamRight, name: "chip, right half" },
  { code: Look.RamTop, name: "chip, top half" },
  { code: Look.RamBottom, name: "chip, bottom half" },
  { code: Look.HardwareRound, name: "hardware: cap" },
  { code: Look.LampGreen, name: "hardware: green lamp" },
  { code: Look.LampBlue, name: "hardware: blue lamp" },
  { code: Look.LampRed, name: "hardware: red lamp" },
  { code: Look.Stripes, name: "hardware: stripes" },
  { code: Look.ResistorMixed, name: "hardware: resistor" },
  { code: Look.Capacitor, name: "hardware: capacitor" },
  { code: Look.ResistorsHorizontal, name: "hardware: resistors" },
  { code: Look.ResistorsVertical, name: "hardware: red resistors" },
  { code: Look.ResistorsYellow, name: "hardware: yellow resistors" },
];

/**
 * In place. Painting Murphy moves him, and the special ports' table follows
 * the field. Returns whether anything changed, as the other tools do.
 */
export function paint(bytes: Uint8Array, cell: number, code: number): boolean {
  if (cell < 0 || cell >= CELLS || bytes[cell] === code) return false;
  if (code === Kind.Murphy) {
    for (let c = 0; c < CELLS; c++)
      if (bytes[c] === Kind.Murphy) bytes[c] = Kind.Space;
  }
  bytes[cell] = code;
  const settings = readSettings(bytes);
  writeSettings(bytes, {
    ...settings,
    specials: specialsFor(bytes, settings.specials),
  });
  return true;
}

/** The cells on a line, ends included, so a fast drag leaves no gaps. */
export function cellsBetween(from: number, to: number): number[] {
  let x0 = from % WIDTH;
  let y0 = Math.floor(from / WIDTH);
  const x1 = to % WIDTH;
  const y1 = Math.floor(to / WIDTH);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: number[] = [];
  for (;;) {
    out.push(y0 * WIDTH + x0);
    if (x0 === x1 && y0 === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export const xy = (cell: number): [number, number] => [
  cell % WIDTH,
  Math.floor(cell / WIDTH),
];

/** A paint bucket. Murphy fills only `cell`. */
export function fill(bytes: Uint8Array, cell: number, code: number): boolean {
  if (cell < 0 || cell >= CELLS) return false;
  const from = bytes[cell];
  if (from === code) return false;
  if (code === Kind.Murphy) return paint(bytes, cell, code);
  const todo = [cell];
  const seen = new Set(todo);
  while (todo.length > 0) {
    const c = todo.pop() as number;
    paint(bytes, c, code);
    const [x, y] = xy(c);
    const around = [
      x > 0 ? c - 1 : -1,
      x < WIDTH - 1 ? c + 1 : -1,
      y > 0 ? c - WIDTH : -1,
      c + WIDTH < CELLS ? c + WIDTH : -1,
    ];
    for (const next of around) {
      if (next < 0 || seen.has(next) || bytes[next] !== from) continue;
      seen.add(next);
      todo.push(next);
    }
  }
  return true;
}

export function cellsIn(from: number, to: number): number[] {
  const [x0, y0] = xy(from);
  const [x1, y1] = xy(to);
  const cells: number[] = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      cells.push(y * WIDTH + x);
  return cells;
}

export function rectangle(
  bytes: Uint8Array,
  from: number,
  to: number,
  code: number,
  outline = false,
): boolean {
  const [x0, y0] = xy(from);
  const [x1, y1] = xy(to);
  let any = false;
  for (const cell of cellsIn(from, to)) {
    const [x, y] = xy(cell);
    const edge = x === x0 || x === x1 || y === y0 || y === y1;
    if (!outline || edge) any = paint(bytes, cell, code) || any;
  }
  return any;
}
