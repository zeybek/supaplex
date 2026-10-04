## What and why

<!-- What changes, and what it is for. Link the issue it closes. -->

## How to see it

<!--
The engine is deterministic, so a level and its keys show any change to how the game plays. Attach a `.SP` file, or paste a link fragment from `sharedToHash` or a run from `runToText`, and say on which tick it matters. For the examples, attach a screenshot.
-->

## If it changes the rules (`crates/core`)

- [ ] It plays as the original does, and this pull request names the routine in the disassembly it comes from
- [ ] No code came from another Supaplex implementation. The crate is MIT because it was written from the disassembly alone
- [ ] The ten demos and the recordings still play without a difference
- [ ] `npm run generate` was run and `src/generated/` is committed, and the module went from ___ bytes to ___

## If it changes the package's API

- [ ] The page in `docs/` for that part of the API says what changed, and each new export has its JSDoc
- [ ] A breaking change is marked as one (`feat!:`, or a `BREAKING CHANGE:` footer), so the version moves with it

## Before it is merged

- [ ] `npm run check` passes, which covers lint, types, knip, 100% coverage of the TypeScript and the Rust, and the package as npm ships it
- [ ] The commits and the title are Conventional Commits (`fix:`, `feat:`, `docs:` and so on), because release-please builds the version and the changelog from them
