"use strict";

import { state } from "../state.js";
import { clamp, degToRad, distance } from "../utils.js";
import { PALETTE } from "../data/theme.js";
import { getSlotAngle, playerWeaponDefinitions, slotForPrimaryAim } from "./weapons.js";
import { getSensorRange } from "./systems.js";
import { hullRatio, sideRatioShield } from "./shipStats.js";
import { focusPoint } from "./objectives.js";
import { initSprites, drawShipSprite, drawProjectileSprite } from "./sprites.js";

// North-up tactical renderer. The world keeps a fixed orientation; the camera
// follows the player but leads toward the action, so the player hull is no
// longer pinned to screen centre. Broadside arcs are drawn in world space around
// the player and so turn with the ship.

let canvas = null;
let ctx = null;
let rot = 0; // retained for math symmetry; the world frame is north-up (rot = 0)

// Smoothed camera centre (world coords) and the player it is tracking, so a new
// mission snaps the camera onto the fresh ship.
let cam = null;
let camPlayer = null;

let playerSprite = null; // offscreen canvas of the legacy player ship art (fallback)

export function initRenderer(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext("2d");
  initSprites();
  loadPlayerSprite();
}

// Lead the camera from the player toward the nearest hostile / objective so the
// player sits off-centre with the engagement in view; recentre when alone.
function updateCamera(player) {
  if (!cam || camPlayer !== player) {
    cam = { x: player.x, y: player.y };
    camPlayer = player;
  }
  const focus = focusPoint();
  const maxLead = 280;
  let tx = player.x;
  let ty = player.y;
  if (focus) {
    tx = player.x + clamp(focus.x - player.x, -maxLead, maxLead) * 0.5;
    ty = player.y + clamp(focus.y - player.y, -maxLead, maxLead) * 0.5;
  }
  cam.x += (tx - cam.x) * 0.06;
  cam.y += (ty - cam.y) * 0.06;
}

// A background pixel: either near-white or the bright green/yellow studio
// backdrop (high green, low blue). The hull is desaturated grey, so it fails.
function isBackgroundPixel(r, g, b) {
  if (Math.min(r, g, b) > 232) return true;
  return g > 95 && g - b > 34 && r - b > -12;
}

// Load the player ship artwork (a side-on render on a coloured backdrop) and
// remove the background by flood-filling inward from the image borders — this
// follows a gradient cleanly and stops at the high-contrast hull edge, leaving
// only the ship. Falls back silently to the vector ship if the asset is missing.
function loadPlayerSprite() {
  const img = new Image();
  img.onload = () => {
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d");
      octx.drawImage(img, 0, 0);
      const id = octx.getImageData(0, 0, w, h);
      const d = id.data;
      const visited = new Uint8Array(w * h);
      const stack = [];
      const seed = (x, y) => {
        const p = y * w + x;
        if (!visited[p]) {
          visited[p] = 1;
          stack.push(p);
        }
      };
      for (let x = 0; x < w; x += 1) {
        seed(x, 0);
        seed(x, h - 1);
      }
      for (let y = 0; y < h; y += 1) {
        seed(0, y);
        seed(w - 1, y);
      }
      while (stack.length) {
        const p = stack.pop();
        const i = p * 4;
        if (!isBackgroundPixel(d[i], d[i + 1], d[i + 2])) continue;
        d[i + 3] = 0;
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0 && !visited[p - 1]) { visited[p - 1] = 1; stack.push(p - 1); }
        if (x < w - 1 && !visited[p + 1]) { visited[p + 1] = 1; stack.push(p + 1); }
        if (y > 0 && !visited[p - w]) { visited[p - w] = 1; stack.push(p - w); }
        if (y < h - 1 && !visited[p + w]) { visited[p + w] = 1; stack.push(p + w); }
      }
      octx.putImageData(id, 0, 0);
      playerSprite = off;
    } catch (err) {
      playerSprite = null; // e.g. tainted canvas — keep the vector ship
    }
  };
  img.onerror = () => {
    playerSprite = null;
  };
  img.src = "assets/ship-player.png";
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
  return {
    x: canvas.width / 2 + (p.x - cam.x),
    y: canvas.height / 2 + (p.y - cam.y)
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
  if (!player || !cam) return null;
  const wx = cam.x + (sx - canvas.width / 2);
  const wy = cam.y + (sy - canvas.height / 2);
  return { x: wx, y: wy, angle: Math.atan2(wy - player.y, wx - player.x) };
}

