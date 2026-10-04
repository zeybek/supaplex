import assert from "node:assert/strict";
import { test } from "vitest";
import { CELLS, Kind, Look, WIDTH } from "../engine/constants.ts";
import { blankLevel } from "../formats/level.ts";
import { PIECES, rectangle } from "./paint.ts";
import { copyRegion, flipRegion, pasteRegion, rotateRegion } from "./region.ts";

const count = (bytes: Uint8Array, code: number) =>
  bytes.subarray(0, CELLS).filter((c) => c === code).length;

test("a region copies, pastes elsewhere, and is cut at the field's edge", () => {
  const bytes = blankLevel();
  rectangle(bytes, 3 * WIDTH + 3, 4 * WIDTH + 5, Kind.Infotron);
  const region = copyRegion(bytes, 4 * WIDTH + 5, 3 * WIDTH + 3);
  assert.deepEqual([region.width, region.height], [3, 2]);
  assert.ok(region.codes.every((c) => c === Kind.Infotron));

  assert.ok(pasteRegion(bytes, region, 10 * WIDTH + 20));
  assert.equal(count(bytes, Kind.Infotron), 12);
  // At the bottom right corner, only the cell that fits goes in.
  assert.ok(pasteRegion(bytes, region, CELLS - 1));
  assert.equal(count(bytes, Kind.Infotron), 13);
  assert.equal(pasteRegion(bytes, region, 10 * WIDTH + 20), false);
});

test("a flipped region turns its one-way pieces round", () => {
  const region = {
    width: 3,
    height: 2,
    codes: Uint8Array.from([
      Kind.PortRight,
      Kind.Base,
      Look.RamLeft,
      Kind.SpecialUp,
      Kind.Zonk,
      Look.RamTop,
    ]),
  };
  assert.deepEqual(
    [...flipRegion(region, "horizontal").codes],
    [
      Look.RamRight,
      Kind.Base,
      Kind.PortLeft,
      Look.RamTop,
      Kind.Zonk,
      Kind.SpecialUp,
    ],
  );
  assert.deepEqual(
    [...flipRegion(region, "vertical").codes],
    [
      Kind.SpecialDown,
      Kind.Zonk,
      Look.RamBottom,
      Kind.PortRight,
      Kind.Base,
      Look.RamLeft,
    ],
  );
});

test("a turned region stands on its side, and its ports and chips turn with it", () => {
  const region = {
    width: 3,
    height: 2,
    codes: Uint8Array.from([
      Kind.PortRight,
      Look.RamLeft,
      Look.RamRight,
      Kind.Base,
      Kind.PortVertical,
      Kind.SpecialUp,
    ]),
  };
  const turned = rotateRegion(region);
  assert.equal(turned.width, 2);
  assert.equal(turned.height, 3);
  assert.deepEqual(
    [...turned.codes],
    [
      Kind.Base,
      Kind.PortDown,
      Kind.PortHorizontal,
      Look.RamTop,
      Kind.SpecialRight,
      Look.RamBottom,
    ],
  );
  // Four quarter turns, or none, give the region back: a copy of it.
  for (const turns of [0, 4, -4]) {
    const same = rotateRegion(region, turns);
    assert.deepEqual(same, region);
    assert.notEqual(same.codes, region.codes);
  }
  assert.deepEqual(rotateRegion(turned, -1), region);
  assert.deepEqual(rotateRegion(region, 2), rotateRegion(region, -2));
  assert.deepEqual(
    [...rotateRegion(region, 2).codes],
    [
      Kind.SpecialDown,
      Kind.PortVertical,
      Kind.Base,
      Look.RamLeft,
      Look.RamRight,
      Kind.PortLeft,
    ],
  );
  for (const piece of PIECES) {
    let codes: Uint8Array = Uint8Array.of(piece.code);
    for (let t = 0; t < 4; t++)
      codes = rotateRegion({ width: 1, height: 1, codes }).codes;
    assert.equal(codes[0], piece.code, piece.name);
  }
});
