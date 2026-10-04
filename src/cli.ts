import { join } from "node:path";
import { levelPicture } from "./draw/picture.ts";
import { CELLS, Kind, TICKS_PER_SECOND } from "./engine/constants.ts";
import { Engine } from "./engine/engine.ts";
import { parseLevel, problems } from "./formats/level.ts";
import { readLevelSet, writeLevelSet } from "./formats/level-set.ts";
import { type Shared, sharedToHash } from "./formats/link.ts";
import { fromSp, spDemo, toSp } from "./formats/sp.ts";
import { type Run, runOf } from "./replay/run.ts";

/** Files and output, so tests can run the command in memory. */
export interface Io {
  read(path: string): Uint8Array;
  /** Makes the directory if need be. */
  write(path: string, bytes: Uint8Array): void;
  out(line: string): void;
}

const USAGE = `Usage: supaplex <command> [arguments]

  info <file.sp | set.dat>      The levels: titles, settings, and what keeps one from playing
  verify <file.sp>              Plays a .SP file's demo: does it win, and when
  link <file.sp>                The level, and its demo if it wins, as a link's fragment
  image <file> <out> [scale]    A PNG of the level, or of each level of a set into the
                                directory <out>; scale is pixels a cell, 4 by default
  split <set.dat> <directory>   Writes each level of a set as its own .SP file
  join <set.dat> <file.sp>...   Joins .SP files into a level set`;

const seconds = (ticks: number) => `${(ticks / TICKS_PER_SECOND).toFixed(1)} s`;

/** 001, 002 and so on. */
const numbered = (index: number, extension: string) =>
  `${String(index + 1).padStart(3, "0")}.${extension}`;

/** Printed as it is, and the command fails. */
class Refusal extends Error {}

const isSet = (path: string) => path.toLowerCase().endsWith(".dat");

function levelsIn(io: Io, path: string): Uint8Array[] {
  const file = io.read(path);
  const levels = isSet(path) ? readLevelSet(file) : [fromSp(file)];
  if (!levels?.[0]) throw new Refusal(`${path} is not a level`);
  return levels as Uint8Array[];
}

function demoOf(
  engine: Engine,
  file: Uint8Array,
  level: Uint8Array,
): Run | null {
  const demo = spDemo(file);
  return demo && runOf(engine, level, demo.seed, demo.demo);
}

function describe(level: Uint8Array, number: number): string {
  const { title, needed, gravity, freezeZonks } = parseLevel(level, number);
  const infotrons = level.subarray(0, CELLS).filter((c) => c === Kind.Infotron);
  const settings = [
    `${needed} of ${infotrons.length} Infotrons`,
    ...(gravity ? ["gravity"] : []),
    ...(freezeZonks ? ["Zonks frozen"] : []),
  ];
  const found = problems(level);
  const verdict =
    found.length > 0 ? ` (cannot be played: ${found.join("; ")})` : "";
  return `${number}. ${title || "(no title)"}: ${settings.join(", ")}${verdict}`;
}

/** Returns the exit code: 0 done, 1 a file it could not use or a demo that does not win, 2 usage. */
export async function main(args: string[], io: Io): Promise<number> {
  const [name = "", ...rest] = args;
  const command = commands[name];
  if (!command || rest.length < command.min) {
    io.out(USAGE);
    return 2;
  }
  try {
    return await command.run(io, rest);
  } catch (error) {
    io.out(error instanceof Refusal ? error.message : String(error));
    return 1;
  }
}

interface Command {
  min: number;
  run(io: Io, args: string[]): Promise<number>;
}

const commands: Record<string, Command> = {
  info: {
    min: 1,
    async run(io, [path]) {
      levelsIn(io, path as string).forEach((level, i) => {
        io.out(describe(level, i + 1));
      });
      return 0;
    },
  },

  verify: {
    min: 1,
    async run(io, [path]) {
      const file = io.read(path as string);
      const [level] = levelsIn(io, path as string);
      if (!spDemo(file)) throw new Refusal(`${path} has no demo`);
      const run = demoOf(await Engine.load(), file, level as Uint8Array);
      io.out(
        run
          ? `wins in ${seconds(run.ticks)} (${run.ticks} ticks)`
          : "does not win",
      );
      return run ? 0 : 1;
    },
  },

  link: {
    min: 1,
    async run(io, [path]) {
      const file = io.read(path as string);
      const [level] = levelsIn(io, path as string);
      const shared: Shared = {
        level: level as Uint8Array,
        run: demoOf(await Engine.load(), file, level as Uint8Array),
      };
      io.out(`#${await sharedToHash(shared)}`);
      return 0;
    },
  },

  image: {
    min: 2,
    async run(io, [path, out, scale = "4"]) {
      const levels = levelsIn(io, path as string);
      const pixels = Number(scale);
      if (!isSet(path as string)) {
        io.write(
          out as string,
          await levelPicture(levels[0] as Uint8Array, pixels),
        );
        io.out(`written to ${out}`);
        return 0;
      }
      for (const [i, level] of levels.entries())
        io.write(
          join(out as string, numbered(i, "png")),
          await levelPicture(level, pixels),
        );
      io.out(`${levels.length} pictures written to ${out}`);
      return 0;
    },
  },

  split: {
    min: 2,
    async run(io, [path, directory]) {
      if (!isSet(path as string))
        throw new Refusal(`${path} is not a .DAT level set`);
      const levels = levelsIn(io, path as string);
      levels.forEach((level, i) => {
        io.write(
          join(directory as string, numbered(i, "sp")),
          toSp(level, null, i + 1),
        );
      });
      io.out(`${levels.length} levels written to ${directory}`);
      return 0;
    },
  },

  join: {
    min: 2,
    async run(io, [path, ...files]) {
      const levels = files.map((file) => levelsIn(io, file)[0] as Uint8Array);
      io.write(path as string, writeLevelSet(levels));
      io.out(`${levels.length} levels joined into ${path}`);
      return 0;
    },
  },
};
