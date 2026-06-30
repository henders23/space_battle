"use strict";

import { state } from "../state.js";
import { clamp } from "../utils.js";
import { addMessage, addEffect, addShake } from "./effects.js";
import { hullRatio, shieldRatio } from "./shipStats.js";
import * as voicelines from "./voicelines.js";

// Per-mission-type objective logic: win/lose checks, HUD text, grading and the
// after-action report language. updateObjective returns a resolution object the
// simulation turns into finishMission, so this module needs no back-reference to
// the evaluation screen.

function aliveEnemies() {
  return state.enemies.filter((e) => e.spawned && e.alive);
}

function unspawnedEnemies() {
  return state.enemies.filter((e) => !e.spawned);
}

function spawnNextWave(obj) {
  obj.currentWave += 1;
  const next = state.enemies.filter((e) => !e.spawned && e.waveIndex === obj.currentWave);
  for (const e of next) {
    e.spawned = true;
    e.alive = true;
  }
  if (next.length) {
    addMessage("Sensors: new Dominion wave inbound.");
    voicelines.say("waveInbound");
  }
}

// Returns { result, reason } when the mission resolves, otherwise null.
export function updateObjective(dt) {
  const m = state.mission;
  const o = state.objective || {};
  m.timer = Math.max(0, m.timer - dt);

  if (m.type === "assassinate_flagship") {
    const fs = state.enemies.find((e) => e.type === "flagship");
    if (fs && !fs.alive) return win("Enemy flagship destroyed.");
    if (m.timer <= 0) return lose(`${m.flagshipName} escaped the intercept window.`);
    return null;
  }

  if (m.type === "patrol") {
    if (aliveEnemies().length === 0 && unspawnedEnemies().length === 0) {
      return win("Sector swept. All hostiles destroyed.");
    }
    if (m.timer <= 0) return lose("Patrol failed to clear the sector in time.");
    return null;
  }

  if (m.type === "convoy_escort") {
    const remaining = state.allies.filter((a) => a.alive).length;
    if (remaining === 0) {
      return o.saved > 0 ? win(`Convoy escort complete. ${o.saved}/${o.total} transports reached the jump point.`) : lose("The entire convoy was lost.");
    }
    if (m.timer <= 0) {
      return o.saved > 0 ? win(`Convoy window closed. ${o.saved}/${o.total} transports reached the jump point.`) : lose("The convoy ran out of time and was lost.");
    }
    return null;
  }

  if (m.type === "starbase_defence") {
    const station = o.station;
    if (station && !station.alive) return lose("The starbase was destroyed.");
    if (aliveEnemies().length === 0) {
      if (unspawnedEnemies().length > 0) {
        spawnNextWave(o);
      } else {
        return win("Starbase held. Every wave was repelled.");
      }
    }
    if (m.timer <= 0 && station && station.alive) return win("Starbase held the line until relief arrived.");
    return null;
  }

  if (m.type === "rescue_disabled") {
    const dis = o.disabled;
    if (dis && !dis.alive) return lose("The disabled ship was lost.");
    o.rescueLeft = Math.max(0, o.rescueLeft - dt);
    if (o.rescueLeft <= 0) {
      if (dis) {
        dis.alive = false;
        dis.saved = true;
        addEffect(dis.x, dis.y, "#5fd17a", 0.6);
        addShake(6);
      }
      return win("The disabled ship jumped clear.");
    }
    if (m.timer <= 0 && dis && dis.alive) return win("The disabled ship was recovered.");
    return null;
  }

  return null;
}

function win(reason) {
  return { result: "success", reason };
}
function lose(reason) {
  return { result: "failed", reason };
}

export function objectiveHudText() {
  const m = state.mission;
  const o = state.objective || {};
  if (m.type === "assassinate_flagship") {
    return `Destroy ${m.flagshipName}`;
  }
  if (m.type === "patrol") {
    const n = aliveEnemies().length + unspawnedEnemies().length;
    return `Sweep ${m.sectorName} — ${n} hostile${n === 1 ? "" : "s"} remaining`;
  }
  if (m.type === "convoy_escort") {
    const enroute = state.allies.filter((a) => a.alive).length;
    const lost = (o.total || 0) - (o.saved || 0) - enroute;
    return `Convoy: ${o.saved || 0} safe · ${enroute} en route · ${lost} lost`;
  }
  if (m.type === "starbase_defence") {
    const station = o.station;
    const hull = station ? Math.round(hullRatio(station) * 100) : 0;
    return `Hold the line — wave ${Math.min(o.currentWave + 1, o.waveCount)}/${o.waveCount} · Starbase ${hull}%`;
  }
  if (m.type === "rescue_disabled") {
    const dis = o.disabled;
    const hull = dis ? Math.round(hullRatio(dis) * 100) : 0;
    return `Defend the Meridian — withdraw in ${Math.ceil(o.rescueLeft || 0)}s · hull ${hull}%`;
  }
  return m.typeName;
}

