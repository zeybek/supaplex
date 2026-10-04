declare const snapshot: unique symbol;

/** A saved moment of a game, from {@link Engine.save}. */
export type Snapshot = { readonly [snapshot]: true };

// Only `keep` makes snapshots, so none can be forged.
const snapshots = new WeakMap<Snapshot, Uint8Array>();

export function keep(bytes: Uint8Array): Snapshot {
  const saved = Object.freeze({}) as Snapshot;
  snapshots.set(saved, bytes);
  return saved;
}

/** @throws TypeError when `saved` did not come from {@link keep}. */
export function bytesOf(saved: Snapshot): Uint8Array {
  const bytes = snapshots.get(saved);
  if (!bytes) throw new TypeError("Not a snapshot from Engine.save()");
  return bytes;
}

/**
 * Whether two snapshots are the same moment of a game, byte for byte.
 * Compared four bytes at a time: the module's state is a whole number of
 * them, each snapshot in a buffer of its own.
 */
export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  const x = bytesOf(a);
  const y = bytesOf(b);
  const words = x.length >> 2;
  const wx = new Uint32Array(x.buffer, x.byteOffset, words);
  const wy = new Uint32Array(y.buffer, y.byteOffset, words);
  for (let i = 0; i < words; i++) if (wx[i] !== wy[i]) return false;
  return true;
}
