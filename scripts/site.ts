// _site/ for GitHub Pages, with the examples, dist/ and the game's demos for
// the replay example, laid out as in the repository so the paths hold. Run
// after `npm run build`.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const site = join(root, "_site");
rmSync(site, { recursive: true, force: true });
mkdirSync(site);
for (const dir of ["examples", "dist"])
  cpSync(join(root, dir), join(site, dir), { recursive: true });
rmSync(join(site, "examples", "node", "out"), { recursive: true, force: true });
for (let n = 0; n < 10; n++)
  cpSync(
    join(root, "data", `DEMO${n}.BIN`),
    join(site, "data", `DEMO${n}.BIN`),
  );
writeFileSync(
  join(site, "index.html"),
  `<!doctype html>
<meta charset="utf-8" />
<title>@zeybek/supaplex</title>
<meta http-equiv="refresh" content="0; url=examples/" />
<a href="examples/">The examples</a>
`,
);
console.log(`site in ${site}`);
