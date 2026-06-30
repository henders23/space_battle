"use strict";

import { state } from "../state.js";
import { formatCredits, formatTime } from "../utils.js";
import { showScreen } from "../router.js";
import {
  calculateRepairCost,
  currentReputation,
  saveCareer,
  betterGrade,
  recordMission,
  awardCommendations,
  reconcileRank,
  currentRank,
  recordShipAction
} from "../career.js";
import { hullRatio } from "../combat/shipStats.js";
import { gradeMission } from "../combat/objectives.js";
import { applyMissionOutcome } from "../game/warMap.js";
import { recordOutcome } from "../game/nemesis.js";
import * as operations from "../game/operations.js";
import { commandDispatch, captainLogEntry } from "../game/dispatch.js";
import { evaluateAwards, COMMENDATIONS, REPRIMANDS } from "../data/commendations.js";

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
  dom.promotion = document.getElementById("eval-promotion");
  dom.careerLine = document.getElementById("eval-career");
  dom.warUpdate = document.getElementById("eval-warupdate");
  dom.operation = document.getElementById("eval-operation");
  dom.scar = document.getElementById("eval-scar");
}

export function finishMission(result, reason) {
  if (state.screen !== "combat") return;
  state.stats.timeTaken = state.mission.duration - state.mission.timer;
  state.career.hull = hullRatio(state.player);
  state.career.systems = { ...state.player.systems };

  const grade = calculateMissionGrade(result);

  // Resolve an active operation chain (advance / complete / abandon). A completed
  // operation pays a bonus that folds into this mission's reward.
  const opCallout = operations.recordOutcome(result);

  let reward =
    result === "success"
      ? state.mission.reward + state.stats.escortsDestroyed * 120
      : state.stats.escortsDestroyed * 90;
  if (opCallout && opCallout.kind === "complete") reward += opCallout.reward;
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

  // Award medals / reprimands (deduped against the permanent record) and pick the
  // single most notable fresh one to headline the after-action review.
  const earned = evaluateAwards(state.stats, result, grade);
  const fresh = awardCommendations(earned.commendations, earned.reprimands);
  const commendation = headlineAward(fresh);

  // A promotion can fall out of the records this mission updated.
  const promotion = reconcileRank();

  // Advance the war in the sector this mission was fought over.
  let warUpdate = null;
  if (state.activeSectorId) {
    warUpdate = applyMissionOutcome(state.activeSectorId, result, grade, state.mission).news.text;
  }

  // Record the fate of a flagship target (escaped → becomes/escalates a nemesis;
  // destroyed or captured → retired). The callout feeds the dispatch report.
  let nemesisCallout = null;
  if (state.mission.type === "assassinate_flagship") {
    const fs = state.enemies.find((e) => e.type === "flagship");
    const neutralized = Boolean(fs && !fs.alive);
    nemesisCallout = recordOutcome(state.mission, neutralized);
  }

  // Mark the action against the ship in service (veteran identity / battle scars).
  const shipMark = recordShipAction(state.stats, result, grade, state.mission.sectorName);

  // Append a captain's-log entry drawing on everything that just resolved.
  const logText = captainLogEntry(result, grade, { nemesisCallout, opCallout, shipMark });
  if (!Array.isArray(state.career.log)) state.career.log = [];
  state.career.log.unshift({
    cycle: state.career.war ? state.career.war.cycle : 1,
    rankShort: currentRank().short,
    sector: state.mission.sectorName,
    op: state.mission.operationName,
    grade,
    result,
    text: logText
  });
  state.career.log = state.career.log.slice(0, 30);

  saveCareer();

  state.evaluation = {
    result,
    reason,
    grade,
    reward,
    repairCost,
    net,
    commendation,
    promotion,
    warUpdate,
    operation: operationCalloutText(opCallout),
    scar: shipMarkText(shipMark),
    report: commandDispatch(result, reason, grade, nemesisCallout, opCallout)
  };

  updateEvaluation();
  showScreen("evaluation");
}

// Pick the most significant freshly-earned award to display on the eval screen.
function headlineAward(fresh) {
  if (fresh.commendations.length) {
    const def = COMMENDATIONS[fresh.commendations[0]];
    return { kind: "commendation", text: `${def.name} — ${def.text}` };
  }
  if (fresh.reprimands.length) {
    const def = REPRIMANDS[fresh.reprimands[0]];
    return { kind: "reprimand", text: `${def.name} — ${def.text}` };
  }
  return null;
}

// Short headline text for the operation chain's outcome, or null.
function operationCalloutText(callout) {
  if (!callout) return null;
  if (callout.kind === "complete") return `OPERATION ${callout.name.toUpperCase()} COMPLETE — +${formatCredits(callout.reward)} cr bonus.`;
  if (callout.kind === "phase") return `OPERATION ${callout.name.toUpperCase()} — phase ${callout.stage}/${callout.count} now: ${callout.nextLabel}.`;
  if (callout.kind === "failed") return `OPERATION ${callout.name.toUpperCase()} ABANDONED.`;
  return null;
}

// Short headline text for a fresh battle scar / honour, or null.
function shipMarkText(mark) {
  if (!mark) return null;
  const ship = state.career.shipIdentity ? state.career.shipIdentity.name : "The ship";
  return mark.kind === "honour" ? `${ship} — HONOUR: ${mark.label}.` : `${ship} — BATTLE SCAR: ${mark.label}.`;
}

function calculateMissionGrade(result) {
  return gradeMission(result);
}

function reputationDelta(grade, result) {
  if (result !== "success") return -1;
  return { S: 3, A: 2, B: 1, C: 1, D: 0, F: -1 }[grade] || 0;
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
  if (dom.promotion) {
    if (evaluation.promotion) {
      dom.promotion.textContent = `PROMOTED — you are advanced to ${evaluation.promotion.name}.`;
      dom.promotion.classList.remove("hidden");
    } else {
      dom.promotion.classList.add("hidden");
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
  if (dom.operation) {
    if (evaluation.operation) {
      dom.operation.textContent = evaluation.operation;
      dom.operation.classList.remove("hidden");
    } else {
      dom.operation.classList.add("hidden");
    }
  }
  if (dom.scar) {
    if (evaluation.scar) {
      dom.scar.textContent = evaluation.scar;
      dom.scar.classList.remove("hidden");
    } else {
      dom.scar.classList.add("hidden");
    }
  }
  if (dom.careerLine) {
    const r = state.career.record;
    const rank = currentRank();
    dom.careerLine.textContent =
      `${rank.short} ${state.career.captainName} · SERVICE RECORD — ${r.missionsCompleted} completed · ` +
      `${r.missionsFailed} failed · best ${r.bestGrade} · ${r.flagshipsDestroyed} flagships · ` +
      `${r.enemyTonnage.toLocaleString()} t destroyed`;
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
