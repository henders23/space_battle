"use strict";

// Default control scheme — shown on the Controls screen and used by input.js.
// Each entry: { keys, action, group }.

export const CONTROL_GROUPS = ["Manoeuvre", "Weapons", "Command"];

export const CONTROLS = [
  { keys: ["W"], action: "Throttle up (stop / slow / moderate / full)", group: "Manoeuvre" },
  { keys: ["S"], action: "Throttle down", group: "Manoeuvre" },
  { keys: ["A"], action: "Rotate left", group: "Manoeuvre" },
  { keys: ["D"], action: "Rotate right", group: "Manoeuvre" },

  { keys: ["Space"], action: "Fire forward lance (auto-aimed in its arc)", group: "Weapons" },
  { keys: ["Q"], action: "Fire port broadside", group: "Weapons" },
  { keys: ["E"], action: "Fire starboard broadside", group: "Weapons" },
  { keys: ["F"], action: "Fire siege torpedo", group: "Weapons" },
  { keys: ["Hold"], action: "Hold a key to keep firing as the charge bar refills", group: "Weapons" },
  { keys: ["Mouse"], action: "Aim + click also fires the bearing battery / torpedo", group: "Weapons" },

  { keys: ["B"], action: "Board a crippled ship when alongside it", group: "Command" },
  { keys: ["R"], action: "Retreat if available", group: "Command" },
  { keys: ["Esc"], action: "Pause", group: "Command" }
];
