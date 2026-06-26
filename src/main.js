"use strict";

import { state } from "./state.js";
import { registerScreens, showScreen } from "./router.js";
import {
  initAudio,
  startMusic,
  setMusic,
  setEngine,
  setVolume,
  getVolume,
  toggleMute,
  isMuted
} from "./audio.js";
import { loadCareer, newCampaign, hasSavedCareer } from "./career.js";
import { CONTROLS, CONTROL_GROUPS } from "./data/controls.js";
import { SECTORS } from "./data/sectors.js";
import { fullSector } from "./game/warMap.js";
import { setupMissionWorld } from "./combat/mission.js";
import { addMessage } from "./combat/effects.js";
import { update, retreatToStarbase } from "./combat/simulation.js";
import { firePlayerWeapon, slotForPrimaryAim, aimInTorpedoArc } from "./combat/weapons.js";
import { initRenderer, draw, eventToScreen, aimFromScreen } from "./combat/renderer.js";
import { initHud, updateHud } from "./ui/hud.js";
import { initStarbase, updateStarbase } from "./screens/starbase.js";
import { initEvaluation } from "./screens/evaluation.js";
import { initWarMap, renderWarMap } from "./screens/warMap.js";
import { initBriefing, renderBriefing } from "./screens/briefing.js";

const SCREEN_NAMES = ["title", "intro", "warmap", "briefing", "starbase", "combat", "evaluation", "controls", "settings", "credits"];

let pauseBanner = null;
let canvas = null;
const mouse = { left: false, right: false };

// Left mouse: fire whichever battery's arc the cursor falls within, toward the
// cursor. `explicit` is the discrete click (allowed to warn when nothing bears);
// the held-button auto-repeat stays silent and just gates on weapon cooldown.
function firePrimary(aimAngle, explicit) {
  const slot = slotForPrimaryAim(state.player, aimAngle);
  if (!slot) {
    if (explicit) addMessage("Weapons: no battery bears on that bearing.");
    return;
  }
  firePlayerWeapon(slot, aimAngle);
}

function fireTorpedo(aimAngle, explicit) {
  if (!aimInTorpedoArc(state.player, aimAngle)) {
    if (explicit) addMessage("Weapons: torpedo needs a forward firing solution.");
    return;
  }
  firePlayerWeapon("torpedo", aimAngle);
}

function combatReady() {
  return state.screen === "combat" && !state.paused && state.player && state.player.alive;
}

function startMission(sectorId) {
  state.activeSectorId = sectorId || null;
  const sector = sectorId ? fullSector(sectorId) : null;
  const mission = setupMissionWorld(sector);
  addMessage(`Operation ${mission.operationName}: ${mission.typeName} in ${mission.sectorName}.`);
  addMessage(mission.hazard);
  showScreen("briefing");
}

function launchFromBriefing() {
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
      showScreen("intro");
    },
    "menu-continue": () => {
      loadCareer();
      showScreen("warmap");
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
  document.querySelectorAll("[data-warmap]").forEach((btn) =>
    btn.addEventListener("click", () => showScreen("warmap"))
  );
  document.querySelectorAll("[data-starbase]").forEach((btn) =>
    btn.addEventListener("click", () => showScreen("starbase"))
  );

  const introBegin = document.getElementById("intro-begin");
  if (introBegin) introBegin.addEventListener("click", () => showScreen("warmap"));

  const briefLaunch = document.getElementById("brief-launch");
  if (briefLaunch) briefLaunch.addEventListener("click", launchFromBriefing);
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
  // W / S step the throttle up / down through stop → very slow → slow → moderate.
  if (event.code === "KeyW" && state.player) state.player.throttle = Math.min(3, (state.player.throttle || 0) + 1);
  if (event.code === "KeyS" && state.player) state.player.throttle = Math.max(0, (state.player.throttle || 0) - 1);
  if (event.code === "KeyR") retreatToStarbase();
}

function handleKeyUp(event) {
  state.keys[event.code] = false;
}

function bindMouse() {
  canvas.addEventListener("mousemove", (e) => {
    state.mouseScreen = eventToScreen(e);
  });
  canvas.addEventListener("mousedown", (e) => {
    if (!combatReady()) return;
    state.mouseScreen = eventToScreen(e);
    const aim = aimFromScreen(state.mouseScreen.x, state.mouseScreen.y);
    if (!aim) return;
    if (e.button === 0) {
      mouse.left = true;
      firePrimary(aim.angle, true);
    } else if (e.button === 2) {
      mouse.right = true;
      fireTorpedo(aim.angle, true);
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  // Right-click is the torpedo; suppress the context menu over the battlefield.
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

function loop(timestamp) {
  const dt = Math.min(0.04, (timestamp - state.lastTime) / 1000 || 0);
  state.lastTime = timestamp;
  update(dt);

  // Held mouse buttons auto-repeat each weapon as its cooldown clears.
  if ((mouse.left || mouse.right) && combatReady() && state.mouseScreen) {
    const aim = aimFromScreen(state.mouseScreen.x, state.mouseScreen.y);
    if (aim) {
      if (mouse.left) firePrimary(aim.angle, false);
      if (mouse.right) fireTorpedo(aim.angle, false);
    }
  }

  // Engine loop rises with the ship's speed; silent when stopped or out of combat.
  if (state.screen === "combat" && state.player && state.player.alive) {
    const p = state.player;
    const maxSpeed = (p.throttleSpeeds && p.throttleSpeeds[3]) || 130;
    setEngine(Math.hypot(p.vx, p.vy) / maxSpeed);
  } else {
    setEngine(0);
  }

  draw();
  updateHud();
  requestAnimationFrame(loop);
}

function init() {
  canvas = document.getElementById("game-canvas");
  pauseBanner = document.getElementById("pause-banner");

  initAudio();
  initRenderer(canvas);
  initHud();
  initEvaluation();
  initStarbase();
  initBriefing();

  registerScreens(SCREEN_NAMES);
  buildControlsScreen();
  setupAudioControls();
  initWarMap(startMission);
  bindMenu();

  // Music must wait for a user gesture (browser autoplay policy). Start on the
  // first interaction anywhere, then drop the listeners.
  const kickMusic = () => startMusic();
  window.addEventListener("pointerdown", kickMusic, { once: true });
  window.addEventListener("keydown", kickMusic, { once: true });

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  bindMouse();
  window.addEventListener("screen:enter", (e) => {
    const name = e.detail.name;
    if (name === "starbase") updateStarbase();
    if (name === "warmap") renderWarMap();
    if (name === "briefing") renderBriefing();
    // Music bed per screen: drone over the briefing, red alert in combat, the
    // theme everywhere else (so the menu song fades out the moment you deploy).
    setMusic(name === "briefing" ? "briefing" : name === "combat" ? "combat" : "menu");
  });

  showScreen("title");
  requestAnimationFrame(loop);
}

init();
