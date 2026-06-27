"use strict";

// Procedural combat sound effects via the Web Audio API — no audio files needed.
// Everything is synthesised from noise bursts and short oscillator tones. The
// context is created lazily on the first user gesture (unlockSfx) and scaled by
// the shared music volume / mute.

let ctx = null;
let master = null;
let noiseBuffer = null;
let level = 0.55; // master gain when unmuted
let muted = false;

const SFX_MAX = 0.55;

export function unlockSfx() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : level;
  master.connect(ctx.destination);

  const len = Math.floor(ctx.sampleRate * 1);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
}

export function setLevel(volume, isMuted) {
  level = Math.max(0, Math.min(1, volume)) * SFX_MAX;
  muted = isMuted;
  if (master) master.gain.value = muted ? 0 : level;
}

function t() {
  return ctx.currentTime;
}

function env(attack, decay, peak) {
  const g = ctx.createGain();
  const start = t();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  return g;
}

function noise() {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer;
  s.loop = true;
  return s;
}

function tone(type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

export function gunFire(kind) {
  if (!ctx) return;
  const power = kind === "broadside" ? 1 : kind === "heavy" || kind === "torpedo" ? 0.85 : 0.5;
  const s = noise();
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1000 - power * 350;
  bp.Q.value = 0.8;
  const g = env(0.002, 0.08 + power * 0.14, 0.2 + power * 0.55);
  s.connect(bp);
  bp.connect(g);
  g.connect(master);
  s.start();
  s.stop(t() + 0.35);
  if (power > 0.6) {
    const o = tone("sine", 75);
    o.frequency.exponentialRampToValueAtTime(38, t() + 0.18);
    const g2 = env(0.002, 0.2, 0.5 * power);
    o.connect(g2);
    g2.connect(master);
    o.start();
    o.stop(t() + 0.26);
  }
}

export function shieldHit() {
  if (!ctx) return;
  const o = tone("square", 540);
  o.frequency.exponentialRampToValueAtTime(180, t() + 0.12);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 320;
  const g = env(0.001, 0.13, 0.22);
  o.connect(hp);
  hp.connect(g);
  g.connect(master);
  o.start();
  o.stop(t() + 0.16);
}

export function hullHit() {
  if (!ctx) return;
  const o = tone("triangle", 150);
  o.frequency.exponentialRampToValueAtTime(64, t() + 0.1);
  const g = env(0.001, 0.13, 0.4);
  o.connect(g);
  g.connect(master);
  o.start();
  o.stop(t() + 0.16);
  const s = noise();
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1300;
  const g2 = env(0.001, 0.08, 0.28);
  s.connect(lp);
  lp.connect(g2);
  g2.connect(master);
  s.start();
  s.stop(t() + 0.12);
}

export function explosion(scale = 1) {
  if (!ctx) return;
  const dur = 0.4 + scale * 0.55;
  const s = noise();
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1600, t());
  lp.frequency.exponentialRampToValueAtTime(180, t() + dur);
  const g = env(0.005, dur, Math.min(0.95, 0.5 + scale * 0.32));
  s.connect(lp);
  lp.connect(g);
  g.connect(master);
  s.start();
  s.stop(t() + dur + 0.1);
  const o = tone("sine", 130);
  o.frequency.exponentialRampToValueAtTime(34, t() + dur * 0.85);
  const g2 = env(0.005, dur * 0.9, 0.5 * Math.min(1.3, scale));
  o.connect(g2);
  g2.connect(master);
  o.start();
  o.stop(t() + dur);
}

// A short, clean interface blip for menu / button interactions.
export function uiBeep(kind = "select") {
  if (!ctx) return;
  const freq = kind === "confirm" ? 660 : kind === "back" ? 300 : 480;
  const o = tone("triangle", freq);
  if (kind === "confirm") o.frequency.exponentialRampToValueAtTime(freq * 1.5, t() + 0.08);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 200;
  const g = env(0.002, 0.07, 0.12);
  o.connect(hp);
  hp.connect(g);
  g.connect(master);
  o.start();
  o.stop(t() + 0.1);
}

export function alarm() {
  if (!ctx) return;
  [[0, 680], [0.2, 520]].forEach(([offset, freq]) => {
    const o = tone("square", freq);
    const g = ctx.createGain();
    const start = t() + offset;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.18, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    o.connect(g);
    g.connect(master);
    o.start(start);
    o.stop(start + 0.18);
  });
}
