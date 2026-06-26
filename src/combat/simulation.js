"use strict";

import { state, WORLD, SYSTEM_NAMES, SYSTEM_STATES } from "../state.js";
import {
  angleTo,
  angleWrap,
  clamp,
  distance,
  pick,
  turnToward
} from "../utils.js";
import { getSystemMultiplier } from "./systems.js";
import { enemyTryFire } from "./weapons.js";
import { addMessage, addEffect, addShake } from "./effects.js";
import { hullTotal, hullMaxTotal, impactSide, isDestroyed } from "./shipStats.js";
import { finishMission } from "../screens/evaluation.js";

// Per-frame world simulation: movement, enemy AI, projectiles, damage, timer.

export function update(dt) {
  if (state.screen !== "combat" || state.paused || !state.player) return;
  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateAsteroids(dt);
  updateEffects(dt);
  updateMissionTimer(dt);
}

// Throttle notches: stop, very slow, slow, moderate (engine bonus scales them).
const THROTTLE_SPEEDS = [0, 30, 70, 130];

function updatePlayer(dt) {
  const ship = state.player;
  const engineMult = getSystemMultiplier(ship, "engines") + ship.engineBonus;
  const turn = 0.55 * engineMult;
  const forwardX = Math.cos(ship.angle);
  const forwardY = Math.sin(ship.angle);

  if (state.keys.KeyA) ship.angle -= turn * dt;
  if (state.keys.KeyD) ship.angle += turn * dt;

  // The engines drive the ship toward the selected throttle speed along its
  // heading. Forward speed eases toward the target; any sideways momentum from
  // turning bleeds off via strong inertia damping, so the ship tracks its nose.
  const targetSpeed = THROTTLE_SPEEDS[ship.throttle || 0] * engineMult;
  let along = ship.vx * forwardX + ship.vy * forwardY;
  let latX = ship.vx - along * forwardX;
  let latY = ship.vy - along * forwardY;

  const accelRate = 55 * engineMult; // change in speed per second — heavy
  along += clamp(targetSpeed - along, -accelRate * dt, accelRate * dt);

  const latDamp = Math.pow(0.86, dt * 60); // inertia damping on drift
  latX *= latDamp;
  latY *= latDamp;

  ship.vx = along * forwardX + latX;
  ship.vy = along * forwardY + latY;
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  enforceBoundary(ship);
  handleAsteroidImpacts(ship, dt);
  updateShipRecovery(ship, dt);
  updateCooldowns(ship.cooldowns, dt);

  if (state.career.loadout.utility === "repairDrones") {
    ship.repairPulse += dt;
    if (ship.repairPulse >= 1.5 && hullTotal(ship) > 0) {
      ship.repairPulse = 0;
      for (const side of ["port", "starboard"]) {
        ship.hull[side] = Math.min(ship.hullMax[side] * 0.72, ship.hull[side] + 2);
      }
    }
  }
}

function enforceBoundary(ship) {
  let warned = false;
  if (ship.x < ship.radius) {
    ship.x = ship.radius;
    ship.vx = Math.max(0, ship.vx) * 0.35;
    warned = ship.type === "player";
  }
  if (ship.x > WORLD.width - ship.radius) {
    ship.x = WORLD.width - ship.radius;
    ship.vx = Math.min(0, ship.vx) * 0.35;
    warned = ship.type === "player";
  }
  if (ship.y < ship.radius) {
    ship.y = ship.radius;
    ship.vy = Math.max(0, ship.vy) * 0.35;
    warned = ship.type === "player";
  }
  if (ship.y > WORLD.height - ship.radius) {
    ship.y = WORLD.height - ship.radius;
    ship.vy = Math.min(0, ship.vy) * 0.35;
    warned = ship.type === "player";
  }
  if (warned && Math.random() < 0.03) addMessage("Helm: nearing sector boundary.");
}

function handleAsteroidImpacts(ship, dt) {
  for (const asteroid of state.asteroids) {
    const d = distance(ship, asteroid);
    const minDistance = ship.radius + asteroid.radius;
    if (d < minDistance) {
      const pushX = (ship.x - asteroid.x) / Math.max(1, d);
      const pushY = (ship.y - asteroid.y) / Math.max(1, d);
      ship.x = asteroid.x + pushX * minDistance;
      ship.y = asteroid.y + pushY * minDistance;
      ship.vx += pushX * 55 * dt;
      ship.vy += pushY * 55 * dt;
      ship.vx *= 0.88;
      ship.vy *= 0.88;
      if (ship.type === "player" && Math.hypot(ship.vx, ship.vy) > 55 && Math.random() < 0.05) {
        applyDamage(ship, 8, "asteroid", impactSide(ship, asteroid));
        addMessage("Asteroid impact across the hull.");
        if (isDestroyed(ship)) {
          ship.alive = false;
          state.stats.survived = false;
          finishMission("failed", "CWS Resolute was lost to a collision.");
        }
      }
    }
  }
}

