# World Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One runtime (renderer, loop, input, audio, saves, assets, quality) that every full-screen world plugs into as a module, with Earth as the first module and a handover that moves between two modules without a cut.

**Architecture:** `src/runtime/` holds pure services (each tested in Node) and one `createRuntime()` that wires them to a backend (`webgl.js` today, `webgpu.js` built and tested with a fixture). Pages mount a module with `useWorld` into a `WorldHost`; the runtime moves its one canvas into the host and runs one loop. Earth's flight moves from `EarthWorld.jsx`'s frame loop into `earth/module.js`'s `step`; the component keeps the HUD.

**Tech Stack:** three 0.186.1 (`three`, `three/webgpu`, `three/tsl`), React 19, Vite 8, Vitest 5 (Node environment: no DOM in unit tests, so every service takes its browser bits as parameters).

**Spec:** `docs/superpowers/specs/2026-10-06-world-runtime-design.md`

## Global Constraints

- Nothing a visitor can do today is lost: every key, chip, save key, achievement, sound, ghost and dev hook of a migrated world works as before (spec: "Nothing is lost").
- Save keys keep their exact names (`tp-earth-stamps`, `tp-earth-flown`, `tp-earth-sun`, `tp-earth-cam`).
- Every module is `shading: 'glsl'` until its shaders are TSL; `shading.test.js` enforces the `'nodes'` promise.
- `dt` is clamped to 0.05 s; the first frame waits on `ready` 4000 ms at most; a handover fades 600 ms by default.
- Status names are `useScene`'s: `idle | loading | ready | on | failed | slow | lost`.
- Lint (`npx eslint .`), tests (`npx vitest run`), build (`npx vite build`) and `node scripts/autopilot-check.mjs --only smoke --routes /earth` green before merge.
- Commit messages carry no model identifiers.

## Review Focus

1. A key held across a route change (W down when a world unmounts): the next world must not start with it held. `input.test.js`: `detach()` clears `keys`.
2. Two `mount` calls before the first module's `create` resolves (a visitor clicks away during loading): the first world is disposed on arrival, never drawn. `runtime.test.js`: "a mount during loading wins".
3. A `handoff()` that throws: the handover still happens, with `from: null`. `handover.test.js` and `runtime.test.js` cover it.
4. The touch stick left mid-drag when the page hides the controls: `setStick` is reset by `detach()`. `input.test.js`.
5. `localStorage` throwing (private mode, full): every `rt.saves` call returns the fallback and never throws. `saves.test.js` with a throwing store.

---

### Task 1: Backend pick

**Files:**
- Create: `src/runtime/backend.js`, `src/runtime/backend.test.js`

**Interfaces:**
- Produces: `pickBackend({ gpu = false, shading = 'glsl', override = null, lost = false }) → 'webgl' | 'webgpu'`; `readOverride(search, hash, stored) → 'webgl' | 'webgpu' | null` (`?gpu=` in `search` or after `?` in `hash`, else `stored`).

- [ ] **Step 1: Write the failing tests**

```js
it('picks webgpu only for a nodes module with a gpu', () => {
  expect(pickBackend({ gpu: true, shading: 'nodes' })).toBe('webgpu');
  expect(pickBackend({ gpu: true, shading: 'glsl' })).toBe('webgl');
  expect(pickBackend({ gpu: false, shading: 'nodes' })).toBe('webgl');
});
it('an override wins, a loss never goes back', () => {
  expect(pickBackend({ gpu: true, shading: 'glsl', override: 'webgpu' })).toBe('webgpu');
  expect(pickBackend({ gpu: true, shading: 'nodes', override: 'webgl' })).toBe('webgl');
  expect(pickBackend({ gpu: true, shading: 'nodes', lost: true })).toBe('webgl');
});
it('reads the override from the address, the hash or storage', () => {
  expect(readOverride('?gpu=webgl', '', null)).toBe('webgl');
  expect(readOverride('', '#/earth?gpu=webgpu', null)).toBe('webgpu');
  expect(readOverride('', '', 'webgl')).toBe('webgl');
  expect(readOverride('?gpu=nope', '', 'x')).toBe(null);
});
```

