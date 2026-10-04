import { LEVEL_BYTES } from "../engine/constants.ts";
import { type Run, runFromText, runToText } from "../replay/run.ts";
import { fromBase64Url, toBase64Url } from "./base64.ts";
import { isLevel } from "./level.ts";
import { toSp } from "./sp.ts";

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** `null` when the bytes are not deflated, or inflate past `limit`. */
async function inflate(
  packed: Uint8Array,
  limit: number,
): Promise<Uint8Array | null> {
  const reader = new Blob([packed as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  const out = new Uint8Array(limit);
  let length = 0;
  try {
    for (
      let part = await reader.read();
      !part.done;
      part = await reader.read()
    ) {
      if (length + part.value.length > limit) {
        await reader.cancel();
        return null;
      }
      out.set(part.value, length);
      length += part.value.length;
    }
  } catch {
    return null;
  }
  return out.slice(0, length);
}

/** `l1.<deflated, base64url>`: about 500 characters. */
export async function levelToText(bytes: Uint8Array): Promise<string> {
  return `l1.${toBase64Url(await deflate(toSp(bytes)))}`;
}

/** Takes untrusted input; `null` for anything but a level. */
export async function levelFromText(text: unknown): Promise<Uint8Array | null> {
  if (typeof text !== "string" || !text.startsWith("l1.") || text.length > 8000)
    return null;
  const packed = fromBase64Url(text.slice(3));
  if (!packed) return null;
  const bytes = await inflate(packed, LEVEL_BYTES);
  return bytes && isLevel(bytes) ? bytes : null;
}

export interface Shared {
  level: Uint8Array;
  run: Run | null;
  /** A tick of the run to open at, 0 to `run.ticks`. */
  at?: number;
}

const isMoment = (at: number, run: Run) =>
  Number.isInteger(at) && at >= 0 && at <= run.ticks;

/**
 * `l=<level>`, then `&r=<run>` and `&t=<tick>` when there are.
 *
 * @throws RangeError when `at` is not a tick of the run.
 */
export async function sharedToHash(shared: Shared): Promise<string> {
  const { run, at } = shared;
  if (at !== undefined && !(run && isMoment(at, run)))
    throw new RangeError(`Not a tick of the run: ${at}`);
  const level = `l=${await levelToText(shared.level)}`;
  if (!run) return level;
  const moment = at === undefined ? "" : `&t=${at}`;
  return `${level}&r=${runToText(run)}${moment}`;
}

/** With or without the `#`; `null` without a level. A bad run or moment is left out. */
export async function sharedFromHash(hash: string): Promise<Shared | null> {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const level = await levelFromText(params.get("l"));
  if (!level) return null;
  const run = runFromText(params.get("r"));
  const t = params.get("t");
  const at = t !== null && /^\d{1,7}$/.test(t) ? Number(t) : -1;
  return run && isMoment(at, run) ? { level, run, at } : { level, run };
}
