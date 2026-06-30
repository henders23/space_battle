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
| `Space` | Fire the forward lance (auto-aimed within its arc) |
| `Q` / `E` | Fire the port / starboard broadside |
| `F` | Fire the siege torpedo |
| Hold a key | Keep firing that battery as its charge bar refills |
| Mouse | Aim + click also fires the bearing battery / torpedo |
| `B` | Board a crippled ship when your hull is alongside it |
| `R` | Retreat (forfeits the mission) |
| `Esc` | Pause |

Each battery has a **charge bar in the rack along the bottom of the screen**; press
its key (or click the rack button) to loose a volley, and the bar refills before it
can fire again. Keys auto-aim at the best target inside the battery's arc; the mouse
still works for manual aiming. A full reference is on the in-game **Controls** screen.

## Combat model

The battlefield is drawn **north-up**: your ship moves through a fixed world and the
camera follows you but **leads toward the engagement**, so your hull sits off-centre with
the enemy in view rather than pinned dead-centre. You fight by *turning* to bring a
broadside to bear — the forward lance fires ahead, the port/starboard broadsides to each
flank — and loose each battery from the **charge-bar rack along the bottom of the screen**
(`Space` / `Q` / `E` / `F`). Ships are heavy: you set a **throttle** (stop / slow /
moderate / full) rather than free-thrusting, turns are wide, and momentum bleeds off
slowly. Every ship has independent port and starboard hull, so protecting a wounded side
while working the enemy's is the heart of the fight: **expose your own breached flank and
the ship is lost.** Hostiles are tougher to put down — they fight on until both flanks are
gone — but once battered to low hull they go **crippled** (engines and guns dead), drifting
as an open invitation to board. Combat rewards positioning and timing over twitch reflexes.

### Boarding actions

Once a hostile is battered to **30% hull or less** a *Board Ship Available* prompt
appears. Bring your hull **alongside** the crippled ship and press `B` (or the rack's
**Board Ship** button) to send your marines across. Ship-to-ship combat **pauses** while
you fight the **boarding action minigame** — a real-time deck assault led by four named
squad leaders shown with portraits — and the prize you take (or the withdrawal you call)
is carried back into the battle when you return.

## Art

Capital-ship hulls are drawn from faction sheets — **Commonwealth Navy** for the player
and allies, **Veyr Collective** and **United Front** for the Dominion — and weapons fire
**projectile sprites** (particle lances, cannon shells, torpedoes) from the projectile
pack. Squad-leader portraits in the boarding minigame are sliced from the squad-leader
sheet.

## Current features

- **Valkyrie** identity throughout, built to the design mockup: command-terminal UI,
  Saira / Saira Condensed / JetBrains Mono type, cyan/amber/red palette, scanlines and
  tactical chrome. Fonts are bundled locally — no network required.
- Title screen with a numbered menu (New Campaign / Continue / **Controls** / Settings /
  Credits) and live war-status footer.
- **Broadside combat with a leading camera**: a north-up battlefield where the camera
  follows your ship but leads toward the enemy, so you fight off-centre with the engagement
  in view — weapon arcs, range rings, a tactical HUD and an off-screen target indicator
  included.
- **Charge-bar batteries fired by key**: a rack of charge bars along the bottom of the
  screen — forward lance (`Space`), port/starboard broadsides (`Q`/`E`) and siege torpedo
  (`F`) — each auto-aimed within its arc and refilling between volleys, with mouse aiming
  still available.
- **Boarding actions**: crippled hostiles (≤30% hull) can be boarded once you're alongside,
  pausing the ship duel for a squad-led boarding minigame whose outcome feeds back into the
  battle.
- **Sprite art**: faction ship sheets (Commonwealth / Veyr / United Front), projectile-pack
  rounds, and squad-leader portraits in the boarding action.
- **Three player hull classes** — Frigate (fast, fragile), Cruiser (the balanced
  workhorse), and Battleship (slow, devastating broadsides) — each with distinct hull,
  shields, turn rate, speed and firepower, bought at the shipyard and gated by reputation
  and credits.
- **Six enemy classes** with distinct AI: raiders (fast dive-bombers), escorts and
  frigates (chargers), missile boats (kiters), cruisers (broadside duelists) and named
  flagships — mixed into each mission type so different sectors demand different tactics.
- **Per-side defences**: independent port/starboard shields and hull on every ship —
  protect a damaged side and force the enemy to expose theirs. Expose your own breached
  flank and you are lost; hostiles instead fight until both flanks fail, going **crippled**
  (dead in the water) at low hull so you can finish them off or board them.
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
- **Recurring nemeses**: an enemy flagship that escapes your intercept (the window
  closes, or you retreat with it alive) is remembered as a named command ship under a
  named commander. It returns in later assassinations — reinforced in proportion to how
  often it has slipped you — flagged as a **RETURNING TARGET** in the briefing, until you
  finally destroy or capture it. Nemeses persist on the career record.
- **Bridge-crew voice-lines**: your named officers call out the action — kills, the
  target running, flank breaches and hull-critical, fresh waves, boarding, and the final
  outcome — throttled so the message log stays readable, not chatty.
- **Procedural command dispatches**: the after-action report is assembled fresh each
  mission from the engagement, notable statistics, any nemesis, and your rank's register,
  so no two read alike.
- **Operation chains**: about half of contested-sector deployments begin a two-stage
  **operation** — a softening action (patrol, escort, defence or rescue) followed by a
  decisive flagship strike that often becomes a nemesis showdown. The briefing flags the
  phase, completing the arc pays a bonus, and failure abandons it.
- **Veteran-ship identity**: the ship in service accrues **battle honours and scars**
  (flagship kills, decorated actions, hull breaches survived, repulses) shown on a
  **Ship in Service** card on the Service Record; a freshly commissioned hull starts clean.
- **Captain's log**: a persistent, auto-written first-person chronicle of the campaign —
  every action, operation, nemesis and scar — on its own screen, reachable from the war
  map and the after-action review.
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
  data/            loadouts, theme, controls, sectors, ranks, commendations, officers
  game/            warMap (war state), nemesis (recurring foes), operations
                   (mission chains), dispatch (reports + captain's-log entries)
  combat/          mission, simulation, weapons, systems, effects, renderer, shipStats,
                   voicelines, boarding, objectives
  screens/         warMap, starbase, briefing, evaluation, intel, service, log
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
- **M7** — Procedural story layer ✅: recurring named **nemesis** command ships,
  **officer voice-lines** in combat, **procedural command dispatches**,
  **operation chains**, **veteran-ship identity / battle scars**, and a
  **captain's log**.

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