- [ ] **Step 2: Run `npx vitest run src/runtime/backend.test.js`; expect FAIL (module missing)**
- [ ] **Step 3: Implement both functions in `backend.js`**
- [ ] **Step 4: Run the test; expect PASS**
- [ ] **Step 5: Commit** `git add src/runtime/backend*.js && git commit -m "Runtime: which backend to make"`

### Task 2: Input

**Files:**
- Create: `src/runtime/input.js`, `src/runtime/input.test.js`

**Interfaces:**
- Consumes: `src/components/games/pad.js`'s `readPad`, `edges`, `typing`.
- Produces: `createInput({ readPad = () => null, typing = () => false } = {})` → `{ attach({ win, host }), detach(), bind(actions, { axes } = {}), unbind(), setStick(x, y), sample(now) }`. `attach` adds `keydown`/`keyup`/`blur` on `win` and `pointerdown`/`pointermove`/`pointerup`/`pointercancel` on `host`; `detach` removes them and clears all state. The snapshot: `{ keys, pressed, pad, tapped, pointer: { x, y, down, drag }, stick: { x, y }, action(name), axis(name) }`. `axis(name)` for `axes[name] = [negAction, posAction]` returns `-1`, `0` or `1` from the keys alone; the pad's sticks and the touch stick are in the snapshot for the module to map as it likes (Earth's `stepFlight` does).

- [ ] **Step 1: Write the failing tests**

```js
const press = (code, target = {}) => ({ code, key: code, target, repeat: false, metaKey: false, ctrlKey: false, altKey: false, preventDefault: vi.fn() });
it('holds a key until it is released, and pressed for one sample', () => {
  const win = fakeTarget(); const input = createInput();
  input.attach({ win, host: fakeTarget() });
  win.fire('keydown', press('KeyW'));
  let s = input.sample(0);
  expect(s.keys.has('KeyW')).toBe(true); expect(s.pressed.has('KeyW')).toBe(true);
  s = input.sample(16);
  expect(s.pressed.has('KeyW')).toBe(false);
  win.fire('keyup', press('KeyW'));
  expect(input.sample(32).keys.size).toBe(0);
});
it('ignores typing in a field and modifier combos', ...);   // typing() true → not held; ctrlKey → not held
it('prevents the default only for a bound key', ...);       // bind({ fire: ['KeyF'] }); KeyF preventDefault called; KeyZ not
it('actions and axes come from the bindings', ...);        // bind({ left: ['KeyA'], right: ['KeyD'] }, { axes: { turn: ['left', 'right'] } }); A held → axis('turn') -1; both → 0
it('a blur and a detach clear what is held and the stick', ...);  // setStick(0.5, 0); detach(); sample().stick = {0,0}; keys empty
it('pad presses are edges for one sample', ...);           // readPad returns { a: true } twice → tapped.a true then false
```

`fakeTarget()` is a tiny `addEventListener`/`removeEventListener`/`fire` object in the test file.

- [ ] **Step 2: Run; expect FAIL**
- [ ] **Step 3: Implement `createInput` in `input.js`** (keys are `KeyboardEvent.code`; pointer coordinates relative to `host.getBoundingClientRect()`; `drag` is `{ dx, dy }` since the last sample while `down`, else `null`)
- [ ] **Step 4: Run; expect PASS**
- [ ] **Step 5: Commit** `git commit -m "Runtime: one input snapshot a frame"`

### Task 3: Quality

**Files:**
- Create: `src/runtime/quality.js`, `src/runtime/quality.test.js`

**Interfaces:**
- Consumes: `lib/three/pace.js`'s `createPace`, `STEPS`; `lib/device.js`'s `budget`, `device`.
- Produces: `createQuality({ tier, pace = createPace(), floorAfter = 2500 } = {})` → `{ tier, budget, level, scale, ratio, on(fn), frame(now) → level | null, reset() }`. `ratio = budget.ratio × scale`. `level` is the pace's index; when the pace is at its last step for `floorAfter` ms of frames and still missing, `frame` returns `STEPS.length` once (the floor) and `level` stays there.

- [ ] **Step 1: Write the failing tests**

