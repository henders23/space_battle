"use strict";

// Default control scheme — shown on the Controls screen and used by input.js.
// Each entry: { keys, action, group }.

export const CONTROL_GROUPS = ["Manoeuvre", "Weapons", "Command"];

export const CONTROLS = [
  { keys: ["W"], action: "Throttle up (stop / slow / moderate / full)", group: "Manoeuvre" },
  { keys: ["S"], action: "Throttle down", group: "Manoeuvre" },
  { keys: ["A"], action: "Rotate left", group: "Manoeuvre" },
  { keys: ["D"], action: "Rotate right", group: "Manoeuvre" },

  { keys: ["Mouse"], action: "Aim — shots travel toward the cursor", group: "Weapons" },
  { keys: ["L-Click"], action: "Fire the battery whose arc the cursor is in", group: "Weapons" },
  { keys: ["R-Click"], action: "Fire torpedo (cursor in the forward arc)", group: "Weapons" },
  { keys: ["Hold"], action: "Hold a button to keep firing as it reloads", group: "Weapons" },

  { keys: ["R"], action: "Retreat if available", group: "Command" },
  { keys: ["Esc"], action: "Pause", group: "Command" }
];
