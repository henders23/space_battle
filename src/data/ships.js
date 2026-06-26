"use strict";

// Player hull classes. Each flies and fights distinctly: the frigate is fast and
// fragile, the cruiser is the balanced workhorse, the battleship is a slow,
// devastating gun platform. Bought at the shipyard, gated by reputation + credits.

export const HULLS = {
  frigate: {
    name: "Frigate",
    className: "Sentinel-class Frigate",
    cost: 0,
    reqReputation: 0,
    hullSide: 250,
    shieldSide: 150,
    shieldRegen: 12,
    turn: 0.55,
    speeds: [0, 40, 95, 170],
    radius: 46,
    spriteScale: 1.3,
    weaponDamage: 0.9,
    weaponCooldown: 0.88,
    desc: "Fast and nimble but lightly armoured — forgiving to fly, punishing to expose."
  },
  cruiser: {
    name: "Cruiser",
    className: "Meridian-class Cruiser",
    cost: 2400,
    reqReputation: 4,
    hullSide: 340,
    shieldSide: 180,
    shieldRegen: 10,
    turn: 0.4,
    speeds: [0, 30, 70, 130],
    radius: 56,
    spriteScale: 1.7,
    weaponDamage: 1.0,
    weaponCooldown: 1.0,
    desc: "The balanced workhorse of the line — strong broadsides, dependable shields."
  },
  battleship: {
    name: "Battleship",
    className: "Asterion-class Battleship",
    cost: 6000,
    reqReputation: 9,
    hullSide: 540,
    shieldSide: 250,
    shieldRegen: 8,
    turn: 0.26,
    speeds: [0, 22, 50, 92],
    radius: 74,
    spriteScale: 2.15,
    weaponDamage: 1.35,
    weaponCooldown: 1.12,
    desc: "Slow and ponderous, but its broadsides break the line — devastating, deliberate."
  }
};

export const HULL_ORDER = ["frigate", "cruiser", "battleship"];
