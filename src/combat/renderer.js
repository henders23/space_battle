"use strict";

import { state, WORLD } from "../state.js";
import { clamp, degToRad, distance } from "../utils.js";
import { PALETTE, ARC_COLORS } from "../data/theme.js";
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

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
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

  // Screen-fixed overlays
  drawRangeRings();
  for (const enemy of state.enemies) {
    if (enemy.alive) drawShipLabel(enemy);
  }
  drawPlayerLabel();
  drawOffscreenTarget();
  drawAimReticle(aimSlot);
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

const ARC_HIGHLIGHT = {
  forward: "rgba(240, 169, 61, 0.30)",
  port: "rgba(69, 224, 240, 0.30)",
  starboard: "rgba(69, 224, 240, 0.30)"
};

function drawWeaponArcs(ship, aimSlot) {
  const weapons = playerWeaponDefinitions();
  const arcs = [
    ["forward", weapons.forward, ARC_COLORS.forward],
    ["port", weapons.port, ARC_COLORS.port],
    ["starboard", weapons.starboard, ARC_COLORS.starboard],
    ["torpedo", weapons.torpedo, ARC_COLORS.torpedo]
  ];
  for (const [slot, weapon, color] of arcs) {
    const center = getSlotAngle(ship.angle, slot);
    const width = degToRad(weapon.arc);
    // The aim-selected battery glows so the player can see which weapon bears.
    ctx.fillStyle = slot === aimSlot ? ARC_HIGHLIGHT[slot] : color;
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    ctx.arc(ship.x, ship.y, weapon.range, center - width / 2, center + width / 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawShipBody(ship) {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  const isPlayer = ship.type === "player";
  const isFlagship = ship.type === "flagship";
  const length = isFlagship ? 128 : isPlayer ? 90 : 60;
  const width = isFlagship ? 46 : isPlayer ? 36 : 22;

  ctx.shadowColor = isPlayer ? "rgba(69,224,240,0.6)" : "rgba(255,83,71,0.45)";
  ctx.shadowBlur = isPlayer ? 22 : 14;
  ctx.fillStyle = isPlayer ? PALETTE.player : isFlagship ? PALETTE.flagship : PALETTE.enemy;
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

  // Per-side shield arcs: in the ship's local frame +y is starboard, -y is
  // port. Each half-ellipse brightens with that facing's remaining shield.
  const rx = ship.radius * 1.18;
  const ry = ship.radius * 0.86;
  const sides = [
    ["starboard", 0, Math.PI],
    ["port", Math.PI, Math.PI * 2]
  ];
  for (const [side, a0, a1] of sides) {
    const ratio = sideRatioShield(ship, side);
    if (ratio <= 0.02) continue;
    ctx.strokeStyle = isPlayer
      ? `rgba(69, 224, 240, ${0.14 + ratio * 0.36})`
      : `rgba(255, 122, 112, ${0.12 + ratio * 0.28})`;
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
  ctx.fillText("CWS RESOLUTE ◆ YOU", cx, cy + 60);
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
