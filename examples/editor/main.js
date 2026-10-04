// A level editor built on @zeybek/supaplex. This file is only the page.
import {
  blankLevel,
  Cause,
  CELLS,
  cellsBetween,
  copyRegion,
  decodeDemo,
  divergence,
  Engine,
  Event,
  encodeDemo,
  fill,
  flipRegion,
  fromSp,
  Kind,
  PIECES,
  paint,
  pasteRegion,
  problems,
  readLevelSet,
  readSettings,
  rectangle,
  rotateRegion,
  runOf,
  Status,
  sharedFromHash,
  sharedToHash,
  spDemo,
  TICKS_PER_SECOND,
  toSp,
  traceRun,
  verify,
  WIDTH,
  writeLevelSet,
  writeSettings,
} from "@zeybek/supaplex";
import {
  drawCode,
  drawGame,
  drawLevel,
  fieldCanvas,
  keyboard,
  loop,
  SIZE,
} from "@zeybek/supaplex/canvas";
import { levels } from "@zeybek/supaplex/levels";

const $ = (id) => document.getElementById(id);
const canvas = $("field");
const ctx = fieldCanvas(canvas);
const engine = await Engine.load();
const originals = levels();
const HEIGHT = CELLS / WIDTH;

let level = blankLevel();
let proof = null;
let trace = null;
/** The last proof an edit broke, for Undo to bring back. */
let lost = null;
const undos = [];
/** The opened .DAT set `level` belongs to, or null. */
let set = null;
let selected = Kind.Base;
let tool = "paint";
let clipboard = null;
let mode = "edit";

const seconds = (ticks) => `${(ticks / TICKS_PER_SECOND).toFixed(1)} s`;
const say = (text) => {
  $("message").textContent = text;
};

function load(bytes, run = null) {
  level = bytes;
  proof = run;
  trace = run && traceRun(engine, level, run);
  lost = null;
  undos.length = 0;
  show();
}

/** Keeps the proof while it still wins, and when it stops, says where it broke. */
function changed() {
  if (proof && verify(engine, level, proof).won) {
    trace = traceRun(engine, level, proof);
  } else if (proof) {
    const broke = divergence(engine, level, trace);
    lost = proof;
    proof = trace = null;
    show();
    if (broke) {
      outlineCells(broke.cell, broke.cell, "#f55");
      say(
        `The solution stopped winning. At ${seconds(broke.tick)} it goes another way, near the cell marked red.`,
      );
    }
    return;
  } else if (lost && verify(engine, level, lost).won) {
    proof = lost;
    trace = traceRun(engine, level, proof);
    lost = null;
    say("The solution wins again.");
  }
  show();
}

function show() {
  drawLevel(ctx, level);
  showSettings();
  showProblems();
  showSpecials();
  showProof();
}

function cellAt(event) {
  const box = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - box.left) / box.width) * WIDTH);
  const y = Math.floor(((event.clientY - box.top) / box.height) * HEIGHT);
  return x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT ? -1 : y * WIDTH + x;
}

function keep() {
  undos.push(level.slice());
  if (undos.length > 100) undos.shift();
}

function change(apply) {
  const before = level.slice();
  if (!apply()) return;
  undos.push(before);
  changed();
}

function outlineCells(from, to, colour = "#9cf") {
  const [x0, y0] = [from % WIDTH, Math.floor(from / WIDTH)];
  const [x1, y1] = [to % WIDTH, Math.floor(to / WIDTH)];
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    Math.min(x0, x1) * SIZE + 1,
    Math.min(y0, y1) * SIZE + 1,
    (Math.abs(x1 - x0) + 1) * SIZE - 2,
    (Math.abs(y1 - y0) + 1) * SIZE - 2,
  );
}

function ghost(cell) {
  drawLevel(ctx, level);
  clipboard.codes.forEach((code, i) => {
    const x = (cell % WIDTH) + (i % clipboard.width);
    const y = Math.floor(cell / WIDTH) + Math.floor(i / clipboard.width);
    if (x < WIDTH && y < HEIGHT) drawCode(ctx, x * SIZE, y * SIZE, code, 0.6);
  });
}

let drag = null;

canvas.addEventListener("pointerdown", (event) => {
  const cell = cellAt(event);
  if (mode !== "edit" || cell < 0) return;
  canvas.setPointerCapture(event.pointerId);
  // The right button clears with whichever tool is in hand.
  const code = event.button === 2 ? Kind.Space : selected;
  if (tool === "fill") return change(() => fill(level, cell, code));
  if (tool === "paste")
    return change(() => pasteRegion(level, clipboard, cell));
  if (tool === "paint") {
    keep();
    drag = { start: cell, last: cell, code, any: paint(level, cell, code) };
    if (drag.any) changed();
    return;
  }
  drag = { start: cell, last: cell, code };
  outlineCells(cell, cell);
});

