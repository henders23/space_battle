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

export function commandDispatch(result, reason, grade, nemesisCallout) {
  const parts = [opening(), engagementSummary(result, reason)];
  const fl = flourish(result);
  if (fl) parts.push(fl);
  const nem = nemesisLine(nemesisCallout);
  if (nem) parts.push(nem);
  parts.push(closing(result, grade));
  return parts.join(" ");
}
