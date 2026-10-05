import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { settle } from '../../../lib/settle';
import { readPad, typing } from '../../games/pad';
import { keyDown, keyUp, moveOf } from '../../middleearth/towns/keys';
import { STONES } from '../../interests/stones';
import { SOUL_HALVES, earnedStones, hasEarned } from '../hq/stones';
import { BUILDINGS, LAWN_W, PLACES, PORTAL, RIVER_W, ROADS_W, ROAD_HALF, START, behindYaw, cameraMove, linesFor, nearCast, nearPlace, newHero, outside, placeById, progress, stepHero, underPortal, walkable } from './rules';
import './world.css';

// The Avengers compound, the world: walk about the compound as Captain
// America, and go into the buildings to play their games. The rules are in
// ./rules.js, the drawing in ./scene.js; this is the walking, the HUD and the
// doors. Each game opens over the page (./Place.jsx); leave it and you're
// back outside its door. Without 3D, the compound is the drawing from the
// air, and its pins open the games.

const Place = lazy(() => import('./Place'));
const CompoundMap = lazy(() => import('../Compound'));
const clip = (id) => import('../../../lib/clips').then((c) => c.playClip(id)).catch(() => null);
const AT = 'tp-hq-world-at';
// the lines the site has the films' own recordings of (lib/clips)
const SPOKEN = { 'Hulk smash!': 'hulkSmash', 'Puny god.': 'punyGod' };
const STONE_OF = { 'soul-clint': 'soul', 'soul-natasha': 'soul' };
const stoneFor = (p) => STONES.find((s) => s.id === (STONE_OF[p.stone] ?? p.stone));
// every stone won back, and either half of the Soul Stone
const readHeist = () => [...earnedStones(), ...SOUL_HALVES.filter(hasEarned)];

export default function CompoundWorld({ onPortal }) {
  const three = use3D();
  const [heist, setHeist] = useState(readHeist);
  const prog = progress(heist);
  const [inside, setInside] = useState(null);
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const api = useRef(null);

  useEffect(() => {
    const on = () => setHeist(readHeist());
    window.addEventListener('tp:stones', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('tp:stones', on);
      window.removeEventListener('storage', on);
    };
  }, []);

  const enter = useCallback((id) => {
    audioContext(); // in the key press or click, so the game can be heard
    api.current?.fx('enter', { id });
    setInside(id);
  }, []);
  const leave = useCallback(() => {
    setInside(null);
    setHeist(readHeist());
  }, []);
  // through the portal: out of the hangar (or out from under it) to Titan, down the page
  const portal = useCallback(() => {
    audioContext();
    setInside(null);
    setHeist(readHeist());
    api.current?.fx('portal');
    onPortal?.();
  }, [onPortal]);

  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section id="hq-world" className="cw-world" aria-labelledby="cw-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World api={api} prog={prog} inside={inside} enter={enter} portal={portal} gl={gl} setGl={setGl} /> : <Cards prog={prog} enter={enter} three={three} gl={gl} retry={() => setGl('loading')} />}
      {inside && (
        <Suspense fallback={null}>
          <Place id={inside} onLeave={leave} onPortal={portal} />
        </Suspense>
      )}
    </section>
  );
}

