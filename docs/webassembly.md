# The WebAssembly module

The engine is a 16 KB module with no imports, and its exports are plain functions, which `Engine` wraps. It holds one game, its memory never grows, and it has no way to panic.

| Export | |
|---|---|
| `level_buffer()` | Where to write a level's 1536 bytes. |
| `start(seed)` | Starts that level, and returns 1, or 0 when it has no Murphy. |
| `step(key)` | One tick, and returns its events. |
| `kinds()` `looks()` `dirs()` `progs()` `cell_flags()` `phases()` | Pointers to the 1440-byte arrays described in [Playing a level](playing.md#drawing). |
| `timers()` | A pointer to 1440 `u16`s. |
| `state()`, `state_len()` | Where the whole game lives in memory, and its size. Copy it to save and write it back to restore. |
| `keys_buffer()`, `keys_len()`, `run(count)` | A buffer of keys, and playing the first `count` of them in one call. |
| `stat(n)` | One number, which `n` picks from 0 tick, 1 status, 2 Infotrons needed, 3 left, 4 red disks, 5 gravity, 6 frozen Zonks, 7 frozen enemies, 8 Murphy's cell, 9 his direction, 10 his action, 11 and 12 its tick and length, 13 and 14 the planted disk's cell (-1 for none) and fuse, 15 and 16 the death's cause and cell. |

The rules are the `crates/core` Rust crate, `no_std` and without allocation. `crates/wasm` builds the module from it.
