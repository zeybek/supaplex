# How it is checked

The rules are written in Rust from [Cillié Malan's MIT-licensed disassembly](https://github.com/cilliemalan/supaplex) of the original, SpeedFix 6.3. No other Supaplex implementation was used.

The game's ten demos are checked on every frame. After each one, a hash of the 1440 cells, Murphy's cell and the random seed must match the original's ([`demos.rs`](../crates/core/src/tests/demos.rs), [`tests.rs`](../crates/wasm/src/tests.rs)). One cell out of place on any frame fails the test.

[`corpus.rs`](../crates/core/examples/corpus.rs) plays `.SP` solutions. All 6894 that have been tried finish, across the 111 original levels and many sets made by players. They belong to their authors and are not in the repository, so point the example at your own copy.

[`extra.rs`](../crates/core/src/tests/extra.rs) checks recordings of random play and of levels without a border against the hashes of every frame in `data/extra`. In three of them the recordings part from the disassembly below the field, where the original's memory holds the explosion timers, and the rules follow the disassembly there.

The tests also play every level and hundreds of random ones on random keys, twice, and check that the two games are the same. Coverage is 100% for both the TypeScript and the Rust. CI builds the module from the sources and fails unless it matches the committed one byte for byte, and a test fails if the module could panic.
