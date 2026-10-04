import { CELLS, Kind, LEVEL_BYTES, WIDTH } from "../src/engine/constants.ts";

const CODES: Record<string, number> = {
  " ": Kind.Space,
  ".": Kind.Base,
  M: Kind.Murphy,
  O: Kind.Zonk,
  "@": Kind.Infotron,
  E: Kind.Exit,
  R: Kind.Red,
  S: Kind.SnikSnak,
};

/** A level drawn in text from cell (1, 1), in a field of hardware; unknown characters are hardware too. */
export function picture(rows: string[], needed = 0): Uint8Array {
  const bytes = new Uint8Array(LEVEL_BYTES);
  bytes.fill(Kind.Hardware, 0, CELLS);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      bytes[(y + 1) * WIDTH + x + 1] = CODES[ch] ?? Kind.Hardware;
    });
  });
  bytes[1470] = needed;
  return bytes;
}

export const at = (x: number, y: number): number => y * WIDTH + x;
