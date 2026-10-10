import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { debugOn, debugPanel } from '../../../lib/debugPanel';
import { readPad, typing } from '../../games/pad';
import { fitCanvas } from '../../../runtime/hud';
import Pollos from '../Pollos';
import { rankFor } from '../metherria/rules';
import { CAREER, readCareer } from './career';
import { Home, Saul } from './places';
import { useAchievements } from '../../Achievements';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import { CRYSTALS, DRIVING, DRIVING_KEY, DROPS, PLACES, SPAWN, TIMES, WASH, WORLD_RADIUS, atWash, createSafeSpot, createStreets, crystalAt, nearPlace, progress, readDriving, startRun, stepCar, stepHeat, stepRun, stepSteer, stepTraffic, timeName } from './rules';
import { carSound } from './sounds';
import AbqHud, { Title } from './AbqHud';
import { drawMap } from './map';
import './world.css';
import '../../../styles/lazy/albuquerque.css';
import LoadingVeil from '../../worlds/LoadingVeil';
import { throttled } from '../../worlds/loadingSteps';

// Albuquerque, the world: drive Walt's Aztek round town, and go into the
// places as they open. The rules are in ./rules.js, the drawing in
// ./scene.js, the HUD in ./AbqHud.jsx; this is the wheel and the doors. The car slides if
// it's asked to: Space is the handbrake, which swings the tail round (a
// handbrake turn, a drift, a J-turn out of reverse), and the wheel's speed,
// how much the car catches its own slides and how tightly the camera follows
// are the driver's to set (the Driving panel, or O). Each place opens over
// the page (its game, or Walt's house, or Saul's office); leave and you're
// back in the car at its door. Without 3D, the places are a grid of cards.
// Online (the site's own switch), everyone else driving Albuquerque shows as
// a ghost Aztek, and you in theirs (the Middle-earth towns' travellers, a
// room of its own: ../../middleearth/towns/useTravellers.js); in a place,
// you're out of their sight till you're back in the car.

const Metherria = lazy(() => import('../metherria/Metherria'));
const CasaTranquila = lazy(() => import('../casa/CasaTranquila'));
const clip = (id, opts) => import('../../../lib/clips').then((c) => c.playClip(id, opts));

const VISITED = 'tp-abq-visited';
const OPENED = 'tp-abq-opened'; // what was open last time, to light up what's new
const PARKED = 'tp-abq-car';
const BLUE = 'tp-abq-blue'; // the Blue Sky crystals found so far
const readBlue = () => {
  const b = local.get(BLUE, []);
  return Array.isArray(b) ? b.filter((id) => CRYSTALS.some((c) => c.id === id)) : [];
};
const readSnap = () => {
  const c = readCareer();
  return { served: c.served, points: c.points, money: c.money, upgrades: c.upgrades, visited: local.get(VISITED, []) };
};
const ENTER_LINE = { rv: () => clip('jesseRing', { when: 0.3 }), saul: () => clip('saulHi', { when: 0.3 }), pollos: () => clip('gusHello', { when: 0.4 }) };
const PIZZAS = 'tp-abq-pizzas'; // how many are on Walt's roof
// the Aztek's horn: two reedy notes
function honk() {
  const ac = audioContext();
  if (!ac) return;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, ac.currentTime);
  out.gain.exponentialRampToValueAtTime(0.16, ac.currentTime + 0.02);
  out.gain.setValueAtTime(0.16, ac.currentTime + 0.3);
  out.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.42);
  out.connect(ac.destination);
  for (const f of [392, 494]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(out);
    o.start();
    o.stop(ac.currentTime + 0.45);
  }
}
const clockText = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
const KEYS = { up: ['ArrowUp', 'w'], down: ['ArrowDown', 's'], left: ['ArrowLeft', 'a'], right: ['ArrowRight', 'd'] };
// a key by one name whether or not Shift or Caps Lock is on (a W let go as
// "w" would otherwise stay held, and the car would drive on by itself)
const keyOf = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
// the keys a slider keeps for itself while it has the focus
const SLIDER = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const BOUND = WORLD_RADIUS + 20; // (how far out a driver's step can be: the fence, and a bit)
// where you are, for the other drivers (towns/travellers.js's step)
const stepOf = (car, speed = car.speed) => ({ x: car.x, z: car.z, face: Math.atan2(Math.sin(car.yaw), Math.cos(car.yaw)), speed: Math.abs(speed) });
const DRIVE = new Set(Object.values(KEYS).flat().concat(' '));
const MPH = 2.23694;

