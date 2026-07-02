"use strict";

import { OFFICERS } from "../data/officers.js";
import { pick } from "../utils.js";
import { addMessage } from "./effects.js";

// Bridge-crew voice-lines. The named officers (data/officers.js) call out notable
// combat events through the message log. Lines are throttled so routine events
// don't spam the log; high-priority events bypass the cooldown.

const COOLDOWN = 2.5; // seconds between low-priority lines
const HIGH = new Set(["missionStart", "hullCritical", "flankBreach", "flagshipDown", "victory", "defeat"]);

let lastSpoke = -Infinity;

// Each event maps to the speaking system (→ officer) and a pool of lines.
const LINES = {
  missionStart: { system: "sensors", pool: [
    "Contacts on the board, Captain. Bringing the picture up now.",
    "We're on station. Threat board is live.",
    "Sensors are clear and sweeping. Your orders stand."
  ] },
  kill: { system: "weapons", pool: [
    "Splash one — that target's gone.",
    "Direct hit, she's breaking up.",
    "Scratch another hostile, Captain.",
    "Good solution. Target destroyed."
  ] },
  flagshipDown: { system: "weapons", pool: [
    "The command ship is finished. We got her.",
    "Their flagship is breaking apart — outstanding shooting.",
    "That's the big one down, Captain. Objective in hand."
  ] },
  targetFleeing: { system: "sensors", pool: [
    "The flagship's running — she's making for a jump line.",
    "Target's disengaging, Captain. She wants out.",
    "Command ship is bolting. If we want her, it's now."
  ] },
  hullCritical: { system: "shields", pool: [
    "Hull's failing, Captain — I can't hold much more!",
    "We're breached in multiple sections — she won't take another like that.",
    "Damage control's overwhelmed. We are critical."
  ] },
  systemDamage: { system: "engines", pool: [
    "We've taken a hit to the works down here — compensating.",
    "Lost a system, Captain. Rerouting what I can.",
    "Damage in the lower decks. Still answering helm."
  ] },
  waveInbound: { system: "sensors", pool: [
    "Fresh contacts inbound — a new wave, bearing on us.",
    "More of them coming in, Captain. Stay sharp.",
    "Second wave on the board and closing."
  ] },
  officerWounded: { system: "shields", pool: [
    "We have wounded on the bridge — medics are on their way up.",
    "Officer down! Sick bay team to the bridge, now.",
    "They're hurt bad, Captain. The station's running short-handed."
  ] },
  evacJoined: { system: "sensors", pool: [
    "She's forming up on our stern, Captain. Don't lose her.",
    "Good tuck-in — they're with us now. Steady as she goes.",
    "Another one under our wing. Get us to the extraction point."
  ] },
  evacSaved: { system: "sensors", pool: [
    "She's away — clean jump. That's a shipload of people who owe you.",
    "Transit confirmed. One more brought out of the fire.",
    "They made the jump point, Captain. Well done."
  ] },
  boarding: { system: "weapons", pool: [
    "Marines are away — they're going across.",
    "Boarding party clear of the airlocks, Captain.",
    "Our people are on their deck now. Give them room."
  ] },
  victory: { system: "engines", pool: [
    "Orders complete, Captain. A fine piece of work.",
    "That's the action won. The crew did you proud.",
    "We're through it. Standing down from action stations."
  ] },
  defeat: { system: "shields", pool: [
    "We've lost the action, Captain. Disengaging.",
    "It's over — we couldn't hold them.",
    "Falling back. There was nothing more we could do."
  ] }
};

export function reset() {
  lastSpoke = -Infinity;
}

export function say(event) {
  const def = LINES[event];
  if (!def) return;
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  const high = HIGH.has(event);
  if (!high && now - lastSpoke < COOLDOWN) return;
  lastSpoke = now;
  const officer = OFFICERS[def.system];
  const who = officer ? `${officer.short} (${officer.role})` : "Bridge";
  addMessage(`${who}: "${pick(def.pool)}"`);
}
