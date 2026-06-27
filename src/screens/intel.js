"use strict";

import { state } from "../state.js";
import { SECTORS } from "../data/sectors.js";
import { ensureWar, sectorState, controlInfo, warSummary } from "../game/warMap.js";

// War News / Intelligence: the theatre-wide picture — overall front status, the
// full bulletin log, and a per-sector intelligence table.

const dom = {};

export function initIntel() {
  dom.summary = document.getElementById("intel-summary");
  dom.news = document.getElementById("intel-news");
  dom.sectors = document.getElementById("intel-sectors");
}

function summaryCard() {
  const s = warSummary();
  return (
    `<div class="intel-status">` +
    `<span class="mono eyebrow">FRONT STATUS</span>` +
    `<b class="intel-status-name">${s.status}</b>` +
    `<span class="mono dim">WAR CYCLE ${s.cycle} · AVG THREAT ${Math.round(s.avgThreat)}</span>` +
    `</div>` +
    `<div class="intel-counts">` +
    `<div class="intel-count"><b style="color:#45e0f0">${s.counts.commonwealth}</b><span class="mono">COMMONWEALTH</span></div>` +
    `<div class="intel-count"><b style="color:#f0a93d">${s.counts.contested}</b><span class="mono">CONTESTED</span></div>` +
    `<div class="intel-count"><b style="color:#ff5347">${s.counts.veyr}</b><span class="mono">DOMINION</span></div>` +
    `</div>`
  );
}

function newsList() {
  const news = state.career.war.news;
  if (!news.length) {
    return `<p class="empty mono">No bulletins on file. Deploy to a contested sector to generate fresh intelligence.</p>`;
  }
  return news
    .map(
      (n) =>
        `<div class="news-line"><span class="mono news-cycle ${n.tone}">CYCLE ${n.cycle}</span>` +
        `<span class="news-text">${n.text}</span></div>`
    )
    .join("");
}

function sectorTable() {
  return SECTORS.map((def) => {
    const sec = sectorState(def.id);
    const info = controlInfo(sec.control);
    return (
      `<div class="intel-row">` +
      `<span class="intel-dot" style="background:${info.color}"></span>` +
      `<span class="intel-name">${def.name}</span>` +
      `<span class="intel-control mono" style="color:${info.color}">${info.label}</span>` +
      `<span class="intel-stat mono">THR ${Math.round(sec.threat)}</span>` +
      `<span class="intel-stat mono">STA ${Math.round(sec.stability)}</span>` +
      `<span class="intel-stat mono">FLT ${Math.round(sec.enemyFleet)}</span>` +
      `</div>`
    );
  }).join("");
}

export function renderIntel() {
  ensureWar();
  if (dom.summary) dom.summary.innerHTML = summaryCard();
  if (dom.news) dom.news.innerHTML = newsList();
  if (dom.sectors) dom.sectors.innerHTML = sectorTable();
}
