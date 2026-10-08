# Multiplayer and Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is for an ultracode session: fan tasks out where their files don't overlap, one reviewer per PR before it merges.

**Goal:** Pilots you can read, reach and understand online, and one economy that every universe earns into and spends from.

**Architecture:** The rules are pure modules tested in Node: `economy.js` (the wallet, levels, buying), `catalog.js` (prices and needs over the existing parts, modules and paints), `relations.js` (how two pilots stand to each other), `tagRules.js` (what a tag shows) and `pilotGoal.js` (the park behind a moving pilot). Thin edits wire them in where the scenes already note deeds, send hellos, draw tags and fly the autopilot. Three pull requests: A the economy, B the tags and factions, C flying to a pilot. A and B share only `protocol.js`'s `lv`; build A first, then B and C in parallel.

**Tech Stack:** three 0.186, React 19, vitest 5, playwright-core for the browser checks, Nostr relays through `online/nostr.js` (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-07-multiplayer-economy-design.md`

## Global Constraints

- British spelling, curly quotes in prose and UI copy, plain sentences; comments say why.
- No sequel trilogy (Episodes 7–9) anywhere in Star Wars content.
- Rules go in pure tested modules, apart from the drawing. Tests are written first.
- No runtime calls to asset services. No new 3D models in this work.
- Never print or commit `MESHY_API_KEY` or `SKETCHFAB_API_TOKEN`.
- A peer's name is only ever set as `textContent`. Everything from the wire is read through `protocol.js` and believed only when it is an id in a list the reader already has.
- Save keys through `runtime/saves.js`, versioned. The new key is `tp-pilot`, version 1.
- Levels: xp thresholds `[0, 50, 150, 350, 700, 1200, 2000, 3200, 5000, 7500, 11000]`; level 11 is the cap. Tags: `TAG_NEAR` 40, `TAG_MID` 140, `TAG_FAR` 600 map units; minimum tag font 12 px. Fly-to: park 6 units behind, arrive within 8, re-aim every 1 s, follow hand-off expires after 60 s.
- Commit messages are one plain sentence. Every commit ends with the session's attribution lines.
- Before every push: `npm run lint`, `npm test` and `npm run build`, all clean. `docs/architecture.md` gets one short paragraph per PR in the universe section; `docs/superpowers/HANDOFF-multiplayer-economy.md` is updated at the end of each PR.

## Review Focus

1. **A pilot with a `tp-universe-loadout` from before the wallet.** They must keep every part they had fitted, on every crew, with no credits spent (Task A1, test `the migration grants what was fitted`).
2. **A hello from an older build with no `lv` and no `f`.** It reads as it did, level 1, relation `none` (Task B1, test `a hello without the new fields reads as before`).
3. **Fly-to on a pilot who goes offline mid-trip, or hides.** The autopilot stops, the goal is gone from the space, the HUD says so, and no exception reaches the frame loop (Task C1 and C2, tests `a stale pilot ends the trip` and the browser check).
4. **The hangar's roll with nothing bought.** `rollBuild` must still return a full build from stock and owned modules alone (Task A3, test `a roll picks only owned modules`).
5. **A tag at the far edge on a phone.** Still 12 px at least, still inside the tags box, and allies not faded (Task B2, tests `far mode keeps the minimum size` and `an ally never fades`).

---

## PR A: the economy

### Task A1: `economy.js`, the wallet and the record

**Files:**
- Create: `src/components/universe/economy.js`
- Test: `src/components/universe/economy.test.js`

**Interfaces:**
- Consumes: `runtime/saves.js`'s `createSaves` shape (`get`, `set`, `register`); `outfit.js`'s `LOADOUT_KEY`, `readLoadouts`, `STOCK`; `shipyard/build.js`'s `HULL_KEY`, `GARAGE_KEY`, `readHulls`; `crews.js`'s `CREWS` ids.
- Produces: `PILOT_KEY = 'tp-pilot'`; `EARN` (`{ what: { credits, xp } }`); `LEVELS`; `TITLES`; `levelOf(xp) → 1…11`; `createEconomy({ saves, achievements = () => [], standingOf = (side) => null, rankOf = (side) => null }) → { credits, xp, level, owned (Set), earn(what, n = 1, { side } = {}) → { credits, xp, levelUp }, canBuy(item) → { ok, why }, buy(item) → boolean, owns(id), grant(ids), record(), on(fn) → off }`; `migrateOwned({ loadouts, hulls, garage }) → string[]`.

- [ ] **Step 1: Write the failing tests** in `economy.test.js`: `earning adds credits and xp and reports a level up at a threshold` (EARN.killHunter twice from 0 is `{ credits: 2 * EARN.killHunter.credits, … }`; xp 50 is level 2), `killing civilians earns nothing` (`earn('killCivil')` leaves credits 0), `canBuy says owned, credits or the lock` (why is `'owned'`, `'credits'`, `'locked:achievement'`, `'locked:level'`, `'locked:standing'`, `'locked:rank'`), `buy takes the price and keeps the id`, `the migration grants what was fitted` (a `tp-universe-loadout` with `{ xwing: { booster: 'srb' } }` and a hull `{ falcon: { hull: 'hauler', … } }` yields owned containing `'part:booster:srb'` and `'module:hull:hauler'`, credits unchanged; what you own is kept by catalogue key, `kind:slot:id`, since `portal` is both a booster and a paint), `a corrupt save reads as a fresh wallet`, `the save round trips`.
- [ ] **Step 2: Run them**: `npx vitest run src/components/universe/economy.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `economy.js`** with the Interfaces above. `EARN`: killHunter 40/8, killAce 160/30, killCapital 400/80, killPirate 50/10, killPilot 120/25, rescued 90/20, helped 60/12, hunterHelped 45/10, siegePart 150/30, warPoints 8/2 (per point), warWin 250/60, questDone 200/50, found 30/6, standingUp 100/25, allyMade 25/10. Credits are integers; xp integers. `standingOf(side)` returns `{ law, civil, outlaw }` level names or null; `rankOf(side)` a rank id or null. Save debounced 500 ms through `saves.set(PILOT_KEY, …)` on an injectable timer (`later`, `cancel`), with `flush()` for the tab closing; `saves.register({ key: PILOT_KEY, version: 1 })`.
- [ ] **Step 4: Run the tests**: PASS.
- [ ] **Step 5: Commit**: `git add src/components/universe/economy.js src/components/universe/economy.test.js && git commit -m "Universe: a wallet and flight record every world earns into"`.

### Task A2: `catalog.js`, prices and needs

**Files:**
- Create: `src/components/universe/catalog.js`
- Test: `src/components/universe/catalog.test.js`
- Modify: `src/components/universe/paint.js` (add the new paints as data rows), `src/components/universe/outfit.js` (the new stat parts, each with a `look`: the existing part it is drawn as), `src/components/universe/modules.js` (draws a part through its `look`, so no new model), `src/components/universe/shipyard/parts.js` (the new fins module only if fins are a build slot there; otherwise the fins part goes in `outfit.js`)

**Interfaces:**
- Consumes: `outfit.js`'s `PARTS`, `shipyard/parts.js`'s `BUILD_SLOTS`/`modulesFor`, `paint.js`'s `PAINTS`.
- Produces: `CATALOG` keyed by `kind:slot:id` (ids repeat across lists: `portal`, `none`) (`{ key: { key, id, kind: 'part' | 'module' | 'paint', slot, price, needs: { achievement?, level?, standing?: { side, axis, level }, rank?: { side, id } }, from } }`); `itemFor(kind, slot, id)`; `priceOf(id)`; `needText(needs) → string` (the hangar's sentence); `BANDS`.

- [ ] **Step 1: Write the failing tests**: `every part, module and paint has an entry`, `stock is free and needs nothing`, `an achievement lock in outfit.js becomes a need`, `every need names an id that exists` (achievements from `Achievements.jsx`'s `ACHIEVEMENTS`, sides from `sides.js`, war sides and ranks from `galaxy/sides.js` and `galaxy/ranks.js`), `prices are in band` (0 for stock; 100 to 1500 otherwise), `needText reads as a sentence` (`{ level: 5 }` → `'Reach level 5'`; `{ standing: { side: 'rickmorty', axis: 'law', level: 'trusted' } }` → `'Be trusted by the Federation'`; `{ rank: { side: 'rebel', id: 'flight-leader' } }` → `'Fly as a Flight Leader for the Rebellion'`).
- [ ] **Step 2: Run them**: FAIL.
- [ ] **Step 3: Add the new rows** (data only): paints `rebel` “Rebel Alliance” (needs rank side `rebel` any rank: `{ rank: { side: 'rebel', id: 'flight-cadet' } }`), `imperial` “Imperial grey” (`empire`, `ensign`), `redsquadron` “Red Squadron” (`rebel`, `flight-leader`), `citadel` “Citadel issue” (standing rickmorty law trusted), `pollos` “Los Pollos” (standing breakingbad civil hero), `huttgold` “Hutt gold” (level 8: a rank need names one side, so “Captain in any war” can’t be said); parts `incom` guns (`achievement: 'rebels'`), `council` fins (level 5), `vamonos` thrusters (level 3). Then `catalog.js`: the price from `BANDS` by the sum of a part's shares (`boost + accel + cruise + agility + punch`, each 0.25 ≈ 400; guns by firepower, punch ÷ cadence − 1, since punch is a multiplier) or a module's `does` and `plant` (600 per MW above the stock hull's 7), paints 150, with each new row's price set by hand in a `PRICES` override.
- [ ] **Step 4: Run the tests**: PASS. Also `npx vitest run src/components/universe/outfit.test.js src/components/universe/paint.test.js src/components/universe/shipyard/parts.test.js`: PASS.
- [ ] **Step 5: Commit**: `"Universe: a catalogue with a price and a lock on every part, module and paint"`.

### Task A3: the hangar sells, the roll respects ownership

**Files:**
- Modify: `src/components/universe/shipyard/build.js:43-63` (`rollBuild(seed, unlocked, owned = null)`), `src/components/universe/Hangar.jsx`, `src/components/universe/universe.css` (the hangar's styles, for the price pill); ownership is checked in the hangar through a new tested `shop.js` (`pillOf`, `ownsItem`, `ownedModules`), so `outfit.js`'s `isOpen` is unchanged
- Create: `src/components/universe/EconomyProvider.jsx` (`useEconomy()`, holds one `createEconomy` on `runtime/saves`), `src/components/universe/Record.jsx`
- Test: `src/components/universe/shipyard/build.test.js`, `src/components/universe/economy.test.js`

**Interfaces:**
- Consumes: A1 and A2.
- Produces: `useEconomy() → { economy, version, want, marks }` (`economy` is null until its chunk loads, so the portfolio pages never download it; version bumps on `on`); `<Record open onClose />`; `pilotMarks.js` (the standing and rank lookups, tested).

- [ ] **Step 1: Write the failing test** in `build.test.js`: `a roll picks only owned modules` (with `owned = ['hull-a', …]` covering one module a slot, every seed returns those).
- [ ] **Step 2: Run it**: FAIL.
- [ ] **Step 3: Implement**: `rollBuild` filters by `isModuleOpen(m, unlocked) && (!owned || owned.includes(m.id) || m.id === STOCK_BUILD[slot])`. `Hangar.jsx`: every row gets a pill (`Owned`, `Buy · 400 ¢`, `short 120 ¢`, or the lock with `needText`); a click on Buy calls `economy.buy(item)` then the existing `onFit`/`onBuild`; a header button “Record” opens `Record.jsx` (credits, level and title, bar to the next threshold, kills, rescues, wins, quests, a line per side from `standingOf` and the galaxy's oath and rank from `allegiance.js`'s `current` and `warState.mine`). Mount `EconomyProvider` in the app shell beside `OnlineProvider`.
- [ ] **Step 4: Run** `npx vitest run src/components/universe` and `npm run lint`: PASS.
- [ ] **Step 5: Commit**: `"Universe: the hangar sells its parts, and a record card says what you have become"`.

### Task A4: earning in the scenes

**Files:**
- Modify: `src/components/universe/scene.js` (beside `deed(...)`: lines 2197, 2243–2244, 2362, 2888, 3232, 3258, 3269, 3390; the pilot kill at 2832; the siege's `gen` event at 2102), `src/components/universe/online/client.js` (an alliance made emits `{ type: 'allied', id }`; `hunterHelped` is paid in `scene.js` to the pilot who shot the hunter, once per hunter, since the client's `helped` runs on the pilot who was helped), `src/components/galaxy/warfront.js:94,331`, `src/pages/GalaxySurface.jsx:308-316`, `src/pages/Universe.jsx:273-331` (`onEvent`: `kill`, `standing`, the credit note), `src/pages/Galaxy.jsx`
- Test: `src/components/universe/economy.test.js` (the mapping `deedToEarn`)

**Interfaces:**
- Consumes: A1's `earn`. Produces: `deedToEarn(what) → earn key | null` in `economy.js` (`killHunter → killHunter`, `killPirate → killPirate`, `rescued → rescued`, `helped → helped`, `capitalKill → killCapital`; `capitalHurt`, `killCivil`, `killPatrol`, `ran`, `shotLaw`, `busted`, `paidToll`, `angeredPirates`, `clean` → null). The siege's `gen` event earns `siegePart` directly, not through a deed.

- [ ] **Step 1: Write the failing test** `deedToEarn maps the paying deeds and nothing else`.
- [ ] **Step 2: Run it**: FAIL.
- [ ] **Step 3: Implement**: the scene emits `{ type: 'earn', what, n }` from `deed` through `deedToEarn`, from the pilot kill (`killPilot`), the ace (`killAce` when `FACTIONS_ALL[hh.faction]?.ace === hh.kind`), the siege part; the pages call `economy.earn` on it and show `+N ¢` in a page-level `EarnNote.jsx` above the HUD prompt (the galaxy pages have no note slot), and on a level-up “+160 ¢ · Level 4 · Wingmate”. `useEarn.js` holds what is earned before the wallet loads. `warfront.js` earns `warPoints × n` and `warWin`; `GalaxySurface.jsx` earns `questDone` and `found`; `Universe.jsx` earns `standingUp` on a `standing` event whose level is `trusted`, `hero` or `friend`; the scene pays `hunterHelped`; an alliance made earns `allyMade` once per peer id a visit; `standingUp` once per side and level a visit; the galaxy's own scene pays its kills as the universe's does.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build`: PASS. Browser: with `npx vite --port 5173`, on `/universe`, `window.__universeDebug.hunters.pack('empire', state.ship, { size: 1 })`, kill it (or set its hp 0 and step), see `+40 ¢`; open the hangar, buy `srb`, reload, still owned.
- [ ] **Step 5: Commit**: `"Universe: kills, rescues, battles and quests pay into the wallet"`. Open PR A. Add the architecture paragraph and the handoff section.

## PR B: tags and factions

### Task B1: the wire carries level and factions

**Files:**
- Modify: `src/components/universe/online/protocol.js:109-112` (`readHello`), `:17-26` (the wire comment), `src/components/universe/online/client.js:94,241,421-438` (`hello`, the change check, `snapshot`, `setProfile`), `src/components/universe/online/useOnline.js` (profile gains `level` and the wallet's `marks`), `src/components/universe/EconomyProvider.jsx` (`useEconomy({ ask: false })`: the wallet without asking for it, since the link is up on every page), `src/components/universe/standing.js` (`WHO`, moved from `catalog.js`, so the roster names the law as the hangar does), `src/pages/Universe.jsx`, `src/pages/Galaxy.jsx`, `src/pages/GalaxySurface.jsx` (a `tp:standing` or `tp:oath` window event when a standing level turns or you swear)
- Create: `src/components/universe/online/relations.js`
- Test: `src/components/universe/online/protocol.test.js`, `src/components/universe/online/relations.test.js`

**Interfaces:**
- Produces: hello `lv` (int 1…11) and `f: { s, st: { law, civil, outlaw }, w, o, r }`; `readHello` returns `level` (default 1) and `factions` (`{ side, standing, war, oath, rank }`, every field null when absent or junk); `writeFactions({ side, standing, war, oath, rank })` (in `protocol.js`; `null` for nobody's, so no `f` goes); in `relations.js`: `NO_FACTIONS`, `factionsFrom(side, marks)` (your own, from the ship's side, `sides.js`'s `sideOf(kind)` asked by the client so the roster's download stays small, and the wallet's `marks()`), `relation(me, peer) → 'ally' | 'friend' | 'foe' | 'none'` (`me`, `peer`: `{ ally?: boolean, factions }`); `factionText(factions) → string` (“Rebellion · Captain”, “Wanted by the Empire”, “Friend to the Weequay pirates”, joined with “ · ”, the most telling standing only; “” when nothing).

- [ ] **Step 1: Write the failing tests**: `a hello without the new fields reads as before` (level 1, every faction null), `lv is clamped and f is whitelisted` (`lv: 99` → 11; `f.s: 'disney'` → null; `f.r: 'admiral'` with `f.o: 'empire'` → kept, with `f.o: 'rebel'` → null since the rank isn't that side's), `relation: an alliance wins`, `relation: the same oath is a friend`, `relation: opposite oaths in one war are foes`, `relation: wanted by my side's law is a foe`, `factionText names the oath, rank and standing`.
- [ ] **Step 2: Run them**: FAIL.
- [ ] **Step 3: Implement**: `protocol.js` reads with `sides.js`'s `SIDES`, `standing.js`'s `LEVELS` names, `galaxy/sides.js`'s `WARS`/`SIDES`, `galaxy/ranks.js`'s `RANKS`. `client.js` adds `lv` and `f` to `hello()`, compares them in `setProfile` and the hello change check, carries `level` and `factions` on the peer and in `snapshot`. `useOnline.js` passes `level` (`economy?.level`, 1 till the wallet is loaded) and the wallet's `marks()` (which already read the standing, the oath and the rank through `pilotMarks.js`) from `useEconomy({ ask: false })`, so the war and the sides stay out of the site's first download; the client reads them into `factions` with `factionsFrom(sideOf(kind), marks)`, so a change of ship changes the side. Read again on `tp:standing`, `tp:oath` and the economy's `on` (its `version`).
- [ ] **Step 4: Run** `npx vitest run src/components/universe/online`: PASS.
- [ ] **Step 5: Commit**: `"Online: a pilot's level and factions travel in the hello, read against the lists we have"`.

### Task B2: tags you can read

**Files:**
- Create: `src/components/universe/online/tagRules.js`
- Modify: `src/components/universe/online/pilots.js:54,158-166,297-321` (`TAG_FAR`, the tag's build, the tag step), `src/components/universe/online/online.css:11-42`, `src/components/universe/online/Online.jsx` (the `tp:pilot` listener), `src/components/universe/online/client.js` (a `factions` getter: yours, for the tags), `src/components/universe/scene.js:4631` and `src/components/galaxy/scene.js:1920` (the view gains `me`, your ship, for the distance, and `factions`; the galaxy's tags are already `pilots.js`'s, so they change with it)
- Test: `src/components/universe/online/tagRules.test.js`

**Interfaces:**
- Produces: `TAG = { near: 40, mid: 140, far: 600, minPx: 12 }`; `tagMode(dist, { ally }) → { mode: 'near' | 'far' | null, scale (1…0.8), fade (0…1), showDist }`; `fontPx(scale)` (the type before the scale, so it's 12 px at least on screen); `distText(units) → '320 m' | '1.2 km'` (a unit is 10 m); `keepIn(x, y, w, h, boxW, boxH)` (the tag kept inside the tags box, or null with its point off it).

- [ ] **Step 1: Write the failing tests**: `near under 40 with no distance`, `distance shows from 40`, `far mode from 140, fading to nothing at 600`, `an ally never fades`, `far mode keeps the minimum size` (scale never under 0.8, and `fontPx(scale) × scale` never under 12), `distText rounds`, and `keepIn`'s (a tag at the edge of a phone pushed back inside).
- [ ] **Step 2: Run them**: FAIL.
- [ ] **Step 3: Implement** `tagRules.js`, then `pilots.js`: the tag is a line `<b>name</b><small>dist</small><em>Lv 7</em>`, the rank's name (near mode only) and `<i>shield</i>`, attributes `data-mode`, `data-relation` (from `relation({ ally: sh.ally, factions: myFactions }, p)` with `myFactions` passed in `view.factions`, the client's `factions`), `data-level`, style `--font` and `--fade`, and the scale in its inline transform; the distance is from `view.me` (your ship) when there is one; a click dispatches `window` event `tp:pilot` with `{ id }` (the tags box gets `pointer-events: none` on the box, `auto` on the tag). `online.css`: `font-size: max(0.8rem, var(--font))` (`max(12px, 0.8rem)` would come out under 12 px at a scale of 0.8), `opacity: var(--fade)`, `--relation` colours ally `#8dffad`, friend `#8fc6ff`, foe `#ff6a5c`, none `#ff9a85`. `Online.jsx` listens for `tp:pilot` and opens the roster scrolled to that row.
- [ ] **Step 4: Run** tests and `npm run lint`: PASS. Browser: `node scripts/online-check.mjs --universe` (two contexts on `/universe`), Bravo 300 units off Alpha's nose: the far tag shows name and distance, at 12 px at least on screen and inside the tags box, at 1280 wide and at 360.
- [ ] **Step 5: Commit**: `"Online: tags read from across the map, coloured by whose side you are on"`.

### Task B3: the roster says whose side, and allies have an edge marker

**Files:**
- Modify: `src/components/universe/online/Online.jsx:190-259` (the `Pilot` row, and the “You’re …” row's Record button, which shows `Record.jsx` lazily in the roster's place), `src/components/universe/scene.js:2506,2596-2611` (the HUD's threat arrows: a sibling list `.universe-mate`), `src/components/universe/UniverseMap.jsx:266-268` and `src/components/galaxy/GalaxyView.jsx:186-188` (four `.universe-mate` beside the three `.universe-threat`), `src/components/galaxy/scene.js:1594,1656-1672` (its HUD has threat arrows, so mates too; `factions` went into its view in B2), `src/components/universe/online/pilots.js` (`mates`: your allies in view), `src/components/universe/universe.css` (the mate's colour; the record's styles move to a new `src/components/universe/record.css` that `Record.jsx` imports, since the roster shows it on any page), `scripts/online-check.mjs`
- Test: none new beyond B1's (`factionText`); a browser check.

- [ ] **Step 1: Implement**: the row's second line is `factionText(p.factions)` after the ship, with `Lv N`; `data-relation` on the row for colour. The HUD step fills `.universe-mate` from `pilots` entries with relation `ally` (and the pilot being flown to, PR C) that project off screen, nearest four, each with the name as text and the angle as `--angle`, as the threats do.
- [ ] **Step 2: Run** `npm test`, `npm run lint`, `npm run build`; extend `scripts/online-check.mjs` to read the other's row and expect a `Lv` chip (after `--then`, and in `--universe`, which also opens the record from the roster, makes the two allies, checks the ally's tag unfaded past 600 units, the near tag's level chip and the `.universe-mate` with Bravo behind). PASS.
- [ ] **Step 3: Commit**: `"Online: the roster says whose side each pilot flies for, and allies off screen get a marker"`. Open PR B.

## PR C: flying to a pilot

### Task C1: `pilotGoal.js`

**Files:**
- Create: `src/components/universe/pilotGoal.js`
- Test: `src/components/universe/pilotGoal.test.js`

**Interfaces:**
- Produces: `PILOT_GOAL = /^pilot:/`; `pilotId(goal) → id | null`; `parkBehind(pose, { back = 6 } = {}) → { x, y, z, heading }` (behind along their heading, at their height, facing their way); `pilotSpace(space, id, pose) → space with goals[`pilot:${id}`] = { id, ...park, at, r: 0, reach: 0 }` (the park, with `at` as the other goals have it; no pose, no goal); `reached(ship, pose, within = 8) → boolean`; `REAIM_MS = 1000`.

- [ ] **Step 1: Write the failing tests**: `the park is six units behind on the heading`, `pilotSpace adds the goal and leaves the rest`, `reached within eight`, `a stale pilot ends the trip` (`pilotSpace(space, id, null)` has no such goal).
- [ ] **Step 2: Run**: FAIL. **Step 3: Implement.** **Step 4: Run**: PASS.
- [ ] **Step 5: Commit**: `"Universe: a parking spot behind a moving pilot"`.

### Task C2: the universe map flies to a pilot

**Files:**
- Modify: `src/components/universe/scene.js:1533-1590` (`travel`: accept `pilot:<id>` while `pilots.pose(id)` has them; the park is `parkBehind`), `:1608` (beside `frontSpace`: `withPilot`, `pilotGone` and `chasePilot`, which runs each frame before the autopilot: re-aim the park and `state.auto.space` (`pilotSpace(SPACE, …)`) every `REAIM_MS`; end with `{ type: 'arrived', id, done: true }` and the HUD note “With <name>” when `reached`, or `{ type: 'lost', id, name }` and “<name> has gone” when the pilot is gone or hidden; `state.auto.pilot` is the pilot flown to), the HUD's nav diamond (on the pilot, their name as its text), `src/components/universe/nav.js:170` (`legOf(ship, id, pose)`: a pilot goal is in the sector their pose is in, through `layout.js`'s `sectorOf`), `src/components/universe/online/pilots.js` (expose `pose(id)` → `{ x, y, z, heading, name }` as last drawn, or null), `src/components/universe/online/Online.jsx` (“Fly to” on a row in the same flight place when you have a ship; “Go” to another flight place also sets `online.follow(id)`), `src/components/universe/online/useOnline.js` (`follow`, `followId`, cleared after 60 s and on going offline), `src/pages/Universe.jsx:158-185` (on the ship being in with `followId`, `travel('pilot:' + id, drive)`, tried every 500 ms till it goes; `followId` cleared when that trip ends: `arrived`, `jumped` or `lost`). The HUD notes are the scene's own `state.note` (set as `textContent`), not the page's.
- Test: `src/components/universe/nav.test.js` (`legOf` with a pilot goal in the other sector routes through the portal)
- Create: `scripts/flyto-check.mjs`

- [ ] **Step 1: Write the failing test** in `nav.test.js`: `a pilot goal in the other sector goes by the portal`.
- [ ] **Step 2: Run**: FAIL. **Step 3: Implement** as above. The hyperdrive path (`state.jump`) takes the park as it was at the flash. **Step 4: Run** `npm test`, `npm run lint`, `npm run build`: PASS. `PORT=5175 node scripts/flyto-check.mjs`: two contexts online on `/universe` with ships; Bravo parked at a world; Alpha presses “Fly to”; within 90 s Alpha's ship is within 8 units of Bravo's pose (read `window.__universeDebug.state.ship` and `pilots.pose(id)`); then Bravo goes offline mid-trip on a second run and Alpha's HUD shows “has gone” with no console error. `--fake` checks the scene alone with no relays (a made-up pilot through `pilots.pose`): the re-aimed trip, the hyperdrive landing behind them, the portal leg, and the pilot gone mid-trip.
- [ ] **Step 5: Commit**: `"Universe: fly to any pilot on the map, through the portals and on the hyperdrive"`.

### Task C3: the galaxy flies to a pilot in the same system

**Files:**
- Modify: `src/components/galaxy/scene.js:1250-1255` (the `state.auto` step: re-aim and arrive as C2), a `travel`-like entry `flyTo(id)` on the scene's handle, `src/pages/Galaxy.jsx` (the follow hand-off and the notes), `src/components/universe/online/Online.jsx` (“Fly to” when both are in the same `/galaxy/<sys>`)
- Test: covered by C1; a run of `scripts/flyto-check.mjs --galaxy` on `/galaxy/yavin`.

- [ ] **Step 1: Implement.** **Step 2: Run** the checks: PASS.
- [ ] **Step 3: Commit**: `"Galaxy: fly to a pilot in the same system"`. Open PR C. Update the architecture paragraph and the handoff.