```js
it('starts at the tier budget, sharpest', () => {
  const q = createQuality({ tier: 'mid' });
  expect(q.budget.ratio).toBe(1.5); expect(q.level).toBe(0); expect(q.ratio).toBe(1.5);
});
it('follows the pace down and tells listeners once per change', () => {
  const pace = { frame: vi.fn().mockReturnValueOnce(null).mockReturnValueOnce(0.85), scale: 0.85, level: 1, reset() {} };
  const q = createQuality({ tier: 'high', pace }); const seen = [];
  q.on((l) => seen.push(l));
  expect(q.frame(0)).toBe(null); expect(q.frame(16)).toBe(1);
  expect(seen).toEqual([1]); expect(q.ratio).toBeCloseTo(1.7);
});
it('floors once when the last step still misses', ...);  // pace stuck at last level for > floorAfter of frames → frame returns STEPS.length once, then null
```

- [ ] **Step 2–5:** fail, implement, pass, commit `"Runtime: one quality level"`

### Task 4: Saves

**Files:**
- Create: `src/runtime/saves.js`, `src/runtime/saves.test.js`

**Interfaces:**
- Produces: `createSaves({ local, session, win = null } = {})` → `{ get(key, fallback = null), set(key, value), remove(key), session: { get, set, remove }, watch(key, fn) → undo, register({ key, version, migrate }) }`. Values are JSON. `register` stores `{ v: version, data }` under `key`; `get` of a registered key returns `data`, running `migrate(old, oldVersion)` once when the stored version is lower (an unversioned value is version 0). `watch` fires on this tab's `set` and on `win`'s `storage` event for the key.

- [ ] **Step 1: Write the failing tests**

```js
const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
it('reads JSON with a fallback and never throws', () => {
  const bad = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() {} };
  const s = createSaves({ local: bad, session: bad });
  expect(s.get('tp-x', 1)).toBe(1); expect(() => s.set('tp-x', 2)).not.toThrow();
});
it('round-trips a value', ...);
it('migrates a registered key once', () => {
  const local = store(); local.setItem('tp-earth-stamps', JSON.stringify(['home']));
  const s = createSaves({ local, session: store() });
  const migrate = vi.fn((old) => ({ ids: old }));
  s.register({ key: 'tp-earth-stamps', version: 1, migrate });
  expect(s.get('tp-earth-stamps')).toEqual({ ids: ['home'] });
  expect(s.get('tp-earth-stamps')).toEqual({ ids: ['home'] });
  expect(migrate).toHaveBeenCalledTimes(1);
});
it('watch fires on set and on another tab', ...);  // win.fire('storage', { key, newValue })
```

- [ ] **Step 2–5:** fail, implement, pass, commit `"Runtime: one save store"`

### Task 5: Assets

**Files:**
- Create: `src/runtime/assets.js`, `src/runtime/assets.test.js`

**Interfaces:**
- Consumes (in the browser wiring only, not the core): `lib/three/textures.js` `loadTexture`, `forgetTexture`, `warm`; `lib/three/gltf.js` `loadGltf`, `forgetGltf`; `lib/audio.js` `loadBuffer`.
- Produces: `createAssets({ loaders, forget, concurrency = 2 })` → `{ texture(url, opts), gltf(url, opts), audio(url), prefetch(urls, { priority = 2, kind = 'texture' } = {}), retain(url), release(url), owner(id), drop(id), stats() }`. `loaders = { texture(url, opts), gltf(url, opts), audio(url) }` return promises; `forget = { texture(url), gltf(url) }`. `owner(id)` sets the module every later load belongs to; `drop(id)` forgets every URL loaded under `id` that no other owner holds and that is not retained. `prefetch` queues by priority (0 first), `concurrency` in flight.

- [ ] **Step 1: Write the failing tests**

