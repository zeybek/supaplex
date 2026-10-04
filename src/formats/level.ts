import {
  CELLS,
  HEIGHT,
  Kind,
  LEVEL_BYTES,
  WIDTH,
} from "../engine/constants.ts";

// After the 1440 cells:
//
//   1444       gravity at the start (1 is on)
//   1445       0x20, or the SpeedFix version that last wrote it
//   1446-1468  the title, 23 characters, padded with dashes
//   1469       Zonks frozen at the start (2 is on)
//   1470       Infotrons needed (0: all of them)
//   1471       special ports in the table below, at most 10
//   1472-1531  the table, 6 bytes a port: twice its cell (high byte
//              first), gravity, frozen Zonks, frozen enemies, unused
//   1534-1535  the seed a demo after the level starts from (low byte first)

const GRAVITY = 1444;
const VERSION = 1445;
const TITLE = 1446;
const TITLE_LENGTH = 23;
const FREEZE_ZONKS = 1469;
const NEEDED = 1470;
const SPECIAL_COUNT = 1471;
const SPECIALS = 1472;
export const MAX_SPECIALS = 10;

/** What passing through a special port sets. */
export interface SpecialPort {
  cell: number;
  gravity: boolean;
  freezeZonks: boolean;
  freezeEnemies: boolean;
}

export interface LevelSettings {
  title: string;
  gravity: boolean;
  freezeZonks: boolean;
  /** 0 for all of them. */
  needed: number;
  specials: SpecialPort[];
}

const TITLE_CHARS = /[^ -_]/g;

/** Upper case, only characters the game shows, centred in dashes to 23. */
export function formatTitle(text: string): string {
  const words = text
    .toUpperCase()
    .replace(TITLE_CHARS, "")
    .trim()
    .slice(0, TITLE_LENGTH - 2);
  if (!words) return "-".repeat(TITLE_LENGTH);
  const inner = ` ${words} `;
  const left = Math.floor((TITLE_LENGTH - inner.length) / 2);
  return (
    "-".repeat(left) + inner + "-".repeat(TITLE_LENGTH - inner.length - left)
  );
}

const view = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

export function readSettings(bytes: Uint8Array): LevelSettings {
  const data = view(bytes);
  const title = String.fromCharCode(
    ...bytes.subarray(TITLE, TITLE + TITLE_LENGTH),
  )
    .replace(/^-+|-+$/g, "")
    .trim();
  const specials: SpecialPort[] = [];
  const count = Math.min(MAX_SPECIALS, data.getUint8(SPECIAL_COUNT));
  for (let i = 0; i < count; i++) {
    const at = SPECIALS + i * 6;
    specials.push({
      cell: data.getUint16(at) >> 1,
      gravity: bytes[at + 2] === 1,
      freezeZonks: bytes[at + 3] === 2,
      freezeEnemies: bytes[at + 4] === 1,
    });
  }
  return {
    title,
    gravity: bytes[GRAVITY] === 1,
    freezeZonks: bytes[FREEZE_ZONKS] === 2,
    needed: data.getUint8(NEEDED),
    specials,
  };
}

/** In place; ports past {@link MAX_SPECIALS} are dropped. */
export function writeSettings(
  bytes: Uint8Array,
  settings: LevelSettings,
): void {
  bytes[GRAVITY] = settings.gravity ? 1 : 0;
  bytes[VERSION] = 0x20;
  const title = formatTitle(settings.title);
  for (let i = 0; i < TITLE_LENGTH; i++) bytes[TITLE + i] = title.charCodeAt(i);
  bytes[FREEZE_ZONKS] = settings.freezeZonks ? 2 : 0;
  bytes[NEEDED] = Math.max(0, Math.min(255, Math.floor(settings.needed)));
  const specials = settings.specials.slice(0, MAX_SPECIALS);
  bytes[SPECIAL_COUNT] = specials.length;
  bytes.fill(0, SPECIALS, SPECIALS + MAX_SPECIALS * 6);
  specials.forEach((port, i) => {
    const at = SPECIALS + i * 6;
    const address = port.cell * 2;
    bytes[at] = address >> 8;
    bytes[at + 1] = address & 0xff;
    bytes[at + 2] = port.gravity ? 1 : 0;
    bytes[at + 3] = port.freezeZonks ? 2 : 0;
    bytes[at + 4] = port.freezeEnemies ? 1 : 0;
  });
}

