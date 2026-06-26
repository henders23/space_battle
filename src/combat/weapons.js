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
import { addEffect } from "./effects.js";

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
  ship.cooldowns[slot] = weapon.cooldown * getSystemMultiplier(ship, "weapons");
  state.stats.shotsFired += weapon.shots;
  if (weapon.torpedo || slot === "torpedo") state.stats.torpedoesFired += 1;
  return true;
}

export function fireWeapon(ship, slot, weapon, owner, aimAngle) {
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
    const aim = lerpAngle(angleTo(ship, target), slotAngle, 0.12);
    fireWeapon(ship, slot, weapon, "enemy", aim);
    ship.cooldowns[slot] = weapon.cooldown;
  }
}
