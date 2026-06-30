"use strict";

import { state } from "../state.js";

// Captain's Log: the running, auto-written chronicle of the campaign. Entries are
// appended after each mission by evaluation.js (newest-first) and persisted on
// the career record; this screen just renders them.

const dom = {};

export function initLog() {
  dom.entries = document.getElementById("log-entries");
}

export function renderLog() {
  if (!dom.entries) return;
  const log = Array.isArray(state.career.log) ? state.career.log : [];
  if (!log.length) {
    dom.entries.innerHTML = `<p class="empty mono">The log is empty. Deploy and your command will start writing itself.</p>`;
    return;
  }
  dom.entries.innerHTML = log
    .map((entry) => {
      const tone = entry.result === "success" ? "success" : "danger";
      return (
        `<div class="log-entry">` +
        `<div class="log-meta mono">` +
        `<span class="log-cycle">CYCLE ${entry.cycle}</span>` +
        `<span class="log-where">${entry.rankShort} · ${entry.sector}</span>` +
        `<span class="log-grade" data-tone="${tone}">${entry.grade}</span>` +
        `</div>` +
        `<p class="log-text">${entry.text}</p>` +
        `</div>`
      );
    })
    .join("");
}