/** Hardware round the edge, base inside, Murphy and an exit. */
export function blankLevel(): Uint8Array {
  const bytes = new Uint8Array(LEVEL_BYTES);
  for (let c = 0; c < CELLS; c++) {
    const x = c % WIDTH;
    const y = Math.floor(c / WIDTH);
    const edge = x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1;
    bytes[c] = edge ? Kind.Hardware : Kind.Base;
  }
  bytes[2 * WIDTH + 2] = Kind.Murphy;
  bytes[21 * WIDTH + 57] = Kind.Exit;
  writeSettings(bytes, {
    title: "untitled",
    gravity: false,
    freezeZonks: false,
    needed: 0,
    specials: [],
  });
  return bytes;
}

const isSpecialPort = (code: number) =>
  code >= Kind.SpecialRight && code <= Kind.SpecialUp;

/** An Electron's 3 x 3 blast leaves an Infotron in each cell. */
const ELECTRON_INFOTRONS = 9;

/** What would keep a level from playing, as sentences to show; empty when it plays. */
export function problems(bytes: Uint8Array): string[] {
  const found: string[] = [];
  let murphies = 0;
  let exits = 0;
  let specials = 0;
  let infotrons = 0;
  let electrons = 0;
  for (const code of bytes.subarray(0, CELLS)) {
    if (code === Kind.Murphy) murphies++;
    if (code === Kind.Exit) exits++;
    if (isSpecialPort(code)) specials++;
    if (code === Kind.Infotron) infotrons++;
    if (code === Kind.Electron) electrons++;
  }
  if (murphies === 0) found.push("Murphy is not in it");
  if (murphies > 1)
    found.push("more than one Murphy: all of them die when one does");
  if (exits === 0) found.push("there is no exit");
  if (specials > MAX_SPECIALS)
    found.push(`${specials} special ports; the game keeps ${MAX_SPECIALS}`);
  const needed = view(bytes).getUint8(NEEDED);
  const most = infotrons + electrons * ELECTRON_INFOTRONS;
  if (needed > most)
    found.push(`it needs ${needed} Infotrons, but has at most ${most}`);
  return found;
}

/** The table rebuilt from the field; ports in `before` keep their settings. */
export function specialsFor(
  bytes: Uint8Array,
  before: SpecialPort[],
): SpecialPort[] {
  const known = new Map(before.map((port) => [port.cell, port]));
  const out: SpecialPort[] = [];
  for (const [c, code] of bytes.subarray(0, CELLS).entries()) {
    if (out.length === MAX_SPECIALS) break;
    if (!isSpecialPort(code)) continue;
    out.push(
      known.get(c) ?? {
        cell: c,
        gravity: true,
        freezeZonks: false,
        freezeEnemies: false,
      },
    );
  }
  return out;
}

/** 1536 bytes with a known code in every cell. */
export function isLevel(bytes: Uint8Array): boolean {
  return (
    bytes.length === LEVEL_BYTES &&
    bytes.subarray(0, CELLS).every((code) => code <= Kind.Invisible)
  );
}

/** A level and the settings a menu shows. */
export interface Level {
  number: number;
  title: string;
  gravity: boolean;
  freezeZonks: boolean;
  needed: number;
  bytes: Uint8Array;
}

/** As a menu shows it: `needed` is a count, where the bytes say 0 for all. */
export function parseLevel(bytes: Uint8Array, number: number): Level {
  const { title, gravity, freezeZonks, needed } = readSettings(bytes);
  const infotrons = bytes
    .subarray(0, CELLS)
    .reduce((n, code) => (code === Kind.Infotron ? n + 1 : n), 0);
  return {
    number,
    title,
    gravity,
    freezeZonks,
    // Counted in a byte, as the game does.
    needed: needed === 0 ? infotrons & 0xff : needed,
    bytes,
  };
}
