"use strict";

import { state } from "./state.js";
import { registerScreens, showScreen } from "./router.js";
import {
  initAudio,
  startMusic,
  setVolume,
  getVolume,
  toggleMute,
  isMuted
} from "./audio.js";
import { loadCareer, newCampaign, hasSavedCareer } from "./career.js";
import { CONTROLS, CONTROL_GROUPS } from "./data/controls.js";
import { setupMissionWorld } from "./combat/mission.js";
import { addMessage } from "./combat/effects.js";
import { update, retreatToStarbase } from "./combat/simulation.js";
import { attemptPlayerFire } from "./combat/weapons.js";
import { initRenderer, draw } from "./combat/renderer.js";
import { initHud, updateHud } from "./ui/hud.js";
import { initStarbase, updateStarbase } from "./screens/starbase.js";
import { initEvaluation } from "./screens/evaluation.js";

const SCREEN_NAMES = ["title", "starbase", "combat", "evaluation", "controls", "settings", "credits"];

let pauseBanner = null;

function startMission() {
  const mission = setupMissionWorld();
  addMessage(`Operation ${mission.operationName}: assassinate ${mission.flagshipName} in ${mission.sectorName}.`);
  addMessage(mission.hazard);
  showScreen("combat");
}

function buildControlsScreen() {
  const grid = document.getElementById("controls-grid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const group of CONTROL_GROUPS) {
    const block = document.createElement("div");
    block.className = "controls-group";
    const heading = document.createElement("h3");
    heading.textContent = group;
    block.appendChild(heading);
    for (const control of CONTROLS.filter((c) => c.group === group)) {
      const row = document.createElement("div");
      row.className = "control-row";
      const keys = document.createElement("div");
      keys.className = "control-keys";
      for (const key of control.keys) {
        const kbd = document.createElement("kbd");
        kbd.textContent = key;
        keys.appendChild(kbd);
      }
      const action = document.createElement("span");
      action.className = "control-action";
      action.textContent = control.action;
      row.append(keys, action);
      block.appendChild(row);
    }
    grid.appendChild(block);
  }
}

function setupAudioControls() {
  const volume = document.getElementById("music-volume");
  const muteButtons = document.querySelectorAll("[data-mute-toggle]");

  function reflectMute() {
    const muted = isMuted();
    muteButtons.forEach((btn) => {
      btn.textContent = muted ? "♪ Music: Off" : "♪ Music: On";
      btn.classList.toggle("muted", muted);
    });
  }

  if (volume) {
    volume.value = String(Math.round(getVolume() * 100));
    volume.addEventListener("input", (e) => {
      setVolume(Number(e.target.value) / 100);
      reflectMute();
    });
  }
  muteButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      toggleMute();
      reflectMute();
    })
  );
  reflectMute();
}

function bindMenu() {
  const actions = {
    "menu-new": () => {
      newCampaign();
      showScreen("starbase");
    },
    "menu-continue": () => {
      loadCareer();
      showScreen("starbase");
    },
    "menu-controls": () => showScreen("controls"),
    "menu-settings": () => showScreen("settings"),
    "menu-credits": () => showScreen("credits")
  };
  for (const [id, handler] of Object.entries(actions)) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", handler);
  }

  // Continue is only available with an existing save.
  const cont = document.getElementById("menu-continue");
  if (cont && !hasSavedCareer()) {
    cont.classList.add("disabled");
    cont.setAttribute("aria-disabled", "true");
  }

  document.querySelectorAll("[data-back-title]").forEach((btn) =>
    btn.addEventListener("click", () => showScreen("title"))
  );

  const launch = document.getElementById("launch-mission");
  if (launch) launch.addEventListener("click", startMission);
  const cont2 = document.getElementById("continue-starbase");
  if (cont2) cont2.addEventListener("click", () => showScreen("starbase"));
}

function handleKeyDown(event) {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  state.keys[event.code] = true;

  if (event.repeat) return;
  if (event.code === "Escape" && state.screen === "combat") {
    state.paused = !state.paused;
    if (pauseBanner) pauseBanner.classList.toggle("hidden", !state.paused);
    return;
  }
  if (state.screen !== "combat") return;
  if (event.code === "Space") attemptPlayerFire("forward");
  if (event.code === "KeyQ") attemptPlayerFire("port");
  if (event.code === "KeyE") attemptPlayerFire("starboard");
  if (event.code === "KeyF") attemptPlayerFire("torpedo");
  if (event.code === "KeyR") retreatToStarbase();
}

function handleKeyUp(event) {
  state.keys[event.code] = false;
}

function loop(timestamp) {
  const dt = Math.min(0.04, (timestamp - state.lastTime) / 1000 || 0);
  state.lastTime = timestamp;
  update(dt);
  draw();
  updateHud();
  requestAnimationFrame(loop);
}

function init() {
  const canvas = document.getElementById("game-canvas");
  pauseBanner = document.getElementById("pause-banner");

  initAudio();
  initRenderer(canvas);
  initHud();
  initEvaluation();
  initStarbase();

  registerScreens(SCREEN_NAMES);
  buildControlsScreen();
  setupAudioControls();
  bindMenu();

  // Music must wait for a user gesture (browser autoplay policy). Start on the
  // first interaction anywhere, then drop the listeners.
  const kickMusic = () => startMusic();
  window.addEventListener("pointerdown", kickMusic, { once: true });
  window.addEventListener("keydown", kickMusic, { once: true });

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("screen:enter", (e) => {
    if (e.detail.name === "starbase") updateStarbase();
  });

  showScreen("title");
  requestAnimationFrame(loop);
}

init();
