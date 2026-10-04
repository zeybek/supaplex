// The 111 levels, played with @zeybek/supaplex and its canvas helpers.
import { Engine, Event, Status, TICKS_PER_SECOND } from "@zeybek/supaplex";
import {
  drawGame,
  fieldCanvas,
  gamepad,
  keyboard,
  loop,
} from "@zeybek/supaplex/canvas";
import { levels } from "@zeybek/supaplex/levels";

const ctx = fieldCanvas(document.getElementById("field"));
const status = document.getElementById("status");

const all = levels();
const engine = await Engine.load();
const keys = keyboard(window);
const pad = gamepad();
let current = 0;

function begin(index) {
  current = (index + all.length) % all.length;
  engine.start(all[current].bytes, Date.now() & 0xffff);
}

addEventListener("keydown", (event) => {
  if (event.key === "r") begin(current);
  else if (event.key === "n") begin(current + 1);
  else if (event.key === "p") begin(current - 1);
});

const WORDS = ["playing", "won", "caught", "caught"];

begin(0);
loop(
  () => {
    if (engine.status === Status.Dead) begin(current);
    const events = engine.step(keys.read() || pad.read());
    if (events & Event.Win) setTimeout(() => begin(current + 1), 1500);
  },
  () => {
    drawGame(ctx, engine);
    const seconds = (engine.tick / TICKS_PER_SECOND).toFixed(1);
    status.textContent = `Level ${current + 1}, ${all[current].title}, ${WORDS[engine.status]}. Infotrons left ${engine.remaining}, red disks ${engine.redDisks}, ${seconds} s`;
  },
);
