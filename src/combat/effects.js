"use strict";

import { state } from "../state.js";
import { randomRange } from "../utils.js";

// Transient combat feedback: the message log and visual hit/explosion rings.

export function addMessage(text) {
  state.messages.unshift({ text, time: performance.now() });
  state.messages = state.messages.slice(0, 8);
}

export function addEffect(x, y, color, life) {
  state.effects.push({ x, y, color, life, maxLife: life, radius: randomRange(12, 28) });
}
