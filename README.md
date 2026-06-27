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
| `W` | Throttle up (stop → slow → moderate → full) |
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
broadside to bear. Ships are heavy: you set a **throttle** (stop / slow / moderate /
full) rather than free-thrusting, turns are wide, and momentum bleeds off slowly.
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
- **Three player hull classes** — Frigate (fast, fragile), Cruiser (the balanced
  workhorse), and Battleship (slow, devastating broadsides) — each with distinct hull,
  shields, turn rate, speed and firepower, bought at the shipyard and gated by reputation
  and credits.
- **Six enemy classes** with distinct AI: raiders (fast dive-bombers), escorts and
  frigates (chargers), missile boats (kiters), cruisers (broadside duelists) and named
  flagships — mixed into each mission type so different sectors demand different tactics.
- **Per-side defences**: independent port/starboard shields and hull on every ship —
  protect a damaged side and force the enemy to expose theirs (breach either flank and
  the ship is lost).
- **Bridge crew & damage control**: each ship system is run by a named officer shown
  with a portrait, and a live ship schematic shows hull damage by flank and the state of
  each system. Engagements are deliberately weighty — large hull/shield pools mean
  duels are won by position and discipline, not a quick burst.
- **Galactic war map**: a network of sectors with control states (Commonwealth /
  contested / Veyr), threat / stability / supply / enemy-fleet values, and routes. You
  deploy to contested sectors from the map; missions scale to the sector's fleet
  strength, and each outcome advances the war — shifting control, threat and stability,
  with war-update bulletins.
- **Five mission types**, each mechanically distinct: **Assassinate Flagship** (kill the
  named command ship), **Patrol Sweep** (clear all hostiles), **Convoy Escort** (shepherd
  transports to the jump point), **Starbase Defence** (hold a fixed station through enemy
  waves), and **Rescue Operation** (defend a crippled ship until it withdraws). Allied
  ships can be damaged and lost, and the after-action grade and report comment on each
  type's objective.
- **Starbase loop**: repair economy, an **armory** to purchase weapons/modules with
  credits, owned-only loadout selection, career stats, and **mission history**.
- Procedural after-action evaluation: grade, captain's report, commendations/reprimands,
  career impact, statistics, and a running service record.
- **Campaign & captain identity**: a New Campaign sets up your captain (name +
  difficulty) before the opening orders. Sustained command earns **rank
  progression** (Lieutenant → Rear Admiral), and the Admiralty awards permanent
  **commendations** (or records **reprimands**) for notable — or failed — actions;
  promotions and medals surface in the after-action review and on a dedicated
  **Service Record** screen with your rank, progress to the next, awards and
  lifetime stats.
- **War News / Intelligence screen**: a theatre-wide read of the war — overall
  front status, the full bulletin log, and per-sector intelligence (control,
  threat, stability, enemy fleet).
- **Full Settings**: music + independent **sound-effects** volume, **difficulty**
  (Recruit / Officer / Veteran, scaling enemy toughness, incoming fire and pay),
  **screen-shake** intensity, and accessibility options (**large text**,
  **colour-blind** palette that separates friendly blue from hostile amber).
  Settings persist between sessions.
- Career persistence via localStorage (captain, rank, credits, reputation, hull,
  loadout, owned items, commendations, record and history).
- **Layered audio**: distinct music beds that crossfade between the menu, the mission
  briefing (a low drone) and combat (a red-alert theme); an engine loop that rises and
  falls with the ship's speed; and procedural combat sound effects (gun reports, shield
  and hull impacts, explosions, low-hull alarm) synthesised via Web Audio. Volume + mute
  persist between sessions.
- **Combat feedback ("juice")**: glowing tracer rounds with trails, muzzle flashes,
  distinct shield-ripple vs hull-spark impacts, multi-stage explosions scaled to ship
  size, and camera shake on firing, hits and kills.

## Project structure

```
index.html · style.css · assets/ (music + fonts)
src/
  main.js          bootstrap, screen router wiring, input, game loop
  state.js         shared state + constants
  router.js        screen transitions
  career.js        economy, ownership, rank, commendations, save/load
  settings.js      difficulty + accessibility + audio settings (persisted)
  audio.js         music controller   sfx.js  procedural sound effects
  data/            loadouts, theme, controls, sectors, ranks, commendations
  game/            warMap (war-state model + simulation)
  combat/          mission, simulation, weapons, systems, effects, renderer, shipStats
  screens/         warMap, starbase, briefing, evaluation, intel, service
  ui/              hud
  utils.js         math + formatting helpers
```

## Roadmap

See [`PLAN.md`](PLAN.md) for the full execution plan.

- **M0** — Rebrand, modular architecture, ship-centred combat, audio + controls. ✅
- **M1** — Stabilise + persistent career record. ✅
- **M2** — Starbase & progression (armory, unlocks, mission history). ✅
- **M3** — Galactic war map with sectors and dynamic war consequences. ✅
- **M4** — Mission variety (patrol, convoy escort, starbase defence, rescue). ✅
- **M5** — Multiple player hulls (frigate/cruiser/battleship) and enemy types. ✅
- **M6** — Campaign polish: captain naming, rank progression, commendations,
  War News / Intelligence and Service Record screens, full Settings. ✅
- **M7** — Procedural story layer: recurring named enemy ships, operation chains,
  officer voice-lines, battle scars.

## Known issues / notes

- Must be served over HTTP (ES modules); `file://` will not work.
- Audio waits for a user gesture before playing (browser autoplay policy).
- The title's **Continue** option enables once a save exists on page load; a
  campaign started in the same session is available from the war map immediately
  and as **Continue** on the next load.

## Design pillars

Broadside-first combat · heavy ships, not fighters · procedural war with authored
flavour · the player is evaluated as a captain · campaign consequences · browser-first,
no backend.
