"use strict";

import { state } from "../state.js";
import { SECTORS, EDGES } from "../data/sectors.js";
import {
  ensureWar,
  sectorState,
  sectorHasMission,
  controlInfo
} from "../game/warMap.js";

// Renders the galactic war map: sector nodes over travel routes, colour-coded by
// control, with a side panel for the selected sector and a Deploy action.

const dom = {};
let deployHandler = null;
let selectedId = null;

export function initWarMap(onDeploy) {
  deployHandler = onDeploy;
  dom.routes = document.getElementById("warmap-routes");
  dom.nodes = document.getElementById("warmap-nodes");
  dom.cycle = document.getElementById("warmap-cycle");
  dom.panel = document.getElementById("warmap-panel");
  dom.news = document.getElementById("warmap-news");
  buildRoutes();
  buildNodes();
}

function buildRoutes() {
  const byId = Object.fromEntries(SECTORS.map((s) => [s.id, s]));
  let svg = "";
  for (const [a, b] of EDGES) {
    const p = byId[a];
    const q = byId[b];
    svg += `<line x1="${p.x * 100}" y1="${p.y * 100}" x2="${q.x * 100}" y2="${q.y * 100}" />`;
  }
  dom.routes.innerHTML = svg;
}

function buildNodes() {
  dom.nodes.innerHTML = "";
  for (const s of SECTORS) {
    const node = document.createElement("button");
    node.className = "warmap-node";
    node.dataset.id = s.id;
    node.style.left = `${s.x * 100}%`;
    node.style.top = `${s.y * 100}%`;
    node.innerHTML =
      `<span class="node-dot"></span>` +
      `<span class="node-marker"></span>` +
      `<span class="node-label">${s.name}</span>`;
    node.addEventListener("click", () => {
      selectedId = s.id;
      renderWarMap();
    });
    dom.nodes.appendChild(node);
  }
}

function defaultSelection() {
  const mission = SECTORS.find((s) => sectorHasMission(s.id));
  return (mission || SECTORS[0]).id;
}

function bar(label, value, color) {
  return (
    `<div class="wm-bar"><span class="wm-bar-label mono">${label}</span>` +
    `<div class="wm-track"><i style="width:${value}%;background:${color}"></i></div>` +
    `<span class="wm-bar-val mono">${Math.round(value)}</span></div>`
  );
}

export function renderWarMap() {
  ensureWar();
  if (!selectedId || !sectorState(selectedId)) selectedId = defaultSelection();

  dom.cycle.textContent = state.career.war.cycle;

  // node states
  for (const node of dom.nodes.children) {
    const id = node.dataset.id;
    const sec = sectorState(id);
    const info = controlInfo(sec.control);
    node.style.setProperty("--node-color", info.color);
    node.classList.toggle("selected", id === selectedId);
    node.classList.toggle("has-mission", sectorHasMission(id));
    node.querySelector(".node-dot").style.background = info.color;
  }

  renderPanel();
  renderNews();
}

function renderPanel() {
  const id = selectedId;
  const sec = sectorState(id);
  const def = SECTORS.find((s) => s.id === id);
  const info = controlInfo(sec.control);
  const mission = sectorHasMission(id);
  const sbLabels = ["None", "Outpost", "Naval Station", "Fleet Base", "Fortress Base"];

  dom.panel.innerHTML =
    `<div class="wm-head">` +
    `<p class="mono eyebrow">SECTOR DOSSIER</p>` +
    `<h3 class="wm-name">${def.name}</h3>` +
    `<span class="wm-control" style="color:${info.color}">${info.label.toUpperCase()} CONTROL</span>` +
    `</div>` +
    bar("THREAT", sec.threat, "#ff5347") +
    bar("STABILITY", sec.stability, "#5fd17a") +
    bar("SUPPLY", sec.supply, "#45e0f0") +
    bar("ENEMY FLEET", sec.enemyFleet, "#ff7a70") +
    `<div class="wm-meta mono">STARBASE: ${sbLabels[sec.starbaseLevel] || "None"}</div>` +
    (mission
      ? `<div class="wm-order"><p class="mono eyebrow">AVAILABLE OPERATION</p>` +
        `<p class="wm-brief">Intercept and destroy the enemy command vessel holding ${def.name}. ` +
        `Expect resistance scaled to a fleet strength of ${Math.round(sec.enemyFleet)}.</p>` +
        `<button id="warmap-deploy" class="primary">Deploy to Sector</button></div>`
      : `<p class="wm-secured mono">SECTOR SECURED — no active operation.</p>`);

  const deploy = document.getElementById("warmap-deploy");
  if (deploy) deploy.addEventListener("click", () => deployHandler && deployHandler(id));
}

function renderNews() {
  const news = state.career.war.news;
  if (!news.length) {
    dom.news.innerHTML = `<span class="mono dim">No fresh intelligence. Choose a contested sector and deploy.</span>`;
    return;
  }
  dom.news.innerHTML = news
    .slice(0, 4)
    .map(
      (n) =>
        `<div class="news-line"><span class="mono news-cycle ${n.tone}">CYCLE ${n.cycle}</span>` +
        `<span class="news-text">${n.text}</span></div>`
    )
    .join("");
}
