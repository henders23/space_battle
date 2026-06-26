"use strict";

import { state } from "../state.js";
import { formatCredits } from "../utils.js";
import { forwardLoadouts, broadsideLoadouts, utilityLoadouts } from "../data/loadouts.js";
import {
  calculateRepairCost,
  currentReputation,
  repairShip,
  saveCareer
} from "../career.js";

// Starbase refit hub: loadout selection, repair economy, mission order preview.

const dom = {};

function populateSelect(select, options, currentKey) {
  select.innerHTML = "";
  Object.entries(options).forEach(([key, item]) => {
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
  dom.baseCredits = document.getElementById("base-credits");
  dom.baseReputation = document.getElementById("base-reputation");
  dom.baseHull = document.getElementById("base-hull");
  dom.baseRepairCost = document.getElementById("base-repair-cost");
  dom.missionPreview = document.getElementById("mission-preview");
  dom.repairShip = document.getElementById("repair-ship");

  populateSelect(dom.forwardSelect, forwardLoadouts, state.career.loadout.forward);
  populateSelect(dom.portSelect, broadsideLoadouts, state.career.loadout.port);
  populateSelect(dom.starboardSelect, broadsideLoadouts, state.career.loadout.starboard);
  populateSelect(dom.utilitySelect, utilityLoadouts, state.career.loadout.utility);

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

// Re-sync the selects with the active loadout (e.g. after loading a save).
function syncSelects() {
  if (!dom.forwardSelect) return;
  dom.forwardSelect.value = state.career.loadout.forward;
  dom.portSelect.value = state.career.loadout.port;
  dom.starboardSelect.value = state.career.loadout.starboard;
  dom.utilitySelect.value = state.career.loadout.utility;
}

export function updateStarbase() {
  syncSelects();
  const repairCost = calculateRepairCost();
  dom.baseCredits.textContent = formatCredits(state.career.credits);
  dom.baseReputation.textContent = currentReputation();
  dom.baseHull.textContent = `${Math.round(state.career.hull * 100)}%`;
  dom.baseRepairCost.textContent = formatCredits(repairCost);
  dom.repairShip.disabled = repairCost === 0 || state.career.credits < repairCost;

  const loadout = state.career.loadout;
  dom.missionPreview.textContent = [
    "Assassinate a hostile flagship in a contested sector.",
    `Forward: ${forwardLoadouts[loadout.forward].name}.`,
    `Port: ${broadsideLoadouts[loadout.port].name}.`,
    `Starboard: ${broadsideLoadouts[loadout.starboard].name}.`,
    `Utility: ${utilityLoadouts[loadout.utility].name}.`
  ].join(" ");
}
