// Earth, the world module: the flight on the runtime. It owns what
// EarthWorld.jsx used to run every frame (the orbit, the dive, the plane
// flown by the keys, the pad and the touch stick, the autopilot, the log,
// the stamps and the sun), reads the runtime's input snapshot, draws
// through ./scene.js on the runtime's renderer, and tells the component
// what changed through events: 'mode' { mode }, 'hud' { over, heading,
// next, target, night, km, alt }, 'postcard' { id, date }, 'passport' {},
// 'sun' { mode }, 'cam' { cockpit }, 'achievement' { id }.
//
// Props: { small, labels (an object of the place labels' elements, by id),
// arrow (the HUD's arrow element), travellers (a ref to the other pilots'
// link, middleearth/towns/useTravellers) }. The world adds: dive(), rise(),
// goTo(id), clearTarget(), toggleSun(), toggleCam(), roll(), setBoost(on),
// setPaused(on), touched(), and `sim` for the QA scripts; tune() gives the
// ?debug panel its values (runtime/debug.js): the exposure the globe's
// shaders are seen at, the sun (kept over your shoulder, or where it is
// now) and the camera, the last two as the N and V keys set them.

import { HOME_CITY } from '../../data/places';
import { countryName, globeData } from '../travel/globe3d/data';
import { ALT, AROUND_KM, HOME_V, LOOK, ROLL, SPEED, KM, STAMPS, add, angle, arrivals, autopilot, bearingOf, bearingTo, cross, easeLook, fly, kmBetween, logTrail, newFlight, newLook, nextStamp, packPose, placeById, rotate, scale, seaName, sunVec, toLonLat, turnLook, unit } from './rules';
import { addFlown, addStamp, readFlown, readStamps } from './stamps';

const sounds = () => import('./sounds');
export const SUN = 'tp-earth-sun'; // 'real' | 'day'
export const CAM = 'tp-earth-cam'; // 'chase' | 'cockpit'
export const DIVE = 2.8; // seconds, orbit to the plane
export const RISE = 1.9;
export const FIRST_DIVE = 2.2; // seconds over the globe before the first dive, unless you've touched it
const SAVE_KM = 25; // the distance flown is written down every so many km
const HUD_EVERY = 0.25; // seconds between HUD events

export const KEYS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  boost: ['ShiftLeft', 'ShiftRight', 'Space'],
  roll: ['KeyR'],
  orbit: ['KeyM'],
  passport: ['KeyP'],
  sun: ['KeyN'],
  cam: ['KeyV'],
};
const FLIGHT_KEYS = new Set([...KEYS.left, ...KEYS.right, ...KEYS.up, ...KEYS.down]);

// what's under the plane: a country (from the travel globe's dots), or a sea
let land = null;
function under(p) {
  if (!land) land = globeData();
  let best = -1;
  let at = -1;
  const { xyz, owner, count } = land;
  for (let i = 0; i < count; i++) {
    const d = xyz[i * 3] * p[0] + xyz[i * 3 + 1] * p[1] + xyz[i * 3 + 2] * p[2];
    if (d > best) {
      best = d;
      at = i;
    }
  }
  if (best > Math.cos(0.02)) return countryName(owner[at]) ?? seaName(toLonLat(p));
  return seaName(toLonLat(p));
}

// the camera's spot in orbit for a plane at p: over it, swung towards the sun
// so the opening shows the day side and the night side both
export function orbitOver(p, sun) {
  const a = angle(p, sun);
  if (a < 0.7) return p;
  return unit(rotate(p, unit(cross(p, sun)), Math.min(0.7, a)));
}

// the sun for "always daytime": high over the plane's left shoulder
const daySun = (f) => unit(add(add(scale(f.p, 0.74), scale(cross(f.p, f.h), 0.48)), scale(f.h, -0.46)));

// (a Space on a focused button is the button's)
const onButton = () => typeof document !== 'undefined' && (document.activeElement instanceof HTMLButtonElement || document.activeElement instanceof HTMLAnchorElement);

