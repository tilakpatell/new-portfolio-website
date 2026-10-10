# One Game Across the Universe Map and the Galaxy: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The crew's guns, how they fire, the hangar and the shared keys are the same on the universe map and in the galaxy.

**Architecture:** A shared armoury in `src/lib/arms/` (the galaxy's gun numbers moved there, plus a pure "rack" of up to three guns per person kept under one storage key) that both foot scenes read; a `useOutfit` hook so both map pages own the hangar the same way; the hangar gains an Armoury tab.

**Tech Stack:** React 19, three.js, Vite, Vitest (Node), Playwright-core for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-06-seamless-universe-galaxy-design.md`

## Global Constraints

- Racks: at most 3 guns and 2 mods a person; stored under `tp-arms` as `{ [who]: { guns: [kind…], mods: [id…] } }`.
- Rick's default rack: `['portal', 'freeze', 'shrink']`; anyone else's: their own gun (`PARTY` or the hero's).
- The universe map's foot combat fires by `weaponOf(kind)` / `withMods(kind, mods)`: `every`, `damage`, `spread`, `burst`, `pellets`, `heat`.
- B = next gun, H = hangar, on both sides; Tab plays the other one on the universe map too (X stays there).
- Moved code keeps a re-export at its old path (`galaxy/surface/weaponRules.js`).
- Files under 1500 lines (`scripts/health.mjs` big-files budget 30); no new boundary breaks beyond `lib/arms` being imported by both worlds.

## Review Focus

- A saved rack with unknown gun ids, duplicates, more than three guns or junk instead of an object: cleaned (unknowns dropped, trimmed to three), never a crash, never an empty hand for someone who has a gun. → Task 2 test.
- B pressed by someone with one gun or none (Artoo, a saber hero): nothing happens, no error, no event. → Task 2 test (`nextGun` on a one-gun rack returns the same rack) and Task 4/6 guards.
- Firing while the gun's overheated on the universe map: no shot; the HUD shows it locked; clear again after `VENT.lock` (1.6 s). → Task 4 uses `heatShot`/`heatStep` (tested in weaponRules.test.js); Task 7 browser check fires until locked.
- B mid-burst: the burst stops; the gun in hand and the one out of your own eyes both become the new one. → Task 4 step clears `S.burst`; Task 7 browser check.
- A rack changed on one side shows on the other without a reload of anything but the page (the Armoury tab, the hero panel). → Task 10 `ARMS_EVENT` listener; Task 11 browser check.

---

## Part 1 — the armoury (PR 1, branch `claude/seamless-loadout`)

### Task 1: Move the gun numbers to `lib/arms/weapons.js`

**Files:**
- Create: `src/lib/arms/weapons.js` (the contents of `src/components/galaxy/surface/weaponRules.js`, its header's first line reworded to say both worlds use it)
- Modify: `src/components/galaxy/surface/weaponRules.js` (becomes a re-export)
- Test: `src/components/galaxy/surface/weaponRules.test.js` (unchanged, must pass through the re-export)

**Interfaces:**
- Produces: `src/lib/arms/weapons.js` exporting `MAX_MODS, VENT, COOL_WAIT, WEAPONS, WEAPON_IDS, PICKABLE, SHOW_KILLS, MODS, MOD_IDS, weaponOf, withMods, heatShot, heatStep, ventSpot, vent, spreadAt` (identical behaviour).

- [ ] **Step 1:** `git mv src/components/galaxy/surface/weaponRules.js src/lib/arms/weapons.js`; change its first comment line to `// The guns' numbers, pure (tested in Node), for both worlds' foot combat (the universe map's footScene.js and the galaxy's surface/scene.js) and the hero panel: what each kind does per shot and how fast, the`.
- [ ] **Step 2:** Create `src/components/galaxy/surface/weaponRules.js`:

```js
// (moved to lib/arms/weapons.js: both worlds fire by these numbers)
export * from '../../../lib/arms/weapons';
```

- [ ] **Step 3:** Run `npx vitest run src/components/galaxy/surface/weaponRules.test.js` — expected PASS (12 tests).
- [ ] **Step 4:** Commit: `git add -A src/lib/arms src/components/galaxy/surface/weaponRules.js && git commit -m "Move the guns' numbers to lib/arms/weapons.js (both worlds fire by them)"`.

### Task 2: The rack (`lib/arms/rack.js`), and its store

**Files:**
- Create: `src/lib/arms/rack.js`, `src/lib/arms/rack.test.js`, `src/lib/arms/store.js`

**Interfaces:**
- Consumes: `WEAPONS`, `MODS`, `MAX_MODS` from `./weapons`.
- Produces:
  - `ARMS_KEY = 'tp-arms'`, `MAX_GUNS = 3`
  - `readRacks(raw) → { [who]: { guns: string[], mods: string[] } }`
  - `rackOf(racks, who, own) → { guns, mods }` (the saved rack, else Rick's default, else `[own]` or `[]`)
  - `nextGun(rack) → rack` (first gun to the back; same rack when it has fewer than two)
  - `withFirst(rack, kind) → rack` (kind to the front, deduped, trimmed to three)
  - `withRack(racks, who, rack) → racks` (cleaned)
  - store: `ARMS_EVENT = 'tp-arms'`, `loadRacks() → racks`, `saveRacks(racks)` (writes and fires `ARMS_EVENT` on `window`)

- [ ] **Step 1: Write the failing test** `src/lib/arms/rack.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { MAX_GUNS, nextGun, rackOf, readRacks, withFirst, withRack } from './rack';

describe('a rack', () => {
  it('is what was saved, cleaned: known guns only, no repeats, three at most, two mods', () => {
    const r = readRacks({ han: { guns: ['blaster', 'nope', 'blaster', 'rifle', 'a280', 'ee3'], mods: ['scope', 'x', 'choke', 'trigger'] }, bad: 'junk', empty: { guns: [] } });
    expect(r.han).toEqual({ guns: ['blaster', 'rifle', 'a280'], mods: ['scope', 'choke'] });
    expect(r.bad).toBeUndefined();
    expect(r.empty).toBeUndefined();
    expect(readRacks(null)).toEqual({});
    expect(readRacks('junk')).toEqual({});
    expect(r.han.guns.length).toBeLessThanOrEqual(MAX_GUNS);
  });
  it('falls back to Rick’s three gadgets, or the person’s own gun, or nothing', () => {
    expect(rackOf({}, 'rick', 'portal').guns).toEqual(['portal', 'freeze', 'shrink']);
    expect(rackOf({}, 'han', 'blaster')).toEqual({ guns: ['blaster'], mods: [] });
    expect(rackOf({}, 'artoo', null)).toEqual({ guns: [], mods: [] });
    expect(rackOf(readRacks({ han: { guns: ['rifle'] } }), 'han', 'blaster').guns).toEqual(['rifle']);
  });
  it('goes round with B, and a pick goes to the front', () => {
    const r = { guns: ['portal', 'freeze', 'shrink'], mods: [] };
    expect(nextGun(r).guns).toEqual(['freeze', 'shrink', 'portal']);
    expect(nextGun(nextGun(nextGun(r))).guns).toEqual(r.guns);
    const one = { guns: ['blaster'], mods: [] };
    expect(nextGun(one)).toBe(one);
    expect(withFirst(r, 'shrink').guns).toEqual(['shrink', 'portal', 'freeze']);
    expect(withFirst({ guns: ['rifle', 'a280', 'ee3'], mods: [] }, 'blaster').guns).toEqual(['blaster', 'rifle', 'a280']);
    expect(withRack({}, 'han', { guns: ['nope'], mods: [] })).toEqual({});
    expect(withRack({}, 'han', { guns: ['dlt19'], mods: ['stock'] })).toEqual({ han: { guns: ['dlt19'], mods: ['stock'] } });
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/arms/rack.test.js` — expected FAIL (cannot resolve `./rack`).
- [ ] **Step 3: Implement** `src/lib/arms/rack.js`:

```js
// The guns each person carries (a rack), the same on the universe map and
// in the galaxy: up to MAX_GUNS kinds, the first the one in hand (B goes
// round them), and up to MAX_MODS mods on them. Kept for everyone under one
// key, ARMS_KEY: { [who]: { guns, mods } }; unset, a person carries their own
// gun, and Rick his three gadgets. Pure; store.js keeps it.
//
//   readRacks(raw)               what was kept, cleaned (unknown kinds and mods dropped, trimmed)
//   rackOf(racks, who, own)      someone's rack: kept, or the default
//   nextGun(rack)                B: the first gun to the back
//   withFirst(rack, kind)        a pick: that gun in hand, the rest after it
//   withRack(racks, who, rack)   racks with someone's put in (cleaned)

import { MAX_MODS, MODS, WEAPONS } from './weapons';

export const ARMS_KEY = 'tp-arms';
export const MAX_GUNS = 3;
const DEFAULTS = { rick: ['portal', 'freeze', 'shrink'] };

const clean = (r) => {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const guns = [...new Set(Array.isArray(r.guns) ? r.guns : [])].filter((k) => typeof k === 'string' && WEAPONS[k]).slice(0, MAX_GUNS);
  if (!guns.length) return null;
  const mods = [...new Set(Array.isArray(r.mods) ? r.mods : [])].filter((m) => typeof m === 'string' && MODS[m]).slice(0, MAX_MODS);
  return { guns, mods };
};

export function readRacks(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [who, r] of Object.entries(raw)) {
    const c = clean(r);
    if (c) out[who] = c;
  }
  return out;
}

export function rackOf(racks, who, own) {
  if (racks?.[who]) return racks[who];
  const guns = DEFAULTS[who] ?? (own && WEAPONS[own] ? [own] : []);
  return { guns: [...guns], mods: [] };
}

export const nextGun = (rack) => (rack.guns.length < 2 ? rack : { ...rack, guns: [...rack.guns.slice(1), rack.guns[0]] });

export const withFirst = (rack, kind) => ({ ...rack, guns: [kind, ...rack.guns.filter((k) => k !== kind)].slice(0, MAX_GUNS) });

export function withRack(racks, who, rack) {
  const c = clean(rack);
  const out = { ...racks };
  if (c) out[who] = c;
  else delete out[who];
  return out;
}
```

and `src/lib/arms/store.js`:

```js
// The racks (rack.js), kept between visits and shared live: whatever
// changes them (B, the hangar's Armoury, the galaxy's hero panel) saves
// them here, and the foot scenes hear ARMS_EVENT and pick them up.

import { local } from '../hooks';
import { ARMS_KEY, readRacks } from './rack';

export const ARMS_EVENT = 'tp-arms';
export const loadRacks = () => readRacks(local.get(ARMS_KEY));
export function saveRacks(racks) {
  local.set(ARMS_KEY, racks);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ARMS_EVENT));
}
```

- [ ] **Step 4:** Run `npx vitest run src/lib/arms/rack.test.js` — expected PASS (3 tests).
- [ ] **Step 5:** Commit: `git add src/lib/arms && git commit -m "The rack: the guns each person carries, the same everywhere (lib/arms/rack.js)"`.

### Task 3: The universe map's foot combat by the numbers, from the racks

**Files:**
- Modify: `src/components/universe/footScene.js` (imports; `GADGETS`/`GADGET_NAMES` removed; party guns from racks; `fire()`; mate fire; tick heat and burst; `gadget()` → `nextGun()`; `info().gun`)
- Modify: `src/components/universe/scene.js:4497-4502` (B calls `foot.nextGun()`)

**Interfaces:**
- Consumes: `withMods, heatShot, heatStep, spreadAt, SHOW_KILLS, WEAPONS` from `../../lib/arms/weapons`; `rackOf, nextGun as cycleRack` from `../../lib/arms/rack`; `loadRacks, saveRacks, ARMS_EVENT` from `../../lib/arms/store`.
- Produces: `foot.nextGun(kind = null) → kind | false`; `foot.info().gun → { kind, name, heat (0…1), locked, fresh } | null`; `foot.gadget` kept as an alias of `nextGun` (scripts/foot-portal-check.mjs calls it).

- [ ] **Step 1:** Imports and helpers. Replace the `GADGETS`/`GADGET_NAMES` block after `TROOP_BOLT` with nothing, and add near the other imports:

```js
import { SHOW_KILLS, WEAPONS, heatShot, heatStep, spreadAt, withMods } from '../../lib/arms/weapons';
import { nextGun as cycleRack, rackOf, withFirst } from '../../lib/arms/rack';
import { ARMS_EVENT, loadRacks, saveRacks } from '../../lib/arms/store';
```

Next to `meP`/`gunOf`:

```js
  // the guns each of you carries (lib/arms: the same in the galaxy), and the numbers the one in hand fires by
  const rackFor = (p) => rackOf(loadRacks(), p.spec.id, p.spec.gun);
  const weaponFor = (p) => withMods(gunOf(p) ?? 'blaster', rackFor(p).mods);
```

Change `t.how = GADGETS.includes(o.gun) ? o.gun : null;` to `t.how = SHOW_KILLS.includes(o.gun) ? o.gun : null;` and `damageOf` to:

```js
  const damageOf = (p) => weaponFor(p).damage;
```

- [ ] **Step 2:** Party guns from the racks. In the party loader (`const gp = spec.gun ? createGunplay(f, f.gun ?? spec.gun, …)`), use the rack's first gun:

```js
        const first = rackOf(loadRacks(), spec.id, spec.gun).guns[0] ?? null;
        const gp = first ? createGunplay(f, f.gun ?? first, { unit: METRE, who: f.built ? 'built' : spec.id }) : null;
```

In `S`'s initial state add `heat: { value: 0, locked: false, lockedAt: null, shotAt: null }, burst: null, gunAt: null,` and remove `gadgetAt` uses (renamed `gunAt`).

- [ ] **Step 3:** `fire()` by the numbers. Replace its cooldown and shot lines:

```js
      if (S.phase !== 'walk' || S.cool > 0) return false;
      const me = meP();
      if (!me?.gp) return false;
      const w = weaponFor(me);
      if (S.heat.locked) return false;
      S.cool = w.every;
      S.heat = heatShot(S.heat, w, S.clock);
```

and the shot:

```js
      const n = w.pellets ?? 1;
      for (let i = 0; i < n; i++) shoot(me, target, 'me', Math.max(1, Math.round(w.damage / (n > 1 ? 2 : 1))), spreadAt(w, Boolean(S.cam.first)) * 2, mark);
      S.burst = w.burst > 1 ? { left: w.burst - 1, next: S.clock + 0.075, target: target?.id ?? null, mark } : null;
      S.aim = 1;
      if (!reduced) S.cam.kick.v += (GUNS[gunOf(me)]?.kick.up ?? 1.5) * (w.kick ?? 1);
      return gunOf(me);
```

- [ ] **Step 4:** The tick: heat cools and a burst's rest goes out. After `S.cool -= dt;`:

```js
    if (me?.gp) S.heat = heatStep(S.heat, dt, weaponFor(me), S.clock);
    if (S.burst && S.clock >= S.burst.next && me?.gp) {
      const b = S.burst;
      const target = S.troops.find((o) => o.id === b.target && o.alive) ?? null;
      shoot(me, target, 'me', weaponFor(me).damage, spreadAt(weaponFor(me), Boolean(S.cam.first)) * 2, target ? null : b.mark);
      emit({ type: 'fire', gun: gunOf(me) });
      b.left -= 1;
      b.next += 0.075;
      if (b.left <= 0) S.burst = null;
    }
```

- [ ] **Step 5:** The mate by their own numbers: in the mate's shot replace `shoot(mate, near, 'mate', damageOf(mate), 0.06);` with `shoot(mate, near, 'mate', damageOf(mate), Math.max(0.06, spreadAt(weaponFor(mate), false) * 2));`.
- [ ] **Step 6:** B for anyone with more than one gun. Replace `gadget(kind = null) { … }` with:

```js
    // B: the next gun in the rack of whoever you're playing (or the one
    // named); the rack's kept, so it's the gun in hand in the galaxy too
    nextGun(kind = null) {
      const me = meP();
      if (S.phase !== 'walk' || !me?.gp) return false;
      const rack = rackFor(me);
      const next = kind && rack.guns.includes(kind) ? withFirst(rack, kind) : cycleRack(rack);
      if (next === rack || next.guns[0] === gunOf(me)) return false;
      saveRacks({ ...loadRacks(), [me.spec.id]: next });
      me.gp.dispose();
      me.gp = createGunplay(me.fig, next.guns[0], { unit: METRE, who: me.fig.built ? 'built' : me.spec.id });
      S.burst = null;
      S.gunAt = S.clock;
      return next.guns[0];
    },
    gadget(kind = null) {
      return this.nextGun(kind);
    },
```

- [ ] **Step 7:** `info()`: replace the `gadget:` line with:

```js
        // the gun in hand, for the HUD's gun line: its name, its heat, and fresh for a moment after B
        gun: me?.gp ? { kind: gunOf(me), name: WEAPONS[gunOf(me)]?.name ?? '', heat: S.heat.value, locked: S.heat.locked, fresh: S.gunAt != null && S.clock - S.gunAt < 1.8 } : null,
```

- [ ] **Step 8:** Racks changed elsewhere (the hangar, the hero panel): in the scene's setup, after the party loads, listen and rebuild whoever's first gun changed; remove it in `dispose()`:

```js
  const onArms = () => {
    for (const p of party ?? []) {
      if (!p.gp) continue;
      const first = rackFor(p).guns[0];
      if (!first || first === gunOf(p)) continue;
      p.gp.dispose();
      p.gp = createGunplay(p.fig, first, { unit: METRE, who: p.fig.built ? 'built' : p.spec.id });
    }
  };
  if (typeof window !== 'undefined') window.addEventListener(ARMS_EVENT, onArms);
```

and in `dispose()`: `if (typeof window !== 'undefined') window.removeEventListener(ARMS_EVENT, onArms);`.

- [ ] **Step 9:** `scene.js`: B → `const gun = foot.nextGun(); if (gun) emit({ type: 'foot', id: 'gadget', gun });` and the prompt reads `info.gun?.fresh` / `info.gun.name` in place of `info.gadget`.
- [ ] **Step 10:** Run `npx eslint src/components/universe src/lib/arms` (expected clean) and `npx vitest run src/components/universe/foot.test.js src/components/universe/crews.test.js src/lib/arms` (expected PASS).
- [ ] **Step 11:** Commit: `git commit -am "The universe map's foot combat fires by the galaxy's numbers, from each person's rack; B goes round anyone's guns"`.

### Task 4: The HUD's gun line on the universe map

**Files:**
- Modify: `src/components/universe/UniverseMap.jsx` (a `gun` ref and its markup beside the shield's)
- Modify: `src/components/universe/scene.js` (`placeGun()` next to `placeShield()`, called where `placeShield()` is)
- Modify: `src/components/universe/universe.css` (`.universe-gun`)

**Interfaces:**
- Consumes: `foot.info().gun` from Task 3; `props.gun` (a ref) passed like `props.shield`.

- [ ] **Step 1:** `UniverseMap.jsx`: `const gun = useRef(null);`, pass `gun` beside `shield` in the scene's props, and after the shield's `div`:

```jsx
              <div ref={gun} className="universe-gun" aria-hidden="true">
                <span className="universe-gun-name" />
                <span className="universe-gun-heat">
                  <span />
                </span>
              </div>
```

- [ ] **Step 2:** `scene.js`, beside `placeShield`:

```js
  // the gun line on foot: the gun in hand, and its heat (red and blinking, locked)
  let gunWas = '';
  const placeGun = () => {
    const el = props.gun?.current;
    if (!el) return;
    const g = onFoot() && foot.phase === 'walk' && !props.frozen ? foot.info()?.gun : null;
    el.toggleAttribute('data-on', Boolean(g));
    if (!g) return;
    if (g.name !== gunWas) {
      gunWas = g.name;
      el.querySelector('.universe-gun-name').textContent = g.name;
    }
    el.style.setProperty('--heat', g.heat.toFixed(3));
    el.toggleAttribute('data-locked', g.locked);
  };
```

and call `placeGun();` right after each `placeShield();` call.

- [ ] **Step 3:** CSS (after the `.universe-shield` rules):

```css
.universe-gun { position: absolute; left: 16px; bottom: 132px; width: 120px; opacity: 0; transition: opacity 0.25s; pointer-events: none; font: 600 10px/1.2 var(--font-mono, ui-monospace, monospace); letter-spacing: 0.12em; text-transform: uppercase; color: rgb(255 255 255 / 0.85); }
.universe-gun[data-on] { opacity: 1; }
.universe-gun-heat { display: block; height: 4px; margin-top: 4px; border-radius: 2px; background: rgb(255 255 255 / 0.15); overflow: hidden; }
.universe-gun-heat > span { display: block; height: 100%; width: calc(var(--heat, 0) * 100%); background: linear-gradient(90deg, #ffd36b, #ff7a3d); }
.universe-gun[data-locked] .universe-gun-heat > span { width: 100%; background: #ff4a3d; animation: universe-shield-blink 0.6s steps(2) infinite; }
@media (max-width: 640px) { .universe-gun { left: 10px; bottom: calc(var(--sheet-h, 0px) + 132px); width: 76px; } }
```

- [ ] **Step 4:** `npx eslint src/components/universe` — expected clean. Commit: `git commit -am "The universe map's HUD on foot: the gun in hand and its heat"`.

### Task 5: The galaxy's worlds by the racks, and B there

**Files:**
- Modify: `src/components/galaxy/heroes.js` (`heroSpec(hero, racks = null)`: a gun hero's gun and mods from their rack when there is one)
- Modify: `src/components/galaxy/heroes.test.js` (one test)
- Modify: `src/components/galaxy/surface/scene.js` (crew guns from racks; `p.gun` the current gun; B; `ARMS_EVENT`)
- Modify: `src/pages/GalaxySurface.jsx` (picking a hero's gun and mods writes their rack)

**Interfaces:**
- Consumes: `rackOf, withFirst, withRack, nextGun as cycleRack` (`lib/arms/rack`), `loadRacks, saveRacks, ARMS_EVENT` (`lib/arms/store`).
- Produces: `heroSpec(hero, racks)` — `gun`/`mods` from `racks[hero.id]` for a gun hero.

- [ ] **Step 1: Failing test** in `heroes.test.js`:

```js
  it('a gun hero carries the first gun of their rack, with its mods; a Jedi keeps the saber', async () => {
    const { readRacks } = await import('../../lib/arms/rack');
    const racks = readRacks({ han: { guns: ['dlt19', 'blaster'], mods: ['stock'] }, luke: { guns: ['rifle'] } });
    expect(heroSpec({ id: 'han', gun: 'blaster' }, racks)).toMatchObject({ gun: 'dlt19', mods: ['stock'] });
    expect(heroSpec({ id: 'luke' }, racks).gun).toBe('saber');
    expect(heroSpec({ id: 'han', gun: 'rifle' }).gun).toBe('rifle');
  });
```

- [ ] **Step 2:** Run `npx vitest run src/components/galaxy/heroes.test.js` — expected FAIL (dlt19 ≠ blaster).
- [ ] **Step 3:** `heroSpec(hero, racks = null)`: after `saber` is worked out,

```js
  const kept = !saber ? racks?.[h.id] : null; // (the hero's rack, lib/arms: the gun they last had in hand anywhere)
  const gun = saber ? 'saber' : kept?.guns[0] ?? (WEAPONS[hero.gun] && hero.gun !== 'saber' ? hero.gun : h.weapon);
```

and `mods: saber ? [] : (kept?.mods ?? hero.mods ?? []).filter((m) => MODS[m]).slice(0, MAX_MODS)`. Update the header's `heroSpec` line to name `racks`.
- [ ] **Step 4:** Run the test — expected PASS.
- [ ] **Step 5:** Surface `scene.js`: `const hero = ctx.hero ? heroSpec(ctx.hero, loadRacks()) : null;`. Each person's current gun: where `p.gp` is made (line ~494), use

```js
        const first = p.spec.saber ? null : rackOf(loadRacks(), p.spec.id, p.spec.gun).guns[0] ?? p.spec.gun;
        p.gun = first;
        if (first && !own) {
          …
          p.gp = createGunplay(fig, fig.gun ?? first, { unit: 1, who: fig.built ? 'built' : p.spec.id });
          …
          p.weapon = withMods(fig.gun ?? first, p.spec.hero ? p.spec.mods ?? [] : rackOf(loadRacks(), p.spec.id, first).mods);
        }
```

Replace `gunSound(p.spec.gun)` with `gunSound(p.gun ?? p.spec.gun)` and in the network walker `arms: p.spec.gun ? { gun: p.gun ?? p.spec.gun, …` (keep the rest).
- [ ] **Step 6:** B on the surface. Add `b: 'next'` to `KEYS`; in `onKey`'s `down && !e.repeat` block: `if (k === 'next') nextGun();` and the function beside `swap()`:

```js
  // B: the next gun in the rack of whoever you're playing (lib/arms: the
  // same rack as on the universe map), kept for next time
  function nextGun() {
    const p = me();
    if (state.phase !== 'walk' || !p.gun || p.saber || !p.fig) return;
    const rack = rackOf(loadRacks(), p.spec.id, p.gun);
    const next = cycleRack(rack);
    if (next === rack) return;
    saveRacks(withRack(loadRacks(), p.spec.id, next));
    armWith(p, next.guns[0], next.mods);
    sounds.combat?.('swap');
    emit({ type: 'gun', name: weaponOf(next.guns[0]).name });
  }
  // a person's gun changed: the one in the hand, and the numbers it fires by
  function armWith(p, kind, mods) {
    p.gun = kind;
    p.weapon = withMods(kind, mods);
    if (!p.gp) return;
    p.gp.dispose();
    p.gp = createGunplay(p.fig, kind, { unit: 1, who: p.fig.built ? 'built' : p.spec.id });
    state.burst = null;
  }
  const onArms = () => {
    for (const p of people) {
      if (!p.gun || p.saber) continue;
      const r = rackOf(loadRacks(), p.spec.id, p.gun);
      if (r.guns[0] !== p.gun) armWith(p, r.guns[0], r.mods);
    }
  };
  window.addEventListener(ARMS_EVENT, onArms);
```

(remove the listener in `dispose()`).
- [ ] **Step 7:** `GalaxySurface.jsx`: where the hero panel's pick is saved (`local.set(HERO_KEY, writeHero(next))`), also keep the hero's rack:

```js
    if (next.gun && next.gun !== 'saber') saveRacks(withRack(loadRacks(), next.id, { ...withFirst(rackOf(loadRacks(), next.id, next.gun), next.gun), mods: next.mods ?? [] }));
```

- [ ] **Step 8:** `npx eslint src/components/galaxy src/pages` (clean); `npx vitest run src/components/galaxy` (PASS). Commit: `git commit -am "The galaxy's worlds carry the same racks: B goes round them there too, and the hero panel keeps them"`.

### Task 6: Check, PR, merge (Part 1)

- [ ] **Step 1:** `node scripts/health.mjs --check --skip build` — within budget; `git checkout src/data/health/latest.json`.
- [ ] **Step 2:** Browser (dev server `portfolio`, Metal Chromium as in memory "galaxy-shoot-check"): universe map on foot as Rick — B goes portal → freeze → shrink, the HUD's gun line names each; hold F until the heat bar locks and no bolts leave; it clears. Then the galaxy (Sorgan) with the cruiser crew: Rick's gun in hand is the one B left; B there goes round the same three; back on the universe map the gun in hand is the galaxy's last pick. No console errors.
- [ ] **Step 3:** Push, PR (body: what changed, checks, `🤖 Generated with [Claude Code](https://claude.com/claude-code)`), wait for CI via the PR bar, merge with a merge commit.

## Part 2 — the hangar on both maps (PR 2)

### Task 7: `useOutfit`, from `Universe.jsx`

**Files:**
- Create: `src/components/universe/useOutfit.js`
- Modify: `src/pages/Universe.jsx:70-121` (its loadouts/hulls/garage state, `setBuild`, `loadout`, `dropped`, `fit` replaced by the hook)

**Interfaces:**
- Produces: `useOutfit(ship) → { loadout, build, lastBuild, dropped, fit(slot, id) → equip result, setBuild(b) }`.

- [ ] **Step 1:** Create the hook with the exact logic now in `Universe.jsx:73-121` (`readLoadouts`, `readHulls`, `GARAGE_KEY`, `loadoutOf`, `droppedParts`, `equip`, `fitInto`, `local`), returning `{ loadout, build, lastBuild: (ship && garage[ship]) || null, dropped, fit, setBuild }`, with `useAchievements().unlocked` inside.
- [ ] **Step 2:** `Universe.jsx`: `const { loadout, build, lastBuild, dropped, fit, setBuild } = useOutfit(ship);` and pass `lastBuild` to `UniverseMap`. Keep its `useEffect`s on `setLoadout`/`tellBuild`.
- [ ] **Step 3:** `npx eslint src/pages src/components/universe`; browser: the universe hangar still fits a part and rolls a build. Commit.

### Task 8: The hangar on the galaxy map

**Files:**
- Modify: `src/pages/Galaxy.jsx` (the hook in place of the two `useMemo`s; a `Hangar` with the same props as the universe's)

- [ ] **Step 1:** `const { loadout, build, lastBuild, dropped, fit, setBuild } = useOutfit(ship);` in place of the `build`/`loadout` memos; `const [hangar, setHangar] = useState(false);`; render `<Hangar ship={ship} shipName={crew?.ship ?? ''} loadout={loadout} build={build} lastBuild={lastBuild} dropped={dropped} onBuild={ship ? setBuild : null} onFit={ship ? fit : null} open={hangar} onOpen={setHangar} />` where the galaxy's corner buttons are (it brings its own button and H key). The galaxy scene's `update()` already takes a changed `loadout` and `build`.
- [ ] **Step 2:** Browser: on the galaxy map, H opens the hangar; fitting boosters changes the ship in flight; rolling a build swaps the hull; back on the universe map they're the same. Commit.

### Task 9: The Armoury tab

**Files:**
- Create: `src/components/universe/Armoury.jsx`
- Modify: `src/components/universe/Hangar.jsx` (`TABS` gains `'arms'`, label `'Armoury'`; the tab's body renders `<Armoury ship={ship} />`)
- Modify: `src/components/universe/universe.css` (`.universe-armoury…`)

**Interfaces:**
- Consumes: `PARTY` (`./footScene`), `WEAPONS, PICKABLE, MODS, MOD_IDS, MAX_MODS` (`lib/arms/weapons`), `rackOf, withRack, MAX_GUNS` (`lib/arms/rack`), `loadRacks, saveRacks, ARMS_EVENT` (`lib/arms/store`).

- [ ] **Step 1:** `Armoury.jsx`: for each of `PARTY[ship]` with a gun, a row: their name, their rack as up to three numbered chips (the first "in hand"), the armoury's guns (`[...new Set([...PICKABLE, 'laser', 'pistol', own])]`) as toggle buttons (on: in the rack; pressing adds to the end while under `MAX_GUNS`, removes otherwise, never the last one), and `MOD_IDS` as toggles (up to `MAX_MODS`). Every change: `saveRacks(withRack(loadRacks(), who, next))`; state re-read on `ARMS_EVENT`.

```jsx
import { useEffect, useState } from 'react';
import { PARTY } from './footScene';
import { MAX_MODS, MODS, MOD_IDS, PICKABLE, WEAPONS } from '../../lib/arms/weapons';
import { MAX_GUNS, rackOf, withRack } from '../../lib/arms/rack';
import { ARMS_EVENT, loadRacks, saveRacks } from '../../lib/arms/store';

// The hangar's Armoury (the same on the galaxy map): the guns each of the
// crew carries, up to three, the first the one in hand (B goes round them
// on foot, in either place), and up to two mods on them
export default function Armoury({ ship }) {
  const [racks, setRacks] = useState(loadRacks);
  useEffect(() => {
    const on = () => setRacks(loadRacks());
    window.addEventListener(ARMS_EVENT, on);
    return () => window.removeEventListener(ARMS_EVENT, on);
  }, []);
  const crew = (PARTY[ship] ?? []).filter((p) => p.gun);
  const put = (who, rack) => saveRacks(withRack(loadRacks(), who, rack));
  return (
    <div className="universe-armoury">
      {crew.map((p) => {
        const rack = rackOf(racks, p.id, p.gun);
        const guns = [...new Set([...PICKABLE, 'laser', 'pistol', p.gun])].filter((k) => WEAPONS[k]);
        const toggleGun = (k) => {
          const has = rack.guns.includes(k);
          if (has && rack.guns.length === 1) return;
          if (!has && rack.guns.length >= MAX_GUNS) return;
          put(p.id, { ...rack, guns: has ? rack.guns.filter((g) => g !== k) : [...rack.guns, k] });
        };
        const toggleMod = (m) => {
          const has = rack.mods.includes(m);
          put(p.id, { ...rack, mods: has ? rack.mods.filter((x) => x !== m) : [...rack.mods, m].slice(-MAX_MODS) });
        };
        return (
          <section key={p.id} className="universe-armoury-who" aria-label={`${p.name}’s guns`}>
            <p className="universe-armoury-name">{p.name}</p>
            <ol className="universe-armoury-rack">
              {rack.guns.map((k, i) => (
                <li key={k}>{i === 0 ? `${WEAPONS[k].name} · in hand` : WEAPONS[k].name}</li>
              ))}
            </ol>
            <div className="universe-armoury-guns" role="group" aria-label="Guns">
              {guns.map((k) => (
                <button key={k} type="button" aria-pressed={rack.guns.includes(k)} title={WEAPONS[k].about} onClick={() => toggleGun(k)}>
                  {WEAPONS[k].name}
                </button>
              ))}
            </div>
            <div className="universe-armoury-mods" role="group" aria-label="Mods">
              {MOD_IDS.map((m) => (
                <button key={m} type="button" aria-pressed={rack.mods.includes(m)} title={MODS[m].about} onClick={() => toggleMod(m)}>
                  {MODS[m].name}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2:** `Hangar.jsx`: `const TABS = ['build', 'arms', ...SLOTS]; const TAB_LABEL = { build: 'Build', arms: 'Armoury', ...SLOT_LABEL };`, `parts` is `[]` for `'arms'` too, and the body: `{slot === 'arms' ? <Armoury ship={ship} /> : slot === 'build' ? (…) : (…)}`.
- [ ] **Step 3:** CSS for the rows and toggles, in the hangar's existing style (`.universe-hangar-slots` buttons' look for the toggles).
- [ ] **Step 4:** Browser: universe hangar → Armoury: give Morty the DLT-19 first; land: Morty carries it (switch to him with X/Tab, the HUD names it); open the galaxy's hangar: Morty's rack shows the same. Commit; push; PR; CI; merge.

## Part 3 — the keys and the guide (PR 3)

### Task 10: Tab, the guide, the hints

**Files:**
- Modify: `src/components/universe/scene.js` (`footKey`: `key === 'tab'` as `key === 'x'`)
- Modify: `src/components/guide/pages.js` (the universe's on-foot rows: `['X / Tab', 'Play the other one of your crew']`, `['B', 'The next gun you carry (the hangar’s Armoury, or the hero panel, says which)']`; the galaxy world page's rows: B the same, H the hangar on the galaxy map)
- Modify: `src/components/universe/UniverseMap.jsx` (the key hint: `<kbd>B</kbd> next gun`)
- Modify: the galaxy flight hint (`src/components/galaxy/GalaxyView.jsx` or wherever its `universe-hint`-style line lives) to add `<kbd>H</kbd> hangar`

- [ ] **Step 1:** Make the edits; `npx vitest run src/components/guide` (keys.test, pages.test PASS); `npx eslint`.
- [ ] **Step 2:** Browser: Tab swaps on the universe map; the guide's pages show the rows. Commit; push; PR; CI; merge.
