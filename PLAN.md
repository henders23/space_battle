# Valkyrie — Execution Plan

Turning the existing prototype into the full **Valkyrie** tactical starship command
game. This plan adapts the original `/goal` brief and folds in four required tweaks.

## The four tweaks (apply throughout)

1. **Rename to "Valkyrie".** Delete every "Broadside Command" reference. The game is
   *Valkyrie*. ("Broadside Command" may survive only as a small subtitle/tagline where
   the mockup uses it stylistically — see §2 — never as the product name.)
2. **Ship-centred combat.** *(Superseded — see note below.)* The original intent was a
   **static, dead-centre** player ship with the world rotating around it. In practice the
   prototype's **north-up leading camera** (the camera follows the ship but leads toward
   the engagement, so the player fights off-centre with the enemy in view) proved more
   readable and was kept by design decision. The combat renderer therefore uses the
   leading camera, not a ship-centred transform; §4 below is retained for historical
   context only.
3. **Adopt the mockup's visual identity** (`Valkyrie mockup screens.html`) as the
   visual system for every screen (tokens in §2).
4. **Music + Controls button.** `Silent Armada (1).mp3` plays on start (looped, with a
   mute/volume control and autoplay-gesture handling). Add a **Controls** button to the
   title screen.

---

## 1. Current state (what we're building on)

- `index.html` / `style.css` / `game.js` — a working single-file prototype with four
  screens: Start, Starbase Refit, Combat, Evaluation. One mission type
  (flagship assassination), scrolling camera, loadout selects, repair economy,
  graded evaluation, in-memory career (no persistence).
- `Valkyrie mockup screens.html` — a self-extracting bundle. Decoded, it contains a
  **1920×1080 design comp of 8 screens**: Title, Combat HUD, Galactic War Map,
  Starbase, Shipyard/Refit, Mission Briefing, Mission Evaluation, Captain Career.
  This is the visual north star.
- `Silent Armada (1).mp3` — title/menu music.

