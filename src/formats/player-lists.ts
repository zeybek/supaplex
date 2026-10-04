// PLAYER.LST and HALLFAME.LST, laid out as the disassembly's routines use
// them: readPlayersLst, readHallfameLst, sub_4CFB2 and sub_4CFDB (reading
// and writing), sub_4AB1B (a new name), sub_4AD0E (an emptied place),
// sub_4A95F (time played), sub_4C34A (the next level), sub_4D1B6 (the
// hall of fame).

export const LevelState = { Unsolved: 0, Solved: 1, Skipped: 2 } as const;

export const PLAYER_PLACES = 20;
export const HALL_OF_FAME_PLACES = 3;

export interface Player {
  /** Up to 8 characters. */
  name: string;
  /** Time played; at most 255 hours. */
  seconds: number;
  /** A {@link LevelState} for each of the 111 levels. */
  levels: number[];
  /** Solved every level and went into the hall of fame. */
  finished: boolean;
}

export interface HallOfFamePlace {
  name: string;
  seconds: number;
}

const LEVEL_COUNT = 111;
const PLAYER_BYTES = 128;
const PLACE_BYTES = 12;
const NAME_BYTES = 8;
const LEVELS_AT = 12;
const NEXT_AT = 126;
const FINISHED_AT = 127;
const EMPTY_NAME = "--------";
const MAX_SECONDS = 255 * 3600 + 59 * 60 + 59;
/** The next level once none is left. */
const NONE_LEFT = 113;

// A player's record and a hall of fame place both start with a name and a time.
function readHead(bytes: Uint8Array): HallOfFamePlace {
  const name = String.fromCharCode(...bytes.subarray(0, NAME_BYTES)).trim();
  const [hours = 0, minutes = 0, seconds = 0] = bytes.subarray(9, 12);
  return { name, seconds: hours * 3600 + minutes * 60 + seconds };
}

/** @throws RangeError for a name or time the game cannot keep. */
function writeHead(out: Uint8Array, { name, seconds }: HallOfFamePlace): void {
  // No space at either end: the game pads names with them.
  if (
    !/^[\x21-\x7e]([\x20-\x7e]{0,6}[\x21-\x7e])?$/.test(name) ||
    name === EMPTY_NAME
  )
    throw new RangeError(`Not a player's name: ${JSON.stringify(name)}`);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_SECONDS)
    throw new RangeError(`Not a time the game can keep: ${seconds}`);
  const padded = name.padStart(NAME_BYTES, " ");
  for (let i = 0; i < NAME_BYTES; i++) out[i] = padded.charCodeAt(i);
  out[9] = Math.floor(seconds / 3600);
  out[10] = Math.floor(seconds / 60) % 60;
  out[11] = seconds % 60;
}

/** The first unsolved level, else the first skipped; `null` when all are solved. */
export function nextLevel(levels: readonly number[]): number | null {
  for (const state of [LevelState.Unsolved, LevelState.Skipped]) {
    const at = levels.indexOf(state);
    if (at >= 0) return at + 1;
  }
  return null;
}

/** One entry per place, `null` for an empty one; `null` for a file of another size. */
export function readPlayers(file: Uint8Array): (Player | null)[] | null {
  if (file.length !== PLAYER_PLACES * PLAYER_BYTES) return null;
  return Array.from({ length: PLAYER_PLACES }, (_, place) => {
    const record = file.subarray(
      place * PLAYER_BYTES,
      (place + 1) * PLAYER_BYTES,
    );
    if (String.fromCharCode(...record.subarray(0, NAME_BYTES)) === EMPTY_NAME)
      return null;
    return {
      ...readHead(record),
      levels: [...record.subarray(LEVELS_AT, LEVELS_AT + LEVEL_COUNT)],
      finished: record[FINISHED_AT] !== 0,
    };
  });
}

/** @throws RangeError for more than 20 places, or a player the game cannot keep. */
export function writePlayers(players: readonly (Player | null)[]): Uint8Array {
  if (players.length > PLAYER_PLACES)
    throw new RangeError(`At most ${PLAYER_PLACES} places: ${players.length}`);
  const out = new Uint8Array(PLAYER_PLACES * PLAYER_BYTES);
  for (let place = 0; place < PLAYER_PLACES; place++) {
    const record = out.subarray(
      place * PLAYER_BYTES,
      (place + 1) * PLAYER_BYTES,
    );
    const player = players[place];
    if (!player) {
      for (let i = 0; i < NAME_BYTES; i++) record[i] = EMPTY_NAME.charCodeAt(i);
      continue;
    }
    writeHead(record, player);
    const { levels } = player;
    if (
      levels.length !== LEVEL_COUNT ||
      !levels.every((s) => s >= 0 && s <= 2 && Number.isInteger(s))
    )
      throw new RangeError("Levels must be 111 level states");
    record.set(levels, LEVELS_AT);
    record[NEXT_AT] = nextLevel(levels) ?? NONE_LEFT;
    record[FINISHED_AT] = player.finished ? 1 : 0;
  }
  return out;
}

/** The places with someone in them; `null` for a file of another size. */
export function readHallOfFame(file: Uint8Array): HallOfFamePlace[] | null {
  if (file.length !== HALL_OF_FAME_PLACES * PLACE_BYTES) return null;
  const places: HallOfFamePlace[] = [];
  for (let at = 0; at < file.length; at += PLACE_BYTES) {
    const place = readHead(file.subarray(at, at + PLACE_BYTES));
    // A place with no time is empty.
    if (place.seconds > 0) places.push(place);
  }
  return places;
}

/**
 * Fastest first.
 *
 * @throws RangeError for more than 3 places, or one without a time.
 */
export function writeHallOfFame(
  places: readonly HallOfFamePlace[],
): Uint8Array {
  if (places.length > HALL_OF_FAME_PLACES)
    throw new RangeError(
      `At most ${HALL_OF_FAME_PLACES} places: ${places.length}`,
    );
  const out = new Uint8Array(HALL_OF_FAME_PLACES * PLACE_BYTES);
  const sorted = [...places].sort((a, b) => a.seconds - b.seconds);
  for (let i = 0; i < HALL_OF_FAME_PLACES; i++) {
    const record = out.subarray(i * PLACE_BYTES, (i + 1) * PLACE_BYTES);
    const place = sorted[i];
    if (!place) {
      record.fill(0x20, 0, NAME_BYTES);
      continue;
    }
    if (place.seconds === 0)
      throw new RangeError("A place in the hall of fame needs a time");
    writeHead(record, place);
  }
  return out;
}
