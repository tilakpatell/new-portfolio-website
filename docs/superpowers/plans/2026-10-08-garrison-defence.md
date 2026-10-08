# Garrison Defence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The galaxy's parked capital ships defend their planet, scaled to the holder's grip and your oath: warn, scramble, fire, leash and stand down. Your own side's fleet covers you, hunter packs fall back on their fleet, war-battle fighters come out to the battle's edge, and the drop-in Star Destroyer fires.

**Architecture:** One pure, seeded, tested mind per system (`galaxy/garrisonRules.js`) reads the world's posts (`world.posts()`), your ship, your stance and the tier (`warEffects.js`). It returns events that a thin glue module (`galaxy/garrison.js`) plays through the systems the scene already has: `hunters.pack`/`leave`/`damage`, `wingmen.join`, the shared `bolts` pool, `hurt` and `emit`. The comms lines are a page-level pure module (`galaxy/garrisonLines.js`), as `warVoice.js` is.

**Tech Stack:** JavaScript (ES modules), three.js, React, Vitest. `src/lib/ai` (perception) and `universe/targeting.js`'s `sweptHit`.

**Spec:** `docs/superpowers/specs/2026-10-08-garrison-defence-design.md`

## Global Constraints

- Game rules live in a pure file with a test beside it (`x.js` → `x.test.js`); each test runs under a second, with no network (`docs/health/RULES.md`).
- New files stay under 800 lines. `hunterRules.js` (1,382 lines) must stay under 1,500. No new file may push `big-files` past its budget of 30.
- No new dependency. `node scripts/health.mjs --check --skip build` stays green.
- Copy: British spelling, curly quotes (’ “ ”), sentence case, the site's own words, no sequel trilogy (Episodes 7–9). Line texts are 3–120 characters, with no straight `'` or `"`. Artoo's and Chewie's lines are `[bracketed]`.
- Under reduced motion the scene has no hunters, wingmen, pieces or war, and it has no garrison either (`garrison = reduced ? null : …`; every call is `garrison?.`).
- Never skip, quieten or delete a test. Keep every existing dev hook, event, save key and line.
- Done means all four green: `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`.

## Review Focus

1. **Jumping in on top of a fortress** (the arrival point inside a fire ring). Expect 8 s of grace with nothing fired, then the defence. Pinned in Task 2 by `arrival grace holds fire for eight seconds inside the fire ring`.
2. **Swearing an oath mid-fight**, so the stance turns friend while a wave is out. Expect a stand-down and a recall, with no more bolts at you. Pinned in Task 2 by `a stance turning friend mid-fight recalls and stands down`.
3. **A war battle starting while the garrison fights.** Expect a silent stand-down: a recall, no line, no bolts. Pinned in Task 2 by `a battle starting mid-fight recalls without a word`.
4. **The posts vanishing mid-fight** (the owner flips, or `quiet`). Expect no crash and a stand-down. Pinned in Task 2 by `no posts stands down`.
5. **A long frame** (a tab coming back: `dt` 0.5). Expect a bolt not to tunnel through you, and the leash timers in seconds. Pinned in Task 2 by `a long frame neither tunnels a bolt nor skips the leash`.

---

### Task 1: Stance, grip and tier in `warEffects.js`

**Files:**
- Modify: `src/components/galaxy/warEffects.js` (doc block :10-25, `effectsFor` :50-78)
- Test: `src/components/galaxy/warEffects.test.js` (`KEYS` at :15)

**Interfaces:**
- Produces: `effectsFor(sysId, table, current)` returns three more keys:
  - `stance: 'friend' | 'enemy' | 'wary'`
  - `grip: number` (0..1 in tenths)
  - `tier: 'thin' | 'held' | 'fortress'`
- Produces: `export function gripOf(row) → { grip, tier }`
- Produces: `export function stanceOf({ owner, side, deserter }) → stance`

- [ ] **Step 1: Write the failing tests** in `warEffects.test.js`:
  - `KEYS` gains `'grip', 'stance', 'tier'`.
  - `the holder’s fleet treats you by your oath`:
    - yours → `'friend'`
    - sworn to the other side → `'enemy'`
    - unsworn → `'wary'`
    - a Hutt-held system → `'wary'`, sworn or not
    - a deserter → `'enemy'`
  - `grip reads the holder’s hold of the system`, through `tableWith(war, id, row)`:
    - `{ control: 1, kind: 'blockade', worth: 1 }` → `{ grip: 1, tier: 'fortress' }`
    - `{ control: 0.75, worth: 2 }` → `{ grip: 0.9, tier: 'fortress' }`
    - `{ control: 0.7, kind: 'assault', worth: 1 }` → `{ grip: 0.7, tier: 'held' }`
    - `{ control: 0.6, cut: true, front: true }` → `{ grip: 0.2, tier: 'thin' }`
    - `{ control: 0.5 }` → `tier: 'held'`
    - `{ control: 0.4 }` → `'thin'`
  - `grip moves in tenths, so the effects don’t change every second`: control 0.73 and 0.74 give the same `grip` (0.7).
