"use strict";

import { state } from "../state.js";
import { pick, formatTime, formatCredits } from "../utils.js";
import { MISSION_TYPES } from "../data/missionTypes.js";
import { ADMIRALS } from "../data/admirals.js";

// Pre-mission briefing: shows the operation, objective and a senior officer
// (drawn from the admiral portraits) delivering it on behalf of the Admiralty.

const dom = {};

export function initBriefing() {
  dom.portrait = document.getElementById("brief-portrait");
  dom.op = document.getElementById("brief-op");
  dom.type = document.getElementById("brief-type");
  dom.sector = document.getElementById("brief-sector");
  dom.officerName = document.getElementById("brief-officer-name");
  dom.officerRank = document.getElementById("brief-officer-rank");
  dom.objective = document.getElementById("brief-objective");
  dom.text = document.getElementById("brief-text");
  dom.time = document.getElementById("brief-time");
  dom.reward = document.getElementById("brief-reward");
  dom.threat = document.getElementById("brief-threat");
}

function threatLabel(threat) {
  if (threat >= 78) return "Severe";
  if (threat >= 55) return "High";
  if (threat >= 35) return "Moderate";
  return "Low";
}

export function renderBriefing() {
  const m = state.mission;
  if (!m) return;
  const info = MISSION_TYPES[m.type];
  const officer = pick(ADMIRALS);

  dom.portrait.src = officer.portrait;
  dom.portrait.alt = `${officer.rank} ${officer.name}`;
  dom.officerName.textContent = officer.name;
  dom.officerRank.textContent = officer.rank;

  dom.op.textContent = `Operation ${m.operationName}`;
  dom.type.textContent = info.name.toUpperCase();
  dom.sector.textContent = m.sectorName.toUpperCase();
  dom.objective.textContent = info.objective;
  dom.text.textContent = `${info.brief.replace("{sector}", m.sectorName)} ${m.hazard}`;

  dom.time.textContent = formatTime(m.duration);
  dom.reward.textContent = `${formatCredits(m.reward)} cr`;
  dom.threat.textContent = `${threatLabel(m.threat || 0)} (${Math.round(m.threat || 0)})`;
}
