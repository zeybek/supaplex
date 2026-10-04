// The DOS game's player list (PLAYER.LST) and hall of fame (HALLFAME.LST).
// Read a player's progress to carry on where they left off, or write the
// files for the original game to read.
//
//   node examples/node/player-lists.js [PLAYER.LST HALLFAME.LST]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  LevelState,
  nextLevel,
  readHallOfFame,
  readPlayers,
  writeHallOfFame,
  writePlayers,
} from "@zeybek/supaplex";

const out = new URL("out/", import.meta.url);
mkdirSync(out, { recursive: true });

// Two players. One has solved the first ten levels but skipped the fourth,
// and the other has just started. Every level has a state, 111 in all. The game
// gives a player the first unsolved level before any skipped one, so the
// first player's next level is 11.
const levels = Array(111).fill(LevelState.Unsolved);
levels.fill(LevelState.Solved, 0, 10);
levels[3] = LevelState.Skipped;
const players = [
  { name: "MURPHY", seconds: 3725, levels, finished: false },
  {
    name: "ZEYBEK",
    seconds: 95,
    levels: Array(111).fill(LevelState.Unsolved),
    finished: false,
  },
];
writeFileSync(new URL("PLAYER.LST", out), writePlayers(players));

// Fastest first, whatever the order given.
const fame = [
  { name: "MURPHY", seconds: 21000 },
  { name: "ELECTRON", seconds: 18723 },
];
writeFileSync(new URL("HALLFAME.LST", out), writeHallOfFame(fame));

// Reading them back, from the files given or the ones just written.
const [playerFile, fameFile] = process.argv[2]
  ? process.argv.slice(2, 4)
  : [new URL("PLAYER.LST", out), new URL("HALLFAME.LST", out)];
const read = readPlayers(new Uint8Array(readFileSync(playerFile)));
if (!read) throw new Error("Not a player list");

/** Seconds as h:mm:ss. */
function time(seconds) {
  const two = (n) => String(n).padStart(2, "0");
  const minutes = Math.floor(seconds / 60) % 60;
  return `${Math.floor(seconds / 3600)}:${two(minutes)}:${two(seconds % 60)}`;
}

// There are 20 places, and an empty one is null.
for (const player of read) {
  if (!player) continue;
  const solved = player.levels.filter((s) => s === LevelState.Solved).length;
  console.log(
    `${player.name.padEnd(8)} ${time(player.seconds)}, ${solved} solved, next level ${nextLevel(player.levels)}`,
  );
}

const hall = readHallOfFame(new Uint8Array(readFileSync(fameFile)));
if (!hall) throw new Error("Not a hall of fame");
console.log("Hall of fame");
for (const [i, place] of hall.entries())
  console.log(`  ${i + 1}. ${place.name.padEnd(8)} ${time(place.seconds)}`);
