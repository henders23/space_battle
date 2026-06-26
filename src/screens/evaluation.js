"use strict";

import { state } from "../state.js";
import { clamp, formatCredits, formatTime } from "../utils.js";
import { showScreen } from "../router.js";
import { calculateRepairCost, currentReputation, saveCareer } from "../career.js";

// After-action review: grade, captain's report, economy, statistics.

const dom = {};

export function initEvaluation() {
  dom.missionGrade = document.getElementById("mission-grade");
  dom.missionResult = document.getElementById("mission-result");
  dom.captainReport = document.getElementById("captain-report");
  dom.evalReward = document.getElementById("eval-reward");
  dom.evalRepair = document.getElementById("eval-repair");
  dom.evalNet = document.getElementById("eval-net");
  dom.evalReputation = document.getElementById("eval-reputation");
  dom.evalStats = document.getElementById("eval-stats");
}

export function finishMission(result, reason) {
  if (state.screen !== "combat") return;
  state.stats.timeTaken = state.mission.duration - state.mission.timer;
  state.career.hull = clamp(state.player.hull / state.player.hullMax, 0, 1);
  state.career.systems = { ...state.player.systems };

  const grade = calculateMissionGrade(result);
  const reward =
    result === "success"
      ? state.mission.reward + state.stats.escortsDestroyed * 120
      : state.stats.escortsDestroyed * 90;
  const repairCost = calculateRepairCost();
  const net = reward - repairCost;

  state.career.credits += reward;
  state.career.reputationScore += reputationDelta(grade, result);
  saveCareer();

  state.evaluation = {
    result,
    reason,
    grade,
    reward,
    repairCost,
    net,
    report: buildCaptainReport(result, reason, grade)
  };

  updateEvaluation();
  showScreen("evaluation");
}

function calculateMissionGrade(result) {
  if (result !== "success" || !state.stats.targetDestroyed) return "F";
  const hullRatio = state.player.hull / state.player.hullMax;
  const shieldRatio = state.player.shields / state.player.shieldsMax;
  const timeRatio = state.stats.timeTaken / state.mission.duration;
  const accuracy = state.stats.shotsFired > 0 ? state.stats.shotsHit / state.stats.shotsFired : 0;
  let score = 55;
  score += hullRatio * 18;
  score += shieldRatio * 7;
  score += clamp(1 - timeRatio, 0, 1) * 10;
  score += state.stats.escortsDestroyed * 4;
  score += accuracy * 10;
  score -= state.stats.systemsDamaged * 4;
  if (score >= 92) return "S";
  if (score >= 82) return "A";
  if (score >= 70) return "B";
  if (score >= 58) return "C";
  if (score >= 45) return "D";
  return "F";
}

function reputationDelta(grade, result) {
  if (result !== "success") return -1;
  return { S: 3, A: 2, B: 1, C: 1, D: 0, F: -1 }[grade] || 0;
}

function buildCaptainReport(result, reason, grade) {
  const mission = state.mission;
  const stats = state.stats;
  const time = formatTime(stats.timeTaken);
  if (result === "success") {
    return [
      `CWS Resolute intercepted ${mission.flagshipName} in ${mission.sectorName} and completed the assassination order in ${time}.`,
      `${stats.escortsDestroyed} escort vessel${stats.escortsDestroyed === 1 ? "" : "s"} were destroyed during the action.`,
      `Final grade ${grade} reflects remaining hull integrity, time on target, weapon accuracy, and system damage. ${mission.hazard}`
    ].join(" ");
  }
  return [
    `CWS Resolute failed to complete the assassination order against ${mission.flagshipName} in ${mission.sectorName}.`,
    `${reason} Command assigns grade ${grade}; the main objective was not achieved.`,
    `Damage control recorded ${stats.systemsDamaged} system incident${stats.systemsDamaged === 1 ? "" : "s"} before withdrawal or loss of combat capability.`
  ].join(" ");
}

function updateEvaluation() {
  const evaluation = state.evaluation;
  dom.missionGrade.textContent = evaluation.grade;
  dom.missionGrade.dataset.grade = evaluation.grade;
  dom.missionResult.textContent = evaluation.reason;
  dom.captainReport.textContent = evaluation.report;
  dom.evalReward.textContent = formatCredits(evaluation.reward);
  dom.evalRepair.textContent = formatCredits(evaluation.repairCost);
  dom.evalNet.textContent = `${evaluation.net >= 0 ? "+" : ""}${formatCredits(evaluation.net)}`;
  dom.evalReputation.textContent = currentReputation();

  dom.evalStats.innerHTML = "";
  const accuracy = state.stats.shotsFired > 0 ? Math.round((state.stats.shotsHit / state.stats.shotsFired) * 100) : 0;
  const statRows = [
    ["Target destroyed", state.stats.targetDestroyed ? "Yes" : "No"],
    ["Survived", state.stats.survived ? "Yes" : "No"],
    ["Retreated", state.stats.retreated ? "Yes" : "No"],
    ["Time taken", formatTime(state.stats.timeTaken)],
    ["Damage dealt", Math.round(state.stats.damageDealt)],
    ["Damage taken", Math.round(state.stats.damageTaken)],
    ["Escorts destroyed", state.stats.escortsDestroyed],
    ["Torpedoes fired", state.stats.torpedoesFired],
    ["Shots fired", state.stats.shotsFired],
    ["Shots hit", state.stats.shotsHit],
    ["Accuracy", `${accuracy}%`],
    ["Systems damaged", state.stats.systemsDamaged]
  ];
  for (const [label, value] of statRows) {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    wrapper.append(dt, dd);
    dom.evalStats.appendChild(wrapper);
  }
}
