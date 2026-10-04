# Command line

```sh
npx @zeybek/supaplex info LEVELS.DAT          # the levels, and what keeps one from playing
npx @zeybek/supaplex verify solution.sp       # does a .SP file's demo win, and when
npx @zeybek/supaplex link level.sp            # the level, and its winning demo, as a link fragment
npx @zeybek/supaplex image level.sp level.png # a picture of the level, 4 pixels a cell
npx @zeybek/supaplex image LEVELS.DAT out 8   # one picture per level, 8 pixels a cell
npx @zeybek/supaplex split LEVELS.DAT levels  # each level of a set as its own .SP file
npx @zeybek/supaplex join mine.dat a.sp b.sp  # .SP files joined into a level set
```

It exits with 0 when done, 1 when a file is not a level or a demo does not win, and 2 when a command or its arguments are missing.