export function draw() {
  if (state.screen !== "combat" || !state.player) return;
  resizeCanvasToDisplay();
  const player = state.player;
  rot = 0; // north-up world frame
  updateCamera(player);

  const aim = state.mouseScreen ? aimFromScreen(state.mouseScreen.x, state.mouseScreen.y) : null;
  const aimSlot = aim ? slotForPrimaryAim(player, aim.angle) : null;

  ctx.fillStyle = PALETTE.spaceDeep;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Distant parallax starfield — moves slower than the foreground, so the ship
  // reads as an enormous, slow object gliding through depth.
  drawFarStars();

  // Screen shake offset (recoil / impacts) applied to the whole world frame.
  let shx = 0;
  let shy = 0;
  if ((state.shake || 0) > 0.3) {
    shx = (Math.random() - 0.5) * state.shake;
    shy = (Math.random() - 0.5) * state.shake;
  }

  ctx.save();
  ctx.translate(canvas.width / 2 + shx, canvas.height / 2 + shy);
  ctx.translate(-cam.x, -cam.y);

  drawSpace();
  drawAsteroids();
  drawWeaponArcs(player, aimSlot);
  for (const ally of state.allies) {
    if (ally.alive) drawShipBody(ally);
  }
  for (const enemy of state.enemies) {
    if (enemy.spawned && enemy.alive) drawShipBody(enemy);
  }
  drawShipBody(player);
  drawProjectiles();
  drawEffects();
  ctx.restore();

  state.shake = (state.shake || 0) * 0.85;

  // Screen-fixed overlays
  drawRangeRings();
  for (const ally of state.allies) {
    if (ally.alive) drawShipLabel(ally);
  }
  for (const enemy of state.enemies) {
    if (enemy.spawned && enemy.alive) drawShipLabel(enemy);
  }
  drawPlayerLabel();
  drawOffscreenTarget();
  drawAimReticle(aimSlot);
}

// Star layers live in a repeating tile so the field is endless: each star is
// drawn at the tile copy nearest the camera, so there is never an edge or void.
const STAR_TILE = 2600;
let nearStars = [];
let farStars = [];

function ensureStars() {
  if (nearStars.length) return;
  for (let i = 0; i < 240; i += 1) {
    nearStars.push({
      x: Math.random() * STAR_TILE,
      y: Math.random() * STAR_TILE,
      r: 0.8 + Math.random() * 1.4,
      a: 0.3 + Math.random() * 0.65
    });
  }
  for (let i = 0; i < 200; i += 1) {
    farStars.push({
      x: Math.random() * STAR_TILE,
      y: Math.random() * STAR_TILE,
      r: 0.4 + Math.random() * 0.8,
      a: 0.16 + Math.random() * 0.34
    });
  }
}

function wrapNear(coord, ref) {
  const d = coord - ref;
  return ref + (d - STAR_TILE * Math.round(d / STAR_TILE));
}

