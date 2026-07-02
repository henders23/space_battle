"use strict";

import { state } from "../state.js";
import { distance, pick, randomRange } from "../utils.js";
import { forwardLoadouts, broadsideLoadouts, utilityLoadouts } from "../data/loadouts.js";
import { isOwned } from "../career.js";
import { addMessage, addRing, addFlash } from "./effects.js";
import * as sfx from "../sfx.js";

// Salvage: destroyed hostiles sometimes eject a recoverable cache the player
// can fly over — credits, or (rarely) an intact weapon/module the armory
// doesn't hold yet. Boarding captures strip the prize directly for a richer
// haul. Everything recovered is tallied on state.stats and paid out in the
// after-action review.

const PICKUP_RANGE = 34; // beyond the hull radius
const CACHE_LIFE = 55; // seconds adrift before the cache is lost

// Per-class drop chance and credit band — bigger hulls shed richer wreckage.
const DROP_TABLE = {
  raider: { chance: 0.25, credits: [30, 60], moduleChance: 0.05 },
  escort: { chance: 0.4, credits: [50, 95], moduleChance: 0.07 },
  frigate: { chance: 0.5, credits: [85, 145], moduleChance: 0.1 },
  missile_boat: { chance: 0.4, credits: [65, 115], moduleChance: 0.08 },
  cruiser: { chance: 0.65, credits: [125, 210], moduleChance: 0.18 },
  flagship: { chance: 1, credits: [230, 380], moduleChance: 0.3 }
};

const MODULE_CATEGORIES = [
  { category: "forward", map: forwardLoadouts },
  { category: "broadside", map: broadsideLoadouts },
  { category: "utility", map: utilityLoadouts }
];

// Armory items the captain doesn't own yet (and hasn't already recovered this
// mission) — the pool a module drop rolls from.
function unownedModules() {
  const pending = new Set((state.stats.salvageModules || []).map((m) => `${m.category}:${m.key}`));
  const pool = [];
  for (const { category, map } of MODULE_CATEGORIES) {
    for (const [key, item] of Object.entries(map)) {
      if (!isOwned(category, key) && !pending.has(`${category}:${key}`)) {
        pool.push({ category, key, name: item.name });
      }
    }
  }
  return pool;
}

function rollContents(entry, moduleBoost = 1) {
  const pool = unownedModules();
  if (pool.length && Math.random() < entry.moduleChance * moduleBoost) {
    return { module: pick(pool), credits: 0 };
  }
  return { module: null, credits: Math.round(randomRange(entry.credits[0], entry.credits[1])) };
}

// A kill may shed a drifting cache at the wreck site.
export function dropSalvageFrom(enemy) {
  const entry = DROP_TABLE[enemy.type];
  if (!entry || Math.random() > entry.chance) return;
  const contents = rollContents(entry);
  state.salvage.push({
    x: enemy.x + randomRange(-14, 14),
    y: enemy.y + randomRange(-14, 14),
    vx: randomRange(-14, 14),
    vy: randomRange(-14, 14),
    ...contents,
    life: CACHE_LIFE,
    maxLife: CACHE_LIFE
  });
  addMessage(`Sensors: salvageable wreckage adrift where ${enemy.name} broke up.`);
}

// A boarding capture strips the prize on the spot — no cache to chase, and a
// far better chance the marines carry back intact hardware.
export function boardingSalvage(target) {
  const entry = DROP_TABLE[target.type] || DROP_TABLE.escort;
  const contents = rollContents(entry, 2.2);
  const credits = contents.module ? Math.round(randomRange(entry.credits[0], entry.credits[1]) * 0.8) : Math.round(contents.credits * 1.7);
  collect({ module: contents.module, credits }, `stripped from ${target.name}`);
}

function collect(cache, how) {
  if (cache.credits > 0) {
    state.stats.salvageCredits += cache.credits;
    addMessage(`Salvage secured — ${cache.credits} cr ${how}.`);
  }
  if (cache.module) {
    state.stats.salvageModules.push(cache.module);
    addMessage(`Salvage secured — intact ${cache.module.name} ${how}!`);
  }
  sfx.uiBeep("confirm");
}

// Drift, expire, and pick up caches the player's hull passes over.
export function updateSalvage(dt) {
  const player = state.player;
  for (const cache of state.salvage) {
    cache.life -= dt;
    cache.x += cache.vx * dt;
    cache.y += cache.vy * dt;
    cache.vx *= Math.pow(0.98, dt * 60);
    cache.vy *= Math.pow(0.98, dt * 60);
    if (cache.life <= 0) continue;
    if (player && player.alive && distance(cache, player) <= player.radius + PICKUP_RANGE) {
      cache.life = 0;
      collect(cache, "from the wreckage");
      addRing(cache.x, cache.y, cache.module ? "#45e0f0" : "#f0a93d", 0.5, 14, 2.6);
      addFlash(cache.x, cache.y, "#fff3d0", 0.14, 16);
    }
  }
  state.salvage = state.salvage.filter((cache) => cache.life > 0);
}
