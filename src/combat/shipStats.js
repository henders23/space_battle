"use strict";

import { angleTo, angleWrap, clamp } from "../utils.js";

// All ships carry independent port/starboard shield and hull facings. These
// helpers aggregate the two sides and decide which facing an impact strikes,
// so the rest of the combat code can stay agnostic to the split.

export function hullTotal(ship) {
  return ship.hull.port + ship.hull.starboard;
}

// A ship is lost the moment either flank's hull is breached — so exposing a
// wounded side is lethal, not just costly.
export function isDestroyed(ship) {
  return ship.hull.port <= 0 || ship.hull.starboard <= 0;
}

export function hullMaxTotal(ship) {
  return ship.hullMax.port + ship.hullMax.starboard;
}

export function hullRatio(ship) {
  return clamp(hullTotal(ship) / hullMaxTotal(ship), 0, 1);
}

export function shieldTotal(ship) {
  return ship.shields.port + ship.shields.starboard;
}

export function shieldMaxTotal(ship) {
  return ship.shieldsMax.port + ship.shieldsMax.starboard;
}

export function shieldRatio(ship) {
  const max = shieldMaxTotal(ship);
  return max > 0 ? clamp(shieldTotal(ship) / max, 0, 1) : 0;
}

export function sideRatioShield(ship, side) {
  const max = ship.shieldsMax[side];
  return max > 0 ? clamp(ship.shields[side] / max, 0, 1) : 0;
}

export function sideRatioHull(ship, side) {
  const max = ship.hullMax[side];
  return max > 0 ? clamp(ship.hull[side] / max, 0, 1) : 0;
}

// Which facing (port = left, starboard = right) is presented toward `point`,
// based on the impact's bearing relative to the ship's heading.
export function impactSide(ship, point) {
  return Math.sin(angleWrap(angleTo(ship, point) - ship.angle)) >= 0 ? "starboard" : "port";
}
