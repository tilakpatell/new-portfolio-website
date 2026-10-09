// The flight over a planet (/fly/:planet) as a world module on the runtime:
// the ship under ./flightRules.js from the runtime's input snapshot, the
// scene round it (./scene.js), drawn relative to the floating origin
// (rt.origin, moved after anchor() before each step). The planet comes in
// as props.spec (lib/land/flight/planetSpec.js's).
//
// It tells the page through rt.events:
//   'hud' { speed, alt } (ten times a second at most)
//   'toast' { text } (a crash)
// and gives the page (and the checks) the world's `ship`, `stats()`.

import * as THREE from 'three';
import { houseOn } from '../../../lib/three/house';
import { SHIP, crashed, stepShip } from './flightRules';
import { createFlightScene } from './scene';
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
    // the ground, until the streamed one is in (Task 8 puts it in)
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshStandardMaterial({ color: spec.palette.low, roughness: 0.95 }));
    plane.rotation.x = -Math.PI / 2;
    view.scene.add(plane);
    const groundAt = () => 0;

    const house = houseOn({ renderer, scene: view.scene, sun: view.sun, hemi: view.hemi, look: { fog: true } });
    house.sky({ low: new THREE.Color(spec.palette.low), high: new THREE.Color(LOOK.palette[3]), sunDir: view.sunDir });

    rt.input.bind(KEYS, { axes: AXES });
    let ship = spawnOf(spec, groundAt);
    let hudIn = 0;
    let touchThrottle = 0; // the touch buttons' (FlightHud), −1, 0 or 1
    const tell = (type, data) => rt.events?.emit(type, data);
    const unOrigin = rt.origin?.on?.((shift) => view.shift(shift)) ?? (() => {});

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
        const g = groundAt(ship.x, ship.z);
        if (crashed(ship, g)) {
          tell('toast', { text: 'Too low: back up you go.' });
          ship = { ...ship, y: g + RESPAWN_UP, pitch: 0, roll: 0, speed: Math.max(SHIP.speedMin, 120) };
        }
        const at = rt.origin?.at ?? [0, 0, 0];
        view.place(ship, at, dt);
        plane.position.set(-at[0], 0, -at[2]);
        hudIn -= dt;
        if (hudIn <= 0) {
          hudIn = HUD_EVERY;
          tell('hud', { speed: ship.speed, alt: ship.y - (Number.isFinite(g) ? g : 0) });
        }
      },
      draw(frame) {
        renderer = frame?.renderer ?? rt.gfx.renderer;
        renderer.render(view.scene, view.camera);
      },
      wants: () => true,
      dispose() {
        unOrigin();
        rt.input.unbind();
        view.dispose();
        plane.geometry.dispose();
        plane.material.dispose();
        Object.assign(renderer, { toneMapping: was.toneMapping, toneMappingExposure: was.exposure });
        renderer.shadowMap.enabled = was.shadows;
      },
    };
    view.place(ship, rt.origin?.at ?? [0, 0, 0]);
    if (import.meta.env?.DEV) window.__FLIGHT__ = world;
    return world;
  },
};
