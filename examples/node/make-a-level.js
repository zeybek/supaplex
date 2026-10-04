// A level made in code with the editor's tools, checked, and saved as a
// .SP file that the editor example and the original game both open.
//
//   node examples/node/make-a-level.js
import { mkdirSync, writeFileSync } from "node:fs";
import {
  blankLevel,
  fill,
  HEIGHT,
  Kind,
  paint,
  problems,
  readSettings,
  rectangle,
  toSp,
  WIDTH,
  writeSettings,
} from "@zeybek/supaplex";

const at = (x, y) => y * WIDTH + x;

// Hardware round the edge, base inside, Murphy at (2, 2), the exit at (57, 21).
const level = blankLevel();

// A walled room with three Infotrons in it, and a one-way port as its door.
rectangle(level, at(20, 6), at(30, 14), Kind.Hardware, true);
fill(level, at(25, 10), Kind.Space);
paint(level, at(20, 10), Kind.PortRight);
for (const x of [23, 25, 27]) paint(level, at(x, 10), Kind.Infotron);

// A row of Zonks over empty space falls as soon as the level starts.
for (let x = 35; x < 45; x++) {
  paint(level, at(x, 4), Kind.Zonk);
  paint(level, at(x, 5), Kind.Space);
}

// The settings live after the field. Asking for more Infotrons than the
// level holds is one of the things problems() reports.
writeSettings(level, {
  ...readSettings(level),
  title: "first room",
  needed: 5,
});
console.log(problems(level));

writeSettings(level, { ...readSettings(level), needed: 3 });
console.log(problems(level));
console.log(readSettings(level).title);

const CHARS = {
  [Kind.Space]: " ",
  [Kind.Base]: ".",
  [Kind.Murphy]: "M",
  [Kind.Zonk]: "O",
  [Kind.Infotron]: "@",
  [Kind.Exit]: "E",
  [Kind.Hardware]: "#",
  [Kind.PortRight]: ">",
};
for (let y = 0; y < HEIGHT; y++) {
  const row = level.subarray(y * WIDTH, (y + 1) * WIDTH);
  console.log([...row].map((code) => CHARS[code] ?? "?").join(""));
}

const out = new URL("out/", import.meta.url);
mkdirSync(out, { recursive: true });
const file = new URL("first-room.sp", out);
writeFileSync(file, toSp(level));
console.log(`Saved ${file.pathname}`);
