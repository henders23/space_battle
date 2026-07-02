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
import { loadSettings, getSettings, getSetting, setSetting, DIFFICULTIES } from "./settings.js";
import { uiBeep } from "./sfx.js";
import { CONTROLS, CONTROL_GROUPS } from "./data/controls.js";
import { SECTORS } from "./data/sectors.js";
import { fullSector } from "./game/warMap.js";
import { operationForDeployment } from "./game/operations.js";
import { setupMissionWorld } from "./combat/mission.js";
import { addMessage } from "./combat/effects.js";
import { update, retreatToStarbase } from "./combat/simulation.js";
import { firePlayerWeapon, slotForPrimaryAim, aimInTorpedoArc, fireBatteryKey } from "./combat/weapons.js";
import { initBoarding, startBoarding, boardingActive } from "./combat/boarding.js";
import { initRenderer, draw, eventToScreen, aimFromScreen } from "./combat/renderer.js";
import { initHud, updateHud } from "./ui/hud.js";
import { initStarbase, updateStarbase } from "./screens/starbase.js";
import { initEvaluation } from "./screens/evaluation.js";
import { initWarMap, renderWarMap } from "./screens/warMap.js";
import { initBriefing, renderBriefing } from "./screens/briefing.js";
import { initIntel, renderIntel } from "./screens/intel.js";
import { initService, renderService } from "./screens/service.js";
import { initLog, renderLog } from "./screens/log.js";

const SCREEN_NAMES = ["title", "setup", "intro", "warmap", "briefing", "starbase", "combat", "evaluation", "intel", "service", "log", "controls", "settings", "credits"];

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
  return state.screen === "combat" && !state.paused && !boardingActive() && state.player && state.player.alive;
}

// Map the prototype's firing keys to the four batteries (auto-aimed within arc).
const KEY_BATTERY = { Space: "forward", KeyQ: "port", KeyE: "starboard", KeyF: "torpedo" };

function startMission(sectorId) {
  state.activeSectorId = sectorId || null;
  const sector = sectorId ? fullSector(sectorId) : null;
  const opContext = operationForDeployment(sector);
  const mission = setupMissionWorld(sector, opContext);
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

// Difficulty / shake / accessibility / SFX. Segmented controls write straight to
// the persisted settings; difficulty options are generated from the data table.
function setupSettingsControls() {
  const diffWrap = document.getElementById("set-difficulty");
  if (diffWrap) {
    diffWrap.innerHTML = "";
    for (const [key, def] of Object.entries(DIFFICULTIES)) {
      const b = document.createElement("button");
      b.dataset.value = key;
      b.textContent = def.name;
      diffWrap.appendChild(b);
    }
  }

  const parseValue = (raw) => (raw === "true" ? true : raw === "false" ? false : raw);

  document.querySelectorAll(".seg-control").forEach((group) => {
    const setting = group.dataset.setting;
    group.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        setSetting(setting, parseValue(btn.dataset.value));
        reflectSettings();
      });
    });
  });

  const sfx = document.getElementById("sfx-volume");
  if (sfx) {
    sfx.addEventListener("input", (e) => setSetting("sfxVolume", Number(e.target.value) / 100));
  }

  reflectSettings();
}

function reflectSettings() {
  const settings = getSettings();
  document.querySelectorAll(".seg-control").forEach((group) => {
    const value = settings[group.dataset.setting];
    group.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.value === String(value));
    });
  });
  const sfx = document.getElementById("sfx-volume");
  if (sfx) sfx.value = String(Math.round((settings.sfxVolume || 0) * 100));
  const blurb = document.getElementById("difficulty-blurb");
  if (blurb) blurb.textContent = (DIFFICULTIES[settings.difficulty] || {}).blurb || "";
}

