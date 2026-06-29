"use strict";

// Central mutable game state + shared constants. This module imports nothing
// from the rest of the game so every other module can depend on it safely.

export const WORLD = {
  width: 4000,
  height: 2800
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

export function defaultRecord() {
  return {
    missionsCompleted: 0,
    missionsFailed: 0,
    grades: { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 },
    flagshipsDestroyed: 0,
    escortsDestroyed: 0,
    enemyTonnage: 0,
    timesHullCritical: 0,
    bestGrade: "—",
    commendations: [], // earned medal ids (see data/commendations.js)
    reprimands: [], // recorded reprimand ids
    history: []
  };
}

// Items the captain starts with; everything else must be bought at the armory.
export function defaultOwned() {
  return {
    forward: ["lightForward"],
    broadside: ["standard"],
    utility: ["reinforcedShields"]
  };
}

export function defaultCareer() {
  return {
    captainName: "Halden",
    rankIndex: 0, // last-acknowledged rank, for detecting promotions
    credits: 1250,
    reputationScore: 0,
    hull: 1,
    systems: createSystems(),
    loadout: {
      forward: "lightForward",
      port: "standard",
      starboard: "standard",
      utility: "reinforcedShields"
    },
    ship: "frigate",
    ownedShips: ["frigate"],
    owned: defaultOwned(),
    record: defaultRecord()
  };
}

export const state = {
  screen: "title",
  keys: {},
  mouseScreen: null, // last cursor position in canvas pixel coords
  paused: false,
  shake: 0,
  lastTime: 0,
  hasSave: false,
  career: defaultCareer(),
  activeSectorId: null,
  mission: null,
  player: null,
  enemies: [],
  allies: [],
  objective: null,
  boarding: { active: false, available: false, calloutVisible: false, targetId: null },
  projectiles: [],
  asteroids: [],
  effects: [],
  stars: [],
  messages: [],
  stats: null,
  evaluation: null
};
