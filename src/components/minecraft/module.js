// The Minecraft tribute as a world module on the runtime. It runs the sim
// (rules/game.js) at the game's 20 ticks a second from the runtime's input
// snapshot, the pointer-lock look and the touch pad the page sends; has the
// worker (./worker.js) make and mesh the chunks the sim wants, nearest
// first, and lets go of the ones left behind; draws through ./scene.js on
// the runtime's renderer, between the last two ticks; and tells the page
// what to show through rt.events: 'ui' { mode, seed, loaded, wanted, ready }
// and 'hud' { selected, health, hunger, air } (at most ten times a second).
//
// The world adds: look(dx, dy), press(name, down), stick(x, y), scroll(dir),
// select(slot), start(), pause(on), newWorld(seed), and `game`, `scene`,
// `debug` for the browser checks.

import * as THREE from 'three';
import { makeChunk } from './rules/chunk.js';
import { addChunk, drain, dropFar, newGame, tick, wantedChunks } from './rules/game.js';
import { chunkKey } from './rules/jobs.js';
import { createScene } from './scene.js';
import { MC } from './scene/atlasTexture.js';
import { workerClient } from './scene/chunks.js';

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sneak: ['ShiftLeft', 'ShiftRight'],
  sprint: ['ControlLeft', 'ControlRight'],
  inventory: ['KeyE'],
  drop: ['KeyQ'],
  debug: ['F3'],
  view: ['F5'],
  pause: ['Escape'],
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`slot${n}`, [`Digit${n}`]])),
};

export const SAVE = 'tp-mc';
export const SAVE_VERSION = 1;
export const TICK = 1 / 20;
const MAX_TICKS = 4;
const IN_FLIGHT = 8;
const SENSITIVITY = 0.0022; // radians a pixel, about the game's default
const DOUBLE_TAP = 7; // ticks between two presses of forward that sprint

// How many ticks a frame's time makes: at most four (a hidden tab coming
// back doesn't run the world on for seconds), the rest dropped.
export function ticksFor(acc) {
  const n = Math.floor(acc / TICK + 1e-9);
  if (n > MAX_TICKS) return { ticks: MAX_TICKS, left: 0 };
  return { ticks: n, left: acc - n * TICK };
}

// The render distance in chunks: the tier's (high 10, mid 6, low 4), and
// one step less for each step the quality controller takes down.
const BY_TIER = { high: 10, mid: 6, low: 4 };
const BY_LEVEL = [10, 8, 6, 4, 4];
export const distanceFor = (tier, level = 0) => Math.min(BY_TIER[tier] ?? 6, BY_LEVEL[Math.min(level, BY_LEVEL.length - 1)]);

const randomSeed = () => Math.floor(Math.random() * 2 ** 31) - 2 ** 30;