function World({ api, prog, inside, enter, portal, gl, setGl }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.25 });
  const canvas = useRef(null);
  const map = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const kept = local.get(AT, null);
    const ok = kept && Number.isFinite(kept.x) && Number.isFinite(kept.z) && walkable(kept.x, kept.z);
    const h = newHero(ok ? kept : START);
    sim.current = { h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.2, dragAt: -1e9, near: null, portal: false, talk: null, frame: 0, moved: false, t: 0, jump: false, padBefore: null };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const [hud, setHud] = useState({ near: null, portal: false, moved: false });
  const hudKey = useRef('');
  const [bubble, setBubble] = useState(null);
  const bubbleRef = useRef(null);
  const lines = useRef({});
  const [list, setList] = useState(false);

  // the world: made once, kept while you're inside a building
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createCompoundWorld }) => {
        if (dead || !canvas.current) return null;
        return createCompoundWorld(canvas.current, { onLost: () => !dead && setGl('lost'), calm: prefersReducedMotion() });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        fit();
        // its shaders linked in the background before the first frame
        await settle(a.engine.precompile(), 4000);
        if (dead || a.lost) return;
        if (import.meta.env.DEV) window.__HQWORLD__ = { api: a, sim: sim.current, enter }; // for the QA scripts
        setGl('on');
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
      local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
      api.current?.dispose();
      api.current = null;
    };
  }, [api, setGl, enter]);

  // out of a building: back outside its door, the camera off to one side so it isn't in the wall
  const was = useRef(inside);
  useEffect(() => {
    const from = was.current;
    was.current = inside;
    if (inside || !from) return;
    const p = placeById(from);
    if (!p) return;
    const s = sim.current;
    s.h = outside(p);
    s.yaw = behindYaw(p.face) + 0.85;
    s.dragAt = s.t;
    s.keys.clear();
  }, [inside]);

  const live = gl === 'on' && inView && !inside;

  const go = useCallback(() => {
    const s = sim.current;
    if (s.near) enter(s.near);
    else if (s.portal) portal();
  }, [enter, portal]);

  // the walking keys: held by their place on the keyboard (middleearth/towns/keys)
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target)) return;
      keyDown(s.keys, e);
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const m = moveOf(e);
      if (m) {
        e.preventDefault();
        audioContext();
        if (m === 'space' && !e.repeat) s.jump = true;
        return;
      }
      const k = e.key;
      if ((k === 'e' || k === 'E' || k === 'Enter') && !(e.target instanceof HTMLButtonElement) && (s.near || s.portal)) {
        e.preventDefault();
        go();
      } else if (k === 'm' || k === 'M') setList((v) => !v);
      else if (k === 'Escape') setList(false);
    };
    const up = (e) => keyUp(s.keys, e);
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
  }, [live, go]);

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const p = progRef.current;
    // (the QA scripts can run the clock faster, in development only)
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    s.t += dt;
    const k = s.keys;
    const pad = readPad();
    const before = s.padBefore ?? {};
    const pressed = (b) => pad?.[b] && !before[b];
    s.padBefore = pad ?? {};

    let fwd = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0) - s.stick.y;
    let side = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + s.stick.x;
    if (pad) {
      fwd -= pad.ly;
      side += pad.lx;
      if (Math.abs(pad.rx) > 0) {
        s.yaw -= pad.rx * dt * 2.4;
        s.dragAt = s.t;
      }
      if (pressed('a')) {
        if (s.near || s.portal) go();
        else s.jump = true;
      }
      if (pressed('b')) s.jump = true;
      if (pressed('y')) setList((v) => !v);
    }
    const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
    const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
    const wasAir = s.h.air;
    s.h = stepHero(s.h, { x: mv.x, z: mv.z, run, jump: s.jump }, dt);
    s.jump = false;
    if (wasAir && !s.h.air) a.fx('land', s.h);
    if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
    // the camera drifts round behind him as he goes, unless you've just turned it
    if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4) {
      let d = behindYaw(s.h.face) - s.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      s.yaw += d * Math.min(1, dt * 1.5);
    }

    // a door, the portal, and who's about
    s.near = nearPlace(s.h.x, s.h.z)?.id ?? null;
    s.portal = !s.near && p.portal && underPortal(s.h.x, s.h.z);
    const person = nearCast(s.h.x, s.h.z);
    const talk = person?.id ?? null;
    if (talk !== s.talk) {
      s.talk = talk;
      if (person) {
        const pool = linesFor(person, p.done);
        const n = lines.current[talk] ?? 0;
        lines.current[talk] = n + 1;
        const line = pool[n % pool.length];
        setBubble({ id: talk, name: person.name, line });
        if (SPOKEN[line]) clip(SPOKEN[line]);
      } else setBubble(null);
    }

    try {
      a.render({ hero: s.h, camYaw: s.yaw, camPitch: s.pitch, camDist: touch ? 8.4 : 7.6, near: s.near, done: p.done, next: p.next, portal: p.portal }, ms * fast);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }

    const key = [s.near, s.portal, s.moved].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ near: s.near, portal: s.portal, moved: s.moved });
    }
    // the speech bubble follows whoever's talking
    if (s.talk && bubbleRef.current) {
      const at = a.screenOf('cast', s.talk);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 4 === 0) drawMap(map.current, s.h, p);
    if (s.frame % 120 === 0) local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // drag to look round
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      audioContext();
      drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      return;
    }
    if (e.type === 'pointermove') {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      s.yaw -= (e.clientX - d.x) * 0.0065;
      s.pitch = Math.max(0.05, Math.min(0.9, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' ? 0.004 : 0)));
      d.x = e.clientX;
      d.y = e.clientY;
      s.dragAt = s.t;
      return;
    }
    drag.current = null;
  };

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
    if (e.type === 'pointerup' || e.type === 'pointercancel' || e.type === 'lostpointercapture') {
      stick.current = null;
      s.stick = { x: 0, y: 0 };
      e.currentTarget.style.setProperty('--sx', '0px');
      e.currentTarget.style.setProperty('--sy', '0px');
      return;
    }
    const dx = Math.max(-1, Math.min(1, (e.clientX - stick.current.x) / 46));
    const dy = Math.max(-1, Math.min(1, (e.clientY - stick.current.y) / 46));
    s.stick = { x: dx, y: dy };
    e.currentTarget.style.setProperty('--sx', `${dx * 26}px`);
    e.currentTarget.style.setProperty('--sy', `${dy * 26}px`);
  };

  // to a door, from the list
  const travel = (id) => {
    const p = placeById(id);
    const s = sim.current;
    s.h = outside(p);
    s.yaw = behindYaw(p.face) + Math.PI; // looking back at the door
    s.dragAt = s.t;
    setList(false);
  };

  const here = hud.near ? prog.places.find((p) => p.id === hud.near) : null;
  const herePortal = hud.portal && !here;
  return (
    <div ref={box} className="cw-stage" data-touch={touch || undefined}>
      <canvas ref={canvas} className="cw-canvas" data-on={gl === 'on' || undefined} aria-label="The Avengers compound in 3D: the hangar, the main building and its glass wing, the training center, the lab and the range, and Captain America on the lawn" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      {gl === 'loading' && <p className="cw-loading">Flying in to the compound…</p>}

      <div className="cw-hud cw-hud-top">
        <div className="cw-brand">
          <p className="cw-eyebrow">The Avengers compound · Upstate New York</p>
          <h1 id="cw-title" className="cw-title">
            Avengers HQ
          </h1>
          <p className="cw-objective" aria-live="polite">
            <span aria-hidden="true">▲</span> {prog.objective}
          </p>
        </div>
        <div className="cw-side">
          <canvas ref={map} className="cw-map" width="150" height="150" aria-hidden="true" />
          <p className="cw-chip cw-stones" aria-label={`${prog.stones} of 6 Infinity Stones won back`}>
            {STONES.map((st) => (
              <i key={st.id} className="stone-dot" data-on={prog.have.includes(st.id) || undefined} style={{ '--glow': st.color }} />
            ))}
            <b>{prog.stones}</b> of 6
          </p>
          <button type="button" className="cw-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
            The buildings {!touch && <kbd>M</kbd>}
          </button>
        </div>
      </div>

      {bubble && (
        <div ref={bubbleRef} className="cw-bubble" aria-live="polite">
          <div>
            <b>{bubble.name}</b>
            <span>{bubble.line}</span>
          </div>
        </div>
      )}

      {here && (
        <div className="cw-door" style={{ '--cw-accent': here.accent }}>
          <p className="cw-door-sub">{here.where}</p>
          <p className="cw-door-name">{here.name}</p>
          <p className="cw-door-stone" style={{ '--glow': stoneFor(here).color }}>
            <i className="stone-dot" data-on={here.done || undefined} aria-hidden="true" />
            {here.done ? `${stoneFor(here).name}: won back` : `Win it for the ${here.stone.startsWith('soul-') ? 'half of the ' : ''}${stoneFor(here).name}`}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => enter(here.id)}>
            {here.act} {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}
      {herePortal && (
        <div className="cw-door cw-door-portal" style={{ '--cw-accent': '#6cc8ff' }}>
          <p className="cw-door-sub">Over the helipad</p>
          <p className="cw-door-name">The portal</p>
          <p className="cw-door-stone">Titan is on the other side, and Thanos with it.</p>
          <button type="button" className="btn btn-primary" onClick={portal}>
            Go through {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}

      {gl === 'on' && !hud.moved && !here && !herePortal && (
        <p className="cw-hint">{touch ? 'Drag the stick to walk, push it all the way to run. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run, Space to jump. Drag to look round. E at a door to go in.'}</p>
      )}

      {touch && (
        <div className="cw-hud cw-hud-bottom">
          <div className="cw-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} onLostPointerCapture={onStick} aria-hidden="true">
            <span />
          </div>
          <button
            type="button"
            className="cw-jump"
            onPointerDown={(e) => {
              e.preventDefault();
              audioContext();
              sim.current.jump = true;
            }}
          >
            Jump
          </button>
        </div>
      )}

      {list && (
        <div className="cw-list" role="dialog" aria-label="The buildings on the compound">
          <div className="cw-list-head">
            <p>The compound</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setList(false)}>
              Close
            </button>
          </div>
          <ol>
            {prog.places.map((p, i) => (
              <li key={p.id} data-done={p.done || undefined} data-next={p.id === prog.next || undefined} style={{ '--glow': stoneFor(p).color, '--cw-accent': p.accent }}>
                <span className="cw-list-n" aria-hidden="true">
                  {p.done ? '✓' : i + 1}
                </span>
                <div>
                  <p className="cw-list-name">{p.name}</p>
                  <p className="cw-list-sub">
                    {p.where} · {p.done ? `${stoneFor(p).name} won back` : stoneFor(p).name}
                  </p>
                </div>
                <div className="cw-list-acts">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => travel(p.id)}>
                    Go there
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => enter(p.id)}>
                    {p.act}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// The map in the corner: the river, the lawn and its drives, the buildings,
// the doors (a stone over each one won back), the portal once it's open, and you.
const MAP = { x0: -60, z0: -20, size: 300 };
function drawMap(c, h, prog) {
  const g = c?.getContext('2d');
  if (!g) return;
  const k = 150 / MAP.size;
  const at = (x, z) => [(x - MAP.x0) * k, (z - MAP.z0) * k];
  const poly = (pts) => {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
    g.closePath();
  };
  g.clearRect(0, 0, 150, 150);
  g.save();
  g.beginPath();
  g.arc(75, 75, 73, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#2f4a2c'; // the woods
  g.fillRect(0, 0, 150, 150);
  g.fillStyle = '#3d6f7a';
  poly(RIVER_W);
  g.fill();
  g.fillStyle = '#7da35a';
  poly(LAWN_W);
  g.fill();
  g.strokeStyle = '#d9dbd2';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(1.2, ROAD_HALF * 2 * k);
  for (const r of ROADS_W) {
    g.beginPath();
    r.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
    g.stroke();
  }
  g.fillStyle = '#f2f4f6';
  g.strokeStyle = 'rgba(20, 28, 36, 0.55)';
  g.lineWidth = 0.8;
  for (const b of BUILDINGS) {
    poly(b.foot);
    g.fill();
    g.stroke();
  }
  // the doors: a pulsing ring for the next, a dot for the rest, the stone's colour once won
  const pulse = 3.2 + Math.sin(performance.now() / 260) * 1.2;
  for (const p of prog.places) {
    const [x, y] = at(p.x, p.z);
    g.fillStyle = p.done ? stoneFor(p).color : p.accent;
    g.beginPath();
    g.arc(x, y, p.done ? 3.4 : 2.8, 0, Math.PI * 2);
    g.fill();
    if (p.id === prog.next) {
      g.strokeStyle = p.accent;
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(x, y, pulse + 2, 0, Math.PI * 2);
      g.stroke();
    }
  }
  if (prog.portal) {
    const [x, y] = at(PORTAL.x, PORTAL.z);
    g.strokeStyle = '#9fdcff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 4 + pulse * 0.4, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  // you
  const [cx, cy] = at(h.x, h.z);
  g.save();
  g.translate(cx, cy);
  g.rotate(-h.face + Math.PI / 2);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#1d2f5c';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4.5, 5);
  g.lineTo(-4.5, 5);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(200, 220, 240, 0.55)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(75, 75, 73, 0, Math.PI * 2);
  g.stroke();
}

// Without 3D: the compound from the air, its pins opening the games, and the
// buildings as cards.
function Cards({ prog, enter, three, gl, retry }) {
  const ids = PLACES.map((p) => p.id);
  return (
    <div className="shell cw-cards-wrap">
      <p className="eyebrow">The Avengers compound · Upstate New York</p>
      <h1 id="cw-title" className="display hq-steel mt-4 text-[clamp(2.6rem,1.6rem+3.6vw,4.6rem)]">
        Avengers HQ
      </h1>
      <p className="lead mt-4 max-w-[60ch]">Marvel, all of it. Every building on the compound belongs to someone, and each has a game that wins an Infinity Stone back. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s the compound from the air.' : gl === 'failed' ? 'The 3D compound couldn’t start here, so here it is from the air.' : three.held ? 'The 3D compound isn’t loaded yet, so here it is from the air.' : '3D is switched off, so here’s the compound from the air.'}
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
      <div className="cw-cards-grid mt-8">
        <figure className="m-0">
          <div className="hq-hud">
            <Suspense fallback={<div className="hq-map" aria-hidden="true" />}>
              <CompoundMap spots={ids} titles={prog.places.map((p, i) => `${i + 1}. ${p.name}`)} stones={prog.places.map((p) => (p.done ? stoneFor(p).color : null))} onPick={enter} className="hq-hero-map" />
            </Suspense>
          </div>
          <figcaption className="mt-3 text-sm text-muted">The compound from the air. Pick a pin to go in.</figcaption>
        </figure>
        <ol className="cw-cards">
          {prog.places.map((p, i) => (
            <li key={p.id} data-done={p.done || undefined} style={{ '--glow': stoneFor(p).color }}>
              <p className="cw-list-name">
                {i + 1}. {p.name}
              </p>
              <p className="cw-list-sub">
                {p.where} · {p.done ? `${stoneFor(p).name} won back` : stoneFor(p).name}
              </p>
              <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => enter(p.id)}>
                {p.act}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
