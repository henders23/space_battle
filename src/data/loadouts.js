"use strict";

// Weapon and utility definitions available at the starbase. Pure data.

export const forwardLoadouts = {
  lightForward: {
    name: "Light Forward Guns",
    description: "Fast cooldown, lower damage.",
    damage: 14,
    cooldown: 0.46,
    range: 520,
    arc: 32,
    speed: 680,
    spread: 3,
    shots: 2,
    size: 3,
    color: "#9be7ff"
  },
  heavyForward: {
    name: "Heavy Forward Guns",
    description: "Slower cooldown, higher damage.",
    damage: 32,
    cooldown: 0.95,
    range: 580,
    arc: 26,
    speed: 640,
    spread: 2,
    shots: 2,
    size: 4,
    color: "#f9d287"
  },
  torpedoForward: {
    name: "Torpedo Launcher",
    description: "Powerful, narrow, and slow to reload.",
    damage: 74,
    cooldown: 2.4,
    range: 720,
    arc: 16,
    speed: 420,
    spread: 1,
    shots: 1,
    size: 6,
    color: "#ff8b7c",
    torpedo: true
  }
};

export const broadsideLoadouts = {
  standard: {
    name: "Standard Broadside",
    description: "Balanced battery.",
    damage: 19,
    cooldown: 1.15,
    range: 460,
    arc: 74,
    speed: 560,
    spread: 14,
    shots: 5,
    size: 3,
    color: "#f6f1a8"
  },
  heavy: {
    name: "Heavy Broadside",
    description: "High damage, slow cooldown.",
    damage: 31,
    cooldown: 1.85,
    range: 500,
    arc: 62,
    speed: 520,
    spread: 10,
    shots: 5,
    size: 4,
    color: "#ffbf78"
  },
  flak: {
    name: "Flak Broadside",
    description: "Lower damage, wider arc, fast cooldown.",
    damage: 12,
    cooldown: 0.72,
    range: 380,
    arc: 106,
    speed: 620,
    spread: 20,
    shots: 6,
    size: 3,
    color: "#a8ffcb"
  }
};

export const utilityLoadouts = {
  reinforcedShields: {
    name: "Reinforced Shields",
    description: "Increases maximum shields and shield recovery."
  },
  engineBoost: {
    name: "Engine Boost",
    description: "Improves thrust and turning slightly."
  },
  improvedSensors: {
    name: "Improved Sensors",
    description: "Extends target detection range."
  },
  repairDrones: {
    name: "Repair Drones",
    description: "Slowly patches hull during combat."
  }
};
