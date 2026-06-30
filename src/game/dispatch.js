"use strict";

import { state } from "../state.js";
import { pick } from "../utils.js";
import { currentRank } from "../career.js";
import { engagementSummary } from "../combat/objectives.js";
import { hullRatio } from "../combat/shipStats.js";

// Procedural command dispatch — the signature after-action prose. Composes a
// short, varied report from the mission, the engagement, notable statistics and
// any recurring nemesis, in the register of the captain's current rank. Generated
// once per mission and stored on state.evaluation, so plain Math.random variety
// is fine.

function opening() {
  const m = state.mission;
  return pick([
    `Action report, operation ${m.operationName} — ${m.sectorName}.`,
    `${m.sectorName}. Operation ${m.operationName} is concluded.`,
    `Filed from ${m.sectorName} under operation ${m.operationName}.`,
    `The engagement over ${m.sectorName} is logged.`
  ]);
}

// One flourish drawn from whatever was most notable about the action.
function flourish(result) {
  const s = state.stats;
  const p = state.player;
  const accuracy = s.shotsFired > 0 ? s.shotsHit / s.shotsFired : 0;
  const candidates = [];

  if (result === "success" && s.hullCritical) {
    candidates.push("The ship came through battered to the frames but unbroken — the crew held her together.");
  }
  if (accuracy >= 0.6 && s.shotsFired > 20) {
    candidates.push(`Gunnery was exemplary: ${Math.round(accuracy * 100)}% of rounds found their mark.`);
  } else if (accuracy > 0 && accuracy < 0.25 && s.shotsFired > 20) {
    candidates.push("Fire discipline was loose; too many volleys went wide.");
  }
  if (s.systemsDamaged >= 3) {
    candidates.push(`Damage control logged ${s.systemsDamaged} system casualties — the ship will need the yards.`);
  }
  if (s.tonnage >= 1500) {
    candidates.push(`Some ${Math.round(s.tonnage).toLocaleString()} tonnes of hostile shipping were broken in the exchange.`);
  }
  if (result === "success" && p && hullRatio(p) > 0.9) {
    candidates.push("The action was clean — barely a scratch on the paint.");
  }
  if (s.torpedoesFired >= 3) {
    candidates.push("The siege torpedoes did decisive work at the close.");
  }

  return candidates.length ? pick(candidates) : null;
}

function nemesisLine(callout) {
  if (!callout) return null;
  const who = `${callout.commanderRank} ${callout.commander}`;
  if (callout.kind === "escaped") {
    return callout.escapes > 1
      ? `${who} aboard ${callout.shipName} slipped the net again — that makes ${callout.escapes}. This is becoming personal.`
      : `${who} broke off aboard ${callout.shipName} and ran for a jump line. They will be back.`;
  }
  if (callout.kind === "defeated") {
    return callout.escapes > 0
      ? `After ${callout.escapes} escape${callout.escapes === 1 ? "" : "s"}, ${who} and ${callout.shipName} will trouble this front no more.`
      : `${who} aboard ${callout.shipName} will trouble this front no more.`;
  }
  return null;
}

function operationLine(callout) {
  if (!callout) return null;
  if (callout.kind === "phase") {
    return `Operation ${callout.name} advances — phase ${callout.stage} of ${callout.count} now: ${callout.nextLabel.toLowerCase()}.`;
  }
  if (callout.kind === "complete") {
    return `Operation ${callout.name} is complete; the Admiralty releases a bonus of ${callout.reward.toLocaleString()} cr to this command.`;
  }
  if (callout.kind === "failed") {
    return `Operation ${callout.name} has collapsed — the arc is abandoned and the initiative passes to the enemy.`;
  }
  return null;
}

function closing(result, grade) {
  const rank = currentRank();
  const name = state.career.captainName;
  if (result === "success") {
    return pick([
      `Command assigns grade ${grade}. Well fought, ${rank.short} ${name}.`,
      `The Admiralty marks this action ${grade}. The line holds because of ships like yours, ${rank.short}.`,
      `Grade ${grade} entered against your record, ${rank.short} ${name}.`
    ]);
  }
  return pick([
    `Command assigns grade ${grade}. The objective stands unmet, ${rank.short} ${name}; the war does not wait.`,
    `Grade ${grade}. A hard lesson, ${rank.short} — see that it is the last of its kind.`,
    `The Admiralty records grade ${grade} and expects better of this command.`
  ]);
}

export function commandDispatch(result, reason, grade, nemesisCallout, opCallout) {
  const parts = [opening(), engagementSummary(result, reason)];
  const fl = flourish(result);
  if (fl) parts.push(fl);
  const op = operationLine(opCallout);
  if (op) parts.push(op);
  const nem = nemesisLine(nemesisCallout);
  if (nem) parts.push(nem);
  parts.push(closing(result, grade));
  return parts.join(" ");
}

// A short, first-person captain's-log entry for the running chronicle. Draws on
// the same mission/nemesis/operation/ship context but in the captain's own voice.
export function captainLogEntry(result, grade, context = {}) {
  const { nemesisCallout, opCallout, shipMark } = context;
  const m = state.mission;
  const ship = state.career.shipIdentity ? state.career.shipIdentity.name : "the ship";
  const lines = [];

  lines.push(
    result === "success"
      ? pick([
          `We carried the action over ${m.sectorName} — grade ${grade}.`,
          `${m.sectorName} went our way today; the Admiralty marked it ${grade}.`,
          `Orders fulfilled over ${m.sectorName}. Grade ${grade}.`
        ])
      : pick([
          `We were thrown back over ${m.sectorName}. Grade ${grade}, and deserved.`,
          `${m.sectorName} did not go our way; the objective slipped us. Grade ${grade}.`,
          `A hard day over ${m.sectorName} — grade ${grade}.`
        ])
  );

  if (opCallout) {
    if (opCallout.kind === "complete") lines.push(`That closes Operation ${opCallout.name}.`);
    else if (opCallout.kind === "phase") lines.push(`Operation ${opCallout.name} moves to its next phase.`);
    else if (opCallout.kind === "failed") lines.push(`Operation ${opCallout.name} is finished — we couldn't hold it together.`);
  }

  if (nemesisCallout) {
    const who = nemesisCallout.commander;
    if (nemesisCallout.kind === "escaped") {
      lines.push(nemesisCallout.escapes > 1 ? `${who} ran from me again aboard ${nemesisCallout.shipName}. I'll have that ship.` : `${who} slipped me aboard ${nemesisCallout.shipName}.`);
    } else if (nemesisCallout.kind === "defeated") {
      lines.push(`We finally finished ${who} and ${nemesisCallout.shipName}.`);
    }
  }

  if (shipMark) {
    lines.push(
      shipMark.kind === "honour"
        ? `A proud day for ${ship}: ${shipMark.label.toLowerCase()}.`
        : `${ship} carries a new scar — ${shipMark.label.toLowerCase()}.`
    );
  }

  return lines.join(" ");
}
