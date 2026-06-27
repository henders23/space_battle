"use strict";

// Audio manager. Three music beds — menu, briefing and combat — crossfade as the
// player moves between screens, and an engine loop rises and falls with the
// ship's speed. Browsers block audible playback until the first user gesture, so
// nothing actually sounds until startMusic() is called from that gesture.

import { unlockSfx } from "./sfx.js";

const PREF_KEY = "valkyrie.audio.v1";
const ENGINE_MAX = 0.6;

const music = {
  menu: new Audio("assets/valkyrie-theme.mp3"),
  briefing: new Audio("assets/drone.mp3"),
  combat: new Audio("assets/red-alert.mp3")
};
const engine = new Audio("assets/engine.mp3");

for (const track of Object.values(music)) {
  track.loop = true;
  track.preload = "auto";
  track.volume = 0;
}
engine.loop = true;
engine.preload = "auto";
engine.volume = 0;

let prefs = { volume: 0.6, muted: false };
let started = false;
let desired = "menu"; // which bed should be playing
const fades = new Map(); // track element -> animation frame id

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
  } catch (err) {
    /* ignore */
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch (err) {
    /* ignore */
  }
}

function targetVolume() {
  return prefs.muted ? 0 : prefs.volume;
}

// Smoothly ramp a track to a target volume; play on the way up, pause at zero.
function fadeTo(track, target, ms) {
  if (fades.has(track)) cancelAnimationFrame(fades.get(track));
  const from = track.volume;
  const start = performance.now();
  if (target > 0 && track.paused) track.play().catch(() => {});
  const step = (now) => {
    const t = ms <= 0 ? 1 : clamp01((now - start) / ms);
    track.volume = clamp01(from + (target - from) * t);
    if (t < 1) {
      fades.set(track, requestAnimationFrame(step));
    } else {
      fades.delete(track);
      if (target <= 0.001) track.pause();
    }
  };
  fades.set(track, requestAnimationFrame(step));
}

function applyMusic(ms = 800) {
  for (const [name, track] of Object.entries(music)) {
    fadeTo(track, name === desired ? targetVolume() : 0, ms);
  }
}

export function initAudio() {
  loadPrefs();
}

// Called from the first user gesture; begins the currently-desired bed and the
// (silent) engine loop so later volume changes don't need another gesture.
export function startMusic() {
  if (started) return;
  started = true;
  unlockSfx();
  applyMusic(400);
  engine.play().catch(() => {
    started = false;
  });
}

// Choose which music bed should play (crossfades when already started).
export function setMusic(name) {
  if (!music[name]) name = "menu";
  desired = name;
  if (started) applyMusic();
}

// Engine loudness tracks the ship's speed ratio (0 = stopped → silent).
export function setEngine(ratio) {
  if (!started) return;
  const vol = prefs.muted ? 0 : prefs.volume * clamp01(ratio) * ENGINE_MAX;
  engine.volume = vol;
  if (vol > 0.001 && engine.paused) engine.play().catch(() => {});
}

export function setVolume(value) {
  prefs.volume = clamp01(value);
  if (prefs.volume > 0) prefs.muted = false;
  if (started) applyMusic(150);
  savePrefs();
}

export function getVolume() {
  return prefs.volume;
}

export function toggleMute() {
  prefs.muted = !prefs.muted;
  if (started) applyMusic(150);
  if (prefs.muted) engine.volume = 0;
  savePrefs();
  return prefs.muted;
}

export function isMuted() {
  return prefs.muted;
}
