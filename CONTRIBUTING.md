# Contributing

Thanks for wanting to help. Questions and bug reports go to the [issue tracker](https://github.com/zeybek/supaplex/issues). A bug report with the level and its keys (a `.SP` file, or a run from `runToText`) can be replayed exactly.

## How a change gets in

Behaviour must stay the original's. A change to `crates/core` has to keep every demo and recording test passing on every frame. A rule comes from the disassembly at [cilliemalan/supaplex](https://github.com/cilliemalan/supaplex), so name the routine in the pull request. Do not bring code from other Supaplex implementations. This crate is MIT because it was written from the disassembly alone.

After a change under `crates/`, the git hook runs `npm run generate` and adds the rebuilt `src/generated/` to the same commit. Without the hooks, run it yourself. A test fails when the two disagree.

Run `npm run check` before you open a pull request. The git hooks run most of it on each commit, and CI runs all of it on the pull request.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) (`fix:`, `feat:`, `docs:`, `chore:` and so on). Releases and the changelog are made from them.

## Repository layout

| Path | What it is |
|---|---|
| `crates/core/` | The game, a `no_std` Rust crate written from Cillié Malan's MIT-licensed disassembly of the original. |
| `crates/wasm/` | The WebAssembly module. Each tick it turns the game's own cell memory into the arrays a renderer draws. |
| `src/` | The TypeScript package. At the top are its entry points (`index.ts`, `levels.ts`, `canvas.ts`, `analysis.ts`), the command (`cli.ts`, run by `bin.ts`) and, in `generated/`, the built module and the levels, committed so installing never needs Rust. Below them are `engine/` (the engine, its constants and snapshots), `formats/` (a level's bytes, `.SP` files, links, level sets, and the original's player list and hall of fame, read as the disassembly's routines named in `player-lists.ts` do), `replay/` (runs and traces), `editor/` (painting and regions) and `draw/` (the palette and level pictures). Tests sit beside what they test. |
| `docs/` | One page for each part of the package, linked from the README. |
| `data/` | The original levels (`LEVELS.DAT`) and demos (`DEMO0-9.BIN`), and recordings the tests use (`extra/`). |
| `examples/` | The package at work, listed in its README. `node/` has a script for each part of the package, `game/`, `replay/`, `sprites/` and `editor/` are plain JavaScript pages, and `worker/` is a Cloudflare Worker that checks runs. |
| `scripts/` | Building the module (`generate.ts`), the package (`build.ts`) and the live demo (`site.ts`). |

## Development

You need Node 24 (`.nvmrc`), and rustup to change the Rust. `rust-toolchain.toml` pins the compiler and brings the `wasm32` target, so the committed module builds to the same bytes everywhere.

```sh
npm install           # also installs the git hooks
npm test              # the TypeScript tests
npm run coverage      # the same, with coverage
npm run rust:test     # the Rust tests, demos included
npm run rust:coverage # the same, with coverage (needs cargo-llvm-cov)
npm run generate      # rebuild src/generated after changing crates/
npm run examples      # the Node examples, after npm run build
npm run site          # the live demo in _site/, after npm run build
npm run check         # everything, as CI runs it
```

`npm run check` runs Biome (format and lint), `tsc`, knip (unused files, exports and dependencies), the tests with coverage, rustfmt, clippy, the Rust tests with coverage, checks the built package with publint and Are the Types Wrong, and runs the Node examples against it. The git hooks (lefthook) run the relevant part before each commit, and commitlint holds commit messages to Conventional Commits.

GitHub Actions runs the same checks, with `.github/workflows/ci.yml` on every pull request and `release.yml` on every push to `main`. `release.yml` runs `ci.yml` first and then, besides releasing, puts the examples on GitHub Pages. They are the TypeScript checks, the tests on the oldest supported Node (22), the Rust checks with the doc tests, which coverage leaves out, and a fresh build of the module compared with the committed one.

To try the examples, build the package and serve the repository's root.

```sh
npm run build
npx serve .           # then open /examples/
```

## Releases

Nothing is released unless every CI job has passed. On `main`, `release.yml` runs them, and after them [release-please](https://github.com/googleapis/release-please) reads the commit messages. `fix:` makes a patch, `feat:` a minor version (until 1.0, which is when breaking changes start to make major versions). It keeps a release pull request open with the next version and its changelog. Merging that pull request runs CI again on `main`. When it passes, the same run tags the version, publishes the GitHub release and publishes that version to npm with provenance, through npm's trusted publishing. The npm version and the GitHub release always match.

These steps are done once, when the repository is created.

1. In the repository's Settings, under Actions, allow GitHub Actions to create and approve pull requests, so release-please can open its release pull request. Under Pages, set the source to GitHub Actions, for the live demo.
2. npm's trusted publishing is configured on a package that already exists, so the first version goes out by hand. Merge release-please's first pull request, then run `npm publish` from its tag, signed in to npm as an owner of the `zeybek` organisation.
3. On the package's page on npmjs.com, under Settings, add a trusted publisher with GitHub Actions, this repository and the workflow `release.yml`. Every version after that publishes itself.
