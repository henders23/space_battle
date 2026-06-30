"use strict";

import { state } from "../state.js";
import { pick, randomInt, randomRange } from "../utils.js";
import { saveCareer } from "../career.js";

// Operation chains: a multi-mission arc fought over a single sector. About half
// of contested-sector deployments begin a 2-stage operation — a softening action
// followed by a decisive flagship strike (which flows through the nemesis system).
// The rest stay one-off sorties. The active chain lives on state.career.operation.

const OPERATION_NAMES = ["Black Lance", "Iron Tide", "Cold Vigil", "Severance", "Hollow Star", "Grey Dawn", "Long Watch", "Ash Harbour", "Broken Crown", "Last Meridian"];

const SOFTENING_TYPES = ["patrol", "convoy_escort", "starbase_defence", "rescue_disabled"];

const STAGE_LABELS = {
  patrol: "Break the enemy screen",
  convoy_escort: "Secure the supply lane",
  starbase_defence: "Hold the anchorage",
  rescue_disabled: "Recover the lost ship",
  assassinate_flagship: "Decapitate the command"
};

function activeOp() {
  return state.career.operation || null;
}

// Decide the operation context for a deployment. Returns
// { forcedType, operation, stageIndex } when this mission is part of a chain, or
// null for a standalone sortie.
export function operationForDeployment(sector) {
  if (!sector) return null;
  // The captain's first command is always the scripted intro — never an operation.
  if (state.career.record.missionsCompleted === 0) return null;

  const op = activeOp();
  if (op && op.sectorId === sector.id && op.stage < op.stages.length) {
    return { forcedType: op.stages[op.stage].type, operation: op, stageIndex: op.stage };
  }

  // Only open a new operation when none is already running, ~half the time.
  if (op || Math.random() >= 0.5) return null;

  const softening = pick(SOFTENING_TYPES);
  const stages = [
    { type: softening, label: STAGE_LABELS[softening] },
    { type: "assassinate_flagship", label: STAGE_LABELS.assassinate_flagship }
  ];
  const newOp = {
    name: pick(OPERATION_NAMES),
    sectorId: sector.id,
    sectorName: sector.name,
    stages,
    stage: 0,
    reward: Math.round((900 + (sector.threat || 50) * 6) * randomRange(0.9, 1.1))
  };
  state.career.operation = newOp;
  saveCareer();
  return { forcedType: stages[0].type, operation: newOp, stageIndex: 0 };
}

// Resolve the active operation after a mission that belonged to it. Returns a
// callout { kind: "phase"|"complete"|"failed", ... } for the dispatch / eval /
// log, or null when the finished mission wasn't part of a chain.
export function recordOutcome(result) {
  const op = activeOp();
  if (!op || !state.mission || !state.mission.operation) return null;

  if (result !== "success") {
    state.career.operation = null;
    saveCareer();
    return { kind: "failed", name: op.name };
  }

  op.stage += 1;
  if (op.stage >= op.stages.length) {
    state.career.operation = null;
    saveCareer();
    return { kind: "complete", name: op.name, reward: op.reward };
  }

  const next = op.stages[op.stage];
  saveCareer();
  return { kind: "phase", name: op.name, stage: op.stage + 1, count: op.stages.length, nextLabel: next.label };
}
