"use strict";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const screens = {
  start: document.getElementById("start-screen"),
  starbase: document.getElementById("starbase-screen"),
  combat: document.getElementById("combat-screen"),
  evaluation: document.getElementById("evaluation-screen")
};

const dom = {
  beginMission: document.getElementById("begin-mission"),
  startRefit: document.getElementById("start-refit"),
  launchMission: document.getElementById("launch-mission"),
  repairShip: document.getElementById("repair-ship"),
  continueStarbase: document.getElementById("continue-starbase"),
  forwardSelect: document.getElementById("forward-select"),
  portSelect: document.getElementById("port-select"),
  starboardSelect: document.getElementById("starboard-select"),
  utilitySelect: document.getElementById("utility-select"),
  baseCredits: document.getElementById("base-credits"),
  baseReputation: document.getElementById("base-reputation"),
  baseHull: document.getElementById("base-hull"),
  baseRepairCost: document.getElementById("base-repair-cost"),
  missionPreview: document.getElementById("mission-preview"),
  hudObjective: document.getElementById("hud-objective"),
  hudTimer: document.getElementById("hud-timer"),
  hullBar: document.getElementById("hull-bar"),
  hullValue: document.getElementById("hull-value"),
  shieldBar: document.getElementById("shield-bar"),
  shieldValue: document.getElementById("shield-value"),
  systemList: document.getElementById("system-list"),
  weaponList: document.getElementById("weapon-list"),
  targetInfo: document.getElementById("target-info"),
  messageLog: document.getElementById("message-log"),
  pauseBanner: document.getElementById("pause-banner"),
  missionGrade: document.getElementById("mission-grade"),
  missionResult: document.getElementById("mission-result"),
  captainReport: document.getElementById("captain-report"),
  evalReward: document.getElementById("eval-reward"),
  evalRepair: document.getElementById("eval-repair"),
  evalNet: document.getElementById("eval-net"),
  evalReputation: document.getElementById("eval-reputation"),
  evalStats: document.getElementById("eval-stats")
};

const WORLD = {
  width: 3200,
  height: 2200
};

const SYSTEM_NAMES = {
  engines: "Engines",
  weapons: "Weapons",
  sensors: "Sensors",
  shields: "Shields"
};

const SYSTEM_STATES = ["operational", "light damage", "heavy damage", "disabled"];

const forwardLoadouts = {
  lightForward: {
    name: "Light Forward Guns",
    description: "Fast cooldown, lower damage.",
    damage: 14,
    cooldown: 0.46,
    range: 760,
    arc: 32,
    speed: 680,
    spread: 3,
    shots: 2,
    size: 3,
    color: "#9be7ff"
  },
  heavyForward: {
    name: "Heavy Forward Guns",
    description: "Slower cooldown, higher damage.",
    damage: 32,
    cooldown: 0.95,
    range: 840,
    arc: 26,
    speed: 640,
    spread: 2,
    shots: 2,
    size: 4,
    color: "#f9d287"
  },
  torpedoForward: {
    name: "Torpedo Launcher",
    description: "Powerful, narrow, and slow to reload.",
    damage: 74,
    cooldown: 2.4,
    range: 1040,
    arc: 16,
    speed: 420,
    spread: 1,
    shots: 1,
    size: 6,
    color: "#ff8b7c",
    torpedo: true
  }
};

const broadsideLoadouts = {
  standard: {
    name: "Standard Broadside",
    description: "Balanced battery.",
    damage: 19,
    cooldown: 1.15,
    range: 680,
    arc: 74,
    speed: 560,
    spread: 14,
    shots: 5,
    size: 3,
    color: "#f6f1a8"
  },
  heavy: {
    name: "Heavy Broadside",
    description: "High damage, slow cooldown.",
    damage: 31,
    cooldown: 1.85,
    range: 720,
    arc: 62,
    speed: 520,
    spread: 10,
    shots: 5,
    size: 4,
    color: "#ffbf78"
  },
  flak: {
    name: "Flak Broadside",
    description: "Lower damage, wider arc, fast cooldown.",
    damage: 12,
    cooldown: 0.72,
    range: 560,
    arc: 106,
    speed: 620,
    spread: 20,
    shots: 6,
    size: 3,
    color: "#a8ffcb"
  }
};

const utilityLoadouts = {
  reinforcedShields: {
    name: "Reinforced Shields",
    description: "Increases maximum shields and shield recovery."
  },
  engineBoost: {
    name: "Engine Boost",
    description: "Improves thrust and turning slightly."
  },
  improvedSensors: {
    name: "Improved Sensors",
    description: "Extends target detection range."
  },
  repairDrones: {
    name: "Repair Drones",
    description: "Slowly patches hull during combat."
  }
};

