import assert from "node:assert/strict";
import { test } from "vitest";
import {
  LevelState,
  nextLevel,
  readHallOfFame,
  readPlayers,
  writeHallOfFame,
  writePlayers,
} from "./player-lists.ts";

const { Unsolved, Solved, Skipped } = LevelState;

const progress = (solved: number): number[] =>
  Array.from({ length: 111 }, (_, i) => (i < solved ? Solved : Unsolved));

test("a player list is read where the game keeps each thing", () => {
  // Laid out by hand, as the disassembly reads it: 20 records of 128 bytes.
  const file = new Uint8Array(2560);
  for (let place = 0; place < 20; place++)
    file.fill(0x2d, place * 128, place * 128 + 8);
  const second = file.subarray(128, 256);
  second.set([...("  MURPHY" as string)].map((c) => c.charCodeAt(0)));
  second[8] = 0;
  second.set([1, 2, 3], 9); // 1 h 2 min 3 s
  second.fill(Solved, 12, 12 + 5);
  second[12 + 5] = Skipped;
  second[126] = 7;
  second[127] = 0;

  const players = readPlayers(file);
  assert.ok(players);
  assert.equal(players.length, 20);
  assert.equal(players[0], null);
  assert.deepEqual(players[1], {
    name: "MURPHY",
    seconds: 3723,
    levels: [...progress(5).fill(Skipped, 5, 6)],
    finished: false,
  });
  assert.equal(players.filter(Boolean).length, 1);
});

test("players written read back the same, with the next level and the rest as the game writes them", () => {
  const ahmet = {
    name: "AHMET",
    seconds: 255 * 3600 + 59 * 60 + 59,
    levels: progress(111),
    finished: true,
  };
  const fresh = {
    name: "A B",
    seconds: 0,
    levels: progress(0),
    finished: false,
  };
  const skipper = {
    name: "~!",
    seconds: 59,
    levels: progress(111).fill(Skipped, 40, 42),
    finished: false,
  };
  const file = writePlayers([null, ahmet, fresh, skipper]);
  assert.equal(file.length, 2560);
  assert.deepEqual(readPlayers(file), [
    null,
    ahmet,
    fresh,
    skipper,
    ...Array(16).fill(null),
  ]);
  assert.equal(String.fromCharCode(...file.subarray(128, 136)), "   AHMET");
  assert.deepEqual([...file.subarray(128 + 8, 128 + 12)], [0, 255, 59, 59]);
  assert.equal(file[128 + 126], 113);
  assert.equal(file[256 + 126], 1);
  assert.equal(file[384 + 126], 41);
  assert.equal(file[128 + 127], 1);
  assert.equal(String.fromCharCode(...file.subarray(0, 8)), "--------");
  assert.ok(file.subarray(8, 128).every((b) => b === 0));
  assert.ok(file.subarray(384 + 123, 384 + 126).every((b) => b === 0));
});

test("the next level is the first unsolved, then the first skipped", () => {
  assert.equal(nextLevel(progress(0)), 1);
  assert.equal(nextLevel(progress(10)), 11);
  assert.equal(nextLevel(progress(111).fill(Skipped, 3, 4)), 4);
  assert.equal(nextLevel(progress(5).fill(Skipped, 1, 2)), 6);
  assert.equal(nextLevel(progress(111)), null);
});

test("what the game could not read is not written", () => {
  const player = {
    name: "OK",
    seconds: 0,
    levels: progress(0),
    finished: false,
  };
  for (const name of [
    "",
    " LEAD",
    "TRAIL ",
    "NINE CHAR",
    "--------",
    "ÇAĞ",
    "TAB\t",
  ])
    assert.throws(() => writePlayers([{ ...player, name }]), RangeError, name);
  for (const seconds of [-1, 1.5, 256 * 3600])
    assert.throws(() => writePlayers([{ ...player, seconds }]), RangeError);
  for (const levels of [
    progress(0).slice(1),
    [...progress(0).slice(1), 3],
    [...progress(0).slice(1), 0.5],
  ])
    assert.throws(() => writePlayers([{ ...player, levels }]), RangeError);
  assert.throws(() => writePlayers(Array(21).fill(null)), RangeError);
  assert.equal(readPlayers(new Uint8Array(2559)), null);
});

test("the hall of fame keeps three, fastest first, and an empty place has no time", () => {
  const places = [
    { name: "SLOW", seconds: 9000 },
    { name: "FAST", seconds: 4000 },
  ];
  const file = writeHallOfFame(places);
  assert.equal(file.length, 36);
  assert.deepEqual(readHallOfFame(file), [
    { name: "FAST", seconds: 4000 },
    { name: "SLOW", seconds: 9000 },
  ]);
  assert.equal(String.fromCharCode(...file.subarray(0, 8)), "    FAST");
  assert.deepEqual([...file.subarray(9, 12)], [1, 6, 40]);
  assert.equal(String.fromCharCode(...file.subarray(24, 32)), "        ");
  assert.ok(file.subarray(32, 36).every((b) => b === 0));
  assert.deepEqual(readHallOfFame(writeHallOfFame([])), []);

  assert.throws(
    () => writeHallOfFame([{ name: "NONE", seconds: 0 }]),
    RangeError,
  );
  assert.throws(
    () => writeHallOfFame(Array(4).fill({ name: "X", seconds: 1 })),
    RangeError,
  );
  assert.equal(readHallOfFame(new Uint8Array(35)), null);
});
