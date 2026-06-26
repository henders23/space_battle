"use strict";

// Pure math / formatting helpers shared across the game. No imports.

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
  return a + angleWrap(b - a) * t;
}

export function degToRad(value) {
  return (value * Math.PI) / 180;
}

export function angleWrap(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function turnToward(current, desired, amount) {
  return current + clamp(angleWrap(desired - current), -amount, amount);
}

export function formatCredits(value) {
  return Math.round(value).toLocaleString();
}

export function formatTime(value) {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}
