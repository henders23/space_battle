"use strict";

import { state, SYSTEM_NAMES, SYSTEM_STATES } from "../state.js";
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
import { addMessage, addEffect, addImpact, addExplosion, addShake } from "./effects.js";
import * as sfx from "../sfx.js";
import { hullTotal, hullMaxTotal, impactSide, isDestroyed } from "./shipStats.js";
import { updateObjective } from "./objectives.js";
import { finishMission } from "../screens/evaluation.js";
import { difficultyMods } from "../settings.js";

// Per-frame world simulation: movement, enemy AI, projectiles, damage, objectives.

export function update(dt) {
  if (state.screen !== "combat" || state.paused || !state.player) return;
  updatePlayer(dt);
  updateEnemies(dt);
  updateAllies(dt);
  updateProjectiles(dt);
  updateAsteroids(dt);
  updateEffects(dt);
  const resolution = updateObjective(dt);
  if (resolution) finishMission(resolution.result, resolution.reason);
}

// Nearest live thing an enemy will engage — the player or any allied asset.
function nearestEnemyTarget(ship) {
  let best = state.player && state.player.alive ? state.player : null;
  let bestD = best ? distance(ship, best) : Infinity;
  for (const ally of state.allies) {
    if (!ally.alive) continue;
    const d = distance(ship, ally);
    if (d < bestD) {
      bestD = d;
      best = ally;
    }
  }
  return best;
}

function updateAllies(dt) {
  const o = state.objective || {};
  for (const ally of state.allies) {
    if (!ally.alive) continue;
    updateShipRecovery(ally, dt);
    if (ally.type === "transport" && ally.exit) {
      const ang = angleTo(ally, ally.exit);
      ally.angle = turnToward(ally.angle, ang, 1.6 * dt);
      ally.vx += Math.cos(ally.angle) * 70 * dt;
      ally.vy += Math.sin(ally.angle) * 70 * dt;
      limitVelocity(ally, 78);
      ally.vx *= Math.pow(0.99, dt * 60);
      ally.vy *= Math.pow(0.99, dt * 60);
      ally.x += ally.vx * dt;
      ally.y += ally.vy * dt;
      if (distance(ally, ally.exit) < 140) {
        ally.alive = false;
        ally.saved = true;
        o.saved = (o.saved || 0) + 1;
        addMessage(`${ally.name} reached the jump point.`);
      }
    }
  }
}

function updatePlayer(dt) {
  const ship = state.player;
  const engineMult = getSystemMultiplier(ship, "engines") + ship.engineBonus;
  const turn = (ship.turnRate || 0.4) * engineMult;
  const forwardX = Math.cos(ship.angle);
  const forwardY = Math.sin(ship.angle);

  if (state.keys.KeyA) ship.angle -= turn * dt;
  if (state.keys.KeyD) ship.angle += turn * dt;

  // The engines drive the ship toward the selected throttle speed along its
  // heading. Forward speed eases toward the target; any sideways momentum from
  // turning bleeds off via strong inertia damping, so the ship tracks its nose.
  const speeds = ship.throttleSpeeds || [0, 30, 70, 130];
  const targetSpeed = speeds[ship.throttle || 0] * engineMult;
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
    if (!enemy.spawned || !enemy.alive) continue;
    switch (enemy.behavior) {
      case "flagship":
        updateFlagship(enemy, dt);
        break;
      case "broadside":
        updateBroadsideShip(enemy, dt);
        break;
      case "aggressive":
        updateAggressive(enemy, dt);
        break;
      case "kite":
        updateKite(enemy, dt);
        break;
      default:
        updateCharger(enemy, dt);
        break;
    }
    updateShipRecovery(enemy, dt);
    updateCooldowns(enemy.cooldowns, dt);
  }
}

