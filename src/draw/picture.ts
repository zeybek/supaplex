import { CELLS, HEIGHT, WIDTH } from "../engine/constants.ts";
import { SHAPES } from "./palette.ts";

const MAX_SCALE = 64;

function rgb(hex: string): [number, number, number] {
  const digits =
    hex.length === 4
      ? [...hex.slice(1)].map((d) => d + d).join("")
      : hex.slice(1);
  const value = Number.parseInt(digits, 16);
  return [value >> 16, (value >> 8) & 0xff, value & 0xff];
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes)
    c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function zlib(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * A PNG of the field in the canvas helpers' colours, without glyphs; no
 * canvas needed.
 *
 * @param scale - Pixels a side of a cell, 1 to 64.
 */
export async function levelPicture(
  bytes: Uint8Array,
  scale = 4,
): Promise<Uint8Array> {
  if (!Number.isInteger(scale) || scale < 1 || scale > MAX_SCALE)
    throw new RangeError(`Not a scale from 1 to ${MAX_SCALE}: ${scale}`);
  const width = WIDTH * scale;
  const height = HEIGHT * scale;
  // Each row: a filter byte (0, none), then RGB.
  const row = 1 + width * 3;
  const pixels = new Uint8Array(row * height);
  const inset = Math.floor(scale / 8);
  const radius = scale / 2 - inset;
  for (let cell = 0; cell < CELLS; cell++) {
    const shape = SHAPES[bytes[cell] as number];
    if (!shape) continue;
    const colour = rgb(shape.fill);
    const left = (cell % WIDTH) * scale;
    const top = Math.floor(cell / WIDTH) * scale;
    for (let y = inset; y < scale - inset; y++) {
      for (let x = inset; x < scale - inset; x++) {
        const dx = x + 0.5 - scale / 2;
        const dy = y + 0.5 - scale / 2;
        if (shape.round && dx * dx + dy * dy > radius * radius) continue;
        pixels.set(colour, (top + y) * row + 1 + (left + x) * 3);
      }
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  // 8-bit RGB, no interlace.
  header.set([8, 2, 0, 0, 0], 8);
  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk("IHDR", header),
    chunk("IDAT", await zlib(pixels)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
