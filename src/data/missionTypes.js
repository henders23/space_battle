"use strict";

// Mission archetypes. Each one drives a distinct objective, entity set and
// grading focus; the spawn logic lives in mission.js and the win/lose logic in
// combat/objectives.js.

export const MISSION_TYPES = {
  assassinate_flagship: {
    name: "Assassinate Flagship",
    short: "ASSASSINATION",
    objective: "Destroy the enemy flagship",
    brief: "Intercept and destroy the enemy command vessel holding {sector}."
  },
  patrol: {
    name: "Patrol Sweep",
    short: "PATROL",
    objective: "Destroy all hostile contacts",
    brief: "Sweep {sector} and destroy every hostile contact you find."
  },
  convoy_escort: {
    name: "Convoy Escort",
    short: "ESCORT",
    objective: "Escort the convoy to the jump point",
    brief: "Shepherd Commonwealth transports across {sector} to the jump point. Keep them alive."
  },
  starbase_defence: {
    name: "Starbase Defence",
    short: "DEFENCE",
    objective: "Hold the starbase against all waves",
    brief: "Hold the line at the {sector} starbase. Repel every wave the Dominion sends."
  },
  rescue_disabled: {
    name: "Rescue Operation",
    short: "RESCUE",
    objective: "Defend the disabled ship until it withdraws",
    brief: "A Commonwealth ship lies crippled in {sector}. Hold the enemy off until she can jump clear."
  }
};

// Types a contested sector can offer (the damaged-flagship intro is handled
// separately for a captain's first command).
export const SECTOR_MISSION_POOL = [
  "assassinate_flagship",
  "patrol",
  "convoy_escort",
  "starbase_defence",
  "rescue_disabled"
];
