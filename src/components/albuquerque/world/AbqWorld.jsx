import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { readPad, typing } from '../../games/pad';
import Pollos from '../Pollos';
import { splitWord } from '../elements';
import { rankFor } from '../metherria/rules';
import { CAREER, readCareer } from './career';
import { Home, Saul } from './places';
import { useAchievements } from '../../Achievements';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import { COLLIDERS, CRYSTALS, DROPS, PLACES, ROADS, SENSITIVITY, SPAWN, TIMES, WASH, WORLD_RADIUS, atWash, crystalAt, hankAt, nearPlace, onRoad, progress, shapeStick, startRun, stepCar, stepHeat, stepRun, stepSteer, timeName } from './rules';
import './world.css';

// Albuquerque, the world: drive Walt's Aztek round town, and go into the
// places as they open. It drives like a car in a chase: the wheel answers a
// tap with a nudge and a hold with full lock, Space (X or RB on a pad, the
// button by the stick on a phone) is the handbrake that swings the tail out
// into a slide, a wall met at a slant is scraped along, and the steering
// setting (C) says how sharp all of that is. The rules are in ./rules.js, the drawing in
// ./scene.js; this is the wheel, the HUD and the doors. Each place opens over
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
const STEERING = 'tp-abq-steering'; // the steering setting: relaxed, normal or sharp
const SETTINGS = Object.keys(SENSITIVITY);
const readSteering = () => {
  const v = local.get(STEERING, 'normal');
  return SETTINGS.includes(v) ? v : 'normal';
};
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
const KEYS = { up: ['ArrowUp', 'w', 'W'], down: ['ArrowDown', 's', 'S'], left: ['ArrowLeft', 'a', 'A'], right: ['ArrowRight', 'd', 'D'] };
const BOUND = WORLD_RADIUS + 20; // (how far out a driver's step can be: the fence, and a bit)
// where you are, for the other drivers (towns/travellers.js's step)
const stepOf = (car, speed = car.speed) => ({ x: car.x, z: car.z, face: Math.atan2(Math.sin(car.yaw), Math.cos(car.yaw)), speed: Math.abs(speed) });
const DRIVE = new Set(Object.values(KEYS).flat().concat(' '));
const ASPHALT = ROADS.filter((r) => !r.dirt); // (the tarmac: no dust off it)

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

// The title, as the title cards have it: Al, aluminium.
function Title() {
  const { before, el, after } = splitWord('Albuquerque');
  return (
    <h1 id="abq-title" className="abq-world-title" aria-label="Albuquerque">
      <span aria-hidden="true">
        {before}
        {el && (
          <span className="abq-world-tile">
            <small>{el.n}</small>
            {el.sym}
          </span>
        )}
        {after}
      </span>
    </h1>
  );
}

