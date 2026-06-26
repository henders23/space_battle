# Valkyrie — Broadside Command

A browser-based, real-time **tactical starship command game** set during the Helion War.
You are not a fighter pilot — you are the captain of a single heavy warship on the line.
Manoeuvre for broadsides, manage shields and system damage, complete your orders, and
answer to the Admiralty after every action.

> You commanded a ship in a war — not just won a level.

## How to run locally

The game uses ES modules, so it must be served over HTTP (opening `index.html` from
`file://` will not load the modules). Any static server works:

```bash
# from the repository root
python3 -m http.server 8000
# then open http://localhost:8000/
```

or `npx serve`, or any static host (Vercel, GitHub Pages, etc.).

The Valkyrie theme music starts on your first interaction (browser autoplay policy);
toggle it from the title screen or **Settings**.

## Controls

| Input | Action |
|---|---|
| `W` | Throttle up (stop → very slow → slow → moderate) |
| `S` | Throttle down |
| `A` / `D` | Rotate left / right |
| Mouse | Aim — shots travel toward the cursor |
| Left click | Fire whichever battery's arc the cursor falls in |
| Right click | Fire torpedo (cursor in the forward arc) |
| Hold a button | Keep firing that weapon as it reloads |
| `R` | Retreat (forfeits the mission) |
| `Esc` | Pause |

You fire with the **mouse**: aim where you want the shots to go, and the battery
whose arc contains the cursor (port, starboard, or forward) is the one that fires —
the bearing battery's arc lights up so you can see what bears. A full reference is on
the in-game **Controls** screen.

## Combat model

Your ship is fixed at the **centre of the screen, pointing up**; the world — enemies,
asteroids, projectiles, range rings — rotates around it. Your **forward gun cone faces
up, the port broadside arc is always to the left, and the starboard arc to the right**,
so you read your firing envelopes at a glance and fight by *turning* the ship to bring a
broadside to bear. Ships are heavy: you set a **throttle** (stop / very slow / slow /
moderate) rather than free-thrusting, turns are wide, and momentum bleeds off slowly.
Every ship has independent port and starboard hull — **breach either flank and the ship
is lost** — so protecting a wounded side while working the enemy's is the heart of the
fight. Combat rewards positioning and timing over twitch reflexes.

## Current features

- **Valkyrie** identity throughout, built to the design mockup: command-terminal UI,
  Saira / Saira Condensed / JetBrains Mono type, cyan/amber/red palette, scanlines and
  tactical chrome. Fonts are bundled locally — no network required.
- Title screen with a numbered menu (New Campaign / Continue / **Controls** / Settings /
  Credits) and live war-status footer.
- **Ship-centred broadside combat**: your ship is fixed at screen centre and the world
  rotates around it, with screen-fixed weapon arcs, range rings, a tactical HUD and an
  off-screen target indicator.
- **Mouse-aimed firing**: shots travel toward the cursor; the battery whose arc contains
  the cursor fires (left click = the bearing battery, right click = torpedo), and the
  active arc highlights.
- **Per-side defences**: independent port/starboard shields and hull on every ship —
  protect a damaged side and force the enemy to expose theirs.
- **Galactic war map**: a network of sectors with control states (Commonwealth /
  contested / Veyr), threat / stability / supply / enemy-fleet values, and routes. You
  deploy to contested sectors from the map; missions scale to the sector's fleet
  strength, and each outcome advances the war — shifting control, threat and stability,
  with war-update bulletins.
- Flagship-assassination missions with escorts, asteroid fields and an escape timer.
- **Starbase loop**: repair economy, an **armory** to purchase weapons/modules with
  credits, owned-only loadout selection, career stats, and **mission history**.
- Procedural after-action evaluation: grade, captain's report, commendations/reprimands,
  career impact, statistics, and a running service record.
- Career persistence via localStorage (credits, reputation, hull, loadout, owned items,
  record and history).
- Title/menu music with volume + mute, persisted between sessions.

## Project structure

```
index.html · style.css · assets/ (music + fonts)
src/
  main.js          bootstrap, screen router wiring, input, game loop
  state.js         shared state + constants
  router.js        screen transitions
  career.js        economy, ownership, localStorage save/load
  audio.js         music controller
  data/            loadouts, theme palette, control scheme, sectors
  game/            warMap (war-state model + simulation)
  combat/          mission, simulation, weapons, systems, effects, renderer, shipStats
  screens/         warMap, starbase, evaluation
  ui/              hud
  utils.js         math + formatting helpers
```

## Roadmap

See [`PLAN.md`](PLAN.md) for the full execution plan.

- **M0** — Rebrand, modular architecture, ship-centred combat, audio + controls. ✅
- **M1** — Stabilise + persistent career record. ✅
- **M2** — Starbase & progression (armory, unlocks, mission history). ✅
- **M3** — Galactic war map with sectors and dynamic war consequences. ✅
- **M4** — Mission variety (convoy escort, starbase defence, patrol, rescue).
- **M5** — Multiple player hulls (frigate/cruiser/battleship) and enemy types.
- **M6** — Campaign polish: ranks, war news, settings, audio/SFX.
- **M7** — Procedural story layer: recurring named enemy ships, operation chains,
  officer voice-lines, battle scars.

## Known issues / notes

- Must be served over HTTP (ES modules); `file://` will not work.
- Audio waits for a user gesture before playing (browser autoplay policy).
- One mission type so far (flagship assassination); variety arrives in M4.
- The save system is intentionally light in M0 and expands in later milestones.

## Design pillars

Broadside-first combat · heavy ships, not fighters · procedural war with authored
flavour · the player is evaluated as a captain · campaign consequences · browser-first,
no backend.