function bindMenu() {
  const actions = {
    // A new campaign opens on the surprise attack that kills the Resolute's
    // captain; the field-commission (name + difficulty) follows it.
    "menu-new": () => showScreen("intro"),
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
  document.querySelectorAll("[data-intel]").forEach((btn) =>
    btn.addEventListener("click", () => showScreen("intel"))
  );
  document.querySelectorAll("[data-service]").forEach((btn) =>
    btn.addEventListener("click", () => showScreen("service"))
  );
  document.querySelectorAll("[data-log]").forEach((btn) =>
    btn.addEventListener("click", () => showScreen("log"))
  );

  const introBegin = document.getElementById("intro-begin");
  if (introBegin) introBegin.addEventListener("click", () => showScreen("setup"));

  const briefLaunch = document.getElementById("brief-launch");
  if (briefLaunch) briefLaunch.addEventListener("click", launchFromBriefing);

  // Soft interface blip on any button press (silent until audio is unlocked).
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn && !btn.disabled) uiBeep(btn.classList.contains("primary") ? "confirm" : "select");
  });
}

// Campaign setup: captain name + difficulty, then into the intro.
function buildSetupScreen() {
  const diffWrap = document.getElementById("setup-difficulty");
  const nameInput = document.getElementById("setup-name");
  const begin = document.getElementById("setup-begin");
  if (!diffWrap || !begin) return;

  diffWrap.innerHTML = "";
  for (const [key, def] of Object.entries(DIFFICULTIES)) {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "setup-diff";
    opt.dataset.value = key;
    opt.innerHTML = `<b>${def.name}</b><span class="mono">${def.blurb}</span>`;
    opt.addEventListener("click", () => {
      setSetting("difficulty", key);
      reflectSetupDifficulty();
    });
    diffWrap.appendChild(opt);
  }
  reflectSetupDifficulty();

  begin.addEventListener("click", () => {
    const name = (nameInput && nameInput.value.trim()) || "Halden";
    newCampaign(name);
    showScreen("warmap");
  });
}

function reflectSetupDifficulty() {
  const current = getSetting("difficulty");
  document.querySelectorAll("#setup-difficulty .setup-diff").forEach((b) => {
    b.classList.toggle("active", b.dataset.value === current);
  });
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
  // B launches a boarding action when alongside a crippled hostile.
  if (event.code === "KeyB" && state.boarding && state.boarding.available) startBoarding();
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

  // Held firing keys (Space / Q / E / F) auto-repeat each battery on its charge.
  if (combatReady()) {
    for (const [code, slot] of Object.entries(KEY_BATTERY)) {
      if (state.keys[code]) fireBatteryKey(slot);
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
  loadSettings();
  initRenderer(canvas);
  initHud();
  initBoarding();
  initEvaluation();
  initStarbase();
  initBriefing();
  initIntel();
  initService();
  initLog();

  registerScreens(SCREEN_NAMES);
  buildControlsScreen();
  buildSetupScreen();
  setupAudioControls();
  setupSettingsControls();
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
  // Clicking a rack battery fires it auto-aimed, mirroring its hotkey.
  document.querySelectorAll(".weapon-rack [data-fire]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (combatReady()) fireBatteryKey(btn.dataset.fire);
    })
  );
  window.addEventListener("screen:enter", (e) => {
    const name = e.detail.name;
    if (name === "starbase") updateStarbase();
    if (name === "warmap") renderWarMap();
    if (name === "briefing") renderBriefing();
    if (name === "intel") renderIntel();
    if (name === "service") renderService();
    if (name === "log") renderLog();
    if (name === "settings") reflectSettings();
    if (name === "setup") reflectSetupDifficulty();
    // Music bed per screen: drone over the briefing, red alert in combat, the
    // theme everywhere else (so the menu song fades out the moment you deploy).
    setMusic(name === "briefing" ? "briefing" : name === "combat" ? "combat" : "menu");
  });

  // Lightweight debug handle (single-player browser game; no security surface).
  window.__vk = { state };

  showScreen("title");
  requestAnimationFrame(loop);
}

init();
