"use strict";

// Player-facing configuration that lives outside any single campaign: combat
// difficulty, accessibility options, screen-shake intensity and the SFX level.
// Persisted to localStorage and applied globally (body classes, canvas palette,
// the shake scalar and the sound-effects bus).

import { PALETTE } from "./data/theme.js";
import { setLevel as setSfxLevel } from "./sfx.js";

const SETTINGS_KEY = "valkyrie.settings.v1";

export const DIFFICULTIES = {
  recruit: {
    name: "Recruit",
    blurb: "Forgiving — weaker enemies, gentler incoming fire.",
    enemyHull: 0.82,
    playerDamage: 0.7,
    reward: 0.9
  },
  standard: {
    name: "Officer",
    blurb: "The intended Helion War balance.",
    enemyHull: 1,
    playerDamage: 1,
    reward: 1
  },
  veteran: {
    name: "Veteran",
    blurb: "Punishing — tougher enemies, heavier fire, richer pay.",
    enemyHull: 1.28,
    playerDamage: 1.32,
    reward: 1.3
  }
};

// Cyan/red can be hard to separate; the colour-blind profile pushes friendly to
// a blue and enemy to a warm orange-yellow that stay distinct.
const COLOURBLIND_PALETTE = {
  accent: "#3aa0ff",
  player: "#7fc4ff",
  playerHull: "#5a7488",
  danger: "#ffb000",
  dangerSoft: "#ffc94d",
  enemy: "#ffc043",
  enemyHull: "#7a5a1f",
  flagship: "#ffd66b"
};

const defaults = {
  difficulty: "standard",
  shake: "full", // full | reduced | off
  textSize: "normal", // normal | large
  colourBlind: false,
  sfxVolume: 0.6
};

let settings = { ...defaults };

// Snapshot of the original canvas palette so colour-blind mode can be toggled
// back off without reloading.
const BASE_PALETTE = { ...PALETTE };

const SHAKE_SCALE = { full: 1, reduced: 0.45, off: 0 };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = { ...defaults, ...JSON.parse(raw) };
  } catch (err) {
    /* ignore — defaults stand */
  }
  applySettings();
}

function save() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    /* ignore */
  }
}

export function getSettings() {
  return settings;
}

export function getSetting(key) {
  return settings[key];
}

export function setSetting(key, value) {
  settings[key] = value;
  applySettings();
  save();
}

// Push every setting out to the layers that consume it.
export function applySettings() {
  // Text size scales the document root so rem-based sizing follows it.
  const root = document.documentElement;
  if (root) {
    root.classList.toggle("text-large", settings.textSize === "large");
    root.classList.toggle("colourblind", Boolean(settings.colourBlind));
  }

  // Canvas palette: swap key combat colours under colour-blind mode.
  const source = settings.colourBlind ? { ...BASE_PALETTE, ...COLOURBLIND_PALETTE } : BASE_PALETTE;
  for (const key of Object.keys(BASE_PALETTE)) PALETTE[key] = source[key];

  // SFX run on their own volume, independent of the music slider.
  setSfxLevel(settings.sfxVolume, settings.sfxVolume <= 0);
}

export function shakeScale() {
  return SHAKE_SCALE[settings.shake] ?? 1;
}

export function difficultyMods() {
  return DIFFICULTIES[settings.difficulty] || DIFFICULTIES.standard;
}
