"use strict";

import { state, defaultCareer, defaultRecord, defaultOwned, createSystems } from "./state.js";
import { rankFor } from "./data/ranks.js";
import { PLAYER_NAMES } from "./data/ships.js";
import { woundedOfficers, healAllOfficers, MEDBAY_COST } from "./game/crew.js";

const GRADE_ORDER = ["—", "F", "D", "C", "B", "A", "S"];

export function betterGrade(a, b) {
  return GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b;
}

// The captain's current rank, derived from the service record.
export function currentRank() {
  return rankFor(state.career);
}

// Record any newly-earned medals / reprimands, deduped, and return the ids that
// were actually new so the after-action screen can highlight them.
export function awardCommendations(commendationIds, reprimandIds) {
  const rec = state.career.record;
  if (!rec.commendations) rec.commendations = [];
  if (!rec.reprimands) rec.reprimands = [];
  const fresh = { commendations: [], reprimands: [] };
  for (const id of commendationIds || []) {
    if (!rec.commendations.includes(id)) {
      rec.commendations.push(id);
      fresh.commendations.push(id);
    }
  }
  for (const id of reprimandIds || []) {
    if (!rec.reprimands.includes(id)) {
      rec.reprimands.push(id);
      fresh.reprimands.push(id);
    }
  }
  return fresh;
}

// Sync the stored rank to the current record; returns the new rank when it has
// advanced since last acknowledged, otherwise null.
export function reconcileRank() {
  const rank = currentRank();
  const previous = state.career.rankIndex || 0;
  state.career.rankIndex = rank.index;
  return rank.index > previous ? rank : null;
}

// Career economy + persistence. A light localStorage layer for M0; the full
// save system (mission history, unlocks, war map) arrives in later milestones.

const SAVE_KEY = "valkyrie.career.v1";

export function currentReputation() {
  const score = state.career.reputationScore;
  if (score >= 8) return "Decorated";
  if (score >= 5) return "Reliable";
  if (score >= 2) return "Blooded";
  if (score <= -3) return "Questioned";
  return "Unproven";
}

export function calculateRepairCost() {
  const hullCost = Math.round((1 - state.career.hull) * 760);
  const systemCost = Object.values(state.career.systems).reduce(
    (total, level) => total + level * 135,
    0
  );
  const medbayCost = woundedOfficers().length * MEDBAY_COST;
  return Math.max(0, hullCost + systemCost + medbayCost);
}

export function isOwned(category, key) {
  const list = state.career.owned[category];
  return Boolean(list && list.includes(key));
}

// Purchase an armory item. Cost is supplied by the caller (from the item data)
// so this module doesn't need to import the loadout tables.
export function buyItem(category, key, cost) {
  if (isOwned(category, key) || state.career.credits < cost) return false;
  state.career.credits -= cost;
  if (!state.career.owned[category]) state.career.owned[category] = [];
  state.career.owned[category].push(key);
  saveCareer();
  return true;
}

export function ownsShip(key) {
  return state.career.ownedShips && state.career.ownedShips.includes(key);
}

export function buyShip(key, cost) {
  if (ownsShip(key) || state.career.credits < cost) return false;
  state.career.credits -= cost;
  state.career.ownedShips.push(key);
  state.career.ship = key;
  state.career.hull = 1; // a fresh hull arrives at full integrity
  resetShipIdentity(key); // a newly commissioned hull carries no scars yet
  saveCareer();
  return true;
}

export function equipShip(key) {
  if (!ownsShip(key)) return false;
  state.career.ship = key;
  ensureShipIdentity();
  saveCareer();
  return true;
}

// ---- veteran-ship identity ----

// The identity record always tracks the ship currently in service; switching to
// a different hull starts a fresh record for it.
export function ensureShipIdentity() {
  const id = state.career.shipIdentity;
  if (!id || id.shipKey !== state.career.ship) resetShipIdentity(state.career.ship);
  return state.career.shipIdentity;
}

