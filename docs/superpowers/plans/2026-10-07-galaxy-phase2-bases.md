# Galaxy Phase 2, bases: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the films' bases, more accurate and better textured. Each keeps
its solids and floors; only its look changes, plus Echo Base's corridors,
which you can now walk.

**Architecture:** built in code from the kit (`surface/kit.js`), with two
more photo-scanned CC0 roles (`tiles`, `deck`) from Poly Haven
(`scripts/galaxy-textures.mjs`, committed under `public/cc0/galaxy/`), and
insignia and scorch decals as flat geometry (`surface/decals.js`, pure and
tested: no canvas). Echo Base's corridors are a zone, like the cantina's
(`sites/index.js` builds it high over the world). Its layout is data in a
pure module, tested. New models come only from `scripts/gen3d`, through
GitHub issues labelled `gen3d`. Not Meshy, not a Sketchfab search.

**Tech stack:** three.js, Vitest, sharp (the texture script).

**Spec:** `docs/superpowers/specs/2026-10-06-galaxy-phases-design.md`
(Phase 2), and `docs/superpowers/HANDOFF-galaxy-phases.md`.

## Global constraints

- No runtime calls to asset services. Fetch textures ahead of time,
  commit them, and credit them in `public/cc0/README.md`.
- New 3D models only through a `gen3d` issue (autopilot spec, line 87).
- Every scene starts from `lib/device`'s tier, and loads only when near.
  Textures stay within the texture-quality spec's limits: 1k detail maps.
- Game logic and layouts go in tested pure modules. Write the tests first.
- British spelling, curly quotes in text the player sees, and comments
  that say why.
- Wookieepedia is the source for facts. Use its MediaWiki API with curl.

## Review focus

1. A zone's spawn and exit must lie inside one of its rooms, or the
   player falls out of the world. Test it in Task 3.
2. Every corridor room must touch the next, or the player is walled in.
   Test it in Task 3.
3. Insignia geometry must be flat, face +z, and fit the size asked for,
   or decals float or clip through walls. Test it in Task 2.
4. A new kit role without a scan must fall back to the painted stand-in,
   so the page doesn't break before `kit.ready`. The existing kit tests
   cover the fallback. Run them.
5. The low tier must not pay for a zone you haven't entered. Zones build
   on entry already. Check that the new zone uses the same path.

---

### Task 1: two more scanned roles, `tiles` and `deck`

**Files:**
- Modify: `scripts/galaxy-textures.mjs` (`ROLES`)
- Modify: `src/components/galaxy/surface/kit.js` (`LOOKS`, `mats`)
- Create: `public/cc0/galaxy/tiles/*` and `public/cc0/galaxy/deck/*`, plus
  the `index.json` entries (all written by the script)
- Modify: `public/cc0/README.md`

