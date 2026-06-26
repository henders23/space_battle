"use strict";

import { state } from "../state.js";
import { randomRange } from "../utils.js";

const TAU = Math.PI * 2;

// Transient combat feedback: the message log, camera shake, and a small particle
// system (rings, flashes, sparks, smoke) used for muzzle flashes, weapon impacts
// and explosions.

export function addMessage(text) {
  state.messages.unshift({ text, time: performance.now() });
  state.messages = state.messages.slice(0, 8);
}

// Camera recoil / impact jolt. Magnitude in pixels, capped; the renderer applies
// and decays it each frame.
export function addShake(magnitude) {
  state.shake = Math.min(34, Math.max(state.shake || 0, magnitude));
}

function push(effect) {
  state.effects.push(effect);
}

export function addRing(x, y, color, life, size, grow = 2.6) {
  push({ kind: "ring", x, y, vx: 0, vy: 0, color, life, maxLife: life, size, grow });
}

export function addFlash(x, y, color, life, size) {
  push({ kind: "flash", x, y, vx: 0, vy: 0, color, life, maxLife: life, size });
}

export function addSpark(x, y, color, vx, vy, life) {
  push({ kind: "spark", x, y, vx, vy, color, life, maxLife: life, size: 2 });
}

export function addSmoke(x, y, life, size) {
  push({ kind: "smoke", x, y, vx: 0, vy: 0, color: "#7f8a92", life, maxLife: life, size });
}

// Backwards-compatible expanding ring (used by asteroid hits etc.).
export function addEffect(x, y, color, life) {
  addRing(x, y, color, life, randomRange(12, 26));
}

// A weapon impact: a bright flash, plus either a cyan shield ripple or hull
// sparks + smoke depending on whether shields absorbed the hit.
export function addImpact(x, y, color, shielded) {
  if (shielded) {
    addFlash(x, y, "#bff3ff", 0.16, 16);
    addRing(x, y, "#7fe9ff", 0.32, 12, 2.2);
  } else {
    addFlash(x, y, "#fff3d0", 0.16, 18);
    addRing(x, y, color, 0.26, 10, 2.4);
    for (let i = 0; i < 6; i += 1) {
      const a = Math.random() * TAU;
      const sp = randomRange(140, 360);
      addSpark(x, y, i % 2 ? "#ffd9a0" : "#ffffff", Math.cos(a) * sp, Math.sin(a) * sp, randomRange(0.18, 0.4));
    }
    addSmoke(x, y, 0.5, 9);
  }
}

// A ship dying: white flash, layered shockwave rings, debris and smoke, scaled
// by ship size.
export function addExplosion(x, y, scale = 1) {
  addFlash(x, y, "#ffffff", 0.2, 26 * scale);
  addRing(x, y, "#ffd27a", 0.5, 16 * scale, 3);
  addRing(x, y, "#ff8a40", 0.72, 24 * scale, 2.6);
  const shards = Math.round(10 * scale);
  for (let i = 0; i < shards; i += 1) {
    const a = Math.random() * TAU;
    const sp = randomRange(160, 420) * Math.min(1.6, scale);
    addSpark(x, y, i % 2 ? "#ffd27a" : "#ffe9c0", Math.cos(a) * sp, Math.sin(a) * sp, randomRange(0.4, 0.9));
  }
  const puffs = Math.round(4 * scale);
  for (let i = 0; i < puffs; i += 1) {
    addSmoke(x + randomRange(-20, 20) * scale, y + randomRange(-20, 20) * scale, randomRange(0.6, 1.1), 18 * scale);
  }
}
