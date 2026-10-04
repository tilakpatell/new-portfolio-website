# Avengers HQ Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the seven Avengers HQ activities into Three.js games with CC0 PBR assets, tested rules, and the stone heist.

**Architecture:** A shared `hq/` kit (frame component, engine, asset loaders, material roles, model factories, VFX, feel, stones) and one folder per game holding pure rules, a three.js scene and a React component. Rules are stepped at 1/120 s; scenes only draw.

**Tech Stack:** React 18, Vite 5, three 0.180 (EffectComposer, UnrealBloomPass, GLTFLoader + meshopt, RGBELoader), Vitest, sharp and @gltf-transform/cli for the asset script, Playwright (Chromium at /opt/pw-browsers) for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-04-avengers-hq-games-design.md`

## Global Constraints

- No new runtime dependencies; three.js code loads only inside dynamically imported scene modules.
- CC0 only (Poly Haven, ambientCG); assets in `public/hq/`, WebP textures at 1K (512 for small props), under about 4 MB per game.
- Rules deterministic with a seed; every game has "idle loses" and "sensible player wins" tests.
- Keyboard, mouse and touch for every game; reduced motion removes shake and flashes.
- Draw calls ≤ 300 desktop / 150 mobile, DPR ≤ 1.75, bloom only on authored emissives.
- Lint, tests and build pass before every push to `claude/funny-fermat-fzo6lu`.

## Review Focus

1. Scrolling past a running game: it must pause (no hidden simulation or audio) and resume cleanly. Test: HQGame pauses when its IntersectionObserver reports it out of view.
2. Several WebGL contexts on one page: contexts far from the viewport are disposed, so the page never exceeds the browser's context limit. Test: in the browser, scroll the whole page and count live renderers via `window.__HQ__`.
3. A finger lifting off a hold control outside it, or the window losing focus mid-hold: no control stays stuck. Test: blur resets held intents in each game's input handler.
4. A missing or slow asset: the game still starts with procedural materials. Test: `assets.js` resolves to a fallback when a fetch fails.
5. Restarting after a win or loss: no stale timers, entities or best scores. Test: each rules suite starts a second run from a finished state and checks it is fresh.

---

### Task 1: Asset pipeline

**Files:** Create `scripts/hq-assets.mjs`, `scripts/data/hq-assets.json`, `public/hq/**`, `public/hq/CREDITS.md`. Modify `package.json` (script `hq-assets`).

- [ ] Manifest lists each texture set (Poly Haven or ambientCG id, size, repeat hint), HDRI (Poly Haven id, env size, background size) and model (Poly Haven id, texture size, simplify ratio).
- [ ] Script downloads via the Poly Haven API (`api.polyhaven.com/files/{id}`) with a descriptive User-Agent and ambientCG's download links, writes `diff.webp`, `nor.webp`, `arm.webp` per texture (sharp), a downsampled RGBE `.hdr` for lighting plus a JPG background per HDRI, and a meshopt-compressed GLB per model (glTF-Transform: resize textures, webp, simplify, weld, meshopt).
- [ ] Run it; check total size and per-game budget; commit.

### Task 2: Shared kit

**Files:** Create `src/components/avengers/hq/{HQGame.jsx,engine.js,assets.js,materials.js,vfx.js,feel.js,rng.js,stones.js,stones.test.js,feel.test.js}`, `src/components/avengers/hq/kit/*.js`. Modify `src/styles/extras.css`.

**Interfaces (produced):**
- `createEngine(canvas, { hdri, exposure, bloom, fog, onLost, onSlow }) → { renderer, scene, camera, setCamera(cam), resize(w,h), render(ms), dispose(), info() }`
- `loadPBR(id, { repeat, srgb }) → Promise<{ map, normalMap, aoMap, roughnessMap, metalnessMap }>`; `loadGLB(id) → Promise<THREE.Group>`; `loadHDRI(id) → Promise<{ env, background }>`
- `material(role, opts) → THREE.Material` for roles in the spec's material kit
- `createVfx(scene) → { burst(kind, pos, opts), ring(pos, opts), beam(a, b, opts), update(dt) }`
- `createFeel(camera) → { trauma(k), hitstop(ms), punch(deg), update(dt) }`
- `rng(seed) → () => number`
- `useStones() → { stones, earn(id), has(id) }`, `earnStone(id)`; event `tp:stones`
- `<HQGame id fallback={<Toy/>} load={() => import('./scene')} …>` render-prop giving `{ engine, active, visible }` to the game

- [ ] Tests first for `rng`, `stones` (persist, event, idempotent) and `feel` (trauma decays, capped).
- [ ] Implement, lint, commit.

### Tasks 3–9: One per game

Each game task follows the same steps:

- [ ] Write `rules.test.js` for the spec's loop: start, idle loses, scripted player wins, damage/fail, scoring, reward event, determinism, restart is fresh, plus the game's invariant (Ricochet: every room solvable at par by angle search; Infiltration: every level solvable by BFS; Smash Run: lane-aware bot survives 150 m; Tesseract Run: PD controller lands leg 1).
- [ ] Run, see it fail.
- [ ] Implement `rules.js` until green.
- [ ] Build `scene.js` with the kit and assets; build `<Game>.jsx` with HUD, controls (keyboard, pointer, touch), sound and the overlay copy.
- [ ] Wire into `src/pages/Avengers.jsx` with the toy as fallback.
- [ ] Browser check: start, play with real input, lose, retry, win via `__HQ__` state hook; desktop and phone screenshots; renderer counts.
- [ ] Lint, test, build; commit and push.

Order: 3 Repulsor Range → 4 Ricochet → 5 Trick Shot → 6 Hold the Lawn → 7 Smash Run → 8 Infiltration → 9 Tesseract Run.

### Task 10: Stone heist and Thanos ending

**Files:** Modify `src/pages/Avengers.jsx`, `src/components/avengers/Compound.jsx`, `src/components/Achievements.jsx`, `src/fun/effects.js` (Tony's snap), `src/styles/extras.css`.

- [ ] Rail and map show earned stones; gauntlet starts with earned stones; "Whatever it takes" achievement; Tony's snap when all six were earned.
- [ ] Browser check with stones seeded in localStorage; commit and push.

### Task 11: QA and evidence

- [ ] Full-page pass on desktop and phone: every game, fallback with 3D off, scroll through with all games, console clean.
- [ ] Scorecard per game against the visual scorecard; fix any category below 2.
- [ ] README note; final lint/test/build; push; report.
