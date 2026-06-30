"use strict";

// Bridge officers, one per ship system. Their portraits and status appear in the
// combat HUD next to the system they run.

export const OFFICERS = {
  engines: {
    name: "Lt. Cdr. Drake",
    short: "Drake",
    role: "Engineering",
    portrait: "assets/portraits/engineer.png",
    icon: "⚙"
  },
  weapons: {
    name: "Lt. Cdr. Solan",
    short: "Solan",
    role: "Gunnery",
    portrait: "assets/portraits/weapons.png",
    icon: "⚔"
  },
  sensors: {
    name: "Lt. Park",
    short: "Park",
    role: "Sensors",
    portrait: "assets/portraits/sensors.png",
    icon: "◎"
  },
  shields: {
    name: "Lt. Lin",
    short: "Lin",
    role: "Damage Control",
    portrait: "assets/portraits/shields.png",
    icon: "◈"
  }
};

export const SYSTEM_ORDER = ["engines", "weapons", "sensors", "shields"];