canvas.addEventListener("pointermove", (event) => {
  const cell = cellAt(event);
  if (cell >= 0) {
    const piece = PIECES.find((p) => p.code === level[cell]);
    $("hover").textContent =
      `${cell % WIDTH}, ${Math.floor(cell / WIDTH)}: ${piece?.name ?? level[cell]}`;
    if (tool === "paste" && !drag) ghost(cell);
  }
  if (!drag || cell < 0 || cell === drag.last) return;
  if (tool === "paint") {
    let any = false;
    for (const c of cellsBetween(drag.last, cell))
      any = paint(level, c, drag.code) || any;
    drag.any ||= any;
    if (any) changed();
  } else {
    drawLevel(ctx, level);
    outlineCells(drag.start, cell);
  }
  drag.last = cell;
});

canvas.addEventListener("pointerup", () => {
  if (!drag) return;
  const { start, last, code } = drag;
  if (tool === "paint" && !drag.any) undos.pop();
  if (tool === "rectangle" || tool === "outline")
    change(() => rectangle(level, start, last, code, tool === "outline"));
  if (tool === "copy") {
    clipboard = copyRegion(level, start, last);
    pick("paste");
    say(
      `Copied ${clipboard.width} × ${clipboard.height}. Click to paste it; Flip turns it over.`,
    );
  }
  drag = null;
  drawLevel(ctx, level);
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

function undo() {
  const before = undos.pop();
  if (!before || mode !== "edit") return;
  // Back into the same array, because a level set holds this very one.
  level.set(before);
  changed();
}

function pick(name) {
  tool = name;
  for (const button of document.querySelectorAll("[data-tool]"))
    button.classList.toggle("on", button.dataset.tool === name);
  $("flips").hidden = !clipboard;
  drawLevel(ctx, level);
}

for (const button of document.querySelectorAll("[data-tool]"))
  button.addEventListener("click", () => {
    if (button.dataset.tool === "paste" && !clipboard)
      return say("Copy a region first.");
    pick(button.dataset.tool);
  });

for (const axis of ["horizontal", "vertical"])
  $(`flip-${axis}`).addEventListener("click", () => {
    clipboard = flipRegion(clipboard, axis);
    pick("paste");
  });
$("turn").addEventListener("click", () => {
  clipboard = rotateRegion(clipboard);
  pick("paste");
});

for (const piece of PIECES) {
  const button = document.createElement("button");
  button.type = "button";
  const swatch = document.createElement("canvas");
  swatch.width = swatch.height = SIZE;
  drawCode(swatch.getContext("2d"), 0, 0, piece.code);
  button.append(
    swatch,
    piece.key ? `${piece.name} (${piece.key})` : piece.name,
  );
  button.dataset.code = String(piece.code);
  button.addEventListener("click", () => select(piece.code));
  $("palette").append(button);
}

function select(code) {
  selected = code;
  for (const button of $("palette").children)
    button.classList.toggle("on", Number(button.dataset.code) === code);
}

addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (mode === "play") {
    if (event.key === "Escape") edit("Stopped.");
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "z") {
    event.preventDefault();
    undo();
    return;
  }
  if (event.key === "Escape") return pick("paint");
  if (event.key === "p") return play();
  const piece = PIECES.find((p) => p.key === event.key.toLowerCase());
  if (piece) select(piece.code);
});

function showSettings() {
  const settings = readSettings(level);
  $("title").value = settings.title;
  $("gravity").checked = settings.gravity;
  $("freeze").checked = settings.freezeZonks;
  $("needed").value = String(settings.needed);
  const infotrons = level.subarray(0, CELLS).filter((c) => c === Kind.Infotron);
  $("count").textContent = `(0: all ${infotrons.length})`;
}

function saveSettings() {
  change(() => {
    writeSettings(level, {
      ...readSettings(level),
      title: $("title").value,
      gravity: $("gravity").checked,
      freezeZonks: $("freeze").checked,
      needed: Number($("needed").value) || 0,
    });
    return true;
  });
}
for (const id of ["title", "gravity", "freeze", "needed"])
  $(id).addEventListener("change", saveSettings);

function showProblems() {
  const found = problems(level);
  $("problems").replaceChildren(
    ...found.map((text) =>
      Object.assign(document.createElement("li"), { textContent: text }),
    ),
  );
  $("ready").hidden = found.length > 0;
  $("play").disabled = found.length > 0;
}

function showSpecials() {
  const settings = readSettings(level);
  if (settings.specials.length === 0) {
    $("specials").textContent =
      "None. Paint one from the palette to set what it changes.";
    return;
  }
  const table = document.createElement("table");
  table.innerHTML =
    "<tr><th>Port</th><th>Gravity</th><th>Zonks frozen</th><th>Enemies frozen</th></tr>";
  settings.specials.forEach((port, i) => {
    const row = table.insertRow();
    row.insertCell().textContent = `${port.cell % WIDTH}, ${Math.floor(port.cell / WIDTH)}`;
    for (const field of ["gravity", "freezeZonks", "freezeEnemies"]) {
      const box = Object.assign(document.createElement("input"), {
        type: "checkbox",
        checked: port[field],
      });
      box.addEventListener("change", () =>
        change(() => {
          settings.specials[i] = { ...port, [field]: box.checked };
          writeSettings(level, settings);
          return true;
        }),
      );
      row.insertCell().append(box);
    }
  });
  $("specials").replaceChildren(table);
}

