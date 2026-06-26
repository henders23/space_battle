"use strict";

import { state } from "../state.js";

// System-damage multipliers and sensor range. Higher damage level → worse
// performance for that subsystem (weapons cooldown grows, others shrink).

export function getSystemMultiplier(ship, system) {
  const level = ship.systems[system] || 0;
  if (system === "engines") return [1, 0.82, 0.55, 0.2][level];
  if (system === "weapons") return [1, 1.22, 1.62, 2.35][level];
  if (system === "sensors") return [1, 0.82, 0.62, 0.42][level];
  if (system === "shields") return [1, 0.72, 0.42, 0][level];
  return 1;
}

export function getSensorRange() {
  const utilityBonus = state.career.loadout.utility === "improvedSensors" ? 420 : 0;
  return (980 + utilityBonus) * getSystemMultiplier(state.player, "sensors");
}
