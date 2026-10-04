import assert from "node:assert/strict";
import { crc32, inflateSync } from "node:zlib";
import { test } from "vitest";
import { at, picture } from "../../test/picture.ts";
import { HEIGHT, WIDTH } from "../engine/constants.ts";
import { levelPicture } from "./picture.ts";

function readPng(png: Uint8Array) {
  assert.deepEqual(
    [...png.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  const view = new DataView(png.buffer, png.byteOffset, png.length);
  const chunks: { type: string; data: Uint8Array }[] = [];
  for (let i = 8; i < png.length; ) {
    const length = view.getUint32(i);
    const type = String.fromCharCode(...png.subarray(i + 4, i + 8));
    const data = png.subarray(i + 8, i + 8 + length);
    assert.equal(
      view.getUint32(i + 8 + length),
      crc32(png.subarray(i + 4, i + 8 + length)),
      type,
    );
    chunks.push({ type, data });
    i += 12 + length;
  }
  assert.deepEqual(
    chunks.map((c) => c.type),
    ["IHDR", "IDAT", "IEND"],
  );
  const [ihdr, idat] = chunks.map((c) => c.data) as [Uint8Array, Uint8Array];
  const header = new DataView(ihdr.buffer, ihdr.byteOffset);
  const width = header.getUint32(0);
  const height = header.getUint32(4);
  assert.deepEqual([...ihdr.subarray(8)], [8, 2, 0, 0, 0]);
  const raw = inflateSync(idat);
  assert.equal(raw.length, height * (1 + width * 3));
  const pixel = (x: number, y: number) => {
    const i = y * (1 + width * 3) + 1 + x * 3;
    return `#${[...raw.subarray(i, i + 3)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  };
  for (let y = 0; y < height; y++) assert.equal(raw[y * (1 + width * 3)], 0);
  return { width, height, pixel };
}

const LEVEL = picture(["M.O "]);

test("a level's picture is a PNG of the field, a cell a few pixels square", async () => {
  const { width, height, pixel } = readPng(await levelPicture(LEVEL));
  assert.equal(width, WIDTH * 4);
  assert.equal(height, HEIGHT * 4);
  // At 4 pixels a cell there is no gap: base fills its cell to the corner.
  const corner = (cell: number) =>
    pixel((cell % WIDTH) * 4, Math.floor(cell / WIDTH) * 4);
  assert.equal(corner(at(2, 1)), "#2f6b2f");
  assert.equal(corner(at(0, 0)), "#3a3f4b", "hardware");
  assert.equal(corner(at(4, 1)), "#000000", "empty");
  const middle = (cell: number) =>
    pixel((cell % WIDTH) * 4 + 2, Math.floor(cell / WIDTH) * 4 + 2);
  assert.equal(middle(at(1, 1)), "#ee3333");
  assert.equal(middle(at(3, 1)), "#9a9a9a");
});

test("bigger cells have a gap round them, and round pieces have black corners", async () => {
  const { width, pixel } = readPng(await levelPicture(LEVEL, 16));
  assert.equal(width, WIDTH * 16);
  const base = at(2, 1);
  const bx = (base % WIDTH) * 16;
  const by = Math.floor(base / WIDTH) * 16;
  assert.equal(pixel(bx, by), "#000000", "the gap");
  assert.equal(pixel(bx + 2, by + 2), "#2f6b2f");
  const zonk = at(3, 1);
  const zx = (zonk % WIDTH) * 16;
  const zy = Math.floor(zonk / WIDTH) * 16;
  assert.equal(pixel(zx + 3, zy + 3), "#000000", "outside the circle");
  assert.equal(pixel(zx + 8, zy + 8), "#9a9a9a");
});

test("one pixel a cell is the smallest picture, and the scale must be a whole 1 to 64", async () => {
  const { width, height } = readPng(await levelPicture(LEVEL, 1));
  assert.deepEqual([width, height], [WIDTH, HEIGHT]);
  for (const scale of [0, 65, 1.5])
    await assert.rejects(levelPicture(LEVEL, scale), RangeError);
});