- [ ] **Step 2: Run them**: `npx vitest run src/components/galaxy/warEffects.test.js`. Expect FAIL (no `stance`).
- [ ] **Step 3: Implement `gripOf`, `stanceOf` and the three keys.**
  - `gripOf`: start from `row.control ?? 1`; `× 0.6` if `cut`; `− 0.15` if `front || attack`; `+ 0.25` if `kind === 'blockade'`; `+ 0.15` if `(worth ?? 1) >= GCW.stronghold`. Clamp to 0..1 and round to tenths. Tier: `grip > 0.85` → fortress, `>= 0.5` → held, else thin.
  - Import `GCW` from `./gcwRules`.
  - Stance: `side === null` or `owner === 'hutt'` → wary; `yours` → friend; else enemy.
  - Update the doc block.
- [ ] **Step 4: Run** `npx vitest run src/components/galaxy/warEffects.test.js src/components/galaxy/roamRules.test.js src/components/galaxy/siteWar.test.js`. Expect PASS.

### Task 2: The garrison mind, `garrisonRules.js`

**Files:**
- Create: `src/components/galaxy/garrisonRules.js` (under 800 lines)
- Test: `src/components/galaxy/garrisonRules.test.js`

**Interfaces:**
- Consumes:
  - `TURRETS`, `HULLS` from `../universe/wars` (shares of length, `[x right, y up, z fwd]`; HULLS `[zShare, rShare]`)
  - `FLIGHTS.carriers` from `../universe/battleFlights`
  - `sweptHit(b0, b1, t0, t1, r)` from `../universe/targeting`
  - `createSenses`, `sense`, `belief` from `../../lib/ai/perception`
- Produces:
  ```
  GARRISON  (the constants below)
  SIDE_FACTION = { empire: 'navy', remnant: 'remnant', rebel: 'rebelnavy', newrepublic: 'newrepublic', republic: 'republicnavy', separatists: 'separatists', hutt: 'weequay' }
  ringsOf(size, tier) → { fire, scramble, warn, leash }
  postOf({ id, kind, side, size, at: {x,y,z}, yaw }, out = {}) → { id, kind, side, size, at, yaw, carrier, hangar: {x,y,z}, batteries: [{x,y,z}], spheres: [{ c: {x,y,z}, r }] }
  createGarrison({ rand = Math.random, small = false } = {}) → {
    step(dt, world) → events[],
    provoke(how: 'hit' | 'down' | 'hull'),
    call(),
    reset(why: 'enter' | 'jump' | 'down' | 'respawn'),
    state, busy, info, bolts
  }
  world = { posts, you: { x, y, z, vx, vy, vz } | null, stance: 'friend'|'enemy'|'wary'|null, tier, battle: boolean,
            planet: { c: {x,y,z}, r } | null, seesThrough: (a, b) => boolean (default () => true),
            fighters: [{ id, at, size }] (the garrison's own, alive), chasers: [{ id, at, vel?, size }] (hunters after you that aren't the garrison's) }
  events:
    { type: 'say', sub, post, secs? }   sub ∈ challenge | warn | clear | scramble | open | standdown | cover | escort | reinforce
    { type: 'scramble', post, from: {x,y,z}, size, ace, wave }
    { type: 'volley', post, from, to, friendly }   (to = from + aim direction × the bolt's reach, for drawing)
    { type: 'hit', damage }    a bolt reached you
    { type: 'cover', id, damage }    a friendly bolt reached a chaser
    { type: 'escort', post }
    { type: 'recall' }
  state ∈ 'calm' | 'hail' | 'fight';  busy = state !== 'calm'
  info = { state, alarm, grudge, reserve, countdown, out, track, bolts: n }
  ```
