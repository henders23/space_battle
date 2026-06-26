"use strict";

import { state, defaultCareer, defaultRecord, createSystems } from "./state.js";

const GRADE_ORDER = ["—", "F", "D", "C", "B", "A", "S"];

export function betterGrade(a, b) {
  return GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b;
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
  return Math.max(0, hullCost + systemCost);
}

export function repairShip() {
  const cost = calculateRepairCost();
  if (cost <= 0 || state.career.credits < cost) return false;
  state.career.credits -= cost;
  state.career.hull = 1;
  state.career.systems = createSystems();
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

export function newCampaign() {
  state.career = defaultCareer();
  saveCareer();
}