function World({ api, prog, snap, inside, enter, gl, setGl, announce, toast, setToast, refresh }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.35 });
  const canvas = useRef(null);
  const map = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const parked = local.get(PARKED, null);
    const ok = parked && Number.isFinite(parked.x) && Math.hypot(parked.x, parked.z) < WORLD_RADIUS;
    sim.current = { car: { ...(ok ? parked : SPAWN), speed: 0, slip: 0 }, t: 0, heat: 0, keys: new Set(), stick: { x: 0, y: 0 }, hand: false, steer: 0, steering: readSteering(), frame: 0, moved: false, blue: readBlue(), clock: TIMES[0].id };
  }
  const [steering, setSteering] = useState(() => sim.current.steering);
  // the steering setting, on to the next (kept between visits)
  const nextSteering = useCallback(() => {
    const to = SETTINGS[(SETTINGS.indexOf(sim.current.steering) + 1) % SETTINGS.length];
    sim.current.steering = to;
    local.set(STEERING, to);
    setSteering(to);
  }, []);
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
  const [list, setList] = useState(false);
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
      .then((a) => {
        if (dead) return a.dispose();
        api.current = a;
        if (import.meta.env.DEV) window.__ABQ__ = { api: a, sim: sim.current }; // for the QA scripts
        a.setPlaces(progRef.current);
        a.setBlue(sim.current.blue, sim.current.blue.length === CRYSTALS.length);
        a.setPizzas(Number(local.get(PIZZAS, 0)) || 0);
        fit();
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
      api.current?.dispose();
      api.current = null;
    };
  }, [api, setGl, announce]);

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

  // keys: drive while the world's on screen and nothing's open over it
  const live = gl === 'on' && inView && !inside;
  const near = hud.near;
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target)) return;
      if (DRIVE.has(e.key)) {
        e.preventDefault();
        s.keys.add(e.key);
        audioContext();
        return;
      }
      if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && near && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        enter(near);
      }
      if (e.key === 'm' || e.key === 'M') setList((v) => !v);
      if (e.key === 't' || e.key === 'T') nextTime();
      if (e.key === 'r' || e.key === 'R') runDelivery();
      if (e.key === 'p' || e.key === 'P') throwPizza();
      if (e.key === 'h' || e.key === 'H') honk();
      if (e.key === 'c' || e.key === 'C') nextSteering();
      if ((e.key === 'e' || e.key === 'E') && !near) washCar();
    };
    const up = (e) => s.keys.delete(e.key);
    const blur = () => {
      s.keys.clear();
      s.hand = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      s.keys.clear();
    };
  }, [live, near, enter, nextTime, nextSteering, runDelivery, throwPizza, washCar]);

  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const dt = Math.min(0.05, ms / 1000);
    const k = s.keys;
    const held = (name) => KEYS[name].some((key) => k.has(key));
    const pad = readPad();
    // the pedals, the wheel and the handbrake, from whatever's being used:
    // keys are all or nothing (rules' stepSteer eases the wheel to them), a
    // stick or a trigger says how far (bent to be finer near its centre)
    let throttle = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
    let steer = (held('left') ? 1 : 0) - (held('right') ? 1 : 0) - shapeStick(s.stick.x);
    let handbrake = k.has(' ') || s.hand;
    if (pad) {
      throttle += Math.max(pad.rtv, pad.rt ? 1 : 0) - Math.max(pad.ltv, pad.lt ? 1 : 0) - pad.ly;
      steer -= shapeStick(pad.lx);
      handbrake ||= pad.x || pad.rb;
      if (pad.a && !s.padA && s.near) enter(s.near);
      s.padA = pad.a;
    }
    throttle = Math.max(-1, Math.min(1, throttle));
    const feel = SENSITIVITY[s.steering] ?? SENSITIVITY.normal;
    s.steer = stepSteer(s.steer, steer, dt, feel.rate);
    const { car, bump } = stepCar(s.car, { throttle, steer: s.steer, handbrake, turn: feel.turn }, dt);
    s.car = car;
    if (Math.abs(throttle) > 0.1) s.moved = true;
    // a slide worth hearing: the tyres, once as it starts
    const sliding = Math.abs(car.slip) > 4.5 && Math.abs(car.speed) + Math.abs(car.slip) > 9;
    if (sliding && !s.sliding) import('../../../lib/sfx').then((x) => x.screech()).catch(() => {});
    s.sliding = sliding;
    s.t += dt;
    const hank = hankAt(s.t);
    const h = stepHeat(s.heat, Math.hypot(hank.x - car.x, hank.z - car.z), dt);
    s.heat = h.heat;
    if (h.caught) {
      s.heat = 0;
      s.car = { ...SPAWN, speed: 0, slip: 0 };
      setToast({ text: s.run ? 'Hank pulled you over, and found the load. Back home.' : 'Hank pulled you over. Back home, and keep your distance.', at: Date.now(), bad: true });
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
    const asphalt = onRoad(car.x, car.z, ASPHALT);
    // the other drivers: where you are to them, and where they are
    const tv = travRef.current;
    tv?.pose(stepOf(s.car));
    s.others = tv ? tv.list() : [];
    try {
      a.render({ car: s.car, hank, heat: s.heat, near: at?.id ?? null, steer: s.steer, throttle, handbrake, onRoad: onRoad(car.x, car.z), asphalt, bump, travellers: s.others }, ms);
    } catch {
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }
    // the HUD, when what it shows changes
    const wash = !at && atWash(car.x, car.z);
    const away = s.run ? Math.round(Math.hypot(s.run.x - car.x, s.run.z - car.z) / 5) * 5 : 0;
    const key = `${at ? `near:${at.id}|` : ''}${Math.round(s.heat * 10)}|${s.moved}|${wash}|${s.run ? `${s.run.id}:${Math.ceil(s.run.left)}:${away}` : ''}`;
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ near: at?.id ?? null, heat: Math.round(s.heat * 10) / 10, moved: s.moved, wash, run: s.run ? { name: s.run.name, left: s.run.left, away } : null });
    }
    if (++s.frame % 4 === 0) drawMap(map.current, s.car, hank, progRef.current, s.blue, s.run, s.others);
  }, live);

  // the touch stick: drag from where you put your thumb
  const stick = useRef(null);
  const onStick = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      e.currentTarget.setPointerCapture(e.pointerId);
      stick.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      audioContext();
    }
    if (!stick.current || stick.current.id !== e.pointerId) return;
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      stick.current = null;
      s.stick = { x: 0, y: 0 };
      e.currentTarget.style.setProperty('--sx', '0px');
      e.currentTarget.style.setProperty('--sy', '0px');
      return;
    }
    const dx = Math.max(-1, Math.min(1, (e.clientX - stick.current.x) / 50));
    const dy = Math.max(-1, Math.min(1, (e.clientY - stick.current.y) / 50));
    s.stick = { x: dx, y: dy };
    e.currentTarget.style.setProperty('--sx', `${dx * 26}px`);
    e.currentTarget.style.setProperty('--sy', `${dy * 26}px`);
  };

  // the handbrake, under the other thumb: on while it's held
  const onHand = (e) => {
    const on = e.type === 'pointerdown';
    sim.current.hand = on;
    e.currentTarget.toggleAttribute('data-on', on);
    if (!on) return;
    audioContext();
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // (a thumb that slides off it is still holding it)
    } catch {
      /* no such pointer any more */
    }
  };

  const here = near ? prog.places.find((p) => p.id === near) : null;
  const travel = (p) => {
    const s = sim.current;
    // pulled up just past its door, side on, so the camera behind the car
    // looks along the front rather than from inside the building
    const ox = p.door.x - p.at.x;
    const oz = p.door.z - p.at.z;
    const len = Math.hypot(ox, oz) || 1;
    s.car = { x: p.door.x + (ox / len) * 2, z: p.door.z + (oz / len) * 2, yaw: Math.atan2(ox, oz) + Math.PI / 2, speed: 0, slip: 0 };
    s.heat = 0;
    api.current?.settle();
    setList(false);
  };
  const rank = rankFor(snap.points);
  return (
    <div ref={box} className="abq-world-stage" data-touch={touch || undefined}>
      <canvas ref={canvas} className="abq-world-canvas" data-on={gl === 'on' || undefined} aria-label="Albuquerque from above Walt’s Aztek: the desert, the Sandias, and the roads into town" role="img" />
      {gl === 'loading' && <p className="abq-world-loading">Driving into Albuquerque…</p>}

      <div className="abq-hud abq-hud-top">
        <div className="abq-hud-brand">
          <Title />
          <p className="abq-hud-objective" aria-live="polite">
            <span aria-hidden="true">◆</span> {prog.objective}
          </p>
        </div>
        <div className="abq-hud-side">
          <p className="abq-hud-chip">
            <b>${snap.money}</b> · {rank.title}
          </p>
          <p className="abq-hud-chip abq-hud-blue" title="Blue Sky crystals found in the desert">
            <span aria-hidden="true">◆</span> Blue Sky <b>{blue}</b>/{CRYSTALS.length}
          </p>
          {trav.available &&
            (trav.on ? (
              <p className="abq-hud-chip abq-hud-online" data-on="" title="Everyone else online in Albuquerque drives about as a ghost Aztek from another world: they can’t touch your career, nor you theirs">
                <b>{trav.count}</b> {trav.count === 1 ? 'other driver' : 'other drivers'} in town
              </p>
            ) : (
              <button type="button" className="abq-hud-chip abq-hud-online" onClick={trav.join} title="Go online, and see everyone else driving Albuquerque as a ghost from another world">
                See other drivers
              </button>
            ))}
          <canvas ref={map} className="abq-map" width="150" height="150" aria-hidden="true" />
          {hud.heat > 0 && (
            <div className="abq-heat" role="meter" aria-label="Hank’s on you" aria-valuemin={0} aria-valuemax={1} aria-valuenow={hud.heat}>
              <span className="abq-heat-label">DEA</span>
              <span className="abq-heat-bar">
                <span style={{ transform: `scaleX(${hud.heat})` }} />
              </span>
            </div>
          )}
        </div>
      </div>

      {hud.run && (
        <p className="abq-run" role="timer" aria-label={`Delivery to ${hud.run.name}`}>
          <span aria-hidden="true">▣</span> {hud.run.name} · <b>{clockText(hud.run.left)}</b> · {hud.run.away} m
        </p>
      )}

      {toast && (
        <p className="abq-toast" data-bad={toast.bad || undefined} role="status" key={toast.at}>
          {toast.text}
        </p>
      )}

      {here && !inside && (
        <div className="abq-door" data-open={here.open || undefined}>
          <p className="abq-door-name">{here.name}</p>
          <p className="abq-door-sub">{here.open ? here.sub : here.hint}</p>
          {here.open && (
            <div className="abq-door-acts">
              <button type="button" className="btn btn-primary" onClick={() => enter(here.id)}>
                Go in {!touch && <kbd>E</kbd>}
              </button>
              {here.id === 'home' && (
                <button type="button" className="btn btn-ghost abq-door-alt" onClick={throwPizza}>
                  Throw a pizza {!touch && <kbd>P</kbd>}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {hud.wash && !here && !inside && (
        <div className="abq-door" data-open>
          <p className="abq-door-name">A1A Car Wash</p>
          <p className="abq-door-sub">Have an A1 day</p>
          <button type="button" className="btn btn-primary" onClick={washCar}>
            Wash the Aztek {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}

      {gl === 'on' && !hud.moved && !here && <p className="abq-hint">{touch ? 'Drag the stick to drive. Hold Slide for the handbrake.' : 'W A S D or the arrows to drive. Space is the handbrake: pull it into a corner and the tail comes round. E goes in. R runs a delivery. H is the horn.'}</p>}

      <div className="abq-hud abq-hud-bottom">
        {touch && (
          <div className="abq-pads">
            <div className="abq-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} aria-hidden="true">
              <span />
            </div>
            <button type="button" className="abq-hand" onPointerDown={onHand} onPointerUp={onHand} onPointerCancel={onHand} onContextMenu={(e) => e.preventDefault()} aria-label="Handbrake: hold it into a corner to slide">
              Slide
            </button>
          </div>
        )}
        <button type="button" className="btn btn-ghost abq-places-btn" onClick={nextSteering} aria-label={`Steering: ${SENSITIVITY[steering].name}. Change it`}>
          Steering · {SENSITIVITY[steering].name} {!touch && <kbd>C</kbd>}
        </button>
        <button type="button" className="btn btn-ghost abq-places-btn abq-clock-btn" onClick={runDelivery} disabled={!!hud.run}>
          {hud.run ? 'On a run' : 'Run a delivery'} {!touch && !hud.run && <kbd>R</kbd>}
        </button>
        <button type="button" className="btn btn-ghost abq-places-btn" onClick={nextTime} aria-label={`Time of day: ${clock.name}. Change it`}>
          {clock.name} {!touch && <kbd>T</kbd>}
        </button>
        <button type="button" className="btn btn-ghost abq-places-btn" onClick={() => setList((v) => !v)} aria-expanded={list}>
          Places {!touch && <kbd>M</kbd>}
        </button>
      </div>

      {list && (
        <div className="abq-list" role="dialog" aria-label="Places in Albuquerque">
          <div className="abq-list-head">
            <p>Places</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setList(false)}>
              Close
            </button>
          </div>
          <ul>
            {prog.places.map((p) => (
              <li key={p.id} data-open={p.open || undefined} data-next={p.id === prog.next || undefined}>
                <div>
                  <p className="abq-list-name">{p.name}</p>
                  <p className="abq-list-sub">{p.open ? p.sub : p.hint}</p>
                </div>
                {p.open ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => travel(p)}>
                    Drive there
                  </button>
                ) : (
                  <span className="abq-lock">Locked</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// The map in the corner: the roads, the places, Hank, the other drivers
// online (pale, out of any place) and you.
// (the town fills it; out in the dunes the car's arrow rides the rim)
const MAP_RADIUS = Math.min(WORLD_RADIUS, 250);
const MAP_SCALE = 150 / (MAP_RADIUS * 2 + 20);
function drawMap(c, car, hank, prog, blue = [], run = null, others = []) {
  const g = c?.getContext('2d');
  if (!g) return;
  const at = (x, z) => [75 + x * MAP_SCALE, 75 + z * MAP_SCALE];
  g.clearRect(0, 0, 150, 150);
  g.fillStyle = 'rgba(40, 30, 20, 0.55)';
  g.beginPath();
  g.arc(75, 75, 74, 0, Math.PI * 2);
  g.fill();
  g.lineCap = 'round';
  for (const r of ROADS) {
    g.strokeStyle = r.dirt ? '#b8946a' : '#e9e1d0';
    g.lineWidth = Math.max(2, r.w * MAP_SCALE * 1.4);
    g.beginPath();
    g.moveTo(...at(r.a.x, r.a.z));
    g.lineTo(...at(r.b.x, r.b.z));
    g.stroke();
  }
  g.fillStyle = 'rgba(233, 225, 208, 0.34)';
  for (const b of COLLIDERS) {
    const [x, y] = at(b.x - b.w / 2, b.z - b.d / 2);
    g.fillRect(x, y, Math.max(1.5, b.w * MAP_SCALE), Math.max(1.5, b.d * MAP_SCALE));
  }
  for (const p of prog.places) {
    const [x, y] = at(p.door.x, p.door.z);
    g.fillStyle = p.open ? '#f0c330' : '#7c817e';
    g.beginPath();
    g.arc(x, y, p.id === prog.next ? 5 : 3.5, 0, Math.PI * 2);
    g.fill();
    if (p.id === prog.next) {
      g.strokeStyle = '#f0c330';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.fillStyle = '#5fd0ff';
  for (const k of CRYSTALS) {
    if (blue.includes(k.id)) continue;
    const [x, y] = at(k.x, k.z);
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  const [hx, hy] = at(hank.x, hank.z);
  g.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#ff4a4a' : '#4a7bff';
  g.beginPath();
  g.arc(hx, hy, 3.5, 0, Math.PI * 2);
  g.fill();
  // anything off the map's edge is drawn on its rim
  const rim = (x, z) => {
    const d = Math.hypot(x, z);
    const k = d > MAP_RADIUS ? MAP_RADIUS / d : 1;
    return at(x * k, z * k);
  };
  g.fillStyle = 'rgba(190, 210, 255, 0.85)';
  for (const o of others ?? []) {
    if (o.inside) continue;
    const [ox, oy] = rim(o.x, o.z);
    g.beginPath();
    g.arc(ox, oy, 3, 0, Math.PI * 2);
    g.fill();
  }
  if (run) {
    const [dx, dy] = rim(run.x, run.z);
    g.fillStyle = '#58ff8a';
    g.strokeStyle = '#0c2a14';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(dx, dy, 4.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  const [cx, cy] = rim(car.x, car.z);
  g.save();
  g.translate(cx, cy);
  g.rotate(-car.yaw + Math.PI);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#1a1a1a';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4.5, 5);
  g.lineTo(-4.5, 5);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
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
