// The flight over a planet (/fly/:planet) as a world module on the runtime:
// the ship under ./flightRules.js from the runtime's input snapshot, the
// scene round it (./scene.js), the planet's ground streamed in under it
// (./ground.js: leaves made in a worker through rt.workers), all drawn
// relative to the floating origin (rt.origin, moved after anchor() before
// each step). The planet comes in as props.spec
// (lib/land/flight/planetSpec.js's). It starts at lib/device's tier (the
// runtime's quality) and sheds uploads and clutter a tier at a time when
// the pace says the frames run late (lowerQuality).
//
// It tells the page through rt.events:
//   'hud' { speed, alt } (ten times a second at most)
//   'toast' { text } (a crash)
// and gives the page (and the checks) the world's `ship`, `stats()` and
// `throttle(v)` (the touch buttons'); ?debug shows the ground's numbers.

import * as THREE from 'three';
import { houseOn } from '../../../lib/three/house';
import { planetField } from '../../../lib/land/flight/field';
import { LEVELS } from '../../../lib/device';
import { SHIP, crashed, stepShip } from './flightRules';
import { createFlightScene } from './scene';
import { createGround } from './ground';
import { LOOK } from './look';

export const KEYS = {
  noseDown: ['KeyW', 'ArrowUp'],
  noseUp: ['KeyS', 'ArrowDown'],
  rollLeft: ['KeyA'],
  rollRight: ['KeyD'],
  yawLeft: ['KeyQ', 'ArrowLeft'],
  yawRight: ['KeyE', 'ArrowRight'],
  faster: ['ShiftLeft', 'ShiftRight', 'KeyR'],
  // (Ctrl alone: the input drops a key held with Ctrl, so F is the one that works)
  slower: ['KeyF', 'ControlLeft', 'ControlRight'],
};
// (pitch −1 is the nose down, yaw +1 a turn to the left: flightRules.js's)
export const AXES = { pitch: ['noseDown', 'noseUp'], roll: ['rollLeft', 'rollRight'], yaw: ['yawRight', 'yawLeft'], throttle: ['slower', 'faster'] };

const HUD_EVERY = 0.1; // s
const RESPAWN_UP = 200; // m over the ground, after a crash
const START = { speed: 160, up: 300 };

// the tier the ground keeps at a pace level: one lower from the third step on, two at the floor
export function tierAt(tier, level = 0) {
  const i = Math.max(0, LEVELS.indexOf(tier));
  return LEVELS[Math.max(0, i - (level >= 4 ? 2 : level >= 2 ? 1 : 0))];
}

// where a planet's flight begins: south of its first POI, heading for it, or over the middle
export function spawnOf(spec, groundAt) {
  const poi = spec.pois?.[0];
  const [x, z] = poi ? [poi.at[0], poi.at[1] + 3400] : [0, 0];
  const g = groundAt(x, z);
  return { x, y: (Number.isFinite(g) ? g : 0) + START.up, z, pitch: 0, yaw: 0, roll: 0, speed: START.speed };
}

// the input snapshot as the ship's four axes, the touch stick added in
export function inputOf(snap) {
  const stick = snap?.stick ?? { x: 0, y: 0 };
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  return {
    pitch: clamp((snap?.axis?.('pitch') ?? 0) + stick.y),
    roll: clamp((snap?.axis?.('roll') ?? 0) + stick.x),
    yaw: snap?.axis?.('yaw') ?? 0,
    throttle: snap?.axis?.('throttle') ?? 0,
  };
}

