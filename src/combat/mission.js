"use strict";

import { state, WORLD, createSystems } from "../state.js";
import {
  clamp,
  degToRad,
  pick,
  randomInt,
  randomRange
} from "../utils.js";

// Mission generation, world setup, and ship/asteroid factories.

export function createStars(count) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random() * WORLD.width,
      y: Math.random() * WORLD.height,
      r: randomRange(0.8, 2.2),
      a: randomRange(0.25, 0.9)
    });
  }
  return stars;
}

export function generateMission(sector) {
  const sectorPrefixes = ["Kestrel", "Rime", "Acheron", "Helios", "Vesper", "Orison", "Cinder", "Icarus"];
  const sectorSuffixes = ["Reach", "Drift", "Basin", "Exclusion", "Corridor", "Wake", "Field", "Crown"];
  const flagshipTitles = ["Dreadnought", "Executor", "Praetor", "Iron Regent", "Black Lance", "Vigilant", "Red Monarch"];
  const operationNames = ["Black Lance", "Iron Tide", "Cold Vigil", "Severance", "Hollow Star", "Grey Dawn"];
  const hazards = [
    "Sensor ghosts from charged dust will complicate target acquisition.",
    "A broken asteroid belt limits maneuver room for heavy vessels.",
    "Command expects hostile escorts to screen the target aggressively.",
    "Solar interference will punish slow pursuit vectors.",
    "A debris field from an old convoy action is drifting across the intercept lane."
  ];
  // The captain's very first command (before any completed mission) is a gentler
  // engagement: a battle-damaged flagship limping home, with failing shields and
  // no escort screen — a winnable introduction.
  const firstCommand = state.career.record.missionsCompleted === 0;

  // Difficulty scales with the sector's enemy fleet strength and threat.
  const enemyFleet = sector ? sector.enemyFleet : 60;
  const threat = sector ? sector.threat : 60;
  const sectorName = sector ? sector.name : `${pick(sectorPrefixes)} ${pick(sectorSuffixes)}`;
  const flagshipName = `VRS ${pick(flagshipTitles)} ${randomInt(17, 94)}`;
  const duration = firstCommand ? randomInt(280, 340) : randomInt(190, 300);
  const reward = firstCommand
    ? Math.round(750 * randomRange(0.9, 1.1))
    : Math.round((850 + threat * 6) * randomRange(0.9, 1.1));
  const escortCount = firstCommand ? 0 : clamp(Math.round(enemyFleet / 32), 0, 3);
  const flagshipHull = firstCommand
    ? Math.round(360 * randomRange(0.9, 1.1))
    : Math.round((560 + enemyFleet * 3) * randomRange(0.9, 1.1));
  const hazard = firstCommand
    ? "Intelligence confirms the target is a battle-damaged flagship limping home — shields are failing and its escorts have scattered. A clean opportunity for a first command."
    : pick(hazards);
  return {
    type: "assassinate_flagship",
    operationName: firstCommand ? "First Blood" : pick(operationNames),
    sectorId: sector ? sector.id : null,
    sectorName,
    flagshipName,
    duration,
    timer: duration,
    reward,
    escortCount,
    flagshipHull,
    damaged: firstCommand,
    hazard,
    startedAt: performance.now()
  };
}

export function createPlayerShip() {
  const utility = state.career.loadout.utility;
  const shieldBonus = utility === "reinforcedShields" ? 85 : 0;
  const engineBonus = utility === "engineBoost" ? 0.16 : 0;
  const sideShield = (245 + shieldBonus) / 2;
  const sideHull = 210 * state.career.hull;
  return {
    id: "player",
    type: "player",
    name: "CWS Resolute",
    x: 360,
    y: WORLD.height / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 42,
    hullMax: { port: 210, starboard: 210 },
    hull: { port: sideHull, starboard: sideHull },
    shieldsMax: { port: sideShield, starboard: sideShield },
    shields: { port: sideShield, starboard: sideShield },
    shieldDelay: { port: 0, starboard: 0 },
    shieldRegen: 9 + (utility === "reinforcedShields" ? 4 : 0),
    systems: { ...state.career.systems },
    cooldowns: { forward: 0, port: 0, starboard: 0, torpedo: 0 },
    engineBonus,
    repairPulse: 0,
    alive: true
  };
}

