# Albuquerque games: design

Date: 2026-10-04. Status: approved in conversation; this is the written spec.

## Intent

Bring the Albuquerque (Breaking Bad / Better Call Saul) page's games up to the
Scranton office's standard: 3D first, quality CC0 textures, rigged characters
that are recognisably the cast, deeper play and stronger game feel. Built with
the superpowers, threejs-skills and threejs-game-skills skills (game-creator
was considered and left out); shipped in pieces, each
merged as it lands, without touching pages other sessions are working on.

What the user said: improve the Albuquerque games; all of it, with deeper play;
for Metherria, deeper gameplay, Walt and Jesse in it, an accurate RV and
superlab, and more game feel.

Assumptions (stated in conversation, not contradicted): the 2D versions stay
only as the no-WebGL fallback; CC0 assets only (Poly Haven, ambientCG,
Quaternius, Kenney); no gore in Face Off.

## Success criteria

- Every customer in Metherria and everyone in Casa Tranquila is a rigged 3D
  figure dressed as the character, and moves (looks, gestures, reacts).
- The RV and the superlab read as the show's rooms in a side-by-side with
  reference stills.
- Metherria's new rules (day structure, rush hour, specials, streaks, heat,
  upgrades) are in `rules.js` with tests, and the existing rules tests still
  pass.
- Casa Tranquila is a playable 3D letter-board game with the Face Off finale,
  with its rules in a pure module with tests.
- Each scene stays within about 300 draw calls (shadows included) on desktop,
  lowers resolution and shadows when slow, and falls back to 2D only without
  WebGL or on a lost context.
- Lint, tests and the production build pass for every PR; each PR has browser
  QA screenshots.

## 1. Characters (shared cast module)

Extend `src/components/office/people.js` (it already loads the CC0 Quaternius
Ultimate Modular Men/Women packs built by `scripts/build-cast.py`):

- **Parts**: add Jesse's hoodie body (Casual_Hoodie) and a bearded head
  (Adventurer) to the men's pack. A hazmat suit is the suit body and slacks
  coloured hazmat yellow; gloves are the skin vertices weighted mostly to the
  wrist and finger bones, coloured black at dress time. Glasses and ties stay
  procedural.
- **Wardrobes as data**: `CAST` stays for the office; a second table for
  Albuquerque lives with the Albuquerque code and is passed in (`person(spec)`
  accepts a spec object as well as an id). Jesse, Badger, Skinny Pete, Tuco,
  Mike, Gus (suit, glasses), Lydia (blazer), Declan (beard), Saul (loud shirt,
  tie), Hank (bald), Hector (white hair), a nurse, Walt (hazmat).
- **Poses**: `sit` (as now), `stand` (legs from the bind pose, arms down by
  IK), `wheelchair` (sit without a desk, hands on the armrests).
- **Gestures**: nod, shake the head, shrug, fold the arms, cheer, wave, and
  `reach(hand, point)` for arms that follow a tool.

## 2. Metherria

### 2a. 3D customers, Walt and Jesse

- The standee cut-outs become standing figures: the customer being served at
  the hatch ledge, the queue outside. They idle and look round, look at the
  camera when served, react with the gesture for their mood. Name tags and
  patience bars keep following `standeeAnchors()`.
- Walt is a full figure at the camera with his head hidden; his gloved hands
  reach for the active station's tool (drum spout while pouring, hammer
  handle, sticker, pack).
- Jesse stands in the room in hazmat and reacts to each graded order.

### 2b. The rooms

- References (for building only, not shipped): show stills of the Fleetwood
  Bounder interior and the superlab.
- RV: wood-panel walls, curtained windows onto the desert, the galley bench
  with the cook kit, bench seat, propane tank, gas mask on a hook, the door
  and steps.
- Superlab: steel benches, the stainless reactor with pipes, epoxy floor,
  fluorescent light, Madrigal drums, hazmat suits on hooks, the door to the
  laundry.
- 1K CC0 PBR textures through the existing `loadPbr` path, with painted
  fallbacks as now.

### 2c. Gameplay (rules.js, tested)

- **Day structure**: prep, a rush hour (arrivals twice as fast, tips ×1.5),
  close; a day clock; a summary with stars.
- **Specials**: Gus's Pollos run (large, 99), Lydia's Czech shipment (two
  drums), Tuco's rush order (short fuse, double pay); a badge on the ticket.
- **Streaks**: orders in a row at 90+ multiply tips ×1.5, ×2, ×3; a perfect
  station is called out.
- **Heat**: each sale adds heat (more for low purity and in the rush); Hank's
  visit comes from the heat; at full heat the shift ends early.
- **Upgrades** (added to the existing five): Saul's car wash (heat falls
  faster), Mike's crew (warning before Hank), the methylamine barrel (large
  batches pay more), the Vamonos Pest tent (every seventh day has no rush
  hour and no Hank).
- Saved careers from before load cleanly (`newCareer` validates new fields).

### 2d. Game feel

- Particles: splashes in the flask, shards on a strike, sparkles on a perfect.
- Camera: a short shake on the hammer, a push-in on a perfect.
- Sound (procedural, `lib/sfx`, or CC0 samples): pour, bubbling, crack,
  rustle, register.
- Score pops on each station.

## 3. Casa Tranquila (Face Off and the letter board, one 3D game)

- A new 3D scene (own module, the office's stage pattern): a nursing-home room
  with CC0 plaster and linoleum, a window onto the desert, the bed, the door.
  Hector in his wheelchair with the bell on its tray; the nurse holding the
  letter board.
- Play: the nurse's finger moves along the 3D board, rows then letters; ring
  (button, Space, tap) to pick. The word fills on the board; a wrong ring
  costs five seconds and Hector glares. Three words, the finger faster each
  one; best score kept (the existing `tp-hector-best`).
- Finale: the last message spelled, Gus walks in; ring three times and the
  room goes up (flash, fireball, smoke, debris); the smoke clears and Gus
  walks out straightening his tie. No gore.
- Rules in a pure module (`casa/rules.js`) with tests: the sweep, picking,
  misses, timing and scoring, the finale's steps.
- The 2D `HectorBoard` and `HectorBell` stay as the no-WebGL fallback.

## Delivery

Five PRs, each merged when green:

1. Characters, Metherria's 3D customers, Walt and Jesse.
2. The RV and the superlab.
3. Metherria's deeper gameplay.
4. Metherria's game feel.
5. Casa Tranquila.

## Out of scope

Other pages (Cybertron, Avengers and others are being worked on in parallel
sessions); the Pollos counter, the cast cards and Saul's card stay as they
are.
