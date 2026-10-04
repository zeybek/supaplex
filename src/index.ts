/**
 * The Supaplex engine and what a game or an editor needs around it.
 *
 * @module
 */

export { levelPicture } from "./draw/picture.ts";
export {
  cellsBetween,
  fill,
  PIECES,
  type Piece,
  paint,
  rectangle,
} from "./editor/paint.ts";
export {
  copyRegion,
  flipRegion,
  pasteRegion,
  type Region,
  rotateRegion,
} from "./editor/region.ts";
export {
  Action,
  Cause,
  CELLS,
  Dir,
  type Direction,
  Event,
  Flag,
  HEIGHT,
  input,
  Kind,
  LEVEL_BYTES,
  Look,
  Phase,
  SLIDE,
  STEP,
  Status,
  TICKS_PER_SECOND,
  WIDTH,
} from "./engine/constants.ts";
export {
  ENGINE_BYTES,
  Engine,
  type MurphyState,
  type Snapshot,
} from "./engine/engine.ts";
export {
  blankLevel,
  formatTitle,
  isLevel,
  type Level,
  type LevelSettings,
  MAX_SPECIALS,
  parseLevel,
  problems,
  readSettings,
  type SpecialPort,
  specialsFor,
  writeSettings,
} from "./formats/level.ts";
export { readLevelSet, writeLevelSet } from "./formats/level-set.ts";
export {
  levelFromText,
  levelToText,
  type Shared,
  sharedFromHash,
  sharedToHash,
} from "./formats/link.ts";
export {
  HALL_OF_FAME_PLACES,
  type HallOfFamePlace,
  LevelState,
  nextLevel,
  PLAYER_PLACES,
  type Player,
  readHallOfFame,
  readPlayers,
  writeHallOfFame,
  writePlayers,
} from "./formats/player-lists.ts";
export { fromSp, spDemo, toSp } from "./formats/sp.ts";
export {
  DEMO_END,
  decodeDemo,
  encodeDemo,
  type Run,
  runFromText,
  runOf,
  runToText,
  verify,
} from "./replay/run.ts";
export { divergence, type Trace, traceRun } from "./replay/trace.ts";
