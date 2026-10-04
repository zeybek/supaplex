import { CELLS, Kind, Look, WIDTH } from "../engine/constants.ts";
import { cellsIn, paint, xy } from "./paint.ts";

export interface Region {
  width: number;
  height: number;
  /** Row by row. */
  codes: Uint8Array;
}

export function copyRegion(
  bytes: Uint8Array,
  from: number,
  to: number,
): Region {
  const [x0, y0] = xy(from);
  const [x1, y1] = xy(to);
  return {
    width: Math.abs(x1 - x0) + 1,
    height: Math.abs(y1 - y0) + 1,
    codes: Uint8Array.from(cellsIn(from, to), (cell) => bytes[cell] as number),
  };
}

/** Top left at `cell`; what falls past the field's edge is left out. */
export function pasteRegion(
  bytes: Uint8Array,
  region: Region,
  cell: number,
): boolean {
  const [x0, y0] = xy(cell);
  let any = false;
  region.codes.forEach((code, i) => {
    const x = x0 + (i % region.width);
    const y = y0 + Math.floor(i / region.width);
    if (x < WIDTH && y * WIDTH < CELLS)
      any = paint(bytes, y * WIDTH + x, code) || any;
  });
  return any;
}

/** One-way pieces and their mirror images. */
const MIRRORED: Record<"horizontal" | "vertical", Map<number, number>> = {
  horizontal: pairs([
    [Kind.PortRight, Kind.PortLeft],
    [Kind.SpecialRight, Kind.SpecialLeft],
    [Look.RamLeft, Look.RamRight],
  ]),
  vertical: pairs([
    [Kind.PortUp, Kind.PortDown],
    [Kind.SpecialUp, Kind.SpecialDown],
    [Look.RamTop, Look.RamBottom],
  ]),
};

function pairs(list: [number, number][]): Map<number, number> {
  return new Map(list.flatMap(([a, b]) => [[a, b] as const, [b, a] as const]));
}

/** One-way ports and half chips turn round with it. */
export function flipRegion(
  region: Region,
  axis: "horizontal" | "vertical",
): Region {
  const { width, height } = region;
  const swap = MIRRORED[axis];
  const codes = region.codes.map((_, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    const from =
      axis === "horizontal"
        ? y * width + (width - 1 - x)
        : (height - 1 - y) * width + x;
    const code = region.codes[from] as number;
    return swap.get(code) ?? code;
  });
  return { width, height, codes };
}

/** One-way pieces and their quarter turn clockwise. */
const TURNED = new Map<number, number>([
  [Kind.PortRight, Kind.PortDown],
  [Kind.PortDown, Kind.PortLeft],
  [Kind.PortLeft, Kind.PortUp],
  [Kind.PortUp, Kind.PortRight],
  [Kind.SpecialRight, Kind.SpecialDown],
  [Kind.SpecialDown, Kind.SpecialLeft],
  [Kind.SpecialLeft, Kind.SpecialUp],
  [Kind.SpecialUp, Kind.SpecialRight],
  [Kind.PortHorizontal, Kind.PortVertical],
  [Kind.PortVertical, Kind.PortHorizontal],
  [Look.RamLeft, Look.RamTop],
  [Look.RamTop, Look.RamRight],
  [Look.RamRight, Look.RamBottom],
  [Look.RamBottom, Look.RamLeft],
]);

/** Clockwise quarter turns; ports and half chips turn with it, decorations do not. */
export function rotateRegion(region: Region, turns = 1): Region {
  let { width, height, codes } = region;
  for (let t = ((turns % 4) + 4) % 4; t > 0; t--) {
    const from = codes;
    const h = height;
    // Column x of the turned region is row h - 1 - x of the old one.
    codes = from.map((_, i) => {
      const x = i % h;
      const y = Math.floor(i / h);
      const code = from[(h - 1 - x) * width + y] as number;
      return TURNED.get(code) ?? code;
    });
    [width, height] = [height, width];
  }
  return {
    width,
    height,
    codes: codes === region.codes ? codes.slice() : codes,
  };
}
