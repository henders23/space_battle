"use strict";

import { state } from "../state.js";
import { formatTime, formatCredits } from "../utils.js";
import { MISSION_TYPES } from "../data/missionTypes.js";
import { ADMIRALS } from "../data/admirals.js";
import { currentRank } from "../career.js";

// The same senior officer delivers every briefing.
const BRIEFING_OFFICER = ADMIRALS[0];

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
  const officer = BRIEFING_OFFICER;

  dom.portrait.src = officer.portrait;
  dom.portrait.alt = `${officer.rank} ${officer.name}`;
  dom.officerName.textContent = officer.name;
  dom.officerRank.textContent = officer.rank;

  dom.op.textContent = `Operation ${m.operationName}`;
  dom.type.textContent = info.name.toUpperCase();
  dom.sector.textContent = m.sectorName.toUpperCase();
  dom.objective.textContent = info.objective;
  const rank = currentRank();
  const salutation = `${rank.short} ${state.career.captainName}, `;
  const body = info.brief.replace("{sector}", m.sectorName);
  let text = `${salutation}${body.charAt(0).toLowerCase()}${body.slice(1)} ${m.hazard}`;
  if (m.operation) {
    text =
      `OPERATION ${m.operation.name.toUpperCase()} — PHASE ${m.operation.stage}/${m.operation.stageCount}: ${m.operation.label}. ` +
      text;
  }
  if (m.nemesisReturning) {
    const who = `${m.nemesisCommanderRank} ${m.nemesisCommander}`;
    text += ` RETURNING TARGET: intelligence confirms ${m.flagshipName} under ${who}, who has slipped our intercepts ${m.nemesisEscapes} time${m.nemesisEscapes === 1 ? "" : "s"}. Expect a reinforced ship. Finish it this time.`;
  }
  dom.text.textContent = text;

  dom.time.textContent = formatTime(m.duration);
  dom.reward.textContent =
    m.type === "evacuation"
      ? `${formatCredits(m.reward)} cr + ${formatCredits(m.rewardPerShip || 170)}/ship`
      : `${formatCredits(m.reward)} cr`;
  dom.threat.textContent = `${threatLabel(m.threat || 0)} (${Math.round(m.threat || 0)})`;
}
