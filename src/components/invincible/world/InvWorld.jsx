import { useCallback, useEffect, useRef, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { settle } from '../../../lib/settle';
import { readPad, typing } from '../../games/pad';
import { useAchievements } from '../../Achievements';
import { FLY, newHero, stepHero } from './flight';
import { CARDS, RINGS, keepQuests, newQuests, stepQuests } from './quests';
import { CITY, COAST, BEACH, HILLS, PLACES, RIVER, SPAWN, SUBURB, WORLD, groundAt, waterAt } from './map';
import './world.css';

// The Graysons' city, the world: fly about it as Invincible. The rules are
// in ./flight.js and ./map.js, the drawing in ./scene.js; this is the
// input (keys, mouse, touch, a pad), the clock, and the HUD over it: speed
// and Mach, height, a compass with the places on it, a map. Without 3D,
// the places as cards.

const sfx = (name) => import('../../../lib/sfx').then((s) => s[name]?.()).catch(() => null);
const AT = 'tp-inv-world-at';
const TIME = 'tp-inv-world-time';
const QUESTS = 'tp-inv-world-quests';
const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const WHAT = { fall: 'Someone’s slipping off a roof', heli: 'A news helicopter’s lost its tail rotor' };
const TIMES = ['noon', 'dusk', 'night'];
const TIME_NAME = { noon: 'Noon', dusk: 'Dusk', night: 'Night' };
const MACH = 343;
// the keys, by where they are on the keyboard
const CODES = { KeyW: 'fwd', KeyS: 'back', KeyA: 'left', KeyD: 'right', Space: 'up', KeyC: 'down', KeyZ: 'down', ShiftLeft: 'boost', ShiftRight: 'boost', ArrowLeft: 'lookL', ArrowRight: 'lookR', ArrowUp: 'lookU', ArrowDown: 'lookD' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export default function InvWorld() {
  const three = use3D();
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section id="inv-world" className="iw-world" aria-labelledby="iw-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World gl={gl} setGl={setGl} /> : <Cards three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ gl, setGl }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.2 });
  const canvas = useRef(null);
  const mapRef = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  const wind = useRef(null);
  const [time, setTimeName] = useState(() => (TIMES.includes(local.get(TIME, 'noon')) ? local.get(TIME, 'noon') : 'noon'));
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState(null);
  const [near, setNear] = useState(null);
  const [bubble, setBubble] = useState(null);
  const { unlock } = useAchievements();
  const [found, setFound] = useState(() => newQuests(local.get(QUESTS, {})).cards.length);
  const bubbleRef = useRef(null);
  const hud = useRef({});
  if (!sim.current) {
    const kept = local.get(AT, null);
    const ok = kept && [kept.x, kept.y, kept.z].every(Number.isFinite) && Math.abs(kept.x) < WORLD.half && Math.abs(kept.z) < WORLD.half && !waterAt(kept.x, kept.z);
    const at = ok ? kept : SPAWN;
    const h = newHero(at);
    sim.current = { quests: newQuests(local.get(QUESTS, {})), h, keys: new Set(), stick: { x: 0, y: 0 }, touchUp: false, touchDown: false, touchBoost: false, yaw: at.face ?? SPAWN.face, pitch: -0.05, dragAt: -1e9, t: 0, jump: false, events: [], frame: 0, padBefore: null, moved: false, world: null };
  }

  const say = useCallback((text, ms = 2400) => {
    setToast({ text, key: Math.random() });
    clearTimeout(say.t);
    say.t = setTimeout(() => setToast(null), ms);
  }, []);

  // the world: made once
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createInvWorld }) => (dead || !canvas.current ? null : createInvWorld(canvas.current, { onLost: () => !dead && setGl('lost'), calm: prefersReducedMotion() })))
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        sim.current.world = a.world;
        fit();
        await a.setTime(time);
        await settle(a.engine.precompile(), 4000);
        if (dead || a.lost) return;
        if (import.meta.env.DEV) window.__INVWORLD__ = { api: a, sim: sim.current };
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
      if (s.h.mode === 'ground' && !waterAt(s.h.p[0], s.h.p[2])) local.set(AT, { x: s.h.p[0], y: s.h.p[1], z: s.h.p[2], face: s.h.face });
      wind.current?.stop();
      wind.current = null;
      api.current?.dispose();
      api.current = null;
    };
    // (made once; the time of day is set below when it changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setGl]);

  useEffect(() => {
    local.set(TIME, time);
    api.current?.setTime(time);
  }, [time]);

  const live = gl === 'on' && inView;
  const cycleTime = useCallback(() => setTimeName((t) => TIMES[(TIMES.indexOf(t) + 1) % TIMES.length]), []);
  const startSound = useCallback(() => {
    audioContext();
    if (!wind.current) import('./sounds').then((m) => (wind.current ??= m.windSound()));
  }, []);

  const act = useCallback(() => {
    const p = sim.current.near;
    if (!p) return;
    sfx('ding');
    say(`${p.name}: ${p.line}`, 3200);
  }, [say]);

  // the keys
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = CODES[e.code];
      if (k) {
        e.preventDefault();
        startSound();
        if (k === 'up' && !e.repeat) s.jump = true;
        s.keys.add(k);
        s.moved = true;
        return;
      }
      if (e.code === 'KeyE' || e.key === 'Enter') {
        if (!(e.target instanceof HTMLButtonElement)) act();
      } else if (e.code === 'KeyT') cycleTime();
      else if (e.code === 'KeyH' || e.key === '?') setHelp((v) => !v);
      else if (e.key === 'Escape') setHelp(false);
    };
    const up = (e) => {
      const k = CODES[e.code];
      if (k) s.keys.delete(k);
      if (!e.shiftKey) s.keys.delete('boost');
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
  }, [live, act, cycleTime, startSound]);

  // looking round: drag on the canvas
  const drag = useRef(null);
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' && e.clientX < (canvas.current?.getBoundingClientRect().left ?? 0) + (canvas.current?.clientWidth ?? 0) * 0.4) return; // the left of a phone's screen is the stick
    startSound();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const s = sim.current;
    const k = e.pointerType === 'touch' ? 0.007 : 0.0045;
    s.yaw -= (e.clientX - d.x) * k;
    s.pitch = clamp(s.pitch - (e.clientY - d.y) * k, -1.35, 1.25);
    s.dragAt = s.t;
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onPointerUp = (e) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    const s = sim.current;
    if (!a || a.lost || !s.world) return;
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    s.t += dt;
    const k = s.keys;
    const pad = readPad();
    const before = s.padBefore ?? {};
    const pressed = (b) => pad?.[b] && !before[b];
    s.padBefore = pad ?? {};

    // the camera: arrows, a pad's right stick
    const lookX = (k.has('lookR') ? 1 : 0) - (k.has('lookL') ? 1 : 0) + (pad?.rx ?? 0);
    const lookY = (k.has('lookU') ? 1 : 0) - (k.has('lookD') ? 1 : 0) - (pad?.ry ?? 0);
    if (lookX || lookY) {
      s.yaw -= lookX * 2.2 * dt;
      s.pitch = clamp(s.pitch + lookY * 1.6 * dt, -1.35, 1.25);
      s.dragAt = s.t;
    }
    let fwd = (k.has('fwd') ? 1 : 0) - (k.has('back') ? 1 : 0) - s.stick.y - (pad?.ly ?? 0);
    let side = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + s.stick.x + (pad?.lx ?? 0);
    fwd = clamp(fwd, -1, 1);
    side = clamp(side, -1, 1);
    const upKey = k.has('up') || s.touchUp || Boolean(pad?.a || pad?.rb);
    const downKey = k.has('down') || s.touchDown || Boolean(pad?.b || pad?.lb);
    const boost = k.has('boost') || s.touchBoost || Boolean(pad?.rt || (pad?.rtv ?? 0) > 0.4);
    if (pressed('a')) s.jump = true;
    if (pressed('x')) act();
    if (pressed('y')) cycleTime();
    const look = [Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch)];
    s.h = stepHero(s.h, { fwd, side, up: upKey ? 1 : 0, down: downKey ? 1 : 0, boost, run: boost, jump: s.jump, look }, dt, s.world);
    s.jump = false;
    const h = s.h;
    const speed = Math.hypot(h.v[0], h.v[1], h.v[2]);
    // the camera swings round behind him when he's going somewhere fast (and you're not looking about)
    if (h.mode === 'air' && speed > 18 && s.t - s.dragAt > 1.2) {
      const vy = Math.atan2(h.v[0], h.v[2]);
      const vp = Math.atan2(h.v[1], Math.hypot(h.v[0], h.v[2]));
      const r = 1.2 + Math.min(1, speed / 120) * 2;
      s.yaw += wrap(vy - s.yaw) * (1 - Math.exp(-r * dt));
      s.pitch += (clamp(vp * 0.85 - 0.08, -1.2, 1.1) - s.pitch) * (1 - Math.exp(-r * 0.8 * dt));
    }
    // the things to do: the rings, the cards, the rescues
    s.quests = stepQuests(s.quests, h, dt, s.world);
    for (const e of s.quests.ev) {
      if (e.type === 'lesson-start') {
        sfx('ding');
        say('Dad’s rings: in order, to the Guardians’ hall. Go.');
      } else if (e.type === 'ring') sfx('coin');
      else if (e.type === 'lesson-done') {
        sfx('fanfare');
        unlock('dadsrings');
        say(`${e.best ? 'A best: ' : 'Round in '}${clock(e.time)}. “Not bad. For a start.”`, 4200);
      } else if (e.type === 'lesson-lost') say('Dad’s given up waiting. Back to the first ring, over the street outside the house.');
      else if (e.type === 'card') {
        sfx('oneUp');
        setFound(s.quests.cards.length);
        say(`Title card: episode ${e.ep}, “${e.title}”. ${s.quests.cards.length} of ${CARDS.length}.`, 3400);
        if (e.all) unlock('titlecards');
      } else if (e.type === 'emergency') {
        sfx('alarm');
        say(`${WHAT[e.kind]}! Follow the red beacon.`, 4200);
      } else if (e.type === 'slip') sfx('warn');
      else if (e.type === 'caught') {
        sfx('ding');
        say(e.kind === 'heli' ? 'Got it. Now set it down somewhere.' : 'Got them. Now put them down gently.');
      } else if (e.type === 'saved') {
        sfx('victory');
        unlock('rescue');
        say(`Safe. That’s ${e.count} ${e.count === 1 ? 'rescue' : 'rescues'}.`);
      } else if (e.type === 'missed') {
        sfx('crumble');
        say(e.kind === 'heli' ? 'Too late: the crew jumped clear, and the street has a new hole in it.' : 'Too late, but the GDA had a net out. Barely.', 4200);
      }
      if (['card', 'saved', 'lesson-done'].includes(e.type)) local.set(QUESTS, keepQuests(s.quests));
    }
    for (const e of h.ev) {
      s.events.push(e);
      if (e.type === 'boom') {
        sfx('boom');
        unlock('soundbarrier');
        if (!s.boomSaid) {
          s.boomSaid = true;
          say('The sound barrier. Keep going.');
        }
      } else if (e.type === 'slam') {
        sfx(e.speed > 80 ? 'crumble' : 'thunk');
        if (e.speed > 80) sfx('boom');
      } else if (e.type === 'impact') sfx('crumble');
      else if (e.type === 'takeoff') sfx('zip');
      else if (e.type === 'splash') sfx('knock');
    }
    a.frame(s, dt);
    s.frame++;

    // what's near: a place's door, on the ground or just over it
    const alt = h.p[1] - groundAt(h.p[0], h.p[2]);
    let nearP = null;
    if (alt < 12) for (const p of s.world.places) if (Math.hypot(h.p[0] - p.door[0], h.p[2] - p.door[1]) < p.r + 6) nearP = p;
    if (nearP !== s.near) {
      s.near = nearP;
      setNear(nearP ? { id: nearP.id, name: nearP.name } : null);
    }
    // the HUD, straight into the DOM (no re-render a frame)
    const H = hud.current;
    if (s.frame % 2 === 0) {
      if (H.speed) H.speed.textContent = String(Math.round(speed * 3.6));
      if (H.mach) H.mach.textContent = speed > 60 ? `Mach ${(speed / MACH).toFixed(2)}` : h.mode === 'ground' ? (speed > 5 ? 'Running' : speed > 0.5 ? 'Walking' : 'Standing') : speed < 1 ? 'Hovering' : 'Flying';
      if (H.alt) H.alt.textContent = `${Math.max(0, Math.round(alt))} m`;
      if (H.bar) H.bar.style.transform = `scaleX(${Math.min(1, speed / FLY.top)})`;
      if (H.lines) H.lines.style.opacity = String(clamp((speed - 70) / 160, 0, 0.85));
      const marks = [];
      const q = s.quests;
      if (q.rescue && !q.rescue.carried) marks.push({ x: q.rescue.p[0], z: q.rescue.p[2], color: '#ff3b30', name: 'Help' });
      if (q.lesson.on) marks.push({ x: RINGS[q.lesson.next].p[0], z: RINGS[q.lesson.next].p[2], color: '#ffd23a', name: `Ring ${q.lesson.next + 1}` });
      s.marks = marks;
      if (H.compass) drawCompass(H.compass, s.yaw, h, s.world.places, marks);
      if (H.goal) {
        const d = q.rescue ? Math.round(Math.hypot(q.rescue.p[0] - h.p[0], q.rescue.p[1] - h.p[1], q.rescue.p[2] - h.p[2])) : 0;
        const text = q.rescue ? (q.rescue.carried ? 'Set them down: land anywhere' : `${WHAT[q.rescue.kind]} · ${d} m`) : q.lesson.on ? `Dad’s rings · ${q.lesson.next + 1} of ${RINGS.length} · ${clock(q.lesson.t)}` : '';
        if (H.goal.textContent !== text) H.goal.textContent = text;
        H.goal.dataset.on = text ? '1' : '';
        H.goal.dataset.red = q.rescue ? '1' : '';
      }
    }
    if (s.frame % 4 === 0 && mapRef.current) drawMap(mapRef.current, h, s.yaw, alt, s.world, s.marks);
    // who's talking to him: a bubble over the nearest, a new line every few seconds
    if (s.frame % 3 === 0) {
      const t = a.talkers(h)[0] ?? null;
      const said = s.said ?? (s.said = {});
      if (t?.id !== s.talking?.id) {
        s.talking = t;
        if (t) {
          said[t.id] = ((said[t.id] ?? -1) + 1) % t.lines.length;
          s.talkAt = s.t;
          setBubble({ name: t.name, text: t.lines[said[t.id]] });
        } else setBubble(null);
      } else if (t && s.t - s.talkAt > 5) {
        said[t.id] = (said[t.id] + 1) % t.lines.length;
        s.talkAt = s.t;
        setBubble({ name: t.name, text: t.lines[said[t.id]] });
      }
      s.talking = t ?? null;
    }
    if (s.talking && bubbleRef.current) {
      const q = a.project(s.talking.head);
      bubbleRef.current.style.transform = `translate(${Math.round(q.x)}px, ${Math.round(q.y)}px)`;
      bubbleRef.current.style.opacity = q.front ? '1' : '0';
    }
    // flying alongside the airliner: what your father would say
    if (!s.mimicSaid && s.frame % 10 === 0 && a.jetDistance(h) < 90) {
      s.mimicSaid = true;
      sfx('flyby');
      unlock('mimic');
      say('Dad, in your ear: “Look what they need to mimic a fraction of our power.”', 4200);
    }
    wind.current?.set({ speed, alt });
  }, live);

  // the stick, on a phone
  const stickRef = useRef(null);
  const stickDrag = useRef(null);
  const stickDown = (e) => {
    startSound();
    stickDrag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const stickMove = (e) => {
    const d = stickDrag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = clamp((e.clientX - d.x) / 44, -1, 1);
    const dy = clamp((e.clientY - d.y) / 44, -1, 1);
    sim.current.stick = { x: dx, y: dy };
    if (stickRef.current) stickRef.current.style.transform = `translate(${dx * 26}px, ${dy * 26}px)`;
  };
  const stickUp = () => {
    stickDrag.current = null;
    sim.current.stick = { x: 0, y: 0 };
    if (stickRef.current) stickRef.current.style.transform = '';
  };
  const hold = (key) => ({
    onPointerDown: (e) => {
      startSound();
      if (key === 'touchUp') sim.current.jump = true;
      sim.current[key] = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerUp: () => (sim.current[key] = false),
    onPointerCancel: () => (sim.current[key] = false),
  });

  return (
    <div className="iw-stage" ref={box}>
      <canvas ref={canvas} className="iw-canvas" data-on={gl === 'on' || undefined} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onContextMenu={(e) => e.preventDefault()} aria-label="The city, from the air. Fly with W, A, S and D; Space to go up, C to go down, Shift to go flat out." />
      <div className="iw-lines" ref={(el) => (hud.current.lines = el)} aria-hidden="true" />
      {bubble && (
        <div className="iw-bubble" ref={bubbleRef} aria-live="polite">
          <div>
            <b>{bubble.name}</b>
            {bubble.text}
          </div>
        </div>
      )}
      {gl === 'loading' && <p className="iw-loading">Over the city…</p>}

      <div className="iw-hud iw-hud-top">
        <div className="iw-brand">
          <p className="iw-eyebrow">Invincible · the Graysons’ city</p>
          <h2 id="iw-title" className="iw-title">
            Fly, Mark.
          </h2>
          <p className="iw-goal" ref={(el) => (hud.current.goal = el)} aria-live="polite" />
        </div>
        <div className="iw-tools">
          <button type="button" className="iw-btn" onClick={cycleTime} aria-label={`Time of day: ${TIME_NAME[time]}. Change it.`}>
            {TIME_NAME[time]}
          </button>
          <button type="button" className="iw-btn" onClick={() => setHelp((v) => !v)} aria-expanded={help}>
            Controls
          </button>
          <a className="iw-btn" href="#inv-game">
            Think, Mark!
          </a>
        </div>
      </div>
      <canvas className="iw-compass" ref={(el) => (hud.current.compass = el)} width="560" height="44" aria-hidden="true" />

      {help && (
        <div className="iw-help" role="dialog" aria-label="Controls">
          <dl>
            <dt>W A S D</dt>
            <dd>Fly the way you’re looking (walk, on the ground)</dd>
            <dt>Space · C</dt>
            <dd>Up (take off) · down (land)</dd>
            <dt>Shift</dt>
            <dd>Flat out. Past Mach 0.35 the air breaks</dd>
            <dt>Drag · arrows</dt>
            <dd>Look round</dd>
            <dt>E</dt>
            <dd>At a place: go in</dd>
            <dt>T</dt>
            <dd>Noon, dusk, night</dd>
          </dl>
          <p>A pad works: left stick flies, right stick looks, A up, B down, RT flat out.</p>
          <p>
            Things to do: Dad’s rings start over the street outside the house; {found} of {CARDS.length} title cards found; rescues come in on their own.
          </p>
        </div>
      )}

      <div className="iw-hud iw-hud-bottom">
        <div className="iw-gauge" aria-hidden="true">
          <p className="iw-speed">
            <span ref={(el) => (hud.current.speed = el)}>0</span>
            <small>km/h</small>
          </p>
          <div className="iw-bar">
            <i ref={(el) => (hud.current.bar = el)} />
          </div>
          <p className="iw-mach" ref={(el) => (hud.current.mach = el)}>
            Standing
          </p>
          <p className="iw-alt">
            <span>Height</span> <b ref={(el) => (hud.current.alt = el)}>0 m</b>
          </p>
        </div>
        <div className="iw-mid">
          {near && (
            <button type="button" className="iw-prompt" onClick={act}>
              <kbd>E</kbd> {near.name}
            </button>
          )}
          {toast && (
            <p className="iw-toast" key={toast.key} role="status">
              {toast.text}
            </p>
          )}
        </div>
        <canvas className="iw-map" ref={mapRef} width="180" height="180" aria-hidden="true" />
      </div>

      {touch && (
        <div className="iw-touch">
          <div className="iw-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}>
            <span ref={stickRef} />
          </div>
          <div className="iw-buttons">
            <button type="button" {...hold('touchUp')}>
              Up
            </button>
            <button type="button" {...hold('touchDown')}>
              Down
            </button>
            <button type="button" className="iw-boost" {...hold('touchBoost')}>
              Boost
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── the compass: a strip of headings, the places marked on it ──
const DIRS = [
  [0, 'S'],
  [Math.PI / 2, 'E'],
  [Math.PI, 'N'],
  [-Math.PI / 2, 'W'],
];
function drawCompass(c, yaw, h, places, marks = []) {
  const x = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  x.clearRect(0, 0, W, H);
  const span = Math.PI * 0.9; // what the strip shows
  const at = (a) => W / 2 + (wrap(yaw - a) / span) * W; // (yaw grows to the left)
  x.font = '700 20px system-ui, sans-serif';
  x.textAlign = 'center';
  x.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [a, n] of DIRS) {
    const px = at(a);
    if (px > 10 && px < W - 10) x.fillText(n, px, 19);
  }
  x.fillStyle = 'rgba(255,255,255,0.35)';
  for (let k = 0; k < 24; k++) {
    const px = at((k / 24) * Math.PI * 2);
    if (px > 0 && px < W) x.fillRect(px - 0.5, 24, 1, k % 6 === 0 ? 8 : 5);
  }
  for (const p of places) {
    const a = Math.atan2(p.x - h.p[0], p.z - h.p[2]);
    const px = at(a);
    if (px < 8 || px > W - 8) continue;
    const d = Math.hypot(p.x - h.p[0], p.z - h.p[2]);
    x.fillStyle = '#ffd23a';
    x.beginPath();
    x.arc(px, 36, 4, 0, Math.PI * 2);
    x.fill();
    if (d < 1800) {
      x.font = '600 14px system-ui, sans-serif';
      x.fillText(p.name.replace(/^The /, ''), px, 12);
    }
  }
  for (const m of marks) {
    const px = at(Math.atan2(m.x - h.p[0], m.z - h.p[2]));
    const cx = Math.max(10, Math.min(W - 10, px));
    x.fillStyle = m.color;
    x.beginPath();
    x.moveTo(cx, 26);
    x.lineTo(cx + 7, 40);
    x.lineTo(cx - 7, 40);
    x.closePath();
    x.fill();
  }
  x.fillStyle = '#ffd23a';
  x.fillRect(W / 2 - 1, 22, 2, 18);
}

// ── the map: north up, round him, further out the higher he is ──
let base = null;
function mapBase() {
  if (base) return base;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const k = S / (WORLD.half * 2);
  const P = (v) => (v + WORLD.half) * k;
  x.fillStyle = '#3b4a2e';
  x.fillRect(0, 0, S, S);
  // the hills
  x.fillStyle = '#4a5236';
  x.fillRect(0, 0, S, P(HILLS));
  // the city's blocks, the suburbs, the water
  x.fillStyle = '#5b5d61';
  x.fillRect(P(CITY.x0), P(CITY.z0), (CITY.x1 - CITY.x0) * k, (CITY.z1 - CITY.z0) * k);
  x.fillStyle = '#4f6b3a';
  x.fillRect(P(SUBURB.x0), P(HILLS + 80), (SUBURB.x1 - SUBURB.x0) * k, (COAST - BEACH - HILLS - 120) * k);
  x.fillStyle = '#c9b98d';
  x.fillRect(0, P(COAST - BEACH), S, BEACH * k);
  x.fillStyle = '#21506a';
  x.fillRect(0, P(COAST - 20), S, S);
  x.fillRect(P(RIVER.x0), 0, (RIVER.x1 - RIVER.x0) * k, P(COAST));
  base = { c, k, P };
  return base;
}
function drawMap(c, h, yaw, alt, world, marks = []) {
  const x = c.getContext('2d');
  const W = c.width;
  const b = mapBase();
  if (!b.towers) {
    // the towers and houses, once
    const bx = b.c.getContext('2d');
    bx.fillStyle = '#8b8d92';
    for (const t of world.buildings) bx.fillRect(b.P(t.x - t.w / 2), b.P(t.z - t.d / 2), Math.max(1, t.w * b.k), Math.max(1, t.d * b.k));
    bx.fillStyle = '#a99a84';
    for (const t of world.houses) bx.fillRect(b.P(t.x - t.w / 2), b.P(t.z - t.d / 2), Math.max(1, t.w * b.k), Math.max(1, t.d * b.k));
    b.towers = true;
  }
  const span = clamp(500 + alt * 1.6, 500, WORLD.half * 2); // metres across
  const px = span * b.k;
  x.save();
  x.clearRect(0, 0, W, W);
  x.beginPath();
  x.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
  x.clip();
  x.drawImage(b.c, b.P(h.p[0]) - px / 2, b.P(h.p[2]) - px / 2, px, px, 0, 0, W, W);
  // the places
  for (const p of world.places) {
    const mx = W / 2 + ((p.x - h.p[0]) / span) * W;
    const my = W / 2 + ((p.z - h.p[2]) / span) * W;
    const r = Math.hypot(mx - W / 2, my - W / 2);
    const q = r > W / 2 - 10 ? (W / 2 - 10) / r : 1;
    x.fillStyle = '#ffd23a';
    x.strokeStyle = '#0e1a33';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(W / 2 + (mx - W / 2) * q, W / 2 + (my - W / 2) * q, 5, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  }
  for (const m of marks) {
    const mx = W / 2 + ((m.x - h.p[0]) / span) * W;
    const my = W / 2 + ((m.z - h.p[2]) / span) * W;
    const r = Math.hypot(mx - W / 2, my - W / 2);
    const q = r > W / 2 - 10 ? (W / 2 - 10) / r : 1;
    x.fillStyle = m.color;
    x.strokeStyle = '#000';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(W / 2 + (mx - W / 2) * q, W / 2 + (my - W / 2) * q, 6, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  }
  // him, pointing where he's looking
  x.translate(W / 2, W / 2);
  x.rotate(-yaw + Math.PI);
  x.fillStyle = '#5fc8ff';
  x.strokeStyle = '#08121f';
  x.beginPath();
  x.moveTo(0, -9);
  x.lineTo(6, 7);
  x.lineTo(0, 3);
  x.lineTo(-6, 7);
  x.closePath();
  x.fill();
  x.stroke();
  x.restore();
  x.strokeStyle = 'rgba(255,210,58,0.6)';
  x.lineWidth = 2;
  x.beginPath();
  x.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
  x.stroke();
}

// ── without 3D: the places, as cards ──
function Cards({ three, gl, retry }) {
  return (
    <div className="iw-cards shell">
      <p className="iw-eyebrow">Invincible · the Graysons’ city</p>
      <h2 id="iw-title" className="iw-title">
        Fly, Mark.
      </h2>
      <p className="iw-cards-lead">{gl === 'lost' ? 'The graphics chip let go of the city.' : three.can ? 'The city is 3D, and 3D is off.' : 'The city is 3D, and this browser has no 3D.'} Here’s what’s down there.</p>
      <ul className="iw-cards-list">
        {PLACES.map((p) => (
          <li key={p.id}>
            <b>{p.name}</b>
            <span>{p.line}</span>
          </li>
        ))}
      </ul>
      {(gl === 'lost' || (three.can && !three.on)) && (
        <button type="button" className="btn btn-primary mt-6" onClick={gl === 'lost' ? retry : () => three.set('on')}>
          {gl === 'lost' ? 'Try again' : 'Turn 3D on'}
        </button>
      )}
    </div>
  );
}

