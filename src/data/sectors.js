"use strict";

// Static layout of the Helion theatre: a connected network of sectors. Dynamic
// values (threat, stability, control…) live in the saved war state and are
// derived from each sector's starting control by the war-map module.

export const SECTORS = [
  { id: "helion", name: "Helion Cross", x: 0.10, y: 0.55, control: "commonwealth", starbaseLevel: 3 },
  { id: "greyward", name: "Greyward Line", x: 0.25, y: 0.27, control: "commonwealth", starbaseLevel: 1 },
  { id: "meridian", name: "Meridian Reach", x: 0.22, y: 0.81, control: "commonwealth", starbaseLevel: 1 },
  { id: "tantalus", name: "Tantalus Drift", x: 0.45, y: 0.19, control: "contested", starbaseLevel: 0 },
  { id: "rime", name: "Rime Hollow", x: 0.42, y: 0.83, control: "contested", starbaseLevel: 0 },
  { id: "cinder", name: "Cinder Vale", x: 0.56, y: 0.52, control: "contested", starbaseLevel: 0 },
  { id: "orison", name: "Orison Gate", x: 0.59, y: 0.29, control: "contested", starbaseLevel: 0 },
  { id: "acheron", name: "Acheron Deep", x: 0.77, y: 0.40, control: "veyr", starbaseLevel: 0 },
  { id: "vesper", name: "Vesper Expanse", x: 0.83, y: 0.71, control: "veyr", starbaseLevel: 0 }
];

// Undirected travel routes between sectors.
export const EDGES = [
  ["helion", "greyward"],
  ["helion", "meridian"],
  ["greyward", "meridian"],
  ["greyward", "tantalus"],
  ["meridian", "rime"],
  ["tantalus", "orison"],
  ["tantalus", "cinder"],
  ["rime", "cinder"],
  ["rime", "orison"],
  ["cinder", "orison"],
  ["cinder", "acheron"],
  ["orison", "acheron"],
  ["acheron", "vesper"],
  ["cinder", "vesper"]
];

// Starting dynamic values by control state (0–100 scales).
export const CONTROL_BASE = {
  commonwealth: { threat: 15, stability: 82, supply: 78, enemyFleet: 10, presence: 86 },
  contested: { threat: 56, stability: 44, supply: 46, enemyFleet: 58, presence: 44 },
  veyr: { threat: 82, stability: 24, supply: 30, enemyFleet: 86, presence: 16 }
};

export const CONTROL_INFO = {
  commonwealth: { label: "Commonwealth", color: "#45e0f0" },
  contested: { label: "Contested", color: "#f0a93d" },
  veyr: { label: "Veyr Dominion", color: "#ff5347" }
};
