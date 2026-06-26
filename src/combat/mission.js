"use strict";

import { state, WORLD, createSystems } from "../state.js";
import { clamp, pick, randomInt, randomRange } from "../utils.js";
import { MISSION_TYPES, SECTOR_MISSION_POOL } from "../data/missionTypes.js";
import { HULLS } from "../data/ships.js";
import { ENEMY_TYPES, ENEMY_POOLS } from "../data/enemies.js";

const PLAYER_NAMES = { frigate: "CWS Resolute", cruiser: "CWS Vanguard", battleship: "CWS Asterion" };

// Mission generation, world setup, and ship/asteroid factories.

const CENTER = { x: WORLD.width / 2, y: WORLD.height / 2 };

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
  const operationNames = ["Black Lance", "Iron Tide", "Cold Vigil", "Severance", "Hollow Star", "Grey Dawn", "Long Watch", "Ash Harbour"];
  const hazards = [
    "Sensor ghosts from charged dust will complicate target acquisition.",
    "A broken asteroid belt limits maneuver room for heavy vessels.",
    "Command expects hostile escorts to screen aggressively.",
    "Solar interference will punish slow pursuit vectors.",
    "A debris field from an old convoy action is drifting across the lane."
  ];

  // The captain's very first command is a gentler engagement: a battle-damaged
  // flagship limping home — a winnable introduction.
  const firstCommand = state.career.record.missionsCompleted === 0;
  const type = firstCommand ? "assassinate_flagship" : (sector && sector.missionType) || pick(SECTOR_MISSION_POOL);

  const enemyFleet = sector ? sector.enemyFleet : 60;
  const threat = sector ? sector.threat : 60;
  const sectorName = sector ? sector.name : `${pick(sectorPrefixes)} ${pick(sectorSuffixes)}`;
  const flagshipName = `VRS ${pick(flagshipTitles)} ${randomInt(17, 94)}`;
  const reward = firstCommand
    ? Math.round(750 * randomRange(0.9, 1.1))
    : Math.round((780 + threat * 6) * randomRange(0.9, 1.1));

  const force = clamp(Math.round(enemyFleet / 26), 1, 5); // generic hostile count
  const duration = firstCommand ? randomInt(320, 380) : randomInt(240, 340);

  const mission = {
    type,
    typeName: MISSION_TYPES[type].name,
    operationName: firstCommand ? "First Blood" : pick(operationNames),
    sectorId: sector ? sector.id : null,
    sectorName,
    flagshipName,
    duration,
    timer: duration,
    reward,
    threat,
    enemyFleet,
    damaged: firstCommand,
    hazard: firstCommand
      ? "Intelligence confirms the target is a battle-damaged flagship limping home — shields failing, escorts scattered. A clean opportunity for a first command."
      : pick(hazards),
    // type-specific sizing
    escortCount: firstCommand ? 0 : clamp(Math.round(enemyFleet / 32), 0, 3),
    flagshipHull: firstCommand
      ? Math.round(520 * randomRange(0.9, 1.1))
      : Math.round((820 + enemyFleet * 4) * randomRange(0.9, 1.1)),
    enemyCount: force,
    transportCount: randomInt(2, 4),
    waveCount: clamp(Math.round(enemyFleet / 30) + 1, 2, 4),
    waveSize: 2,
    rescueTime: randomInt(70, 105),
    startedAt: performance.now()
  };
  return mission;
}

export function createPlayerShip() {
  const hull = HULLS[state.career.ship] || HULLS.cruiser;
  const utility = state.career.loadout.utility;
  const shieldBonus = utility === "reinforcedShields" ? 85 : 0;
  const engineBonus = utility === "engineBoost" ? 0.16 : 0;
  const sideShield = hull.shieldSide + shieldBonus / 2;
  const sideHull = hull.hullSide * state.career.hull;
  return {
    id: "player",
    type: "player",
    team: "player",
    name: PLAYER_NAMES[state.career.ship] || "CWS Vanguard",
    hullClass: hull.name,
    x: CENTER.x - 1100,
    y: CENTER.y,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: hull.radius,
    hullMax: { port: hull.hullSide, starboard: hull.hullSide },
    hull: { port: sideHull, starboard: sideHull },
    shieldsMax: { port: sideShield, starboard: sideShield },
    shields: { port: sideShield, starboard: sideShield },
    shieldDelay: { port: 0, starboard: 0 },
    shieldRegen: hull.shieldRegen + (utility === "reinforcedShields" ? 4 : 0),
    systems: { ...state.career.systems },
    cooldowns: { forward: 0, port: 0, starboard: 0, torpedo: 0 },
    engineBonus,
    throttle: 0,
    turnRate: hull.turn,
    throttleSpeeds: hull.speeds,
    spriteScale: hull.spriteScale,
    weaponDamage: hull.weaponDamage,
    weaponCooldown: hull.weaponCooldown,
    repairPulse: 0,
    alive: true
  };
}

