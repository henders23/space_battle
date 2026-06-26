"use strict";

// Music controller for the Valkyrie theme. Browsers block autoplay of audible
// media until the user interacts, so we hold the track ready and start it on the
// first gesture (handled by main.js). Volume + mute persist in localStorage.

const PREF_KEY = "valkyrie.audio.v1";

const audio = new Audio("assets/valkyrie-theme.mp3");
audio.loop = true;
audio.preload = "auto";

let prefs = { volume: 0.6, muted: false };
let started = false;

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

function apply() {
  audio.volume = prefs.muted ? 0 : prefs.volume;
}

export function initAudio() {
  loadPrefs();
  apply();
}

// Called on the first user gesture. Safe to call repeatedly.
export function startMusic() {
  if (started) return;
  started = true;
  apply();
  const attempt = audio.play();
  if (attempt && typeof attempt.catch === "function") {
    attempt.catch(() => {
      // Autoplay still blocked — allow a later gesture to retry.
      started = false;
    });
  }
}

export function setVolume(value) {
  prefs.volume = Math.max(0, Math.min(1, value));
  if (prefs.volume > 0) prefs.muted = false;
  apply();
  savePrefs();
}

export function getVolume() {
  return prefs.volume;
}

export function toggleMute() {
  prefs.muted = !prefs.muted;
  apply();
  savePrefs();
  return prefs.muted;
}

export function isMuted() {
  return prefs.muted;
}
