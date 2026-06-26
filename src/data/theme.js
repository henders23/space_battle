"use strict";

// Canvas palette, drawn from the Valkyrie design mockup. The CSS layer keeps a
// parallel set of custom properties; this object is for canvas rendering only.

export const PALETTE = {
  space: "#02060a",
  spaceDeep: "#010407",
  grid: "rgba(70, 160, 180, 0.06)",
  bound: "rgba(69, 224, 240, 0.22)",
  star: "#c8e6f0",

  accent: "#45e0f0", // cyan — player / friendly
  amber: "#f0a93d", // warning / hull stress
  danger: "#ff5347", // enemy / alert
  dangerSoft: "#ff7a70",
  success: "#5fd17a",
  text: "#eaf6f9",
  muted: "#7fb3c0",

  player: "#8ff0ff",
  playerHull: "#5e7e88",
  enemy: "#ff8a7e",
  enemyHull: "#7a3b38",
  flagship: "#ffb0a8"
};

export const ARC_COLORS = {
  forward: "rgba(240, 169, 61, 0.12)",
  port: "rgba(69, 224, 240, 0.14)",
  starboard: "rgba(69, 224, 240, 0.14)",
  torpedo: "rgba(255, 83, 71, 0.10)"
};
