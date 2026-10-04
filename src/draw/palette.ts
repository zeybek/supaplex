import { Kind, Look } from "../engine/constants.ts";

export interface Shape {
  fill: string;
  round?: boolean;
  glyph?: string;
  ink?: string;
}

const PORT = "#6a6a9a";
const SPECIAL = "#9a6aaa";
const HARDWARE = "#3a3f4b";
const RAM = "#4f6272";

/** By level file code, for the canvas and the level pictures. */
export const SHAPES: Record<number, Shape> = {
  [Kind.Zonk]: { fill: "#9a9a9a", round: true },
  [Kind.Base]: { fill: "#2f6b2f" },
  [Kind.Murphy]: { fill: "#e33", round: true },
  [Kind.Infotron]: { fill: "#d3c", round: true },
  [Kind.Ram]: { fill: RAM },
  [Kind.Hardware]: { fill: HARDWARE },
  [Kind.Exit]: { fill: "#ddd", glyph: "E", ink: "#222" },
  [Kind.Orange]: { fill: "#f80", round: true },
  [Kind.PortRight]: { fill: PORT, glyph: "→" },
  [Kind.PortDown]: { fill: PORT, glyph: "↓" },
  [Kind.PortLeft]: { fill: PORT, glyph: "←" },
  [Kind.PortUp]: { fill: PORT, glyph: "↑" },
  [Kind.SpecialRight]: { fill: SPECIAL, glyph: "→" },
  [Kind.SpecialDown]: { fill: SPECIAL, glyph: "↓" },
  [Kind.SpecialLeft]: { fill: SPECIAL, glyph: "←" },
  [Kind.SpecialUp]: { fill: SPECIAL, glyph: "↑" },
  [Kind.SnikSnak]: { fill: "#ccc", glyph: "S", ink: "#222" },
  [Kind.Yellow]: { fill: "#ee3", round: true },
  [Kind.Terminal]: { fill: "#3a6", glyph: "T" },
  [Kind.Red]: { fill: "#c00", round: true },
  [Kind.PortVertical]: { fill: PORT, glyph: "↕" },
  [Kind.PortHorizontal]: { fill: PORT, glyph: "↔" },
  [Kind.PortCross]: { fill: PORT, glyph: "+" },
  [Kind.Electron]: { fill: "#38f", glyph: "e" },
  [Kind.Bug]: { fill: "#2f6b2f", glyph: "*", ink: "#ff6" },
  [Kind.Invisible]: { fill: "#1b1b1b", glyph: "·", ink: "#555" },
  [Kind.Explosion]: { fill: "#fa0" },
  [Kind.RedLit]: { fill: "#f33", round: true },
};
for (const code of [Look.RamLeft, Look.RamRight, Look.RamTop, Look.RamBottom])
  SHAPES[code] = { fill: RAM, glyph: "▪", ink: "#8aa" };
for (let code = Look.HardwareRound; code <= Look.ResistorsYellow; code++)
  SHAPES[code] = { fill: HARDWARE, glyph: "▪", ink: "#778" };