export default {
  id: 'minecraft',
  shading: 'glsl',
  mb: 2,
  label: 'Minecraft, a fan tribute: an endless blocky world to walk',
  async create(rt, props = {}) {
    const renderer = rt.gfx.renderer;
    const was = { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, shadows: renderer.shadowMap.enabled };
    // the game's flat light: no tone mapping, no shadows
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = false;

    rt.saves?.register({ key: SAVE, version: SAVE_VERSION, migrate: () => null });
    const saved = rt.saves?.get(SAVE, null);
    const manifest = await (await fetch(`${MC}manifest.json`)).json();
    const scene = createScene(renderer, rt, { manifest });
    await scene.ready;

    const tier = rt.quality?.tier ?? 'high';
    let distance = distanceFor(tier, 0);
    let g = null;
    let mode = 'title';
    let gone = false;
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const client = workerClient(worker);
    const flying = new Map(); // key → seed asked for

    const touch = { x: 0, y: 0, held: new Set() };
    const look = { dx: 0, dy: 0 };
    let selected = 0;
    let acc = 0;
    let lastForward = -100;
    let sprintTap = false;
    let wantedCache = { at: '', keys: [], set: new Set() };

    function begin(seed) {
      for (const k of flying.keys()) client.cancel(k);
      flying.clear();
      if (g) for (const c of g.world.chunks.values()) scene.chunks.drop(c.cx, c.cz);
      g = newGame({ seed });
      g.renderDistance = distance;
      g.prev = { x: g.player.x, y: g.player.y, z: g.player.z };
      wantedCache = { at: '', keys: [], set: new Set() };
      rt.saves?.set(SAVE, { seed: g.seed });
    }
    begin(saved?.seed ?? props.seed ?? randomSeed());
    scene.setRenderDistance(distance);

    // ── the chunks: asked for nearest first, a few at a time, let go behind ──
    function wanted() {
      const at = `${Math.floor(g.player.x / 16)},${Math.floor(g.player.z / 16)},${g.renderDistance}`;
      if (wantedCache.at !== at) {
        const keys = wantedChunks(g);
        wantedCache = { at, keys, set: new Set(keys) };
      }
      return wantedCache;
    }
    function load() {
      const { keys, set } = wanted();
      for (const k of flying.keys()) if (!set.has(k)) {
        client.cancel(k);
        flying.delete(k);
      }
      const seed = g.seed;
      for (let i = 0; i < keys.length && flying.size < IN_FLIGHT; i++) {
        const k = keys[i];
        if (flying.has(k) || g.world.chunks.has(k)) continue;
        const [cx, cz] = k.split(',').map(Number);
        flying.set(k, seed);
        client.request({ type: 'chunk', key: chunkKey(cx, cz), seed, cx, cz, priority: i }).then((msg) => {
          if (gone || flying.get(k) !== seed) return;
          flying.delete(k);
          if (!msg) return;
          if (!wanted().set.has(k) || g.seed !== seed) return;
          const c = makeChunk(cx, cz);
          c.ids = msg.ids;
          c.state = msg.state;
          c.light = msg.light;
          c.generated = true;
          addChunk(g, c);
          for (let s = 0; s < 16; s++) scene.chunks.setMesh(cx, cz, s, msg.meshes[s]);
        });
      }
      for (const k of dropFar(g)) {
        const [cx, cz] = k.split(',').map(Number);
        scene.chunks.drop(cx, cz);
      }
    }

    // ── input ──
    const pressed = (snap, name) => (KEYS[name] ?? []).some((code) => snap.pressed.has(code));
    function inputOf(snap) {
      const held = (name) => snap.action(name) || touch.held.has(name);
      let forward = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0);
      let strafe = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      const pad = snap.pad;
      if (pad && (pad.lx || pad.ly)) {
        strafe = pad.lx;
        forward = -pad.ly;
      }
      if (touch.x || touch.y) {
        strafe = touch.x;
        forward = touch.y;
      }
      if (pressed(snap, 'forward')) {
        if (g.ticks - lastForward <= DOUBLE_TAP) sprintTap = true;
        lastForward = g.ticks;
      }
      if (forward <= 0) sprintTap = false;
      return { forward, strafe, jump: held('jump') || Boolean(pad?.a), sneak: held('sneak') || Boolean(pad?.b), sprint: held('sprint') || sprintTap || Boolean(pad?.ls), yaw: g.player.yaw, pitch: g.player.pitch };
    }

    // ── what the page shows ──
    let lastUi = '';
    let lastHud = '';
    let hudAt = 0;
    const tell = (type, data) => rt.events?.emit(type, data);
    function report(dt) {
      const ready = g.world.loaded(g.player.x, g.player.z);
      const ui = { mode, seed: g.seed, loaded: g.world.chunks.size, wanted: wanted().keys.length, ready };
      const k = JSON.stringify(ui);
      if (k !== lastUi) {
        lastUi = k;
        tell('ui', ui);
      }
      hudAt += dt;
      if (hudAt < 0.1) return;
      hudAt = 0;
      const p = g.player;
      const hud = { selected, health: p.health, hunger: p.hunger, air: p.air < 300 ? p.air : null };
      const h = JSON.stringify(hud);
      if (h !== lastHud) {
        lastHud = h;
        tell('hud', hud);
      }
    }

    const world = {
      get game() {
        return g;
      },
      scene,
      debug: {
        teleport(x, y, z) {
          Object.assign(g.player, { x, y, z, vx: 0, vy: 0, vz: 0, fallFrom: y });
          g.prev = { x, y, z };
        },
        stats: () => ({ chunks: g.world.chunks.size, flying: flying.size, ...scene.chunks.stats(), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
      },
      resize(w, h) {
        scene.resize(w, h);
      },
      step(dt, snap) {
        load();
        if (mode === 'play') {
          if (pressed(snap, 'pause')) mode = 'pause';
          for (let n = 1; n <= 9; n++) if (pressed(snap, `slot${n}`)) selected = n - 1;
          const p = g.player;
          p.yaw -= look.dx * SENSITIVITY;
          p.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, p.pitch - look.dy * SENSITIVITY));
          if (snap.pad?.rx || snap.pad?.ry) {
            p.yaw -= (snap.pad.rx ?? 0) * dt * 3;
            p.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, p.pitch - (snap.pad.ry ?? 0) * dt * 2));
          }
          look.dx = look.dy = 0;
          acc += dt;
          const { ticks, left } = ticksFor(acc);
          acc = left;
          const input = ticks ? inputOf(snap) : null;
          for (let i = 0; i < ticks; i++) {
            g.prev = { x: p.x, y: p.y, z: p.z };
            tick(g, input);
          }
          drain(g);
        } else {
          look.dx = look.dy = 0;
          acc = 0;
          // the title turns slowly round the spawn
          if (mode === 'title') g.player.yaw += dt * 0.05;
        }
        report(dt);
      },
      draw() {
        scene.sync(g, mode === 'play' ? acc / TICK : 1);
        scene.render();
      },
      wants: () => true,
      lowerQuality(level) {
        const d = distanceFor(tier, level);
        if (d === distance) return;
        distance = d;
        g.renderDistance = d;
        scene.setRenderDistance(d);
      },
      // from the page
      look(dx, dy) {
        look.dx += dx;
        look.dy += dy;
      },
      press(name, down) {
        if (down) touch.held.add(name);
        else touch.held.delete(name);
      },
      stick(x, y) {
        touch.x = x;
        touch.y = y;
      },
      scroll(dir) {
        selected = (((selected + Math.sign(dir)) % 9) + 9) % 9;
      },
      select(slot) {
        selected = slot;
      },
      start() {
        if (mode === 'title') g.player.yaw = 0;
        mode = 'play';
      },
      pause(on) {
        if (on && mode === 'play') mode = 'pause';
        else if (!on && mode === 'pause') mode = 'play';
      },
      newWorld(seed) {
        begin(seed ?? randomSeed());
        mode = 'play';
      },
      toTitle() {
        mode = 'title';
      },
      dispose() {
        gone = true;
        worker.terminate();
        rt.input.unbind();
        scene.dispose();
        renderer.toneMapping = was.toneMapping;
        renderer.toneMappingExposure = was.exposure;
        renderer.shadowMap.enabled = was.shadows;
      },
    };
    rt.input.bind(KEYS);
    return world;
  },
};