function drawStarLayer(stars, refX, refY) {
  ctx.fillStyle = PALETTE.star;
  for (const star of stars) {
    const sx = wrapNear(star.x, refX);
    const sy = wrapNear(star.y, refY);
    ctx.globalAlpha = star.a;
    ctx.beginPath();
    ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Parallax background drawn in its own transform at a reduced translation factor.
function drawFarStars() {
  ensureStars();
  const p = 0.4;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.translate(-cam.x * p, -cam.y * p);
  drawStarLayer(farStars, cam.x * p, cam.y * p);
  ctx.restore();
}

function drawSpace() {
  ensureStars();
  drawStarLayer(nearStars, cam.x, cam.y);

  // Endless tactical grid: only the lines around the camera are drawn.
  const R = Math.hypot(canvas.width, canvas.height);
  const step = 320;
  const x0 = Math.floor((cam.x - R) / step) * step;
  const y0 = Math.floor((cam.y - R) / step) * step;
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  for (let x = x0; x <= cam.x + R; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, cam.y - R);
    ctx.lineTo(x, cam.y + R);
    ctx.stroke();
  }
  for (let y = y0; y <= cam.y + R; y += step) {
    ctx.beginPath();
    ctx.moveTo(cam.x - R, y);
    ctx.lineTo(cam.x + R, y);
    ctx.stroke();
  }
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
  },
  raider: {
    length: 44, width: 18, hull: "#f0a07e", hull2: "#7a3b28",
    light: "#ffe0d2", deck: "#3a1c14", glow: "rgba(255,120,80,0.4)", engine: "#ffb07b", turrets: 0
  },
  frigate: {
    length: 82, width: 34, hull: "#e89088", hull2: "#6e3330",
    light: "#ffd9d2", deck: "#3a1c1c", glow: "rgba(255,83,71,0.42)", engine: "#ff9b6b", turrets: 1
  },
  missile_boat: {
    length: 72, width: 32, hull: "#e0a878", hull2: "#6e4a30",
    light: "#ffe7c8", deck: "#3a2c18", glow: "rgba(255,180,90,0.4)", engine: "#ffcf6b", turrets: 0
  },
  cruiser: {
    length: 150, width: 62, hull: "#dd8a82", hull2: "#6e302c",
    light: "#ffd3c6", deck: "#3a1818", glow: "rgba(255,83,71,0.45)", engine: "#ff9b6b", turrets: 3
  },
  transport: {
    length: 96, width: 44, hull: "#8fd6a8", hull2: "#3e6e52",
    light: "#d7fbe6", deck: "#16402c", glow: "rgba(95,209,122,0.4)", engine: "#9ff0b8", turrets: 0
  },
  station: {
    length: 170, width: 132, hull: "#9ec8c0", hull2: "#3c5b56",
    light: "#e6fbf5", deck: "#163c38", glow: "rgba(69,224,240,0.4)", engine: "#8ff0ff", turrets: 3
  },
  disabled: {
    length: 104, width: 46, hull: "#8a9e94", hull2: "#3a4842",
    light: "#cfe2da", deck: "#22302a", glow: "rgba(120,140,130,0.3)", engine: "#5a6a62", turrets: 0
  }
};

function drawEngines(spec, sternX, spanW, flare) {
  const nozzles = spec.turrets >= 4 ? 3 : spec.turrets >= 3 ? 2 : 1;
  for (let i = 0; i < nozzles; i += 1) {
    const t = nozzles === 1 ? 0.5 : i / (nozzles - 1);
    const y = (t - 0.5) * spanW * 0.6;
    const len = spanW * 0.5 * flare;
    const grad = ctx.createLinearGradient(sternX, 0, sternX - len, 0);
    grad.addColorStop(0, spec.engine);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sternX, y - spanW * 0.08);
    ctx.lineTo(sternX - len, y);
    ctx.lineTo(sternX, y + spanW * 0.08);
    ctx.closePath();
    ctx.fill();
  }
}

// Faction sheet sprite drawn in world space, with a live engine flare behind the
// player's stern and a per-side shield bubble. Returns false if the sprite art
// for this hull hasn't loaded yet (so the vector fallback can run).
function drawSheetShip(ship, spec, flare, friendly) {
  const isPlayer = ship.type === "player";
  // engine exhaust behind the sprite stern (the player's pulses with throttle)
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  drawEngines(spec, -ship.radius * 1.55, ship.radius * 1.3, flare * (isPlayer ? 1 : 0.8));
  ctx.restore();

  if (!drawShipSprite(ctx, ship)) return false;

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  drawShieldEnvelope(ship, ship.radius * 2.6, ship.radius * 1.5, friendly);
  ctx.restore();
  return true;
}