function moveShip(ship, desired, turnRate, thrust, maxSpeed, damp, dt) {
  ship.angle = turnToward(ship.angle, desired, turnRate * dt);
  ship.vx += Math.cos(ship.angle) * thrust * dt;
  ship.vy += Math.sin(ship.angle) * thrust * dt;
  limitVelocity(ship, maxSpeed);
  ship.vx *= Math.pow(damp, dt * 60);
  ship.vy *= Math.pow(damp, dt * 60);
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
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
  const hullFrac = hullTotal(ship) / hullMaxTotal(ship);
  ship.escaping = hullFrac < 0.28 || state.mission.timer < 28;

  let desiredAngle;
  let thrust = 0;
  if (ship.escaping) {
    // Run directly away from the player rather than toward a fixed heading.
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

// Escorts and frigates: close in and fight with forward guns. In an
// assassination, idle escorts guard the flagship until the player closes.
function updateCharger(ship, dt) {
  const target = nearestEnemyTarget(ship);
  if (!target) return;
  const flagship = state.enemies.find((enemy) => enemy.type === "flagship" && enemy.alive);
  const td = distance(ship, target);
  let desired = angleTo(ship, target);
  let thrust;

  if (flagship && target === state.player && td > 1120) {
    const orbit = (performance.now() / 1000) * 0.32 + ship.escortIndex * 2.35;
    const guardPoint = { x: flagship.x + Math.cos(orbit) * 245, y: flagship.y + Math.sin(orbit) * 245 };
    desired = angleTo(ship, guardPoint);
    thrust = distance(ship, guardPoint) > 110 ? 116 : 18;
  } else {
    thrust = td > 310 ? 138 : td < 185 ? -70 : 34;
  }
  moveShip(ship, desired, ship.turnRate, thrust, ship.maxSpeed, 0.989, dt);
  enemyTryFire(ship, "forward", target, ship.weapon);
}

// Raiders: fast, reckless dive-bombers that stay in the player's face.
function updateAggressive(ship, dt) {
  const target = nearestEnemyTarget(ship);
  if (!target) return;
  const td = distance(ship, target);
  const desired = angleTo(ship, target);
  const thrust = td < 140 ? -60 : 150;
  moveShip(ship, desired, ship.turnRate, thrust, ship.maxSpeed, 0.985, dt);
  enemyTryFire(ship, "forward", target, ship.weapon);
}

// Missile boats: hold the target at arm's length and lob missiles.
function updateKite(ship, dt) {
  const target = nearestEnemyTarget(ship);
  if (!target) return;
  const td = distance(ship, target);
  const desired = angleTo(ship, target);
  const thrust = td > 880 ? 110 : td < 620 ? -95 : 0;
  moveShip(ship, desired, ship.turnRate, thrust, ship.maxSpeed, 0.99, dt);
  enemyTryFire(ship, "forward", target, ship.weapon);
}

// Cruisers: broadside duelists — present a beam and rake the target.
function updateBroadsideShip(ship, dt) {
  const target = nearestEnemyTarget(ship);
  if (!target) return;
  const toT = angleTo(ship, target);
  const d = distance(ship, target);
  const side = Math.sin(angleWrap(toT - ship.angle)) > 0 ? Math.PI / 2 : -Math.PI / 2;
  const desired = toT - side;
  const thrust = d > 620 ? 50 : d < 360 ? -30 : 0;
  moveShip(ship, desired, ship.turnRate, thrust, ship.maxSpeed, 0.992, dt);
  enemyTryFire(ship, "port", target, ship.broadside);
  enemyTryFire(ship, "starboard", target, ship.broadside);
  enemyTryFire(ship, "forward", target, ship.bow);
}

function updateProjectiles(dt) {
  for (const projectile of state.projectiles) {
    projectile.trail.push({ x: projectile.x, y: projectile.y });
    if (projectile.trail.length > 6) projectile.trail.shift();
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;

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
        if (!enemy.spawned || !enemy.alive) continue;
        if (distance(projectile, enemy) <= projectile.radius + enemy.radius) {
          projectile.life = 0;
          const dealt = applyDamage(enemy, projectile.damage, "player", impactSide(enemy, projectile));
          const shielded = dealt <= 0;
          state.stats.damageDealt += dealt;
          state.stats.shotsHit += 1;
          addImpact(projectile.x, projectile.y, projectile.color, shielded);
          if (shielded) sfx.shieldHit();
          else sfx.hullHit();
          addShake(projectile.torpedo ? 4 : 2.2); // a kick when your shots land
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
      const shielded = taken <= 0;
      state.stats.damageTaken += taken;
      addImpact(projectile.x, projectile.y, projectile.color, shielded);
      if (shielded) sfx.shieldHit();
      else sfx.hullHit();
      addShake(Math.min(16, 4 + projectile.damage * 0.3));
      const wasCritical = state.stats.hullCritical;
      if (hullTotal(state.player) < hullMaxTotal(state.player) * 0.25) {
        state.stats.hullCritical = true;
        if (!wasCritical) sfx.alarm();
      }
      if (isDestroyed(state.player)) {
        state.player.alive = false;
        state.stats.survived = false;
        addExplosion(state.player.x, state.player.y, 1.7);
        sfx.explosion(1.7);
        addShake(30);
        finishMission("failed", "CWS Resolute was destroyed in action.");
      }
    } else {
      // Enemy fire can also strike the allied assets the player is protecting.
      for (const ally of state.allies) {
        if (!ally.alive) continue;
        if (distance(projectile, ally) <= projectile.radius + ally.radius) {
          projectile.life = 0;
          const taken = applyDamage(ally, projectile.damage, "enemy", impactSide(ally, projectile));
          addImpact(projectile.x, projectile.y, projectile.color, taken <= 0);
          if (isDestroyed(ally)) {
            ally.alive = false;
            const scale = Math.max(0.7, Math.min(1.9, ally.radius / 42));
            addExplosion(ally.x, ally.y, scale);
            sfx.explosion(scale);
            addShake(10);
            addMessage(`${ally.name} has been destroyed.`);
          }
          break;
        }
      }
    }
  }
  state.projectiles = state.projectiles.filter((projectile) => projectile.life > 0);
}

function applyDamage(ship, amount, source, side) {
  // Difficulty scales how hard incoming fire hits the player's hull/shields.
  let remaining = ship.type === "player" ? amount * difficultyMods().playerDamage : amount;
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
  const scale = Math.max(0.6, Math.min(1.9, enemy.radius / 40));
  addExplosion(enemy.x, enemy.y, scale);
  sfx.explosion(scale);
  addShake(8 + scale * 7);
  if (enemy.type === "flagship") {
    state.stats.targetDestroyed = true;
    addMessage(`${enemy.name} destroyed. Objective complete.`);
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
    if (effect.vx || effect.vy) {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.vx *= Math.pow(0.86, dt * 60);
      effect.vy *= Math.pow(0.86, dt * 60);
    }
  }
  state.effects = state.effects.filter((effect) => effect.life > 0);
}

export function retreatToStarbase() {
  if (state.screen !== "combat" || state.paused) return;
  state.stats.retreated = true;
  finishMission("failed", "CWS Resolute withdrew before completing the operation.");
}
