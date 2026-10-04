import { fromBase64 } from "../formats/base64.ts";
import { ENGINE_WASM } from "../generated/engine.ts";
import { bytesOf, keep, type Snapshot } from "./snapshot.ts";

export type { Snapshot } from "./snapshot.ts";

import { CELLS, type Direction, LEVEL_BYTES, WIDTH } from "./constants.ts";

/** Size of the bundled WebAssembly module, in bytes. */
export const ENGINE_BYTES: number = Math.floor(
  (ENGINE_WASM.replace(/=+$/, "").length * 3) / 4,
);

interface Exports {
  memory: WebAssembly.Memory;
  level_buffer(): number;
  start(seed: number): number;
  step(input: number): number;
  kinds(): number;
  looks(): number;
  dirs(): number;
  progs(): number;
  cell_flags(): number;
  phases(): number;
  timers(): number;
  stat(which: number): number;
  state(): number;
  state_len(): number;
  keys_buffer(): number;
  keys_len(): number;
  run(count: number): number;
}

/** Where Murphy is and what he is doing, from {@link Engine.murphy}. */
export interface MurphyState {
  /** The cell he is in, or the one he is moving into. */
  cell: number;
  x: number;
  y: number;
  dir: Direction;
  /** An {@link Action}. */
  action: number;
  /** Ticks into the action's animation, out of `length`; 0 when idle. */
  tick: number;
  length: number;
}

let compiled: Promise<WebAssembly.Module> | null = null;

/** One game of Supaplex, in a WebAssembly instance of its own. */
export class Engine {
  private readonly api: Exports;
  private buffer: ArrayBuffer | null = null;
  private views!: {
    kinds: Uint8Array;
    looks: Uint8Array;
    dirs: Uint8Array;
    progs: Uint8Array;
    flags: Uint8Array;
    phases: Uint8Array;
    timers: Uint16Array;
  };

  private constructor(api: Exports) {
    this.api = api;
  }

  /** The bundled module is compiled once, on the first call. */
  static async load(): Promise<Engine> {
    compiled ??= WebAssembly.compile(fromBase64(ENGINE_WASM) as BufferSource);
    return Engine.fromModule(await compiled);
  }

  /**
   * For runtimes that cannot compile WebAssembly from bytes, such as
   * Cloudflare Workers: pass `@zeybek/supaplex/engine.wasm`, imported.
   */
  static async fromModule(module: WebAssembly.Module): Promise<Engine> {
    const instance = await WebAssembly.instantiate(module, {});
    return new Engine(instance.exports as unknown as Exports);
  }

  // Made again whenever the module's memory grows and moves.
  private get v() {
    const memory = this.api.memory.buffer;
    if (memory !== this.buffer) {
      this.buffer = memory;
      const bytes = (at: number) => new Uint8Array(memory, at, CELLS);
      this.views = {
        kinds: bytes(this.api.kinds()),
        looks: bytes(this.api.looks()),
        dirs: bytes(this.api.dirs()),
        progs: bytes(this.api.progs()),
        flags: bytes(this.api.cell_flags()),
        phases: bytes(this.api.phases()),
        timers: new Uint16Array(memory, this.api.timers(), CELLS),
      };
    }
    return this.views;
  }

  /**
   * @param seed - Decides when bugs spark; only its low 16 bits are used.
   * @returns `false` when the level has no Murphy; the old game stays.
   */
  start(level: Uint8Array, seed = 1): boolean {
    new Uint8Array(
      this.api.memory.buffer,
      this.api.level_buffer(),
      LEVEL_BYTES,
    ).set(level.subarray(0, LEVEL_BYTES));
    return this.api.start(seed >>> 0) === 1;
  }

  /** Plays one tick with the keys from {@link input}; returns its {@link Event} bits. */
  step(key: number): number {
    return this.api.step(key);
  }

  /**
   * One tick per key in a single call, stopping when the game ends. No
   * events. Returns the ticks played.
   */
  run(keys: Uint8Array): number {
    const size = this.api.keys_len();
    const buffer = new Uint8Array(
      this.api.memory.buffer,
      this.api.keys_buffer(),
      size,
    );
    let played = 0;
    for (let at = 0; at < keys.length; at += size) {
      const chunk = keys.subarray(at, at + size);
      buffer.set(chunk);
      const ticks = this.api.run(chunk.length);
      played += ticks;
      if (ticks < chunk.length) break;
    }
    return played;
  }

  /** The whole game now; it can be restored into this engine or another. */
  save(): Snapshot {
    const bytes = new Uint8Array(
      this.api.memory.buffer,
      this.api.state(),
      this.api.state_len(),
    ).slice();
    return keep(bytes);
  }

  /** @throws TypeError when `saved` did not come from `save`. */
  restore(saved: Snapshot): void {
    const bytes = bytesOf(saved);
    new Uint8Array(this.api.memory.buffer, this.api.state(), bytes.length).set(
      bytes,
    );
  }

  /**
   * Each cell's {@link Kind}. This and the other per-cell arrays are live
   * views: `slice()` one to keep it.
   */
  get kinds(): Uint8Array {
    return this.v.kinds;
  }
  /** Each cell's code in the level file: a {@link Look} for decorations. */
  get looks(): Uint8Array {
    return this.v.looks;
  }
  /**
   * A {@link Dir} per cell, except for Snik Snaks and Electrons: theirs is
   * in eighths of a turn, so halve it.
   */
  get dirs(): Uint8Array {
    return this.v.dirs;
  }
  /** Ticks into each cell's move, out of {@link STEP}, or {@link SLIDE} when rolling. */
  get progs(): Uint8Array {
    return this.v.progs;
  }
  get flags(): Uint8Array {
    return this.v.flags;
  }
  /** A {@link Phase} per cell. */
  get phases(): Uint8Array {
    return this.v.phases;
  }
  /** Ticks each cell's explosion still burns. */
  get timers(): Uint16Array {
    return this.v.timers;
  }

  get tick(): number {
    return this.api.stat(0);
  }
  /** A {@link Status}. */
  get status(): number {
    return this.api.stat(1);
  }
  /** Infotrons the exit needs. */
  get needed(): number {
    return this.api.stat(2);
  }
  /** Infotrons still to collect. */
  get remaining(): number {
    return this.api.stat(3);
  }
  get redDisks(): number {
    return this.api.stat(4);
  }
  // These three can change during play, through special ports.
  get gravity(): boolean {
    return this.api.stat(5) === 1;
  }
  get frozenZonks(): boolean {
    return this.api.stat(6) === 1;
  }
  get frozenEnemies(): boolean {
    return this.api.stat(7) === 1;
  }
  /** The red disk Murphy set down, and the ticks before it goes off. */
  get planted(): { cell: number; fuse: number } | null {
    const cell = this.api.stat(13);
    return cell < 0 ? null : { cell, fuse: this.api.stat(14) };
  }

  /** {@link Cause.None} while Murphy lives. */
  get death(): { cause: number; cell: number } {
    return { cause: this.api.stat(15), cell: this.api.stat(16) };
  }

  get murphy(): MurphyState {
    const cell = this.api.stat(8);
    return {
      cell,
      x: cell % WIDTH,
      y: Math.floor(cell / WIDTH),
      dir: this.api.stat(9) as Direction,
      action: this.api.stat(10),
      tick: this.api.stat(11),
      length: this.api.stat(12),
    };
  }
}
