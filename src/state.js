"use strict";

// Central mutable game state + shared constants. This module imports nothing
// from the rest of the game so every other module can depend on it safely.

export const WORLD = {
  width: 3200,
  height: 2200
};

export const SYSTEM_NAMES = {
  engines: "Engines",
  weapons: "Weapons",
  sensors: "Sensors",
  shields: "Shields"
};

export const SYSTEM_STATES = ["operational", "light damage", "heavy damage", "disabled"];

export function createSystems() {
  return { engines: 0, weapons: 0, sensors: 0, shields: 0 };
}

export function defaultCareer() {
  return {
    credits: 1250,
    reputationScore: 0,
    hull: 1,
    systems: createSystems(),
    loadout: {
      forward: "lightForward",
      port: "standard",
      starboard: "standard",
      utility: "reinforcedShields"
    }
  };
}

export const state = {
  screen: "title",
  keys: {},
  paused: false,
  lastTime: 0,
  hasSave: false,
  career: defaultCareer(),
  mission: null,
  player: null,
  enemies: [],
  projectiles: [],
  asteroids: [],
  effects: [],
  stars: [],
  messages: [],
  stats: null,
  evaluation: null
};