**Interfaces:**
- Produces: the kit materials `tiles` (Theed's plaza, marble) and `deck`
  (hangar floors and Tipoca's deck, a tread plate), usable as
  `part(g, { to: 'tiles' | 'deck' })`.

- [ ] Add `tiles: { id: 'marble_tiles', keep: 0.15, mean: 0.84 }` and
  `deck: { id: 'metal_plate', keep: 0.05, mean: 0.8 }` to `ROLES`.
- [ ] Run `NODE_USE_ENV_PROXY=1 node scripts/galaxy-textures.mjs tiles deck`.
  It should write the maps and two `index.json` entries.
- [ ] In `LOOKS`, add `tiles` (roughness 0.6, metalness 0, normal 0.8) and
  `deck` (roughness 0.8, metalness 0.6, scanMetal, normal 1). Add the
  `mats` entries in the style of their neighbours.
- [ ] Run `npx vitest run src/components/galaxy`. Expect it to pass.
- [ ] Commit.

### Task 2: `surface/decals.js`, insignia and scorches as geometry

**Files:**
- Create: `src/components/galaxy/surface/decals.js` and `decals.test.js`

**Interfaces:**
- Produces:
  - `insignia(kind, size)`, where `kind` is `'rebel' | 'imperial' |
    'republic'`. Returns a `THREE.BufferGeometry`: flat at z = 0, facing
    +z, with its widest side equal to `size`.
  - `scorch(r, seed)` returns a ragged flat disc, facing +z, of radius at
    most `r`.
  - Both are meant for `part(insignia(…), { at, rot, color, to: 'paint' })`,
    0.03 m proud of a wall.

- [ ] Tests:
  - every kind's bounding box is ≤ size wide and high, with depth < 1e-6;
  - the normals face +z;
  - the Rebel starbird is taller than it is wide;
  - the Imperial crest is round (its width matches its height to within 2 %);
  - an unknown kind throws;
  - `scorch` stays within r, and two seeds give different outlines.
- [ ] Build it with `THREE.ShapeGeometry`:
  - the starbird: a teardrop body, two swept wings and a ring round them;
  - the Imperial crest: a ring with six spokes;
  - the Republic crest: a ring with eight spokes.
- [ ] Run the tests. Expect them to pass. Commit.

### Task 3: Echo Base's corridors, a zone

**Files:**
- Create: `src/components/galaxy/surface/props/echo.js` (`echoinside`)
- Create: `src/components/galaxy/surface/sites/echoLayout.js` and
  `echoLayout.test.js`
- Modify: `props/index.js` (register it), `sites/ice.js` (the zone, its
  life), `props/ice.js` (`echobase`: the back-wall door marked as a door)

**Interfaces:**
- Produces: `ECHO` = `{ rooms: [[x, z, hw, hd, y0, y1, label]…], spawn:
  [x, z], yaw, exit: { at, r }, bounds: [hw, hd, h], arches: [[x, z, axis]…],
  lamps }`. This is what the zone's `inside` reads, and what the builder
  draws.

- [ ] Tests:
  - the spawn and the exit lie inside a room;
  - each room overlaps or abuts at least one other (a flood fill from the
    spawn reaches all of them);
  - the arches stand only in corridor rooms, about every 4 m;
  - `bounds` contains every room.
- [ ] Lay it out from the Wookieepedia cutaway:
  - from the hangar door, an entry corridor;
  - a T-junction, then the command centre (with a holo-table and the big
    tactical screen);
  - the medical centre (a bacta tank, 2-1B);
  - a cavern widened from the wampas' den.
- [ ] Build `echoinside`:
  - the ice walls, rough and inward (reuse `props/ice.js`'s `roughBox`,
    `iceMat` and `iceShade`);
  - steel support arches every 4 m, as Wookieepedia says ("artificial
    corridors linked together with structural supports");
  - ducting, lamps and a grate floor (`deck`);
  - Rebel insignia (Task 2) over the command centre's door.
- [ ] Add the zone in `sites/ice.js`. Its door is the hangar's back-left
  door. Its life: Rieekan and techs in the command centre, 2-1B by the
  tank, a Rebel trooper on guard.
- [ ] Check: lint, tests, then a shot from inside the zone
  (`__surfaceDo('teleport')` to the door, then `enter`). Commit.

### Task 4: Theed, its hangar and its plaza

**Files:** `props/core.js` (`theedhangar`), `sites/core.js` (Naboo's things).

- [ ] Build the hangar: a long, low sandstone hall with a row of tall
  arched doors on its front, a green copper roof, and a polished floor
  (`tiles`). Inside it, N-1 fighters on their racks, in yellow and chrome.
  The Royal Starship stays outside.
- [ ] Lay the plaza with `tiles`.
- [ ] Check: a shot from the plaza. Commit.

### Task 5: Kamino, Tipoca's deck and its discharge towers

**Files:** `props/core.js` (`kpad`'s top in `deck`, plus a new
`tipocarod`), `sites/core.js`.

- [ ] Put `deck` on the pad tops.
- [ ] Add discharge towers: thin white masts with a ball at the top that
  takes the lightning. Put them on the domes' rims and the pad's edge.
- [ ] Check: a shot. Commit.

### Task 6: Yavin's hangar floor; Scarif's Pad 9

**Files:** `props/forest.js` (the temple's hangar floor), `props/edge.js`
(`pad`, which gets a painted number), `sites/edge.js`.

- [ ] Give the Great Temple's hangar a stone floor with scorches (Task 2).
- [ ] Give Scarif's landing pad its painted “9”, built from boxes. Add
  Imperial crests on the bunkers.
- [ ] Check: shots. Commit.

### Task 7: set pieces for gen3d

- [ ] For each set piece that code can't build accurately, open an issue
  labelled `gen3d`. The title is the name; the body says what it is, gives
  a prompt and links a reference picture. Start with the v-150 Planet
  Defender and the Scarif Citadel's vault door.

Each task is its own PR to main, merged once CI is green. The handoff is
updated in each.
