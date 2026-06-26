"use strict";

// Enemy ship classes and their AI behaviour profiles. The flagship is built
// separately in mission.js (its hull scales with the mission), but it shares the
// "flagship" behaviour here.

export const ENEMY_TYPES = {
  raider: {
    name: "Raider",
    hullSide: 55,
    shieldSide: 26,
    radius: 18,
    regen: 4,
    maxSpeed: 320,
    turn: 2.6,
    behavior: "aggressive",
    weapon: { name: "Raider Cannon", damage: 8, cooldown: 0.6, range: 360, arc: 42, speed: 650, spread: 6, shots: 1, size: 3, color: "#ff8d6b" }
  },
  escort: {
    name: "Escort",
    hullSide: 120,
    shieldSide: 78,
    radius: 22,
    regen: 5,
    maxSpeed: 255,
    turn: 1.15,
    behavior: "charge",
    weapon: { name: "Escort Guns", damage: 11, cooldown: 0.78, range: 400, arc: 34, speed: 610, spread: 5, shots: 2, size: 3, color: "#ff7b8d" }
  },
  frigate: {
    name: "Frigate",
    hullSide: 190,
    shieldSide: 120,
    radius: 30,
    regen: 6,
    maxSpeed: 205,
    turn: 0.9,
    behavior: "charge",
    weapon: { name: "Frigate Guns", damage: 16, cooldown: 0.95, range: 470, arc: 30, speed: 600, spread: 4, shots: 2, size: 4, color: "#ff9377" }
  },
  missile_boat: {
    name: "Missile Boat",
    hullSide: 110,
    shieldSide: 95,
    radius: 26,
    regen: 5,
    maxSpeed: 235,
    turn: 1.0,
    behavior: "kite",
    weapon: { name: "Seeker Missiles", damage: 26, cooldown: 2.2, range: 1000, arc: 26, speed: 360, spread: 3, shots: 1, size: 5, color: "#ffcf6b", torpedo: true }
  },
  cruiser: {
    name: "Cruiser",
    hullSide: 300,
    shieldSide: 170,
    radius: 48,
    regen: 6,
    maxSpeed: 150,
    turn: 0.62,
    behavior: "broadside",
    broadside: { name: "Cruiser Broadside", damage: 20, cooldown: 1.5, range: 480, arc: 70, speed: 520, spread: 12, shots: 5, size: 4, color: "#ff9377" },
    bow: { name: "Cruiser Bow Guns", damage: 13, cooldown: 1.1, range: 420, arc: 30, speed: 580, spread: 5, shots: 2, size: 3, color: "#ffb18f" }
  }
};

// Which classes show up in each mission type (besides the flagship/objective).
export const ENEMY_POOLS = {
  assassinate_flagship: ["escort", "frigate"],
  patrol: ["raider", "escort", "frigate"],
  convoy_escort: ["raider", "raider", "escort"],
  starbase_defence: ["escort", "frigate", "cruiser"],
  rescue_disabled: ["escort", "missile_boat", "frigate"]
};
