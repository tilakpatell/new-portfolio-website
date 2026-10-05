import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Photo from '../Photo';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';
import { use3D } from '../../lib/gpu';
import { device } from '../../lib/device';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../lib/hooks';
import { capturePointer } from '../../lib/pointer';
import { readPad, typing } from '../games/pad';
import { useTravellers } from '../middleearth/towns/useTravellers';
import { HOME_CITY } from '../../data/places';
import { countryName, globeData } from '../travel/globe3d/data';
import { AROUND_KM, CLOUD_ALT, HOME_V, KM, STAMPS, add, angle, aroundWorld, arrivals, autopilot, bearingOf, bearingTo, cross, easeLook, fly, kmBetween, logTrail, newFlight, newLook, nextStamp, packPose, placeById, rotate, scale, seaName, sunVec, toLonLat, turnLook, unit } from './rules';
import { addFlown, addStamp, readFlown, readStamps, stampDate, useFlown, useStamps } from './stamps';
import './earth.css';

// Earth, the world: it opens in orbit, over the globe as it is right now
// (the sun where it really is), and flies you down onto it, into the seat
// behind a little plane over Syracuse. Fly it (or let the autopilot) to the
// places I've been: each one is a stamp in your passport and a postcard.
// The flight log keeps the trail flown and the distance, over every visit,
// and the way round the world adds up to an achievement. Drag while flying
// to look round the plane (it settles back behind), and V swaps the chase
// camera for the cockpit. Everyone else online flying the Earth shows as a
// pale plane with their name (the Middle-earth towns' travellers, in a room
// of its own): nothing passes between you but where each of you is.
// The rules are in ./rules.js, the drawing in ./scene.js; this is the keys,
// the camera's dive, the HUD and the postcards. Without 3D, the passport is
// a page of postcards.

const sounds = () => import('./sounds');
const SUN = 'tp-earth-sun'; // 'real' | 'day'
const CAM = 'tp-earth-cam'; // 'chase' | 'cockpit'
const DIVE = 2.8; // seconds, orbit to the plane
const RISE = 1.9;
const fmt = new Intl.NumberFormat('en-US');
const km = (n) => `${fmt.format(Math.round(n / 10) * 10)} km`;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (deg) => COMPASS[Math.round(deg / 45) % 8];

const CODES = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  Space: 'boost',
  KeyR: 'roll',
};
const SAVE_KM = 25; // the distance flown is written down every so many km
const CLOUD_KM = Math.round(CLOUD_ALT * KM); // the cloud deck, in km up

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
function orbitOver(p, sun) {
  const a = angle(p, sun);
  if (a < 0.7) return p;
  return unit(rotate(p, unit(cross(p, sun)), Math.min(0.7, a)));
}

// the sun for "always daytime": high over the plane's left shoulder
const daySun = (f) => unit(add(add(scale(f.p, 0.74), scale(cross(f.p, f.h), 0.48)), scale(f.h, -0.46)));

