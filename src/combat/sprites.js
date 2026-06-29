"use strict";

// Sprite atlas for the tactical view. Ship art is sliced from the faction sheets
// (Commonwealth = player + allies, Veyr/United Front = hostiles) and projectiles
// come from the premium projectile pack. All source art points "up" (toward -Y),
// so every sprite is drawn rotated by the entity heading + 90°.

const SHIP_KEYS = [
  "cw_01", "cw_02", "cw_03", "cw_04", "cw_05", "cw_06", "cw_07", "cw_08",
  "veyr_01", "veyr_02", "veyr_03", "veyr_04", "veyr_05", "veyr_06", "veyr_07", "veyr_08",
  "uf_01", "uf_02", "uf_03", "uf_04", "uf_05", "uf_06", "uf_07", "uf_08"
];

const PROJECTILE_KEYS = {
  lance_cyan: "assets/projectiles/lance_cyan.png",
  shell_he: "assets/projectiles/shell_he.png",
  torp_red: "assets/projectiles/torp_red.png",
  pulse_red: "assets/projectiles/pulse_red.png",
  plasma_red: "assets/projectiles/plasma_red.png",
  missile_orange: "assets/projectiles/missile_orange.png"
};

const shipImages = {};
const projectileImages = {};

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

export function initSprites() {
  for (const key of SHIP_KEYS) shipImages[key] = loadImage(`assets/ships/${key}.png`);
  for (const [key, src] of Object.entries(PROJECTILE_KEYS)) projectileImages[key] = loadImage(src);
}

function ready(img) {
  return img && img.complete && img.naturalWidth > 0;
}

// Player + allied hulls fly Commonwealth colours; the Dominion fields a mix of
// Veyr Collective capital ships and United Front auxiliaries.
const SHIP_SPRITE_MAP = {
  flagship: "veyr_08",
  raider: "uf_01",
  escort: "uf_02",
  frigate: "veyr_03",
  missile_boat: "uf_04",
  cruiser: "veyr_06",
  transport: "cw_03",
  station: "cw_08",
  disabled: "cw_01"
};

const PLAYER_HULL_SPRITE = {
  Frigate: "cw_02",
  Cruiser: "cw_05",
  Battleship: "cw_07"
};

function spriteKeyForShip(ship) {
  if (ship.spriteKey) return ship.spriteKey;
  if (ship.type === "player") return PLAYER_HULL_SPRITE[ship.hullClass] || "cw_05";
  return SHIP_SPRITE_MAP[ship.type] || null;
}

// Visual length of a hull on screen, scaled from its collision radius so the
// sprite reads at roughly the same footprint as the old vector ships.
function shipDrawLength(ship) {
  const base = ship.type === "player" ? 3.4 : ship.type === "flagship" ? 3.1 : 3.0;
  return ship.radius * base;
}

// Draw the hull sprite centred on the ship, nose aligned to its heading. Returns
// false (so the renderer can fall back to vector art) if the sprite isn't ready.
export function drawShipSprite(ctx, ship) {
  const key = spriteKeyForShip(ship);
  const img = key && shipImages[key];
  if (!ready(img)) return false;
  const len = shipDrawLength(ship);
  const w = len * (img.naturalWidth / img.naturalHeight);
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle + Math.PI / 2); // sheet art points up; +90° aligns to +X heading
  ctx.drawImage(img, -w / 2, -len / 2, w, len);
  ctx.restore();
  return true;
}

// Draw a projectile as its pack sprite, rotated to its travel direction. Returns
// false to fall back to the procedural tracer if the art isn't loaded.
export function drawProjectileSprite(ctx, p) {
  const img = p.sprite && projectileImages[p.sprite];
  if (!ready(img)) return false;
  const len = Math.max(14, (p.radius || 4) * (p.torpedo ? 4.4 : 3.6));
  const w = len * (img.naturalWidth / img.naturalHeight);
  const angle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.shadowColor = p.color;
  ctx.shadowBlur = p.torpedo ? 14 : 8;
  ctx.drawImage(img, -w / 2, -len / 2, w, len);
  ctx.restore();
  return true;
}

// Which projectile sprite a fired weapon should use.
export function projectileSpriteFor(owner, slot, weapon) {
  if (owner === "player") {
    if (slot === "torpedo" || weapon.torpedo) return "torp_red";
    if (slot === "forward") return "lance_cyan";
    return "shell_he";
  }
  if (weapon.torpedo) return "missile_orange";
  if (slot === "forward") return "pulse_red";
  return "plasma_red";
}