- `GARRISON` (exact values, from the spec):
  ```
  tiers: { thin: { scale: 0.8, wave: 2, reserve: 4, volley: [2.4, 3.4], damage: 10, ace: 0 },
           held: { scale: 1, wave: 3, reserve: 8, volley: [1.6, 2.4], damage: 12, ace: 0 },
           fortress: { scale: 1.25, wave: 4, reserve: 14, volley: [1.0, 1.6], damage: 14, ace: 1 / 3 } },
  ring: { base: 24, perSize: 1.2, scramble: 40, warn: 60, leash: 40 },   // fire = (base + perSize·size)·scale; the rest added on, ·scale
  challenge: 1.5, countdown: 8, countdownFortress: 5, grace: 8, waveGap: 6, maxWaves: 2, refill: 40,
  leashFor: 6, alarmFall: 120, grudge: 90,
  alarmBy: { scramble: 0.2, hit: 0.25, down: 0.4, hull: 0.2 }, alarmSkip: 0.3,
  bolt: { speed: 40, r: 0.8 },  // life = the fire ring ÷ speed × 1.3
  aim: { far: 0.09, near: 0.012, settle: 3, jink: 25 * Math.PI / 180, keep: 1 / 3 },
  bolts: 12, smallBolts: 6,
  cover: { damage: 2, aim: 0.03 }, escort: { chasers: 2, every: 60 },
  senses: { sight: { range: 400, cone: -1, far: 1.5 }, hearing: { range: 300 }, memory: 12, intuition: 3 },
  sure: 0.5,  // a belief this confident, or visible, is "sure of you"
  ```

Behaviour the tests pin (from the spec, section 3):
- **Hostile** = `stance === 'enemy' || grudge > 0`. With stance `'friend'` only covering and escort run. With stance `null` or no posts, the mind is calm.
- **calm → hail:** a post is sure of you inside its warn ring, outside grace, with no battle.
  - Hostile: say `challenge`. If `alarm >= alarmSkip`, go straight to fight with say `scramble`.
  - Wary: say `warn` with `secs` (`countdownFortress` when the tier is fortress, else `countdown`).
- **hail, enemy:** after `challenge` seconds, with you inside a scramble ring → fight, say `scramble`. You out of every warn ring → calm, silently.
- **hail, wary:** the countdown runs while you're inside a warn ring.
  - Out of every warn ring → calm, say `clear`.
  - Countdown at 0 with you inside a scramble ring → `grudge = GARRISON.grudge`, fight, say `scramble`.
- **fight, waves:** you inside a scramble ring; `reserve >= 1`; `fighters.length < maxWaves × wave`; no wave yet, or `fighters.length <= floor(lastSize / 2)`; at least `waveGap` since the last.
  - It launches from the nearest carrier post, else the nearest post: `size = min(wave, reserve)`, `ace = rand() < tier.ace`.
  - `reserve` starts at the tier's and refills one every `refill` seconds.
- **fight, guns:** each post that sees you (belief visible) inside its fire ring counts its own cooldown (`tier.volley`).
  - It fires from the nearest battery with `seesThrough(battery, you)`, holding the shot if the line passes within `size + 0.5` of a fighter.
  - The first volley of a fight also says `open`.
- **Leash:** you outside every leash ring, or `you` null, or no belief at all, adds to `out`; otherwise `out = 0`. At `out >= leashFor`: `recall`, say `standdown`, calm.
- **Bolts:**
  - Aim: lead by time of flight. Miss by a random offset of up to `d × lerp(far, near, track)`.
  - `track += dt / settle` while your velocity turns slower than `jink` a second; else `track = min(track, keep)`.
  - Movement: swept against you (`sweptHit` with your last and current position, `r`) and against the planet sphere (stopped, no event).
  - A full pool (`bolts`, or `smallBolts` when `small`) skips the volley.
- **Grace:** `reset('enter' | 'jump' | 'down' | 'respawn')` → calm, bolts cleared, `out = 0`, `grace = GARRISON.grace`. `enter` and `jump` also clear `alarm`, `grudge`, the beliefs and the reserve.
- **Battle:** `world.battle` true while not calm → `recall` with no say, calm, bolts cleared.
- **Friend:**
  - Each post fires on the nearest chaser inside its fire ring (`seesThrough` from the post). Error is `d × cover.aim`; the bolt is swept against the chaser at `size + 0.3`, giving `cover { id, damage: 2 }`. The first one of a visit says `cover`.
  - With `escort.chasers` or more inside a post's scramble ring and `escort.every` since the last: `escort`, then say `escort`.
- **Escalation:**
  - `provoke(how)` adds `alarmBy[how]` (clamped to 1), sets `grudge = GARRISON.grudge`, and from calm or hail goes to fight with say `scramble`.
  - `alarm` falls by `1 / alarmFall` a second; `grudge` by 1 a second.
  - `call()` acts at the next step only if you're inside a warn ring and the stance isn't friend: grudge set, and from calm or hail, fight with say `reinforce`.