export default function AbqWorld() {
  const three = use3D();
  const [snap, setSnap] = useState(readSnap);
  const prog = progress(snap);
  const [inside, setInside] = useState(null);
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const [toast, setToast] = useState(null);
  const api = useRef(null);
  const placeRef = useRef(null);

  // what's opened since last time: a toast and a beam of light over it
  const announce = useCallback((p) => {
    const before = new Set(local.get(OPENED, ['home', 'rv']));
    const fresh = p.places.filter((x) => x.open && !before.has(x.id));
    local.set(
      OPENED,
      p.places.filter((x) => x.open).map((x) => x.id),
    );
    if (!fresh.length) return;
    setToast({ text: `${fresh.map((x) => x.name).join(' and ')} ${fresh.length > 1 ? 'are' : 'is'} open.`, at: Date.now() });
    for (const x of fresh) api.current?.beam(x.id);
  }, []);

  const enter = (id) => {
    const p = prog.places.find((x) => x.id === id);
    if (!p?.open) return;
    audioContext();
    placeRef.current = id;
    const visited = local.get(VISITED, []);
    if (!visited.includes(id)) local.set(VISITED, [...visited, id]);
    ENTER_LINE[id]?.();
    setInside(id);
  };
  const leave = () => {
    setInside(null);
    const s = readSnap();
    setSnap(s);
    announce(progress(s));
  };

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="abq-world" aria-labelledby="abq-title" data-mode={world ? '3d' : 'cards'}>
      {world ? (
        <World api={api} prog={prog} snap={snap} inside={inside} enter={enter} gl={gl} setGl={setGl} announce={announce} toast={toast} setToast={setToast} refresh={() => setSnap(readSnap())} />
      ) : (
        <Cards prog={prog} enter={enter} three={three} gl={gl} retry={() => setGl('loading')} />
      )}
      {inside && <Place id={inside} onLeave={leave} />}
    </section>
  );
}

