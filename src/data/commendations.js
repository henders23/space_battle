"use strict";

// Medals the Admiralty awards for notable command actions, and the reprimands it
// records against a failing service file. Each is earned once and kept on the
// captain's permanent record (see the Service Record screen).

export const COMMENDATIONS = {
  cold_command: {
    name: "Cold Command Star",
    text: "Exemplary, efficient command action — an S-grade engagement."
  },
  linebreaker: {
    name: "Linebreaker Citation",
    text: "Flagship destroyed with your own hull in critical condition."
  },
  flawless: {
    name: "Untouched Hull Ribbon",
    text: "Operation completed without taking a point of hull damage."
  },
  ace: {
    name: "Wolfpack Commendation",
    text: "Five or more enemy vessels destroyed in a single engagement."
  },
  marksman: {
    name: "Gunnery Distinction",
    text: "Better than three-quarters of shots on target across an action."
  }
};

export const REPRIMANDS = {
  withdrawal: {
    name: "Withdrawal Under Fire",
    text: "The objective was abandoned and the ship withdrawn from the line."
  },
  failure: {
    name: "Operational Failure",
    text: "An assigned operation failed and was lost to the enemy."
  }
};

// Decide which medals / reprimands this action earns. Returns ids; the career
// layer dedupes against what is already on the record.
export function evaluateAwards(stats, result, grade) {
  const commendations = [];
  const reprimands = [];

  if (result === "success") {
    if (grade === "S") commendations.push("cold_command");
    if (stats.targetDestroyed && stats.hullCritical && grade !== "F") {
      commendations.push("linebreaker");
    }
    if (stats.damageTaken <= 0.5) commendations.push("flawless");
    if (stats.escortsDestroyed >= 5) commendations.push("ace");
    const accuracy = stats.shotsFired > 0 ? stats.shotsHit / stats.shotsFired : 0;
    if (stats.shotsFired >= 20 && accuracy >= 0.75) commendations.push("marksman");
  } else {
    if (stats.retreated) reprimands.push("withdrawal");
    else reprimands.push("failure");
  }

  return { commendations, reprimands };
}
