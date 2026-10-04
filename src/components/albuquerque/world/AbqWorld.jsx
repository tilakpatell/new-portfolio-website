import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { readPad, typing } from '../../games/pad';
import Pollos from '../Pollos';
import { splitWord } from '../elements';
import { rankFor } from '../metherria/rules';
import { readCareer } from './career';
import { Home, Saul } from './places';
import { PLACES, ROADS, SPAWN, WORLD_RADIUS, hankAt, nearPlace, onRoad, progress, stepCar, stepHeat } from './rules';
import './world.css';

// Albuquerque, the world: drive Walt's Aztek round town, and go into the
// places as they open. The rules are in ./rules.js, the drawing in
// ./scene.js; this is the wheel, the HUD and the doors. Each place opens over
// the page (its game, or Walt's house, or Saul's office); leave and you're
// back in the car at its door. Without 3D, the places are a grid of cards.

const Metherria = lazy(() => import('../metherria/Metherria'));
const CasaTranquila = lazy(() => import('../casa/CasaTranquila'));
const clip = (id, opts) => import('../../../lib/clips').then((c) => c.playClip(id, opts));

const VISITED = 'tp-abq-visited';
const OPENED = 'tp-abq-opened'; // what was open last time, to light up what's new
const PARKED = 'tp-abq-car';
const readSnap = () => {
  const c = readCareer();
  return { served: c.served, points: c.points, money: c.money, upgrades: c.upgrades, visited: local.get(VISITED, []) };
};
const ENTER_LINE = { rv: () => clip('jesseRing', { when: 0.3 }), saul: () => clip('saulHi', { when: 0.3 }), pollos: () => clip('gusHello', { when: 0.4 }) };
const KEYS = { up: ['ArrowUp', 'w', 'W'], down: ['ArrowDown', 's', 'S'], left: ['ArrowLeft', 'a', 'A'], right: ['ArrowRight', 'd', 'D'] };
const DRIVE = new Set(Object.values(KEYS).flat().concat(' '));

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
        <World api={api} prog={prog} snap={snap} inside={inside} enter={enter} gl={gl} setGl={setGl} announce={announce} toast={toast} setToast={setToast} />
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

function World({ api, prog, snap, inside, enter, gl, setGl, announce, toast, setToast }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.35 });
  const canvas = useRef(null);
  const map = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const parked = local.get(PARKED, null);
    const ok = parked && Number.isFinite(parked.x) && Math.hypot(parked.x, parked.z) < WORLD_RADIUS;
    sim.current = { car: { ...(ok ? parked : SPAWN), speed: 0 }, t: 0, heat: 0, keys: new Set(), stick: { x: 0, y: 0 }, steer: 0, frame: 0, moved: false };
  }
  const [hud, setHud] = useState({ near: null, heat: 0, moved: false });
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
    };
    const up = (e) => s.keys.delete(e.key);
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
  }, [live, near, enter]);

  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const dt = Math.min(0.05, ms / 1000);
    const k = s.keys;
    const held = (name) => KEYS[name].some((key) => k.has(key));
    const pad = readPad();
    let throttle = (held('up') ? 1 : 0) - (held('down') || k.has(' ') ? 1 : 0) - s.stick.y;
    let steer = (held('left') ? 1 : 0) - (held('right') ? 1 : 0) - s.stick.x;
    if (pad) {
      throttle += (pad.rt ? 1 : 0) - (pad.lt ? 1 : 0) - pad.ly;
      steer -= pad.lx;
      if (pad.a && !s.padA && s.near) enter(s.near);
      s.padA = pad.a;
    }
    throttle = Math.max(-1, Math.min(1, throttle));
    s.steer += (Math.max(-1, Math.min(1, steer)) - s.steer) * Math.min(1, dt * 10);
    const { car, bump } = stepCar(s.car, { throttle, steer: s.steer }, dt);
    s.car = car;
    if (Math.abs(throttle) > 0.1) s.moved = true;
    s.t += dt;
    const hank = hankAt(s.t);
    const h = stepHeat(s.heat, Math.hypot(hank.x - car.x, hank.z - car.z), dt);
    s.heat = h.heat;
    if (h.caught) {
      s.heat = 0;
      s.car = { ...SPAWN, speed: 0 };
      setToast({ text: 'Hank pulled you over. Back home, and keep your distance.', at: Date.now(), bad: true });
      import('../../../lib/clips').then((c) => c.playClip('hankRing')).catch(() => {});
    }
    const at = nearPlace(car.x, car.z);
    s.near = at?.id ?? null;
    const asphalt = onRoad(car.x, car.z, ROADS.filter((r) => !r.dirt));
    try {
      a.render({ car: s.car, hank, heat: s.heat, near: at?.id ?? null, steer: s.steer, onRoad: onRoad(car.x, car.z), asphalt, bump }, ms);
    } catch {
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }
    // the HUD, when what it shows changes
    const key = `${at ? `near:${at.id}|` : ''}${Math.round(s.heat * 10)}|${s.moved}`;
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ near: at?.id ?? null, heat: Math.round(s.heat * 10) / 10, moved: s.moved });
    }
    if (++s.frame % 4 === 0) drawMap(map.current, s.car, hank, progRef.current);
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

  const here = near ? prog.places.find((p) => p.id === near) : null;
  const travel = (p) => {
    const s = sim.current;
    // pulled up just past its door, side on, so the camera behind the car
    // looks along the front rather than from inside the building
    const ox = p.door.x - p.at.x;
    const oz = p.door.z - p.at.z;
    const len = Math.hypot(ox, oz) || 1;
    s.car = { x: p.door.x + (ox / len) * 2, z: p.door.z + (oz / len) * 2, yaw: Math.atan2(ox, oz) + Math.PI / 2, speed: 0 };
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
            <button type="button" className="btn btn-primary" onClick={() => enter(here.id)}>
              Go in {!touch && <kbd>E</kbd>}
            </button>
          )}
        </div>
      )}

      {gl === 'on' && !hud.moved && !here && <p className="abq-hint">{touch ? 'Drag the stick to drive.' : 'W A S D or the arrows to drive. Space brakes. E goes in.'}</p>}

      <div className="abq-hud abq-hud-bottom">
        {touch && (
          <div className="abq-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} aria-hidden="true">
            <span />
          </div>
        )}
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

// The map in the corner: the roads, the places, Hank and you.
const MAP_SCALE = 150 / (WORLD_RADIUS * 2 + 20);
function drawMap(c, car, hank, prog) {
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
  const [hx, hy] = at(hank.x, hank.z);
  g.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#ff4a4a' : '#4a7bff';
  g.beginPath();
  g.arc(hx, hy, 3.5, 0, Math.PI * 2);
  g.fill();
  const [cx, cy] = at(car.x, car.z);
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
          {gl === 'lost' ? 'The graphics chip reset, so here’s the town as cards.' : gl === 'failed' ? 'The 3D town couldn’t start here, so here it is as cards.' : '3D is switched off, so here’s the town as cards.'}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (!three.on) three.set('auto');
              retry();
            }}
          >
            {three.on ? 'Try 3D again' : 'Turn 3D on'}
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