const state = {
  screen: "start",
  keys: {},
  paused: false,
  lastTime: 0,
  career: {
    credits: 1250,
    reputationScore: 0,
    hull: 1,
    systems: createSystems(),
    loadout: {
      forward: "lightForward",
      port: "standard",
      starboard: "standard",
      utility: "reinforcedShields"
    }
  },
  mission: null,
  player: null,
  enemies: [],
  projectiles: [],
  asteroids: [],
  effects: [],
  stars: createStars(180),
  messages: [],
  evaluation: null
};

function createSystems() {
  return {
    engines: 0,
    weapons: 0,
    sensors: 0,
    shields: 0
  };
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function formatCredits(value) {
  return Math.round(value).toLocaleString();
}

function degToRad(value) {
  return value * Math.PI / 180;
}

function angleWrap(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function currentReputation() {
  const score = state.career.reputationScore;
  if (score >= 8) return "Decorated";
  if (score >= 5) return "Reliable";
  if (score >= 2) return "Blooded";
  if (score <= -3) return "Questioned";
  return "Unproven";
}

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.remove("screen-active"));
  screens[name].classList.add("screen-active");
  state.screen = name;
  if (name === "starbase") updateStarbase();
}

function populateSelect(select, options, currentKey) {
  select.innerHTML = "";
  Object.entries(options).forEach(([key, item]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = item.name;
    option.title = item.description;
    option.selected = key === currentKey;
    select.appendChild(option);
  });
}

function setupLoadouts() {
  populateSelect(dom.forwardSelect, forwardLoadouts, state.career.loadout.forward);
  populateSelect(dom.portSelect, broadsideLoadouts, state.career.loadout.port);
  populateSelect(dom.starboardSelect, broadsideLoadouts, state.career.loadout.starboard);
  populateSelect(dom.utilitySelect, utilityLoadouts, state.career.loadout.utility);

  dom.forwardSelect.addEventListener("change", event => {
    state.career.loadout.forward = event.target.value;
    updateStarbase();
  });
  dom.portSelect.addEventListener("change", event => {
    state.career.loadout.port = event.target.value;
    updateStarbase();
  });
  dom.starboardSelect.addEventListener("change", event => {
    state.career.loadout.starboard = event.target.value;
    updateStarbase();
  });
  dom.utilitySelect.addEventListener("change", event => {
    state.career.loadout.utility = event.target.value;
    updateStarbase();
  });
}

function calculateRepairCost() {
  const hullCost = Math.round((1 - state.career.hull) * 760);
  const systemCost = Object.values(state.career.systems).reduce((total, level) => total + level * 135, 0);
  return Math.max(0, hullCost + systemCost);
}

function updateStarbase() {
  const repairCost = calculateRepairCost();
  dom.baseCredits.textContent = formatCredits(state.career.credits);
  dom.baseReputation.textContent = currentReputation();
  dom.baseHull.textContent = `${Math.round(state.career.hull * 100)}%`;
  dom.baseRepairCost.textContent = formatCredits(repairCost);
  dom.repairShip.disabled = repairCost === 0 || state.career.credits < repairCost;

  const loadout = state.career.loadout;
  dom.missionPreview.textContent = [
    "Assassinate a hostile flagship in a contested sector.",
    `Forward: ${forwardLoadouts[loadout.forward].name}.`,
    `Port: ${broadsideLoadouts[loadout.port].name}.`,
    `Starboard: ${broadsideLoadouts[loadout.starboard].name}.`,
    `Utility: ${utilityLoadouts[loadout.utility].name}.`
  ].join(" ");
}

function repairShip() {
  const cost = calculateRepairCost();
  if (cost <= 0 || state.career.credits < cost) return;
  state.career.credits -= cost;
  state.career.hull = 1;
  state.career.systems = createSystems();
  updateStarbase();
}

