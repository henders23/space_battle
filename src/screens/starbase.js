"use strict";

import { state } from "../state.js";
import { formatCredits } from "../utils.js";
import { forwardLoadouts, broadsideLoadouts, utilityLoadouts } from "../data/loadouts.js";
import { HULLS, HULL_ORDER } from "../data/ships.js";
import {
  calculateRepairCost,
  currentReputation,
  currentRank,
  repairShip,
  saveCareer,
  isOwned,
  buyItem,
  ownsShip,
  buyShip,
  equipShip
} from "../career.js";

// Starbase refit hub: repair economy, owned-loadout selection, the armory
// (purchasable weapons/modules), career stats, and mission history.

const dom = {};

// Each purchasable category maps to its data table and a readable label.
const CATEGORIES = [
  { key: "forward", map: forwardLoadouts, label: "Forward Weapon" },
  { key: "broadside", map: broadsideLoadouts, label: "Broadside" },
  { key: "utility", map: utilityLoadouts, label: "Utility Module" }
];

function populateSelect(select, options, ownedKeys, currentKey) {
  select.innerHTML = "";
  Object.entries(options).forEach(([key, item]) => {
    if (!ownedKeys.includes(key)) return;
    const option = document.createElement("option");
    option.value = key;
    option.textContent = item.name;
    option.title = item.description;
    option.selected = key === currentKey;
    select.appendChild(option);
  });
}

export function initStarbase() {
  dom.forwardSelect = document.getElementById("forward-select");
  dom.portSelect = document.getElementById("port-select");
  dom.starboardSelect = document.getElementById("starboard-select");
  dom.utilitySelect = document.getElementById("utility-select");
  dom.baseCaptain = document.getElementById("base-captain");
  dom.baseRank = document.getElementById("base-rank");
  dom.baseCredits = document.getElementById("base-credits");
  dom.baseReputation = document.getElementById("base-reputation");
  dom.baseHull = document.getElementById("base-hull");
  dom.baseRepairCost = document.getElementById("base-repair-cost");
  dom.baseMissions = document.getElementById("base-missions");
  dom.baseBest = document.getElementById("base-best");
  dom.baseTonnage = document.getElementById("base-tonnage");
  dom.baseShipclass = document.getElementById("base-shipclass");
  dom.missionPreview = document.getElementById("mission-preview");
  dom.repairShip = document.getElementById("repair-ship");
  dom.armoryList = document.getElementById("armory-list");
  dom.historyList = document.getElementById("history-list");
  dom.shipyardList = document.getElementById("shipyard-list");

  dom.forwardSelect.addEventListener("change", (e) => setLoadout("forward", e.target.value));
  dom.portSelect.addEventListener("change", (e) => setLoadout("port", e.target.value));
  dom.starboardSelect.addEventListener("change", (e) => setLoadout("starboard", e.target.value));
  dom.utilitySelect.addEventListener("change", (e) => setLoadout("utility", e.target.value));

  dom.repairShip.addEventListener("click", () => {
    if (repairShip()) updateStarbase();
  });
}

function setLoadout(slot, value) {
  state.career.loadout[slot] = value;
  saveCareer();
  updateStarbase();
}

function refreshSelects() {
  const owned = state.career.owned;
  populateSelect(dom.forwardSelect, forwardLoadouts, owned.forward, state.career.loadout.forward);
  populateSelect(dom.portSelect, broadsideLoadouts, owned.broadside, state.career.loadout.port);
  populateSelect(dom.starboardSelect, broadsideLoadouts, owned.broadside, state.career.loadout.starboard);
  populateSelect(dom.utilitySelect, utilityLoadouts, owned.utility, state.career.loadout.utility);
}

function buildArmory() {
  dom.armoryList.innerHTML = "";
  let anyLocked = false;
  for (const { key: category, map, label } of CATEGORIES) {
    for (const [itemKey, item] of Object.entries(map)) {
      if (isOwned(category, itemKey)) continue;
      anyLocked = true;
      const row = document.createElement("div");
      row.className = "armory-row";
      const afford = state.career.credits >= item.cost;
      row.innerHTML =
        `<div class="armory-info">` +
        `<span class="armory-name">${item.name}</span>` +
        `<span class="armory-meta mono">${label} · ${item.description}</span>` +
        `</div>` +
        `<span class="armory-cost mono">${formatCredits(item.cost)}</span>`;
      const buy = document.createElement("button");
      buy.textContent = "Buy";
      buy.disabled = !afford;
      buy.addEventListener("click", () => {
        if (buyItem(category, itemKey, item.cost)) updateStarbase();
      });
      row.appendChild(buy);
      dom.armoryList.appendChild(row);
    }
  }
  if (!anyLocked) {
    dom.armoryList.innerHTML = `<p class="empty mono">All systems acquired. Fleet inventory exhausted.</p>`;
  }
}