```js
it('loads each URL once per cache', ...);                 // two texture('a') calls → loader once
it('prefetch runs by priority, two at a time', async () => {
  const started = []; const pending = [];
  const loaders = { texture: (u) => { started.push(u); return new Promise((r) => pending.push(r)); } };
  const a = createAssets({ loaders, forget: { texture() {} } });
  a.prefetch(['c', 'd'], { priority: 2 }); a.prefetch(['a', 'b'], { priority: 0 });
  await Promise.resolve();
  expect(started).toEqual(['a', 'b']);
  pending[0](); await Promise.resolve(); await Promise.resolve();
  expect(started).toEqual(['a', 'b', 'c']);
});
it('drop forgets what only that owner loaded, keeps what is retained', ...);  // owner('earth'); texture('x'); retain('y'); texture('y'); drop('earth') → forget.texture('x') only
```

- [ ] **Step 2–5:** fail, implement, pass, commit `"Runtime: assets with an owner"`

### Task 6: Handover timeline and the module contract

**Files:**
- Create: `src/runtime/handover.js`, `src/runtime/handover.test.js`, `src/runtime/module.js`, `src/runtime/module.test.js`

**Interfaces:**
- Produces (`handover.js`): `createHandover({ fade = 600 } = {})` → `{ start(now), frame(now) → { opacity, done }, cancel() }`: `opacity` goes 1 → 0 over `fade` ms from `start`; `done` once 0; before `start`, `{ opacity: 1, done: false }`.
- Produces (`module.js`): `validateModule(mod)` throws `Error('world module needs id, create')` naming what is missing; `validateWorld(world)` throws when `draw`, `resize` or `dispose` is missing; `fromScene(create)` → a module-like `create(rt, props)` that calls `create(rt.gfx.canvas, { ...props, el: rt.host, colors: props.colors, reduced: props.reduced, invalidate: rt.invalidate, onLost: rt.lost, onSlow: () => world.lowerQuality?.(STEPS.length) })` and returns a world whose `draw(frame)` calls the scene's `render(frame.dt * 1000, frame.now)` and stores the result for `wants()`; `setColors`, `setVisible`, `update`, `warmUp`, `ready`, `resize`, `dispose` pass through.

- [ ] **Step 1: Write the failing tests** — `handover.test.js`: opacity at 0, 300 and 600 ms (1, 0.5, 0 and `done`); `cancel` makes `done` true. `module.test.js`: `validateModule({})` throws with `id`; `validateWorld({ draw() {} })` throws naming `resize`; `fromScene` test with a fake scene: `render` is called with `(16, now)` for `dt 0.016`, `wants()` mirrors its return, `dispose` passes through.
- [ ] **Step 2–5:** fail, implement, pass, commit `"Runtime: the module contract and a handover's fade"`

### Task 7: The runtime

**Files:**
- Create: `src/runtime/runtime.js`, `src/runtime/runtime.test.js`, `src/runtime/gfx.js`, `src/runtime/webgl.js`, `src/runtime/webgpu.js`, `src/runtime/audio.js`, `src/runtime/index.js`, `src/runtime/runtime.css`

**Interfaces:**
- Consumes: Tasks 1–6; `lib/three/loop.js` `createLoop`; `lib/three/renderer.js` `createRenderer`, `precompile`, `precompilePasses`, `uploadTextures`, `releaseContext`; `lib/audio.js`; `lib/hooks.js` `local`, `storage`.
- Produces (`runtime.js`): `createRuntime({ makeBackend, input, quality, saves, assets, audio, events, loop, doc, now })` → `{ gfx, input, quality, saves, assets, audio, events, status, current, on(fn), invalidate(), mount(module, props, host), handover(module, props, host, { fade }), unmount(), dispose() }`. Everything optional has a browser default in `index.js`'s `runtime()` (the singleton). `makeBackend(kind, canvas) → gfx` where `gfx` is `{ backend, renderer, canvas, size, ratio, setSize(w, h), setRatio(r), compile, upload, post(passes), snapshot(host) → { el, set(opacity), remove() }, lost, dispose() }`.
- `webgl.js`: `createWebGL(canvas, { budget, onLost })` → `gfx` built on `createRenderer` (its watchdog not used: `rt.quality` owns the ratio). `post(passes)` builds an `EffectComposer` from `[{ kind: 'render', scene, camera }, { kind: 'bloom', strength, radius, threshold }, { kind: 'shader', material }, { kind: 'output' }]`.
- `webgpu.js`: `createWebGPU(canvas, { budget, onLost })` → the same `gfx` on `WebGPURenderer` (`import('three/webgpu')`), `await renderer.init()` inside; `post` builds `PostProcessing` with `pass` and `bloom` from `three/tsl`; a `'shader'` pass throws `Error('a shader pass needs the webgl backend')`.
- `audio.js`: `createAudioBus({ context, output })` → `{ context, output, bus() → GainNode, fadeOut(ms = 150) }`; `bus()` is one gain per mounted module, made on first ask.
- `index.js`: `runtime()` singleton, `useWorld`, `WorldHost`, `fromScene`.