function createStars(count) {
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

function generateMission() {
  const sectorPrefixes = ["Kestrel", "Rime", "Acheron", "Helios", "Vesper", "Orison", "Cinder", "Icarus"];
  const sectorSuffixes = ["Reach", "Drift", "Basin", "Exclusion", "Corridor", "Wake", "Field", "Crown"];
  const flagshipTitles = ["Dreadnought", "Executor", "Praetor", "Iron Regent", "Black Lance", "Vigilant", "Red Monarch"];
  const hazards = [
    "Sensor ghosts from charged dust will complicate target acquisition.",
    "A broken asteroid belt limits maneuver room for heavy vessels.",
    "Command expects hostile escorts to screen the target aggressively.",
    "Solar interference will punish slow pursuit vectors.",
    "A debris field from an old convoy action is drifting across the intercept lane."
  ];
  const sectorName = `${pick(sectorPrefixes)} ${pick(sectorSuffixes)}`;
  const flagshipName = `${pick(flagshipTitles)} ${randomInt(17, 94)}`;
  const duration = randomInt(180, 300);
  const reward = Math.round(1250 * randomRange(0.8, 1.2));
  const escortCount = randomInt(1, 3);
  const flagshipHull = Math.round(820 * randomRange(0.85, 1.15));
  return {
    sectorName,
    flagshipName,
    duration,
    timer: duration,
    reward,
    escortCount,
    flagshipHull,
    hazard: pick(hazards),
    startedAt: performance.now()
  };
}

function createPlayerShip() {
  const utility = state.career.loadout.utility;
  const shieldBonus = utility === "reinforcedShields" ? 85 : 0;
  const engineBonus = utility === "engineBoost" ? 0.16 : 0;
  return {
    id: "player",
    type: "player",
    name: "Valkyrie",
    x: 360,
    y: WORLD.height / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 31,
    hullMax: 420,
    hull: 420 * state.career.hull,
    shieldsMax: 245 + shieldBonus,
    shields: 245 + shieldBonus,
    shieldDelay: 0,
    shieldRegen: 9 + (utility === "reinforcedShields" ? 4 : 0),
    systems: { ...state.career.systems },
    cooldowns: {
      forward: 0,
      port: 0,
      starboard: 0,
      torpedo: 0
    },
    engineBonus,
    repairPulse: 0,
    alive: true
  };
}

function createEnemyShip(type, x, y, mission, index) {
  if (type === "flagship") {
    return {
      id: "flagship",
      type,
      name: mission.flagshipName,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      radius: 46,
      hullMax: mission.flagshipHull,
      hull: mission.flagshipHull,
      shieldsMax: 260,
      shields: 260,
      shieldDelay: 0,
      shieldRegen: 6,
      systems: createSystems(),
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
    radius: 23,
    hullMax: 145,
    hull: 145,
    shieldsMax: 90,
    shields: 90,
    shieldDelay: 0,
    shieldRegen: 5,
    systems: createSystems(),
    cooldowns: {
      forward: randomRange(0.2, 1.2)
    },
    escortIndex: index,
    alive: true
  };
}

function createAsteroids() {
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

function createStats() {
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
    systemsDamaged: 0
  };
}

function startMission() {
  state.mission = generateMission();
  state.player = createPlayerShip();
  state.enemies = [];
  state.projectiles = [];
  state.asteroids = createAsteroids();
  state.effects = [];
  state.messages = [];
  state.paused = false;
  state.evaluation = null;
  state.stats = createStats();

  const flagshipX = randomRange(WORLD.width - 720, WORLD.width - 360);
  const flagshipY = randomRange(420, WORLD.height - 420);
  state.enemies.push(createEnemyShip("flagship", flagshipX, flagshipY, state.mission, 0));

  for (let i = 1; i <= state.mission.escortCount; i += 1) {
    const offset = degToRad((360 / state.mission.escortCount) * i + randomRange(-25, 25));
    const range = randomRange(150, 280);
    state.enemies.push(createEnemyShip(
      "escort",
      clamp(flagshipX + Math.cos(offset) * range, 180, WORLD.width - 180),
      clamp(flagshipY + Math.sin(offset) * range, 180, WORLD.height - 180),
      state.mission,
      i
    ));
  }

  addMessage(`Mission launched: assassinate ${state.mission.flagshipName} in ${state.mission.sectorName}.`);
  addMessage(state.mission.hazard);
  showScreen("combat");
  resizeCanvasToDisplay();
}

function addMessage(text) {
  state.messages.unshift({
    text,
    time: performance.now()
  });
  state.messages = state.messages.slice(0, 8);
}

function getSystemMultiplier(ship, system) {
  const level = ship.systems[system] || 0;
  if (system === "engines") return [1, 0.82, 0.55, 0.2][level];
  if (system === "weapons") return [1, 1.22, 1.62, 2.35][level];
  if (system === "sensors") return [1, 0.82, 0.62, 0.42][level];
  if (system === "shields") return [1, 0.72, 0.42, 0][level];
  return 1;
}

function getSensorRange() {
  const utilityBonus = state.career.loadout.utility === "improvedSensors" ? 420 : 0;
  return (980 + utilityBonus) * getSystemMultiplier(state.player, "sensors");
}

function playerWeaponDefinitions() {
  const forward = forwardLoadouts[state.career.loadout.forward];
  const port = broadsideLoadouts[state.career.loadout.port];
  const starboard = broadsideLoadouts[state.career.loadout.starboard];
  const specialBoost = state.career.loadout.forward === "torpedoForward" ? 1.25 : 1;
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

function attemptPlayerFire(slot) {
  if (state.screen !== "combat" || state.paused || !state.player.alive) return;

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

function getSlotAngle(angle, slot) {
  if (slot === "port") return angle - Math.PI / 2;
  if (slot === "starboard") return angle + Math.PI / 2;
  return angle;
}

function findTargetInArc(ship, arcCenter, arcWidth, range) {
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

function fireWeapon(ship, target, slot, weapon, owner) {
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

  if (owner === "player") {
    addEffect(ship.x, ship.y, weapon.color, 0.22);
  }
}

function lerpAngle(a, b, t) {
  return a + angleWrap(b - a) * t;
}

function addEffect(x, y, color, life) {
  state.effects.push({ x, y, color, life, maxLife: life, radius: randomRange(12, 28) });
}

function update(dt) {
  if (state.screen !== "combat" || state.paused) return;
  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateAsteroids(dt);
  updateEffects(dt);
  updateMissionTimer(dt);
  updateHud();
}

function updatePlayer(dt) {
  const ship = state.player;
  const engineMult = getSystemMultiplier(ship, "engines") + ship.engineBonus;
  const accel = 112 * engineMult;
  const reverse = 58 * engineMult;
  const turn = 1.38 * engineMult;
  const forwardX = Math.cos(ship.angle);
  const forwardY = Math.sin(ship.angle);

  if (state.keys.KeyA) ship.angle -= turn * dt;
  if (state.keys.KeyD) ship.angle += turn * dt;
  if (state.keys.KeyW) {
    ship.vx += forwardX * accel * dt;
    ship.vy += forwardY * accel * dt;
  }
  if (state.keys.KeyS) {
    const forwardSpeed = ship.vx * forwardX + ship.vy * forwardY;
    const brakeForce = forwardSpeed > 30 ? 130 : reverse;
    ship.vx -= forwardX * brakeForce * dt;
    ship.vy -= forwardY * brakeForce * dt;
  }

  const maxSpeed = 212 * engineMult;
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > maxSpeed) {
    ship.vx = ship.vx / speed * maxSpeed;
    ship.vy = ship.vy / speed * maxSpeed;
  }

  ship.vx *= Math.pow(0.992, dt * 60);
  ship.vy *= Math.pow(0.992, dt * 60);
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  enforceBoundary(ship);
  handleAsteroidImpacts(ship, dt);
  updateShipRecovery(ship, dt);
  updateCooldowns(ship.cooldowns, dt);

  if (state.career.loadout.utility === "repairDrones") {
    ship.repairPulse += dt;
    if (ship.repairPulse >= 1.5 && ship.hull > 0 && ship.hull < ship.hullMax * 0.72) {
      ship.repairPulse = 0;
      ship.hull = Math.min(ship.hullMax * 0.72, ship.hull + 4);
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
  if (warned && Math.random() < 0.03) addMessage("Boundary warning.");
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
        applyDamage(ship, 8, "asteroid");
        addMessage("Asteroid impact across the hull.");
      }
    }
  }
}

function updateShipRecovery(ship, dt) {
  if (ship.shieldDelay > 0) {
    ship.shieldDelay -= dt;
  } else if (ship.shields < ship.shieldsMax) {
    ship.shields = Math.min(
      ship.shieldsMax,
      ship.shields + ship.shieldRegen * getSystemMultiplier(ship, "shields") * dt
    );
  }
}

function updateCooldowns(cooldowns, dt) {
  Object.keys(cooldowns).forEach(key => {
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

function updateFlagship(ship, dt) {
  const player = state.player;
  const toPlayer = angleTo(ship, player);
  const d = distance(ship, player);
  const badlyDamaged = ship.hull < ship.hullMax * 0.28;
  ship.escaping = badlyDamaged || state.mission.timer < 28;

  let desiredAngle;
  let thrust = 0;
  if (ship.escaping) {
    desiredAngle = 0;
    thrust = 68;
  } else {
    const broadsideSide = Math.sin(angleWrap(toPlayer - ship.angle)) > 0 ? Math.PI / 2 : -Math.PI / 2;
    desiredAngle = toPlayer - broadsideSide;
    if (d > 660) thrust = 58;
    if (d < 390) thrust = -36;
  }

  ship.angle = turnToward(ship.angle, desiredAngle, 0.78 * dt);
  ship.vx += Math.cos(ship.angle) * thrust * dt;
  ship.vy += Math.sin(ship.angle) * thrust * dt;
  limitVelocity(ship, 125);
  ship.vx *= Math.pow(0.994, dt * 60);
  ship.vy *= Math.pow(0.994, dt * 60);
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  enemyTryFire(ship, "port", player, {
    name: "Flagship Port Battery",
    damage: 23,
    cooldown: 1.35,
    range: 720,
    arc: 70,
    speed: 520,
    spread: 12,
    shots: 6,
    size: 4,
    color: "#ff9377"
  });
  enemyTryFire(ship, "starboard", player, {
    name: "Flagship Starboard Battery",
    damage: 23,
    cooldown: 1.35,
    range: 720,
    arc: 70,
    speed: 520,
    spread: 12,
    shots: 6,
    size: 4,
    color: "#ff9377"
  });
  enemyTryFire(ship, "forward", player, {
    name: "Flagship Bow Guns",
    damage: 16,
    cooldown: 1.1,
    range: 620,
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
  const flagship = state.enemies.find(enemy => enemy.type === "flagship" && enemy.alive);
  const playerDistance = distance(ship, player);
  let desired = angleTo(ship, player);
  let thrust = 34;

  if (flagship && playerDistance > 1120) {
    const orbit = performance.now() / 1000 * 0.32 + ship.escortIndex * 2.35;
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

  ship.angle = turnToward(ship.angle, desired, 1.9 * dt);
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
    range: 560,
    arc: 34,
    speed: 610,
    spread: 5,
    shots: 2,
    size: 3,
    color: "#ff7b8d"
  });
}

function turnToward(current, desired, amount) {
  return current + clamp(angleWrap(desired - current), -amount, amount);
}

function limitVelocity(ship, maxSpeed) {
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > maxSpeed) {
    ship.vx = ship.vx / speed * maxSpeed;
    ship.vy = ship.vy / speed * maxSpeed;
  }
}

function enemyTryFire(ship, slot, target, weapon) {
  if (!target.alive || ship.cooldowns[slot] > 0) return;
  const slotAngle = getSlotAngle(ship.angle, slot);
  const d = distance(ship, target);
  const diff = Math.abs(angleWrap(angleTo(ship, target) - slotAngle));
  if (d <= weapon.range && diff <= degToRad(weapon.arc) / 2) {
    fireWeapon(ship, target, slot, weapon, "enemy");
    ship.cooldowns[slot] = weapon.cooldown;
  }
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
          const dealt = applyDamage(enemy, projectile.damage, "player");
          state.stats.damageDealt += dealt;
          state.stats.shotsHit += 1;
          addEffect(projectile.x, projectile.y, projectile.color, 0.28);
          if (enemy.hull <= 0) destroyEnemy(enemy);
          break;
        }
      }
    } else if (state.player.alive && distance(projectile, state.player) <= projectile.radius + state.player.radius) {
      projectile.life = 0;
      const taken = applyDamage(state.player, projectile.damage, "enemy");
      state.stats.damageTaken += taken;
      addEffect(projectile.x, projectile.y, projectile.color, 0.28);
      if (state.player.hull <= 0) {
        state.player.alive = false;
        state.stats.survived = false;
        finishMission("failed", "Valkyrie was destroyed in action.");
      }
    }
  }
  state.projectiles = state.projectiles.filter(projectile => projectile.life > 0);
}

function applyDamage(ship, amount, source) {
  let remaining = amount;
  let hullDamage = 0;
  if (ship.shields > 0) {
    const shieldHit = Math.min(ship.shields, remaining);
    ship.shields -= shieldHit;
    remaining -= shieldHit;
  }
  if (remaining > 0) {
    ship.hull = Math.max(0, ship.hull - remaining);
    hullDamage = remaining;
    maybeDamageSystem(ship, remaining, source);
  }
  ship.shieldDelay = 3.2;
  return hullDamage;
}

function maybeDamageSystem(ship, hullDamage, source) {
  if (hullDamage <= 0 || Math.random() > clamp(hullDamage / 90, 0.08, 0.42)) return;
  const keys = Object.keys(ship.systems).filter(key => ship.systems[key] < 3);
  if (keys.length === 0) return;
  const system = pick(keys);
  ship.systems[system] += 1;
  if (ship.type === "player") {
    state.stats.systemsDamaged += 1;
    addMessage(`${SYSTEM_NAMES[system]} report ${SYSTEM_STATES[ship.systems[system]]}.`);
  } else if (source === "player" && ship.type === "flagship") {
    addMessage(`Enemy ${SYSTEM_NAMES[system].toLowerCase()} degraded.`);
  }
}

function destroyEnemy(enemy) {
  enemy.alive = false;
  addEffect(enemy.x, enemy.y, enemy.type === "flagship" ? "#ffcc66" : "#ff917d", 0.65);
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
  state.effects = state.effects.filter(effect => effect.life > 0);
}

function updateMissionTimer(dt) {
  state.mission.timer = Math.max(0, state.mission.timer - dt);
  if (state.mission.timer <= 0 && !state.stats.targetDestroyed) {
    finishMission("failed", `${state.mission.flagshipName} escaped the intercept window.`);
  }
}

function retreatToStarbase() {
  if (state.screen !== "combat" || state.paused) return;
  state.stats.retreated = true;
  finishMission("failed", "Valkyrie retreated before destroying the flagship.");
}

function finishMission(result, reason) {
  if (state.screen !== "combat") return;
  state.stats.timeTaken = state.mission.duration - state.mission.timer;
  state.career.hull = clamp(state.player.hull / state.player.hullMax, 0, 1);
  state.career.systems = { ...state.player.systems };
  const grade = calculateMissionGrade(result);
  const reward = result === "success" ? state.mission.reward + state.stats.escortsDestroyed * 120 : state.stats.escortsDestroyed * 90;
  const repairCost = calculateRepairCost();
  const net = reward - repairCost;
  state.career.credits += reward;
  state.career.reputationScore += reputationDelta(grade, result);
  state.evaluation = {
    result,
    reason,
    grade,
    reward,
    repairCost,
    net,
    report: buildCaptainReport(result, reason, grade)
  };
  updateEvaluation();
  showScreen("evaluation");
}

function calculateMissionGrade(result) {
  if (result !== "success" || !state.stats.targetDestroyed) return "F";
  const hullRatio = state.player.hull / state.player.hullMax;
  const shieldRatio = state.player.shields / state.player.shieldsMax;
  const timeRatio = state.stats.timeTaken / state.mission.duration;
  const accuracy = state.stats.shotsFired > 0 ? state.stats.shotsHit / state.stats.shotsFired : 0;
  let score = 55;
  score += hullRatio * 18;
  score += shieldRatio * 7;
  score += clamp(1 - timeRatio, 0, 1) * 10;
  score += state.stats.escortsDestroyed * 4;
  score += accuracy * 10;
  score -= state.stats.systemsDamaged * 4;
  if (score >= 92) return "S";
  if (score >= 82) return "A";
  if (score >= 70) return "B";
  if (score >= 58) return "C";
  if (score >= 45) return "D";
  return "F";
}

function reputationDelta(grade, result) {
  if (result !== "success") return -1;
  return { S: 3, A: 2, B: 1, C: 1, D: 0, F: -1 }[grade] || 0;
}

function buildCaptainReport(result, reason, grade) {
  const mission = state.mission;
  const stats = state.stats;
  const minutes = Math.floor(stats.timeTaken / 60);
  const seconds = Math.floor(stats.timeTaken % 60).toString().padStart(2, "0");
  if (result === "success") {
    return [
      `Valkyrie intercepted ${mission.flagshipName} in ${mission.sectorName} and completed the assassination order in ${minutes}:${seconds}.`,
      `${stats.escortsDestroyed} escort vessel${stats.escortsDestroyed === 1 ? "" : "s"} were destroyed during the action.`,
      `Final grade ${grade} reflects remaining hull integrity, time on target, weapon accuracy, and system damage. ${mission.hazard}`
    ].join(" ");
  }
  return [
    `Valkyrie failed to complete the assassination order against ${mission.flagshipName} in ${mission.sectorName}.`,
    `${reason} Command assigns grade ${grade}; the main objective was not achieved.`,
    `Damage control recorded ${stats.systemsDamaged} system incident${stats.systemsDamaged === 1 ? "" : "s"} before withdrawal or loss of combat capability.`
  ].join(" ");
}

function updateEvaluation() {
  const evaluation = state.evaluation;
  dom.missionGrade.textContent = evaluation.grade;
  dom.missionResult.textContent = evaluation.reason;
  dom.captainReport.textContent = evaluation.report;
  dom.evalReward.textContent = formatCredits(evaluation.reward);
  dom.evalRepair.textContent = formatCredits(evaluation.repairCost);
  dom.evalNet.textContent = `${evaluation.net >= 0 ? "+" : ""}${formatCredits(evaluation.net)}`;
  dom.evalReputation.textContent = currentReputation();
  dom.evalStats.innerHTML = "";
  const accuracy = state.stats.shotsFired > 0 ? Math.round(state.stats.shotsHit / state.stats.shotsFired * 100) : 0;
  const statRows = [
    ["Target destroyed", state.stats.targetDestroyed ? "Yes" : "No"],
    ["Survived", state.stats.survived ? "Yes" : "No"],
    ["Retreated", state.stats.retreated ? "Yes" : "No"],
    ["Time taken", formatTime(state.stats.timeTaken)],
    ["Damage dealt", Math.round(state.stats.damageDealt)],
    ["Damage taken", Math.round(state.stats.damageTaken)],
    ["Escorts destroyed", state.stats.escortsDestroyed],
    ["Torpedoes fired", state.stats.torpedoesFired],
    ["Shots fired", state.stats.shotsFired],
    ["Shots hit", state.stats.shotsHit],
    ["Accuracy", `${accuracy}%`],
    ["Systems damaged", state.stats.systemsDamaged]
  ];
  for (const [label, value] of statRows) {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    wrapper.append(dt, dd);
    dom.evalStats.appendChild(wrapper);
  }
}

function formatTime(value) {
  const minutes = Math.floor(value / 60).toString().padStart(2, "0");
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateHud() {
  const player = state.player;
  dom.hudObjective.textContent = `Destroy ${state.mission.flagshipName} in ${state.mission.sectorName}.`;
  dom.hudTimer.textContent = formatTime(state.mission.timer);

  const hullPercent = clamp(player.hull / player.hullMax, 0, 1);
  const shieldPercent = clamp(player.shields / player.shieldsMax, 0, 1);
  dom.hullBar.style.width = `${hullPercent * 100}%`;
  dom.hullBar.style.background = hullPercent > 0.45 ? "#87f08d" : hullPercent > 0.22 ? "#f9c66e" : "#ff6b6b";
  dom.hullValue.textContent = `${Math.round(hullPercent * 100)}%`;
  dom.shieldBar.style.width = `${shieldPercent * 100}%`;
  dom.shieldValue.textContent = `${Math.round(shieldPercent * 100)}%`;

  dom.systemList.innerHTML = "";
  for (const [key, level] of Object.entries(player.systems)) {
    const item = document.createElement("li");
    item.innerHTML = `<span>${SYSTEM_NAMES[key]}</span><b>${SYSTEM_STATES[level]}</b>`;
    dom.systemList.appendChild(item);
  }

  const weapons = playerWeaponDefinitions();
  dom.weaponList.innerHTML = "";
  for (const slot of ["forward", "port", "starboard", "torpedo"]) {
    const item = document.createElement("li");
    const cooldown = player.cooldowns[slot];
    item.innerHTML = `<span>${weapons[slot].name}</span><b>${cooldown <= 0 ? "Ready" : cooldown.toFixed(1)}</b>`;
    dom.weaponList.appendChild(item);
  }

  const target = nearestVisibleTarget();
  if (target) {
    const hull = Math.round(target.hull / target.hullMax * 100);
    const shields = Math.round(target.shields / target.shieldsMax * 100);
    dom.targetInfo.textContent = `${target.name}: ${Math.round(distance(player, target))}m, hull ${hull}%, shields ${shields}%.`;
  } else {
    dom.targetInfo.textContent = "No contact inside sensor range.";
  }

  dom.messageLog.innerHTML = "";
  for (const message of state.messages) {
    const item = document.createElement("li");
    item.textContent = message.text;
    dom.messageLog.appendChild(item);
  }
}

function nearestVisibleTarget() {
  const range = getSensorRange();
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const d = distance(state.player, enemy);
    if (d <= range && d < bestDistance) {
      best = enemy;
      bestDistance = d;
    }
  }
  return best;
}

function draw() {
  if (state.screen !== "combat") return;
  resizeCanvasToDisplay();
  const camera = {
    x: clamp(state.player.x - canvas.width / 2, 0, WORLD.width - canvas.width),
    y: clamp(state.player.y - canvas.height / 2, 0, WORLD.height - canvas.height)
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawSpace();
  drawMapBounds();
  drawAsteroids();
  drawWeaponArcs(state.player);
  for (const enemy of state.enemies) {
    if (enemy.alive) drawShip(enemy);
  }
  drawShip(state.player);
  drawProjectiles();
  drawEffects();
  ctx.restore();
  drawCompass(camera);
}

function drawSpace() {
  ctx.fillStyle = "#03070c";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (const star of state.stars) {
    ctx.globalAlpha = star.a;
    ctx.fillStyle = "#e9f6ff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(70, 120, 150, 0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.width; x += 200) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.height);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD.height; y += 200) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
  }
}

function drawMapBounds() {
  ctx.strokeStyle = "rgba(110, 231, 249, 0.42)";
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
}

function drawAsteroids() {
  for (const asteroid of state.asteroids) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.angle);
    const gradient = ctx.createRadialGradient(-asteroid.radius * 0.35, -asteroid.radius * 0.4, 4, 0, 0, asteroid.radius);
    gradient.addColorStop(0, `rgba(${Math.round(130 * asteroid.shade)}, ${Math.round(150 * asteroid.shade)}, ${Math.round(162 * asteroid.shade)}, 1)`);
    gradient.addColorStop(1, "#3d4752");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#202b35";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const points = 10;
    for (let i = 0; i < points; i += 1) {
      const angle = i / points * Math.PI * 2;
      const r = asteroid.radius * randomAsteroidPoint(i, asteroid.radius);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function randomAsteroidPoint(index, radius) {
  const seed = Math.sin(index * 12.9898 + radius * 78.233) * 43758.5453;
  return 0.74 + (seed - Math.floor(seed)) * 0.32;
}

function drawWeaponArcs(ship) {
  const weapons = playerWeaponDefinitions();
  const arcs = [
    ["forward", weapons.forward, "rgba(110, 231, 249, 0.13)"],
    ["port", weapons.port, "rgba(249, 198, 110, 0.12)"],
    ["starboard", weapons.starboard, "rgba(249, 198, 110, 0.12)"],
    ["torpedo", weapons.torpedo, "rgba(255, 107, 107, 0.10)"]
  ];
  for (const [slot, weapon, color] of arcs) {
    const center = getSlotAngle(ship.angle, slot);
    const width = degToRad(weapon.arc);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    ctx.arc(ship.x, ship.y, weapon.range, center - width / 2, center + width / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color.replace("0.1", "0.28").replace("0.12", "0.28").replace("0.13", "0.28");
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawShip(ship) {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  const isPlayer = ship.type === "player";
  const isFlagship = ship.type === "flagship";
  const length = isFlagship ? 92 : isPlayer ? 64 : 44;
  const width = isFlagship ? 34 : isPlayer ? 26 : 16;
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = isPlayer ? "#7ad6e8" : isFlagship ? "#d36b5c" : "#d9869c";
  ctx.strokeStyle = isPlayer ? "#d7fbff" : "#ffd3c6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(length / 2, 0);
  ctx.lineTo(length * 0.18, -width / 2);
  ctx.lineTo(-length / 2, -width * 0.34);
  ctx.lineTo(-length / 2, width * 0.34);
  ctx.lineTo(length * 0.18, width / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = isPlayer ? "#18374d" : "#4a1f25";
  ctx.fillRect(-length * 0.2, -width * 0.26, length * 0.45, width * 0.52);

  ctx.fillStyle = "#f8fbff";
  ctx.fillRect(-length * 0.08, -width * 0.42, length * 0.24, 3);
  ctx.fillRect(-length * 0.08, width * 0.35, length * 0.24, 3);

  if (ship.shields > 1) {
    const shieldRatio = ship.shields / ship.shieldsMax;
    ctx.strokeStyle = isPlayer ? `rgba(110, 231, 249, ${0.18 + shieldRatio * 0.28})` : `rgba(255, 147, 119, ${0.16 + shieldRatio * 0.22})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, ship.radius * 1.18, ship.radius * 0.82, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  drawShipLabel(ship);
}

function drawShipLabel(ship) {
  const hull = clamp(ship.hull / ship.hullMax, 0, 1);
  const barWidth = ship.type === "flagship" ? 92 : 54;
  const y = ship.y - ship.radius - 18;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(ship.x - barWidth / 2, y, barWidth, 5);
  ctx.fillStyle = hull > 0.45 ? "#87f08d" : hull > 0.22 ? "#f9c66e" : "#ff6b6b";
  ctx.fillRect(ship.x - barWidth / 2, y, barWidth * hull, 5);
  if (ship.type !== "player") {
    ctx.fillStyle = "#d9edf9";
    ctx.font = "12px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.fillText(ship.name, ship.x, y - 6);
  }
}

function drawProjectiles() {
  for (const projectile of state.projectiles) {
    ctx.strokeStyle = projectile.color;
    ctx.lineWidth = projectile.torpedo ? 3 : 2;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    for (let i = 0; i < projectile.trail.length; i += 1) {
      const point = projectile.trail[i];
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = projectile.color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEffects() {
  for (const effect of state.effects) {
    const t = effect.life / effect.maxLife;
    ctx.globalAlpha = t;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.radius * (1.4 - t), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCompass(camera) {
  const target = state.enemies.find(enemy => enemy.type === "flagship" && enemy.alive);
  if (!target) return;
  const screenX = target.x - camera.x;
  const screenY = target.y - camera.y;
  if (screenX > 0 && screenX < canvas.width && screenY > 0 && screenY < canvas.height) return;
  const center = { x: canvas.width / 2, y: canvas.height / 2 };
  const angle = Math.atan2(screenY - center.y, screenX - center.x);
  const x = center.x + Math.cos(angle) * (Math.min(canvas.width, canvas.height) * 0.42);
  const y = center.y + Math.sin(angle) * (Math.min(canvas.width, canvas.height) * 0.42);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "#ffcc66";
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function resizeCanvasToDisplay() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(480, Math.floor(rect.width));
  const height = Math.max(340, Math.floor(rect.height));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function loop(timestamp) {
  const dt = Math.min(0.04, (timestamp - state.lastTime) / 1000 || 0);
  state.lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function handleKeyDown(event) {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  state.keys[event.code] = true;

  if (event.repeat) return;
  if (event.code === "Escape" && state.screen === "combat") {
    state.paused = !state.paused;
    dom.pauseBanner.classList.toggle("hidden", !state.paused);
    return;
  }
  if (event.code === "Space") attemptPlayerFire("forward");
  if (event.code === "KeyQ") attemptPlayerFire("port");
  if (event.code === "KeyE") attemptPlayerFire("starboard");
  if (event.code === "KeyF") attemptPlayerFire("torpedo");
  if (event.code === "KeyR") retreatToStarbase();
}

function handleKeyUp(event) {
  state.keys[event.code] = false;
}

function bindEvents() {
  dom.beginMission.addEventListener("click", () => showScreen("starbase"));
  dom.startRefit.addEventListener("click", () => showScreen("starbase"));
  dom.launchMission.addEventListener("click", startMission);
  dom.repairShip.addEventListener("click", repairShip);
  dom.continueStarbase.addEventListener("click", () => showScreen("starbase"));
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("resize", resizeCanvasToDisplay);
}

function init() {
  setupLoadouts();
  bindEvents();
  updateStarbase();
  requestAnimationFrame(loop);
}

init();
