/** Cells are stored row by row: cell `c` is at `c % WIDTH`, `Math.floor(c / WIDTH)`. */
export const WIDTH = 60;
export const HEIGHT = 24;
export const CELLS: number = WIDTH * HEIGHT;
/** The 1440 cells, then 96 bytes of settings. */
export const LEVEL_BYTES = 1536;
export const TICKS_PER_SECOND = 35;
/** Ticks a move from one cell to the next takes. */
export const STEP = 8;
/** Ticks a sideways roll into the next cell takes. */
export const SLIDE = 6;

/**
 * What a cell holds. Up to 25, and 40, these are the level file's codes;
 * decorations play as `Ram` and `Hardware`. The last four appear only
 * while something moves or burns.
 */
export const Kind = {
  Space: 0,
  Zonk: 1,
  Base: 2,
  Murphy: 3,
  Infotron: 4,
  Ram: 5,
  Hardware: 6,
  Exit: 7,
  /** Explodes where it lands. */
  Orange: 8,
  PortRight: 9,
  PortDown: 10,
  PortLeft: 11,
  PortUp: 12,
  /** Also sets gravity and freezing, as the level's table says. */
  SpecialRight: 13,
  SpecialDown: 14,
  SpecialLeft: 15,
  SpecialUp: 16,
  SnikSnak: 17,
  /** Set off by a terminal. */
  Yellow: 18,
  Terminal: 19,
  Red: 20,
  PortVertical: 21,
  PortHorizontal: 22,
  PortCross: 23,
  /** Leaves Infotrons when it explodes. */
  Electron: 24,
  /** Kills Murphy if eaten while it sparks. */
  Bug: 25,
  Invisible: 40,
  /** Something is moving out of the cell. */
  Vacating: 41,
  Explosion: 42,
  /** A red disk set down, about to go off. */
  RedLit: 43,
  /** Promised to something about to move in. */
  Reserved: 44,
} as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

/** Decorations' codes, kept in {@link Engine.looks}; they play as `Kind.Ram` or `Kind.Hardware`. */
export const Look = {
  RamLeft: 26,
  RamRight: 27,
  HardwareRound: 28,
  LampGreen: 29,
  LampBlue: 30,
  LampRed: 31,
  Stripes: 32,
  ResistorMixed: 33,
  Capacitor: 34,
  ResistorsHorizontal: 35,
  ResistorsVertical: 36,
  ResistorsYellow: 37,
  RamTop: 38,
  RamBottom: 39,
} as const;
export type Look = (typeof Look)[keyof typeof Look];

export const Dir = { Up: 0, Left: 1, Down: 2, Right: 3 } as const;
export type Direction = (typeof Dir)[keyof typeof Dir];

/** Bits of {@link Engine.flags}. */
export const Flag = {
  /** Arriving from the cell behind its direction, {@link Engine.progs} ticks in. */
  Moving: 1,
  /** An enemy turning on the spot. */
  Turning: 2,
  Clockwise: 4,
  /** A bug sparking. */
  Active: 8,
  /** Caught in a blast, about to go off itself. */
  Fused: 16,
  /** An Electron's blast: an Infotron when it burns out. */
  Electron: 32,
} as const;

/** Where a Zonk, an Infotron or an orange disk is in its fall. */
export const Phase = {
  AtRest: 0,
  /** The cell below came free; about to fall. */
  Settling: 1,
  /** About to roll off what it rests on. */
  Tipping: 2,
  Rolling: 3,
  Falling: 4,
  /** Pushed by Murphy. */
  Shoved: 5,
} as const;

/** `Dying` lasts while the blast that caught Murphy burns. */
export const Status = { Playing: 0, Won: 1, Dying: 2, Dead: 3 } as const;

/** What Murphy is doing, in {@link MurphyState.action}. */
export const Action = {
  Idle: 0,
  /** Walking, or falling with gravity. */
  Walk: 1,
  Pushing: 2,
  /** Taking the cell beside him without moving. */
  Snapping: 3,
  ThroughPort: 4,
  Leaving: 6,
  /** Nothing to draw: the level is over. */
  Gone: 7,
  /** Pressing against something before it moves. */
  Leaning: 8,
  /** Holding Space to set a red disk down. */
  Planting: 9,
} as const;

export const Cause = {
  None: 0,
  Crushed: 1,
  Enemy: 2,
  Blast: 3,
  Bug: 4,
} as const;

/** Bits of what {@link Engine.step} returns: what happened during the tick. */
export const Event = {
  Infotron: 1,
  Explosion: 2,
  Push: 4,
  /** Base or a bug eaten or snapped. */
  Eat: 8,
  Death: 16,
  Win: 32,
  Terminal: 64,
  Port: 128,
  Gravity: 256,
  RedPicked: 512,
  RedDropped: 1024,
  ExitOpen: 2048,
  /** Something falling came to rest. */
  Landed: 4096,
  BugSpark: 8192,
} as const;

/**
 * The keys held, as {@link Engine.step} takes them. Space with an arrow
 * snaps; Space alone, held 64 ticks after a tick with no keys, sets a red
 * disk down.
 */
export function input(direction: Direction | null, space: boolean): number {
  if (direction === null) return space ? 9 : 0;
  return direction + 1 + (space ? 4 : 0);
}