- [ ] **Step 1: Write the failing tests** (`runtime.test.js`, with a fake backend `{ renderer: {}, canvas: { remove() {} }, setSize: vi.fn(), setRatio: vi.fn(), snapshot: () => ({ set: vi.fn(), remove: vi.fn() }), lost: false, dispose: vi.fn() }`, a fake loop whose frames the test ticks, a fake host with `prepend`, `getBoundingClientRect`):

```js
it('mounts: loading, ready after create, on after the first frame, in frame order', async () => {
  const order = [];
  const mod = { id: 'a', create: () => ({ resize() {}, step: () => order.push('step'), draw: () => order.push('draw'), wants: () => true, dispose() {} }) };
  await rt.mount(mod, {}, host); expect(rt.status).toBe('ready');
  loop.tick(16); expect(rt.status).toBe('on'); expect(order).toEqual(['step', 'draw']);
});
it('a mount during loading wins: the first world is disposed, never drawn', ...);
it('a frame that throws fails the world', ...);
it('handover keeps the old world drawing until the new one is ready, then fades', async () => { /* snapshot.set called with 1 then <1 then 0; old.dispose after new ready; from = old.handoff() */ });
it('a handoff that throws still hands over with from null', ...);
it('unmount disposes, clears input and fades audio, keeps the canvas', ...);
it('a lost context sets lost and a later mount makes a new backend', ...);  // makeBackend called twice
```