The prototype's combat math (movement, broadside arcs, weapons, damage, AI, grading)
is solid and **will be preserved and refactored**, not rewritten — only the *render
frame of reference* changes (tweak #2).

## 2. Visual identity (extracted from the mockup)

Lock these into CSS custom properties / a `data/theme.js` and a canvas palette so every
screen is consistent.

**Palette**
| Token | Hex | Use |
|---|---|---|
| `--bg` / `--bg-deep` | `#04080b` / `#02060a` | page background, deep space |
| `--panel` | `#061119` / `rgba(10,22,28,.92)` | panel fills |
| `--accent` (cyan) | `#45e0f0` | primary accent, player, friendly |
| `--amber` | `#f0a93d` | warnings, hull-stress, secondary highlight |
| `--danger` (red) | `#ff5347` / `#ff6b60` | enemy, alerts, combat |
| `--success` | `#5fd17a` | OK status, links established |
| `--violet` | `#b86bff` | special/experimental tier accent |
| `--text` | `#eaf6f9` / `#cfe2e8` | primary text |
| `--muted` | `#7fb3c0` / `#5f8794` | labels, captions |

**Type**: `Saira` (body), `Saira Condensed` (display headings + UI labels, 600–800
weight, letter-spacing), `JetBrains Mono` (data, codes, clocks, telemetry). Bundle the
woff2 files locally (extract from the mockup's manifest) so the game needs no network.

**Motifs to reuse**: tactical grid overlay, animated scanlines, angled `clip-path`
panel corners, corner brackets, diamond fleet sigil, radar sweep, range rings,
conic-gradient broadside/forward arcs, blinking alert dots, monospace telemetry
footers ("WAR CYCLE 47 — STATUS: CONTESTED"). Keyframes already authored in the
mockup (`vk-sweep`, `vk-blink`, `vk-pulse`, `vk-thrust`, `vk-glowpulse`, `vk-scan`).

## 3. Target architecture

Migrate gradually from one `game.js` into the brief's structure. ES modules, no build
step (works from `file://` or any static host):

```
index.html
style.css                 # theme tokens, screen chrome, fonts
assets/
  Silent Armada.mp3
  fonts/*.woff2
src/
  main.js                 # bootstrap, screen router, game loop
  state.js                # global state + persistence-backed career
  audio.js                # music + sfx, mute/volume, autoplay unlock
  input.js                # keymap (data-driven, see §controls)
  screens/                # title, campaign, warMap, starbase, shipyard,
                          #   briefing, combat, evaluation, career, settings, controls
  game/                   # campaign, warMap, missionGenerator, evaluation,
                          #   saveSystem, progression
  combat/                 # ship, playerShip, enemyShip, projectile, weapons,
                          #   damage, ai, collision, environment, renderer(ship-centred)
  data/                   # factions, ships, weapons, modules, missionTemplates,
                          #   enemies, environments, names, ranks, theme
  ui/                     # panels, hud, messageLog, tacticalMap, components
  utils/                  # math, random, drawing
```

## 4. The ship-centred combat renderer (tweak #2 — the key technical change)

- Keep world simulation in absolute world coordinates (movement, momentum, AI,
  collisions stay as-is — the physics don't care about the camera).
- **Render transform:** translate to canvas centre, then rotate by `-player.angle`
  and translate by `-player.x, -player.y`. The player is then drawn at the origin,
  always pointing "up". Everything else falls into place around it.
- Broadside arcs (port = left wedge, starboard = right wedge), forward cone, and range
  rings are drawn **screen-fixed** around the centre ship (as in the mockup), so the
  player reads their firing envelopes at a glance while the starfield/enemies wheel.
- Off-screen target indicators (the prototype's compass arrow) adapt naturally.
- Add an optional "north-up vs ship-up" toggle later; ship-up is the default per tweak.
- Tune starfield parallax + subtle rotation so motion is legible, not nauseating.

## 5. Milestones

Each milestone ends with the brief's testing checklist passing and a clean console.

### M0 — Rebrand, restructure, identity, audio, controls *(the four tweaks land first)*
- Global rename to **Valkyrie**; strip "Broadside Command" as product name.
- Stand up the module structure (§3) by extracting the current `game.js` in place
  (behaviour-preserving refactor first, features second).
- Apply the mockup theme to existing screens; bundle fonts locally.
- **Music on start** via `audio.js` (loop, volume slider, mute, gesture-unlock).
- **Re-centre combat** on the ship (§4).
- Title screen: menu = New Campaign / Continue / **Controls** / Settings / Credits,
  styled per mockup; add a **Controls** screen (keymap reference, §controls).
- *Acceptance:* prototype is fully reskinned, ship-centred, music plays, Controls
  screen reachable, no "Broadside Command" product references remain.

### M1 — Stabilise + persist (brief M1)
- Refactor combat for clarity; improve movement feel & arc readability; better enemy
  duel AI; polished evaluation; restart/continue flow.
- `saveSystem.js` → localStorage career (stats, credits, reputation, loadout).
- *Acceptance:* several assassination missions back-to-back; career persists on reload.

### M2 — Starbase & progression (brief M2)
- Full Starbase hub + Shipyard/Refit screens (mockup layouts): repair economy,
  weapon/module shop, unlocks, mission history, best grades/stats.
- *Acceptance:* earn/spend credits; loadout choices change combat; state persists.

### M3 — Galactic war map (brief M3)
- Sector-node map (mockup War Map): control states, threat/stability/supply values,
  travel routes, mission pins, side panel.
- War tick after each mission; success/failure changes sectors; war-update reports.
- *Acceptance:* choose missions from the map; sectors visibly shift; consequences land.

### M4 — Mission variety (brief M4)
- Add Convoy Escort, Starbase Defence, Patrol, Rescue Disabled Ship (+ assassination =
  5 types). Objective entities, per-type grading, briefing/report language.
- *Acceptance:* ≥5 distinct mission types; evaluations comment per type.

### M5 — Ships & enemies (brief M5)
- Player hulls: Frigate, Cruiser, Battleship (distinct stats/slots, rank/credit gates).
- Enemies: raider, escort, missile boat, frigate, cruiser, flagship (≥6) with AI
  profiles (aggressive/defensive/kiting/broadside-duelist/escort/retreating).
- *Acceptance:* hulls feel different; enemy types demand different tactics.

### M6 — Campaign polish (brief M6)
- Campaign setup + captain naming, rank progression, commendations/reprimands,
  War News/Intelligence screen, Settings (incl. audio, screen-shake, text size,
  colour-blind, difficulty), full visual-effects + UI consistency pass, SFX.
- *Acceptance:* coherent title→campaign→battle→report→war loop.

### M7 — Impressive layer (brief M7)
- Procedural command reports (signature feature), named enemy command ships that
  return if they escape, officer voice-lines in combat, operation chains, battle
  scars / veteran-ship identity, captain's log.
- *Acceptance:* the campaign generates memorable, retellable stories.
- **First pass (done):** recurring **nemesis** command ships (escaped flagships return
  named, escalated and personal — `src/game/nemesis.js`), throttled **officer
  voice-lines** in combat (`src/combat/voicelines.js`), and **procedural command
  dispatches** in the after-action review (`src/game/dispatch.js`).
- **Second pass (done):** **operation chains** (two-stage sector arcs that climax in a
  flagship/nemesis strike — `src/game/operations.js`), **veteran-ship identity / battle
  scars** (honours and scars on the ship in service, shown on the Service Record —
  `src/career.js`, `src/screens/service.js`), and a persistent first-person **captain's
  log** (`src/screens/log.js`, entries from `src/game/dispatch.js`).
- **M7 complete.**

## 6. Controls (Controls screen + input.js)

Default keymap from the brief, shown on the new Controls screen and remappable later:

`W` thrust · `S` reverse/brake · `A`/`D` rotate · `Space` forward guns ·
`Q` port broadside · `E` starboard broadside · `F` torpedo/special · `Shift` utility ·
`Tab` cycle target · `M` tactical overlay · `R` retreat · `Esc` pause.

## 7. Definition of done (brief §40)

Title screen · campaign setup · persistent career · procedural sector war map ·
starbases · repair/refit · ≥3 hulls · ≥8 weapons/modules · ≥5 mission types ·
≥6 enemy types · dynamic war consequences · briefings · ship-centred real-time
broadside combat · system damage · procedural evaluation reports · rank/reputation ·
localStorage save/load · career record · war news · coherent Valkyrie visual identity ·
music + audio settings.

## 8. Guardrails (brief §41)

No multiplayer / backend / accounts / 4X / economy sim / 3D migration. Keep it a
focused, lightweight, browser-first tactical command game. Build incrementally; never
rewrite wholesale. Keep README, controls, and the testing checklist current per
milestone.