function showProof() {
  $("watch").hidden = !proof;
  $("proof").textContent = proof
    ? `Won in ${seconds(proof.ticks)}. The link and the .SP file carry this solution.`
    : "Not won yet. Play it to prove it can be won.";
}

let stop = () => {};

function play(run = null) {
  if (problems(level).length > 0) return;
  mode = "play";
  const seed = run ? run.seed : Math.floor(Math.random() * 0x10000);
  const demo = run ? decodeDemo(run.demo) : null;
  const keys = run ? null : keyboard(window);
  const played = [];
  let ended = false;
  engine.start(level, seed);
  say(run ? "Watching the solution. Esc stops." : "Playing. Esc stops.");
  const stopLoop = loop(
    () => {
      const key = demo ? (demo[engine.tick] ?? 0) : keys.read();
      if (engine.status === Status.Playing) played.push(key);
      const events = engine.step(engine.status === Status.Playing ? key : 0);
      if (ended) return;
      if (events & Event.Win) {
        ended = true;
        if (!run) {
          proof = { seed, ticks: engine.tick, demo: encodeDemo(played) };
          trace = null;
          lost = null;
        }
        setTimeout(() => edit(`Won in ${seconds(engine.tick)}.`), 1500);
      } else if (engine.status === Status.Dead) {
        ended = true;
        const cause = Object.keys(Cause).find(
          (k) => Cause[k] === engine.death.cause,
        );
        edit(`Caught (${cause?.toLowerCase()}) after ${seconds(engine.tick)}.`);
      }
    },
    () => drawGame(ctx, engine),
  );
  stop = () => {
    stopLoop();
    keys?.stop();
  };
}

function edit(message) {
  stop();
  mode = "edit";
  // Traced only now, because during play the engine was busy.
  if (proof && !trace) trace = traceRun(engine, level, proof);
  say(message);
  show();
}

$("levels").append(
  new Option("New level", ""),
  ...originals.map((l, i) => new Option(`${l.number}. ${l.title}`, String(i))),
);
$("levels").addEventListener("change", () => {
  const i = $("levels").value;
  closeSet();
  // levels() hands out shared arrays.
  load(i === "" ? blankLevel() : originals[Number(i)].bytes.slice());
  say(
    i === ""
      ? "A new level."
      : `Level ${originals[Number(i)].number}, to edit.`,
  );
});

function openSet(list, name) {
  set = { levels: list, name };
  $("set").replaceChildren(
    ...list.map(
      (bytes, i) =>
        new Option(`${i + 1}. ${readSettings(bytes).title}`, String(i)),
    ),
  );
  $("set").hidden = false;
  $("save-set").hidden = false;
  load(list[0]);
}

function closeSet() {
  set = null;
  $("set").hidden = true;
  $("save-set").hidden = true;
}

$("set").addEventListener("change", () => {
  const i = Number($("set").value);
  // The set holds the level itself, so edits made to it stay in the set.
  load(set.levels[i]);
  say(`Level ${i + 1} of ${set.name}.`);
});

$("open").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", async () => {
  const file = $("file").files?.[0];
  if (!file) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  $("file").value = "";
  const many = file.name.toLowerCase().endsWith(".dat") && readLevelSet(bytes);
  if (many) {
    openSet(many, file.name);
    return say(`${file.name}: ${many.length} levels.`);
  }
  const opened = fromSp(bytes);
  if (!opened) return say(`${file.name} is not a level or a level set.`);
  closeSet();
  const demo = spDemo(bytes);
  const run = demo ? runOf(engine, opened, demo.seed, demo.demo) : null;
  load(opened, run);
  say(
    run
      ? `${file.name}, with a solution that wins in ${seconds(run.ticks)}.`
      : `${file.name}.`,
  );
});

function download(bytes, name) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([bytes]));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

$("save").addEventListener("click", () =>
  download(toSp(level, proof), `${readSettings(level).title || "level"}.sp`),
);
$("save-set").addEventListener("click", () =>
  download(writeLevelSet(set.levels), set.name),
);

$("share").addEventListener("click", async () => {
  // In the fragment, so the level never reaches a server.
  const hash = await sharedToHash({ level, run: proof });
  history.replaceState(null, "", `#${hash}`);
  // The address bar has it either way, since the clipboard may refuse.
  say("The link is in the address bar.");
  navigator.clipboard?.writeText(location.href).then(
    () => say(proof ? "Link copied, with the solution." : "Link copied."),
    () => {},
  );
});

$("undo").addEventListener("click", undo);
$("play").addEventListener("click", () => play());
$("watch").addEventListener("click", () => play(proof));

const shared = await sharedFromHash(location.hash);
if (shared) {
  // Believe a link's solution only after playing it.
  const won = shared.run && verify(engine, shared.level, shared.run).won;
  load(shared.level, won ? shared.run : null);
  say(
    won
      ? `Opened from a link, with a solution that wins in ${seconds(shared.run.ticks)}.`
      : "Opened from a link.",
  );
} else {
  load(level);
}
select(selected);
pick("paint");