export function createEnemyShip(type, x, y, mission, index) {
  if (type === "flagship") {
    const sideShield = mission.damaged ? 90 : 200;
    const systems = mission.damaged ? { engines: 2, weapons: 1, sensors: 1, shields: 1 } : createSystems();
    return {
      id: "flagship",
      type,
      team: "enemy",
      name: mission.flagshipName,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      radius: 110,
      hullMax: { port: mission.flagshipHull / 2, starboard: mission.flagshipHull / 2 },
      hull: { port: mission.flagshipHull / 2, starboard: mission.flagshipHull / 2 },
      shieldsMax: { port: sideShield, starboard: sideShield },
      shields: { port: sideShield, starboard: sideShield },
      shieldDelay: { port: 0, starboard: 0 },
      shieldRegen: mission.damaged ? 3 : 6,
      systems,
      cooldowns: { port: randomRange(0.2, 1.2), starboard: randomRange(0.5, 1.4), forward: randomRange(0.8, 1.8) },
      escaping: false,
      behavior: "flagship",
      spawned: true,
      alive: true
    };
  }

  const t = ENEMY_TYPES[type] || ENEMY_TYPES.escort;
  const cooldowns =
    t.behavior === "broadside"
      ? { port: randomRange(0.2, 1.2), starboard: randomRange(0.5, 1.4), forward: randomRange(0.8, 1.6) }
      : { forward: randomRange(0.2, 1.2) };
  return {
    id: `${type}-${index}`,
    type,
    team: "enemy",
    name: `Dominion ${t.name} ${index}`,
    x,
    y,
    vx: randomRange(-20, 20),
    vy: randomRange(-20, 20),
    angle: Math.PI,
    radius: t.radius,
    hullMax: { port: t.hullSide, starboard: t.hullSide },
    hull: { port: t.hullSide, starboard: t.hullSide },
    shieldsMax: { port: t.shieldSide, starboard: t.shieldSide },
    shields: { port: t.shieldSide, starboard: t.shieldSide },
    shieldDelay: { port: 0, starboard: 0 },
    shieldRegen: t.regen,
    systems: createSystems(),
    cooldowns,
    behavior: t.behavior,
    maxSpeed: t.maxSpeed,
    turnRate: t.turn,
    weapon: t.weapon,
    broadside: t.broadside,
    bow: t.bow,
    escortIndex: index,
    spawned: true,
    alive: true
  };
}

function makeAlly(subtype, name, x, y, sideHull, sideShield, radius, regen) {
  return {
    id: `${subtype}-${Math.round(x)}-${Math.round(y)}`,
    type: subtype,
    team: "ally",
    name,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    radius,
    hullMax: { port: sideHull, starboard: sideHull },
    hull: { port: sideHull, starboard: sideHull },
    shieldsMax: { port: sideShield, starboard: sideShield },
    shields: { port: sideShield, starboard: sideShield },
    shieldDelay: { port: 0, starboard: 0 },
    shieldRegen: regen,
    systems: createSystems(),
    cooldowns: {},
    saved: false,
    alive: true
  };
}

