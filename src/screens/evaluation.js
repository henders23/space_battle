"use strict";

import { state } from "../state.js";
import { clamp, formatCredits, formatTime } from "../utils.js";
import { showScreen } from "../router.js";
import { calculateRepairCost, currentReputation, saveCareer, betterGrade, recordMission } from "../career.js";
import { hullRatio, shieldRatio } from "../combat/shipStats.js";
import { applyMissionOutcome } from "../game/warMap.js";

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
  dom.commendation = document.getElementById("eval-commendation");
  dom.careerLine = document.getElementById("eval-career");
  dom.warUpdate = document.getElementById("eval-warupdate");
}

export function finishMission(result, reason) {
  if (state.screen !== "combat") return;
  state.stats.timeTaken = state.mission.duration - state.mission.timer;
  state.career.hull = hullRatio(state.player);
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

  const record = state.career.record;
  if (result === "success") record.missionsCompleted += 1;
  else record.missionsFailed += 1;
  record.grades[grade] = (record.grades[grade] || 0) + 1;
  record.bestGrade = betterGrade(record.bestGrade, grade);
  record.escortsDestroyed += state.stats.escortsDestroyed;
  if (state.stats.targetDestroyed) record.flagshipsDestroyed += 1;
  record.enemyTonnage += Math.round(state.stats.tonnage);
  if (state.stats.hullCritical) record.timesHullCritical += 1;

  recordMission({
    grade,
    result,
    op: state.mission.operationName,
    sector: state.mission.sectorName,
    target: state.mission.flagshipName
  });

  const commendation = pickCommendation(result, grade);

  // Advance the war in the sector this mission was fought over.
  let warUpdate = null;
  if (state.activeSectorId) {
    warUpdate = applyMissionOutcome(state.activeSectorId, result, grade, state.mission).news.text;
  }
  saveCareer();

  state.evaluation = {
    result,
    reason,
    grade,
    reward,
    repairCost,
    net,
    commendation,
    warUpdate,
    report: buildCaptainReport(result, reason, grade)
  };

  updateEvaluation();
  showScreen("evaluation");
}

// A light commendation/reprimand layer; the full medal system arrives later.
function pickCommendation(result, grade) {
  if (result === "success" && state.stats.targetDestroyed && state.stats.hullCritical && grade !== "F") {
    return { kind: "commendation", text: "Linebreaker Citation — flagship destroyed with the hull in critical condition." };
  }
  if (grade === "S") return { kind: "commendation", text: "Cold Command Star — exemplary, efficient command action." };
  if (result !== "success" && state.stats.retreated) {
    return { kind: "reprimand", text: "Withdrawal noted — the objective was abandoned under fire." };
  }
  if (result !== "success") {
    return { kind: "reprimand", text: "Mission failure recorded against your service file." };
  }
  return null;
}

function calculateMissionGrade(result) {
  if (result !== "success" || !state.stats.targetDestroyed) return "F";
  const hull = hullRatio(state.player);
  const shield = shieldRatio(state.player);
  const timeRatio = state.stats.timeTaken / state.mission.duration;
  const accuracy = state.stats.shotsFired > 0 ? state.stats.shotsHit / state.stats.shotsFired : 0;
  let score = 55;
  score += hull * 18;
  score += shield * 7;
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

  if (dom.commendation) {
    if (evaluation.commendation) {
      dom.commendation.textContent = evaluation.commendation.text;
      dom.commendation.dataset.kind = evaluation.commendation.kind;
      dom.commendation.classList.remove("hidden");
    } else {
      dom.commendation.classList.add("hidden");
    }
  }
  if (dom.warUpdate) {
    if (evaluation.warUpdate) {
      dom.warUpdate.textContent = evaluation.warUpdate;
      dom.warUpdate.classList.remove("hidden");
    } else {
      dom.warUpdate.classList.add("hidden");
    }
  }
  if (dom.careerLine) {
    const r = state.career.record;
    dom.careerLine.textContent =
      `SERVICE RECORD — ${r.missionsCompleted} completed · ${r.missionsFailed} failed · ` +
      `best ${r.bestGrade} · ${r.flagshipsDestroyed} flagships · ${r.enemyTonnage.toLocaleString()} t destroyed`;
  }

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
