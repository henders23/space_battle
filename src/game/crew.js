"use strict";

import { state } from "../state.js";
import { OFFICERS, SYSTEM_ORDER } from "../data/officers.js";
import { clamp } from "../utils.js";

// Crew progression: the four named bridge officers gain experience from every
// action, level up to sharpen the system they run, unlock named perks at
// levels 3 and 5, and can be wounded when their station is wrecked in combat.
// A wounded officer's bonuses are suspended until they recover — two missions
// in the sick bay, or immediately when the ship is repaired at the starbase.

export const MAX_LEVEL = 6;
const XP_THRESHOLDS = [0, 90, 220, 400, 640, 940]; // xp needed to sit at level 1..6
export const RECOVERY_MISSIONS = 2;
export const MEDBAY_COST = 160; // per wounded officer, folded into ship repair

// Named perks per station, unlocked at levels 3 and 5.
export const PERKS = {
  engines: { 3: "Ahead Flank — +8% engine output", 5: "Helm Instinct — +10% turn rate" },
  weapons: { 3: "Rapid Reload — batteries recharge 8% faster", 5: "Master Gunner — +10% weapon damage" },
  sensors: { 3: "Long Watch — +160 sensor range", 5: "Deep Scan — +240 sensor range" },
  shields: { 3: "Emergency Capacitors — shields recover sooner after a hit", 5: "Field Harmonics — +10% maximum shields" }
};

export function defaultCrew() {
  const crew = {};
  for (const sys of SYSTEM_ORDER) crew[sys] = { xp: 0, injuredFor: 0 };
  return crew;
}

// The live crew record on the career, healing missing/partial saves in place.
export function crewState() {
  if (!state.career.crew) state.career.crew = defaultCrew();
  for (const sys of SYSTEM_ORDER) {
    if (!state.career.crew[sys]) state.career.crew[sys] = { xp: 0, injuredFor: 0 };
  }
  return state.career.crew;
}

export function levelFor(xp) {
  let level = 1;
  for (let i = 1; i < XP_THRESHOLDS.length; i += 1) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1;
  }
  return Math.min(MAX_LEVEL, level);
}

// Progress toward the next level, 0..1 (1 at max level).
export function levelProgress(xp) {
  const level = levelFor(xp);
  if (level >= MAX_LEVEL) return 1;
  const floor = XP_THRESHOLDS[level - 1];
  const ceil = XP_THRESHOLDS[level];
  return clamp((xp - floor) / (ceil - floor), 0, 1);
}

export function officerLevel(sys) {
  return levelFor(crewState()[sys].xp);
}

export function isWounded(sys) {
  return crewState()[sys].injuredFor > 0;
}

function effectiveLevel(sys) {
  return isWounded(sys) ? 1 : officerLevel(sys);
}

// ---- the bonuses each station's officer contributes ----
// Levels give a steady per-level edge; the level 3 / 5 perks add a discrete
// jump. A wounded officer contributes nothing until recovered.

export function crewEngineMult() {
  const lvl = effectiveLevel("engines");
  return 1 + 0.04 * (lvl - 1) + (lvl >= 3 ? 0.08 : 0);
}

export function crewTurnMult() {
  return effectiveLevel("engines") >= 5 ? 1.1 : 1;
}

export function crewCooldownMult() {
  const lvl = effectiveLevel("weapons");
  return 1 / (1 + 0.03 * (lvl - 1) + (lvl >= 3 ? 0.08 : 0));
}

export function crewDamageMult() {
  return effectiveLevel("weapons") >= 5 ? 1.1 : 1;
}

export function crewSensorBonus() {
  const lvl = effectiveLevel("sensors");
  return 60 * (lvl - 1) + (lvl >= 3 ? 160 : 0) + (lvl >= 5 ? 240 : 0);
}

export function crewShieldRegenMult() {
  return 1 + 0.06 * (effectiveLevel("shields") - 1);
}

// Seconds shaved off the shield-recovery delay after a hit.
export function crewShieldDelayCut() {
  return effectiveLevel("shields") >= 3 ? 0.8 : 0;
}

export function crewShieldMaxMult() {
  return effectiveLevel("shields") >= 5 ? 1.1 : 1;
}

// ---- combat wounds ----

// Wound the officer at `sys` (no effect if already down). Returns the officer
// definition when a fresh wound landed, so the caller can announce it.
export function woundOfficer(sys) {
  const record = crewState()[sys];
  if (record.injuredFor > 0) return null;
  record.injuredFor = RECOVERY_MISSIONS;
  if (!state.stats.officersWounded.includes(sys)) state.stats.officersWounded.push(sys);
  return OFFICERS[sys];
}

export function woundedOfficers() {
  return SYSTEM_ORDER.filter((sys) => isWounded(sys));
}

export function healAllOfficers() {
  for (const sys of SYSTEM_ORDER) crewState()[sys].injuredFor = 0;
}

// ---- after-action experience ----

// Award the mission's experience and advance recovery clocks. Returns callouts
// for the after-action review: level-ups (with any perk unlocked) and officers
// returning to duty.
export function recordMissionExperience(result, grade, stats) {
  const crew = crewState();
  const success = result === "success";
  const gradeBonus = { S: 25, A: 18, B: 12, C: 8, D: 4, F: 0 }[grade] || 0;
  const base = success ? 40 + gradeBonus : 16;

  const gains = {
    engines: base + (stats.survived && stats.hullCritical ? 16 : 8),
    weapons: base + Math.min(30, (stats.escortsDestroyed + (stats.targetDestroyed ? 2 : 0)) * 6),
    sensors: base + (success ? 10 : 4),
    shields: base + Math.min(22, Math.round(stats.damageTaken * 0.04))
  };

  const callouts = { levelUps: [], recovered: [] };
  for (const sys of SYSTEM_ORDER) {
    const record = crew[sys];
    const officer = OFFICERS[sys];

    if (record.injuredFor > 0) {
      // The wounded gain nothing this action, but their recovery advances.
      record.injuredFor -= 1;
      if (record.injuredFor === 0) callouts.recovered.push(officer);
      continue;
    }

    const before = levelFor(record.xp);
    record.xp += gains[sys];
    const after = levelFor(record.xp);
    if (after > before) {
      callouts.levelUps.push({ officer, level: after, perk: (PERKS[sys] && PERKS[sys][after]) || null });
    }
  }
  return callouts;
}