function World({ api, prog, snap, inside, enter, gl, setGl, announce, toast, setToast, refresh }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.35 });
  const canvas = useRef(null);
  const map = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const parked = local.get(PARKED, null);
    const ok = parked && Number.isFinite(parked.x) && Math.hypot(parked.x, parked.z) < WORLD_RADIUS;
    const car = { ...(ok ? { x: parked.x, z: parked.z, yaw: Number.isFinite(parked.yaw) ? parked.yaw : SPAWN.yaw } : SPAWN), speed: 0, slide: 0, yawRate: 0 };
    // the town's traffic (Hank first, in his SUV), none of it on top of you
    const traffic = createStreets(touch ? 18 : 34, { avoid: [car] });
    sim.current = { car, safe: createSafeSpot(car), traffic, t: 0, heat: 0, keys: new Set(), stick: { x: 0, y: 0 }, hand: false, steer: 0, frame: 0, moved: false, blue: readBlue(), clock: TIMES[0].id, sound: null };
  }
  const { unlock } = useAchievements();
  // the other drivers online, as ghosts (towns/useTravellers)
  const trav = useTravellers('abq', gl === 'on', { bound: BOUND });
  const travRef = trav.ref;
  const [hud, setHud] = useState({ near: null, heat: 0, moved: false, wash: false, run: null });
  const [blue, setBlue] = useState(() => sim.current.blue.length);
  const [clock, setClock] = useState(TIMES[0]);
  // a delivery: a drop out in the desert, and a clock
  const runDelivery = useCallback(() => {
    const s = sim.current;
    const a = api.current;
    if (!a || s.run) return;
    audioContext();
    const run = startRun(s.car, Math.floor(Math.random() * DROPS.length));
    s.run = { ...run, left: run.time };
    a.setDrop(run);
    setToast({ text: `A buyer’s waiting at ${run.name}. ${Math.round(run.dist)} m, ${clockText(run.time)} on the clock.`, at: Date.now() });
  }, [api, setToast]);
  // a pizza, onto Walt's roof
  const throwPizza = useCallback(() => {
    const s = sim.current;
    const a = api.current;
    if (!a || s.near !== 'home') return;
    audioContext();
    if (!a.throwPizza(s.car)) return;
    const n = (Number(local.get(PIZZAS, 0)) || 0) + 1;
    local.set(PIZZAS, n);
    setTimeout(() => import('../../../lib/sfx').then((x) => x.knock()).catch(() => {}), 850);
    setToast({ text: n === 1 ? 'It’s on the roof.' : `${n} pizzas on the roof. Skyler’s going to love this.`, at: Date.now() });
  }, [api, setToast]);
  // the A1A: suds, then on your way
  const washCar = useCallback(() => {
    const s = sim.current;
    const a = api.current;
    if (!a || s.washing || !atWash(s.car.x, s.car.z)) return;
    audioContext();
    s.washing = true;
    a.wash();
    import('../../../lib/sfx').then((x) => x.sizzle()).catch(() => {});
    setTimeout(() => {
      s.washing = false;
      setToast({ text: 'Have an A1 day!', at: Date.now() });
    }, WASH.seconds * 1000);
  }, [api, setToast]);
  // on to the next time of day: the sun runs round to it
  const nextTime = useCallback(() => {
    const a = api.current;
    if (!a) return;
    const now = timeName(a.time);
    const next = TIMES[(TIMES.findIndex((t) => t.id === now.id) + 1) % TIMES.length];
    a.setTime(next.tod);
    setClock(next);
    sim.current.clock = next.id;
  }, [api]);
  // stuck (wedged between a wall and a truck, or up against the fence): back
  // to the last place it drove clean from (rules.js createSafeSpot), stopped,
  // through a quick fade so it isn't a jump cut
  const recover = useCallback(() => {
    const s = sim.current;
    const a = api.current;
    const c = canvas.current;
    if (!a || s.recovering) return;
    s.recovering = true;
    if (c) {
      c.style.transition = 'opacity 130ms ease-out';
      c.style.opacity = '0';
    }
    setTimeout(() => {
      s.car = s.safe.back();
      s.steer = 0;
      api.current?.settle();
      if (c) c.style.opacity = '1';
      setTimeout(() => {
        if (c) c.style.transition = '';
        s.recovering = false;
      }, 130);
    }, 130);
  }, [api]);
  const [list, setList] = useState(false);
  // the driving settings: live (the frame loop reads them) and kept
  const [driving, setDriving] = useState(() => readDriving(local.get(DRIVING_KEY, null)));
  const drivingRef = useRef(driving);
  drivingRef.current = driving;
  const [tuning, setTuning] = useState(false);
  const changeDriving = useCallback((next) => {
    const d = readDriving(next);
    setDriving(d);
    local.set(DRIVING_KEY, d);
  }, []);
  const speedo = useRef(null);
  const progRef = useRef(prog);
  progRef.current = prog;
  const hudKey = useRef('');

  // the world: made once, kept while you're inside a place
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createAbqWorld }) => createAbqWorld(canvas.current, { onLost: () => !dead && setGl('lost') }))
      .then(async (a) => {
        if (dead) return a.dispose();
        api.current = a;
        if (import.meta.env.DEV) window.__ABQ__ = { api: a, sim: sim.current }; // for the QA scripts
        a.setPlaces(progRef.current);
        a.setBlue(sim.current.blue, sim.current.blue.length === CRYSTALS.length);
        a.setPizzas(Number(local.get(PIZZAS, 0)) || 0);
        fit();
        // everything on the graphics chip before it's shown, behind the loading screen
        await a.prepare?.(throttled(setPrep), { alive: () => !dead });
        if (dead) return;
        setGl('on');
        announce(progRef.current);
      })
      .catch(() => !dead && setGl('failed'));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    return () => {
      dead = true;
      ro?.disconnect();
      const s = sim.current;
      local.set(PARKED, { x: s.car.x, z: s.car.z, yaw: s.car.yaw });
      s.sound?.stop();
      s.sound = null;
      api.current?.dispose();
      api.current = null;
    };
  }, [api, setGl, announce]);

  // the map's canvas: as many pixels as the screen has under it (sharp on a
  // 2× screen, and at a phone's smaller map), fitted when its box changes,
  // never a frame; ./map.js draws in its own 150 units at any size
  const mapBox = useRef(null);
  useEffect(() => {
    const c = map.current;
    if (!c) return undefined;
    const fit = () => (mapBox.current = fitCanvas(c, 150));
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(c);
    return () => ro?.disconnect();
  }, []);

  // the signs and markers follow what's open
  useEffect(() => {
    api.current?.setPlaces(prog);
  }, [api, prog]);

  // in a place: out of the other drivers' sight (said every second, as the
  // frame loop that'd say where you are is stopped)
  useEffect(() => {
    if (!inside) return undefined;
    const say = () => travRef.current?.pose(stepOf(sim.current.car, 0), { inside: true });
    say();
    const t = setInterval(say, 1000);
    return () => clearInterval(t);
  }, [inside, travRef]);

  // keys: drive while the world's on screen and nothing's open over it. (The
  // listeners read what they need through `acts`, so they stay put while
  // you drive: put back on every render, they'd let go of every key held
  // each time a toast came up or a door came near.)
  const live = gl === 'on' && inView && !inside;
  const near = hud.near;
  const acts = useRef(null);
  acts.current = { near, enter, nextTime, runDelivery, throwPizza, washCar, recover };
  const liveRef = useRef(live);
  liveRef.current = live;
  // the engine starts with the first key or touch (a browser plays nothing before one)
  const startSound = useCallback(() => {
    const s = sim.current;
    if (!liveRef.current || s.sound) return;
    if (audioContext()) s.sound = carSound();
  }, []);
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = keyOf(e);
      // a slider in the Driving panel takes its own arrows; a text box, everything
      const t = e.target;
      const slider = t instanceof HTMLInputElement && t.type === 'range';
      if (slider ? SLIDER.has(key) : typing(t)) return;
      const a = acts.current;
      if (DRIVE.has(key)) {
        e.preventDefault();
        // (Space on a button that was clicked would press it again on the way up)
        if (key === ' ' && t instanceof HTMLButtonElement) t.blur();
        s.keys.add(key);
        startSound();
        return;
      }
      if ((key === 'e' || key === 'Enter') && a.near && !(t instanceof HTMLButtonElement)) {
        e.preventDefault();
        a.enter(a.near);
      }
      if (key === 'm') {
        setList((v) => !v);
        setTuning(false);
      }
      if (key === 't') a.nextTime();
      if (key === 'r') a.runDelivery();
      if (key === 'b') a.recover();
      if (key === 'p') a.throwPizza();
      if (key === 'h') honk();
      if (key === 'o') {
        setTuning((v) => !v);
        setList(false);
      }
      // (Esc closes either panel: the Menu, when it's open, takes its own Esc first)
      if (key === 'Escape') {
        setTuning(false);
        setList(false);
      }
      if (key === 'e' && !a.near) a.washCar();
    };
    const up = (e) => s.keys.delete(keyOf(e));
    // away from the window (or the tab put behind another): hands off, engine off
    const blur = () => {
      s.keys.clear();
      s.hand = false;
      s.sound?.stop();
      s.sound = null;
    };
    const hidden = () => document.hidden && blur();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
      // (nobody's driving: the engine stops with the frames)
      blur();
    };
  }, [live, startSound]);

  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const dt = Math.min(0.05, ms / 1000);
    const k = s.keys;
    const held = (name) => KEYS[name].some((key) => k.has(key));
    const pad = readPad();
    const set = drivingRef.current;
    let throttle = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
    // the wheel: the keys turn it at a rate, a stick (a thumb's, or a pad's)
    // says how far itself
    const keyed = (held('left') ? 1 : 0) - (held('right') ? 1 : 0);
    let stick = -s.stick.x;
    let handbrake = k.has(' ') || s.hand;
    if (pad) {
      // (the triggers by how far they're pulled, where the pad says)
      throttle += Math.max(pad.rtv ?? 0, pad.rt ? 1 : 0) - Math.max(pad.ltv ?? 0, pad.lt ? 1 : 0) - pad.ly;
      stick -= pad.lx;
      handbrake ||= pad.x || pad.b || pad.rb;
      if (pad.a && !s.padA && s.near) enter(s.near);
      // (a press of the pad's own is the nearest it has to a key: try the engine then, once)
      if ((pad.a && !s.padA) || (pad.rt && !s.padRt)) startSound();
      // (Y: back on the road, as B is on the keys)
      if (pad.y && !s.padY) recover();
      s.padA = pad.a;
      s.padRt = pad.rt;
      s.padY = pad.y;
    }
    throttle = Math.max(-1, Math.min(1, throttle));
    const analog = keyed === 0 && stick !== 0;
    s.steer = stepSteer(s.steer, analog ? stick : keyed, s.car.speed, dt, { steer: set.steer, analog });
    // the traffic moves on (and waits for you, if you're in its way), then you, bumping off it
    s.t += dt;
    stepTraffic(s.traffic, dt, s.t, [{ x: s.car.x, z: s.car.z, yaw: s.car.yaw, speed: Math.hypot(s.car.speed, s.car.slide ?? 0) }]);
    const movers = s.near3 ?? (s.near3 = []);
    movers.length = 0;
    for (const t of s.traffic) if (Math.abs(t.x - s.car.x) < 14 && Math.abs(t.z - s.car.z) < 14) movers.push({ x: t.x, z: t.z, r: t.route ? 1.7 : 1.5 });
    const { car, bump, force, at: hitAt, slip, surface } = stepCar(s.car, { throttle, steer: s.steer, handbrake, assist: set.assist }, dt, movers);
    s.car = car;
    s.safe.step(car, bump, dt);
    // a bump: a thud by how hard, and a puff where (the law keeps the scrapes quiet)
    if (force > 0) a.hit(force, hitAt);
    if (s.frame % 2 === 0) s.sound?.set({ speed: Math.hypot(car.speed, car.slide), throttle, slip, road: surface === 'road' });
    if (Math.abs(throttle) > 0.1) s.moved = true;
    // the speedometer, written straight to the page (not through React, a
    // few times a second)
    if (s.frame % 6 === 0 && speedo.current) {
      const mph = Math.round(Math.hypot(car.speed, car.slide) * MPH);
      if (mph !== s.mph) {
        s.mph = mph;
        speedo.current.textContent = String(mph);
      }
    }
    // Hank's the first car in the traffic: he minds a car with a load on
    // board, or one tearing past him (rules.js stepHeat), and after he's
    // pulled you over he lets you be for a while
    const hank = s.traffic[0];
    const hankAway = Math.hypot(hank.x - car.x, hank.z - car.z);
    s.hankNear = hankAway < 40;
    s.calm = Math.max(0, (s.calm ?? 0) - dt);
    const h = s.calm > 0 ? { heat: 0, caught: false } : stepHeat(s.heat, hankAway, dt, { speed: Math.hypot(car.speed, car.slide), load: Boolean(s.run) });
    s.heat = h.heat;
    if (h.caught) {
      s.heat = 0;
      // (pulled over where you are: sent home, you'd be back on his rounds)
      s.car = { ...car, speed: 0, slide: 0, yawRate: 0 };
      s.calm = 12;
      setToast({ text: s.run ? 'Hank pulled you over, and found the load. It’s gone.' : 'Hank pulled you over. Slow down near the DEA.', at: Date.now(), bad: true });
      if (s.run) {
        s.run = null;
        a.setDrop(null);
      }
      import('../../../lib/clips').then((c) => c.playClip('hankRing')).catch(() => {});
    }
    const at = nearPlace(car.x, car.z);
    s.near = at?.id ?? null;
    // Blue Sky: drive over a crystal and it's yours
    const gem = crystalAt(car.x, car.z, s.blue);
    if (gem) {
      s.blue = [...s.blue, gem.id];
      local.set(BLUE, s.blue);
      const all = s.blue.length === CRYSTALS.length;
      a.took(gem.id);
      a.setBlue(s.blue, all);
      setBlue(s.blue.length);
      import('../../../lib/sfx').then((x) => x.coin()).catch(() => {});
      setToast({ text: all ? 'All twelve. 99.1% pure: look up tonight.' : `Blue Sky: ${s.blue.length} of ${CRYSTALS.length}.`, at: Date.now() });
      if (all) {
        unlock('purity');
        a.setTime(TIMES[1].tod);
      }
    }
    // a delivery on the clock
    if (s.run) {
      const r = stepRun(s.run, car, s.run.left, dt);
      if (r.state === 'on') s.run.left = r.left;
      else {
        if (r.state === 'made') {
          const c = readCareer();
          local.set(CAREER, { ...c, money: c.money + r.pay });
          refresh();
          import('../../../lib/sfx').then((x) => x.coin()).catch(() => {});
          setToast({ text: `Delivered. $${r.pay} in the bag.`, at: Date.now() });
        } else setToast({ text: 'Too slow. The buyer walked.', at: Date.now(), bad: true });
        s.run = null;
        a.setDrop(null);
      }
    }
    // the HUD's clock follows the day as it turns
    if (s.frame % 30 === 0) {
      const now = timeName(a.time);
      if (now.id !== s.clock) {
        s.clock = now.id;
        setClock(now);
      }
    }
    // (a block, sidewalk or car park, counts as paved: rules.js's surfaceAt)
    const asphalt = surface === 'road';
    // the other drivers: where you are to them, and where they are
    const tv = travRef.current;
    tv?.pose(stepOf(s.car));
    s.others = tv ? tv.list() : [];
    try {
      a.render({ car: s.car, hank, traffic: s.traffic, t: s.t, heat: s.heat, near: at?.id ?? null, steer: s.steer, throttle, handbrake, slip, onRoad: surface !== 'sand', asphalt, bump, follow: set.camera, travellers: s.others }, ms);
    } catch {
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }
    // the HUD, when what it shows changes
    const wash = !at && atWash(car.x, car.z);
    const away = s.run ? Math.round(Math.hypot(s.run.x - car.x, s.run.z - car.z) / 5) * 5 : 0;
    const key = `${at ? `near:${at.id}|` : ''}${Math.round(s.heat * 10)}|${s.hankNear ? 'h' : ''}|${s.moved}|${wash}|${s.run ? `${s.run.id}:${Math.ceil(s.run.left)}:${away}` : ''}`;
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ near: at?.id ?? null, heat: Math.round(s.heat * 10) / 10, hankNear: Boolean(s.hankNear), moved: s.moved, wash, run: s.run ? { name: s.run.name, left: s.run.left, away } : null });
    }
    if (++s.frame % 4 === 0) drawMap(map.current, mapBox.current, s.car, hank, progRef.current, s.blue, s.run, s.others, s.traffic);
  }, live);

  // ?debug: the feel's numbers (the shake, the hit law) and the driving
  // settings, on the one tuning panel (lib/debugPanel); nothing without it
  useEffect(() => {
    const a = api.current;
    if (gl !== 'on' || !a?.tune || !debugOn()) return undefined;
    const item = (key) => ({ key, label: DRIVING[key].label.toLowerCase(), type: 'range', min: DRIVING[key].min, max: DRIVING[key].max, step: DRIVING[key].step, get: () => drivingRef.current[key], set: (v) => changeDriving({ ...drivingRef.current, [key]: v }) });
    const panel = debugPanel({ title: 'Albuquerque' });
    panel.open([...a.tune(), { name: 'driving', items: Object.keys(DRIVING).map(item) }], { title: 'Albuquerque', id: 'albuquerque' });
    return () => panel.dispose();
  }, [gl, api, changeDriving]);

  // the thumbs, on a phone: the kit's stick (read from where the thumb went
  // down), which wakes the engine on its first touch, and the handbrake under
  // the other thumb, on while it's held (lit while it is)
  const onStick = (x, y) => (sim.current.stick = { x, y });
  const wake = () => (audioContext(), startSound());
  const handBtn = useRef(null);
  const hand = {
    onPress: (e) => {
      audioContext();
      sim.current.hand = true;
      startSound();
      handBtn.current = e.currentTarget;
      e.currentTarget.dataset.on = '';
    },
    onRelease: () => {
      sim.current.hand = false;
      delete handBtn.current?.dataset.on;
    },
  };

  const here = near ? prog.places.find((p) => p.id === near) : null;
  const travel = (p) => {
    const s = sim.current;
    // pulled up just past its door, side on, so the camera behind the car
    // looks along the front rather than from inside the building
    const ox = p.door.x - p.at.x;
    const oz = p.door.z - p.at.z;
    const len = Math.hypot(ox, oz) || 1;
    s.car = { x: p.door.x + (ox / len) * 2, z: p.door.z + (oz / len) * 2, yaw: Math.atan2(ox, oz) + Math.PI / 2, speed: 0, slide: 0, yawRate: 0 };
    s.heat = 0;
    api.current?.settle();
    setList(false);
  };
  const rank = rankFor(snap.points);
  return (
    <div ref={box} className="abq-world-stage" data-touch={touch || undefined}>
      <canvas ref={canvas} className="abq-world-canvas" data-on={gl === 'on' || undefined} aria-label="Albuquerque from above Walt’s Aztek: the desert, the Sandias, and the roads into town" role="img" />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Driving into Albuquerque" />
      <AbqHud touch={touch} gl={gl} prog={prog} snap={snap} rank={rank} blue={blue} speedo={speedo} map={map} trav={trav} hud={hud} toast={toast} here={here} inside={inside} enter={enter} throwPizza={throwPizza} washCar={washCar} runDelivery={runDelivery} nextTime={nextTime} clock={clock} tuning={tuning} setTuning={setTuning} list={list} setList={setList} onStick={onStick} wake={wake} hand={hand} driving={driving} changeDriving={changeDriving} travel={travel} />
    </div>
  );
}