export function createAsteroids() {
  const count = randomInt(3, 8);
  const asteroids = [];
  for (let i = 0; i < count; i += 1) {
    const a = randomRange(0, Math.PI * 2);
    const r = randomRange(500, 1600);
    asteroids.push({
      x: CENTER.x + Math.cos(a) * r,
      y: CENTER.y + Math.sin(a) * r,
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

function ring(cx, cy, radius, jitter = 0) {
  const a = randomRange(0, Math.PI * 2);
  const r = radius + randomRange(-jitter, jitter);
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

export function setupMissionWorld(sector) {
  const mission = generateMission(sector);
  state.mission = mission;
  state.player = createPlayerShip();
  state.enemies = [];
  state.allies = [];
  state.objective = {};
  state.projectiles = [];
  state.asteroids = createAsteroids();
  state.effects = [];
  state.messages = [];
  state.paused = false;
  state.evaluation = null;
  state.stats = createStats();
  state.stars = createStars(220);

  let escortIndex = 1;
  const spawnHostile = (typeKey, x, y, extra = {}) => {
    const e = createEnemyShip(typeKey, x, y, mission, escortIndex);
    escortIndex += 1;
    Object.assign(e, extra);
    state.enemies.push(e);
    return e;
  };

  if (mission.type === "assassinate_flagship") {
    state.player.x = CENTER.x - 1100;
    state.player.y = CENTER.y + randomRange(-200, 200);
    const fx = CENTER.x + randomRange(400, 950);
    const fy = CENTER.y + randomRange(-500, 500);
    state.enemies.push(createEnemyShip("flagship", fx, fy, mission, 0));
    for (let i = 1; i <= mission.escortCount; i += 1) {
      const p = ring(fx, fy, 230, 80);
      spawnHostile(pick(ENEMY_POOLS.assassinate_flagship), p.x, p.y);
    }
  } else if (mission.type === "patrol") {
    state.player.x = CENTER.x;
    state.player.y = CENTER.y;
    for (let i = 0; i < mission.enemyCount; i += 1) {
      const p = ring(CENTER.x, CENTER.y, randomRange(700, 1500));
      spawnHostile(pick(ENEMY_POOLS.patrol), p.x, p.y);
    }
  } else if (mission.type === "convoy_escort") {
    const a = randomRange(0, Math.PI * 2);
    const exit = { x: CENTER.x + Math.cos(a) * 2400, y: CENTER.y + Math.sin(a) * 2400 };
    state.player.x = CENTER.x - Math.cos(a) * 220;
    state.player.y = CENTER.y - Math.sin(a) * 220;
    for (let i = 0; i < mission.transportCount; i += 1) {
      const t = makeAlly("transport", `CT Hestia-${i + 1}`, CENTER.x + randomRange(-160, 160), CENTER.y + randomRange(-160, 160), 140, 70, 36, 4);
      t.exit = exit;
      state.allies.push(t);
    }
    for (let i = 0; i < mission.enemyCount; i += 1) {
      const p = ring(CENTER.x, CENTER.y, randomRange(700, 1200));
      spawnHostile(pick(ENEMY_POOLS.convoy_escort), p.x, p.y);
    }
    state.objective = { exit, total: mission.transportCount, saved: 0 };
  } else if (mission.type === "starbase_defence") {
    const station = makeAlly("station", "Caldus Anchorage", CENTER.x, CENTER.y, 620, 220, 92, 7);
    state.allies.push(station);
    state.player.x = CENTER.x - 360;
    state.player.y = CENTER.y;
    const pool = ENEMY_POOLS.starbase_defence;
    // Each wave escalates in class; only the first is active, the rest lie dormant.
    for (let w = 0; w < mission.waveCount; w += 1) {
      const typeKey = pool[Math.min(w, pool.length - 1)];
      for (let i = 0; i < mission.waveSize; i += 1) {
        const p = ring(CENTER.x, CENTER.y, 1350, 200);
        const e = spawnHostile(typeKey, p.x, p.y, { waveIndex: w });
        if (w > 0) {
          e.spawned = false;
          e.alive = false;
        }
      }
    }
    state.objective = { station, waveCount: mission.waveCount, currentWave: 0 };
  } else if (mission.type === "rescue_disabled") {
    const dx = CENTER.x + randomRange(-200, 200);
    const dy = CENTER.y + randomRange(-200, 200);
    const disabled = makeAlly("disabled", "CNV Meridian", dx, dy, 130, 0, 46, 0);
    state.allies.push(disabled);
    state.player.x = CENTER.x - 1000;
    state.player.y = CENTER.y + randomRange(-200, 200);
    for (let i = 0; i < mission.enemyCount; i += 1) {
      const p = ring(dx, dy, randomRange(500, 1000));
      spawnHostile(pick(ENEMY_POOLS.rescue_disabled), p.x, p.y);
    }
    state.objective = { disabled, rescueTime: mission.rescueTime, rescueLeft: mission.rescueTime };
  }

  return mission;
}