export default function EarthWorld() {
  const three = use3D();
  const [gl, setGl] = useState('loading');
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="earth-world" aria-labelledby="earth-title">
      {world ? <World gl={gl} setGl={setGl} /> : <Cards three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ gl, setGl }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const { unlock } = useAchievements();
  const canvas = useRef(null);
  const api = useRef(null);
  const labels = useRef({});
  const arrow = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const f = newFlight();
    const sun = sunVec();
    sim.current = { f, sun, sunMode: local.get(SUN, 'day') === 'real' ? 'real' : 'day', mode: 'orbit', view: 0, orbit: orbitOver(f.p, sun), keys: new Set(), pressed: new Set(), stick: { x: 0, y: 0 }, boostTouch: false, padBefore: {}, stamped: new Set(Object.keys(readStamps())), away: false, target: null, touched: false, engine: null, overT: 0, hudT: 0, drag: null, trail: [], trailV: 0, flown: readFlown(), kmSaved: 0, look: newLook(), cockpit: local.get(CAM, 'chase') === 'cockpit', others: [] };
  }
  // the other pilots online (middleearth/towns/useTravellers), longitude and latitude for x and z
  const trav = useTravellers('earth', gl === 'on', { bound: 200, motion: true });
  const [mode, setMode] = useState('orbit');
  const [sunMode, setSunMode] = useState(sim.current.sunMode);
  const [cockpit, setCockpit] = useState(sim.current.cockpit);
  const [hud, setHud] = useState({ over: '', heading: 0, next: null, target: null, night: false, km: 0, alt: 0 });
  const [postcard, setPostcard] = useState(null);
  const [passport, setPassport] = useState(false);
  const stamps = useStamps();
  const flown = useFlown();
  const paused = useRef(false);
  paused.current = Boolean(postcard) || passport;

  // the world: made once
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    const small = device().tier !== 'high';
    import('./scene')
      .then(({ createEarth }) => {
        if (dead || !canvas.current) return null;
        return createEarth(canvas.current, { onLost: () => !dead && setGl('lost'), small });
      })
      .then(async (a) => {
        if (!a) return undefined;
        if (dead) return a.dispose();
        api.current = a;
        fit();
        await a.ready;
        if (dead) return undefined;
        const s = sim.current;
        await a.warm({ flight: s.f, sun: s.sun, view: 0, stamped: s.stamped, orbit: s.orbit });
        if (dead) return undefined;
        if (import.meta.env.DEV) window.__EARTH__ = { api: a, sim: s }; // for the QA scripts
        setGl('on');
        return undefined;
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error(e);
        if (!dead) setGl('failed');
      });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    const s = sim.current;
    return () => {
      dead = true;
      ro?.disconnect();
      s.engine?.stop();
      s.engine = null;
      if (s.f.km - s.kmSaved > 0.5) {
        addFlown(s.f.km - s.kmSaved);
        s.kmSaved = s.f.km;
      }
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl]);

  const live = gl === 'on' && inView;

  // ── going down, and back up ──
  const dive = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'fly' || s.mode === 'dive') return;
    audioContext();
    s.mode = 'dive';
    setMode('dive');
    sounds().then((x) => x.rush(DIVE));
  }, []);
  const rise = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'orbit' || s.mode === 'rise') return;
    s.orbit = orbitOver(s.f.p, s.sun);
    s.mode = 'rise';
    setMode('rise');
    sounds().then((x) => x.rush(RISE));
  }, []);

  // first time in: a moment over the globe, then down, unless you've
  // started looking round first
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    if (s.touched || s.mode !== 'orbit' || s.dived) return undefined;
    const id = setTimeout(() => {
      if (!s.touched && s.mode === 'orbit') {
        s.dived = true;
        dive();
      }
    }, 2200);
    return () => clearTimeout(id);
  }, [live, dive]);

  const goTo = useCallback(
    (id) => {
      const s = sim.current;
      s.target = id;
      setPassport(false);
      if (s.mode === 'orbit' || s.mode === 'rise') dive();
    },
    [dive],
  );

  const toggleSun = useCallback(() => {
    const s = sim.current;
    s.sunMode = s.sunMode === 'day' ? 'real' : 'day';
    local.set(SUN, s.sunMode);
    setSunMode(s.sunMode);
  }, []);

  const toggleCam = useCallback(() => {
    const s = sim.current;
    s.cockpit = !s.cockpit;
    local.set(CAM, s.cockpit ? 'cockpit' : 'chase');
    setCockpit(s.cockpit);
  }, []);

  const closePostcard = useCallback(() => setPostcard(null), []);

  // the engines, while flying on screen
  useEffect(() => {
    const s = sim.current;
    const on = live && (mode === 'fly' || mode === 'dive') && !postcard;
    if (on && !s.engine) sounds().then((x) => {
      if (!s.engine && sim.current === s) s.engine = x.engine();
    });
    if (!on && s.engine) {
      s.engine.stop();
      s.engine = null;
    }
  }, [live, mode, postcard]);

  // keys
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
      if (e.key === 'Escape') {
        if (postcard) closePostcard();
        else if (passport) setPassport(false);
        else s.target = null;
        return;
      }
      if (postcard) {
        if ((e.key === 'Enter' || e.key === ' ') && !onButton) {
          e.preventDefault();
          closePostcard();
        }
        return;
      }
      if (e.code === 'KeyM') {
        s.touched = true;
        if (s.mode === 'fly' || s.mode === 'dive') rise();
        else dive();
        return;
      }
      if (e.code === 'KeyP') {
        setPassport((v) => !v);
        return;
      }
      if (e.code === 'KeyN') {
        toggleSun();
        return;
      }
      if (e.code === 'KeyV') {
        toggleCam();
        return;
      }
      const k = CODES[e.code];
      if (!k) {
        if (e.key === 'Enter' && !onButton && (s.mode === 'orbit' || s.mode === 'rise')) dive();
        return;
      }
      if (onButton && e.code === 'Space') return;
      e.preventDefault();
      audioContext();
      s.touched = true;
      if ((s.mode === 'orbit' || s.mode === 'rise') && k !== 'boost' && k !== 'roll') dive();
      if (!e.repeat) s.pressed.add(k);
      s.keys.add(k);
    };
    const up = (e) => {
      const k = CODES[e.code];
      if (k) s.keys.delete(k);
    };
    const blur = () => s.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      s.keys.clear();
    };
  }, [live, postcard, passport, closePostcard, dive, rise, toggleSun, toggleCam]);

  // dragging the globe round in orbit (a click on a place flies there);
  // flying, a drag looks round the plane, and it settles back when let go
  const onPointerDown = (e) => {
    const s = sim.current;
    if (s.mode !== 'orbit' && s.mode !== 'fly') return;
    capturePointer(e);
    s.touched = true;
    s.drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId, look: s.mode === 'fly' };
  };
  const onPointerMove = (e) => {
    const s = sim.current;
    const d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    d.x = e.clientX;
    d.y = e.clientY;
    if (d.look) {
      if (!s.cockpit) turnLook(s.look, -dx * 0.006, dy * 0.004);
      return;
    }
    let o = rotate(s.orbit, [0, 1, 0], -dx * 0.005);
    const right = unit(cross([0, 1, 0], o));
    const tilted = rotate(o, right, dy * 0.005);
    if (Math.abs(tilted[1]) < 0.93) o = tilted;
    s.orbit = unit(o);
  };
  const onPointerUp = (e) => {
    const s = sim.current;
    const d = s.drag;
    s.drag = null;
    s.look.held = false;
    if (!d || d.look || d.moved > 6 || !api.current) return;
    const r = canvas.current.getBoundingClientRect();
    const id = api.current.pick(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
    if (id) goTo(id);
  };

  // the touch stick: turn and climb
  const stickRef = useRef(null);
  const onStick = (e) => {
    const el = stickRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(x, y);
    const k = m > 1 ? 1 / m : 1;
    sim.current.stick = { x: x * k, y: y * k };
    el.style.setProperty('--sx', (x * k).toFixed(2));
    el.style.setProperty('--sy', (y * k).toFixed(2));
  };
  const stickUp = () => {
    sim.current.stick = { x: 0, y: 0 };
    stickRef.current?.style.setProperty('--sx', 0);
    stickRef.current?.style.setProperty('--sy', 0);
  };

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const dt = Math.min(0.05, ms / 1000);
    const f = s.f;
    const pad = readPad();
    const before = s.padBefore;
    const tapped = (b) => Boolean(pad?.[b] && !before[b]);
    s.padBefore = pad ?? {};
    if (tapped('y')) setPassport((v) => !v);
    if (tapped('start') || tapped('x')) (s.mode === 'fly' || s.mode === 'dive' ? rise : dive)();
    const roll = s.pressed.has('roll') || tapped('b');
    if (tapped('rb')) toggleCam();
    s.pressed.clear();
    // looking round: a pad's right stick holds the view; otherwise it settles
    if (pad && (Math.abs(pad.rx) > 0 || Math.abs(pad.ry) > 0) && !s.cockpit) turnLook(s.look, -pad.rx * dt * 2.5, pad.ry * dt * 1.5);
    else if (!s.drag?.look) s.look.held = false;
    easeLook(s.look, dt);

    // the camera's dive and climb
    if (s.mode === 'dive') {
      s.view = Math.min(1, s.view + dt / DIVE);
      if (s.view >= 1) {
        s.mode = 'fly';
        setMode('fly');
      }
    } else if (s.mode === 'rise') {
      s.view = Math.max(0, s.view - dt / RISE);
      if (s.view <= 0) {
        s.mode = 'orbit';
        setMode('orbit');
      }
    }

    // the sun: where it is now, or kept over your shoulder
    const realSun = sunVec();
    const wantSun = s.sunMode === 'day' && s.mode !== 'orbit' ? daySun(f) : realSun;
    s.sun = unit(add(s.sun, scale(add(wantSun, scale(s.sun, -1)), 1 - Math.exp(-2.5 * dt))));

    // flying (not in orbit, not while a postcard's up)
    const flying = (s.mode === 'fly' || s.mode === 'dive') && !paused.current;
    if (flying) {
      const held = (k) => s.keys.has(k);
      let turn = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x;
      let climb = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
      if (pad) {
        turn += pad.lx + (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
        climb += -pad.ly + (pad.up ? 1 : 0) - (pad.down ? 1 : 0);
      }
      const manual = Math.abs(turn) > 0.15 || Math.abs(climb) > 0.15;
      if (manual && s.mode === 'fly') s.target = null; // taking the controls back
      const boost = held('boost') || s.boostTouch || Boolean(pad?.a || pad?.rt);
      const goal = s.target === 'home' ? HOME_V : s.target ? placeById(s.target)?.v : null;
      const input = goal ? { ...autopilot(f, goal), roll } : { turn, climb, boost, roll };
      const wasRolling = f.rolling;
      fly(f, input, dt);
      if (f.rolling && !wasRolling) sounds().then((x) => x.roll());
      s.engine?.set(f.speed > 0.15 ? Math.min(1, (f.speed - 0.11) / 0.23) : 0);
      // the log: the trail, and the distance written down as it adds up
      if (logTrail(s.trail, f.p, f.alt)) s.trailV++;
      if (f.km - s.kmSaved > SAVE_KM) {
        s.flown = addFlown(f.km - s.kmSaved);
        s.kmSaved = f.km;
        if (s.flown >= AROUND_KM) unlock('roundtheworld');
      }
      const r = arrivals(f, s.stamped, s.away);
      s.away = r.away;
      for (const e of r.ev) {
        if (e.type === 'stamp') {
          const all = addStamp(e.id);
          if (s.target === e.id) s.target = null;
          setPostcard({ id: e.id, date: all[e.id] });
          sounds().then((x) => {
            x.chime();
            setTimeout(() => x.stamp(), 900);
          });
          if (Object.keys(all).length >= STAMPS.length) unlock('passport');
        } else if (e.type === 'home') {
          if (s.target === 'home') s.target = null;
          setPostcard({ id: 'home' });
          sounds().then((x) => x.chime());
        }
      }
    }

    // the other pilots: where you are to them (not while you're up in orbit), and where they are
    const tv = trav.ref.current;
    tv?.pose(packPose(f), { inside: !flying && s.mode !== 'fly' });
    s.others = tv ? tv.list() : [];

    a.render({ flight: f, sun: s.sun, view: s.view, stamped: s.stamped, orbit: s.orbit, trail: s.trail, trailV: s.trailV, look: s.look, cockpit: s.cockpit, travellers: s.others }, ms);

    // the labels over the places on screen
    const close = s.mode === 'fly' || s.mode === 'dive';
    for (const st of [...STAMPS, { id: 'home', v: HOME_V }]) {
      const el = labels.current[st.id];
      if (!el) continue;
      const o = a.screenOf(st.v, 0.012);
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

    // the HUD: a few times a second
    const n = nextStamp(f, s.stamped);
    const goal = s.target === 'home' ? { name: HOME_CITY, v: HOME_V } : s.target ? placeById(s.target) : null;
    const rel = goal ? ((((bearingTo(f.p, goal.v) - bearingOf(f.p, f.h)) % 360) + 540) % 360) - 180 : (n?.rel ?? 0);
    if (arrow.current) arrow.current.style.transform = `rotate(${rel.toFixed(1)}deg)`;
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.25;
      s.overT -= 0.25;
      if (s.overT <= 0 || !s.over) {
        s.overT = 1;
        s.over = under(f.p);
      }
      setHud((h) => {
        const next = {
          over: s.over,
          heading: Math.round(bearingOf(f.p, f.h)),
          next: goal ? { name: goal.name, km: kmBetween(f.p, goal.v) } : n ? { name: n.name, km: n.km } : null,
          target: goal?.name ?? null,
          night: f.p[0] * s.sun[0] + f.p[1] * s.sun[1] + f.p[2] * s.sun[2] < -0.05,
          km: Math.round(f.km / 10) * 10,
          alt: Math.round(f.alt * KM),
        };
        return h.over === next.over && h.heading === next.heading && h.target === next.target && h.night === next.night && h.km === next.km && h.alt === next.alt && Math.round(h.next?.km ?? -1) === Math.round(next.next?.km ?? -1) ? h : next;
      });
    }
  }, live);

  const count = Object.keys(stamps).length;
  const card = postcard && postcard.id !== 'home' ? STAMPS.find((x) => x.id === postcard.id) : null;
  const flyingNow = mode === 'fly' || mode === 'dive';
  // the distance flown over every visit, with this flight's since it was last written down
  const flownAll = flown + Math.max(0, hud.km - Math.round(sim.current.kmSaved / 10) * 10);

  return (
    <div ref={box}>
      <div className="earth-stage" data-mode={mode}>
        <canvas ref={canvas} className="earth-canvas" data-on={gl === 'on' || undefined} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => (sim.current.drag = null)} role="img" aria-label="The Earth in 3D, with a plane flying over it to the places in the passport. Arrow keys or W A S D to fly, Shift to go faster, R for a barrel roll, V for the cockpit, M for orbit, P for the passport." />
        {gl !== 'on' && <p className="earth-loading">Coming in from orbit…</p>}

        <div className="earth-labels" aria-hidden={mode !== 'orbit' || undefined}>
          {[...STAMPS, { id: 'home', name: HOME_CITY }].map((st) => (
            <button key={st.id} type="button" ref={(el) => (labels.current[st.id] = el)} className="earth-label" data-home={st.id === 'home' || undefined} onClick={() => goTo(st.id)} tabIndex={-1}>
              {st.name}
            </button>
          ))}
        </div>

        <div className="earth-hud earth-hud-top">
          <div className="earth-brand">
            <h1 id="earth-title" className="earth-title">
              Earth
            </h1>
            <p className="earth-sub">
              {flyingNow ? (
                <>
                  Over {hud.over || '…'}
                  {hud.night ? ' · night' : ''}
                </>
              ) : (
                'Every trip, from Syracuse'
              )}
            </p>
          </div>
          <div className="earth-chips">
            <button type="button" className="earth-chip" onClick={() => setPassport((v) => !v)} aria-expanded={passport}>
              Passport <b>{count}/{STAMPS.length}</b> <kbd>P</kbd>
            </button>
            <button type="button" className="earth-chip" onClick={flyingNow ? rise : dive}>
              {flyingNow ? 'Orbit' : 'Fly down'} <kbd>M</kbd>
            </button>
            <button type="button" className="earth-chip" onClick={toggleSun} aria-pressed={sunMode === 'day'} title="The sun where it really is now, or always over your shoulder">
              {sunMode === 'day' ? 'Always day' : 'Sun: now'} <kbd>N</kbd>
            </button>
            {flyingNow && (
              <button type="button" className="earth-chip" onClick={toggleCam} aria-pressed={cockpit} title="The chase camera, or the view from the cockpit">
                {cockpit ? 'Cockpit' : 'Chase'} <kbd>V</kbd>
              </button>
            )}
            {trav.available &&
              (trav.on ? (
                <span className="earth-chip earth-chip-online" title="Everyone else online flying the Earth shows as a pale plane from another world: nothing passes between you but where each of you is">
                  <b>{trav.count}</b> {trav.count === 1 ? 'other pilot' : 'other pilots'}
                </span>
              ) : (
                <button type="button" className="earth-chip earth-chip-online" onClick={trav.join} title="Go online, and see everyone else flying the Earth as a pale plane from another world">
                  See other pilots
                </button>
              ))}
          </div>
        </div>

        {mode === 'orbit' && gl === 'on' && !postcard && (
          <div className="earth-orbit-card">
            <p>The Earth right now, the sun where it really is. Drag to turn it; pick a place to fly there.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={dive}>
              Fly down onto the globe
            </button>
          </div>
        )}

        {flyingNow && gl === 'on' && (
          <div className="earth-instruments" aria-live="off">
            <span className="earth-heading">
              {compass(hud.heading)} <b>{String(hud.heading).padStart(3, '0')}°</b>
            </span>
            {hud.next && (
              <span className="earth-next">
                <svg ref={arrow} viewBox="0 0 24 24" className="earth-arrow" aria-hidden="true">
                  <path d="M12 3l6 14-6-4-6 4z" />
                </svg>
                {hud.target ? 'Autopilot to ' : 'Next: '}
                <b>{hud.next.name}</b> · {km(hud.next.km)}
              </span>
            )}
            <span className="earth-flown" title="Flown this flight, and how high">
              {km(hud.km)} flown · {hud.alt} km up{hud.alt * 1 < CLOUD_KM ? ', under the clouds' : ''}
            </span>
            {hud.target && (
              <button type="button" className="earth-chip earth-chip-sm" onClick={() => (sim.current.target = null)}>
                Take the controls <kbd>Esc</kbd>
              </button>
            )}
          </div>
        )}
        {flyingNow && gl === 'on' && !touch && !hud.target && <p className="earth-hint">← → turn · ↑ ↓ climb and descend · Shift faster · R barrel roll · drag to look round · V cockpit · P passport</p>}

        {touch && flyingNow && gl === 'on' && (
          <div className="earth-touch">
            <div
              ref={stickRef}
              className="earth-stick"
              onPointerDown={(e) => {
                capturePointer(e);
                onStick(e);
              }}
              onPointerMove={onStick}
              onPointerUp={stickUp}
              onPointerCancel={stickUp}
              onLostPointerCapture={stickUp}
              aria-hidden="true"
            >
              <span />
            </div>
            <button
              type="button"
              className="earth-boost"
              onPointerDown={(e) => {
                e.preventDefault();
                capturePointer(e);
                sim.current.boostTouch = true;
              }}
              onPointerUp={() => (sim.current.boostTouch = false)}
              onPointerCancel={() => (sim.current.boostTouch = false)}
              onLostPointerCapture={() => (sim.current.boostTouch = false)}
            >
              Faster
            </button>
            <button
              type="button"
              className="earth-roll"
              onPointerDown={(e) => {
                e.preventDefault();
                sim.current.pressed.add('roll');
              }}
            >
              Roll
            </button>
          </div>
        )}

        {passport && (
          <div className="earth-passport" role="dialog" aria-label="Passport">
            <div className="earth-passport-head">
              <p>
                Passport <b>{count}/{STAMPS.length}</b>
              </p>
              <button type="button" className="earth-x" onClick={() => setPassport(false)} aria-label="Close the passport">
                ×
              </button>
            </div>
            <p className="earth-log">
              <span>
                <b>{km(flownAll)}</b> flown over every flight
              </span>
              <span className="earth-log-bar" aria-hidden="true">
                <i style={{ width: `${(aroundWorld(flownAll) * 100).toFixed(1)}%` }} />
              </span>
              <span>{aroundWorld(flownAll) >= 1 ? 'Round the world' : `${Math.round(aroundWorld(flownAll) * 100)}% of the way round the world`}</span>
            </p>
            <ol className="earth-pages">
              {STAMPS.map((st) => (
                <li key={st.id} data-got={stamps[st.id] ? '' : undefined}>
                  <span className="earth-pname">{st.name}</span>
                  {stamps[st.id] ? (
                    <span className="earth-pdate">{stampDate(stamps[st.id])}</span>
                  ) : (
                    <span className="earth-pkm">{km(kmBetween(HOME_V, st.v))}</span>
                  )}
                  <button type="button" className="earth-fly" onClick={() => goTo(st.id)}>
                    Fly here
                  </button>
                </li>
              ))}
              <li data-home="">
                <span className="earth-pname">{HOME_CITY}</span>
                <span className="earth-pkm">Home</span>
                <button type="button" className="earth-fly" onClick={() => goTo('home')}>
                  Fly home
                </button>
              </li>
            </ol>
          </div>
        )}

        {postcard && (
          <div className="earth-postcard" role="dialog" aria-modal="false" aria-labelledby="earth-card-title">
            {card ? (
              <>
                <div className="earth-postcard-photo">
                  <Photo id={card.id} sizes="(min-width: 768px) 420px, 90vw" className="h-full w-full object-cover" />
                  <span className="earth-stamp" aria-hidden="true">
                    <b>{card.name}</b>
                    <i>{stampDate(postcard.date)}</i>
                  </span>
                </div>
                <div className="earth-postcard-text">
                  <p className="earth-postcard-kicker">
                    Stamp {Object.keys(stamps).length} of {STAMPS.length}
                  </p>
                  <h2 id="earth-card-title">{card.name}</h2>
                  <p>{card.photo}</p>
                  <p className="earth-postcard-km">
                    {km(kmBetween(HOME_V, card.v))} from {HOME_CITY}
                  </p>
                  <div className="earth-postcard-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={closePostcard} autoFocus>
                      Keep flying
                    </button>
                    <Link to={`/travel?place=${card.id}`} className="btn btn-ghost btn-sm">
                      On the travel page
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="earth-postcard-text">
                <h2 id="earth-card-title">Home</h2>
                <p>{HOME_CITY}, New York. Every route on the globe starts here.</p>
                <div className="earth-postcard-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={closePostcard} autoFocus>
                    Keep flying
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Cards({ three, gl, retry }) {
  const stamps = useStamps();
  return (
    <div className="shell earth-cards-wrap">
      <h1 id="earth-title" className="title">
        Earth
      </h1>
      <p className="lead mt-4 max-w-[60ch]">The globe in 3D, from orbit down to a little plane you fly to every place I’ve been. Each one is a stamp in your passport.</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s the passport instead.' : gl === 'failed' ? 'The 3D globe couldn’t start here, so here’s the passport instead.' : three.held ? 'The 3D globe isn’t loaded yet, so here’s the passport.' : '3D is switched off, so here’s the passport.'}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (!three.on) three.set('auto');
              retry();
            }}
          >
            {three.on ? 'Try 3D again' : three.held ? 'Load the 3D' : 'Turn 3D on'}
          </button>
        </p>
      )}
      <ul className="earth-cards">
        {STAMPS.map((st) => (
          <li key={st.id} data-got={stamps[st.id] ? '' : undefined}>
            <Link to={`/travel?place=${st.id}`}>
              <Photo id={st.id} sizes="(min-width: 768px) 280px, 50vw" className="aspect-[4/3] w-full object-cover" />
              <span className="earth-cards-name">{st.name}</span>
              <span className="earth-cards-km">{km(kmBetween(HOME_V, st.v))} from {HOME_CITY}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