export function createEnemyShip(type, x, y, mission, index) {
  if (type === "flagship") {
    // A damaged flagship has weaker shields and already-degraded subsystems.
    const sideShield = mission.damaged ? 55 : 130;
    const systems = mission.damaged
      ? { engines: 2, weapons: 1, sensors: 1, shields: 1 }
      : createSystems();
    return {
      id: "flagship",
      type,
      name: mission.flagshipName,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      radius: 64,
      hullMax: { port: mission.flagshipHull / 2, starboard: mission.flagshipHull / 2 },
      hull: { port: mission.flagshipHull / 2, starboard: mission.flagshipHull / 2 },
      shieldsMax: { port: sideShield, starboard: sideShield },
      shields: { port: sideShield, starboard: sideShield },
      shieldDelay: { port: 0, starboard: 0 },
      shieldRegen: mission.damaged ? 3 : 6,
      systems,
      cooldowns: {
        port: randomRange(0.2, 1.2),
        starboard: randomRange(0.5, 1.4),
        forward: randomRange(0.8, 1.8)
      },
      escaping: false,
      alive: true
    };
  }

  return {
    id: `escort-${index}`,
    type,
    name: `Escort ${index}`,
    x,
    y,
    vx: randomRange(-20, 20),
    vy: randomRange(-20, 20),
    angle: Math.PI,
    radius: 32,
    hullMax: { port: 72, starboard: 72 },
    hull: { port: 72, starboard: 72 },
    shieldsMax: { port: 45, starboard: 45 },
    shields: { port: 45, starboard: 45 },
    shieldDelay: { port: 0, starboard: 0 },
    shieldRegen: 5,
    systems: createSystems(),
    cooldowns: { forward: randomRange(0.2, 1.2) },
    escortIndex: index,
    alive: true
  };
}

export function createAsteroids() {
  const count = randomInt(10, 25);
  const asteroids = [];
  for (let i = 0; i < count; i += 1) {
    let x = randomRange(620, WORLD.width - 250);
    let y = randomRange(180, WORLD.height - 180);
    if (Math.abs(x - 360) < 360 && Math.abs(y - WORLD.height / 2) < 300) {
      x += 520;
    }
    asteroids.push({
      x,
      y,
      radius: randomRange(26, 72),
      spin: randomRange(-0.4, 0.4),
      angle: randomRange(0, Math.PI * 2),
      shade: randomRange(0.7, 1.15)
    });
  }
  return asteroids;
}

export function createStats() {
  return {
    targetDestroyed: false,
    survived: true,
    retreated: false,
    timeTaken: 0,
    damageDealt: 0,
    damageTaken: 0,
    escortsDestroyed: 0,
    torpedoesFired: 0,
    shotsFired: 0,
    shotsHit: 0,
    systemsDamaged: 0,
    tonnage: 0,
    hullCritical: false
  };
}

export function setupMissionWorld(sector) {
  const mission = generateMission(sector);
  state.mission = mission;
  state.player = createPlayerShip();
  state.enemies = [];
  state.projectiles = [];
  state.asteroids = createAsteroids();
  state.effects = [];
  state.messages = [];
  state.paused = false;
  state.evaluation = null;
  state.stats = createStats();
  state.stars = createStars(220);

  const flagshipX = randomRange(WORLD.width - 720, WORLD.width - 360);
  const flagshipY = randomRange(420, WORLD.height - 420);
  state.enemies.push(createEnemyShip("flagship", flagshipX, flagshipY, mission, 0));

  for (let i = 1; i <= mission.escortCount; i += 1) {
    const offset = degToRad((360 / mission.escortCount) * i + randomRange(-25, 25));
    const range = randomRange(150, 280);
    state.enemies.push(
      createEnemyShip(
        "escort",
        clamp(flagshipX + Math.cos(offset) * range, 180, WORLD.width - 180),
        clamp(flagshipY + Math.sin(offset) * range, 180, WORLD.height - 180),
        mission,
        i
      )
    );
  }

  return mission;
}