function drawShipBody(ship) {
  const spec = SHIP_SPECS[ship.type];
  const L = spec.length;
  const W = spec.width;
  const isPlayer = ship.type === "player";
  const isEscort = ship.type === "escort" || ship.type === "raider";
  const friendly = ship.team === "player" || ship.team === "ally";

  // engine exhaust (behind hull); the player's scales with throttle setting
  const flare = isPlayer
    ? (0.5 + (ship.throttle || 0) * 0.45) * (0.92 + Math.random() * 0.16)
    : 0.85 + Math.random() * 0.15;

  // Prefer the faction sheet sprite; fall back to the legacy photo / vector hull.
  if (drawSheetShip(ship, spec, flare, friendly)) return;

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  // Player ship uses the photographic sprite when available; the bow in the art
  // points right (+x), matching the ship's local heading, so no extra rotation.
  if (isPlayer && playerSprite) {
    const scale = ship.spriteScale || 1.7;
    const drawW = L * scale;
    const drawH = drawW * (playerSprite.height / playerSprite.width);
    drawEngines(spec, -drawW * 0.46, W * scale * 0.95, flare); // burn behind the sprite stern
    ctx.shadowColor = spec.glow;
    ctx.shadowBlur = 16;
    ctx.drawImage(playerSprite, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.shadowBlur = 0;
    drawShieldEnvelope(ship, L * scale, W * scale, friendly);
    ctx.restore();
    return;
  }

  drawEngines(spec, -L * 0.5, W, flare);

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

  drawShieldEnvelope(ship, L, W, friendly);
  ctx.restore();
}

// Per-side shield envelope sized to the hull (+y starboard, −y port).
function drawShieldEnvelope(ship, L, W, friendly) {
  const rx = L * 0.58;
  const ry = W * 0.85;
  for (const [side, a0, a1] of [["starboard", 0, Math.PI], ["port", Math.PI, Math.PI * 2]]) {
    const ratio = sideRatioShield(ship, side);
    if (ratio <= 0.02) continue;
    ctx.strokeStyle = friendly
      ? `rgba(69, 224, 240, ${0.12 + ratio * 0.34})`
      : `rgba(255, 122, 112, ${0.1 + ratio * 0.26})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, a0, a1);
    ctx.stroke();
  }
}

function drawProjectiles() {
  const TAU = Math.PI * 2;
  ctx.lineCap = "round";
  for (const p of state.projectiles) {
    // glowing tracer trail, brightening toward the head
    const n = p.trail.length;
    for (let i = 1; i < n; i += 1) {
      const f = i / n;
      ctx.globalAlpha = f * 0.55;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = (p.torpedo ? 3.5 : 2.2) * f + 0.4;
      ctx.beginPath();
      ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
      ctx.lineTo(p.trail[i].x, p.trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Pack sprite for the round; fall back to a procedural glowing head.
    if (drawProjectileSprite(ctx, p)) {
      ctx.shadowBlur = 0;
      continue;
    }
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.torpedo ? 16 : 9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 1, 0, TAU);
    ctx.fill();
    // bright core
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, p.radius * 0.5), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.lineCap = "butt";
}

function drawEffects() {
  const TAU = Math.PI * 2;
  for (const e of state.effects) {
    const t = Math.max(0, e.life / e.maxLife);
    if (e.kind === "ring") {
      ctx.globalAlpha = t * 0.9;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * (1 + (1 - t) * (e.grow || 2.4)), 0, TAU);
      ctx.stroke();
    } else if (e.kind === "flash") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = t;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * (0.6 + 0.4 * t), 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    } else if (e.kind === "spark") {
      ctx.globalAlpha = t;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x - e.vx * 0.03, e.y - e.vy * 0.03);
      ctx.stroke();
      ctx.lineCap = "butt";
    } else if (e.kind === "smoke") {
      ctx.globalAlpha = t * 0.3;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * (1.2 - t * 0.4), 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawRangeRings() {
  const ps = worldToScreen(state.player);
  const cx = ps.x;
  const cy = ps.y;
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
  const friendly = ship.team === "ally";
  const barWidth = ship.type === "flagship" || ship.type === "station" ? 110 : 64;
  const y = pos.y - ship.radius - 18;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(pos.x - barWidth / 2, y, barWidth, 5);
  ctx.fillStyle = hull > 0.45 ? PALETTE.success : hull > 0.22 ? PALETTE.amber : PALETTE.danger;
  ctx.fillRect(pos.x - barWidth / 2, y, barWidth * hull, 5);
  ctx.fillStyle = friendly ? PALETTE.accent : ship.type === "flagship" ? PALETTE.dangerSoft : "#d99";
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(ship.name.toUpperCase(), pos.x, y - 6);
}

function drawPlayerLabel() {
  const ps = worldToScreen(state.player);
  ctx.fillStyle = PALETTE.accent;
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  const name = (state.player && state.player.name) || "CWS Vanguard";
  ctx.fillText(`${name.toUpperCase()} ◆ YOU`, ps.x, ps.y + state.player.radius + 26);
}

function drawOffscreenTarget() {
  const target = focusPoint();
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
  const ps = worldToScreen(state.player);
  const cx = ps.x;
  const cy = ps.y;
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
