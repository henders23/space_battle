"use strict";

import { state } from "../state.js";
import { currentRank, currentReputation, ensureShipIdentity } from "../career.js";
import { rankPoints, RANKS } from "../data/ranks.js";
import { COMMENDATIONS, REPRIMANDS } from "../data/commendations.js";
import { HULLS } from "../data/ships.js";

// Service Record: the captain's identity, rank and progression, the permanent
// commendations / reprimands file, and lifetime career statistics.

const dom = {};

export function initService() {
  dom.header = document.getElementById("service-header");
  dom.progress = document.getElementById("service-progress");
  dom.ship = document.getElementById("service-ship");
  dom.awards = document.getElementById("service-awards");
  dom.stats = document.getElementById("service-stats");
}

function headerCard() {
  const rank = currentRank();
  const ship = HULLS[state.career.ship] ? HULLS[state.career.ship].name : "Frigate";
  return (
    `<p class="mono eyebrow">COMMONWEALTH NAVY // SERVICE FILE</p>` +
    `<h3 class="service-name">${rank.name} ${state.career.captainName}</h3>` +
    `<p class="mono dim">${currentReputation().toUpperCase()} · ${ship.toUpperCase()} COMMAND</p>`
  );
}

function progressCard() {
  const rank = currentRank();
  const points = rankPoints(state.career);
  const base = RANKS[rank.index].points;
  const next = rank.next;
  let bar = "";
  if (next) {
    const span = next.points - base;
    const pct = span > 0 ? Math.round(((points - base) / span) * 100) : 100;
    bar =
      `<div class="service-track"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>` +
      `<span class="mono dim">${rank.pointsToNext} service point${rank.pointsToNext === 1 ? "" : "s"} to ${next.name}</span>`;
  } else {
    bar = `<span class="mono dim">Highest rank attained — ${points} service points.</span>`;
  }
  return `<span class="mono eyebrow">PROMOTION</span>${bar}`;
}

function shipCard() {
  const id = ensureShipIdentity();
  const className = HULLS[id.shipKey] ? HULLS[id.shipKey].className : "Warship";
  let html =
    `<span class="mono eyebrow">SHIP IN SERVICE</span>` +
    `<h3 class="service-ship-name">${id.name}</h3>` +
    `<p class="mono dim">${className.toUpperCase()} · ${id.battles} engagement${id.battles === 1 ? "" : "s"} · commissioned cycle ${id.commissioned}</p>`;

  const honours = id.honours || [];
  const scars = id.scars || [];
  if (!honours.length && !scars.length) {
    return html + `<p class="empty mono">A fresh hull — no honours or scars yet.</p>`;
  }
  for (const h of honours) {
    html +=
      `<div class="award-row" data-kind="commendation">` +
      `<span class="award-icon">✦</span>` +
      `<div class="award-info"><span class="award-name">${h}</span></div></div>`;
  }
  for (const s of scars) {
    html +=
      `<div class="award-row" data-kind="reprimand">` +
      `<span class="award-icon">⚒</span>` +
      `<div class="award-info"><span class="award-name">${s.label}</span>` +
      `<span class="award-text mono">War cycle ${s.cycle}</span></div></div>`;
  }
  return html;
}

function awardsCard() {
  const rec = state.career.record;
  const commendations = (rec.commendations || []).map((id) => COMMENDATIONS[id]).filter(Boolean);
  const reprimands = (rec.reprimands || []).map((id) => REPRIMANDS[id]).filter(Boolean);
  let html = "";
  if (!commendations.length && !reprimands.length) {
    return `<p class="empty mono">No commendations or reprimands on record.</p>`;
  }
  for (const c of commendations) {
    html +=
      `<div class="award-row" data-kind="commendation">` +
      `<span class="award-icon">✦</span>` +
      `<div class="award-info"><span class="award-name">${c.name}</span>` +
      `<span class="award-text mono">${c.text}</span></div></div>`;
  }
  for (const r of reprimands) {
    html +=
      `<div class="award-row" data-kind="reprimand">` +
      `<span class="award-icon">✖</span>` +
      `<div class="award-info"><span class="award-name">${r.name}</span>` +
      `<span class="award-text mono">${r.text}</span></div></div>`;
  }
  return html;
}

function statsCard() {
  const r = state.career.record;
  const total = r.missionsCompleted + r.missionsFailed;
  const rows = [
    ["Operations completed", r.missionsCompleted],
    ["Operations failed", r.missionsFailed],
    ["Total deployments", total],
    ["Best grade", r.bestGrade],
    ["Flagships destroyed", r.flagshipsDestroyed],
    ["Escorts destroyed", r.escortsDestroyed],
    ["Enemy tonnage", `${r.enemyTonnage.toLocaleString()} t`],
    ["Hull-critical actions", r.timesHullCritical]
  ];
  return rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
}

export function renderService() {
  if (dom.header) dom.header.innerHTML = headerCard();
  if (dom.progress) dom.progress.innerHTML = progressCard();
  if (dom.ship) dom.ship.innerHTML = shipCard();
  if (dom.awards) dom.awards.innerHTML = awardsCard();
  if (dom.stats) dom.stats.innerHTML = statsCard();
}
