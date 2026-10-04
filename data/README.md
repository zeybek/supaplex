# Data

| File | What it is |
|---|---|
| `LEVELS.DAT` | The original game's 111 levels, 1536 bytes each. `npm run generate` turns it into `src/generated/levels.ts`. |
| `DEMO0.BIN` to `DEMO9.BIN` | The game's ten recorded demos, each a level followed by its keys. The Rust tests play them and compare every frame with the original, and the replay example shows them. |
| `extra/*.sp`, `extra/*.frames` | A level and its keys (`.sp`), and an FNV-1a hash of every frame of a reference recording of it (`.frames`, 8 bytes a frame), for `crates/core/src/tests/extra.rs`. |

The levels and demos belong to the original game's authors and are distributed as freeware. The repository's MIT licence does not cover them.
