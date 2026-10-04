// Paints a sprite sheet on a canvas, a stand-in for the PNG a game would
// load. Nothing here comes from the package, and any image laid out the
// same way works.
import { Kind, Look } from "@zeybek/supaplex";

const TILE = 32;

/** Paints the tile for `code` with its top left at (x, y). */
function paintTile(g, code, x, y) {
  const s = TILE;
  const box = (fill, light, dark) => {
    g.fillStyle = fill;
    g.fillRect(x, y, s, s);
    g.fillStyle = light;
    g.fillRect(x, y, s, 2);
    g.fillRect(x, y, 2, s);
    g.fillStyle = dark;
    g.fillRect(x, y + s - 2, s, 2);
    g.fillRect(x + s - 2, y, 2, s);
  };
  const ball = (fill, r = s / 2 - 2) => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x + s / 2, y + s / 2, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.5)";
    g.beginPath();
    g.arc(x + s / 2 - r / 3, y + s / 2 - r / 3, r / 4, 0, Math.PI * 2);
    g.fill();
  };
  const text = (glyph, ink) => {
    g.fillStyle = ink;
    g.font = `bold ${s * 0.6}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(glyph, x + s / 2, y + s / 2 + 1);
  };
  const ARROWS = {
    [Kind.PortRight]: "→",
    [Kind.PortDown]: "↓",
    [Kind.PortLeft]: "←",
    [Kind.PortUp]: "↑",
    [Kind.SpecialRight]: "→",
    [Kind.SpecialDown]: "↓",
    [Kind.SpecialLeft]: "←",
    [Kind.SpecialUp]: "↑",
    [Kind.PortVertical]: "↕",
    [Kind.PortHorizontal]: "↔",
    [Kind.PortCross]: "+",
  };
  if (ARROWS[code]) {
    const special = code >= Kind.SpecialRight && code <= Kind.SpecialUp;
    box(special ? "#6b3f7a" : "#3f4f7a", "#8a9ac8", "#1d2440");
    return text(ARROWS[code], "#fff");
  }
  if (code >= Look.RamLeft && code <= Look.RamBottom) {
    const lamp = { [Look.LampGreen]: "#3f3", [Look.LampBlue]: "#39f" };
    const ram = [Look.RamLeft, Look.RamRight, Look.RamTop, Look.RamBottom];
    if (ram.includes(code)) {
      box("#46606f", "#7d9aa8", "#22303a");
      return text("▪", "#9bd");
    }
    box("#353a46", "#5a6070", "#1a1d24");
    return ball(lamp[code] ?? (code === Look.LampRed ? "#f33" : "#556"), 5);
  }
  switch (code) {
    case Kind.Zonk:
      return ball("#a3a3a3");
    case Kind.Base:
      g.fillStyle = "#245c24";
      g.fillRect(x, y, s, s);
      g.fillStyle = "#3d8a3d";
      for (let i = 4; i < s; i += 8)
        for (let j = 4; j < s; j += 8) g.fillRect(x + i, y + j, 3, 3);
      return;
    case Kind.Murphy:
      ball("#e33");
      g.fillStyle = "#fff";
      g.fillRect(x + 10, y + 11, 4, 5);
      g.fillRect(x + 18, y + 11, 4, 5);
      return;
    case Kind.Infotron:
      g.fillStyle = "#d3c";
      g.beginPath();
      g.moveTo(x + s / 2, y + 2);
      g.lineTo(x + s - 2, y + s / 2);
      g.lineTo(x + s / 2, y + s - 2);
      g.lineTo(x + 2, y + s / 2);
      g.fill();
      return;
    case Kind.Ram:
      box("#46606f", "#7d9aa8", "#22303a");
      return text("▪", "#9bd");
    case Kind.Hardware:
      return box("#353a46", "#5a6070", "#1a1d24");
    case Kind.Exit:
      box("#ccc", "#fff", "#777");
      return text("E", "#222");
    case Kind.Orange:
      return ball("#f80");
    case Kind.Yellow:
      return ball("#ee3");
    case Kind.Red:
      return ball("#c00");
    case Kind.RedLit:
      return ball("#f66");
    case Kind.SnikSnak:
      return text("✂", "#ddd");
    case Kind.Terminal:
      box("#2a2a2a", "#555", "#111");
      g.fillStyle = "#3c6";
      return g.fillRect(x + 6, y + 6, s - 12, s - 14);
    case Kind.Electron:
      return text("✶", "#5af");
    case Kind.Bug:
      paintTile(g, Kind.Base, x, y);
      return text("✦", "#ff6");
    case Kind.Invisible:
      g.fillStyle = "#1a1a1a";
      return g.fillRect(x, y, s, s);
    case Kind.Explosion:
      return ball("#fa0", s / 2);
  }
}

/** Codes go up to 43, so 6 rows of 8 hold them all. */
export function paintSheet(canvas, columns = 8, rows = 6) {
  canvas.width = columns * TILE;
  canvas.height = rows * TILE;
  const g = canvas.getContext("2d");
  for (let code = 0; code < columns * rows; code++)
    paintTile(
      g,
      code,
      (code % columns) * TILE,
      Math.floor(code / columns) * TILE,
    );
}