- [ ] **Step 2: Run; expect FAIL**
- [ ] **Step 3: Implement `runtime.js`** (the frame: `input.sample` → `step` → `draw` → `quality.frame` → handover fade → `wants() || kicked`; the canvas moved with `host.prepend(canvas)`; `ResizeObserver` on the host in `index.js`'s browser wiring, not in the core)
- [ ] **Step 4: Implement `gfx.js` (the shared helpers: `compile`, `upload`, `snapshot` with a 2D canvas `drawImage`), `webgl.js`, `webgpu.js`, `audio.js`, `index.js`, `runtime.css`** (`.world-canvas { display: block; width: 100%; height: 100%; }`, `.world-snapshot { position: absolute; inset: 0; pointer-events: none; transition: none; }`)
- [ ] **Step 5: Run `npx vitest run src/runtime`; expect PASS. `npx eslint src/runtime`; clean**
- [ ] **Step 6: Commit** `"Runtime: mount, handover, unmount on one renderer"`

### Task 8: useWorld and WorldHost, and the shading guard

**Files:**
- Create: `src/runtime/useWorld.js`, `src/runtime/WorldHost.jsx`, `src/runtime/shading.test.js`

**Interfaces:**
- Produces: `useWorld(module, { props, enabled = true, host, onEvent })` → `{ status, on, meant, world }` (`world` a ref to the mounted world; `meant` as `useScene`'s). It mounts on `enabled && use3D().on` with the host's element, calls `world.update(props)` on change, forwards `rt.events` to `onEvent`, observes the host's size, and unmounts on cleanup only when the next route has no module within a tick (so a handover's page can mount first). `WorldHost({ module, props, onEvent, children, className, fallback })` renders `<div class="world-host" data-gl=...>` with the phone gate (`WorldGate`'s check from `lib/device`'s `worldCheck(module.mb)`) and `children` over the canvas.
- `shading.test.js`: reads `src/components/*/module.js` (and `src/components/galaxy/surface/module.js`), and for each with `shading: 'nodes'` greps its folder for `ShaderMaterial`, `onBeforeCompile`, `EffectComposer` and fails naming the file.

- [ ] **Step 1: Write `shading.test.js`** (passes today: no module is `'nodes'`; a fixture `src/runtime/fixtures/nodesWorld.js` with `shading: 'nodes'` and a `MeshStandardMaterial` only is listed too, proving the test runs)
- [ ] **Step 2: Implement `useWorld.js` and `WorldHost.jsx`**
- [ ] **Step 3: `npx eslint src/runtime && npx vitest run src/runtime`; expect clean and PASS**
- [ ] **Step 4: Commit** `"Runtime: a page puts a module on it"`

### Task 9: Earth on the runtime

**Files:**
- Create: `src/components/earth/module.js`, `src/components/earth/module.test.js`
- Modify: `src/components/earth/scene.js:294-300` (`createEarth({ renderer, small, onLost })`, no renderer of its own; `dispose` leaves the renderer), `src/components/earth/EarthWorld.jsx` (the sim and the frame loop out; `useWorld` in), `src/components/earth/sounds.js` (connect to a bus passed in)

**Interfaces:**
- Produces: `module.js` default `{ id: 'earth', shading: 'glsl', mb: 2, create(rt, props) }`; the world adds `dive()`, `rise()`, `goTo(id)`, `toggleSun()`, `toggleCam()`, `clearTarget()`, `pick(nx, ny)`, `screenOf(v)`, `setPaused(on)`, `setTravellers(list)`; events `mode` ({ mode }), `hud` ({ over, heading, next, target, night, km, alt }), `stamp` ({ id, first }), `postcard` ({ id }), `sun` ({ mode }), `cam` ({ cockpit }), `around` (the achievement). `props`: `{ small }`. Keys bound: `throttle KeyW ArrowUp`, `brake KeyS ArrowDown`, `left KeyA ArrowLeft`, `right KeyD ArrowRight`, `boost ShiftLeft ShiftRight`, `roll KeyR`, `orbit KeyM`, `passport KeyP`, `sun KeyN`, `cam KeyV`, `dive Enter` (the component keeps Escape, the postcard's Enter and Space, since they are the dialogs').
- `module.test.js` with a fake `rt` (fake `gfx.renderer` with `capabilities.maxTextureSize`, a `createEarth` stub via `vi.mock('./scene')`): `step` with `throttle` held moves `f.km`; `KeyM` tapped in flight emits `mode: 'rise'`; the first-arrival dive fires after 2.2 s unless touched; `dispose` writes the flown distance.

- [ ] **Step 1: Write `module.test.js`; run; expect FAIL**
- [ ] **Step 2: Move the sim into `module.js`** (`sim`, `stepFlight`, `orbitOver`, `daySun`, the pad edges, the stamps and the flown distance through `rt.saves`, the engine sound on the bus, `window.__EARTH__ = { api, sim }` in DEV as before)
- [ ] **Step 3: Rewire `EarthWorld.jsx`**: `useWorld(earthModule, { props: { small }, host, onEvent })`; the chips call the world's methods; the stick calls `rt.input.setStick`; `trav.ref.current?.list()` handed in with `world.setTravellers` each HUD tick; the labels moved by `screenOf` in a `rt.events.on('hud')` handler.
- [ ] **Step 4: `npx vitest run src/components/earth src/runtime`; expect PASS. `npx eslint .`; clean**
- [ ] **Step 5: `npx vite build && node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /earth`; expect the route green with a canvas drawn**
- [ ] **Step 6: Commit** `"Earth flies on the world runtime"`

### Task 10: Docs, the hand-off and the merge

**Files:**
- Modify: `docs/architecture.md` (a "The world runtime" section: where it lives, the contract, how a world is migrated), `README.md` (one line under "How it works"), `src/components/worlds/worlds.js` (comment: `mb` moves to each module as it migrates; `WORLD_MB['/earth']` reads the module's)
- Create: `docs/superpowers/HANDOFF-world-runtime.md`

- [ ] **Step 1: Write the hand-off** (per-world checklist, order, what each world's session must keep, the checks, the TSL port rules)
- [ ] **Step 2: `npx eslint . && npx vitest run && npx vite build`; green**
- [ ] **Step 3: Commit, push `claude/blissful-galileo-3sbomr`, open the PR to `main`, wait for CI, merge (merge commit)**