export function resetShipIdentity(shipKey) {
  state.career.shipIdentity = {
    shipKey,
    name: PLAYER_NAMES[shipKey] || "CWS Vanguard",
    commissioned: state.career.war ? state.career.war.cycle : 1,
    battles: 0,
    scars: [],
    honours: []
  };
  return state.career.shipIdentity;
}

// Record this action against the ship in service: count the battle and append any
// scar/honour it earned. Returns the single freshest mark for the after-action
// callout + log, or null.
export function recordShipAction(stats, result, grade, sectorName) {
  const id = ensureShipIdentity();
  const cycle = state.career.war ? state.career.war.cycle : 1;
  id.battles += 1;

  let fresh = null;
  const addScar = (label) => {
    id.scars.unshift({ label, sector: sectorName, cycle });
    id.scars = id.scars.slice(0, 8);
    fresh = { kind: "scar", label };
  };
  const addHonour = (label) => {
    if (!id.honours.includes(label)) id.honours.push(label);
    fresh = { kind: "honour", label };
  };

  if (result === "success" && (grade === "S" || grade === "A")) {
    addHonour(`Decorated action over ${sectorName} (grade ${grade})`);
  }
  if (stats.targetDestroyed) addHonour(`Command ship slain over ${sectorName}`);
  if (stats.hullCritical) addScar(`Hull breach sealed over ${sectorName}`);
  if (result !== "success") addScar(`Repulsed over ${sectorName}`);

  return fresh;
}

export function recordMission(entry) {
  const history = state.career.record.history;
  history.unshift(entry);
  state.career.record.history = history.slice(0, 12);
}

export function repairShip() {
  const cost = calculateRepairCost();
  if (cost <= 0 || state.career.credits < cost) return false;
  state.career.credits -= cost;
  state.career.hull = 1;
  state.career.systems = createSystems();
  healAllOfficers(); // the yard visit includes the medbay
  saveCareer();
  return true;
}

export function saveCareer() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state.career));
    state.hasSave = true;
  } catch (err) {
    // localStorage may be unavailable (private mode / file://). Fail silently;
    // the game still runs, it just won't persist between sessions.
  }
}

export function loadCareer() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    state.career = { ...defaultCareer(), ...parsed };
    state.career.systems = { ...createSystems(), ...(parsed.systems || {}) };
    state.career.loadout = { ...defaultCareer().loadout, ...(parsed.loadout || {}) };
    const rec = defaultRecord();
    state.career.record = { ...rec, ...(parsed.record || {}) };
    state.career.record.grades = { ...rec.grades, ...((parsed.record && parsed.record.grades) || {}) };
    state.career.record.history = (parsed.record && parsed.record.history) || [];
    state.career.record.commendations = (parsed.record && parsed.record.commendations) || [];
    state.career.record.reprimands = (parsed.record && parsed.record.reprimands) || [];
    state.career.captainName = parsed.captainName || defaultCareer().captainName;
    state.career.rankIndex = parsed.rankIndex || 0;
    const owned = defaultOwned();
    const savedOwned = parsed.owned || {};
    for (const cat of Object.keys(owned)) {
      // Union of starter items and anything purchased, de-duplicated.
      state.career.owned[cat] = Array.from(new Set([...owned[cat], ...(savedOwned[cat] || [])]));
    }
    state.career.ship = parsed.ship || "frigate";
    state.career.ownedShips = Array.from(new Set(["frigate", ...(parsed.ownedShips || [])]));
    state.career.nemeses = Array.isArray(parsed.nemeses) ? parsed.nemeses : [];
    state.career.operation = parsed.operation || null;
    state.career.shipIdentity = parsed.shipIdentity || null;
    state.career.crew = parsed.crew || null; // game/crew.js heals shape on access
    state.career.log = Array.isArray(parsed.log) ? parsed.log : [];
    state.hasSave = true;
    return true;
  } catch (err) {
    return false;
  }
}

export function hasSavedCareer() {
  try {
    return Boolean(localStorage.getItem(SAVE_KEY));
  } catch (err) {
    return false;
  }
}

export function newCampaign(captainName) {
  state.career = defaultCareer();
  const name = (captainName || "").trim();
  if (name) state.career.captainName = name;
  saveCareer();
}
