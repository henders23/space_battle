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
import { addMessage, addEffect } from "./effects.js";

export function getSlotAngle(angle, slot) {
  if (slot === "port") return angle - Math.PI / 2;
  if (slot === "starboard") return angle + Math.PI / 2;
  return angle;
}

export function playerWeaponDefinitions() {
  const loadout = state.career.loadout;
  const forward = forwardLoadouts[loadout.forward];
  const port = broadsideLoadouts[loadout.port];
  const starboard = broadsideLoadouts[loadout.starboard];
  const specialBoost = loadout.forward === "torpedoForward" ? 1.25 : 1;
  return {
    forward,
    port,
    starboard,
    torpedo: {
      name: "Torpedo",
      damage: Math.round(92 * specialBoost),
      cooldown: 4.8 / specialBoost,
      range: 1080,
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

export function findTargetInArc(ship, arcCenter, arcWidth, range) {
  let best = null;
  let bestDistance = Infinity;
  for (const target of state.enemies) {
    if (!target.alive) continue;
    const d = distance(ship, target);
    if (d > range + target.radius) continue;
    const diff = Math.abs(angleWrap(angleTo(ship, target) - arcCenter));
    if (diff <= arcWidth / 2 && d < bestDistance) {
      best = target;
      bestDistance = d;
    }
  }
  return best;
}

export function attemptPlayerFire(slot) {
  if (state.screen !== "combat" || state.paused || !state.player || !state.player.alive) return;

  const ship = state.player;
  const weapons = playerWeaponDefinitions();
  const weapon = weapons[slot];
  if (!weapon) return;

  if (ship.cooldowns[slot] > 0) {
    addMessage("Weapon recharging.");
    return;
  }

  const arcCenter = getSlotAngle(ship.angle, slot);
  const target = findTargetInArc(ship, arcCenter, degToRad(weapon.arc), weapon.range);
  if (!target) {
    addMessage("No firing solution.");
    return;
  }

  fireWeapon(ship, target, slot, weapon, "player");
  ship.cooldowns[slot] = weapon.cooldown * getSystemMultiplier(ship, "weapons");
  state.stats.shotsFired += weapon.shots;
  if (weapon.torpedo || slot === "torpedo") state.stats.torpedoesFired += 1;
}

export function fireWeapon(ship, target, slot, weapon, owner) {
  const baseAngle = angleTo(ship, target);
  const slotAngle = getSlotAngle(ship.angle, slot);
  const originOffset = slot === "port" ? -ship.radius * 0.55 : slot === "starboard" ? ship.radius * 0.55 : 0;
  const sideAngle = ship.angle + Math.PI / 2;
  const shotCount = weapon.shots || 1;
  const spread = degToRad(weapon.spread || 0);

  for (let i = 0; i < shotCount; i += 1) {
    const t = shotCount === 1 ? 0.5 : i / (shotCount - 1);
    const offsetAlongHull = (t - 0.5) * ship.radius * 1.35;
    const muzzleX = ship.x + Math.cos(ship.angle) * offsetAlongHull + Math.cos(sideAngle) * originOffset;
    const muzzleY = ship.y + Math.sin(ship.angle) * offsetAlongHull + Math.sin(sideAngle) * originOffset;
    const aimNoise = randomRange(-spread / 2, spread / 2);
    const direction = angleWrap(lerpAngle(baseAngle, slotAngle, owner === "enemy" ? 0.14 : 0.06) + aimNoise);
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
      trail: []
    });
  }

  if (owner === "player") addEffect(ship.x, ship.y, weapon.color, 0.22);
}

export function enemyTryFire(ship, slot, target, weapon) {
  if (!target.alive || ship.cooldowns[slot] > 0) return;
  const slotAngle = getSlotAngle(ship.angle, slot);
  const d = distance(ship, target);
  const diff = Math.abs(angleWrap(angleTo(ship, target) - slotAngle));
  if (d <= weapon.range && diff <= degToRad(weapon.arc) / 2) {
    fireWeapon(ship, target, slot, weapon, "enemy");
    ship.cooldowns[slot] = weapon.cooldown;
  }
}
