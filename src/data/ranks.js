"use strict";

// Commonwealth Navy rank ladder. A captain earns service points by completing
// operations, destroying command ships and building reputation; crossing a
// threshold is a promotion, surfaced after the action that earns it.

export const RANKS = [
  { name: "Lieutenant", short: "Lt.", points: 0 },
  { name: "Lieutenant Commander", short: "Lt. Cdr.", points: 6 },
  { name: "Commander", short: "Cdr.", points: 14 },
  { name: "Captain", short: "Capt.", points: 26 },
  { name: "Commodore", short: "Cdre.", points: 42 },
  { name: "Rear Admiral", short: "R.Adm.", points: 62 }
];

// Service points reward sustained command: completed operations and flagship
// kills weigh heaviest, with reputation as a lighter modifier.
export function rankPoints(career) {
  const rec = career.record || {};
  return (
    (rec.missionsCompleted || 0) * 2 +
    (rec.flagshipsDestroyed || 0) * 2 +
    Math.max(0, career.reputationScore || 0)
  );
}

export function rankForPoints(points) {
  let index = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (points >= RANKS[i].points) index = i;
  }
  const rank = RANKS[index];
  const next = RANKS[index + 1] || null;
  return {
    index,
    name: rank.name,
    short: rank.short,
    next,
    pointsToNext: next ? Math.max(0, next.points - points) : 0
  };
}

export function rankFor(career) {
  return rankForPoints(rankPoints(career));
}
