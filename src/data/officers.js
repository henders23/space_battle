"use strict";

// Bridge officers, one per ship system. Their portraits and status appear in the
// combat HUD next to the system they run.

export const OFFICERS = {
  engines: {
    name: "Lt. Cdr. Drake",
    role: "Engineering",
    portrait: "assets/portraits/engineer.png",
    icon: "⚙"
  },
  weapons: {
    name: "Lt. Cdr. Solan",
    role: "Gunnery",
    portrait: "assets/portraits/weapons.png",
    icon: "⚔"
  },
  sensors: {
    name: "Lt. Park",
    role: "Sensors",
    portrait: "assets/portraits/sensors.png",
    icon: "◎"
  },
  shields: {
    name: "Lt. Lin",
    role: "Damage Control",
    portrait: "assets/portraits/shields.png",
    icon: "◈"
  }
};

export const SYSTEM_ORDER = ["engines", "weapons", "sensors", "shields"];