function updateShipRecovery(ship, dt) {
  const regen = ship.shieldRegen * getSystemMultiplier(ship, "shields");
  for (const side of ["port", "starboard"]) {
    if (ship.shieldDelay[side] > 0) {
      ship.shieldDelay[side] -= dt;
    } else if (ship.shields[side] < ship.shieldsMax[side]) {
      ship.shields[side] = Math.min(ship.shieldsMax[side], ship.shields[side] + regen * dt);
    }
  }
}

function updateCooldowns(cooldowns, dt) {
  Object.keys(cooldowns).forEach((key) => {
    cooldowns[key] = Math.max(0, cooldowns[key] - dt);
  });
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    if (enemy.type === "flagship") updateFlagship(enemy, dt);
    if (enemy.type === "escort") updateEscort(enemy, dt);
    updateShipRecovery(enemy, dt);
    updateCooldowns(enemy.cooldowns, dt);
    enforceBoundary(enemy);
  }
}

function limitVelocity(ship, maxSpeed) {
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > maxSpeed) {
    ship.vx = (ship.vx / speed) * maxSpeed;
    ship.vy = (ship.vy / speed) * maxSpeed;
  }
}

function updateFlagship(ship, dt) {
  const player = state.player;
  const toPlayer = angleTo(ship, player);
  const d = distance(ship, player);
  const badlyDamaged = ship.hull < ship.hullMax * 0.28;
  ship.escaping = badlyDamaged || state.mission.timer < 28;

  let desiredAngle;
  let thrust = 0;
  if (ship.escaping) {
    // Run directly away from the player rather than toward a fixed heading, so a
    // damaged flagship doesn't end up pinned against the boundary.
    desiredAngle = angleTo(player, ship);
    thrust = 68;
  } else {
    const broadsideSide = Math.sin(angleWrap(toPlayer - ship.angle)) > 0 ? Math.PI / 2 : -Math.PI / 2;
    desiredAngle = toPlayer - broadsideSide;
    if (d > 660) thrust = 58;
    if (d < 390) thrust = -36;
  }

  ship.angle = turnToward(ship.angle, desiredAngle, 0.44 * dt);
  ship.vx += Math.cos(ship.angle) * thrust * dt;
  ship.vy += Math.sin(ship.angle) * thrust * dt;
  limitVelocity(ship, 125);
  ship.vx *= Math.pow(0.994, dt * 60);
  ship.vy *= Math.pow(0.994, dt * 60);
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  // A damaged flagship fires a weaker, slower broadside.
  const dmgScale = state.mission.damaged ? 0.55 : 1;
  const broadside = {
    damage: Math.round(23 * dmgScale),
    cooldown: state.mission.damaged ? 1.9 : 1.35,
    range: 500,
    arc: 70,
    speed: 520,
    spread: 12,
    shots: 6,
    size: 4,
    color: "#ff9377"
  };
  enemyTryFire(ship, "port", player, { name: "Flagship Port Battery", ...broadside });
  enemyTryFire(ship, "starboard", player, { name: "Flagship Starboard Battery", ...broadside });
  enemyTryFire(ship, "forward", player, {
    name: "Flagship Bow Guns",
    damage: Math.round(16 * dmgScale),
    cooldown: 1.1,
    range: 440,
    arc: 28,
    speed: 590,
    spread: 4,
    shots: 2,
    size: 3,
    color: "#ffb18f"
  });
}

function updateEscort(ship, dt) {
  const player = state.player;
  const flagship = state.enemies.find((enemy) => enemy.type === "flagship" && enemy.alive);
  const playerDistance = distance(ship, player);
  let desired = angleTo(ship, player);
  let thrust = 34;

  if (flagship && playerDistance > 1120) {
    const orbit = (performance.now() / 1000) * 0.32 + ship.escortIndex * 2.35;
    const guardPoint = {
      x: flagship.x + Math.cos(orbit) * 245,
      y: flagship.y + Math.sin(orbit) * 245
    };
    const guardDistance = distance(ship, guardPoint);
    desired = angleTo(ship, guardPoint);
    thrust = guardDistance > 110 ? 116 : 18;
  } else {
    thrust = playerDistance > 310 ? 138 : playerDistance < 185 ? -70 : 34;
  }

  ship.angle = turnToward(ship.angle, desired, 1.15 * dt);
  ship.vx += Math.cos(ship.angle) * thrust * dt;
  ship.vy += Math.sin(ship.angle) * thrust * dt;
  limitVelocity(ship, 255);
  ship.vx *= Math.pow(0.989, dt * 60);
  ship.vy *= Math.pow(0.989, dt * 60);
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  enemyTryFire(ship, "forward", player, {
    name: "Escort Guns",
    damage: 11,
    cooldown: 0.78,
    range: 400,
    arc: 34,
    speed: 610,
    spread: 5,
    shots: 2,
    size: 3,
    color: "#ff7b8d"
  });
}

