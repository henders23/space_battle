"use strict";

import { state, SYSTEM_NAMES, SYSTEM_STATES } from "../state.js";
import { clamp, distance, formatTime } from "../utils.js";
import { playerWeaponDefinitions } from "../combat/weapons.js";
import { getSensorRange } from "../combat/systems.js";

const dom = {};

export function initHud() {
  dom.operation = document.getElementById("hud-operation");
  dom.objective = document.getElementById("hud-objective");
  dom.timer = document.getElementById("hud-timer");
  dom.hullBar = document.getElementById("hull-bar");
  dom.hullValue = document.getElementById("hull-value");
  dom.shieldBar = document.getElementById("shield-bar");
  dom.shieldValue = document.getElementById("shield-value");
  dom.systemList = document.getElementById("system-list");
  dom.weaponList = document.getElementById("weapon-list");
  dom.targetInfo = document.getElementById("target-info");
  dom.messageLog = document.getElementById("message-log");
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

  const hullPercent = clamp(player.hull / player.hullMax, 0, 1);
  const shieldPercent = clamp(player.shields / player.shieldsMax, 0, 1);
  dom.hullBar.style.width = `${hullPercent * 100}%`;
  dom.hullBar.style.background = hullPercent > 0.45 ? "#5fd17a" : hullPercent > 0.22 ? "#f0a93d" : "#ff5347";
  dom.hullValue.textContent = `${Math.round(hullPercent * 100)}%`;
  dom.shieldBar.style.width = `${shieldPercent * 100}%`;
  dom.shieldValue.textContent = `${Math.round(shieldPercent * 100)}%`;

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
    const hull = Math.round((target.hull / target.hullMax) * 100);
    const shields = Math.round((target.shields / target.shieldsMax) * 100);
    dom.targetInfo.textContent = `${target.name}: ${Math.round(distance(player, target))}m, hull ${hull}%, shields ${shields}%.`;
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
