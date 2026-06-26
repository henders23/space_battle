"use strict";

import { state } from "./state.js";

// Screen registry + transitions. Screens are <section class="screen"> elements
// whose id is `${name}-screen`. showScreen toggles visibility and broadcasts a
// `screen:enter` event so feature modules can refresh their DOM without the
// router needing to import them (keeps the dependency graph acyclic).

let screens = {};

export function registerScreens(names) {
  screens = {};
  for (const name of names) {
    const el = document.getElementById(`${name}-screen`);
    if (el) screens[name] = el;
  }
}

export function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("screen-active"));
  if (screens[name]) screens[name].classList.add("screen-active");
  state.screen = name;
  window.dispatchEvent(new CustomEvent("screen:enter", { detail: { name } }));
}
