# Galaxy map, flight HUD, pickups and hangar: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the galaxy map readable and zoomable, give space flight a bottom-centre flight cluster and a radar for dogfights and travel, add pickups dropped by kills, and open the hangar from the galaxy.

**Architecture:** Pure, tested modules (`mapView.js`, `labelPlace.js`, `radar.js`, `pickups.js`) hold the rules; React components (`HoloMap.jsx`, `FlightCluster.jsx`) render plain markup; `galaxy/scene.js` writes per-frame numbers into that markup through refs, as it does for the reticle and lock today. Three PRs: map (Tasks 1–7), flight HUD (8–12), pickups and hangar (13–17).

**Tech Stack:** React 18, three.js, Vite, Vitest (Node environment: no jsdom; components only through `renderToStaticMarkup`), plain CSS, `@gltf-transform/*` for the pickup model.

**Spec:** `docs/superpowers/specs/2026-10-08-galaxy-map-flight-ui-design.md`

## Global Constraints

- Nothing a player reads under 0.7 rem (`--hud-min`); text over the 3D on glass at 0.78 opacity or more, never blurred.
- HUD numbers are written to refs in the frame loop, never React state (the HUD kit's rule).
- Key caps are the house cap: `<kbd className="hud-cap">`; no world draws its own cap.
- Keys are listed once in `src/components/guide/pages.js` (the `/galaxy` entry).
- Nothing new goes on the online wire; pickups are local.
- With motion reduced: no powers bar (as today), pickups still there but still (no spin, bob or blink).
- New files under 600 lines; `galaxy/scene.js` (2,552 lines) gets glue only, logic goes in the new modules.
- Comments in the repo's voice: full sentences about what and why, no "we".
- Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run from the worktree root: `/Users/tilakpatel/Desktop/new-portfolio-website/.claude/worktrees/star-wars-map-vehicle-ui-f15b83`.

## Review Focus

1. A drag on the map that ends over a system must not pick it (a press that moves 5 px or more is a pan, not a click). Test in Task 3.
2. Zoomed in, a pick of a system off-screen must bring it into view, and Esc/M must still close the map with focus anywhere in it. Tests in Tasks 3 and 6.
3. Phone width (390 px): the map's toolbar, the films disclosure and the flight cluster must not cover the touch buttons or each other. Checked in Tasks 7 and 12 by measured rects, not by eye.
4. A pickup taken during a jump, a crash or a landing must not apply, and none may survive a jump into the next system. Test in Task 13; checked in Task 17.
5. A hangar change in the galaxy must persist to the same storage the universe map reads (`tp-universe-loadout`, `tp-universe-hull`, `tp-universe-garage`). Test in Task 16.

---

## PR 1: the map

### Task 1: `mapView.js`, the map's zoom and pan

**Files:**
- Create: `src/components/galaxy/mapView.js`
- Test: `src/components/galaxy/mapView.test.js`

**Interfaces:**
- Produces: `K_MIN = 1`, `K_MAX = 4`, `FIT = { k: 1, x: 0, y: 0 }`, `clampView(v)`, `zoomAt(v, factor, u, w)`, `panBy(v, du, dw)`, `frameUnits(points, { size = 21, margin = 1.6, kMax = 3 } = {})`, `onView(v, p, { size = 21, pad = 0.04 } = {})`, `toBox(v, p, size = 21)`.
- A view `{ k, x, y }`: the map square drawn at `k` times the box, its top-left at `(x, y)` in fractions of the box's side (so `x, y ∈ [1 − k, 0]`). CSS: `transform: translate(calc(var(--vx) * 100%), calc(var(--vy) * 100%)) scale(var(--k)); transform-origin: 0 0` on the stage, which is the box's size. `u, w` are a point in the box as fractions (0–1). Points in map units are `[x, z]` on the 21-unit grid (a system's `pos`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { FIT, K_MAX, clampView, frameUnits, onView, panBy, toBox, zoomAt } from './mapView';

describe('mapView', () => {
  it('keeps the point under the cursor where it was when it zooms', () => {
    const v = zoomAt(FIT, 2, 0.25, 0.75);
    expect(v.k).toBe(2);
    // the map point at the cursor before (0.25, 0.75 of the square) is still under it
    expect(v.x + v.k * 0.25).toBeCloseTo(0.25);
    expect(v.y + v.k * 0.75).toBeCloseTo(0.75);
  });
  it('never zooms past its limits or leaves the box uncovered', () => {
    expect(zoomAt(FIT, 0.2, 0.5, 0.5)).toEqual(FIT);
    expect(zoomAt(FIT, 99, 0.5, 0.5).k).toBe(K_MAX);
    const v = clampView({ k: 2, x: 0.4, y: -3 });
    expect(v).toEqual({ k: 2, x: 0, y: -1 });
  });
  it('pans by a share of the box, clamped', () => {
    const v = panBy({ k: 2, x: -0.5, y: -0.5 }, 0.2, -0.2);
    expect(v.x).toBeCloseTo(-0.3);
    expect(v.y).toBeCloseTo(-0.7);
    expect(panBy(FIT, 0.3, 0.3)).toEqual(FIT);
  });
  it('frames points: both on view, zoomed no more than kMax', () => {
    const a = [16, 15]; // Kamino-ish
    const b = [18, 16];
    const v = frameUnits([a, b]);
    expect(v.k).toBeLessThanOrEqual(3);
    expect(v.k).toBeGreaterThan(1);
    expect(onView(v, a)).toBe(true);
    expect(onView(v, b)).toBe(true);
    // far apart: the whole map
    expect(frameUnits([[1, 1], [20, 20]]).k).toBe(1);
  });
  it('says where a map point is in the box', () => {
    expect(toBox(FIT, [10.5, 21])).toEqual([0.5, 1]);
    const v = { k: 2, x: -0.5, y: 0 };
    expect(toBox(v, [10.5, 0])[0]).toBeCloseTo(0.5);
    expect(onView(v, [1, 1])).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/galaxy/mapView.test.js`
Expected: FAIL, `Failed to resolve import "./mapView"`.

- [ ] **Step 3: Write the module**

```js
// The galaxy map's zoom and pan (HoloMap.jsx): a view { k, x, y } draws the
// map's square at k times the box, its top-left at (x, y) in fractions of
// the box's side, so the stage's transform is translate(x·100%, y·100%)
// scale(k) from its top-left corner. The square always covers the box: x
// and y stay within 1 − k and 0. Points on the map are in its own units
// (the 21-square grid a system's `pos` is on).

export const K_MIN = 1;
export const K_MAX = 4;
export const FIT = Object.freeze({ k: 1, x: 0, y: 0 });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function clampView(v) {
  const k = clamp(v.k, K_MIN, K_MAX);
  return { k, x: clamp(v.x, 1 - k, 0), y: clamp(v.y, 1 - k, 0) };
}

// zoomed by `factor` about the box's point (u, w), which stays where it is
export function zoomAt(v, factor, u, w) {
  const k = clamp(v.k * factor, K_MIN, K_MAX);
  const r = k / v.k;
  return clampView({ k, x: u - (u - v.x) * r, y: w - (w - v.y) * r });
}

export const panBy = (v, du, dw) => clampView({ k: v.k, x: v.x + du, y: v.y + dw });

// where a map point is in the box, as fractions of its side
export const toBox = (v, [px, pz], size = 21) => [v.x + (v.k * px) / size, v.y + (v.k * pz) / size];

// whether a map point is in the box, `pad` in from its edges
export function onView(v, p, { size = 21, pad = 0.04 } = {}) {
  const [u, w] = toBox(v, p, size);
  return u >= pad && u <= 1 - pad && w >= pad && w <= 1 - pad;
}

// the closest view with every point on it, `margin` units round them, no
// nearer than kMax
export function frameUnits(points, { size = 21, margin = 1.6, kMax = 3 } = {}) {
  if (!points.length) return FIT;
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  const x0 = Math.min(...xs) - margin;
  const x1 = Math.max(...xs) + margin;
  const z0 = Math.min(...zs) - margin;
  const z1 = Math.max(...zs) + margin;
  const k = clamp(size / Math.max(x1 - x0, z1 - z0), K_MIN, Math.min(kMax, K_MAX));
  const cx = (x0 + x1) / 2 / size;
  const cz = (z0 + z1) / 2 / size;
  return clampView({ k, x: 0.5 - k * cx, y: 0.5 - k * cz });
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/galaxy/mapView.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/galaxy/mapView.js src/components/galaxy/mapView.test.js
git commit -m "The galaxy map's zoom and pan, as a pure view (mapView.js)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: `labelPlace.js`, names that don't collide

**Files:**
- Create: `src/components/galaxy/labelPlace.js`
- Test: `src/components/galaxy/labelPlace.test.js`

**Interfaces:**
- Produces: `PLACES = ['r', 'l', 't', 'b', 'tr', 'br', 'tl', 'bl']`, `GAP = 9`, `DOT = 7`, `boxAt(place, x, y, w, h)` → `{ x0, y0, x1, y1 }`, `placeLabels(items, { dot = DOT, bounds = null } = {})` → `{ [id]: place }`, `estimateWidth(name, fontPx = 12.5, extras = 0)` → px, `overlapArea(placed)`.
- `items`: `[{ id, x, y, w, h, prio }]` in screen px (the dot's centre, the label's size). `bounds`: `{ x0, y0, x1, y1 }` (the box) or null.
- The CSS (Task 4) puts a label at `data-place`; its box must be what `boxAt` returns: right of the dot with a 9 px gap (`r`), left (`l`), centred above (`t`) or below (`b`), and the corners offset 0.6 × the gap from the dot on both axes.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { SYSTEMS } from './systems';
import { boxAt, estimateWidth, overlapArea, placeLabels } from './labelPlace';

const at = (box) => SYSTEMS.map((s) => ({ id: s.id, x: (s.pos[0] / 21) * box, y: (s.pos[1] / 21) * box, w: estimateWidth(s.name), h: 18, prio: 0 }));
const boxesOf = (items, places) => items.map((it) => ({ id: it.id, ...boxAt(places[it.id], it.x, it.y, it.w, it.h) }));

describe('labelPlace', () => {
  it('puts a lone name on the right', () => {
    expect(placeLabels([{ id: 'a', x: 100, y: 100, w: 60, h: 18, prio: 0 }])).toEqual({ a: 'r' });
  });
  it('moves a name off a neighbour that would cover it', () => {
    const p = placeLabels([
      { id: 'a', x: 100, y: 100, w: 80, h: 18, prio: 1 },
      { id: 'b', x: 140, y: 102, w: 60, h: 18, prio: 0 },
    ]);
    expect(p.b).not.toBe('l');
    const boxes = boxesOf([{ id: 'a', x: 100, y: 100, w: 80, h: 18 }, { id: 'b', x: 140, y: 102, w: 60, h: 18 }], p);
    expect(overlapArea(boxes)).toBe(0);
  });
  it('places every system on a 600 px map with no name over another', () => {
    const items = at(600);
    const p = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: 600, y1: 600 } });
    expect(overlapArea(boxesOf(items, p))).toBe(0);
  });
  it('does better than all-right on a phone-sized map', () => {
    const items = at(380);
    const right = Object.fromEntries(items.map((i) => [i.id, 'r']));
    const p = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: 380, y1: 380 } });
    expect(overlapArea(boxesOf(items, p))).toBeLessThan(overlapArea(boxesOf(items, right)) * 0.25);
  });
  it('gives a contested place to the higher priority', () => {
    const two = (pa, pb) => placeLabels([
      { id: 'here', x: 100, y: 100, w: 80, h: 18, prio: pa },
      { id: 'low', x: 100, y: 115, w: 80, h: 18, prio: pb },
    ]);
    const a = two(100, 0);
    expect(a.here).toBe('r');
    expect(a.low).not.toBe('r');
    const b = two(0, 100);
    expect(b.low).toBe('r');
    expect(b.here).not.toBe('r');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/galaxy/labelPlace.test.js`
Expected: FAIL, import not resolved.

- [ ] **Step 3: Write the module**

```js
// Where each system's name goes on the galaxy map (HoloMap.jsx), so none
// covers another or a dot: eight places round its dot, right first, then
// left, above, below and the corners; the names placed in priority order
// (where you are, the one picked, a battle on, the major order, the rest),
// each taking the place that overlaps least with the names already down,
// every other dot and the box's edge. In screen pixels, at the map's zoom
// (the names keep their size while the map scales, so zoomed in they part).

export const PLACES = ['r', 'l', 't', 'b', 'tr', 'br', 'tl', 'bl'];
export const GAP = 9; // (the dot's radius, 7, and 2 more)
export const DOT = 7;

export function boxAt(place, x, y, w, h) {
  const c = GAP * 0.6;
  switch (place) {
    case 'l':
      return { x0: x - GAP - w, y0: y - h / 2, x1: x - GAP, y1: y + h / 2 };
    case 't':
      return { x0: x - w / 2, y0: y - GAP - h, x1: x + w / 2, y1: y - GAP };
    case 'b':
      return { x0: x - w / 2, y0: y + GAP, x1: x + w / 2, y1: y + GAP + h };
    case 'tr':
      return { x0: x + c, y0: y - c - h, x1: x + c + w, y1: y - c };
    case 'br':
      return { x0: x + c, y0: y + c, x1: x + c + w, y1: y + c + h };
    case 'tl':
      return { x0: x - c - w, y0: y - c - h, x1: x - c, y1: y - c };
    case 'bl':
      return { x0: x - c - w, y0: y + c, x1: x - c, y1: y + c + h };
    default:
      return { x0: x + GAP, y0: y - h / 2, x1: x + GAP + w, y1: y + h / 2 };
  }
}

const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const outside = (b, o) => (b.x1 - b.x0) * (b.y1 - b.y0) - area(b, o);

// a name's width before it's been measured: its letters at the map's size, and its marks
export const estimateWidth = (name, fontPx = 12.5, extras = 0) => Math.ceil(name.length * fontPx * 0.58 + 8 + extras);

// how much the boxes overlap, all pairs (for the tests and the check)
export function overlapArea(boxes) {
  let n = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) n += area(boxes[i], boxes[j]);
  return n;
}

export function placeLabels(items, { dot = DOT, bounds = null } = {}) {
  const order = [...items].sort((a, b) => b.prio - a.prio || (a.id < b.id ? -1 : 1));
  const dots = items.map((i) => ({ id: i.id, x0: i.x - dot, y0: i.y - dot, x1: i.x + dot, y1: i.y + dot }));
  const placed = [];
  const out = {};
  for (const it of order) {
    let best = null;
    let cost = Infinity;
    PLACES.forEach((p, n) => {
      const b = boxAt(p, it.x, it.y, it.w, it.h);
      let c = n * 0.5; // (a tie keeps the earlier place: right, as the map always had it)
      for (const q of placed) c += area(b, q) * 10;
      for (const d of dots) if (d.id !== it.id) c += area(b, d) * 10;
      if (bounds) c += outside(b, bounds) * 4;
      if (c < cost) {
        cost = c;
        best = { p, b };
      }
    });
    out[it.id] = best.p;
    placed.push(best.b);
  }
  return out;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/galaxy/labelPlace.test.js`
Expected: PASS (5 tests). If the 600 px test fails, print the colliding pair (ids and boxes) and adjust only `estimateWidth`'s 0.58 factor against the real font (`getComputedStyle` of `.holomap-name` in the browser, Task 4) — never weaken the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/components/galaxy/labelPlace.js src/components/galaxy/labelPlace.test.js
git commit -m "The galaxy map's names placed round their dots so none covers another (labelPlace.js)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: the map zooms and pans

The repo's tests run in Node (no jsdom, no Testing Library: components are checked with `renderToStaticMarkup` or not at all). So the pointer logic is a pure machine (`gesture.js`), tested; the hook that wires it to the DOM is thin and checked in the browser (Task 7).

**Files:**
- Create: `src/components/galaxy/gesture.js` (the press, drag and pinch rules, pure)
- Test: `src/components/galaxy/gesture.test.js`
- Create: `src/components/galaxy/useMapView.js` (the hook: the machine on the box's pointer events, the wheel, the view state)
- Modify: `src/components/galaxy/HoloMap.jsx` (the `.holomap-map` block, ~lines 256–341; `paintGalaxy`, ~65–116; the canvas effect, ~189–197)
- Modify: `src/components/galaxy/galaxy.css` (the `.holomap-map` rules, ~296–345)

**Interfaces:**
- Consumes: Task 1's `FIT`, `zoomAt`, `panBy`, `frameUnits`, `onView`.
- Produces: `DRAG = 5`; `createGesture()` → `{ down(id, x, y, rect), move(id, x, y, rect) → null | { pan: [du, dw] } | { zoom: f, u, w }, up(id), cancel(id), takeClick() → boolean, get dragging }` where `rect` is `{ left, top, width, height }` (the box's client rect) and `du, dw, u, w` are fractions of the box. `useMapView(boxRef)` → `{ view, setView, zoom(factor), zoomIn(), zoomOut(), fit(), frame(points), handlers }`, where `handlers` are `{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture }` for the box, and the wheel listener is added natively (`{ passive: false }`). The stage gets `--k`, `--vx`, `--vy`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { createGesture } from './gesture';

const R = { left: 0, top: 0, width: 600, height: 600 };

describe('gesture', () => {
  it('a drag pans by the share of the box it moved, and swallows the click it ends with', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    expect(g.move(1, 303, 300, R)).toBeNull(); // (under DRAG: still a click)
    const m = g.move(1, 360, 300, R);
    expect(m.pan[0]).toBeCloseTo(60 / 600);
    expect(m.pan[1]).toBeCloseTo(0);
    g.up(1);
    expect(g.takeClick()).toBe(true);
    expect(g.takeClick()).toBe(false);
  });
  it('a press that barely moves is a click', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    expect(g.move(1, 302, 301, R)).toBeNull();
    g.up(1);
    expect(g.takeClick()).toBe(false);
  });
  it('two fingers pinch about their middle', () => {
    const g = createGesture();
    g.down(1, 200, 300, R);
    g.down(2, 400, 300, R);
    const m = g.move(2, 500, 300, R);
    expect(m.zoom).toBeCloseTo(300 / 200);
    expect(m.u).toBeCloseTo(0.5);
    expect(m.w).toBeCloseTo(0.5);
    g.up(2);
    g.up(1);
    expect(g.takeClick()).toBe(true); // (a pinch never picks a system)
  });
  it('a cancelled press forgets itself', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    g.cancel(1);
    expect(g.move(1, 400, 300, R)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/galaxy/gesture.test.js`
Expected: FAIL, import not resolved.

- [ ] **Step 3: Write `gesture.js`**

```js
// The galaxy map's hands (useMapView.js): a press that moves less than
// DRAG px is a click on what's under it; one that moves more is a pan (by
// the share of the box it moved) and the click it ends in is swallowed;
// two fingers are a pinch, zoomed by how far apart they've gone, about
// where they started between them. Pure: the hook feeds it pointer events.
export const DRAG = 5;

export function createGesture() {
  const ptrs = new Map(); // id → { x, y }
  let press = null; // { x, y }
  let pinch = null; // { d, u, w }
  let dragging = false;
  let swallow = false;
  return {
    down(id, x, y, rect) {
      ptrs.set(id, { x, y });
      if (ptrs.size === 1) {
        press = { x, y };
        dragging = false;
        swallow = false;
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, u: ((a.x + b.x) / 2 - rect.left) / rect.width, w: ((a.y + b.y) / 2 - rect.top) / rect.height };
        swallow = true;
      }
    },
    move(id, x, y, rect) {
      const p = ptrs.get(id);
      if (!p) return null;
      const dx = x - p.x;
      const dy = y - p.y;
      p.x = x;
      p.y = y;
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const f = d / pinch.d;
        pinch.d = d;
        return { zoom: f, u: pinch.u, w: pinch.w };
      }
      if (!press) return null;
      if (!dragging && Math.hypot(x - press.x, y - press.y) < DRAG) return null;
      if (!dragging) {
        dragging = true;
        swallow = true;
        // (the first move past DRAG pans by all of it, from the press)
        return { pan: [(x - press.x) / rect.width, (y - press.y) / rect.height] };
      }
      return { pan: [dx / rect.width, dy / rect.height] };
    },
    up(id) {
      ptrs.delete(id);
      if (ptrs.size < 2) pinch = null;
      if (!ptrs.size) press = null;
    },
    cancel(id) {
      ptrs.delete(id);
      pinch = null;
      press = null;
      dragging = false;
    },
    takeClick() {
      const s = swallow;
      swallow = false;
      return s;
    },
    get dragging() {
      return dragging;
    },
  };
}
```

Check the first test against this: the move to 303 returns null (3 px); the move to 360 is the first past DRAG and pans by all 60 px from the press: `60 / 600`. That's what it asserts.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/galaxy/gesture.test.js`
Expected: PASS (4 tests).

- [ ] **Step 4b: Write the hook** (`useMapView.js`; no unit test: the browser check in Task 7 drives it)

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { FIT, frameUnits, panBy, zoomAt } from './mapView';
import { createGesture } from './gesture';

// The galaxy map's view (mapView.js) and the hands on it (gesture.js): the
// wheel or a trackpad zooms about the pointer, a drag pans, two fingers
// pinch, and the page's buttons and keys zoom about the middle.
const STEP = 1.5; // (a button's or a key's zoom)

export function useMapView(boxRef) {
  const [view, setView] = useState(FIT);
  const gesture = useRef(null);
  gesture.current ??= createGesture();
  const rect = () => boxRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };

  const zoom = useCallback((f, u = 0.5, w = 0.5) => setView((v) => zoomAt(v, f, u, w)), []);
  const fit = useCallback(() => setView(FIT), []);
  const frame = useCallback((points) => setView(frameUnits(points)), []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const f = Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.0068); // (a trackpad's small steps a little; a wheel's notch, about STEP)
      setView((v) => zoomAt(v, f, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [boxRef]);

  const apply = (m) => {
    if (!m) return;
    if (m.pan) setView((v) => panBy(v, m.pan[0], m.pan[1]));
    else setView((v) => zoomAt(v, m.zoom, m.u, m.w));
  };
  const handlers = {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gesture.current.down(e.pointerId, e.clientX, e.clientY, rect());
    },
    onPointerMove: (e) => {
      const was = gesture.current.dragging;
      apply(gesture.current.move(e.pointerId, e.clientX, e.clientY, rect()));
      if (!was && gesture.current.dragging) e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerUp: (e) => gesture.current.up(e.pointerId),
    onPointerCancel: (e) => gesture.current.cancel(e.pointerId),
    // (a drag that ends over a system doesn't pick it)
    onClickCapture: (e) => {
      if (!gesture.current.takeClick()) return;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  return { view, setView, zoom, zoomIn: () => zoom(STEP), zoomOut: () => zoom(1 / STEP), fit, frame, handlers };
}
```

- [ ] **Step 5: Wire it into `HoloMap.jsx`**

1. `import { useMapView } from './useMapView';` and `const mv = useMapView(box);` after `const box = useRef(null);`.
2. Wrap everything that's inside `.holomap-map` and moves with the map (the canvas, the SVG, `<Fleets>`, both `.holomap-axis` divs, the `.holomap-systems` list) in `<div className="holomap-stage" style={{ '--k': mv.view.k, '--vx': mv.view.x, '--vy': mv.view.y }}>…</div>`. `WarStrip` and `WarLegend` stay outside the stage (they don't move).
3. Spread `{...mv.handlers}` onto `.holomap-map`; add `data-zoomed={mv.view.k > 1.01 || undefined}`.
4. Add the zoom buttons as the last child of `.holomap-map`:

```jsx
<div className="holomap-zoom" role="group" aria-label="Zoom">
  <button type="button" onClick={mv.zoomIn} aria-label="Zoom in" title="Zoom in (+)">+</button>
  <button type="button" onClick={mv.zoomOut} aria-label="Zoom out" title="Zoom out (−)">−</button>
  <button type="button" onClick={mv.fit} aria-label="Show the whole galaxy" title="The whole galaxy (0)" disabled={mv.view.k <= 1.01}>
    <RiFullscreenExitLine aria-hidden="true" />
  </button>
</div>
```

(import `RiFullscreenExitLine` from `react-icons/ri`).
5. In `choose(id)`, after `setPick(id)`, frame the course when either end is off the view: `const s = systemById(id); if (s && here && (!onView(mv.view, s.pos) || !onView(mv.view, here.pos))) mv.frame([s.pos, here.pos]);` (import `onView`).
6. `paintGalaxy(canvas, k = 1)`: use `const dpr = Math.min(2, window.devicePixelRatio || 1) * Math.min(k, 2.5);` (the rest unchanged, so it paints at that many backing pixels). In the canvas effect, redraw 200 ms after the zoom settles:

```js
const zk = mv.view.k;
useEffect(() => {
  const c = canvas.current;
  if (!c) return undefined;
  const id = setTimeout(() => paintGalaxy(c, zk), 200);
  return () => clearTimeout(id);
}, [zk]);
```

(the first paint and the ResizeObserver one stay as they are, passing `live k` through a ref: `paintGalaxy(c, kRef.current)`).

- [ ] **Step 6: The CSS** (in `galaxy.css`, after `.holomap-map`)

```css
.holomap-map { touch-action: none; cursor: grab; }
.holomap-map[data-zoomed]:active { cursor: grabbing; }
.holomap-stage {
  position: absolute;
  inset: 0;
  transform: translate(calc(var(--vx, 0) * 100%), calc(var(--vy, 0) * 100%)) scale(var(--k, 1));
  transform-origin: 0 0;
  will-change: transform;
}
@media (prefers-reduced-motion: no-preference) { .holomap-stage { transition: transform 0.18s ease-out; } }
.holomap-map:active .holomap-stage { transition: none; }
/* names, badges and crests keep their size while the map scales */
.holomap-system,
.holomap-axis span,
.holomap-fleet { scale: calc(1 / var(--k, 1)); }
.holomap-zoom { position: absolute; z-index: 3; right: 10px; bottom: 10px; display: grid; gap: 6px; }
.holomap-zoom button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgb(127 214 255 / 0.35);
  border-radius: 10px;
  background: rgb(2 8 20 / 0.86);
  color: #d9f3ff;
  font-size: 1.1rem;
}
.holomap-zoom button:disabled { opacity: 0.4; }
@media (pointer: coarse) { .holomap-zoom button { width: 44px; height: 44px; } }
```

Check `warmap.css` for the fleet crest's class (`WarLayers.jsx` `Fleets`) and use that exact selector in place of `.holomap-fleet` if it differs. The axis labels stay in the stage, so they scale with the map's edges.

- [ ] **Step 7: Lint and test the folder**

Run: `npx eslint src/components/galaxy && npx vitest run src/components/galaxy`
Expected: no lint errors; all galaxy tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/galaxy/gesture.js src/components/galaxy/gesture.test.js src/components/galaxy/useMapView.js src/components/galaxy/HoloMap.jsx src/components/galaxy/galaxy.css
git commit -m "The galaxy map zooms and pans: wheel, drag, pinch, buttons; a pick off the view frames its course" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: names placed, text readable, regions spread

**Files:**
- Modify: `src/components/galaxy/HoloMap.jsx` (the systems list; the region names)
- Modify: `src/components/galaxy/galaxy.css` (`.holomap-system`, `.holomap-name`, `.holomap-axis`, `.holomap-region-name`, `.holomap-pilots`)
- Modify: `src/components/galaxy/warmap.css` (the badge font sizes, lines ~61 and ~168: the +/− badge 10 px → 0.7 rem, 8 px on phones → 0.7 rem)
- Modify: `src/components/galaxy/warMap.js` (remove `NAME_LEFT` and its export once nothing imports it)
- Test: `src/components/galaxy/warMap.test.js` (drop any `NAME_LEFT` assertions)

**Interfaces:**
- Consumes: Task 2's `placeLabels`, `estimateWidth`; Task 3's `mv.view`.

- [ ] **Step 1: Compute the places in `HoloMap.jsx`**

```js
const [boxPx, setBoxPx] = useState(600);
useEffect(() => {
  const el = box.current;
  if (!el || typeof ResizeObserver === 'undefined') return undefined;
  const ro = new ResizeObserver(([e]) => setBoxPx(e.contentRect.width || 600));
  ro.observe(el);
  return () => ro.disconnect();
}, []);
const widths = useRef({}); // id → measured px, from the DOM
const [measured, setMeasured] = useState(0);
useLayoutEffect(() => {
  let changed = false;
  for (const el of box.current?.querySelectorAll('.holomap-name[data-id]') ?? []) {
    const w = Math.ceil(el.getBoundingClientRect().width / mv.view.k); // (counter-scaled: its own size)
    if (w && widths.current[el.dataset.id] !== w) (widths.current[el.dataset.id] = w), (changed = true);
  }
  if (changed) setMeasured((n) => n + 1);
}, [war, boxPx]); // eslint-disable-line react-hooks/exhaustive-deps
const places = useMemo(() => {
  const { k, x, y } = mv.view;
  const items = SYSTEMS.map((s) => {
    const row = war.byId[s.id];
    const prio = s.id === current ? 100 : s.id === pick ? 90 : row?.battle?.fighting ? 50 : row?.major ? 40 : 0;
    const extras = (row?.major ? 14 : 0) + (row?.battle?.fighting ? 14 : 0) + (pilots[s.id] ? 20 : 0);
    return { id: s.id, x: (x + (k * s.pos[0]) / SIZE) * boxPx, y: (y + (k * s.pos[1]) / SIZE) * boxPx, w: widths.current[s.id] ?? estimateWidth(s.name, 12.5, extras), h: 20, prio };
  });
  return placeLabels(items, { bounds: { x0: 0, y0: 0, x1: boxPx, y1: boxPx } });
}, [mv.view, boxPx, war, current, pick, pilots, measured]);
```

(add `useLayoutEffect` to the React import). On each `<li>`, replace `data-side={NAME_LEFT.has(s.id) ? 'left' : undefined}` with `data-place={places[s.id]}`, and give the name span `data-id={s.id}`.

- [ ] **Step 2: The CSS for the places** (replace the `.holomap-system` block and the `data-side='left'` rule)

```css
.holomap-system {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  width: 14px;
  height: 14px;
  translate: -50% -50%;
  padding: 0;
  border-radius: 50%;
  color: #e6f6ff;
  font-size: 0.78rem;
  white-space: nowrap;
}
.holomap-system::after { content: ''; position: absolute; inset: -6px; border-radius: 50%; } /* (a bigger target than the dot) */
.holomap-dot { position: absolute; inset: 0; }
.holomap-name {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.05rem 0.3rem;
  border-radius: 6px;
  line-height: 1.25;
  text-shadow: 0 0 6px #000, 0 0 2px #000;
}
.holomap-systems > li .holomap-name { left: calc(100% + 2px); top: 50%; translate: 0 -50%; }
.holomap-systems > li[data-place='l'] .holomap-name { left: auto; right: calc(100% + 2px); }
.holomap-systems > li[data-place='t'] .holomap-name { left: 50%; top: auto; bottom: calc(100% + 2px); translate: -50% 0; }
.holomap-systems > li[data-place='b'] .holomap-name { left: 50%; top: calc(100% + 2px); translate: -50% 0; }
.holomap-systems > li[data-place='tr'] .holomap-name { left: 80%; top: auto; bottom: 80%; translate: 0 0; }
.holomap-systems > li[data-place='br'] .holomap-name { left: 80%; top: 80%; translate: 0 0; }
.holomap-systems > li[data-place='tl'] .holomap-name { left: auto; right: 80%; top: auto; bottom: 80%; translate: 0 0; }
.holomap-systems > li[data-place='bl'] .holomap-name { left: auto; right: 80%; top: 80%; translate: 0 0; }
.holomap-system[aria-pressed='true'] .holomap-name { background: rgb(2 6 16 / 0.85); box-shadow: 0 0 0 1px var(--c); color: #fff; }
.holomap-pilots { min-width: 18px; height: 18px; font-size: 0.7rem; }
.holomap-axis { font-size: 0.7rem; }
```

Move the `.holomap-pilots` span inside `.holomap-name` (so it travels with the name). Keep the existing `aria-pressed` dot rules working: the dot's `aria-current` glow selector stays `.holomap-system[aria-current='location'] .holomap-dot`. Check `warmap.css` for rules that assume the old flex layout of `.holomap-system` (the ring and badge are drawn on `.holomap-dot` or the `li`; keep their anchor at the dot) and adjust only those selectors.

- [ ] **Step 3: Region names readable and spread**

Replace the region `<text>` elements with names along their rings at staggered angles, sized from the box:

```jsx
const unitPx = (boxPx * mv.view.k) / SIZE; // (screen px per map unit)
const regionFont = 11.5 / unitPx; // (11.5 px on screen at any zoom)
const REGION_ANGLE = [-90, -112, -68, -132, -48, -150]; // (degrees round the core, north is −90: the names apart)
{REGIONS.slice(1).map((r, i) => {
  const a = (REGION_ANGLE[i % REGION_ANGLE.length] * Math.PI) / 180;
  const d = edgeAt(r.r, a) - regionFont * 0.9;
  const x = CORE[0] + Math.cos(a) * d;
  const y = CORE[1] + Math.sin(a) * d;
  const deg = (a * 180) / Math.PI + 90; // (along the ring)
  return (
    <text key={r.id} x={x} y={y} transform={`rotate(${deg.toFixed(1)} ${x.toFixed(3)} ${y.toFixed(3)})`} className="holomap-region-name" style={{ fontSize: regionFont, letterSpacing: regionFont * 0.18 }}>
      {r.name}
    </text>
  );
})}
```

and the Unknown Regions' `<text>` with `style={{ fontSize: regionFont }}`. In the CSS, `.holomap-region-name` loses its `font-size` and `letter-spacing` and gets `fill: rgb(191 234 255 / 0.62)`.

- [ ] **Step 4: Remove `NAME_LEFT`**

`grep -rn NAME_LEFT src` must show only `warMap.js` (and its test); delete the export and its test lines.

- [ ] **Step 5: Run lint and tests**

Run: `npx eslint src/components/galaxy && npx vitest run src/components/galaxy`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/galaxy
git commit -m "The galaxy map's names placed clear of each other at every zoom, nothing under 0.7 rem, the regions' names spread round their rings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: layers, one era control, the films in a disclosure

**Files:**
- Create: `src/components/galaxy/mapLayers.js`
- Test: `src/components/galaxy/mapLayers.test.js`
- Modify: `src/components/galaxy/HoloMap.jsx` (the era and films rows; the SVG's layers; `view`)
- Modify: `src/components/galaxy/WarStrip.jsx` (drop the war switch; show the war's name)
- Modify: `src/components/galaxy/galaxy.css`, `src/components/galaxy/warmap.css`
- Modify: any test asserting the war switch (`grep -rn "The war the map shows" src`)

**Interfaces:**
- Produces: `LAYERS = ['territory', 'fronts', 'lanes', 'regions', 'grid']`, `LAYER_LABEL`, `LAYERS_KEY = 'tp-galaxy-layers'`, `DEFAULT_LAYERS = { territory: true, fronts: true, lanes: true, regions: true, grid: false }`, `readLayers(raw)` (anything not a boolean falls back to the default), `warForEra(era, oathWar)` → a `WARS` id.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYERS, LAYERS, readLayers, warForEra } from './mapLayers';

describe('mapLayers', () => {
  it('reads saved layers, defaulting anything odd', () => {
    expect(readLayers(null)).toEqual(DEFAULT_LAYERS);
    expect(readLayers({ grid: true, lanes: 'no', bogus: true })).toEqual({ ...DEFAULT_LAYERS, grid: true });
    expect(Object.keys(readLayers({}))).toEqual(LAYERS);
  });
  it('shows the war of the era picked, or your own', () => {
    expect(warForEra('republic', 'gcw')).toBe('clone');
    expect(warForEra('empire', 'clone')).toBe('gcw');
    expect(warForEra('newrepublic', 'gcw')).not.toBe('gcw');
    expect(warForEra('all', 'clone')).toBe('clone');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/galaxy/mapLayers.test.js`
Expected: FAIL, import not resolved.

- [ ] **Step 3: Write the module**

```js
import { WARS, WAR_IDS } from './sides';

// What the galaxy map draws (HoloMap.jsx), each a switch kept in this
// browser: the war's territory, its fronts (the borders, the offensives and
// their fleets, the systems' rings), the hyperspace lanes, the regions'
// rings and names, and the atlas's grid (off till asked for: the panel
// still says the square).
export const LAYERS = ['territory', 'fronts', 'lanes', 'regions', 'grid'];
export const LAYER_LABEL = { territory: 'Territory', fronts: 'Fronts', lanes: 'Lanes', regions: 'Regions', grid: 'Grid' };
export const LAYERS_KEY = 'tp-galaxy-layers';
export const DEFAULT_LAYERS = Object.freeze({ territory: true, fronts: true, lanes: true, regions: true, grid: false });

export function readLayers(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(LAYERS.map((id) => [id, typeof v[id] === 'boolean' ? v[id] : DEFAULT_LAYERS[id]]));
}

// the war an era's chip shows: its own war, or with every era lit, the one you fight in
export const warForEra = (era, oathWar) => WAR_IDS.find((id) => WARS[id].era === era) ?? oathWar;
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/galaxy/mapLayers.test.js`
Expected: PASS.

- [ ] **Step 5: Wire the layers into `HoloMap.jsx`**

- State: `const [layers, setLayersState] = useState(() => readLayers(local.get(LAYERS_KEY)));` and `const toggle = (id) => setLayersState((l) => { const next = { ...l, [id]: !l[id] }; local.set(LAYERS_KEY, next); return next; });` (`import { local } from '../../lib/hooks';`).
- In the SVG: the grid lines only when `layers.grid`; `<Territory>` only when `layers.territory`; the unknown wedge, region paths and names only when `layers.regions`; `LANES` only when `layers.lanes`; `<WarLines>` only when `layers.fronts`. `<Fleets>` only when `layers.fronts`. The axis divs only when `layers.grid`.
- On `.holomap-map`: `data-fronts={layers.fronts || undefined}`; in `warmap.css`, the systems' ring, badge and cut marks only show under `.holomap-map[data-fronts]` (wrap the existing selectors that draw them: prefix with `.holomap-map[data-fronts] `).
- The toolbar over the map's top right (inside `.holomap-map`, outside the stage):

```jsx
<div className="holomap-layers" role="group" aria-label="Show on the map">
  {LAYERS.map((id) => (
    <button key={id} type="button" aria-pressed={layers[id]} onClick={() => toggle(id)}>
      {LAYER_LABEL[id]}
    </button>
  ))}
</div>
```

- [ ] **Step 6: One era control**

- Drop `const [view, setView] = useState(oath.war)` and its effect; `const view = warForEra(film ? FILMS[film].era : era, oath.war);`.
- `WarStrip`: remove the `view`, `onView`, `fighting` props and the `.holomap-strip-wars` group; render instead `<p className="holomap-strip-war">{w.name}{table.war === fighting && <span className="holomap-strip-yours"> · yours</span>}</p>` (keep a `fighting` prop for that). Update its call: `<WarStrip table={war} fighting={oath.war} />`.
- The films row becomes a disclosure at the end of the era row (and the `.holomap-films` row and its `display: none` phone rule go):

```jsx
<details className="holomap-filmpick">
  <summary>{film ? filmShort(film) : 'Films'}</summary>
  <div className="holomap-films" role="group" aria-label="Film">
    {FILM_ORDER.map((id) => (
      <button key={id} type="button" aria-pressed={film === id} style={{ '--era': eraById(FILMS[id].era).color }} onClick={(e) => (setFilm(film === id ? null : id), e.currentTarget.closest('details').open = false)} title={`${filmLabel(id)} · ${yearLabel(FILMS[id].year)}`}>
        {filmShort(id)} <span>{filmLabel(id)}</span>
      </button>
    ))}
  </div>
</details>
```

- [ ] **Step 7: The CSS**

```css
.holomap-frame { grid-template-rows: auto auto 1fr; }
.holomap-layers { position: absolute; z-index: 3; top: 10px; right: 10px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; max-width: 60%; }
.holomap-layers button { padding: 0.2rem 0.55rem; border: 1px solid rgb(127 214 255 / 0.25); border-radius: 999px; background: rgb(2 8 20 / 0.86); color: rgb(217 243 255 / 0.7); font-size: 0.72rem; }
.holomap-layers button[aria-pressed='true'] { border-color: rgb(127 214 255 / 0.7); color: #fff; }
.holomap-filmpick { position: relative; }
.holomap-filmpick > summary { list-style: none; cursor: pointer; padding: 0.25rem 0.65rem; border: 1px dashed rgb(127 214 255 / 0.35); border-radius: 999px; color: #bfeaff; font-size: 0.74rem; }
.holomap-filmpick > summary::-webkit-details-marker { display: none; }
.holomap-filmpick[open] .holomap-films { position: absolute; z-index: 5; top: calc(100% + 6px); left: 0; display: grid; grid-template-columns: repeat(3, max-content); gap: 0.35rem; padding: 0.6rem; border: 1px solid rgb(127 214 255 / 0.3); border-radius: 12px; background: rgb(2 6 16 / 0.97); }
.holomap-films button span { margin-left: 0.3rem; opacity: 0.7; font-family: var(--font-body, inherit); font-size: 0.7rem; }
.holomap-strip-war { margin: 0 0 0.3rem; color: #fff; font-size: 0.78rem; font-weight: 600; }
@media (max-width: 760px) {
  .holomap-filmpick[open] .holomap-films { grid-template-columns: repeat(2, max-content); right: 0; left: auto; }
  .holomap-layers { top: auto; bottom: 10px; right: 56px; max-width: calc(100% - 70px); }
}
```

Also lift every size in `warmap.css` under 0.7 rem to 0.7 rem (the strip's share and trend, the stats labels): `grep -n "font-size: 0\.[0-6]" src/components/galaxy/warmap.css src/components/galaxy/galaxy.css` must come back empty for the map's rules.

- [ ] **Step 8: Lint, tests**

Run: `npx eslint src/components/galaxy && npx vitest run src/components/galaxy`
Expected: pass (fix any test that clicked the war switch: it now follows the era chip).

- [ ] **Step 9: Commit**

```bash
git add -A src/components/galaxy
git commit -m "The galaxy map's layers can be switched off, the era chips pick the war shown, and the films fold into one chip" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: you, the pick and the course; find; keys; the panel; the key

**Files:**
- Modify: `src/components/galaxy/HoloMap.jsx`
- Modify: `src/components/galaxy/WarLegend.jsx` (grouped entries)
- Modify: `src/components/galaxy/galaxy.css`
- Modify: `src/components/guide/pages.js` (the `/galaxy` keys)
- Create: `src/components/galaxy/mapKeys.js` (the map's keys and its find, pure)
- Test: `src/components/galaxy/mapKeys.test.js`

**Interfaces:**
- Consumes: `onClose`, `onJump` (HoloMap's props), `mv` (Task 3).
- Produces: `mapKeyAction({ key, meta, ctrl, alt }, { typing, canJump })` → `'close' | 'find' | 'jump' | 'zoomIn' | 'zoomOut' | 'fit' | null` (`m` and `Escape` close, Escape even while typing; `/` finds; `j` jumps when `canJump`; `+`/`=` in, `-`/`_` out, `0` fit; nothing with a modifier, nothing else while typing); `findSystems(q, systems, n = 6)` → the systems whose name contains `q` (case-insensitive, trimmed), those starting with it first, at most `n`.
- HoloMap handles its own keys through `mapKeyAction`, and gains an optional `onCourse(id | null)` prop, called whenever the pick changes (Task 11 uses it).

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { SYSTEMS } from './systems';
import { findSystems, mapKeyAction } from './mapKeys';

const k = (key, o = {}) => ({ key, meta: false, ctrl: false, alt: false, ...o });

describe('mapKeys', () => {
  it('closes on M and Escape, Escape even while typing', () => {
    expect(mapKeyAction(k('m'), { typing: false, canJump: false })).toBe('close');
    expect(mapKeyAction(k('M'), { typing: false, canJump: false })).toBe('close');
    expect(mapKeyAction(k('Escape'), { typing: true, canJump: false })).toBe('close');
    expect(mapKeyAction(k('m'), { typing: true, canJump: false })).toBeNull();
  });
  it('jumps only with a course to jump to', () => {
    expect(mapKeyAction(k('j'), { typing: false, canJump: true })).toBe('jump');
    expect(mapKeyAction(k('j'), { typing: false, canJump: false })).toBeNull();
  });
  it('finds and zooms, and leaves modified keys alone', () => {
    expect(mapKeyAction(k('/'), { typing: false, canJump: false })).toBe('find');
    expect(mapKeyAction(k('+'), { typing: false })).toBe('zoomIn');
    expect(mapKeyAction(k('='), { typing: false })).toBe('zoomIn');
    expect(mapKeyAction(k('-'), { typing: false })).toBe('zoomOut');
    expect(mapKeyAction(k('0'), { typing: false })).toBe('fit');
    expect(mapKeyAction(k('m', { meta: true }), { typing: false })).toBeNull();
    expect(mapKeyAction(k('+'), { typing: true })).toBeNull();
  });
  it('finds systems by name, the ones that start with it first', () => {
    expect(findSystems('endo', SYSTEMS).map((s) => s.id)).toEqual(['endor']);
    expect(findSystems('  ', SYSTEMS)).toEqual([]);
    const ho = findSystems('o', SYSTEMS, 3);
    expect(ho.length).toBeLessThanOrEqual(3);
    const t = findSystems('t', SYSTEMS);
    const firstNonStart = t.findIndex((s) => !s.name.toLowerCase().startsWith('t'));
    const lastStart = t.map((s) => s.name.toLowerCase().startsWith('t')).lastIndexOf(true);
    if (firstNonStart !== -1) expect(lastStart).toBeLessThan(firstNonStart);
  });
});
```

(`endor` must be the system id for Endor: check `grep -n "id: 'endor'" src/components/galaxy/systems.js`, and use the real id if it differs.)

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/galaxy/mapKeys.test.js`
Expected: FAIL, import not resolved.

- [ ] **Step 3: `mapKeys.js`, and the keys in HoloMap**

```js
// The galaxy map's own keys (HoloMap.jsx) and its find: M or Escape
// closes it (Escape even from the find field), / goes to the find field, J
// jumps to the course, + − 0 zoom; the rest is the page's or the field's.
export function mapKeyAction({ key, meta, ctrl, alt }, { typing = false, canJump = false } = {}) {
  if (meta || ctrl || alt) return null;
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k === 'Escape') return 'close';
  if (typing) return null;
  if (k === 'm') return 'close';
  if (k === '/') return 'find';
  if (k === 'j') return canJump ? 'jump' : null;
  if (k === '+' || k === '=') return 'zoomIn';
  if (k === '-' || k === '_') return 'zoomOut';
  if (k === '0') return 'fit';
  return null;
}

export function findSystems(q, systems, n = 6) {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const hits = systems.filter((s) => s.name.toLowerCase().includes(t));
  const starts = (s) => s.name.toLowerCase().startsWith(t);
  return [...hits.filter(starts), ...hits.filter((s) => !starts(s))].slice(0, n);
}
```

In `HoloMap.jsx`:

```js
const find = useRef(null);
useEffect(() => {
  const onKey = (e) => {
    const el = e.target;
    const typing = el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    const act = mapKeyAction({ key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey }, { typing, canJump: Boolean(picked && picked.id !== current) });
    if (!act) return;
    e.preventDefault();
    e.stopPropagation();
    if (act === 'close') onClose();
    else if (act === 'find') find.current?.focus();
    else if (act === 'jump') onJump(picked.id);
    else if (act === 'zoomIn') mv.zoomIn();
    else if (act === 'zoomOut') mv.zoomOut();
    else mv.fit();
  };
  window.addEventListener('keydown', onKey, true);
  return () => window.removeEventListener('keydown', onKey, true);
}, [picked, current, onClose, onJump]); // eslint-disable-line react-hooks/exhaustive-deps
```

(`Enter` on a focused system button still picks/jumps through the button's own click, as today.)

Then find where the page closes the map on Escape (`src/pages/Galaxy.jsx`, ~406–426, per the code map) and remove that duplicate so one Escape closes it once (the map now owns it). Keep the page's M (opening) as is. `onCourse`: `useEffect(() => onCourse?.(pick && pick !== current ? pick : null), [pick, current]); // eslint-disable-line react-hooks/exhaustive-deps`.

- [ ] **Step 4: Find a system** (in the header, between the title and the close button)

```jsx
const [q, setQ] = useState('');
const matches = findSystems(q, SYSTEMS);
const go = (s) => (setQ(''), choose(s.id), mv.frame([s.pos, here.pos]));
<div className="holomap-find">
  <input ref={find} type="search" aria-label="Find a system" placeholder="Find a system  /" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); go(matches[0]); } }} />
  {matches.length > 0 && (
    <ul className="holomap-find-list" role="listbox" aria-label="Systems found">
      {matches.map((s) => (
        <li key={s.id}><button type="button" role="option" aria-selected="false" onClick={() => go(s)} style={{ '--c': s.accent }}>{s.name} <span>{s.region}</span></button></li>
      ))}
    </ul>
  )}
</div>
```

`choose(id)` when `pick !== id` sets the pick only (it doesn't jump), which is what a find should do.

- [ ] **Step 5: You, the pick, the course**

- In the name span, for the current system: `{s.id === current && <b className="holomap-youtag">YOU</b>}` before the name.
- The course gets a glow underlay and a tag at its middle:

```jsx
{route && (
  <>
    <polyline points={route.pts.map((p) => p.join(',')).join(' ')} fill="none" className="holomap-course-glow" />
    <polyline points={route.pts.map((p) => p.join(',')).join(' ')} fill="none" className="holomap-course" />
  </>
)}
```

and, in the stage (HTML, so its text is counter-scaled), at the route's middle point `const mid = route.pts[Math.floor(route.pts.length / 2)]`:

```jsx
{route && (
  <span className="holomap-course-tag" style={{ left: pct(mid[0]), top: pct(mid[1]) }}>
    {lightYears(here, picked).toLocaleString('en-US')} ly · {(jumpTime(route)).toFixed(1)} s
  </span>
)}
```

- Hover card: on each system button `onPointerEnter={() => setHover(s.id)} onPointerLeave={() => setHover(null)}` and, in the stage, when `hover && hover !== pick`, a `.holomap-hover` card at the system (counter-scaled) with its name, `systemLabel`-style holder line (`SIDES[row.owner].short`, `row.battle?.fighting ? 'Battle on' : null`) and `lightYears(here, s)` ly. Mouse only (`(hover: hover)` media guards its CSS).

- [ ] **Step 6: The panel, reordered**

With a pick away from here, the order becomes: kicker, name, meta (region · grid), the jump button (`Jump to lightspeed` with `<kbd className="hud-cap">J</kbd>`), then `<dl>` with Distance, In hyperspace, Route, then `<details className="holomap-more" open={wide}>` (`const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 761px)').matches`) holding the era/films meta, There now, Mission, `SystemWar`, Online, and the briefing link. With nothing picked: drop the two how-to paragraphs (the guide has them) and keep `WarCard`.

- [ ] **Step 7: The key, grouped**

In `WarLegend.jsx`, split `entries` into three arrays: `systems` (where you are, the dot colours, a battle on, the major order, online pilots, you fought here), `war` (held space, fought over, borders, offensives, fleets, the ring's shares, cut off from supply), `routes` (the lanes, the course). Render each under an `<h4 className="holomap-key-h">` ("Systems", "The war", "Routes"). Sizes: entries 0.78 rem, headings 0.7 rem mono uppercase.

- [ ] **Step 8: The CSS**

```css
.holomap-head { align-items: center; }
.holomap-find { position: relative; margin-left: auto; }
.holomap-find input { width: min(260px, 42vw); padding: 0.4rem 0.75rem; border: 1px solid rgb(127 214 255 / 0.35); border-radius: 999px; background: rgb(2 8 20 / 0.9); color: #fff; font-size: 0.82rem; }
.holomap-find input:focus-visible { outline: 2px solid #7fd6ff; outline-offset: 1px; }
.holomap-find-list { position: absolute; z-index: 6; top: calc(100% + 4px); left: 0; right: 0; margin: 0; padding: 0.3rem; list-style: none; border: 1px solid rgb(127 214 255 / 0.3); border-radius: 12px; background: rgb(2 6 16 / 0.97); }
.holomap-find-list button { display: flex; justify-content: space-between; gap: 0.5rem; width: 100%; padding: 0.35rem 0.5rem; border-radius: 8px; color: var(--c); font-size: 0.82rem; text-align: left; }
.holomap-find-list button span { color: rgb(217 243 255 / 0.6); font-size: 0.72rem; }
.holomap-find-list button:hover, .holomap-find-list button:focus-visible { background: rgb(127 214 255 / 0.12); }
.holomap-youtag { padding: 0 0.3rem; border-radius: 4px; background: #fff; color: #03040a; font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; }
.holomap-course { stroke-width: 0.085; }
.holomap-course-glow { fill: none; stroke: var(--accent); stroke-width: 0.32; stroke-opacity: 0.28; stroke-linejoin: round; filter: blur(0.06px); }
.holomap-course-tag { position: absolute; z-index: 2; translate: -50% -140%; scale: calc(1 / var(--k, 1)); padding: 0.15rem 0.45rem; border: 1px solid var(--accent); border-radius: 999px; background: rgb(2 6 16 / 0.9); color: #fff; font-family: var(--font-mono); font-size: 0.72rem; white-space: nowrap; pointer-events: none; }
.holomap-hover { position: absolute; z-index: 4; translate: 14px -50%; scale: calc(1 / var(--k, 1)); transform-origin: 0 50%; display: grid; gap: 0.1rem; padding: 0.4rem 0.6rem; border: 1px solid var(--c); border-radius: 10px; background: rgb(2 6 16 / 0.94); font-size: 0.74rem; white-space: nowrap; pointer-events: none; }
@media (hover: none) { .holomap-hover { display: none; } }
.holomap-more > summary { cursor: pointer; margin-top: 0.6rem; color: #7fd6ff; font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; }
.holomap-key-h { margin: 0.6rem 0 0.3rem; color: #7fd6ff; font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; }
@media (max-width: 760px) { .holomap-head { flex-wrap: wrap; } .holomap-find { order: 3; width: 100%; } .holomap-find input { width: 100%; } }
```

- [ ] **Step 9: The guide**

In `src/components/guide/pages.js`, the `/galaxy` keys gain `['M (on the map)', 'Close the galaxy map']`, `['/ (on the map)', 'Find a system']`, `['+ − 0 (on the map)', 'Zoom in, out, the whole galaxy; drag to pan']`, and the "Jumping" line ends "… The galaxy map (M) filters by era or film, and its layers switch off what you don't need."

- [ ] **Step 10: Run tests and lint**

Run: `npx vitest run src/components/galaxy src/components/guide && npx eslint src/components/galaxy src/components/guide src/pages/Galaxy.jsx`
The M-closes, find-and-J and YOU-tag behaviour in the real page is checked by Task 7's browser script.
Expected: pass.

- [ ] **Step 11: Commit**

```bash
git add -A src/components/galaxy src/components/guide src/pages/Galaxy.jsx
git commit -m "The galaxy map says where you are and where the course goes, finds a system by name, closes on M, and leads its panel with the jump" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: check the map in a browser

**Files:**
- Create: `scripts/galaxy-map-check.mjs` (a check in the style of `scripts/galaxy-powers-check.mjs`: starts nothing itself; `BASE=` the dev server, `OUT=` the shots)

- [ ] **Step 1: Write the check**

It opens `${BASE}/#/galaxy`, sets localStorage `tp-3d=on`, `tp-intro=1`, `tp-sound=off`, picks the X-wing (`text=An X-wing`), opens the map with `m`, then for each viewport (1440×900, 1280×720, 390×844):
- measures every `.holomap-name` rect and fails if any two intersect, or any is outside `.holomap-map`;
- fails if any text in `.holomap` has a computed font-size under 11.2 px (`[...document.querySelectorAll('.holomap *')].filter(el => el.childNodes[0]?.nodeType === 3 && el.checkVisibility() && parseFloat(getComputedStyle(el).fontSize) < 11.2)`), except SVG `text` (its size is checked by its rendered height `getBoundingClientRect().height >= 10`);
- screenshots the map whole, zoomed in twice over Hoth (`page.mouse.wheel` at Hoth's dot), and after a find of "Endor";
- types "endo" into the find field, presses Enter, and fails unless Endor's system button is `aria-pressed="true"` and on view; then presses `j` and fails unless `window.__galaxy().jump` is set (re-open the map first for the next check);
- fails unless a `.holomap-youtag` is visible on the current system;
- drags from one system's dot to another's (mouse down, 60 px of moves, up) with the map zoomed in and fails if the pick changed;
- presses `m` and fails if `.holomap` is still there.
It prints one line per check and exits 1 on any failure.

- [ ] **Step 2: Run it**

With a dev server (`npx vite --port 5188 --host 127.0.0.1` in the background, or the scratch harness that starts Vite in-process), Chromium at `~/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` with `--use-angle=metal --disable-gpu-vsync --disable-frame-rate-limit`:

Run: `BASE=http://127.0.0.1:5188 OUT=/tmp/map node scripts/galaxy-map-check.mjs`
Expected: every line ok; look at the shots (names apart, regions readable, toolbar clear of the strip and the key).

- [ ] **Step 3: Fix what it finds, re-run, commit**

```bash
git add scripts/galaxy-map-check.mjs
git commit -m "A browser check of the galaxy map: no names overlapping, nothing under 0.7 rem, M closes it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## PR 2: the flight HUD

### Task 8: `radar.js`

**Files:**
- Create: `src/components/galaxy/radar.js`
- Test: `src/components/galaxy/radar.test.js`

**Interfaces:**
- Produces: `RANGE = { fight: 40, cruise: 160 }`, `rangeFor(ship, hostiles)` → 40 when any hostile is within 40 units of the ship, else 160; `radarPoints(ship, contacts, range)` → `[{ id, kind, x, y, up, rim, lock }]` where `x, y ∈ [−1, 1]` (right and forward, so the canvas draws nose up as `−y`), `up` is −1/0/1 (more than 3 units below/level/above), `rim` true when beyond range (pinned to radius 1). `ship`: `{ x, y, z, heading }` (the scene's `state.ship`; `heading` in radians, forward = `[sin(heading), 0, cos(heading)]` — confirm against `universe/ship.js` `forward(heading)` and use that function rather than restating it). `contacts`: `[{ id, kind: 'hostile' | 'threat' | 'ally' | 'goal' | 'pickup', at: { x, y, z } | [x, y, z], lock? }]`.

- [ ] **Step 1: Look up the ship's forward**

Run: `grep -n "export const forward\|export function forward\|export const right" src/components/universe/ship.js src/components/universe/*.js | head`
Use the exported `forward(heading)` (it returns `[fx, fy, fz]` or `{x,z}`; read it) in `radar.js`; derive right as forward rotated −90° about up so that a contact to the ship's right plots at `x > 0`.

- [ ] **Step 2: Write the failing test** (adjust the two `heading` lines if Step 1 shows forward at heading 0 is not +z: the test must put "ahead" ahead)

```js
import { describe, expect, it } from 'vitest';
import { forward } from '../universe/ship';
import { RANGE, radarPoints, rangeFor } from './radar';

const ship = { x: 0, y: 0, z: 0, heading: 0 };
const ahead = (d) => {
  const f = forward(0);
  const [fx, , fz] = Array.isArray(f) ? f : [f.x, 0, f.z];
  return { x: fx * d, y: 0, z: fz * d };
};

describe('radar', () => {
  it('puts what is ahead at the top, on the centre line', () => {
    const [p] = radarPoints(ship, [{ id: 'a', kind: 'hostile', at: ahead(20) }], 40);
    expect(p.y).toBeCloseTo(0.5);
    expect(Math.abs(p.x)).toBeLessThan(1e-6);
    expect(p.rim).toBe(false);
  });
  it('pins what is out of range to the rim', () => {
    const [p] = radarPoints(ship, [{ id: 'a', kind: 'hostile', at: ahead(400) }], 40);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(1);
    expect(p.rim).toBe(true);
  });
  it('says above or below', () => {
    const pts = radarPoints(ship, [{ id: 'u', kind: 'ally', at: { ...ahead(10), y: 8 } }, { id: 'd', kind: 'ally', at: [0, -8, 10] }, { id: 'l', kind: 'ally', at: [0, 1, 10] }], 40);
    expect(pts.map((p) => p.up)).toEqual([1, -1, 0]);
  });
  it('turns with the ship: what was ahead is behind after half a turn', () => {
    const [p] = radarPoints({ ...ship, heading: Math.PI }, [{ id: 'a', kind: 'hostile', at: ahead(20) }], 40);
    expect(p.y).toBeCloseTo(-0.5);
  });
  it('left is left', () => {
    // a point 90° round from ahead, on the ship's right
    const f = forward(0);
    const [fx, , fz] = Array.isArray(f) ? f : [f.x, 0, f.z];
    const right = { x: -fz * 10, y: 0, z: fx * 10 };
    const [p] = radarPoints(ship, [{ id: 'r', kind: 'hostile', at: right }], 40);
    // (if this comes out negative the sign of `right` above is the ship's left: flip it there, and keep x > 0 for right)
    expect(Math.abs(p.x)).toBeCloseTo(0.25);
  });
  it('closes in when a hostile is near', () => {
    expect(rangeFor(ship, [{ at: ahead(30) }])).toBe(RANGE.fight);
    expect(rangeFor(ship, [{ at: ahead(90) }])).toBe(RANGE.cruise);
    expect(rangeFor(ship, [])).toBe(RANGE.cruise);
  });
});
```

The "left is left" case pins only the magnitude; Step 4's browser check confirms the side visually (a hostile on screen right shows on the radar's right), and the module's doc comment states the convention.

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/components/galaxy/radar.test.js`
Expected: FAIL, import not resolved.

- [ ] **Step 4: Write the module**

```js
import { forward } from '../universe/ship';

// The flight cluster's radar (FlightCluster.jsx, drawn by galaxy/scene.js):
// top-down in the ship's frame, nose up. A contact's x is to the ship's
// right and y ahead of it, both −1…1 of the range; past the range it's
// pinned to the rim, and one well above or below the ship says so (up).
// The range closes to a dogfight's when a hostile is near.

export const RANGE = { fight: 40, cruise: 160 };
const LEVEL = 3; // (units above or below that still count as level)

const xyz = (a) => (Array.isArray(a) ? a : [a.x, a.y, a.z]);
const fwd = (heading) => {
  const f = forward(heading);
  return Array.isArray(f) ? [f[0], f[2] ?? f[1]] : [f.x, f.z];
};

export function rangeFor(ship, hostiles) {
  for (const c of hostiles) {
    const [x, , z] = xyz(c.at);
    if (Math.hypot(x - ship.x, z - ship.z) <= RANGE.fight) return RANGE.fight;
  }
  return RANGE.cruise;
}

export function radarPoints(ship, contacts, range) {
  const [fx, fz] = fwd(ship.heading);
  // the ship's right, a quarter turn round from its nose
  const rx = -fz;
  const rz = fx;
  const out = [];
  for (const c of contacts) {
    const [x, y, z] = xyz(c.at);
    const dx = x - ship.x;
    const dz = z - ship.z;
    let px = (dx * rx + dz * rz) / range;
    let py = (dx * fx + dz * fz) / range;
    const d = Math.hypot(px, py);
    const rim = d > 1;
    if (rim) {
      px /= d;
      py /= d;
    }
    const dy = y - ship.y;
    out.push({ id: c.id, kind: c.kind, x: px, y: py, up: dy > LEVEL ? 1 : dy < -LEVEL ? -1 : 0, rim, lock: Boolean(c.lock) });
  }
  return out;
}
```

If the browser check (Task 10) shows left and right swapped, negate `rx, rz` and add a test that pins the sign with a contact the scene's own `toScreen` puts on screen right.

- [ ] **Step 5: Run the test, commit**

Run: `npx vitest run src/components/galaxy/radar.test.js` → PASS.

```bash
git add src/components/galaxy/radar.js src/components/galaxy/radar.test.js
git commit -m "The flight radar's rules: nose up, out of range on the rim, above and below, closing in for a dogfight (radar.js)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: the flight cluster (ship, target, powers)

**Files:**
- Create: `src/components/galaxy/FlightCluster.jsx`
- Create: `src/components/galaxy/flight.css`
- Create: `src/components/galaxy/cluster.js` (the scene's writer for the cluster: `createCluster()` → `{ place(root, view) }`; it only calls `querySelector`, `textContent`, `style.setProperty` and `toggleAttribute`, so the Node tests drive it with stand-in elements)
- Test: `src/components/galaxy/cluster.test.js`
- Modify: `src/components/galaxy/GalaxyView.jsx` (mount the cluster; the old `.universe-shield` and the standalone `PowerBar` go into it)
- Modify: `src/components/universe/PowerBar.jsx` (a `placement` prop: `'cluster'` adds `data-place="cluster"`)
- Modify: `src/components/universe/powers.css` (rules under `.ship-powers[data-place='cluster']`)
- Modify: `src/components/galaxy/powers.js` (`deny` keeps the reason for 2 s; `place` writes it)
- Modify: `src/components/galaxy/scene.js` (`placeShield` replaced by `cluster.place`; kills counted; the reticle's kill flash)
- Modify: `src/components/galaxy/galaxy.css` (`.galaxy-jumpbtn` above the cluster)

**Interfaces:**
- Consumes: the scene's `state.shield` (0–100), `state.ship.speed`, `state.keys.boost || state.boostBtn` or `state.streak > 0.3` (boosting), `state.stats.boost`, `state.lockTarget` (`{ name, kind, at, hp, hpMax }`), `SHIP.boost` from `universe/ship.js`.
- Produces: `createCluster()` → `{ place(root, v) }` where `v = { on, shield, low, speed, top, boosting, kills, lock: null | { name, dist, hp } }` (`hp` 0–1 or null for a one-hit fighter). DOM contract inside `FlightCluster`'s root (`data-on` when shown): `.fc-shield` (`--v` 0–1, `data-low`), `.fc-shield-n` (text "82%"), `.fc-speed` (`--v`, `data-boost`), `.fc-speed-n` ("SPD 46"), `.fc-kills-n` ("4"), `.fc-target` (`data-on`), `.fc-target-name`, `.fc-target-dist`, `.fc-target-hp` (`--v`, `data-on`), `.fc-radar` (a `<canvas>`, Task 10), `.fc-buffs` (Task 15). `FlightCluster({ rootRef, ship, reduced, powersRef, onPower, radarRef, buffsRef })`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { createCluster } from './cluster';

// (the tests run in Node: a stand-in for each element, with the calls cluster.js makes)
const el = () => {
  const attrs = new Set();
  const vars = new Map();
  return {
    textContent: '',
    style: { setProperty: (k, v) => vars.set(k, v), getPropertyValue: (k) => vars.get(k) ?? '' },
    toggleAttribute: (n, on) => (on ? attrs.add(n) : attrs.delete(n)),
    hasAttribute: (n) => attrs.has(n),
  };
};
const PARTS = ['.fc-shield', '.fc-shield-n', '.fc-speed', '.fc-speed-n', '.fc-kills-n', '.fc-target', '.fc-target-name', '.fc-target-dist', '.fc-target-hp'];
const dom = () => {
  const parts = Object.fromEntries(PARTS.map((s) => [s, el()]));
  return { ...el(), querySelector: (s) => parts[s] ?? null };
};
const v = (o = {}) => ({ on: true, shield: 82, low: false, speed: 6, top: 12, boosting: false, kills: 3, lock: null, ...o });

describe('flight cluster', () => {
  it('writes the ship', () => {
    const root = dom();
    createCluster().place(root, v());
    expect(root.hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.fc-shield-n').textContent).toBe('82%');
    expect(root.querySelector('.fc-shield').style.getPropertyValue('--v')).toBe('0.82');
    expect(root.querySelector('.fc-speed').style.getPropertyValue('--v')).toBe('0.5');
    expect(root.querySelector('.fc-kills-n').textContent).toBe('3');
  });
  it('writes the target, and clears it', () => {
    const root = dom();
    const c = createCluster();
    c.place(root, v({ lock: { name: 'TIE Interceptor', dist: '14', hp: 0.5 } }));
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.fc-target-name').textContent).toBe('TIE Interceptor');
    expect(root.querySelector('.fc-target-hp').hasAttribute('data-on')).toBe(true);
    c.place(root, v());
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(false);
  });
  it('hides when not flying, and writes nothing it already wrote', () => {
    const root = dom();
    const c = createCluster();
    c.place(root, v());
    const n = root.querySelector('.fc-shield-n');
    n.textContent = 'tampered';
    c.place(root, v());
    expect(n.textContent).toBe('tampered'); // (unchanged value: no write)
    c.place(root, v({ on: false }));
    expect(root.hasAttribute('data-on')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/galaxy/cluster.test.js` → FAIL.

- [ ] **Step 3: Write `cluster.js`**

```js
// The flight cluster's writer (FlightCluster.jsx's markup), called by
// galaxy/scene.js every frame: the deflectors, the speed against the
// boost's top, the kills this flight and the target, each written only
// when what it shows has changed (the HUD kit's rule: numbers through refs
// in the frame loop, never React's state).
export function createCluster() {
  let els = { root: null };
  const was = new Map();
  const put = (el, key, value, write) => {
    if (!el || was.get(key) === value) return;
    was.set(key, value);
    write(el, value);
  };
  const text = (el, s) => (el.textContent = s);
  const prop = (el, s) => el.style.setProperty('--v', s);
  const flag = (name) => (el, on) => el.toggleAttribute(name, on);
  return {
    place(root, v) {
      if (root !== els.root) {
        const q = (c) => root?.querySelector(c) ?? null;
        els = { root, shield: q('.fc-shield'), shieldN: q('.fc-shield-n'), speed: q('.fc-speed'), speedN: q('.fc-speed-n'), kills: q('.fc-kills-n'), target: q('.fc-target'), tName: q('.fc-target-name'), tDist: q('.fc-target-dist'), tHp: q('.fc-target-hp') };
        was.clear();
      }
      if (!root) return;
      put(root, 'on', Boolean(v.on), flag('data-on'));
      if (!v.on) return;
      const sh = Math.max(0, Math.min(100, v.shield));
      put(els.shield, 'sh', String(Math.round(sh) / 100), prop);
      put(els.shield, 'low', Boolean(v.low), flag('data-low'));
      put(els.shieldN, 'shn', `${Math.round(sh)}%`, text);
      const k = v.top > 0 ? Math.min(1, Math.abs(v.speed) / v.top) : 0;
      put(els.speed, 'sp', String(Math.round(k * 50) / 50), prop);
      put(els.speed, 'boost', Boolean(v.boosting), flag('data-boost'));
      put(els.speedN, 'spn', `SPD ${Math.round(Math.abs(v.speed) * 10)}`, text);
      put(els.kills, 'kills', String(v.kills), text);
      const t = v.lock;
      put(els.target, 'ton', Boolean(t), flag('data-on'));
      if (!t) return;
      put(els.tName, 'tn', t.name, text);
      put(els.tDist, 'td', t.dist, text);
      put(els.tHp, 'thon', t.hp !== null && t.hp !== undefined, flag('data-on'));
      if (t.hp !== null && t.hp !== undefined) put(els.tHp, 'thp', String(Math.round(t.hp * 50) / 50), prop);
    },
  };
}
```

- [ ] **Step 4: Run the test** → PASS.

- [ ] **Step 5: `FlightCluster.jsx`**

```jsx
import PowerBar from '../universe/PowerBar';
import './flight.css';

// The flight cluster, along the bottom while you fly (the scene writes its
// numbers: cluster.js, and the radar's canvas: radar.js): the radar; the
// ship (deflectors, speed, kills); the target (its name, how far, its
// hull); and the crew's two powers (PowerBar.jsx), with the pickups'
// effects over it. Nothing here is state: the scene writes it all.
export default function FlightCluster({ rootRef, ship, reduced, powersRef, onPower, radarRef, buffsRef }) {
  return (
    <div ref={rootRef} className="fc" aria-hidden="true">
      <div ref={buffsRef} className="fc-buffs" />
      <div className="fc-row">
        <canvas ref={radarRef} className="fc-radar" width="264" height="264" />
        <div className="fc-glass fc-ship">
          <div className="fc-line">
            <span className="fc-label">Deflectors</span>
            <b className="fc-shield-n">100%</b>
          </div>
          <span className="fc-bar fc-shield"><span /></span>
          <div className="fc-line">
            <b className="fc-speed-n">SPD 0</b>
            <span className="fc-label">
              Kills <b className="fc-kills-n">0</b>
            </span>
          </div>
          <span className="fc-bar fc-speed"><span /></span>
        </div>
        <div className="fc-glass fc-target">
          <span className="fc-label">Target</span>
          <b className="fc-target-name" />
          <span className="fc-line">
            <b className="fc-target-dist" />
            <span className="fc-keys"><kbd className="hud-cap">T</kbd> next <kbd className="hud-cap">Q</kbd> back</span>
          </span>
          <span className="fc-bar fc-target-hp"><span /></span>
          <span className="fc-none">No target · <kbd className="hud-cap">T</kbd></span>
        </div>
        <PowerBar ship={ship} reduced={reduced} barRef={powersRef} onPress={onPower} placement="cluster" />
      </div>
    </div>
  );
}
```

`PowerBar`: add `placement = null` to its props and `data-place={placement || undefined}` on its root; in each tile, add `<span className="ship-power-state" aria-hidden="true" />` after the name (the scene writes the state words there, Step 7). Its own `aria-label`s stay; the cluster's root is `aria-hidden`, so take the cluster's `aria-hidden` off the PowerBar by rendering `PowerBar` as a sibling of `.fc-row`'s other children but give the root `role="group" aria-label="Flight"` instead of `aria-hidden`, and mark the radar canvas and the glass blocks `aria-hidden="true"` one by one (the power buttons must stay reachable).

- [ ] **Step 6: `flight.css`**

```css
/* The flight cluster (FlightCluster.jsx): bottom centre of the space left of the panel. */
.fc {
  --fc-glass: rgb(3 6 14 / 0.8);
  --fc-line: rgb(127 214 255 / 0.28);
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: calc(var(--hud-pad-b, 12px) + 10px);
  translate: calc(-50% - (var(--panel-w, 0px) + 24px) / 2) 0;
  display: grid;
  justify-items: center;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  color: #e8f4ff;
  font-family: var(--font-mono);
}
.fc[data-on] { opacity: 1; }
.fc-row { display: flex; align-items: flex-end; gap: 8px; }
.fc-glass { display: grid; gap: 4px; min-width: 170px; padding: 8px 10px; border: 1px solid var(--fc-line); border-radius: 12px; background: var(--fc-glass); }
.fc-line { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.fc-label { color: rgb(217 243 255 / 0.72); font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; }
.fc b { font-size: 0.82rem; font-variant-numeric: tabular-nums; }
.fc-bar { position: relative; display: block; height: 6px; overflow: hidden; border-radius: 4px; background: rgb(255 255 255 / 0.1); }
.fc-bar > span { position: absolute; inset: 0; transform-origin: left; scale: var(--v, 0) 1; transition: scale 0.15s; }
.fc-shield > span { background: linear-gradient(90deg, #4fd2ff, #9ef3ff); box-shadow: 0 0 8px rgb(120 220 255 / 0.6); }
.fc-shield[data-low] > span { background: linear-gradient(90deg, #ff4a3d, #ff9a5c); }
@media (prefers-reduced-motion: no-preference) { .fc-shield[data-low] > span { animation: fc-blink 0.6s steps(2) infinite; } }
@keyframes fc-blink { 50% { opacity: 0.45; } }
.fc-speed > span { background: linear-gradient(90deg, #ffd36a, #fff2c4); }
.fc-speed[data-boost] > span { background: linear-gradient(90deg, #ff9a3d, #ffe08a); box-shadow: 0 0 10px rgb(255 170 60 / 0.7); }
.fc-target { min-width: 190px; }
.fc-target-name { overflow: hidden; max-width: 200px; text-overflow: ellipsis; white-space: nowrap; }
.fc-target-hp > span { background: linear-gradient(90deg, #ff5a4a, #ffb08a); }
.fc-target-hp:not([data-on]) { visibility: hidden; }
.fc-keys { color: rgb(217 243 255 / 0.72); font-size: 0.7rem; }
.fc-target:not([data-on]) > :not(.fc-none):not(.fc-label) { display: none; }
.fc-target[data-on] .fc-none { display: none; }
.fc-none { color: rgb(217 243 255 / 0.72); font-size: 0.74rem; }
.fc-radar { width: 132px; height: 132px; border: 1px solid var(--fc-line); border-radius: 50%; background: radial-gradient(circle, rgb(10 30 50 / 0.82), rgb(3 6 14 / 0.86)); }
.fc-buffs { display: flex; gap: 6px; min-height: 0; }
/* the jump button sits over the cluster now */
.galaxy-page .galaxy-jumpbtn { bottom: calc(var(--hud-pad-b, 12px) + 168px); }
@media (max-height: 700px), (max-width: 1100px) {
  .fc-glass { min-width: 140px; padding: 6px 8px; }
  .fc-radar { width: 104px; height: 104px; }
  .fc-keys { display: none; }
}
@media (pointer: coarse), (max-width: 767px) {
  .fc { left: 12px; translate: none; bottom: calc(var(--sheet-h, 0px) + 12px); justify-items: start; }
  .fc-target, .fc-speed, .fc-speed-n { display: none; }
  .fc-glass { min-width: 120px; }
  .fc-radar { width: 96px; height: 96px; }
}
```

In `powers.css`, add the cluster placement (it overrides the left-column and the short-window rules; the touch rules keep the round buttons where they are, so the cluster's touch layout leaves the tiles to them):

```css
@media (pointer: fine) {
  .ship-powers[data-place='cluster'] { position: static; top: auto; left: auto; }
  .ship-powers[data-place='cluster'] .ship-power { width: 84px; height: 64px; grid-template-rows: 24px auto auto; }
  .ship-powers[data-place='cluster'] .ship-power-name { font-size: 0.7rem; letter-spacing: 0.04em; }
  .ship-power-state { font-size: 0.7rem; font-variant-numeric: tabular-nums; color: rgb(255 255 255 / 0.85); }
  .ship-powers[data-place='cluster'] .ship-power small { display: none; }
  .ship-power[data-denied] { box-shadow: 0 0 0 2px #ff6a5c; }
}
@media (pointer: fine) and (max-height: 700px) {
  .ship-powers[data-place='cluster'] .ship-power { width: 64px; height: 52px; }
  .ship-powers[data-place='cluster'] .ship-power-name { display: none; }
}
@media (pointer: coarse) { .ship-power-state { display: none; } }
```

(the `@media (pointer: coarse)` and `(max-width: 767px)` rules for `.ship-powers` stay and win on touch, since `position: absolute` from the base rule plus their `right`/`bottom` places the tiles as now; check that `position: static` is inside `(pointer: fine)` only.)

- [ ] **Step 7: The powers' words and refusals** (`galaxy/powers.js`)

- At module top: `const STATE_WORDS = { ready: 'Ready', active: 'On', cooling: '', charging: '' };` and `const WHY_WORDS = { held: 'Held', solid: 'No room', shield: 'Shielded', empty: 'Nobody near', cooling: 'Cooling', charging: 'Charging', active: 'On', none: '' };`.
- `deny(slot, id, why)`: also `denied = { slot, why, until: performance.now() + 2000 };` (a `let denied = null;` beside `bar`).
- In `place`, after reading `bar.slots`, also read `state: q(slot)?.querySelector('.ship-power-state')`. For each slot: `const no = denied && denied.slot === slot && performance.now() < denied.until ? WHY_WORDS[denied.why] ?? '' : '';` and the words `const words = no || (x.phase === 'active' ? \`On ${x.left}s\` : x.phase === 'cooling' ? \`${x.left}s\` : x.phase === 'charging' ? \`${Math.floor(x.charge * 100)}%\` : 'Ready');`. Include `no` in `sig`; write `words` into the state span; `el.toggleAttribute('data-denied', Boolean(no))`.

- [ ] **Step 8: The scene writes the cluster** (`galaxy/scene.js`)

- `import { createCluster } from './cluster';` and `const cluster = createCluster();` near `let shieldOn = false;`.
- `state.kills = 0` in the initial `state` (next to `heat`), reset to 0 when a new ship is set (`setShip`) and on a jump's arrival in a new system: keep it per flight (reset in `setShip` only).
- In `scored`, inside `if (ship && hit.down)`: `state.kills += 1; state.killMark = 1;`. In the pilots branch of `strike`, inside `if (ph.down)`: the same two lines.
- Replace `placeShield()`'s body with the cluster's write (keep the function name so its call site stays):

```js
const placeShield = () => {
  const root = props.cluster?.current;
  if (!root) return;
  const on = flying() && !state.crash && !(state.jump && state.jump.phase !== 'align') && !props.frozen;
  const s = state.ship;
  const t = on ? state.lockTarget : null;
  cluster.place(root, {
    on,
    shield: state.shield,
    low: state.shield < 35,
    speed: s?.speed ?? 0,
    top: SHIP.boost * (state.stats.boost ?? 1),
    boosting: Boolean(state.keys.boost || state.boostBtn) && (s?.speed ?? 0) > SHIP.cruise,
    kills: state.kills,
    lock: t && { name: t.name ?? NAMES[t.kind] ?? SHIP_INFO[t.kind]?.name ?? t.kind, dist: range(apart(t.at.x, t.at.y, t.at.z, s.x, s.y, s.z)), hp: (t.hpMax ?? 1) > 1 ? t.hp / t.hpMax : null },
  });
};
```

(`range`, `apart`, `NAMES`, `SHIP_INFO` are already in scope in `scene.js`; `range` is declared after `placeShield` today, so move the `const range = …` line above `placeShield`. Confirm `SHIP` is imported from `../universe/ship`; add it to that import if not, and check `state.stats.boost` is the name `statsOf` gives the boost multiplier: `grep -n "boost" src/components/universe/outfit.js` — use whatever key it returns.)
- The reticle's kill flash: in `placeHud`, `h.reticle.toggleAttribute('data-kill', state.killMark > 0);` and in the frame step where `state.hitMark` decays, decay `state.killMark` the same way over 0.35 s (`state.killMark = Math.max(0, state.killMark - dt / 0.35)`). CSS in `flight.css`: `.universe-reticle[data-kill]::after { content: ''; position: absolute; inset: -9px; background: linear-gradient(45deg, transparent 46%, #fff 46% 54%, transparent 54%), linear-gradient(-45deg, transparent 46%, #fff 46% 54%, transparent 54%); opacity: 0.9; }` (check `.universe-reticle`'s existing `::after` in `universe.css`; if it's taken, use `::before`).

- [ ] **Step 9: Mount it** (`GalaxyView.jsx`)

- `const cluster = useRef(null); const radar = useRef(null); const buffs = useRef(null);` and add `cluster, radar, buffs` to the `props` passed to `useWorld`.
- Replace the `.universe-shield` div and the `PowerBar` line with `<FlightCluster rootRef={cluster} ship={ship} reduced={reduced} powersRef={powers} onPower={(slot) => view.current?.power?.(slot)} radarRef={radar} buffsRef={buffs} />` (drop the `shield` ref and its prop; `grep -n "props.shield" src/components/galaxy/scene.js` must be empty after Step 8).

- [ ] **Step 10: Lint, tests**

Run: `npx eslint src/components/galaxy src/components/universe/PowerBar.jsx && npx vitest run src/components/galaxy src/components/universe/shipPowers.test.js`
Expected: pass.

- [ ] **Step 11: Commit**

```bash
git add -A src/components/galaxy src/components/universe/PowerBar.jsx src/components/universe/powers.css
git commit -m "The galaxy's flight cluster: deflectors, speed, kills, the target and the crew's powers together along the bottom" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: the radar drawn

**Files:**
- Create: `src/components/galaxy/radarDraw.js` (`drawRadar(canvas, points, { range, dpr })`: 2D canvas painting only)
- Modify: `src/components/galaxy/scene.js` (gather the contacts; draw at most 20 times a second)

**Interfaces:**
- Consumes: Task 8's `radarPoints`, `rangeFor`; Task 9's `props.radar` canvas.
- Contacts: hostiles = `hunters?.targets` + `war?.targets` + `pilots.targets` (those with `threat`), each `{ id, kind: c.threat ? 'threat' : 'hostile', at: c.at, lock: c.id === state.lockTarget?.id }`; allies = `pilots.mates` + the battle's own side's fighters (`war?.battle` with `b.you.team !== null`: `b.fighters.filter((f) => f.alive && f.team === b.you.team)`, at `f.seen ?? f.pos`) + `wingmen?.targets` if it has them (`grep -n "get " src/components/universe/wingmen.js` for what it exposes; skip if none); the nav goal (the same `goal` `placeHud` computes, as `kind: 'goal'`); pickups (Task 15, `kind: 'pickup'`).

- [ ] **Step 1: `radarDraw.js`**

```js
// The radar's picture (FlightCluster.jsx's canvas): rings at a half and the
// whole range, a wedge for what's ahead, the ship in the middle, and a dot
// per contact (radar.js placed them): red for hostiles (bigger when they're
// on you), green allies, gold the way to go, cyan a pickup, the lock in a
// white ring; a tick above or below a dot for a contact over or under you;
// the range in the corner.
const INK = { hostile: '#ff5a4a', threat: '#ff3b2f', ally: '#6dff9a', goal: '#ffd36a', pickup: '#6fe7ff' };

export function drawRadar(canvas, points, { range, dpr = 1 } = {}) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const size = canvas.clientWidth || 132;
  const px = Math.round(size * dpr);
  if (canvas.width !== px) (canvas.width = px), (canvas.height = px);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);
  const c = size / 2;
  const r = c - 6;
  g.strokeStyle = 'rgba(127,214,255,0.28)';
  g.lineWidth = 1;
  for (const k of [0.5, 1]) (g.beginPath(), g.arc(c, c, r * k, 0, Math.PI * 2), g.stroke());
  g.fillStyle = 'rgba(127,214,255,0.08)';
  g.beginPath();
  g.moveTo(c, c);
  g.arc(c, c, r, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
  g.closePath();
  g.fill();
  g.fillStyle = '#e8f4ff';
  g.beginPath();
  g.moveTo(c, c - 5);
  g.lineTo(c - 3.5, c + 4);
  g.lineTo(c + 3.5, c + 4);
  g.closePath();
  g.fill();
  for (const p of points) {
    const x = c + p.x * r;
    const y = c - p.y * r;
    const big = p.kind === 'threat' ? 3.6 : 2.6;
    g.fillStyle = INK[p.kind] ?? '#fff';
    g.globalAlpha = p.rim ? 0.6 : 1;
    g.beginPath();
    g.arc(x, y, big, 0, Math.PI * 2);
    g.fill();
    if (p.up) (g.fillRect(x - 0.75, p.up > 0 ? y - big - 5 : y + big, 1.5, 5));
    if (p.lock) {
      g.globalAlpha = 1;
      g.strokeStyle = '#fff';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(x, y, big + 3.5, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(217,243,255,0.8)';
  g.font = `600 11px ${getComputedStyle(canvas).fontFamily || 'monospace'}`;
  g.textAlign = 'right';
  g.fillText(String(range), size - 8, size - 8);
}
```

- [ ] **Step 2: The scene's gathering and drawing**

Beside `placeShield` (now the cluster's), add:

```js
const contacts = [];
let radarAt = 0;
const placeRadar = () => {
  const cv = props.radar?.current;
  if (!cv || !flying() || state.crash || props.frozen || (state.jump && state.jump.phase !== 'align')) return;
  if (state.clock - radarAt < 0.05) return;
  radarAt = state.clock;
  const s = state.ship;
  const lockId = state.lockTarget?.id;
  contacts.length = 0;
  const hostile = (c) => contacts.push({ id: c.id, kind: c.threat ? 'threat' : 'hostile', at: c.at, lock: c.id === lockId });
  for (const c of hunters?.targets ?? NO_TARGETS) hostile(c);
  for (const c of war?.targets ?? NO_TARGETS) hostile(c);
  if (pilots.count) {
    for (const c of pilots.targets) if (c.threat) hostile(c);
    for (const c of pilots.mates) contacts.push({ id: c.id, kind: 'ally', at: c.at });
  }
  const b = war?.battle;
  if (b && b.you?.team !== null && !b.over) for (const f of b.fighters) if (f.alive && f.team === b.you.team) contacts.push({ id: f.id, kind: 'ally', at: f.seen ?? f.pos });
  if (state.navGoal) contacts.push({ id: 'nav', kind: 'goal', at: state.navGoal });
  const range = rangeFor(s, contacts.filter((c) => c.kind === 'hostile' || c.kind === 'threat'));
  drawRadar(cv, radarPoints(s, contacts, range), { range, dpr: Math.min(2, window.devicePixelRatio || 1) });
};
```

In `placeHud`, after `goal` is computed: `state.navGoal = goal ? goal.at : null;`. Call `placeRadar()` right after `placeShield()` in the frame step. Imports: `import { radarPoints, rangeFor } from './radar'; import { drawRadar } from './radarDraw';`. If `f.pos`/`f.seen` are objects `{x,y,z}` or arrays, `radarPoints`'s `xyz` handles both.

- [ ] **Step 3: Lint, tests, commit**

Run: `npx eslint src/components/galaxy && npx vitest run src/components/galaxy` → pass.

```bash
git add -A src/components/galaxy
git commit -m "The flight cluster's radar: the fight round you nose up, allies, the way to go and the lock" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: travel by a plotted course; the key help card

**Files:**
- Modify: `src/pages/Galaxy.jsx` (`course` state; `onCourse` to `HoloMap`; `course` prop to `GalaxyView`; `jumpKey` with a course jumps)
- Modify: `src/components/galaxy/GalaxyView.jsx` (pass `course` to the scene; the key card)
- Modify: `src/components/galaxy/scene.js` (the nav goal for the course)
- Create: `src/components/galaxy/KeysCard.jsx`
- Modify: `src/components/galaxy/flight.css`
- Test: `src/components/galaxy/KeysCard.test.jsx` (Node: `renderToStaticMarkup`, as `WarHud.test.jsx` does)

**Interfaces:**
- Consumes: Task 6's `onCourse`.
- Produces: `GalaxyView` prop `course` (a system id or null) → scene `props.course`; `KeysCard({ open, onClose })`.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import KeysCard from './KeysCard';

describe('KeysCard', () => {
  it('lists the keys in three groups, with a close button', () => {
    const html = renderToStaticMarkup(<KeysCard open onClose={() => {}} />);
    for (const h of ['Fly', 'Fight', 'Travel']) expect(html).toContain(`<h3>${h}</h3>`);
    expect(html).toContain('<kbd class="hud-cap">J</kbd>');
    expect(html).toContain('aria-label="Close the keys"');
  });
  it('is nothing when shut', () => {
    expect(renderToStaticMarkup(<KeysCard open={false} onClose={() => {}} />)).toBe('');
  });
});
```

- [ ] **Step 2: Run it to see it fail** → FAIL.

- [ ] **Step 3: `KeysCard.jsx`**

```jsx
import { RiCloseLine } from 'react-icons/ri';

// The galaxy's flying keys in one small card (the guide, pages.js, has
// them all in words): until you first fly, and again from the Keys chip.
const GROUPS = [
  ['Fly', [['W S', 'Throttle'], ['A D', 'Roll'], ['Arrows', 'Steer'], ['Space', 'Boost'], ['V', 'Cockpit']]],
  ['Fight', [['F', 'Fire (hold)'], ['T Q', 'Next, last target'], ['G', 'Crew power'], ['X', 'The big one']]],
  ['Travel', [['J', 'Jump to the star ahead, or the course'], ['M', 'Galaxy map'], ['E', 'Land'], ['H', 'Hangar']]],
];

export default function KeysCard({ open, onClose }) {
  if (!open) return null;
  return (
    <section className="galaxy-keys" aria-label="Flying keys">
      <button type="button" className="galaxy-keys-close" onClick={onClose} aria-label="Close the keys">
        <RiCloseLine aria-hidden="true" />
      </button>
      {GROUPS.map(([name, rows]) => (
        <div key={name} className="galaxy-keys-group">
          <h3>{name}</h3>
          <dl>
            {rows.map(([keys, what]) => (
              <div key={keys}>
                <dt>{keys.split(' ').map((k) => <kbd key={k} className="hud-cap">{k}</kbd>)}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
```

(`H` is listed now and wired in Task 16; if Task 16 slips, drop that row.)

- [ ] **Step 4: Run the test** → PASS.

- [ ] **Step 5: Wire the card** (`GalaxyView.jsx`): `const [keysOpen, setKeysOpen] = useState(false);` Replace the `{!flown && <p className="universe-hint">…</p>}` block: on desktop (`(pointer: fine)`), `<KeysCard open={!flown || keysOpen} onClose={() => (setFlown(true), setKeysOpen(false))} />`; keep the `universe-hint-touch` line for touch as it is (render the old `<p>` with only its touch span, under `{!flown && …}`). Add a chip beside the map button: `<button type="button" className="galaxy-keysbtn" onClick={() => setKeysOpen((o) => !o)} aria-expanded={keysOpen}>Keys</button>`. CSS in `flight.css`:

```css
.galaxy-keys { position: absolute; z-index: 3; left: 50%; bottom: calc(var(--hud-pad-b, 12px) + 190px); translate: calc(-50% - (var(--panel-w, 0px) + 24px) / 2) 0; display: grid; grid-template-columns: repeat(3, auto); gap: 18px; padding: 12px 40px 12px 16px; border: 1px solid rgb(127 214 255 / 0.3); border-radius: 14px; background: rgb(3 6 14 / 0.88); color: #e8f4ff; pointer-events: auto; }
.galaxy-keys h3 { margin: 0 0 6px; color: #7fd6ff; font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; }
.galaxy-keys dl { display: grid; gap: 4px; margin: 0; }
.galaxy-keys dl > div { display: flex; align-items: center; gap: 8px; }
.galaxy-keys dt { display: flex; gap: 3px; min-width: 64px; }
.galaxy-keys dd { margin: 0; font-size: 0.78rem; }
.galaxy-keys-close { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; color: #bfeaff; }
.galaxy-keysbtn { position: absolute; z-index: 1; left: 142px; top: calc(var(--nav-h) + 16px); padding: 0.45rem 0.8rem; border: 1px solid rgb(127 214 255 / 0.45); border-radius: 999px; background: rgb(3 8 20 / 0.7); color: #bfeaff; font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
@media (pointer: coarse), (max-width: 767px) { .galaxy-keys, .galaxy-keysbtn { display: none; } }
```

(measure `.galaxy-mapbtn`'s right edge in the browser and set `.galaxy-keysbtn`'s `left` to it + 8 px.)

- [ ] **Step 6: The course** (`pages/Galaxy.jsx`)

- `const [course, setCourse] = useState(null);` passed to `<HoloMap … onCourse={setCourse} />` and `<GalaxyView … course={course} />`. Clear it when a jump starts (`jumpTo`) or the system changes (`useEffect(() => setCourse(null), [current])`).
- Where the page handles the scene's `jumpKey` event (it opens the map today: `grep -n "jumpKey" src/pages/Galaxy.jsx`), jump instead when a course is set: `if (course && course !== current) { jumpTo(course); return; }` before opening the map.
- In `GalaxyView.jsx`, add `course` to the `useWorld` props.
- In `scene.js` `placeHud`, after the `state.auto` branch: `else if (on && props.course && props.course !== state.sys?.id) { const to = systemById(props.course); if (to) { const d = dirTo(state.sys, to); goal = { at: [s.x + d[0] * 2000, s.y + d[1] * 2000, s.z + d[2] * 2000], name: \`Course: ${to.name} · J\`, dist: \`${lightYears(state.sys, to).toLocaleString('en-US')} ly\`, reach: 0, way: true }; } }` — use the same direction the jump uses: find it with `grep -n "dir:" src/components/galaxy/scene.js | head` in `startJump` (the jump's `dir` toward a system's star) and call that helper (or the star's sky position the `.galaxy-star` labels use) rather than writing a new one; `systemById` and `lightYears` are already imported there (check).

- [ ] **Step 7: Lint, tests, commit**

Run: `npx eslint src/components/galaxy src/pages/Galaxy.jsx && npx vitest run src/components/galaxy` → pass.

```bash
git add -A src/components/galaxy src/pages/Galaxy.jsx
git commit -m "A course plotted on the galaxy map stays on the HUD and J jumps to it; the flying keys in one card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: check the flight HUD in a browser

**Files:**
- Modify: `scripts/galaxy-powers-check.mjs` (its `layout` scenario: the tiles now live in the cluster; update the selectors and keep its "meets nothing else, takes its clicks" assertions)
- Create: `scripts/galaxy-hud-check.mjs`

- [ ] **Step 1: Write the check** — at 1440×900, 1280×720, 1366×657 and 390×844: open `#/galaxy`, pick the X-wing, fly 2 s (`w` held), force a battle (`window.__galaxyDebug.war.force('empire', 'skirmish')` — read `warfront.js:671` for the real arguments), wait 4 s, then:
  - fail if `.fc` isn't `data-on`, or any two of `.fc-radar`, `.fc-ship`, `.fc-target`, `.ship-powers`, `.galaxy-jumpbtn`, `.galaxy-mapbtn`, `.galaxy-keysbtn`, `.universe-settings-btn`, the touch buttons (`.universe-fire`, `.universe-boost`, `.universe-view`, `.universe-climbs`) that are visible intersect;
  - fail if any visible text in `.fc` is under 11.2 px;
  - screenshot (`OUT/hud-<w>x<h>.png`);
  - lock a target (`t`), read `.fc-target-name` (non-empty);
  - press `m`, plot Endor in the map, press `m` again: `.universe-nav` is `data-on` and its name starts "Course: Endor"; press `j`: `window.__galaxy().jump` is set.
- [ ] **Step 2: Run** `BASE=… OUT=/tmp/hud node scripts/galaxy-hud-check.mjs` and `node scripts/galaxy-powers-check.mjs layout`; fix and re-run until clean; look at every shot.
- [ ] **Step 3: Commit**

```bash
git add scripts/galaxy-hud-check.mjs scripts/galaxy-powers-check.mjs
git commit -m "A browser check of the galaxy's flight HUD: nothing overlapping at four window sizes, the target, the course" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## PR 3: pickups and the hangar

### Task 13: `pickups.js`, the rules

**Files:**
- Create: `src/components/galaxy/pickups.js`
- Test: `src/components/galaxy/pickups.test.js`
- Modify: `src/components/universe/shipPowers.js` (`CHARGE.pickup = 0.25`; `hasten(st, seconds)`)
- Modify: `src/components/universe/shipPowers.test.js` (a test for each)

**Interfaces:**
- Produces: `PICKUPS` (the table below), `PICKUP_RULES = { chance: 0.35, max: 4, life: 25, blink: 5, take: 4, pull: 14, pullSpeed: 9 }`, `createPickups({ rand = Math.random } = {})` → `{ drop(at, { kind, ace, capital, shield }), give(kind), step(dt, ship, { live }) → taken[], mods(), absorb(damage) → left, clear(), list, buffs() }`.
  - `drop(at, why)`: `at` `{x,y,z}`; drops with `chance` (always for `ace` or `capital`); none when `max` are out; the kind weighted (`repair` ×3 when `why.shield < 50`); returns the pickup or null.
  - `step(dt, ship, { live })`: ages them (gone at `life`), pulls those within `pull` toward the ship at `pullSpeed` u/s, takes those within `take` (only when `live`), ages the effects; returns what was taken this step as `[{ id, kind }]`.
  - `mods()` → `{ boost: 1 | 1.35, accel: 1 | 1.35, delay: 1 | 0.6, bubble: n }`.
  - `absorb(damage)` → the damage left after the bubble.
  - `clear()`: every pickup and effect gone (a jump, a landing, a crash).
  - `list`: the live pickups `[{ id, kind, at: {x,y,z}, age, life }]` (for the drawing and the radar).
  - `buffs()` → `[{ kind, name, left, of }]` for the HUD (timed effects only, plus the bubble's points as `left` with `of: 60`).
- `shipPowers.js`: `hasten(st, seconds)` takes `seconds` off the primary's cooldown (to 0 → ready, returning true when it came ready).

| kind | name | effect |
| --- | --- | --- |
| `repair` | Repair kit | `heal: 40` (the scene adds it to `state.shield`, to 100) |
| `overcharge` | Overcharge | boost and accel ×1.35 for 12 s |
| `rapid` | Rapid fire | guns' delay ×0.6 for 12 s |
| `bubble` | Bubble shield | absorbs 60 damage, 15 s |
| `charge` | Power cell | `charge: true` (the scene: `powers.pickup()`) |

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { PICKUP_RULES, createPickups } from './pickups';

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const ship = (x = 0) => ({ x, y: 0, z: 0 });

describe('pickups', () => {
  it('drops about a third of the time, always for an ace', () => {
    const p = createPickups({ rand: seeded() });
    let n = 0;
    for (let i = 0; i < 400; i++) {
      if (p.drop({ x: 1000, y: 0, z: 0 }, { shield: 100 })) n++;
      p.clear();
    }
    expect(n / 400).toBeGreaterThan(0.25);
    expect(n / 400).toBeLessThan(0.45);
    expect(p.drop({ x: 0, y: 0, z: 50 }, { ace: true, shield: 100 })).not.toBeNull();
  });
  it('keeps at most four out', () => {
    const p = createPickups({ rand: () => 0 });
    for (let i = 0; i < 9; i++) p.drop({ x: 100 + i, y: 0, z: 0 }, { ace: true, shield: 100 });
    expect(p.list.length).toBe(PICKUP_RULES.max);
  });
  it('weights repairs up when the deflectors are low', () => {
    const count = (shield) => {
      const p = createPickups({ rand: seeded(11) });
      let r = 0;
      for (let i = 0; i < 300; i++) {
        const d = p.drop({ x: 500, y: 0, z: 0 }, { ace: true, shield });
        if (d?.kind === 'repair') r++;
        p.clear();
      }
      return r;
    };
    expect(count(20)).toBeGreaterThan(count(100) * 2);
  });
  it('is taken when flown through, and only while live', () => {
    const p = createPickups({ rand: () => 0 });
    p.drop({ x: 2, y: 0, z: 0 }, { ace: true, shield: 100 });
    expect(p.step(0.016, ship(), { live: false })).toEqual([]);
    const got = p.step(0.016, ship(), { live: true });
    expect(got.length).toBe(1);
    expect(p.list.length).toBe(0);
  });
  it('drifts toward the ship within reach, and expires', () => {
    const p = createPickups({ rand: () => 0 });
    p.drop({ x: 10, y: 0, z: 0 }, { ace: true, shield: 100 });
    p.step(0.5, ship(), { live: true });
    expect(p.list[0]?.at.x ?? 0).toBeLessThan(10);
    const q = createPickups({ rand: () => 0 });
    q.drop({ x: 500, y: 0, z: 0 }, { ace: true, shield: 100 });
    q.step(PICKUP_RULES.life + 0.1, ship(), { live: true });
    expect(q.list.length).toBe(0);
  });
  it('gives timed effects their mods, stacking to twice at most', () => {
    const p = createPickups({ rand: () => 0 });
    p.give('rapid');
    expect(p.mods().delay).toBeCloseTo(0.6);
    p.give('rapid');
    p.give('rapid');
    expect(p.buffs().find((b) => b.kind === 'rapid').left).toBeLessThanOrEqual(24);
    p.step(25, ship(), { live: true });
    expect(p.mods().delay).toBe(1);
  });
  it('the bubble takes damage first', () => {
    const p = createPickups({ rand: () => 0 });
    p.give('bubble');
    expect(p.absorb(25)).toBe(0);
    expect(p.absorb(50)).toBe(15);
    expect(p.absorb(10)).toBe(10);
  });
  it('clears on a jump', () => {
    const p = createPickups({ rand: () => 0 });
    p.drop({ x: 50, y: 0, z: 0 }, { ace: true, shield: 100 });
    p.give('overcharge');
    p.clear();
    expect(p.list.length).toBe(0);
    expect(p.mods().boost).toBe(1);
  });
});
```

Add `give(kind)` to the interface (applies a kind's effect without a pickup: what `step` calls on a take; the tests use it). For `repair` and `charge`, `give` returns `{ heal: 40 }` / `{ charge: true }` and records nothing timed; `step`'s taken entries carry that return as `{ id, kind, ...result }`.

In `shipPowers.test.js`:

```js
it('a pickup charges the big one a quarter, and hastens the cooldown', () => {
  const st = initial('xwing'); // (the test file's existing helper for a fresh state: use its name)
  gain(st, 'pickup');
  expect(st.ultimate.charge).toBeCloseTo(0.25);
  st.primary.phase = 'cooling';
  st.primary.left = 4;
  expect(hasten(st, 5)).toBe(true);
  expect(st.primary.phase).toBe('ready');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/galaxy/pickups.test.js src/components/universe/shipPowers.test.js` → FAIL.

- [ ] **Step 3: `shipPowers.js`**

Add `pickup: 0.25` to `CHARGE`, and after `gain`:

```js
// a power cell picked up in flight (galaxy/pickups.js): the cooldown on G
// cut by `seconds`; true when that made it ready
export function hasten(st, seconds) {
  const s = st?.primary;
  if (!s || s.phase !== 'cooling') return false;
  s.left = Math.max(0, s.left - seconds);
  if (s.left > 0) return false;
  s.phase = 'ready';
  return true;
}
```

- [ ] **Step 4: `pickups.js`**

```js
// Pickups in flight (the galaxy's): a hostile fighter you shoot down drops
// one now and then (an ace or a capital ship always), floating where it
// went up for PICKUP_RULES.life seconds; fly within `take` and it's yours,
// within `pull` and it drifts to you. Each kind does one thing (PICKUPS):
// deflectors back, a faster boost, faster guns, a bubble that takes the
// next hits, or a power cell. The same effect again runs on longer, to
// twice its time at most. Nothing here goes online; a jump, a landing or a
// crash clears them all (clear). The drawing is pickupFx.js; the models
// are Quaternius's Ultimate Space Kit's (CC0).

export const PICKUP_RULES = { chance: 0.35, max: 4, life: 25, blink: 5, take: 4, pull: 14, pullSpeed: 9 };

export const PICKUPS = {
  repair: { name: 'Repair kit', line: '+40 deflectors', weight: 1, heal: 40 },
  overcharge: { name: 'Overcharge', line: 'boost ×1.35 for 12 s', weight: 1, dur: 12, mods: { boost: 1.35, accel: 1.35 } },
  rapid: { name: 'Rapid fire', line: 'guns faster for 12 s', weight: 1, dur: 12, mods: { delay: 0.6 } },
  bubble: { name: 'Bubble shield', line: 'takes the next 60 damage', weight: 1, dur: 15, bubble: 60 },
  charge: { name: 'Power cell', line: 'the big one +25%', weight: 1, charge: true },
};
const KINDS = Object.keys(PICKUPS);
const NONE = Object.freeze({ boost: 1, accel: 1, delay: 1, bubble: 0 });

const xyz = (a) => (Array.isArray(a) ? { x: a[0], y: a[1], z: a[2] } : { x: a.x, y: a.y, z: a.z });

export function createPickups({ rand = Math.random } = {}) {
  let list = [];
  let next = 1;
  const effects = new Map(); // kind → { left, of, points? }

  const pick = (shield) => {
    const w = KINDS.map((k) => PICKUPS[k].weight * (k === 'repair' && shield < 50 ? 3 : 1));
    let r = rand() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < KINDS.length; i++) if ((r -= w[i]) < 0) return KINDS[i];
    return KINDS[KINDS.length - 1];
  };

  const give = (kind) => {
    const p = PICKUPS[kind];
    if (!p) return {};
    if (p.heal) return { heal: p.heal };
    if (p.charge) return { charge: true };
    const e = effects.get(kind);
    if (e) {
      e.left = Math.min(p.dur * 2, e.left + p.dur);
      if (p.bubble) e.points = Math.min(p.bubble * 2, e.points + p.bubble);
    } else effects.set(kind, { left: p.dur, of: p.dur, ...(p.bubble ? { points: p.bubble } : {}) });
    return {};
  };

  return {
    get list() {
      return list;
    },
    drop(at, why = {}) {
      if (list.length >= PICKUP_RULES.max) return null;
      if (!why.ace && !why.capital && rand() >= PICKUP_RULES.chance) return null;
      const kind = why.kind && PICKUPS[why.kind] ? why.kind : pick(why.shield ?? 100);
      const p = { id: next++, kind, at: xyz(at), age: 0, life: PICKUP_RULES.life };
      list.push(p);
      return p;
    },
    give,
    step(dt, ship, { live = true } = {}) {
      const taken = [];
      for (const [kind, e] of effects) {
        e.left -= dt;
        if (e.left <= 0 || (PICKUPS[kind].bubble && e.points <= 0)) effects.delete(kind);
      }
      list = list.filter((p) => {
        p.age += dt;
        if (p.age >= p.life) return false;
        const dx = ship.x - p.at.x;
        const dy = ship.y - p.at.y;
        const dz = ship.z - p.at.z;
        const d = Math.hypot(dx, dy, dz);
        if (live && d <= PICKUP_RULES.take) {
          taken.push({ id: p.id, kind: p.kind, ...give(p.kind) });
          return false;
        }
        if (live && d <= PICKUP_RULES.pull && d > 0) {
          const m = Math.min(d, PICKUP_RULES.pullSpeed * dt) / d;
          p.at.x += dx * m;
          p.at.y += dy * m;
          p.at.z += dz * m;
        }
        return true;
      });
      return taken;
    },
    mods() {
      if (!effects.size) return NONE;
      const m = { ...NONE };
      for (const [kind, e] of effects) {
        const p = PICKUPS[kind];
        if (p.mods) for (const [k, v] of Object.entries(p.mods)) m[k] *= v;
        if (p.bubble) m.bubble = e.points;
      }
      return m;
    },
    absorb(damage) {
      const e = effects.get('bubble');
      if (!e || e.points <= 0) return damage;
      const took = Math.min(e.points, damage);
      e.points -= took;
      if (e.points <= 0) effects.delete('bubble');
      return damage - took;
    },
    buffs() {
      return [...effects].map(([kind, e]) => ({ kind, name: PICKUPS[kind].name, left: Math.max(0, e.left), of: e.of, points: e.points ?? null }));
    },
    clear() {
      list = [];
      effects.clear();
    },
  };
}
```

The test "stacking to twice at most" asserts `left ≤ 24` for `rapid` (dur 12): `Math.min(24, …)` holds it.

- [ ] **Step 5: Run the tests** → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/galaxy/pickups.js src/components/galaxy/pickups.test.js src/components/universe/shipPowers.js src/components/universe/shipPowers.test.js
git commit -m "Pickups' rules for the galaxy: dropped by kills, taken by flying through, five kinds; a power cell charges and hastens the crew's powers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: the pickups' model

**Files:**
- Create: `scripts/galaxy-pickups.mjs`
- Create: `public/models/galaxy/pickups.glb`
- Modify: `src/components/galaxy/pack.js` (`'/models/galaxy/pickups.glb'` in `urls`)
- Modify: `CREDITS.md` (Quaternius, Ultimate Space Kit, CC0, the five pickups)
- Modify: `src/data/modelCredits.json` if the site's credits page lists model sources there (check `grep -n "quaternius" -i src/data/modelCredits.json CREDITS.md`; follow whichever pattern the existing Quaternius entries use)

**Interfaces:**
- Produces: one GLB with five top-level nodes named `repair`, `overcharge`, `rapid`, `bubble`, `charge`, each centred on its origin and scaled to fit a 1-unit cube; shared atlas texture (`Atlas.png`) or flat colours as the source has them.

- [ ] **Step 1: Get the sources out of the assets repo without touching its working tree**

The local clone is `$TMPDIR/tilakverse-assets` (some files there are deleted from the working tree; the objects are intact). Extract into the session's scratch folder (a new empty directory):

```bash
SRC=$TMPDIR/tilakverse-assets; OUTD=/private/tmp/claude-501/-Users-tilakpatel-Desktop-new-portfolio-website--claude-worktrees-star-wars-map-vehicle-ui-f15b83/6079577d-253e-4fcb-a33e-fb75c30a48dd/scratchpad/pickups-src; mkdir -p $OUTD
for f in Health Thunder Bullets Sphere Crate; do git -C $SRC show HEAD:quaternius/ultimate-space-kit/Items/GLTF/Pickup_$f.gltf > $OUTD/Pickup_$f.gltf; done
git -C $SRC show HEAD:quaternius/ultimate-space-kit/Items/Blends/Atlas.png > $OUTD/Atlas.png
grep -o '"uri":"[^"]*"' $OUTD/*.gltf | sort -u
```

The `.gltf`s may embed their buffers as data URIs (then nothing else is needed) or reference `.bin`/`.png` files: extract each referenced file the same way from its path in the repo (`git -C $SRC ls-files quaternius/ultimate-space-kit/Items`). If the clone is missing, `git clone --filter=blob:none --sparse https://github.com/tilakpatell/tilakverse-assets.git` into the scratch folder and `git sparse-checkout set quaternius/ultimate-space-kit/Items`.

- [ ] **Step 2: `scripts/galaxy-pickups.mjs`**

```js
// Packs the galaxy's five pickups (galaxy/pickups.js) into one GLB from
// Quaternius's Ultimate Space Kit (CC0, tilakverse-assets'
// quaternius/ultimate-space-kit/Items/GLTF): a node per kind, each centred
// and fitted to a unit cube, deduplicated and meshopt-compressed.
//   node scripts/galaxy-pickups.mjs <folder with Pickup_*.gltf> public/models/galaxy/pickups.glb
import { Document, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, meshopt, prune, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error('usage: node scripts/galaxy-pickups.mjs <folder with Pickup_*.gltf> <out.glb>');
const KINDS = { repair: 'Health', overcharge: 'Thunder', rapid: 'Bullets', bubble: 'Sphere', charge: 'Crate' };
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const doc = new Document();
const main = doc.createScene('pickups');
doc.getRoot().setDefaultScene(main);
for (const [kind, name] of Object.entries(KINDS)) {
  const src = await io.read(join(dir, `Pickup_${name}.gltf`));
  const srcScene = src.getRoot().getDefaultScene() ?? src.getRoot().listScenes()[0];
  const map = mergeDocuments(doc, src);
  const scene = map.get(srcScene);
  // (each kind under a node named for it, centred on its origin and fitted to a unit cube)
  const fit = doc.createNode(`${kind}-fit`);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    fit.addChild(child);
  }
  scene.dispose();
  const { min, max } = getBounds(fit);
  const side = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const s = 1 / side;
  fit.setScale([s, s, s]);
  fit.setTranslation([(-(min[0] + max[0]) / 2) * s, (-(min[1] + max[1]) / 2) * s, (-(min[2] + max[2]) / 2) * s]);
  const holder = doc.createNode(kind).addChild(fit);
  main.addChild(holder);
}
await doc.transform(unpartition(), dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder }));
await io.write(out, doc);
for (const node of main.listChildren()) {
  let tris = 0;
  node.traverse((n) => {
    for (const p of n.getMesh()?.listPrimitives() ?? []) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  });
  console.log(`${node.getName()}: ${Math.round(tris)} triangles`);
}
console.log(`${out}: ${(statSync(out).size / 1024).toFixed(1)} KB`);
```

If `mergeDocuments` leaves the merged scene's root nodes elsewhere than `scene.listChildren()` in this version, read `node_modules/@gltf-transform/functions/dist/index.d.ts` around `mergeDocuments` and follow its doc comment. The site's loader (`src/lib/three/gltf.js`) always registers the meshopt decoder, so a meshopt GLB loads.

- [ ] **Step 3: Run it**

Run: `node scripts/galaxy-pickups.mjs /private/tmp/claude-501/-Users-tilakpatel-Desktop-new-portfolio-website--claude-worktrees-star-wars-map-vehicle-ui-f15b83/6079577d-253e-4fcb-a33e-fb75c30a48dd/scratchpad/pickups-src public/models/galaxy/pickups.glb`
Expected: five nodes listed, the file under 200 KB.

- [ ] **Step 4: Pack and credits**

Add `'/models/galaxy/pickups.glb'` to `PACK.urls` in `src/components/galaxy/pack.js`; add the credit line next to the other Quaternius credits. Run `node scripts/pack-check.mjs` if it runs standalone (read its header), or leave it to `npm run build` in Task 17.

- [ ] **Step 5: Commit**

```bash
git add scripts/galaxy-pickups.mjs public/models/galaxy/pickups.glb src/components/galaxy/pack.js CREDITS.md src/data/modelCredits.json
git commit -m "The galaxy's pickups' model: Quaternius's Ultimate Space Kit pickups (CC0) packed into one GLB" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: pickups in the scene

**Files:**
- Create: `src/components/galaxy/pickupFx.js`
- Modify: `src/components/galaxy/scene.js` (create, drop, step, apply, clear, draw, radar)
- Modify: `src/components/galaxy/powers.js` (`pickup()`)
- Modify: `src/components/galaxy/cluster.js` + `flight.css` (the buff chips)
- Test: `src/components/galaxy/cluster.test.js` (the chips)

**Interfaces:**
- Consumes: Task 13's `createPickups`, `PICKUPS`; Task 14's GLB; Task 9's `cluster`, `props.buffs`.
- Produces: `createPickupFx(scene, { load, reduced })` → `{ sync(list, t), dispose() }` (one instanced-or-cloned mesh per live pickup, hidden while none; spins 1.2 rad/s and bobs 0.15 u at 1.4 Hz unless reduced; blinks its last `blink` seconds at 4 Hz unless reduced; a soft additive glow sprite in its kind's colour); `powers.pickup()` → `gain('pickup')` and `hasten(st, 5)`, saying `ready` when either made a power ready; `cluster.buffs(root, buffs)` writes `.fc-buffs` children.

- [ ] **Step 1: Chips test** (append to `cluster.test.js`; Node, so the chips' words are a pure function and the DOM writer is checked in Task 17's browser run)

```js
import { buffChips } from './cluster';

it('says each effect as a chip: its share left and its time', () => {
  expect(buffChips([{ kind: 'rapid', name: 'Rapid fire', left: 6, of: 12, points: null }])).toEqual([{ kind: 'rapid', name: 'Rapid fire', v: '0.5', text: '6s' }]);
  expect(buffChips([{ kind: 'bubble', name: 'Bubble shield', left: 3.2, of: 15, points: 41 }])[0].text).toBe('41');
  expect(buffChips([])).toEqual([]);
});
```

Implement in `cluster.js`: `export const buffChips = (list) => list.map((b) => ({ kind: b.kind, name: b.name, v: String(Math.round((b.left / b.of) * 50) / 50), text: b.points !== null && b.points !== undefined ? String(Math.ceil(b.points)) : `${Math.ceil(b.left)}s` }));` and, on the object `createCluster()` returns, `buffs(root, list)`: for `buffChips(list)`, keep a `Map` kind → element made with `root.ownerDocument.createElement('span')` (class `fc-buff`, `data-kind`, a `<b>` with the name and an `<i>` with the text), remove the ones no longer listed, and write `--v` and the `<i>`'s text only when they change; return at once when `root` is null.

CSS in `flight.css`:

```css
.fc-buff { --c: #6fe7ff; position: relative; display: inline-flex; align-items: baseline; gap: 6px; padding: 4px 9px 6px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--c) 60%, transparent); border-radius: 999px; background: rgb(3 6 14 / 0.82); font-size: 0.72rem; }
.fc-buff::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--c); transform-origin: left; scale: var(--v, 1) 1; }
.fc-buff i { font-style: normal; opacity: 0.8; font-variant-numeric: tabular-nums; }
.fc-buff[data-kind='overcharge'] { --c: #ffb347; }
.fc-buff[data-kind='rapid'] { --c: #ff6a5c; }
.fc-buff[data-kind='bubble'] { --c: #7fd6ff; }
```

- [ ] **Step 2: `pickupFx.js`**

Load the GLB through the galaxy's own model loader (read `src/components/galaxy/models.js` for its `load(url)`-style function and use it exactly as other props do, so the cache, the decoder and the pack's install apply). Per kind keep one template node; per live pickup a `clone()` (at most 4). Each frame `sync(list, t)`: make the clones match `list` by `id`, position at `p.at`, scale 1.4 (a pickup reads at about the size of a fighter; check against a TIE's size in the scene and adjust so it's visible at 20 units), `rotation.y = t * 1.2`, `position.y += Math.sin(t * 1.4 * Math.PI * 2) * 0.15` unless reduced, `visible = !(p.life - p.age < PICKUP_RULES.blink && !reduced && Math.floor(t * 8) % 2)`. Glow: one `THREE.Sprite` per clone with an additive radial `CanvasTexture` (made once) in the kind's colour (`repair #6dff9a`, `overcharge #ffb347`, `rapid #ff6a5c`, `bubble #7fd6ff`, `charge #c7a6ff`), scale 3. Dispose geometries' clones are shared (don't dispose the template's geometry until `dispose()`).

- [ ] **Step 3: The scene**

- `import { createPickups, PICKUPS } from './pickups'; import { createPickupFx } from './pickupFx';` and after `powers` is made: `const pickups = createPickups(); const pickupFx = createPickupFx(scene, { load: <the loader>, reduced });`.
- Drops, in `scored`, inside `if (ship && hit.down)` (and for a capital: `if (src === 'war' && hit.capital && hit.down)`): `pickups.drop(hit.at, { ace: FACTIONS[hit.faction]?.ace === hit.kind, capital: Boolean(hit.capital), shield: state.shield });` (`hit.at` may be a `Vector3` or `{x,y,z}`: `createPickups` copies `x, y, z`).
- Each frame (beside `powers.step`/`powers.update`, where `dt` and `live` are known): 

```js
const taken = pickups.step(dt, state.ship, { live: flying() && !state.crash && !state.jump && !props.frozen && !state.dive });
for (const t of taken) {
  if (t.heal) state.shield = Math.min(100, state.shield + t.heal);
  if (t.charge) powers.pickup();
  emit({ type: 'pickup', kind: t.kind, name: PICKUPS[t.kind].name, line: PICKUPS[t.kind].line });
  sound?.('pickup'); // (reuse an existing blip from sounds.js: grep -n "export" src/components/universe/sounds.js, pick the power-ready or achievement blip; no new sound file)
}
pickupFx.sync(pickups.list, state.clock);
if (pickups.list.length || taken.length) busy = true;
```

- The mods: where the guns' delay is read (`const g = state.stats;` in `fire`, ~line 859), multiply the delay by `pickups.mods().delay` and clamp to `FASTEST`; where the flight input passes `tune: state.stats` (~line 852), pass `tune: withPickups(state.stats, pickups.mods())` with `const withPickups = (s, m) => (m.boost === 1 && m.accel === 1 ? s : { ...s, boost: s.boost * m.boost, accel: s.accel * m.accel });` (use `statsOf`'s real key names, checked in Task 9 Step 8).
- The bubble: at the top of `hurt(damage, by)`, `damage = pickups.absorb(damage); if (damage <= 0) { flashes.at(...)?; return; }` (a light flash on the ship for an absorbed hit is optional; keep the return).
- Clear: in `startCrash`, `startDestroyed`, when a jump starts (`startJump`), and when the ship lands/boards (where `powers.cancel()` is called for those): `pickups.clear()`.
- The radar: in `placeRadar`, `for (const p of pickups.list) contacts.push({ id: \`p${p.id}\`, kind: 'pickup', at: p.at });`.
- The chips: in `placeShield` (the cluster writer), `cluster.buffs(props.buffs?.current ?? null, on ? pickups.buffs() : [])` (guard `null` root inside `buffs`).
- `pickupFx.dispose()` in the scene's `dispose`.
- DEV hook: add `pickups, drop: (kind) => state.ship && pickups.drop({ x: state.ship.x, y: state.ship.y, z: state.ship.z + 12 }, { ace: true, kind, shield: state.shield })` to `window.__galaxyDebug` (`drop`'s `why.kind` forces the kind), and `pickups: pickups.list.length, buffs: pickups.buffs().map((b) => b.kind)` to `__galaxy()`'s snapshot.

- [ ] **Step 4: `powers.pickup()`** (`galaxy/powers.js`, beside `gain`)

```js
// a power cell picked up (pickups.js): the big one charged a quarter and G's cooldown cut 5 s
pickup() {
  if (!st) return;
  const full = charge(st, 'pickup', 1);
  if (full) say('ready', 'ultimate', st.ultimate.id);
  if (hasten(st, 5)) say('ready', 'primary', st.primary.id);
  this.keep();
},
```

(import `hasten` alongside the module's existing `gain as charge` import from `../universe/shipPowers`; check the alias it uses.)

- [ ] **Step 5: The page says what was taken**

In `pages/Galaxy.jsx`, where the scene's events are handled, `pickup` events show a short toast: reuse whatever the page uses for short notes (the achievement toast or the comms line; `grep -n "type === 'kill'\|toast\|Toast" src/pages/Galaxy.jsx`). The line: `${name} · ${line}`. If there's no fitting toast, render one `<p className="galaxy-pickup-note" role="status">` for 2.2 s above the cluster (CSS: `position: absolute; left: 50%; bottom: calc(var(--hud-pad-b, 12px) + 214px); translate: calc(-50% - (var(--panel-w, 0px) + 24px) / 2) 0; padding: 0.35rem 0.8rem; border-radius: 999px; background: rgb(3 6 14 / 0.86); font-size: 0.8rem;`).

- [ ] **Step 6: Lint, tests**

Run: `npx eslint src/components/galaxy src/pages/Galaxy.jsx && npx vitest run src/components/galaxy src/components/universe/shipPowers.test.js` → pass.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/galaxy src/pages/Galaxy.jsx
git commit -m "Pickups in the galaxy: dropped by kills, drawn spinning, flown through for deflectors, boost, guns, a bubble or a power cell, with chips on the HUD and dots on the radar" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 16: the hangar in the galaxy

**Files:**
- Create: `src/components/universe/useShipOutfit.js`
- Test: `src/components/universe/useShipOutfit.test.js` (Node: the hook's two state changes are pure functions, tested; the hook is a thin `useState` + `local.set` over them)
- Modify: `src/pages/Universe.jsx:105-157` (use the hook; same behaviour)
- Modify: `src/pages/Galaxy.jsx:154-157` (use the hook; mount `Hangar`)
- Modify: `src/components/galaxy/GalaxyView.jsx` (a `hangar` element prop rendered beside the flight settings)
- Modify: `src/components/guide/pages.js` (`['H', 'The hangar: parts, paint and the shipyard']` in `/galaxy`'s keys)

**Interfaces:**
- Produces: in `useShipOutfit.js`, `fitShip({ loadouts, ship, loadout, slot, id, unlocked, build })` → `{ r, next }` (`r` is `equip`'s result; `next` the new loadouts when `r.ok`, else `null`) and `buildShip({ hulls, garage, ship, b })` → `{ hulls, garage }` (the garage only changes for a non-null build) — exactly the logic now inline in `Universe.jsx` — and `useShipOutfit(ship, unlocked)` → `{ loadouts, loadout, build, garage, dropped, fit(slot, id) → r, setBuild(b) }`, which keeps the same storage keys (`LOADOUT_KEY`, `HULL_KEY`, `GARAGE_KEY`; read where `Universe.jsx` imports `HULL_KEY`, `GARAGE_KEY` and `readHulls` from).

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { buildShip, fitShip } from './useShipOutfit';
import { STOCK_LOADOUT, isOpen, partsFor, STOCK } from './outfit';

describe('useShipOutfit', () => {
  it('fits the cheapest open guns part onto the ship it is for, keeping the others', () => {
    const part = partsFor('guns').filter((p) => p.id !== STOCK && isOpen(p, [])).sort((a, b) => a.power - b.power)[0];
    expect(part).toBeTruthy();
    const loadouts = { xwing: { ...STOCK_LOADOUT }, falcon: { ...STOCK_LOADOUT, paint: 'x' } };
    const { r, next } = fitShip({ loadouts, ship: 'xwing', loadout: { ...STOCK_LOADOUT }, slot: 'guns', id: part.id, unlocked: [], build: null });
    expect(r.ok).toBe(true);
    expect(next.xwing.guns).toBe(part.id);
    expect(next.falcon).toBe(loadouts.falcon);
  });
  it('a part that will not go on changes nothing', () => {
    const { r, next } = fitShip({ loadouts: {}, ship: 'xwing', loadout: { ...STOCK_LOADOUT }, slot: 'guns', id: 'no-such-part', unlocked: [], build: null });
    expect(r.ok).toBe(false);
    expect(next).toBeNull();
  });
  it('a build goes on the ship and into its garage; stock leaves the garage as it was', () => {
    const b = { hull: 'h1' };
    const one = buildShip({ hulls: {}, garage: {}, ship: 'falcon', b });
    expect(one.hulls.falcon).toBe(b);
    expect(one.garage.falcon).toBe(b);
    const two = buildShip({ hulls: one.hulls, garage: one.garage, ship: 'falcon', b: null });
    expect(two.hulls.falcon).toBeNull();
    expect(two.garage.falcon).toBe(b);
  });
});
```

(If `equip` with an unknown id returns `ok: true` with stock, assert what it really does for a refused part instead: read `equip` in `outfit.js:245` and pick a part the X-wing's plant can't power — the most `power` one with a small `PLANT.xwing` — for the refusal case. If a build needs a real shape for `buildShip`, it doesn't: the function only stores it.)

- [ ] **Step 2: Run it to see it fail** → FAIL.

- [ ] **Step 3: Write the hook** by moving `Universe.jsx`'s lines 108–157 (the `loadouts`/`hulls`/`garage` state, `setBuild`, `loadout`, `dropped`, `fit`) into `useShipOutfit.js`, with the two state changes pulled out as `fitShip` and `buildShip` (the hook calls them, then `setState` and `local.set` with what they return), parameterised by `ship` and `unlocked`, returning the object above. Then in `Universe.jsx` replace those lines with `const { loadouts, loadout, build, garage, dropped, fit, setBuild } = useShipOutfit(ship, unlocked);` and keep the two `useEffect`s that tell the online client (`setLoadout`, `tellBuild`) in the page.

- [ ] **Step 4: Run the universe tests**

Run: `npx vitest run src/components/universe src/pages` → pass (the behaviour is unchanged).

- [ ] **Step 5: The galaxy**

- `pages/Galaxy.jsx`: replace the `build`/`loadout` `useMemo`s (154–157) with the hook; `const [hangar, setHangar] = useState(false);`.
- Pass to `GalaxyView` a `hangar` element: `hangar={ship && <Hangar ship={ship} shipName={crewById(ship)?.ship ?? ''} loadout={loadout} build={build} lastBuild={garage[ship] ?? null} dropped={dropped} onBuild={setBuild} onFit={fit} open={hangar} onOpen={(on) => (setHangar(on), on && setSettingsOpenFromPage?.(false))} />}` (check how `UniverseMap.jsx:416` gets `shipName` and `onCrew`; pass `onCrew` only if the galaxy has a crew switch, else omit). The hangar and the flight settings are one-at-a-time on the universe map (`UniverseMap.jsx:66-79`): mirror that in `GalaxyView` by giving it an `onHangar` and closing the settings when the hangar opens and vice versa.
- `GalaxyView.jsx`: render `{hangar}` next to `<FlightSettings … />` inside the flying block. Check `Hangar`'s button's CSS position on the galaxy page (it's placed for the universe map's corner; `grep -n "universe-hangar" src/components/universe/universe.css`) and add a `.galaxy-page` override in `flight.css` if it lands on the map button, the keys chip or the cluster.
- The Hangar is not modal and the scene keeps flying behind it; its H key is its own (it checks no `aria-modal` is open).

- [ ] **Step 6: Lint, tests**

Run: `npx eslint src/pages src/components/universe src/components/galaxy && npx vitest run src/components/universe src/components/galaxy src/pages` → pass.

- [ ] **Step 7: Commit**

```bash
git add -A src/pages src/components/universe src/components/galaxy src/components/guide
git commit -m "The hangar opens in the galaxy (H): its parts, paint and builds change the ship in flight; the loadout's state shared with the universe map (useShipOutfit)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 17: check it all

**Files:**
- Modify: `scripts/galaxy-hud-check.mjs` (a `pickups` and a `hangar` scenario)
- Modify: `docs/superpowers/specs/2026-10-08-galaxy-map-flight-ui-design.md` (a "Where the code differs" section, if it does)

- [ ] **Step 1: The scenarios**
  - `pickups`: fly, `__galaxyDebug.drop('rapid')`, fly forward 2 s (`w`), expect `__galaxy().buffs` to include `rapid`, a `.fc-buff[data-kind="rapid"]` visible, and a screenshot of the drop before it's taken (freeze `pickupFx`'s clock per the galaxy-shoot-check note if needed); `__galaxyDebug.drop('repair')` after `__galaxyDebug.state.shield = 30`, fly through, expect shield ≥ 69; `__galaxyDebug.startJump('endor')` with a drop out: `__galaxy().pickups` is 0 after.
  - `hangar`: press `h`, expect `.universe-hangar` panel open (read Hangar's markup for its class), click a cheap unlocked guns part, expect `__galaxyDebug.state.stats` to differ from before (its delay or damage), press `h` to close.
- [ ] **Step 2: Run everything**

```bash
npx vitest run
npm run lint
npm run build
BASE=http://127.0.0.1:5188 OUT=/tmp/check node scripts/galaxy-map-check.mjs
BASE=http://127.0.0.1:5188 OUT=/tmp/check node scripts/galaxy-hud-check.mjs
BASE=http://127.0.0.1:5188 OUT=/tmp/check node scripts/galaxy-hud-check.mjs pickups
BASE=http://127.0.0.1:5188 OUT=/tmp/check node scripts/galaxy-hud-check.mjs hangar
node scripts/galaxy-powers-check.mjs layout
```

Expected: all pass; read every screenshot.

- [ ] **Step 3: Commit**

```bash
git add -A scripts docs/superpowers/specs
git commit -m "Checks for the galaxy's pickups and its hangar; the design notes where the code differs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
