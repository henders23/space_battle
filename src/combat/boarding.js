"use strict";

import { state } from "../state.js";
import { distance } from "../utils.js";
import { hullRatio, hullMaxTotal } from "./shipStats.js";
import { addMessage, addRing, addShake } from "./effects.js";
import * as sfx from "../sfx.js";
import * as voicelines from "./voicelines.js";
import { boardingSalvage } from "./salvage.js";

// Boarding loop. A crippled hostile (hull at or below the threshold) can be
// boarded once the player's hull is alongside it. Boarding opens the standalone
// Boarding Action minigame in a paused overlay; its result is reported back via
// postMessage and applied to the ship-to-ship battle.

export const BOARDING_HULL_THRESHOLD = 0.3;
const BOARDING_SRC = "boarding/boarding-action.html";

const dom = {};
let pendingResult = null;

export function initBoarding() {
  dom.overlay = document.getElementById("boarding-overlay");
  dom.frame = document.getElementById("boarding-frame");
  dom.returnBtn = document.getElementById("boarding-return");
  dom.callout = document.getElementById("boarding-callout");
  dom.boardBtn = document.getElementById("board-ship");
  dom.boardState = document.getElementById("board-state");
  dom.frameTarget = document.getElementById("boarding-frame-target");
  dom.frameStatus = document.getElementById("boarding-frame-status");

  if (dom.callout) dom.callout.addEventListener("click", startBoarding);
  if (dom.boardBtn) dom.boardBtn.addEventListener("click", startBoarding);
  if (dom.returnBtn) dom.returnBtn.addEventListener("click", () => endBoarding(pendingResult));

  window.addEventListener("message", (e) => {
    const data = e.data;
    if (!data || data.type !== "vk-boarding-result" || !state.boarding.active) return;
    pendingResult = data;
    const captured = data.prize && data.prize !== "ABANDONED";
    if (dom.frameStatus) {
      dom.frameStatus.textContent = captured
        ? `Prize ${data.prize} — Grade ${data.grade} · return to combat`
        : "Boarding ended · return to combat";
    }
    if (dom.returnBtn) dom.returnBtn.textContent = captured ? "Claim Prize & Return" : "Return to Combat";
  });
}

export function boardingActive() {
  return Boolean(state.boarding && state.boarding.active);
}

function boardableEnemies() {
  return state.enemies.filter((e) => e.spawned && e.alive && hullRatio(e) <= BOARDING_HULL_THRESHOLD);
}

// Recompute callout/availability each combat frame: the callout shows whenever a
// boardable hostile exists, but boarding only enables while the player's hull is
// physically alongside one.
export function updateBoardingAvailability() {
  const b = state.boarding;
  if (b.active) return;
  const player = state.player;
  let anyBoardable = false;
  let target = null;
  let bestD = Infinity;
  for (const enemy of boardableEnemies()) {
    anyBoardable = true;
    const d = distance(player, enemy);
    if (d <= player.radius + enemy.radius + 36 && d < bestD) {
      bestD = d;
      target = enemy;
    }
  }
  b.calloutVisible = anyBoardable;
  b.available = Boolean(target);
  b.targetId = target ? target.id : null;
}

export function startBoarding() {
  const b = state.boarding;
  if (b.active || !b.available || state.screen !== "combat") return;
  const target = state.enemies.find((e) => e.id === b.targetId && e.alive);
  if (!target) return;

  b.active = true;
  b.target = target;
  pendingResult = null;
  if (dom.frameTarget) dom.frameTarget.textContent = target.name;
  if (dom.frameStatus) dom.frameStatus.textContent = "Ship-to-ship combat paused";
  if (dom.returnBtn) dom.returnBtn.textContent = "Return to Combat";
  if (dom.callout) dom.callout.classList.remove("visible");
  if (dom.frame) dom.frame.src = BOARDING_SRC; // (re)load a fresh assault
  if (dom.overlay) dom.overlay.classList.remove("hidden");
  addMessage(`Boarding party away — marines breaching ${target.name}.`);
  voicelines.say("boarding");
  sfx.alarm();
}

function endBoarding(result) {
  const b = state.boarding;
  if (!b.active) return;
  const target = b.target;
  b.active = false;
  b.target = null;
  if (dom.overlay) dom.overlay.classList.add("hidden");
  if (dom.frame) dom.frame.src = "about:blank";

  const captured = result && result.prize && result.prize !== "ABANDONED";
  if (captured && target && target.alive) {
    target.alive = false;
    target.captured = true;
    state.stats.tonnage += hullMaxTotal(target);
    if (target.type === "flagship") {
      state.stats.targetDestroyed = true;
      addMessage(`${target.name} seized by boarding action — prize ${result.prize}.`);
    } else {
      state.stats.escortsDestroyed += 1;
      addMessage(`${target.name} taken by the boarding party.`);
    }
    boardingSalvage(target);
    addRing(target.x, target.y, "#5fd17a", 0.7, target.radius, 2.4);
    addShake(10);
  } else if (target) {
    addMessage(`Boarding party withdrew from ${target.name}.`);
  }
  pendingResult = null;
}

// HUD reflection for the callout + the rack's Board Ship button.
export function updateBoardingHud() {
  const b = state.boarding;
  if (dom.callout) dom.callout.classList.toggle("visible", b.calloutVisible && !b.active);
  if (dom.boardBtn) {
    dom.boardBtn.disabled = !b.available || b.active;
    dom.boardBtn.classList.toggle("ready", b.available && !b.active);
  }
  if (dom.boardState) {
    dom.boardState.textContent = b.active
      ? "Boarding…"
      : b.available
      ? "Alongside — board"
      : b.calloutVisible
      ? "Close to board"
      : "No target";
  }
}