export default {
  id: 'earth',
  shading: 'nodes',
  mb: 2,
  label: 'The Earth in 3D, with a plane flying over it to the places in the passport. Arrow keys or W A S D to fly, Shift to go faster, R for a barrel roll, V for the cockpit, M for orbit, P for the passport.',
  async create(rt, { small = false, labels = {}, arrow = null, travellers = null } = {}) {
    const { createEarth } = await import('./scene');
    const { saves, events } = rt;
    sounds().then((x) => x.setBus(rt.audio.bus()));
    const api = createEarth(rt.gfx.renderer, { small, lost: () => rt.gfx?.lost ?? true, compile: (scene, camera) => rt.gfx.compile(scene, camera) });
    const f = newFlight();
    const sun = sunVec();
    const s = {
      f,
      sun,
      sunMode: saves.get(SUN, 'day') === 'real' ? 'real' : 'day',
      mode: 'orbit',
      view: 0,
      orbit: orbitOver(f.p, sun),
      stamped: new Set(Object.keys(readStamps(saves))),
      away: false,
      target: null,
      touched: false,
      dived: false,
      sinceStart: 0,
      engine: null,
      over: '',
      overT: 0,
      hudT: 0,
      trail: [],
      trailV: 0,
      flown: readFlown(saves),
      kmSaved: 0,
      look: newLook(),
      cockpit: saves.get(CAM, 'chase') === 'cockpit',
      others: [],
      boostTouch: false,
      rollNext: false,
      paused: false,
      moved: 0,
      wasDown: false,
    };
    let size = { w: 1, h: 1 };
    let disposed = false;
    const hud = { over: '', heading: 0, next: null, target: null, night: false, km: 0, alt: 0 };

    const setMode = (mode) => {
      s.mode = mode;
      events.emit('mode', { mode });
    };
    const dive = () => {
      if (s.mode === 'fly' || s.mode === 'dive') return;
      rt.audio.context();
      setMode('dive');
      sounds().then((x) => x.rush(DIVE));
    };
    const rise = () => {
      if (s.mode === 'orbit' || s.mode === 'rise') return;
      s.orbit = orbitOver(s.f.p, s.sun);
      setMode('rise');
      sounds().then((x) => x.rush(RISE));
    };
    const goTo = (id) => {
      s.target = id;
      if (s.mode === 'orbit' || s.mode === 'rise') dive();
    };
    const toggleSun = () => {
      s.sunMode = s.sunMode === 'day' ? 'real' : 'day';
      saves.set(SUN, s.sunMode);
      events.emit('sun', { mode: s.sunMode });
    };
    const toggleCam = () => {
      s.cockpit = !s.cockpit;
      saves.set(CAM, s.cockpit ? 'cockpit' : 'chase');
      events.emit('cam', { cockpit: s.cockpit });
    };
    const flying = () => s.mode === 'fly' || s.mode === 'dive';

    // the engines, while flying and not paused
    const engines = () => {
      const on = flying() && !s.paused;
      if (on && !s.engine) {
        s.engine = 'coming';
        sounds().then((x) => {
          if (s.engine === 'coming' && !disposed) s.engine = x.engine();
          else if (disposed && s.engine === 'coming') s.engine = null;
        });
      }
      if (!on && s.engine) {
        if (s.engine !== 'coming') s.engine.stop();
        s.engine = null;
      }
    };
    const saveFlown = () => {
      if (s.f.km - s.kmSaved > 0.5) {
        s.flown = addFlown(s.f.km - s.kmSaved, saves);
        s.kmSaved = s.f.km;
      }
    };

    rt.input.bind(KEYS, { axes: { turn: ['left', 'right'], climb: ['down', 'up'] } });

    const keys = (input) => {
      const tap = (name) => KEYS[name].some((c) => input.pressed.has(c));
      if (tap('orbit')) {
        s.touched = true;
        if (flying()) rise();
        else dive();
      }
      if (tap('passport')) events.emit('passport', {});
      if (tap('sun')) toggleSun();
      if (tap('cam')) toggleCam();
      if (input.pressed.has('Enter') && !onButton() && (s.mode === 'orbit' || s.mode === 'rise')) dive();
      for (const code of input.pressed) {
        if (FLIGHT_KEYS.has(code) || (KEYS.boost.includes(code) && !(code === 'Space' && onButton())) || KEYS.roll.includes(code)) {
          s.touched = true;
          if ((s.mode === 'orbit' || s.mode === 'rise') && !KEYS.boost.includes(code) && !KEYS.roll.includes(code)) dive();
        }
      }
      if (tap('roll')) s.rollNext = true;
      // the pad
      const { tapped, pad } = input;
      if (tapped.y) events.emit('passport', {});
      if (tapped.start || tapped.x) (flying() ? rise : dive)();
      if (tapped.b) s.rollNext = true;
      if (tapped.rb) toggleCam();
      return pad;
    };

    // dragging the globe round in orbit (a click on a place flies there);
    // flying, a drag looks round the plane, and it settles back when let go
    const pointer = (input) => {
      const p = input.pointer;
      if (p.down) {
        if (!s.wasDown) s.moved = 0;
        if (p.drag) {
          s.moved += Math.abs(p.drag.dx) + Math.abs(p.drag.dy);
          s.touched = true;
          if (s.mode === 'fly') {
            if (!s.cockpit) turnLook(s.look, -p.drag.dx * 0.006, p.drag.dy * 0.004);
          } else if (s.mode === 'orbit') {
            let o = rotate(s.orbit, [0, 1, 0], -p.drag.dx * 0.005);
            const right = unit(cross([0, 1, 0], o));
            const tilted = rotate(o, right, p.drag.dy * 0.005);
            if (Math.abs(tilted[1]) < 0.93) o = tilted;
            s.orbit = unit(o);
          }
        }
      } else {
        if (s.wasDown) {
          s.look.held = false;
          if (s.moved <= 6 && (s.mode === 'orbit' || s.mode === 'fly')) {
            const id = api.pick((p.x / size.w) * 2 - 1, 1 - (p.y / size.h) * 2);
            if (id) goTo(id);
          }
        }
      }
      s.wasDown = p.down;
    };

    const step = (dt, input) => {
      if (disposed) return;
      const paused = s.paused;
      const pad = paused ? null : keys(input);
      if (!paused) pointer(input);
      // looking round: a pad's right stick holds the view; otherwise it settles
      if (pad && (Math.abs(pad.rx) > 0 || Math.abs(pad.ry) > 0) && !s.cockpit) turnLook(s.look, -pad.rx * dt * 2.5, pad.ry * dt * 1.5);
      else if (!(input.pointer.down && s.mode === 'fly')) s.look.held = false;
      easeLook(s.look, dt);

      // first time in: a moment over the globe, then down, unless you've started looking round first
      if (s.mode === 'orbit' && !s.dived && !s.touched) {
        s.sinceStart += dt;
        if (s.sinceStart >= FIRST_DIVE) {
          s.dived = true;
          dive();
        }
      }

      // the camera's dive and climb
      if (s.mode === 'dive') {
        s.view = Math.min(1, s.view + dt / DIVE);
        if (s.view >= 1) setMode('fly');
      } else if (s.mode === 'rise') {
        s.view = Math.max(0, s.view - dt / RISE);
        if (s.view <= 0) setMode('orbit');
      }
      engines();

      // the sun: where it is now, or kept over your shoulder
      const realSun = sunVec();
      const wantSun = s.sunMode === 'day' && s.mode !== 'orbit' ? daySun(f) : realSun;
      s.sun = unit(add(s.sun, scale(add(wantSun, scale(s.sun, -1)), 1 - Math.exp(-2.5 * dt))));

      // flying (not in orbit, not while a dialog's up)
      const inAir = flying() && !paused;
      if (inAir) {
        let turn = input.axis('turn') + input.stick.x;
        let climb = input.axis('climb') - input.stick.y;
        if (pad) {
          turn += pad.lx + (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
          climb += -pad.ly + (pad.up ? 1 : 0) - (pad.down ? 1 : 0);
        }
        const manual = Math.abs(turn) > 0.15 || Math.abs(climb) > 0.15;
        if (manual && s.mode === 'fly') s.target = null; // taking the controls back
        const boost = (input.action('boost') && !(input.keys.has('Space') && !input.keys.has('ShiftLeft') && !input.keys.has('ShiftRight') && onButton())) || s.boostTouch || Boolean(pad?.a || pad?.rt);
        const roll = s.rollNext;
        s.rollNext = false;
        const goal = s.target === 'home' ? HOME_V : s.target ? placeById(s.target)?.v : null;
        const control = goal ? { ...autopilot(f, goal), roll } : { turn, climb, boost, roll };
        const wasRolling = f.rolling;
        fly(f, control, dt);
        if (f.rolling && !wasRolling) sounds().then((x) => x.roll());
        if (s.engine && s.engine !== 'coming') s.engine.set(f.speed > 0.15 ? Math.min(1, (f.speed - 0.11) / 0.23) : 0);
        // the log: the trail, and the distance written down as it adds up
        if (logTrail(s.trail, f.p, f.alt)) s.trailV++;
        if (f.km - s.kmSaved > SAVE_KM) {
          s.flown = addFlown(f.km - s.kmSaved, saves);
          s.kmSaved = f.km;
          if (s.flown >= AROUND_KM) events.emit('achievement', { id: 'roundtheworld' });
        }
        const r = arrivals(f, s.stamped, s.away);
        s.away = r.away;
        for (const e of r.ev) {
          if (e.type === 'stamp') {
            const all = addStamp(e.id, new Date(), saves);
            s.stamped.add(e.id);
            if (s.target === e.id) s.target = null;
            events.emit('postcard', { id: e.id, date: all[e.id] });
            sounds().then((x) => {
              x.chime();
              setTimeout(() => x.stamp(), 900);
            });
            if (Object.keys(all).length >= STAMPS.length) events.emit('achievement', { id: 'passport' });
          } else if (e.type === 'home') {
            if (s.target === 'home') s.target = null;
            events.emit('postcard', { id: 'home' });
            sounds().then((x) => x.chime());
          }
        }
      } else s.rollNext = false;

      // the other pilots: where you are to them (not while you're up in orbit), and where they are
      const tv = travellers?.current ?? null;
      tv?.pose(packPose(f), { inside: !inAir && s.mode !== 'fly' });
      s.others = tv ? tv.list() : [];

      // the HUD: the arrow every frame, the numbers a few times a second
      const n = nextStamp(f, s.stamped);
      const goal = s.target === 'home' ? { name: HOME_CITY, v: HOME_V } : s.target ? placeById(s.target) : null;
      const rel = goal ? ((((bearingTo(f.p, goal.v) - bearingOf(f.p, f.h)) % 360) + 540) % 360) - 180 : (n?.rel ?? 0);
      if (arrow?.current) arrow.current.style.transform = `rotate(${rel.toFixed(1)}deg)`;
      s.hudT -= dt;
      if (s.hudT <= 0) {
        s.hudT = HUD_EVERY;
        s.overT -= HUD_EVERY;
        if (s.overT <= 0 || !s.over) {
          s.overT = 1;
          s.over = under(f.p);
        }
        const next = {
          over: s.over,
          heading: Math.round(bearingOf(f.p, f.h)),
          next: goal ? { name: goal.name, km: kmBetween(f.p, goal.v) } : n ? { name: n.name, km: n.km } : null,
          target: goal?.name ?? null,
          night: f.p[0] * s.sun[0] + f.p[1] * s.sun[1] + f.p[2] * s.sun[2] < -0.05,
          km: Math.round(f.km / 10) * 10,
          alt: Math.round(f.alt * KM),
        };
        const same = hud.over === next.over && hud.heading === next.heading && hud.target === next.target && hud.night === next.night && hud.km === next.km && hud.alt === next.alt && Math.round(hud.next?.km ?? -1) === Math.round(next.next?.km ?? -1);
        if (!same) {
          Object.assign(hud, next);
          events.emit('hud', { ...next });
        }
      }
    };

    const draw = ({ dt }) => {
      if (disposed) return;
      api.render({ flight: f, sun: s.sun, view: s.view, stamped: s.stamped, orbit: s.orbit, trail: s.trail, trailV: s.trailV, look: s.look, cockpit: s.cockpit, travellers: s.others, t: s.held }, dt * 1000);
      // the labels over the places on screen
      const close = flying();
      for (const st of [...STAMPS, { id: 'home', v: HOME_V }]) {
        const el = labels[st.id];
        if (!el) continue;
        const o = api.screenOf(st.v, 0.012);
        const near = !close || angle(f.p, st.v) < 0.5;
        if (!o.on || !near) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.transform = `translate(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px) translate(-50%, -120%)`;
        if (s.stamped.has(st.id)) el.dataset.got = '';
        else delete el.dataset.got;
      }
    };

    // behind ?debug, after the look: the flight's own numbers (rules.js reads them live)
    const num = (o, key, label, min, max, step) => ({ key, label, type: 'range', min, max, step, get: () => o[key], set: (v) => {
      o[key] = v;
    } });
    const groups = [
      { name: 'flight', items: [num(SPEED, 'cruise', 'cruise (rad/s)', 0.01, 0.6, 0.005), num(SPEED, 'slow', 'slow', 0.01, 0.3, 0.005), num(SPEED, 'fast', 'fast', 0.05, 1, 0.01), num(SPEED, 'ease', 'speed ease /s', 0.2, 6, 0.1), num(ALT, 'climb', 'climb', 0.005, 0.1, 0.001)] },
      { name: 'look', items: [num(LOOK, 'settle', 'look settles /s', 0.5, 10, 0.1), num(ROLL, 'time', 'barrel roll (s)', 0.4, 3, 0.05)] },
    ];

    const world = {
      sim: s,
      api,
      ready: Promise.resolve(api.ready).then(() => api.warm({ flight: s.f, sun: s.sun, view: 0, stamped: s.stamped, orbit: s.orbit })),
      resize(w, h) {
        size = { w, h };
        api.resize(w, h);
      },
      step,
      draw,
      wants: () => true,
      dive,
      rise,
      goTo,
      clearTarget: () => {
        s.target = null;
      },
      toggleSun,
      toggleCam,
      roll: () => {
        s.rollNext = true;
      },
      setBoost: (on) => {
        s.boostTouch = Boolean(on);
      },
      setPaused: (on) => {
        s.paused = Boolean(on);
      },
      touched: () => {
        s.touched = true;
      },
      handoff: () => ({ flight: { ...f }, sun: [...s.sun], mode: s.mode, cockpit: s.cockpit }),
      tune: () => [
        {
          name: 'earth',
          items: [
            // (read off the renderer each time: scene.js sets it, and the renderer reads it each frame)
            { key: 'exposure', type: 'range', min: 0.4, max: 3, get: () => rt.gfx?.renderer?.toneMappingExposure ?? 1, set: (v) => rt.gfx?.renderer && (rt.gfx.renderer.toneMappingExposure = v) },
            { key: 'sun', type: 'select', options: ['day', 'real'], get: () => s.sunMode, set: (v) => v !== s.sunMode && toggleSun() },
            { key: 'cockpit', type: 'bool', get: () => s.cockpit, set: (v) => Boolean(v) !== s.cockpit && toggleCam() },
          ],
        },
        ...groups,
      ],
      dispose() {
        disposed = true;
        if (s.engine && s.engine !== 'coming') s.engine.stop();
        s.engine = null;
        saveFlown();
        api.dispose();
        if (import.meta.env.DEV && typeof window !== 'undefined' && window.__EARTH__?.sim === s) delete window.__EARTH__;
      },
    };
    // (development: a named view for scripts/gpu-parity.mjs, the world put
    // somewhere fixed and held still, the clouds' drift and the beacons'
    // pulse too, so two renders of it can be compared: 'orbit', the globe
    // as it opens over home; 'low', at the lowest the plane flies, over
    // Syracuse heading east)
    if (import.meta.env.DEV) {
      world.view = (name) => {
        if (name !== 'orbit' && name !== 'low') throw new Error(`no view ${name}`);
        Object.assign(f, newFlight({ bearing: name === 'low' ? 90 : 75 }));
        if (name === 'low') f.alt = ALT.min;
        Object.assign(s, { touched: true, dived: true, paused: true, target: null, look: newLook(), cockpit: false, view: name === 'low' ? 1 : 0, trail: [], trailV: s.trailV + 1, held: 1000 });
        s.sun = s.sunMode === 'day' && name === 'low' ? daySun(f) : sunVec();
        s.orbit = orbitOver(f.p, s.sun);
        setMode(name === 'low' ? 'fly' : 'orbit');
        api.snap?.();
      };
    }
    if (import.meta.env.DEV && typeof window !== 'undefined') window.__EARTH__ = { api, sim: s, world }; // for the QA scripts
    return world;
  },
};