function buildShipyard() {
  if (!dom.shipyardList) return;
  dom.shipyardList.innerHTML = "";
  const rep = state.career.reputationScore;
  for (const key of HULL_ORDER) {
    const h = HULLS[key];
    const owned = ownsShip(key);
    const current = state.career.ship === key;
    const row = document.createElement("div");
    row.className = "shipyard-row" + (current ? " current" : "");
    const stats =
      `Hull ${h.hullSide * 2} · Shields ${h.shieldSide * 2} · ` +
      `Speed ${h.speeds[3]} · ${key === "frigate" ? "Agile" : key === "cruiser" ? "Balanced" : "Heavy"}`;
    row.innerHTML =
      `<div class="shipyard-info">` +
      `<span class="shipyard-name">${h.className}</span>` +
      `<span class="shipyard-stats mono">${stats}</span>` +
      `<span class="shipyard-desc">${h.desc}</span>` +
      `</div>`;

    const btn = document.createElement("button");
    if (current) {
      btn.textContent = "In Service";
      btn.disabled = true;
    } else if (owned) {
      btn.textContent = "Commission";
      btn.addEventListener("click", () => {
        if (equipShip(key)) updateStarbase();
      });
    } else if (rep < h.reqReputation) {
      btn.textContent = `Needs Rep ${h.reqReputation}`;
      btn.disabled = true;
    } else {
      btn.textContent = `Buy ${formatCredits(h.cost)}`;
      btn.disabled = state.career.credits < h.cost;
      btn.addEventListener("click", () => {
        if (buyShip(key, h.cost)) updateStarbase();
      });
    }
    row.appendChild(btn);
    dom.shipyardList.appendChild(row);
  }
}

function buildHistory() {
  const history = state.career.record.history;
  dom.historyList.innerHTML = "";
  if (!history.length) {
    dom.historyList.innerHTML = `<p class="empty mono">No engagements on record.</p>`;
    return;
  }
  for (const entry of history) {
    const row = document.createElement("div");
    row.className = "history-row";
    row.innerHTML =
      `<span class="history-grade" data-grade="${entry.grade}">${entry.grade}</span>` +
      `<div class="history-info">` +
      `<span class="history-op">${entry.op} — ${entry.sector}</span>` +
      `<span class="history-target mono">${entry.target}</span>` +
      `</div>` +
      `<span class="history-result mono ${entry.result === "success" ? "ok" : "bad"}">` +
      `${entry.result === "success" ? "COMPLETE" : "FAILED"}</span>`;
    dom.historyList.appendChild(row);
  }
}

export function updateStarbase() {
  refreshSelects();
  const repairCost = calculateRepairCost();
  const record = state.career.record;
  if (dom.baseCaptain) dom.baseCaptain.textContent = state.career.captainName;
  if (dom.baseRank) dom.baseRank.textContent = currentRank().name;
  dom.baseCredits.textContent = formatCredits(state.career.credits);
  dom.baseReputation.textContent = currentReputation();
  dom.baseHull.textContent = `${Math.round(state.career.hull * 100)}%`;
  dom.baseRepairCost.textContent = formatCredits(repairCost);
  dom.baseMissions.textContent = `${record.missionsCompleted} / ${record.missionsCompleted + record.missionsFailed}`;
  dom.baseBest.textContent = record.bestGrade;
  if (dom.baseTonnage) dom.baseTonnage.textContent = `${record.enemyTonnage.toLocaleString()} t`;
  if (dom.baseShipclass) dom.baseShipclass.textContent = HULLS[state.career.ship] ? HULLS[state.career.ship].name : "Frigate";
  dom.repairShip.disabled = repairCost === 0 || state.career.credits < repairCost;

  const loadout = state.career.loadout;
  const firstCommand = record.missionsCompleted === 0;
  const briefing = firstCommand
    ? "First command: hunt down a battle-damaged enemy flagship — shields failing, escorts scattered."
    : "Assassinate a hostile flagship in a contested sector.";
  dom.missionPreview.textContent = [
    briefing,
    `Forward: ${forwardLoadouts[loadout.forward].name}.`,
    `Port: ${broadsideLoadouts[loadout.port].name}.`,
    `Starboard: ${broadsideLoadouts[loadout.starboard].name}.`,
    `Utility: ${utilityLoadouts[loadout.utility].name}.`
  ].join(" ");

  buildArmory();
  buildShipyard();
  buildHistory();
}