- [ ] **Step 1: Write the failing tests.** Use helpers `seeded(1)` (from `src/lib/seeded.js`); `DT = 1/30`; `post(over)` building a `postOf({ id: 'p', kind: 'destroyer', side: 'empire', size: 30, at: {x:0,y:0,z:0}, yaw: 0 })`; `run(g, seconds, world | (t) => world)` collecting events. Tests:
  - `postOf puts a battery for every turret and a sphere for every hull section`: destroyer → 12 batteries, 6 spheres; a sphere's `r` is `rShare × size`; the hangar is below `at` by more than the middle sphere's `r`; `yaw` π/2 turns a nose-forward point onto +x.
  - `rings grow with the ship and the tier`: `ringsOf(30, 'held').fire === 60`; fortress fire is 75; thin 48; `warn > scramble > fire`.
  - `an enemy is challenged, then scrambled at once inside the scramble ring`: events `say challenge`, then `say scramble` and `scramble` with `size 3` for held, `from` equal to the post's hangar.
  - `an unsworn pilot is warned with a countdown and thanked for leaving`: `say warn secs 8`; flying out past warn gives `say clear` and no `scramble`.
  - `an unsworn pilot who lingers past the countdown is fought`: inside scramble for 9 s → `scramble`.
  - `a fortress counts down from five`.
  - `the planet hides you`: `seesThrough` false → no hail over 5 s while unseen from the start; seen then hidden → still in hail or fight for the intuition (3 s).
  - `waves come from the reserve and never more than two at once`: held over 120 s with `fighters` echoing the launched ones (none killed) → total launched ≤ 6. Kill them all → the next comes after `waveGap`. The reserve runs out after 8 fighters with no refill inside 40 s.
  - `a steady pilot is hit more than a jinking one`: 20 s at 30 units, held; steady straight flight against a 90°-a-second weave; hits steady > hits weave × 1.5, over seeds 1–5 summed.
  - `bolts hurt by the tier`: every `hit` has `damage` 10, 12 or 14 for thin, held, fortress.
  - `no shot through its own fighters`: a fighter sitting on the line → no `volley` for 5 s.
  - `the leash recalls them and stands down`: fight, then you at 1,000 units → after 6 s `recall`, `say standdown`, state calm.
  - `arrival grace holds fire for eight seconds inside the fire ring`: `reset('enter')`, you at 30 units → no `volley` or `scramble` before 8 s, both after.
  - `a stance turning friend mid-fight recalls and stands down`.
  - `a battle starting mid-fight recalls without a word`: `recall` and no `say` in that step.
  - `no posts stands down`.
  - `a long frame neither tunnels a bolt nor skips the leash`: one `step(0.5)` with a bolt crossing you → `hit`; `out` grows by 0.5.
  - `shooting raises the alarm and turns a wary mind`: `provoke('hit')` in calm and wary → fight; `grudge` 90; after 91 s, out of range and calm, a new visit is warned again.
  - `trouble remembered skips the challenge`: alarm ≥ 0.3 → straight to `scramble`.
  - `a friend’s fleet shoots what chases you`: stance friend, a chaser at 40 units → `cover` events, `say cover` once; two chasers inside scramble → one `escort`, none again inside 60 s; never a `hit` on you.
  - `a call brings them out early`: enemy calm, you inside warn → `call()` → `say reinforce` and fight; you outside warn → nothing.
  - `the same on any frame rate`: the challenge-and-scramble run at 1/30 and 1/120 gives the same `say` sequence and the scramble within 0.1 s.
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/garrisonRules.test.js`. Expect FAIL (no module).
- [ ] **Step 3: Implement `garrisonRules.js`** to the interfaces and behaviour above. Each post keeps a perception `me` (`{ pos, dir: null, beliefs: {}, now: 0 }`) keyed by post id; it is dropped when the post goes. Your shots heard are `call`/`provoke`'s business, not stims. Keep the objects (posts' `me`, bolts) and allocate nothing per step past a new bolt. A header comment in the file's voice says what it is and points at the spec.
- [ ] **Step 4: Run** `npx vitest run src/components/galaxy/garrisonRules.test.js`. Expect PASS, the file under a second.

### Task 3: Tagged and homed packs in `hunterRules.js`

**Files:**
- Modify: `src/components/universe/hunterRules.js`:
  - `pack()` destructure (:696) and pack object (:708)
  - events (:811, :817, :836)
  - `h.target` (:758)
  - gone branch (:1065-1071) and removal (:1104-1110)
  - `leave` (:1329)
  - `strength` (:1263)
- Modify: `src/components/universe/hunters.js`: `answer` (:113-117), `leave`, `strength`
- Test: `src/components/universe/hunterRules.test.js`, `src/components/universe/hunters.test.js`

**Interfaces:**
- Produces:
  - `pack(faction, ship, { …, tag = null, home = null })`, where `home` is `{x,y,z}`
  - `hunted`, `escaped` and `cleared` events carry `tag`
  - `targets[i].tag`
  - `hunt.hit`/`damage` results expose `hunter.pack.tag`, and `hunters.js`'s answer gains `tag`
  - `leave(faction = null, tag = null)`
  - `strength(faction, tag = null)`
  - `HOME = { dock: 6 }`
- Behaviour: a gone pack with a `home` steers to it at 1.2× its top speed and a member is removed within `HOME.dock` of it (or after `fade > 30`). A gone pack with no home flies as today.

- [ ] **Step 1: Write the failing tests:**
  - `a tagged pack’s events and targets carry its tag`
  - `leave with a tag recalls only that pack` (two empire packs, one tagged `'g'`: after `leave('empire', 'g')` the other is still `active` and in `targets`)
  - `a recalled pack with a home flies there and is gone there` (home `{x:0,y:0,z:150}`, you at the origin: every member's distance to home falls, `count` reaches 0 inside 40 s, the last removal within 8 of home)
  - `a pack with a home that loses you goes home` (you boosting away past `LOSE.far`)
  - `strength counts a tag alone`
  - in hunters.test.js: `a hit says which pack it was`
- [ ] **Step 2: Run** `npx vitest run src/components/universe/hunterRules.test.js src/components/universe/hunters.test.js`. Expect FAIL.
- [ ] **Step 3: Implement** the additions. `hunterRules.js` stays under 1,500 lines (`wc -l`).
- [ ] **Step 4: Run** the same command. Expect PASS, with the existing tests at :377, :396, :448, :456, :474, :874 and :904 unchanged and green.

### Task 4: The war battle's edge ring and the unsworn grudge

**Files:**
- Modify: `src/components/universe/battleKit.js`: `BATTLE` gains `edge: 2.4`, `edgeOn: 2`, `grudge: 45`.
- Modify: `src/components/universe/battle.js`:
  - `b.you` gains `angry: [0, 0]` (:127)
  - `youIn`/`hostile`/`youNear`/`youFor`/`edge` (:136) into `k` (:150)
  - `setYou` resets `angry` and `edge` (:268)
  - `moveBolts` gates (:280, :346)
  - `pickEdge()` at the top of `step` (:454), and the angry decay there
  - `b.hit` unsworn (:496)
  - the API comment (:67-89)
- Modify: `src/components/universe/battleTactics.js`: `alive(t, f)` (:70) and its call sites (:225, :227, :280); the you-branch (:152); the edge claim in `think` after the rtb return (:271).
- Modify: `src/components/universe/battleAi.js`: `fighterTarget` (:150) first line, the you-branch (:173), `targetAlive` (:181, :206), the edge-pull gate (:285).
- Modify: `src/components/universe/battleFlights.js`: `steer` wingman (:316) and leader (:318) conditions gain `!k.edge.has(f)`.
- Modify: `src/components/universe/battleCapitals.js`: the point-defence gate (:125) becomes `k.youNear() && k.hostile(cap.team)`.
- Modify: `src/components/galaxy/warfront.js`: the `onMine` tally guard (:345) gains `team !== null`.
- Test: `src/components/universe/battle.test.js`, `src/components/universe/battleTactics.test.js`

**Interfaces:**
- Produces: `k.hostile(team)`, `k.youNear()`, `k.youFor(f)`, `k.edge` (a `Set`), and `b.you.angry`.
- Unsworn: `b.hit(from, to, damage)` on a fighter or hull of either team returns the usual `{ id, kind, at, size, down }` and sets `b.you.angry[team] = BATTLE.grudge`. It skips aces, runners, objectives, subsystems and planned turrets, and never calls `onMine`.
- The shapes:
  - `hostile(team)` is `team !== b.you.team` when sworn, else `b.you.angry[team] > 0`.
  - `youIn()` keeps 1.4 radii but takes a sworn pilot or an angry team.
  - `youNear()` is the same out to `BATTLE.edge`.
  - `youFor(f)` is `hostile(f.team)` and either inside 1.4 radii, or in `edge` and inside `BATTLE.edge`.
  - `pickEdge` uses no `rand()` and walks `b.fighters` in order.
  - Eligible: `alive`, `hostile(team)`, not a bomber, not `rtb`, not frozen, not an ace, not a wave.
  - The ring is outside 1.4 radii and inside `BATTLE.edge` radii.
  - Kept members are refilled to `edgeOn` a team.

- [ ] **Step 1: Write the failing tests.** Put the pilot at `{ x: 0, y: 0, z: 250 }` for the ring (radius 125) and `z: 325` for outside. Tests with `tactics` true and false:
  - `a pilot at the battle’s edge draws two interceptors at most`: on you ≤ 2 every step; ≥ 1 within 10 s; all team 1; one comes within 20.
  - `past the edge nobody comes`: 0.
  - `the edge is a fight`: some `hurt` in 30 s.
  - `point defence reaches the edge`: a team-1 `flak` bolt while you're 15 from a battery outside 1.4 radii.
  - `an unsworn pilot who fires on a side is hunted by that side alone`: `angry[1] > 0`, `angry[0] === 0`, only team 1 on you; nobody after `grudge + 5` s.
  - `an unsworn pilot’s shot at an ace counts nothing`: `onMine` not called.
- [ ] **Step 2: Run** `npx vitest run src/components/universe/battle.test.js src/components/universe/battleTactics.test.js`. Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/components/universe/battle src/components/universe/battleTactics src/components/universe/battleDifficulty src/components/universe/battleFlights src/components/galaxy/warfront`. Expect PASS, including:
  - fixed-step determinism (battle.test.js:171)
  - tactics off unchanged (battleTactics.test.js:152)
  - battle.test.js :340 and :348
  - battleDifficulty.test.js :83
  - warfront.test.js :154 and :293
  - the 64-fighter performance tests
  - the files-under-800 tests

