// Recorded games played back, the original's ten demos or a .SP file of
// your own. Going back in a replay works with save states. The whole
// recording is played once when it opens, keeping a save every second, so
// any moment is a restore and less than a second of play away.
import {
  decodeDemo,
  Engine,
  fromSp,
  readSettings,
  Status,
  spDemo,
  TICKS_PER_SECOND,
} from "@zeybek/supaplex";
import { drawGame, fieldCanvas, loop } from "@zeybek/supaplex/canvas";

const $ = (id) => document.getElementById(id);
const ctx = fieldCanvas($("field"));
const engine = await Engine.load();

let level = null;
let keys = new Uint8Array();
/** saves[i] is the game at tick i * TICKS_PER_SECOND. */
let saves = [];
/** The tick the replay ends on, after the last moments of a win or a death. */
let end = 0;
let playing = false;
let title = "";

function open(file, name) {
  const bytes = fromSp(file);
  const demo = spDemo(file);
  if (!bytes || !demo) {
    $("message").textContent = `${name} is not a .SP file with a demo.`;
    return;
  }
  $("message").textContent = "";
  level = bytes;
  keys = decodeDemo(demo.demo);
  engine.start(level, demo.seed);
  saves = [engine.save()];
  // run() stops when the game ends, so the saves stop there too.
  while (engine.status === Status.Playing && engine.tick < keys.length) {
    engine.run(keys.subarray(engine.tick, engine.tick + TICKS_PER_SECOND));
    if (engine.tick % TICKS_PER_SECOND === 0) saves.push(engine.save());
  }
  while (advance());
  end = engine.tick;
  $("bar").max = String(end);
  title = `${name}, ${readSettings(level).title.trim()}`;
  seek(0);
  setPlaying(true);
}

/** One tick of the recording; false at its end. */
function advance() {
  if (engine.status === Status.Playing && engine.tick >= keys.length)
    return false;
  const before = engine.tick;
  // After a win or a death the engine still plays the last moments out.
  engine.step(keys[engine.tick] ?? 0);
  return engine.tick > before;
}

function seek(tick) {
  const second = Math.floor(tick / TICKS_PER_SECOND);
  engine.restore(saves[Math.min(second, saves.length - 1)]);
  engine.run(keys.subarray(engine.tick, tick));
  while (engine.tick < tick && advance());
}

function setPlaying(on) {
  playing = on && level !== null;
  $("play").textContent = playing ? "Pause" : "Play";
}

const WORDS = ["playing", "won", "dying", "dead"];
const time = (ticks) => (ticks / TICKS_PER_SECOND).toFixed(2);

loop(
  () => {
    if (!playing) return;
    for (let i = 0; i < Number($("speed").value); i++)
      if (!advance()) return setPlaying(false);
  },
  () => {
    if (!level) return;
    drawGame(ctx, engine);
    $("bar").value = String(engine.tick);
    $("status").textContent =
      `${title}, ${time(engine.tick)} s of ${time(end)} s, ${WORDS[engine.status]}`;
  },
);

$("play").addEventListener("click", () => {
  setPlaying(!playing);
  // So Space, which pauses, does not press the button as well.
  $("play").blur();
});
$("bar").addEventListener("input", () => seek(Number($("bar").value)));

addEventListener("keydown", (event) => {
  // The bar and the menus have their own keys.
  if (!level || event.target instanceof HTMLInputElement) return;
  if (event.target instanceof HTMLSelectElement) return;
  const by = event.shiftKey ? TICKS_PER_SECOND : 1;
  if (event.key === " ") setPlaying(!playing);
  else if (event.key === "ArrowLeft") seek(Math.max(0, engine.tick - by));
  else if (event.key === "ArrowRight") seek(engine.tick + by);
  else return;
  if (event.key !== " ") setPlaying(false);
  event.preventDefault();
});

$("file").addEventListener("change", async () => {
  const file = $("file").files[0];
  if (file) open(new Uint8Array(await file.arrayBuffer()), file.name);
});

async function openDemo(n) {
  const response = await fetch(`../../data/DEMO${n}.BIN`);
  open(new Uint8Array(await response.arrayBuffer()), `DEMO${n}`);
}

for (let n = 0; n < 10; n++)
  $("demos").append(new Option(`The game's demo ${n}`, String(n)));
$("demos").addEventListener("change", () => openDemo($("demos").value));
openDemo(5);
$("demos").value = "5";