// The entity the off-screen indicator should point at.
export function focusPoint() {
  const m = state.mission;
  const o = state.objective || {};
  if (m.type === "assassinate_flagship") {
    return state.enemies.find((e) => e.type === "flagship" && e.alive) || null;
  }
  if (m.type === "starbase_defence") return o.station && o.station.alive ? o.station : nearestAliveEnemy();
  if (m.type === "rescue_disabled") return o.disabled && o.disabled.alive ? o.disabled : nearestAliveEnemy();
  if (m.type === "convoy_escort") return state.allies.find((a) => a.alive) || (o.exit ? { x: o.exit.x, y: o.exit.y } : null);
  return nearestAliveEnemy();
}

function nearestAliveEnemy() {
  let best = null;
  let bd = Infinity;
  for (const e of state.enemies) {
    if (!e.spawned || !e.alive) continue;
    const d = (e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

// ---- grading + report ----

function scoreToGrade(score) {
  if (score >= 92) return "S";
  if (score >= 82) return "A";
  if (score >= 70) return "B";
  if (score >= 58) return "C";
  if (score >= 45) return "D";
  return "F";
}

export function gradeMission(result) {
  if (result !== "success") return "F";
  const p = state.player;
  const m = state.mission;
  const o = state.objective || {};
  const s = state.stats;
  const accuracy = s.shotsFired > 0 ? s.shotsHit / s.shotsFired : 0;
  let score = 56;
  score += hullRatio(p) * 16;
  score += shieldRatio(p) * 6;
  score += accuracy * 8;
  score -= s.systemsDamaged * 4;
  score += clamp(1 - s.timeTaken / m.duration, 0, 1) * 6;

  if (m.type === "assassinate_flagship") {
    score += s.escortsDestroyed * 3;
  } else if (m.type === "patrol") {
    score += 6;
  } else if (m.type === "convoy_escort") {
    const lost = (o.total || 0) - (o.saved || 0);
    score += (1 - lost / Math.max(1, o.total)) * 16;
    if (lost === 0) score += 6;
  } else if (m.type === "starbase_defence") {
    score += (o.station ? hullRatio(o.station) : 0) * 16;
  } else if (m.type === "rescue_disabled") {
    score += (o.disabled ? hullRatio(o.disabled) : 0) * 12 + 4;
  }
  return scoreToGrade(score);
}

// The single-sentence summary of how the objective played out. Shared by the
// short report and the procedural command dispatch (game/dispatch.js).
export function engagementSummary(result, reason) {
  const m = state.mission;
  const o = state.objective || {};
  const s = state.stats;
  const time = `${Math.floor(s.timeTaken / 60)}:${String(Math.floor(s.timeTaken % 60)).padStart(2, "0")}`;

  if (result !== "success") return reason;

  if (m.type === "assassinate_flagship") {
    return `${m.flagshipName} was destroyed in ${time}, with ${s.escortsDestroyed} escort${s.escortsDestroyed === 1 ? "" : "s"} broken in the action.`;
  }
  if (m.type === "patrol") {
    return `The sector was swept clean in ${time}; every hostile contact was hunted down.`;
  }
  if (m.type === "convoy_escort") {
    const lost = (o.total || 0) - (o.saved || 0);
    return `${o.saved}/${o.total} transports reached the jump point${lost === 0 ? " — not a hull lost" : `, with ${lost} lost en route`}.`;
  }
  if (m.type === "starbase_defence") {
    return `The starbase held against every wave; it came through at ${Math.round((o.station ? hullRatio(o.station) : 0) * 100)}% structural integrity.`;
  }
  if (m.type === "rescue_disabled") {
    return `The crippled Meridian was held and jumped clear at ${Math.round((o.disabled ? hullRatio(o.disabled) : 0) * 100)}% hull.`;
  }
  return reason;
}

export function reportText(result, reason, grade) {
  const m = state.mission;
  const s = state.stats;
  const head = `${m.typeName} over ${m.sectorName}, operation ${m.operationName}.`;

  if (result !== "success") {
    return `${head} ${reason} Command assigns grade ${grade}; the objective was not achieved. Damage control logged ${s.systemsDamaged} system incident${s.systemsDamaged === 1 ? "" : "s"}.`;
  }
  return `${head} ${engagementSummary(result, reason)} Final grade ${grade} reflects ship preservation, accuracy, time on station and objective discipline.`;
}
