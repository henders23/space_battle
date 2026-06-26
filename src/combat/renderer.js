"use strict";

import { state, WORLD } from "../state.js";
import { clamp, degToRad, distance } from "../utils.js";
import { PALETTE, ARC_COLORS } from "../data/theme.js";
import { getSlotAngle, playerWeaponDefinitions } from "./weapons.js";
import { getSensorRange } from "./systems.js";

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

export function draw() {
  if (state.screen !== "combat" || !state.player) return;
  resizeCanvasToDisplay();
  const player = state.player;
  rot = -player.angle - Math.PI / 2; // align heading to screen-up

  ctx.fillStyle = PALETTE.spaceDeep;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rot);
  ctx.translate(-player.x, -player.y);

  drawSpace();
  drawMapBounds();
  drawAsteroids();
  drawWeaponArcs(player);
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

function drawWeaponArcs(ship) {
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
    ctx.fillStyle = color;
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
  const length = isFlagship ? 92 : isPlayer ? 64 : 44;
  const width = isFlagship ? 34 : isPlayer ? 26 : 16;

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

  if (ship.shields > 1) {
    const shieldRatio = ship.shields / ship.shieldsMax;
    ctx.strokeStyle = isPlayer
      ? `rgba(69, 224, 240, ${0.18 + shieldRatio * 0.3})`
      : `rgba(255, 122, 112, ${0.16 + shieldRatio * 0.22})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, ship.radius * 1.18, ship.radius * 0.82, 0, 0, Math.PI * 2);
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
  const hull = clamp(ship.hull / ship.hullMax, 0, 1);
  const barWidth = ship.type === "flagship" ? 92 : 54;
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