// Without 3D: the places as cards.
function Cards({ prog, enter, three, gl, retry }) {
  return (
    <div className="shell abq-cards-wrap">
      <Title />
      <p className="lead mt-4 max-w-[60ch]">Breaking Bad and Better Call Saul. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s the town as cards.' : gl === 'failed' ? 'The 3D town couldn’t start here, so here it is as cards.' : three.held ? `The 3D town isn’t loaded yet (about ${three.hold.mb} MB), so here it is as cards.` : '3D is switched off, so here’s the town as cards.'}
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
      <ul className="abq-cards">
        {prog.places.map((p) => (
          <li key={p.id} data-open={p.open || undefined}>
            <p className="abq-list-name">{p.name}</p>
            <p className="abq-list-sub">{p.open ? p.sub : p.hint}</p>
            {p.open ? (
              <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => enter(p.id)}>
                Go in
              </button>
            ) : (
              <span className="abq-lock mt-3">Locked</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// A place, open over the page: its game or its room, and the way back out.
function Place({ id, onLeave }) {
  const p = PLACES.find((x) => x.id === id);
  const back = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    back.current?.focus({ preventScroll: true });
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = 'hidden';
    const esc = (e) => e.key === 'Escape' && !e.defaultPrevented && onLeave();
    window.addEventListener('keydown', esc);
    return () => {
      html.style.overflow = was;
      window.removeEventListener('keydown', esc);
      if (before instanceof HTMLElement) before.focus({ preventScroll: true });
    };
  }, [onLeave]);
  const body = {
    home: <Home />,
    rv: <Metherria at="rv" />,
    superlab: <Metherria at="superlab" />,
    saul: <Saul />,
    pollos: <Pollos />,
    casa: <CasaTranquila />,
  }[id];
  // on the body, so nothing on the page (the nav, a transition) sits over it
  return createPortal(
    <div className="abq-place" role="dialog" aria-modal="true" aria-labelledby="abq-place-title">
      <header className="abq-place-head">
        <div>
          <p className="abq-place-sub">{p.sub}</p>
          <h2 id="abq-place-title" className="abq-place-title">
            {p.name}
          </h2>
        </div>
        <button ref={back} type="button" className="btn btn-ghost" onClick={onLeave}>
          Back to the car <kbd>Esc</kbd>
        </button>
      </header>
      <div className="abq-place-body">
        <div className="shell py-6 md:py-10">
          <Suspense fallback={<p className="text-muted">Opening the door…</p>}>{body}</Suspense>
        </div>
      </div>
    </div>,
    document.body,
  );
}
