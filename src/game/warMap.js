"use strict";

import { state } from "../state.js";
import { SECTORS, CONTROL_BASE, CONTROL_INFO } from "../data/sectors.js";
import { SECTOR_MISSION_POOL } from "../data/missionTypes.js";
import { clamp, pick, randomInt } from "../utils.js";
import { saveCareer } from "../career.js";

// War-state model and simulation. The static sector layout lives in data; here
// we hold the mutable per-sector values, advance the war after each mission,
// and generate the war-update bulletins.

export function ensureWar() {
  if (state.career.war && state.career.war.sectors) return;
  const sectors = {};
  for (const s of SECTORS) {
    sectors[s.id] = {
      control: s.control,
      starbaseLevel: s.starbaseLevel || 0,
      missionType: s.control !== "commonwealth" ? pick(SECTOR_MISSION_POOL) : null,
      ...CONTROL_BASE[s.control]
    };
  }
  state.career.war = { cycle: 1, sectors, news: [] };
  saveCareer();
}

export function sectorState(id) {
  return state.career.war.sectors[id];
}

export function sectorDef(id) {
  return SECTORS.find((s) => s.id === id);
}

// A sector offers an assassination mission while the enemy still holds a
// presence there (anything not yet fully Commonwealth-secured).
export function sectorHasMission(id) {
  return sectorState(id).control !== "commonwealth";
}

export function controlInfo(control) {
  return CONTROL_INFO[control] || CONTROL_INFO.contested;
}

// Merge static + dynamic into one object for mission generation.
export function fullSector(id) {
  return { ...sectorDef(id), ...sectorState(id) };
}

// A theatre-wide read of the war: how many sectors each side holds and an
// overall front status derived from the balance.
export function warSummary() {
  ensureWar();
  const counts = { commonwealth: 0, contested: 0, veyr: 0 };
  let threat = 0;
  for (const s of SECTORS) {
    const sec = sectorState(s.id);
    counts[sec.control] = (counts[sec.control] || 0) + 1;
    threat += sec.threat;
  }
  const total = SECTORS.length;
  const avgThreat = threat / total;
  let status;
  if (counts.veyr === 0 && counts.contested === 0) status = "Theatre Secured";
  else if (counts.commonwealth > counts.veyr + 1) status = "Commonwealth Ascendant";
  else if (counts.veyr > counts.commonwealth + 1) status = "Dominion Ascendant";
  else status = "Contested";
  return { counts, total, avgThreat, status, cycle: state.career.war.cycle };
}

export function applyMissionOutcome(id, result, grade, mission) {
  const sec = sectorState(id);
  const strong = grade === "S" || grade === "A";
  let shift = null;

  if (result === "success") {
    sec.threat = clamp(sec.threat - (strong ? 28 : 18), 0, 100);
    sec.enemyFleet = clamp(sec.enemyFleet - (strong ? 32 : 22), 0, 100);
    sec.stability = clamp(sec.stability + (strong ? 15 : 9), 0, 100);
    sec.presence = clamp(sec.presence + 13, 0, 100);
    sec.supply = clamp(sec.supply + 6, 0, 100);
    if (sec.control === "veyr" && sec.threat < 55) {
      sec.control = "contested";
      shift = "contested";
    } else if (sec.control === "contested" && sec.threat < 34 && sec.presence > 60) {
      sec.control = "commonwealth";
      shift = "liberated";
    }
  } else {
    sec.threat = clamp(sec.threat + 14, 0, 100);
    sec.stability = clamp(sec.stability - 9, 0, 100);
    sec.enemyFleet = clamp(sec.enemyFleet + 9, 0, 100);
    sec.presence = clamp(sec.presence - 8, 0, 100);
    if (sec.control === "contested" && sec.threat > 80) {
      sec.control = "veyr";
      shift = "lost";
    }
  }

  // Roll a fresh operation for the sector (or clear it if now secured).
  sec.missionType = sec.control !== "commonwealth" ? pick(SECTOR_MISSION_POOL) : null;

  driftOtherSectors(id);
  state.career.war.cycle += 1;

  const news = buildWarNews(id, result, mission, shift);
  state.career.war.news.unshift(news);
  state.career.war.news = state.career.war.news.slice(0, 8);
  saveCareer();
  return { news, shift };
}

// Quiet background movement of the war so the front feels alive.
function driftOtherSectors(excludeId) {
  for (const s of SECTORS) {
    if (s.id === excludeId) continue;
    const sec = sectorState(s.id);
    if (Math.random() < 0.45) {
      sec.threat = clamp(sec.threat + randomInt(-3, 7), 0, 100);
      sec.stability = clamp(sec.stability + randomInt(-5, 4), 0, 100);
      // A neglected contested sector can slip toward the enemy.
      if (sec.control === "contested" && sec.threat > 88) sec.control = "veyr";
    }
  }
}

function buildWarNews(id, result, mission, shift) {
  const def = sectorDef(id);
  const target = mission.flagshipName;
  if (result === "success") {
    let line = `Your destruction of the ${target} has weakened Dominion coordination in the ${def.name}.`;
    if (shift === "liberated") line += ` ${def.name} is now under Commonwealth control.`;
    else if (shift === "contested") line += ` Enemy hold on ${def.name} is broken — the sector is now contested.`;
    else line += " Commonwealth pressure in the sector continues to build.";
    return { cycle: state.career.war.cycle, text: line, tone: "good" };
  }
  let line = `The action against the ${target} in the ${def.name} failed; enemy fleets press their advantage.`;
  if (shift === "lost") line += ` ${def.name} has fallen to the Veyr Dominion.`;
  return { cycle: state.career.war.cycle, text: line, tone: "bad" };
}
