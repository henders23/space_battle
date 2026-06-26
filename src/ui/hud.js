"use strict";

import { state, SYSTEM_NAMES, SYSTEM_STATES } from "../state.js";
import { distance, formatTime } from "../utils.js";
import { playerWeaponDefinitions } from "../combat/weapons.js";
import { getSensorRange } from "../combat/systems.js";
import { sideRatioShield, sideRatioHull } from "../combat/shipStats.js";

const dom = {};

export function initHud() {
  dom.operation = document.getElementById("hud-operation");
  dom.objective = document.getElementById("hud-objective");
  dom.timer = document.getElementById("hud-timer");
  dom.bars = {
    shieldPort: document.getElementById("shield-port-bar"),
    shieldStbd: document.getElementById("shield-stbd-bar"),
    hullPort: document.getElementById("hull-port-bar"),
    hullStbd: document.getElementById("hull-stbd-bar")
  };
  dom.vals = {
    shieldPort: document.getElementById("shield-port-val"),
    shieldStbd: document.getElementById("shield-stbd-val"),
    hullPort: document.getElementById("hull-port-val"),
    hullStbd: document.getElementById("hull-stbd-val")
  };
  dom.throttle = document.getElementById("hud-throttle");
  dom.systemList = document.getElementById("system-list");
  dom.weaponList = document.getElementById("weapon-list");
  dom.targetInfo = document.getElementById("target-info");
  dom.messageLog = document.getElementById("message-log");
}

function hullColor(ratio) {
  return ratio > 0.45 ? "#5fd17a" : ratio > 0.22 ? "#f0a93d" : "#ff5347";
}

function setBar(bar, val, ratio, color) {
  bar.style.width = `${ratio * 100}%`;
  bar.style.background = color;
  val.textContent = `${Math.round(ratio * 100)}%`;
}

function nearestVisibleTarget() {
  const range = getSensorRange();
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const d = distance(state.player, enemy);
    if (d <= range && d < bestDistance) {
      best = enemy;
      bestDistance = d;
    }
  }
  return best;
}

export function updateHud() {
  if (state.screen !== "combat" || !state.player) return;
  const player = state.player;
  const mission = state.mission;

  if (dom.operation) dom.operation.textContent = mission.operationName.toUpperCase();
  dom.objective.textContent = `Destroy ${mission.flagshipName} in ${mission.sectorName}.`;
  dom.timer.textContent = formatTime(mission.timer);

  const throttleLabels = ["STOP", "SLOW", "MODERATE", "FULL"];
  if (dom.throttle) {
    const t = player.throttle || 0;
    dom.throttle.textContent = throttleLabels[t];
    dom.throttle.dataset.level = t;
  }

  setBar(dom.bars.shieldPort, dom.vals.shieldPort, sideRatioShield(player, "port"), "#45e0f0");
  setBar(dom.bars.shieldStbd, dom.vals.shieldStbd, sideRatioShield(player, "starboard"), "#45e0f0");
  const hp = sideRatioHull(player, "port");
  const hs = sideRatioHull(player, "starboard");
  setBar(dom.bars.hullPort, dom.vals.hullPort, hp, hullColor(hp));
  setBar(dom.bars.hullStbd, dom.vals.hullStbd, hs, hullColor(hs));

  dom.systemList.innerHTML = "";
  for (const [key, level] of Object.entries(player.systems)) {
    const item = document.createElement("li");
    item.dataset.level = level;
    item.innerHTML = `<span>${SYSTEM_NAMES[key]}</span><b>${SYSTEM_STATES[level]}</b>`;
    dom.systemList.appendChild(item);
  }

  const weapons = playerWeaponDefinitions();
  dom.weaponList.innerHTML = "";
  for (const slot of ["forward", "port", "starboard", "torpedo"]) {
    const item = document.createElement("li");
    const cooldown = player.cooldowns[slot];
    const ready = cooldown <= 0;
    item.dataset.ready = ready;
    item.innerHTML = `<span>${weapons[slot].name}</span><b>${ready ? "READY" : cooldown.toFixed(1)}</b>`;
    dom.weaponList.appendChild(item);
  }

  const target = nearestVisibleTarget();
  if (target) {
    const hPort = Math.round(sideRatioHull(target, "port") * 100);
    const hStbd = Math.round(sideRatioHull(target, "starboard") * 100);
    const sPort = Math.round(sideRatioShield(target, "port") * 100);
    const sStbd = Math.round(sideRatioShield(target, "starboard") * 100);
    dom.targetInfo.innerHTML =
      `<b>${target.name}</b> — ${Math.round(distance(player, target))}m<br>` +
      `<span class="sd">SHLD</span> P ${sPort}% · S ${sStbd}%<br>` +
      `<span class="sd">HULL</span> P ${hPort}% · S ${hStbd}%`;
  } else {
    dom.targetInfo.textContent = "No contact inside sensor range.";
  }

  dom.messageLog.innerHTML = "";
  for (const message of state.messages) {
    const item = document.createElement("li");
    item.textContent = message.text;
    dom.messageLog.appendChild(item);
  }
}
