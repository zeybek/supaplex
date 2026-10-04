import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "vitest";
import { picture } from "../test/picture.ts";
import { type Io, main } from "./cli.ts";
import { Kind, LEVEL_BYTES, WIDTH } from "./engine/constants.ts";
import { blankLevel, readSettings, writeSettings } from "./formats/level.ts";
import { readLevelSet, writeLevelSet } from "./formats/level-set.ts";
import { fromSp, toSp } from "./formats/sp.ts";

const root = join(import.meta.dirname, "..");
const DAT = new Uint8Array(readFileSync(join(root, "data", "LEVELS.DAT")));
const DEMO5 = new Uint8Array(readFileSync(join(root, "data", "DEMO5.BIN")));

function memory(files: Record<string, Uint8Array> = {}) {
  const lines: string[] = [];
  const io: Io = {
    read(path) {
      const file = files[path];
      if (!file) throw new Error(`ENOENT: ${path}`);
      return file;
    },
    write(path, bytes) {
      files[path] = bytes;
    },
    out: (line) => lines.push(line),
  };
  return { io, files, lines };
}

test("without a command it knows, or its arguments, it shows how to use it", async () => {
  for (const args of [[], ["nope"], ["verify"], ["split", "set.dat"]]) {
    const { io, lines } = memory();
    assert.equal(await main(args, io), 2, args.join(" "));
    assert.match(lines[0] ?? "", /^Usage: supaplex/);
  }
});

test("info lists a set's levels and says what keeps one from playing", async () => {
  const broken = blankLevel();
  broken[5 * WIDTH + 5] = Kind.Murphy;
  writeSettings(broken, {
    ...readSettings(broken),
    title: "",
    gravity: true,
    freezeZonks: true,
  });
  const { io, lines } = memory({ "LEVELS.DAT": DAT, "broken.sp": broken });
  assert.equal(await main(["info", "LEVELS.DAT"], io), 0);
  assert.equal(lines.length, 111);
  assert.equal(lines[0], "1. WARM UP: 19 of 19 Infotrons");
  lines.length = 0;
  assert.equal(await main(["info", "broken.sp"], io), 0);
  assert.equal(
    lines[0],
    "1. (no title): 0 of 0 Infotrons, gravity, Zonks frozen (cannot be played: more than one Murphy: all of them die when one does)",
  );
});

test("a file it cannot read, or that holds no level, fails with a line", async () => {
  const { io, lines } = memory({ "odd.dat": new Uint8Array(100) });
  assert.equal(await main(["info", "missing.sp"], io), 1);
  assert.match(lines[0] ?? "", /ENOENT/);
  assert.equal(await main(["info", "odd.dat"], io), 1);
  assert.equal(lines[1], "odd.dat is not a level");
});

test("verify plays a .SP file's demo", async () => {
  const losing = DEMO5.slice(0, LEVEL_BYTES + 3);
  losing[LEVEL_BYTES + 2] = 0xff;
  const { io, lines } = memory({
    "demo5.sp": DEMO5,
    "losing.sp": losing,
    "bare.sp": blankLevel(),
  });
  assert.equal(await main(["verify", "demo5.sp"], io), 0);
  assert.equal(lines[0], "wins in 164.6 s (5760 ticks)");
  assert.equal(await main(["verify", "losing.sp"], io), 1);
  assert.equal(lines[1], "does not win");
  assert.equal(await main(["verify", "bare.sp"], io), 1);
  assert.equal(lines[2], "bare.sp has no demo");
});

test("link gives a level's fragment, with its demo when it wins", async () => {
  const { io, lines } = memory({ "demo5.sp": DEMO5, "bare.sp": blankLevel() });
  assert.equal(await main(["link", "demo5.sp"], io), 0);
  assert.match(lines[0] ?? "", /^#l=l1\.[\w-]+&r=r1\./);
  assert.equal(await main(["link", "bare.sp"], io), 0);
  assert.doesNotMatch(lines[1] ?? "", /&r=/);
});

test("image writes a level's picture, or one for each level of a set", async () => {
  const set = writeLevelSet([blankLevel(), picture(["M.E"])]);
  const { io, files, lines } = memory({
    "two.dat": set,
    "one.sp": toSp(blankLevel()),
  });
  const png = [0x89, 0x50, 0x4e, 0x47];
  assert.equal(await main(["image", "one.sp", "one.png"], io), 0);
  assert.deepEqual(
    [...(files["one.png"] ?? new Uint8Array()).subarray(0, 4)],
    png,
  );
  assert.equal(lines[0], "written to one.png");
  assert.equal(await main(["image", "two.dat", "pictures", "1"], io), 0);
  assert.equal(lines[1], "2 pictures written to pictures");
  const second = files[join("pictures", "002.png")];
  assert.deepEqual([...(second ?? new Uint8Array()).subarray(0, 4)], png);
  // At one pixel a cell, the picture is 60 by 24.
  assert.deepEqual(
    [...(second ?? new Uint8Array()).subarray(16, 24)],
    [0, 0, 0, 60, 0, 0, 0, 24],
  );
  assert.equal(await main(["image", "one.sp", "x.png", "0"], io), 1);
  assert.match(lines[2] ?? "", /^RangeError: Not a scale/);
});

test("split writes a set's levels as .SP files, and join puts them back", async () => {
  const set = writeLevelSet([blankLevel(), picture(["M.E"])]);
  const { io, files, lines } = memory({ "two.dat": set });
  assert.equal(await main(["split", "two.dat", "out"], io), 0);
  assert.equal(lines[0], "2 levels written to out");
  const second = files[join("out", "002.sp")];
  assert.ok(second);
  assert.deepEqual(fromSp(second), readLevelSet(set)?.[1]);
  assert.equal(second[LEVEL_BYTES], undefined, "no demo, just the level");

  assert.equal(
    await main(
      ["join", "again.dat", join("out", "001.sp"), join("out", "002.sp")],
      io,
    ),
    0,
  );
  assert.deepEqual(files["again.dat"], set);
  assert.equal(
    await main(
      ["split", "001.sp", "out"],
      memory({ "001.sp": toSp(blankLevel()) }).io,
    ),
    1,
  );
});

test("the supaplex command runs on the real file system", () => {
  const output = execFileSync(
    process.execPath,
    [join(root, "src", "bin.ts"), "info", join(root, "data", "DEMO5.BIN")],
    { encoding: "utf8" },
  );
  assert.equal(output.trim(), "1. EASY DEAL: 51 of 51 Infotrons");
});
