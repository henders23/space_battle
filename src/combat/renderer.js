"use strict";

import { state, WORLD } from "../state.js";
import { clamp, degToRad, distance } from "../utils.js";
import { PALETTE } from "../data/theme.js";
import { getSlotAngle, playerWeaponDefinitions, slotForPrimaryAim } from "./weapons.js";
import { getSensorRange } from "./systems.js";
import { hullRatio, sideRatioShield } from "./shipStats.js";

// Ship-centred tactical renderer. The player ship is fixed at the centre of the
// canvas, pointing "up"; the world (stars, enemies, asteroids, projectiles) is
// rotated and translated around it. Broadside arcs, drawn in world space around
// the player, therefore become screen-fixed wedges — port to the left, starboard
// to the right, forward cone up — exactly as in the design mockup.

let canvas = null;
let ctx = null;
let rot = 0; // current world rotation applied for the ship-up frame

export function initRenderer(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext("2d");
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

function worldToScreen(p) {
  const player = state.player;
  const dx = p.x - player.x;
  const dy = p.y - player.y;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return {
    x: canvas.width / 2 + dx * cos - dy * sin,
    y: canvas.height / 2 + dx * sin + dy * cos
  };
}

// Convert a mouse event to canvas pixel coordinates (accounting for CSS scaling).
export function eventToScreen(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

// Invert the ship-up camera: a canvas pixel maps to a world point and the world
// bearing from the player toward it. Because the ship is always drawn pointing
// up, a fixed cursor keeps the same bearing relative to the ship as it turns.
export function aimFromScreen(sx, sy) {
  const player = state.player;
  if (!player) return null;
  const dx = sx - canvas.width / 2;
  const dy = sy - canvas.height / 2;
  const wx = player.x + Math.cos(rot) * dx + Math.sin(rot) * dy;
  const wy = player.y - Math.sin(rot) * dx + Math.cos(rot) * dy;
  return { x: wx, y: wy, angle: Math.atan2(wy - player.y, wx - player.x) };
}

export function draw() {
  if (state.screen !== "combat" || !state.player) return;
  resizeCanvasToDisplay();
  const player = state.player;
  rot = -player.angle - Math.PI / 2; // align heading to screen-up

  const aim = state.mouseScreen ? aimFromScreen(state.mouseScreen.x, state.mouseScreen.y) : null;
  const aimSlot = aim ? slotForPrimaryAim(player, aim.angle) : null;

  ctx.fillStyle = PALETTE.spaceDeep;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Distant parallax starfield — moves slower than the foreground, so the ship
  // reads as an enormous, slow object gliding through depth.
  drawFarStars(player);

  // Screen shake offset (recoil / impacts) applied to the whole world frame.
  let shx = 0;
  let shy = 0;
  if ((state.shake || 0) > 0.3) {
    shx = (Math.random() - 0.5) * state.shake;
    shy = (Math.random() - 0.5) * state.shake;
  }

  ctx.save();
  ctx.translate(canvas.width / 2 + shx, canvas.height / 2 + shy);
  ctx.rotate(rot);
  ctx.translate(-player.x, -player.y);

  drawSpace();
  drawMapBounds();
  drawAsteroids();
  drawWeaponArcs(player, aimSlot);
  for (const enemy of state.enemies) {
    if (enemy.alive) drawShipBody(enemy);
  }
  drawShipBody(player);
  drawProjectiles();
  drawEffects();
  ctx.restore();

  state.shake = (state.shake || 0) * 0.85;

  // Screen-fixed overlays
  drawRangeRings();
  for (const enemy of state.enemies) {
    if (enemy.alive) drawShipLabel(enemy);
  }
  drawPlayerLabel();
  drawOffscreenTarget();
  drawAimReticle(aimSlot);
}

let farStars = [];

function ensureFarStars() {
  if (farStars.length) return;
  for (let i = 0; i < 160; i += 1) {
    farStars.push({
      x: Math.random() * WORLD.width,
      y: Math.random() * WORLD.height,
      r: 0.4 + Math.random() * 0.9,
      a: 0.18 + Math.random() * 0.32
    });
  }
}

// Parallax background drawn in its own transform at a reduced translation factor.
function drawFarStars(player) {
  ensureFarStars();
  const p = 0.4;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rot);
  ctx.translate(-player.x * p, -player.y * p);
  ctx.fillStyle = PALETTE.star;
  for (const star of farStars) {
    ctx.globalAlpha = star.a;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawSpace() {
  for (const star of state.stars) {
    ctx.globalAlpha = star.a;
    ctx.fillStyle = PALETTE.star;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.width; x += 320) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.height);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD.height; y += 320) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
  }
}

function drawMapBounds() {
  ctx.strokeStyle = PALETTE.bound;
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
}

function randomAsteroidPoint(index, radius) {
  const seed = Math.sin(index * 12.9898 + radius * 78.233) * 43758.5453;
  return 0.74 + (seed - Math.floor(seed)) * 0.32;
}