### Task 5: The comms, `garrisonLines.js`, and the page

**Files:**
- Create: `src/components/galaxy/garrisonLines.js`
- Test: `src/components/galaxy/garrisonLines.test.js`
- Modify: `src/pages/Galaxy.jsx`: the `onEvent` intercept next to the `battle` one (:373-380)

**Interfaces:**
- Consumes: `castFor(sysId, side)` (`warCast.js:26`) → `{ name, color, … } | null`; `SIDES[side].colour` (`sides.js`).
- Produces: `GARRISON_SUBS`, `CAPITAL_SUBS` and `garrisonSay(e, crewId) → line[]`.
  - `e = { type: 'event', id: 'garrison' | 'capital', sub, side?, sys? }`.
  - A line is `[who, text, undefined, named?]`.
  - A garrison exchange is the commander's line `['comms', text, undefined, { name, color }]` (Jabba's in `[in Huttese, …]`), then 1–2 crew lines. A capital exchange is the crew's lines alone.
  - An unknown crew or sub gives `[]`.
- `GARRISON_SUBS = ['challenge', 'warn', 'clear', 'scramble', 'open', 'standdown', 'cover', 'escort', 'reinforce']`
- `CAPITAL_SUBS = ['fired', 'shielded', 'dome', 'open', 'bridge', 'dead', 'fled', 'gone', 'wave']`
- Crews and speakers:
  - `cruiser`: rick, morty
  - `xwing`: luke, r2
  - `falcon`: han, chewie
  - `rv`: walt, jesse