function updateProjectiles(dt) {
  for (const projectile of state.projectiles) {
    projectile.trail.push({ x: projectile.x, y: projectile.y });
    if (projectile.trail.length > 6) projectile.trail.shift();
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;

    if (projectile.x < 0 || projectile.x > WORLD.width || projectile.y < 0 || projectile.y > WORLD.height) {
      projectile.life = 0;
      continue;
    }

    for (const asteroid of state.asteroids) {
      if (distance(projectile, asteroid) < asteroid.radius) {
        projectile.life = 0;
        addEffect(projectile.x, projectile.y, "#a7b2bd", 0.2);
        break;
      }
    }
    if (projectile.life <= 0) continue;

    if (projectile.owner === "player") {
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        if (distance(projectile, enemy) <= projectile.radius + enemy.radius) {
          projectile.life = 0;
          const dealt = applyDamage(enemy, projectile.damage, "player", impactSide(enemy, projectile));
          state.stats.damageDealt += dealt;
          state.stats.shotsHit += 1;
          addEffect(projectile.x, projectile.y, projectile.color, 0.28);
          if (isDestroyed(enemy)) destroyEnemy(enemy);
          break;
        }
      }
    } else if (
      state.player.alive &&
      distance(projectile, state.player) <= projectile.radius + state.player.radius
    ) {
      projectile.life = 0;
      const taken = applyDamage(state.player, projectile.damage, "enemy", impactSide(state.player, projectile));
      state.stats.damageTaken += taken;
      addEffect(projectile.x, projectile.y, projectile.color, 0.28);
      addShake(Math.min(14, 3 + projectile.damage * 0.25));
      if (hullTotal(state.player) < hullMaxTotal(state.player) * 0.25) state.stats.hullCritical = true;
      if (isDestroyed(state.player)) {
        state.player.alive = false;
        state.stats.survived = false;
        finishMission("failed", "CWS Resolute was destroyed in action.");
      }
    }
  }
  state.projectiles = state.projectiles.filter((projectile) => projectile.life > 0);
}

function applyDamage(ship, amount, source, side) {
  let remaining = amount;
  let hullDamage = 0;
  if (ship.shields[side] > 0) {
    const shieldHit = Math.min(ship.shields[side], remaining);
    ship.shields[side] -= shieldHit;
    remaining -= shieldHit;
  }
  if (remaining > 0) {
    ship.hull[side] = Math.max(0, ship.hull[side] - remaining);
    hullDamage = remaining;
    maybeDamageSystem(ship, remaining, source);
  }
  ship.shieldDelay[side] = 3.2;
  return hullDamage;
}

function maybeDamageSystem(ship, hullDamage, source) {
  if (hullDamage <= 0 || Math.random() > clamp(hullDamage / 90, 0.08, 0.42)) return;
  const keys = Object.keys(ship.systems).filter((key) => ship.systems[key] < 3);
  if (keys.length === 0) return;
  const system = pick(keys);
  ship.systems[system] += 1;
  if (ship.type === "player") {
    state.stats.systemsDamaged += 1;
    addMessage(`Engineering: ${SYSTEM_NAMES[system]} report ${SYSTEM_STATES[ship.systems[system]]}.`);
  } else if (source === "player" && ship.type === "flagship") {
    addMessage(`Sensors: enemy ${SYSTEM_NAMES[system].toLowerCase()} degraded.`);
  }
}

function destroyEnemy(enemy) {
  enemy.alive = false;
  state.stats.tonnage += hullMaxTotal(enemy);
  addEffect(enemy.x, enemy.y, enemy.type === "flagship" ? "#ffcc66" : "#ff917d", 0.65);
  addShake(enemy.type === "flagship" ? 18 : 7);
  if (enemy.type === "flagship") {
    state.stats.targetDestroyed = true;
    addMessage(`${enemy.name} destroyed. Objective complete.`);
    finishMission("success", "Enemy flagship destroyed.");
  } else {
    state.stats.escortsDestroyed += 1;
    addMessage(`${enemy.name} destroyed.`);
  }
}

function updateAsteroids(dt) {
  for (const asteroid of state.asteroids) {
    asteroid.angle += asteroid.spin * dt;
  }
}

function updateEffects(dt) {
  for (const effect of state.effects) {
    effect.life -= dt;
  }
  state.effects = state.effects.filter((effect) => effect.life > 0);
}

function updateMissionTimer(dt) {
  state.mission.timer = Math.max(0, state.mission.timer - dt);
  if (state.mission.timer <= 0 && !state.stats.targetDestroyed) {
    finishMission("failed", `${state.mission.flagshipName} escaped the intercept window.`);
  }
}

export function retreatToStarbase() {
  if (state.screen !== "combat" || state.paused) return;
  state.stats.retreated = true;
  finishMission("failed", "CWS Resolute retreated before destroying the flagship.");
}
