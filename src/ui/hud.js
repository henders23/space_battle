"use strict";

import { state, SYSTEM_NAMES, SYSTEM_STATES } from "../state.js";
import { distance, formatTime } from "../utils.js";
import { playerWeaponDefinitions } from "../combat/weapons.js";
import { getSensorRange } from "../combat/systems.js";
import { sideRatioShield, sideRatioHull } from "../combat/shipStats.js";
import { OFFICERS, SYSTEM_ORDER } from "../data/officers.js";
import { objectiveHudText } from "../combat/objectives.js";
import { updateBoardingHud } from "../combat/boarding.js";

const dom = {};
const RACK_SLOTS = ["forward", "port", "starboard", "torpedo"];
const rack = {};
const officerRows = {};
const plan = {};

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
  dom.weaponList = document.getElementById("weapon-list");
  dom.targetInfo = document.getElementById("target-info");
  dom.messageLog = document.getElementById("message-log");

  // Bottom weapon rack (charge bars + key labels).
  for (const slot of RACK_SLOTS) {
    const btn = document.querySelector(`.weapon-rack [data-fire="${slot}"]`);
    rack[slot] = {
      btn,
      charge: document.getElementById(`charge-${slot}`),
      name: document.getElementById(`rack-${slot}-name`),
      state: document.getElementById(`rack-${slot}-state`)
    };
  }

  // Ship damage schematic nodes
  plan.port = document.getElementById("plan-port");
  plan.stbd = document.getElementById("plan-stbd");
  plan.engines = document.getElementById("plan-engines");
  plan.weaponsP = document.getElementById("plan-weapons-p");
  plan.weaponsS = document.getElementById("plan-weapons-s");
  plan.sensors = document.getElementById("plan-sensors");

  buildOfficerRows();
}

// Build the officer rows once so the portraits don't reload (and flicker) every
// frame; only the status text, bar and colour are updated in the loop.
function buildOfficerRows() {
  const container = document.getElementById("system-officers");
  if (!container) return;
  container.innerHTML = "";
  for (const sys of SYSTEM_ORDER) {
    const officer = OFFICERS[sys];
    const row = document.createElement("div");
    row.className = "officer-row";
    row.innerHTML =
      `<img class="officer-portrait" src="${officer.portrait}" alt="${officer.name}" loading="lazy">` +
      `<div class="officer-info">` +
      `<span class="officer-top"><span class="officer-name">${officer.name}</span>` +
      `<span class="officer-role mono">${officer.role}</span></span>` +
      `<span class="officer-system"><span class="sys-icon">${officer.icon}</span> ${SYSTEM_NAMES[sys]} — <b class="sys-status">operational</b></span>` +
      `<div class="officer-bar"><i></i></div>` +
      `</div>`;
    container.appendChild(row);
    officerRows[sys] = {
      row,
      status: row.querySelector(".sys-status"),
      bar: row.querySelector(".officer-bar i")
    };
  }
}

function hullColor(ratio) {
  return ratio > 0.45 ? "#5fd17a" : ratio > 0.22 ? "#f0a93d" : "#ff5347";
}

function systemColor(level) {
  return ["#5fd17a", "#f0a93d", "#ff8a40", "#ff5347"][level] || "#5fd17a";
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
  dom.objective.textContent = objectiveHudText();
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

  // Bridge crew & system status
  for (const sys of SYSTEM_ORDER) {
    const refs = officerRows[sys];
    if (!refs) continue;
    const level = player.systems[sys] || 0;
    refs.row.dataset.level = level;
    refs.status.textContent = SYSTEM_STATES[level];
    refs.status.style.color = systemColor(level);
    refs.bar.style.width = `${((3 - level) / 3) * 100}%`;
    refs.bar.style.background = systemColor(level);
  }

  // Ship damage schematic: flanks coloured by hull, outline by shields, system
  // markers by their own state.
  if (plan.port) {
    plan.port.style.fill = hullColor(hp);
    plan.stbd.style.fill = hullColor(hs);
    const shieldStroke = systemColor(player.systems.shields || 0);
    plan.port.style.stroke = shieldStroke;
    plan.stbd.style.stroke = shieldStroke;
    plan.engines.style.fill = systemColor(player.systems.engines || 0);
    plan.weaponsP.style.fill = systemColor(player.systems.weapons || 0);
    plan.weaponsS.style.fill = systemColor(player.systems.weapons || 0);
    plan.sensors.style.fill = systemColor(player.systems.sensors || 0);
  }

  const weapons = playerWeaponDefinitions();
  dom.weaponList.innerHTML = "";
  for (const slot of RACK_SLOTS) {
    const item = document.createElement("li");
    const cooldown = player.cooldowns[slot];
    const ready = cooldown <= 0;
    item.dataset.ready = ready;
    item.innerHTML = `<span>${weapons[slot].name}</span><b>${ready ? "READY" : cooldown.toFixed(1)}</b>`;
    dom.weaponList.appendChild(item);
  }

  // Bottom weapon rack: charge bars fill as each battery reloads.
  for (const slot of RACK_SLOTS) {
    const refs = rack[slot];
    if (!refs || !refs.charge) continue;
    const cooldown = player.cooldowns[slot];
    const max = (player.cooldownMax && player.cooldownMax[slot]) || weapons[slot].cooldown || 1;
    const ratio = cooldown <= 0 ? 1 : Math.max(0, Math.min(1, 1 - cooldown / max));
    const ready = cooldown <= 0;
    refs.charge.style.width = `${ratio * 100}%`;
    if (refs.btn) refs.btn.dataset.ready = ready;
    if (refs.name) refs.name.textContent = weapons[slot].name;
    if (refs.state) refs.state.textContent = ready ? "Ready" : `${cooldown.toFixed(1)}s`;
  }

  updateBoardingHud();

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