export default {
  id: 'flight',
  shading: 'glsl',
  mb: 1, // (WORLD_MB['/fly']: drawn in code, nothing fetched)
  label: 'A ship flying low over an endless planet',
  async create(rt, props = {}) {
    const spec = props.spec;
    if (!spec) throw new Error('the flight needs a planet');
    let renderer = rt.gfx.renderer;
    const was = { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, shadows: renderer.shadowMap.enabled };
    renderer.shadowMap.enabled = false;

    const view = createFlightScene({ spec, palette: LOOK.palette });
    const tier = LEVELS.includes(rt.quality?.tier) ? rt.quality.tier : 'mid';
    const ground = createGround(view.scene, { rt, spec, tier, palette: LOOK.palette });
    // the planet's own field, here on the page, for where to start and to come
    // back up to before the ground under the ship is in (a few samples, not a mesh)
    const field = planetField(spec);
    const groundAt = (x, z) => {
      const h = ground.heightUnder(x, z);
      return Number.isFinite(h) ? h : field.heightAt(x, z);
    };

    const house = houseOn({ renderer, scene: view.scene, sun: view.sun, hemi: view.hemi, look: { fog: true } });
    // (the ground's and the clutter's materials, on no leaf yet: in the look before their first draw)
    for (const m of ground.materials) house.adopt(new THREE.Mesh(undefined, m));
    house.sky({ low: new THREE.Color(spec.palette.low), high: new THREE.Color(LOOK.palette[3]), sunDir: view.sunDir });

    rt.input.bind(KEYS, { axes: AXES });
    let ship = spawnOf(spec, groundAt);
    let hudIn = 0;
    let touchThrottle = 0; // the touch buttons' (FlightHud), −1, 0 or 1
    const tell = (type, data) => rt.events?.emit(type, data);
    const unOrigin =
      rt.origin?.on?.((shift) => {
        view.shift(shift);
        ground.origin(rt.origin.at);
      }) ?? (() => {});

    const world = {
      get ship() {
        return ship;
      },
      set ship(s) {
        ship = { ...ship, ...s };
      },
      anchor: () => [ship.x, ship.y, ship.z],
      throttle(v) {
        touchThrottle = v;
      },
      resize(w, h) {
        view.resize(w, h);
      },
      step(dt, snap) {
        const input = inputOf(snap);
        input.throttle = Math.max(-1, Math.min(1, input.throttle + touchThrottle));
        ship = stepShip(ship, input, dt);
        ground.update(ship);
        // (a crash only on ground drawn: what isn't in yet can't be hit)
        const g = ground.heightUnder(ship.x, ship.z);
        if (crashed(ship, g)) {
          tell('toast', { text: 'Too low: back up you go.' });
          ship = { ...ship, y: g + RESPAWN_UP, pitch: 0, roll: 0, speed: Math.max(SHIP.speedMin, 120) };
        }
        const at = rt.origin?.at ?? [0, 0, 0];
        view.place(ship, at, dt);
        hudIn -= dt;
        if (hudIn <= 0) {
          hudIn = HUD_EVERY;
          tell('hud', { speed: ship.speed, alt: ship.y - groundAt(ship.x, ship.z) });
        }
      },
      draw(frame) {
        renderer = frame?.renderer ?? rt.gfx.renderer;
        renderer.render(view.scene, view.camera);
      },
      wants: () => true,
      lowerQuality(level) {
        ground.setTier(tierAt(tier, level));
      },
      stats: () => ground.stats(),
      tune: () => [
        {
          name: 'Ground',
          items: ['leaves', 'flying', 'pending', 'clutter'].map((key) => ({ key, label: key, type: 'range', min: 0, max: 5000, step: 1, get: () => ground.stats()[key], set: () => {} })),
        },
      ],
      dispose() {
        if (typeof window !== 'undefined' && window.__FLIGHT__ === world) delete window.__FLIGHT__;
        unOrigin();
        rt.input.unbind();
        ground.dispose();
        view.dispose();
        Object.assign(renderer, { toneMapping: was.toneMapping, toneMappingExposure: was.exposure });
        renderer.shadowMap.enabled = was.shadows;
      },
    };
    view.place(ship, rt.origin?.at ?? [0, 0, 0]);
    // (the dev hook the checks fly by: scripts/autopilot-check's smoke, scripts/perf-probe's journey)
    if (typeof window !== 'undefined') window.__FLIGHT__ = world;
    return world;
  },
};