function drawAsteroids() {
  for (const asteroid of state.asteroids) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.angle);
    const gradient = ctx.createRadialGradient(-asteroid.radius * 0.35, -asteroid.radius * 0.4, 4, 0, 0, asteroid.radius);
    gradient.addColorStop(0, `rgba(${Math.round(120 * asteroid.shade)}, ${Math.round(140 * asteroid.shade)}, ${Math.round(150 * asteroid.shade)}, 1)`);
    gradient.addColorStop(1, "#2a333c");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#1a232c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const points = 10;
    for (let i = 0; i < points; i += 1) {
      const angle = (i / points) * Math.PI * 2;
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

const ARC_RGB = {
  forward: [240, 169, 61],
  port: [69, 224, 240],
  starboard: [69, 224, 240],
  torpedo: [255, 83, 71]
};

// Weapon arcs fade outward and are capped well short of full range, so they
// frame the ship rather than swallowing it — keeping the hulls reading as large.
function drawWeaponArcs(ship, aimSlot) {
  const weapons = playerWeaponDefinitions();
  const order = [
    ["forward", weapons.forward],
    ["port", weapons.port],
    ["starboard", weapons.starboard],
    ["torpedo", weapons.torpedo]
  ];
  for (const [slot, weapon] of order) {
    const center = getSlotAngle(ship.angle, slot);
    const width = degToRad(weapon.arc);
    const capR = Math.min(weapon.range, 300);
    const [r, g, b] = ARC_RGB[slot];
    const active = slot === aimSlot;
    const inner = `rgba(${r},${g},${b},${active ? 0.34 : 0.15})`;
    const outer = `rgba(${r},${g},${b},0)`;
    const grad = ctx.createRadialGradient(ship.x, ship.y, ship.radius * 0.5, ship.x, ship.y, capR);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    ctx.arc(ship.x, ship.y, capR, center - width / 2, center + width / 2);
    ctx.closePath();
    ctx.fill();
    if (active) {
      ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

const SHIP_SPECS = {
  player: {
    length: 168, width: 60, hull: "#86d6e8", hull2: "#37606e",
    light: "#d7fbff", deck: "#15384d", glow: "rgba(69,224,240,0.55)", engine: "#8ff0ff", turrets: 3
  },
  flagship: {
    length: 320, width: 116, hull: "#e0938a", hull2: "#7a3b38",
    light: "#ffd3c6", deck: "#3c1c1c", glow: "rgba(255,83,71,0.5)", engine: "#ff9b6b", turrets: 4
  },
  escort: {
    length: 58, width: 24, hull: "#e89088", hull2: "#6e3330",
    light: "#ffd9d2", deck: "#3a1c1c", glow: "rgba(255,83,71,0.4)", engine: "#ff9b6b", turrets: 0
  }
};

function drawEngines(spec, L, W, flare) {
  const sternX = -L * 0.5;
  const nozzles = spec.turrets >= 4 ? 3 : spec.turrets >= 3 ? 2 : 1;
  for (let i = 0; i < nozzles; i += 1) {
    const t = nozzles === 1 ? 0.5 : i / (nozzles - 1);
    const y = (t - 0.5) * W * 0.6;
    const len = W * 0.5 * flare;
    const grad = ctx.createLinearGradient(sternX, 0, sternX - len, 0);
    grad.addColorStop(0, spec.engine);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sternX, y - W * 0.08);
    ctx.lineTo(sternX - len, y);
    ctx.lineTo(sternX, y + W * 0.08);
    ctx.closePath();
    ctx.fill();
  }
}

function drawShipBody(ship) {
  const spec = SHIP_SPECS[ship.type];
  const L = spec.length;
  const W = spec.width;
  const isPlayer = ship.type === "player";
  const isEscort = ship.type === "escort";

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  // engine exhaust (behind hull); the player's flares up while thrusting
  const flare = isPlayer && state.keys.KeyW ? 1.7 + Math.random() * 0.3 : 0.85 + Math.random() * 0.15;
  drawEngines(spec, L, W, flare);

  // hull with a top-lit gradient for volume
  ctx.shadowColor = spec.glow;
  ctx.shadowBlur = isEscort ? 8 : 24;
  const hullGrad = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
  hullGrad.addColorStop(0, spec.hull);
  hullGrad.addColorStop(1, spec.hull2);
  ctx.fillStyle = hullGrad;
  ctx.strokeStyle = spec.light;
  ctx.lineWidth = isEscort ? 1.5 : 2;
  ctx.beginPath();
  ctx.moveTo(L * 0.5, 0);
  ctx.lineTo(L * 0.3, -W * 0.5);
  ctx.lineTo(-L * 0.42, -W * 0.5);
  ctx.lineTo(-L * 0.5, -W * 0.3);
  ctx.lineTo(-L * 0.5, W * 0.3);
  ctx.lineTo(-L * 0.42, W * 0.5);
  ctx.lineTo(L * 0.3, W * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // keel spine
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-L * 0.46, 0);
  ctx.lineTo(L * 0.46, 0);
  ctx.stroke();

  if (!isEscort) {
    // panel lines across the hull
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    for (let i = -2; i <= 2; i += 1) {
      const x = i * L * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, -W * 0.46);
      ctx.lineTo(x, W * 0.46);
      ctx.stroke();
    }

    // bridge superstructure
    ctx.fillStyle = spec.deck;
    ctx.fillRect(-L * 0.08, -W * 0.22, L * 0.3, W * 0.44);
    ctx.fillStyle = spec.light;
    ctx.fillRect(L * 0.12, -W * 0.07, L * 0.05, W * 0.14); // bridge block
    // bridge light
    ctx.fillStyle = isPlayer ? "#bff6ff" : "#ffd0c8";
    ctx.fillRect(L * 0.16, -2, 4, 4);

    // broadside turret blisters down each side
    ctx.fillStyle = spec.deck;
    ctx.strokeStyle = spec.light;
    ctx.lineWidth = 1;
    for (let i = 0; i < spec.turrets; i += 1) {
      const tx = L * (0.18 - i * (0.46 / spec.turrets));
      for (const sy of [-W * 0.42, W * 0.42]) {
        ctx.beginPath();
        ctx.arc(tx, sy, W * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // short barrel pointing outboard
        ctx.beginPath();
        ctx.moveTo(tx, sy);
        ctx.lineTo(tx, sy + Math.sign(sy) * W * 0.22);
        ctx.stroke();
      }
    }
  }

  // running lights: red to port (−y), green to starboard (+y)
  const lightCount = isEscort ? 2 : 5;
  for (let i = 0; i < lightCount; i += 1) {
    const x = L * (0.34 - (i / (lightCount - 1)) * 0.78);
    ctx.fillStyle = "#ff5347";
    ctx.fillRect(x, -W * 0.5 - 1, 2, 2);
    ctx.fillStyle = "#5fd17a";
    ctx.fillRect(x, W * 0.5 - 1, 2, 2);
  }

  // per-side shield envelope sized to the hull (+y starboard, −y port)
  const rx = L * 0.58;
  const ry = W * 0.85;
  for (const [side, a0, a1] of [["starboard", 0, Math.PI], ["port", Math.PI, Math.PI * 2]]) {
    const ratio = sideRatioShield(ship, side);
    if (ratio <= 0.02) continue;
    ctx.strokeStyle = isPlayer
      ? `rgba(69, 224, 240, ${0.12 + ratio * 0.34})`
      : `rgba(255, 122, 112, ${0.1 + ratio * 0.26})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, a0, a1);
    ctx.stroke();
  }
  ctx.restore();
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

function drawRangeRings() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const sensor = getSensorRange();
  ctx.save();
  ctx.strokeStyle = "rgba(70, 160, 180, 0.18)";
  ctx.lineWidth = 1;
  for (const r of [200, 400, 640]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // sensor edge ring
  ctx.strokeStyle = "rgba(69, 224, 240, 0.12)";
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(sensor, Math.max(canvas.width, canvas.height)), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawShipLabel(ship) {
  const pos = worldToScreen(ship);
  const margin = 60;
  if (pos.x < -margin || pos.x > canvas.width + margin || pos.y < -margin || pos.y > canvas.height + margin) return;
  const hull = hullRatio(ship);
  const barWidth = ship.type === "flagship" ? 110 : 64;
  const y = pos.y - ship.radius - 18;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(pos.x - barWidth / 2, y, barWidth, 5);
  ctx.fillStyle = hull > 0.45 ? PALETTE.success : hull > 0.22 ? PALETTE.amber : PALETTE.danger;
  ctx.fillRect(pos.x - barWidth / 2, y, barWidth * hull, 5);
  ctx.fillStyle = ship.type === "flagship" ? PALETTE.dangerSoft : "#d99";
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(ship.name.toUpperCase(), pos.x, y - 6);
}

function drawPlayerLabel() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.fillStyle = PALETTE.accent;
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("CWS RESOLUTE ◆ YOU", cx, cy + 104);
}

function drawOffscreenTarget() {
  const target = state.enemies.find((enemy) => enemy.type === "flagship" && enemy.alive);
  if (!target) return;
  const pos = worldToScreen(target);
  if (pos.x > 0 && pos.x < canvas.width && pos.y > 0 && pos.y < canvas.height) return;
  const center = { x: canvas.width / 2, y: canvas.height / 2 };
  const angle = Math.atan2(pos.y - center.y, pos.x - center.x);
  const radius = Math.min(canvas.width, canvas.height) * 0.42;
  const x = center.x + Math.cos(angle) * radius;
  const y = center.y + Math.sin(angle) * radius;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = PALETTE.amber;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAimReticle(aimSlot) {
  if (!state.mouseScreen) return;
  const { x, y } = state.mouseScreen;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const color = aimSlot === "forward" ? PALETTE.amber : aimSlot ? PALETTE.accent : PALETTE.muted;

  // faint firing line from the ship toward the cursor
  ctx.save();
  ctx.strokeStyle = aimSlot ? "rgba(69, 224, 240, 0.18)" : "rgba(127, 179, 192, 0.12)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();

  // reticle
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 16, y);
  ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 16, y);
  ctx.moveTo(x, y - 16);
  ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x, y + 16);
  ctx.stroke();
  ctx.restore();
}