- Page: `{ type: 'event', id: 'garrison' | 'capital' }` → `comms.current?.handle({ type: 'lines', lines, urgent: e.sub !== 'clear' })`, and `notePilot('Restricted space · turn back')` on `garrison`/`warn`; return.

- [ ] **Step 1: Write the failing tests:**
  - `every crew has every garrison and capital moment`
  - `the lines keep the site’s copy rules` (3–120 characters, no `'` or `"`, `r2`/`chewie` bracketed, the speaker one of the crew's)
  - `the commander speaks first, named and coloured` (sides `empire`, `rebel`, `republic`, `separatists`, `hutt`; Jabba bracketed)
  - `an unknown moment says nothing`
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/garrisonLines.test.js`. Expect FAIL.
- [ ] **Step 3: Write the lines and the page intercept.** Use the site's own words and the films' feel, with no quoted dialogue. The commander's line is generic to the side ("Unidentified ship, you are inside the picket. Turn back now.") and never names a ship class wrongly.
- [ ] **Step 4: Run** `npx vitest run src/components/galaxy/garrisonLines.test.js src/components/galaxy/lines.test.js src/components/galaxy/battleCrews`. Expect PASS.

### Task 6: Posts in `world.js`

**Files:**
- Modify: `src/components/galaxy/world.js`:
  - a `posts` list by `capitals` (:105)
  - `BUILD.fleet(p, i)` (:250)
  - `setEffects` teardown and build (:861-878)
  - `out.posts()` after `out.garrison` (:855)
  - the header doc
- Test: `src/components/galaxy/world.test.js`

**Interfaces:**
- Consumes: `postOf` (Task 2).
- Produces: `world.posts() → post[]` (Task 2's shape). It lists only the shown ones: a fleet post when `!ambient.on && !hidden[piece]`, a garrison post when `!ambient.on`. `at` and `yaw` are read live from the holder's `position` and `rotation.y`. The side is the war's spelling (`separatist` becomes `separatists`). Ids are `fleet-${i}-${kind}-${j}` and `garrison-${kind}-${j}`. The post objects are kept and refreshed in place.

- [ ] **Step 1: Write the failing tests** (the `kit()` and `T0` conventions):
  - `Hoth’s fleet stands as posts`: every post `side 'empire'`; batteries `TURRETS[kind].length`.
  - `a garrison’s escorts stand as posts`: Mustafar `setEffects({ fleet: 'rebel', heat: 0 })` → two `garrison-` posts of side `'rebel'`; `setEffects(null)` → none of them.
  - `no posts while the battle is on`: `quiet(true)` → `[]`.
  - `a post rides with its ship`: `at.y` after `update(T0 + 30, …)` equals the holder's.
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/world.test.js`. Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same. Expect PASS, the existing tests :67-78, :80-90, :122-139, :141-169 and :228-238 unchanged.

### Task 7: The drop-in Star Destroyer fires in the galaxy

**Files:**
- Modify: `src/components/galaxy/scene.js`:
  - `happen('destroyer')` (:1544-1552)
  - `onHunters` (:1517-1527)
  - `pieces.update` (:1581)
  - `strike` (:940-946)
  - the lock candidates (:1454-1461)
  - the tunnel and `enter` (:1261, :434)
  - `__galaxyDebug` (:2380)

**Interfaces:**
- Consumes: `pieces.update(dt, t, camera, ship)`, `pieces.drain()`, `pieces.hit(from, to, punch)`, `pieces.targets`, `pieces.cleared()`, `pieces.leave()`, `pieces.destroyerHere`. Events as `capitalRules.js`: `launch {wave, from: [x,y,z]}`, `volley`, `hit {damage}`, `part {left}`, `open`, `dying`, `blast {at, size}`, `dead`, `leaving {reason}` and `gone`.
- Produces: `{ type: 'event', id: 'capital', sub }` emits (Task 5's `CAPITAL_SUBS`), said once a visit a sub (`capFight.said`).

- [ ] **Step 1: Port `capitalEvent`** from `universe/scene.js:3558-3596`:
  - `launch` → `hunters.pack(capFight.who, live, { from: { x, y, z }, size: wave > 1 ? 4 : 3, ace: rand < 0.35 })`; `hit` → `hurt(e.damage)` and shake; `dead` → `pay('killCapital')`, heat +4, flare.
  - Replace the `later.push` launch with `capFight = { said: new Set(), hurt: false, who }`.
  - Call `pieces.update(dt, t, camera, live)` and drain every frame.
  - `onHunters`'s `pieces.leave()` becomes `pieces.cleared()`.
- [ ] **Step 2: Your shots meet it.** `strike` tests `pieces.hit` after `war?.hit` and before `if (!atPilots)`. It marks `hitMark`, pops small and says `shielded` once, never through `scored`.
- [ ] **Step 3: The guns see it.** `capCands = pieces?.destroyerHere ? pieces.targets : NO_TARGETS` joins `cands` after `warCands`.
- [ ] **Step 4: It leaves with you.** `if (pieces?.destroyerHere) pieces.leave()` beside `hunters?.clear()` at the tunnel and in `enter`. Add `pieces` to `__galaxyDebug`.
- [ ] **Step 5: Run** `npx vitest run src/components/galaxy src/components/universe/capitalRules.test.js src/components/universe/setpieces.test.js` and `npx eslint src/components/galaxy/scene.js`. Expect PASS.

### Task 8: The glue, `garrison.js`, and the scene's wiring

**Files:**
- Create: `src/components/galaxy/garrison.js` (under 800 lines)
- Test: `src/components/galaxy/garrison.test.js`
- Modify: `src/components/galaxy/battles.js`: `export const TURBO` (each side's `LOOKS[side].turbo`)
- Modify: `src/components/galaxy/scene.js`:
  - create after `powers` (:390)
  - `enter` (:434)
  - `startDestroyed` (:1015)
  - respawn (:1085)
  - the tunnel (:1261)
  - `strike` (:945)
  - `onHunters` (:1517)
  - `happen('hunt')` home (:1540)
  - `adventure` after the war (:1594)
  - `busyHere` (:1605)
  - `__galaxy` and `__galaxyDebug`
  - `dispose` (:2527)

**Interfaces:**
- Consumes: Tasks 1, 2, 3, 5 and 6.
- Produces: `createGarrisonDefence({ hunters, wingmen, bolts, emit, hurt, pop, shake, escort: () => kinds[], small, rand })`, returning:
  - `update(dt, live, { world, effects, sys, battle, safe, solids }) → busy`
  - `onHunters(e)`: a hunter event; an untagged pack of the holder's side breaking or cleared within warn → `mind.call()`
  - `onHit(hit)`: a `hunters.hit`/`damage` answer; its `tag` being this system's → `mind.provoke(hit.down ? 'down' : 'hit')`
  - `hull(from, to) → { at } | null`: your shot against the posts' spheres → `provoke('hull')`
  - `homeFor(faction) → {x,y,z} | null`: the nearest post's hangar whose `SIDE_FACTION[side]` is the faction, or whose side's hunters it is
  - `reset(why)`, `enter(sys)`, `busy`, `info`, `dispose()`
- Behaviour:
  - The tag is `garrison:${sys.id}`.
  - `scramble` → `hunters.pack(SIDE_FACTION[post.side], live, { from, size, ace, tag, home: from })`.
  - `volley` → `bolts.fire(fromV, toV, { color: TURBO[side], speed: GARRISON.bolt.speed, width: 0.12, length: 3.2 })` and, when not friendly, `emit({ type: 'shot' })`.
  - `hit` → `hurt(damage)` and `shake`.
  - `cover` → `hunters.damage(id, damage)` and `pop` if down.
  - `escort` → `wingmen.join(kind, live, 2)`.
  - `recall` → `hunters.leave(SIDE_FACTION[side], tag)`.
  - `say` → `emit({ type: 'event', id: 'garrison', sub, side, sys: sys.id, secs })`.
  - `safe` (the scene's `safeUntil` or not yet `flown`) holds everything, as grace.
  - `you` carries a velocity from the last position over `dt`.
  - `planet` is the solid with `planet: true`; `seesThrough` tests only it.

- [ ] **Step 1: Write the failing tests** with `vi.fn()` hunters, wingmen and bolts, and a world whose `posts()` gives one held empire destroyer post:
  - `an enemy flying in is scrambled at and fired on`: `hunters.pack` called with `'navy'`, `tag 'garrison:mustafar'`, `from` the hangar; `bolts.fire` called; `hurt` called within 30 s at 30 units.
  - `the recall goes to the garrison’s pack alone`: `hunters.leave('navy', 'garrison:mustafar')`.
  - `shooting a garrison fighter or hull provokes it`: `onHit({ tag: 'garrison:mustafar', down: true })` and a `hull()` segment through a sphere → `info.alarm > 0`.
  - `nothing under safe`.
  - `say goes out as a garrison event` with `side` and `sys`.
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/garrison.test.js`. Expect FAIL.
- [ ] **Step 3: Implement `garrison.js` and `TURBO`.**
- [ ] **Step 4: Wire the scene** at the listed points:
  - `garrison = reduced || !hunters ? null : createGarrisonDefence(…)`
  - `busy = garrison?.update(dt, live, { world: state.world, effects: state.effects, sys: state.sys, battle: Boolean(war?.battle), safe: state.clock < state.safeUntil || !state.flown, solids: state.space?.solids ?? [] }) || busy`
  - in `strike`, after the war's and the capital's: `const gh = garrison?.hull(from, to); if (gh) { flash; return gh; }`
  - `garrison?.onHit(hh)` after a hunters hit
  - `garrison?.onHunters(e)` in `onHunters`
  - `happen('hunt')` passes `home: garrison?.homeFor(who)`
  - resets on `enter('enter')`, tunnel `('jump')`, `startDestroyed` `('down')` and respawn `('respawn')`
- [ ] **Step 5: Run** `npx vitest run src/components/galaxy src/components/universe` and `npx eslint src/components/galaxy`. Expect PASS.

### Task 9: Docs and the gates

**Files:**
- Create: `docs/superpowers/HANDOFF-garrison-defence.md` (done, how to check it, dev hooks, what's left: the spec's "Left for later")
- Modify: `docs/architecture.md` (the galaxy's paragraph: one sentence on the garrison)

- [ ] **Step 1: Write the handoff and the architecture sentence.**
- [ ] **Step 2: Run the gates**:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `node scripts/health.mjs --check --skip build`

  Expect all green.
- [ ] **Step 3: Smoke the galaxy**: `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /galaxy,/galaxy/mustafar`. Expect no page error and a canvas.
- [ ] **Step 4: Commit and push** to `claude/great-ptolemy-xpm9vr`.
