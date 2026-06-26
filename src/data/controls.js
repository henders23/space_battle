"use strict";

// Default control scheme — shown on the Controls screen and used by input.js.
// Each entry: { keys, action, group }.

export const CONTROL_GROUPS = ["Manoeuvre", "Weapons", "Command"];

export const CONTROLS = [
  { keys: ["W"], action: "Thrust forward", group: "Manoeuvre" },
  { keys: ["S"], action: "Reverse / braking thrust", group: "Manoeuvre" },
  { keys: ["A"], action: "Rotate left", group: "Manoeuvre" },
  { keys: ["D"], action: "Rotate right", group: "Manoeuvre" },

  { keys: ["Space"], action: "Fire forward guns", group: "Weapons" },
  { keys: ["Q"], action: "Fire port broadside", group: "Weapons" },
  { keys: ["E"], action: "Fire starboard broadside", group: "Weapons" },
  { keys: ["F"], action: "Fire torpedo / special weapon", group: "Weapons" },

  { keys: ["R"], action: "Retreat if available", group: "Command" },
  { keys: ["Esc"], action: "Pause", group: "Command" }
];
