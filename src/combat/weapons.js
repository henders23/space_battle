"use strict";

import { state } from "../state.js";
import { forwardLoadouts, broadsideLoadouts } from "../data/loadouts.js";
import { getSystemMultiplier } from "./systems.js";
import {
  angleTo,
  angleWrap,
  degToRad,
  distance,
  lerpAngle,
  randomRange
} from "../utils.js";
import { addFlash, addShake } from "./effects.js";
import { projectileSpriteFor } from "./sprites.js";
import * as sfx from "../sfx.js";

export function getSlotAngle(angle, slot) {
  if (slot === "port") return angle - Math.PI / 2;
  if (slot === "starboard") return angle + Math.PI / 2;
  return angle;
}

export function playerWeaponDefinitions() {
  const loadout = state.career.loadout;
  // Hull class scales firepower: the battleship hits harder but reloads slower.
  const dmgMod = (state.player && state.player.weaponDamage) || 1;
  const cdMod = (state.player && state.player.weaponCooldown) || 1;
  const tune = (def, broadside) => ({
    ...def,
    damage: Math.round(def.damage * (broadside ? dmgMod : 1)),
    cooldown: def.cooldown * cdMod
  });
  const specialBoost = loadout.forward === "torpedoForward" ? 1.25 : 1;
  return {
    forward: tune(forwardLoadouts[loadout.forward], false),
    port: tune(broadsideLoadouts[loadout.port], true),
    starboard: tune(broadsideLoadouts[loadout.starboard], true),
    torpedo: {
      name: "Torpedo",
      damage: Math.round(92 * specialBoost * dmgMod),
      cooldown: (4.8 / specialBoost) * cdMod,
      range: 760,
      arc: 18,
      speed: 390,
      spread: 0,
      shots: 1,
      size: 6,
      color: "#ff735f",
      torpedo: true
    }
  };
}

// Which battery's arc contains the given world bearing (port and starboard are
// checked before the narrower forward cone). Returns null if nothing bears.
export function slotForPrimaryAim(ship, aimAngle) {
  const weapons = playerWeaponDefinitions();
  for (const slot of ["port", "starboard", "forward"]) {
    const center = getSlotAngle(ship.angle, slot);
    if (Math.abs(angleWrap(aimAngle - center)) <= degToRad(weapons[slot].arc) / 2) return slot;
  }
  return null;
}

export function aimInTorpedoArc(ship, aimAngle) {
  const weapon = playerWeaponDefinitions().torpedo;
  const center = getSlotAngle(ship.angle, "forward");
  return Math.abs(angleWrap(aimAngle - center)) <= degToRad(weapon.arc) / 2;
}

// Fire `slot` toward an explicit world bearing. Returns true if a volley left
// the tubes (used by the mouse hold-to-fire loop, which gates on cooldown).
export function firePlayerWeapon(slot, aimAngle) {
  const ship = state.player;
  if (state.screen !== "combat" || state.paused || !ship || !ship.alive) return false;
  const weapon = playerWeaponDefinitions()[slot];
  if (!weapon || ship.cooldowns[slot] > 0) return false;

  fireWeapon(ship, slot, weapon, "player", aimAngle);
  const cd = weapon.cooldown * getSystemMultiplier(ship, "weapons");
  ship.cooldowns[slot] = cd;
  ship.cooldownMax = ship.cooldownMax || {};
  ship.cooldownMax[slot] = cd;
  state.stats.shotsFired += weapon.shots;
  if (weapon.torpedo || slot === "torpedo") state.stats.torpedoesFired += 1;
  // Recoil — heavy batteries kick the camera.
  addShake(weapon.torpedo ? 6 : weapon.shots >= 5 ? 7 : 3.5);
  const kind =
    weapon.torpedo || slot === "torpedo"
      ? "torpedo"
      : slot === "port" || slot === "starboard"
      ? "broadside"
      : weapon.damage >= 28
      ? "heavy"
      : "light";
  sfx.gunFire(kind);
  return true;
}

export function fireWeapon(ship, slot, weapon, owner, aimAngle) {
  const originOffset = slot === "port" ? -ship.radius * 0.55 : slot === "starboard" ? ship.radius * 0.55 : 0;
  const sideAngle = ship.angle + Math.PI / 2;
  const shotCount = weapon.shots || 1;
  const spread = degToRad(weapon.spread || 0);
  const sprite = projectileSpriteFor(owner, slot, weapon);

  for (let i = 0; i < shotCount; i += 1) {
    const t = shotCount === 1 ? 0.5 : i / (shotCount - 1);
    const offsetAlongHull = (t - 0.5) * ship.radius * 1.35;
    const muzzleX = ship.x + Math.cos(ship.angle) * offsetAlongHull + Math.cos(sideAngle) * originOffset;
    const muzzleY = ship.y + Math.sin(ship.angle) * offsetAlongHull + Math.sin(sideAngle) * originOffset;
    const aimNoise = randomRange(-spread / 2, spread / 2);
    const direction = angleWrap(aimAngle + aimNoise);
    state.projectiles.push({
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(direction) * weapon.speed,
      vy: Math.sin(direction) * weapon.speed,
      damage: weapon.damage,
      owner,
      radius: weapon.size || 3,
      life: weapon.range / weapon.speed,
      color: weapon.color,
      torpedo: Boolean(weapon.torpedo),
      sprite,
      trail: []
    });
  }

  if (owner === "player") {
    // Muzzle flash at the firing battery.
    const dir = getSlotAngle(ship.angle, slot === "torpedo" ? "forward" : slot);
    addFlash(ship.x + Math.cos(dir) * ship.radius * 0.95, ship.y + Math.sin(dir) * ship.radius * 0.95, weapon.color, 0.12, 14);
  }
}

// Best bearing for a battery fired by key: the nearest live hostile inside the
// battery's arc (clamped to the arc edge), or the arc centre if nothing bears.
export function autoAimAngle(ship, slot) {
  const weapons = playerWeaponDefinitions();
  const weapon = weapons[slot];
  const center = getSlotAngle(ship.angle, slot);
  const halfArc = degToRad(weapon.arc) / 2;
  let best = null;
  let bestD = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.spawned || !enemy.alive) continue;
    const d = distance(ship, enemy);
    if (d > weapon.range * 1.15) continue;
    const off = angleWrap(angleTo(ship, enemy) - center);
    if (Math.abs(off) > halfArc) continue;
    if (d < bestD) {
      bestD = d;
      best = enemy;
    }
  }
  if (!best) return center;
  const off = angleWrap(angleTo(ship, best) - center);
  return center + Math.max(-halfArc, Math.min(halfArc, off));
}

// Fire a battery from a keypress / rack button: auto-aimed, gated on cooldown.
export function fireBatteryKey(slot) {
  const ship = state.player;
  if (!ship || !ship.alive) return false;
  if (ship.cooldowns[slot] > 0) return false;
  return firePlayerWeapon(slot, autoAimAngle(ship, slot));
}

export function enemyTryFire(ship, slot, target, weapon) {
  if (!target.alive || ship.cooldowns[slot] > 0) return;
  const slotAngle = getSlotAngle(ship.angle, slot);
  const d = distance(ship, target);
  const diff = Math.abs(angleWrap(angleTo(ship, target) - slotAngle));
  if (d <= weapon.range && diff <= degToRad(weapon.arc) / 2) {
    const aim = lerpAngle(angleTo(ship, target), slotAngle, 0.12);
    fireWeapon(ship, slot, weapon, "enemy", aim);
    ship.cooldowns[slot] = weapon.cooldown;
  }
}
