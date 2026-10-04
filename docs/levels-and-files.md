# Levels and files

## The original levels

`@zeybek/supaplex/levels` holds the original 111 levels. Each has its `number`, `title`, `needed`, `gravity` and `freezeZonks`, and its 1536 `bytes` for `start`. It's a separate entry point because the levels add about 230 KB to a bundle, which a game that only loads its own levels never pays. `levels()` returns the same array and levels every time, so copy a level's bytes before changing them.

## Level sets

`readLevelSet` splits a level set, such as LEVELS.DAT or a `.DAT` of players' levels, into its levels, and `writeLevelSet` joins levels back into one, as [`examples/node/level-sets.js`](../examples/node/level-sets.js) does.

## A level's settings

`readSettings` and `writeSettings` hold everything after the field, which is the title, gravity, frozen Zonks, the Infotrons needed (0 for all of them) and, for each special port, what passing through it sets. `problems(level)` says in words what would keep the level from playing. It reports no Murphy or more than one, no exit, too many special ports, and more Infotrons needed than the level could ever hold.

## .SP files

`.SP` is the format players' levels and solutions have used since SpeedFix. It holds a level, then optionally a demo. `toSp(level, run)` writes one with the run as its demo, which the original game plays too. `fromSp`, `spDemo` and `runOf` read one back.

## Players and the hall of fame

The original game keeps its players in `PLAYER.LST` and its three fastest in `HALLFAME.LST` (`PLAYER.L01` and `HALLFAME.L01` beside `LEVELS.D01`, and so on). `readPlayers` reads the 20 places of a player list, each a `Player` (`{ name, seconds, levels, finished }`, with a `LevelState` for each of the 111 levels) or `null` when empty, and `nextLevel` gives the level a player plays next. So a web version can carry on where someone left off in the DOS game, and `writePlayers` and `writeHallOfFame` write the files back for it to read. [`examples/node/player-lists.js`](../examples/node/player-lists.js) writes both and reads them back.

## Pictures

`levelPicture(level)` makes a PNG of the field without a canvas, in Node, a browser or a Worker, for a link's preview, a set's gallery or a thumbnail. [`examples/node/pictures.js`](../examples/node/pictures.js) makes one for every original level.

## API

`@zeybek/supaplex/levels` exports one function.

| Export | |
|---|---|
| `levels(): Level[]` | The original 111 levels, in order. |

Everything else comes from `@zeybek/supaplex`.

| Export | |
|---|---|
| `parseLevel(bytes, number): Level` | A level's title and settings, as `levels()` gives them. |
| `Level` | `{ number, title, gravity, freezeZonks, needed, bytes }`. |
| `readLevelSet(file)`, `writeLevelSet(levels)` | A `.DAT` level set split into its levels, and levels joined into one. |
| `blankLevel(): Uint8Array` | A new level with walls round the edge, Murphy and an exit. |
| `readSettings(bytes)`, `writeSettings(bytes, settings)` | The title, gravity, frozen Zonks, Infotrons needed and the special ports' table (`LevelSettings`, `SpecialPort`). |
| `formatTitle(text)` | A title as the game stores it, upper case and centred in dashes. |
| `problems(bytes): string[]` | What would keep a level from playing, in words. |
| `specialsFor(bytes, before)` | The special ports' table rebuilt from the field, at most `MAX_SPECIALS` (10). |
| `isLevel(bytes): boolean` | Whether the engine plays these bytes. |
| `fromSp(file)`, `toSp(bytes, run?, number?)`, `spDemo(file)` | `.SP` files. |
| `levelPicture(bytes, scale = 4): Promise<Uint8Array>` | A PNG of the field, `scale` pixels a cell (1 to 64), in the canvas helpers' colours. |
| `readPlayers(file)`, `writePlayers(players)` | A `PLAYER.LST` and its `PLAYER_PLACES` (20) places, each a `Player` or `null`. |
| `readHallOfFame(file)`, `writeHallOfFame(places)` | A `HALLFAME.LST` with up to `HALL_OF_FAME_PLACES` (3) `HallOfFamePlace`s, `{ name, seconds }`, fastest first. |
| `Player` | `{ name, seconds, levels, finished }`, which are a name of up to 8 characters, the time played, each level's `LevelState`, and whether every level is solved. |
| `LevelState` | `Unsolved`, `Solved` and `Skipped`. |
| `nextLevel(levels): number \| null` | The level the game gives a player next, which is the first unsolved one, or else the first skipped. |
