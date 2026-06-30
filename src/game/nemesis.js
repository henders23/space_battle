"use strict";

import { state } from "../state.js";
import { pick, randomInt } from "../utils.js";
import { saveCareer } from "../career.js";

// Recurring enemy command ships. A flagship that the player fails to destroy
// (it escapes, the intercept window closes, or the captain retreats) is recorded
// as a nemesis and can return in a later assassination — named, harder, and with
// a grudge. Destroying a nemesis retires it. Nemeses persist on the career record.

const FLAGSHIP_TITLES = ["Dreadnought", "Executor", "Praetor", "Iron Regent", "Black Lance", "Vigilant", "Red Monarch", "Warden", "Severance", "Ruin"];
const COMMANDER_NAMES = ["Vos Karr", "Senna Dol", "Tark Vey", "Iola Renn", "Hadrek", "Sull Vane", "Maro Kest", "Vael Orin", "Cinda Roan", "Tobrec"];
const COMMANDER_RANKS = ["Warmaster", "Overcaptain", "Praetor", "Fleet-Lord", "Commander"];

let counter = 0;

function nemeses() {
  if (!Array.isArray(state.career.nemeses)) state.career.nemeses = [];
  return state.career.nemeses;
}

// Toughness scaling applied to a returning nemesis flagship.
export function escalation(escapes) {
  const e = Math.max(0, escapes || 0);
  return {
    hullMult: 1 + Math.min(0.6, e * 0.22),
    shieldMult: 1 + Math.min(0.7, e * 0.25),
    regenBonus: Math.min(4, e)
  };
}

// Pick the assassination target. Reuse an active nemesis when one exists
// (preferring one last seen in this sector); otherwise mint a fresh foe.
export function flagshipForMission(sector) {
  const active = nemeses().filter((n) => n.status === "active");
  if (active.length) {
    const sectorName = sector ? sector.name : null;
    const returning =
      active.find((n) => sectorName && n.lastSector === sectorName) || pick(active);
    return {
      nemesisId: returning.id,
      shipName: returning.shipName,
      commander: returning.commander,
      commanderRank: returning.commanderRank,
      returning: true,
      escapes: returning.escapes
    };
  }
  return {
    nemesisId: null,
    shipName: `VRS ${pick(FLAGSHIP_TITLES)} ${randomInt(17, 94)}`,
    commander: pick(COMMANDER_NAMES),
    commanderRank: pick(COMMANDER_RANKS),
    returning: false,
    escapes: 0
  };
}

// Record the result of an assassination. `neutralized` is true when the flagship
// was destroyed or captured; false when it survived (escaped / timed out /
// retreat). Returns a callout descriptor for the after-action dispatch, or null.
export function recordOutcome(mission, neutralized) {
  if (!mission || mission.type !== "assassinate_flagship") return null;

  const list = nemeses();
  let nem = mission.nemesisId ? list.find((n) => n.id === mission.nemesisId) : null;

  if (neutralized) {
    if (nem) {
      nem.status = "defeated";
      nem.encounters += 1;
      saveCareer();
      return { kind: "defeated", commander: nem.commander, commanderRank: nem.commanderRank, shipName: nem.shipName, escapes: nem.escapes };
    }
    return null; // a one-off flagship, killed first time — nothing to track
  }

  // The flagship got away. Promote it to (or escalate) a nemesis.
  if (nem) {
    nem.escapes += 1;
    nem.encounters += 1;
    nem.lastSector = mission.sectorName;
    nem.status = "active";
  } else {
    counter += 1;
    nem = {
      id: `nem-${Date.now()}-${counter}`,
      commander: mission.nemesisCommander || pick(COMMANDER_NAMES),
      commanderRank: mission.nemesisCommanderRank || pick(COMMANDER_RANKS),
      shipName: mission.flagshipName,
      faction: "veyr",
      encounters: 1,
      escapes: 1,
      lastSector: mission.sectorName,
      status: "active"
    };
    list.push(nem);
  }
  saveCareer();
  return { kind: "escaped", commander: nem.commander, commanderRank: nem.commanderRank, shipName: nem.shipName, escapes: nem.escapes };
}
