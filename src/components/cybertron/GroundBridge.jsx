import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion, useMediaQuery } from '../../lib/hooks';
import { useAchievements } from '../Achievements';
import Vehicle from './Vehicle';
import { capturePointer } from '../../lib/pointer';

// The ground bridge, Ratchet's way home for Team Prime. They drive in from the
// left in vehicle mode with Vehicons in among them; hold the bridge open as an
// Autobot reaches it and let go before a Vehicon does. Leave an Autobot behind
// or let a Vehicon through and it's a strike; three and Ratchet takes back the
// controls. The decision is made the moment each one reaches the bridge.

const sfx = () => import('../../lib/sfx');

const TEAM = [
  { id: 'arcee', name: 'Arcee', kind: 'bike' },
  { id: 'bumblebee', name: 'Bumblebee', kind: 'muscle' },
  { id: 'bulkhead', name: 'Bulkhead', kind: 'suv' },
  { id: 'wheeljack', name: 'Wheeljack', kind: 'rally' },
  { id: 'smokescreen', name: 'Smokescreen', kind: 'racer' },
  { id: 'optimus', name: 'Optimus', kind: 'truck' },
];
const VEHICONS = 8;
const WIDTH = { bike: 84, muscle: 100, suv: 104, rally: 96, racer: 104, truck: 148, vehicon: 100 };
const BRIDGE_AT = 0.8; // the bridge's center, as a share of the stage's width
const STRIKES = 3;

const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

// Who comes when: an Autobot first, Optimus the last of the team, Vehicons in
// between, and later on some of them tailgating an Autobot.
function makePlan() {
  const team = [...shuffle(TEAM.slice(0, 5)), TEAM[5]];
  const order = [team[0]];
  let a = 1;
  let v = 0;
  while (a < team.length || v < VEHICONS) {
    const bots = team.length - a;
    const cons = VEHICONS - v;
    const bot = bots > 0 && (cons === 0 || Math.random() < bots / (bots + cons));
    if (bot) order.push(team[a++]);
    else {
      order.push({ id: 'vehicon', name: 'A Vehicon', kind: 'vehicon', con: true });
      v += 1;
    }
  }
  let arrive = 0;
  return order.map((who, i) => {
    const k = i / (order.length - 1);
    const tailgate = i > 3 && who.con && !order[i - 1].con && Math.random() < 0.55;
    const gap = i === 0 ? 0 : tailgate ? 0.62 : 0.95 + Math.random() * (0.75 - 0.35 * k);
    arrive += gap;
    return { ...who, key: i, arrive, cross: 3.2 - 1.1 * k };
  });
}

export default function GroundBridge() {
  const { unlock } = useAchievements();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const stage = useRef(null);
  const els = useRef(new Map());
  const game = useRef(null);
  const held = useRef(false);
  const [phase, setPhase] = useState('idle'); // idle | run | done
  const [open, setOpen] = useState(false);
  const [cars, setCars] = useState([]);
  const [hud, setHud] = useState({ home: 0, out: 0, strikes: 0 });
  const [say, setSay] = useState('');
  const [result, setResult] = useState(null);

  const setBridge = (on) => {
    if (held.current === on) return;
    held.current = on;
    setOpen(on);
    if (on && game.current && !game.current.over) {
      audioContext();
      sfx().then((s) => s.bridge());
    }
  };

  const finish = (g, lost) => {
    g.over = true;
    held.current = false;
    setOpen(false);
    const perfect = !lost && g.home === TEAM.length && g.out === VEHICONS;
    setResult({ lost, perfect, home: g.home, out: g.out });
    setPhase('done');
    if (perfect) unlock('groundbridge');
    sfx().then((s) => (lost ? s.alarm() : perfect ? s.victory() : s.oneUp()));
  };

  const start = () => {
    audioContext(); // in the click, so the bridge can be heard
    const el = stage.current;
    if (!el) return;
    cancelAnimationFrame(game.current?.raf ?? 0);
    const plan = makePlan();
    game.current = { plan, t: 0, next: 0, live: [], home: 0, out: 0, strikes: 0, last: performance.now(), over: false, raf: 0, visible: true };
    els.current.clear();
    held.current = false;
    setOpen(false);
    setCars([]);
    setHud({ home: 0, out: 0, strikes: 0 });
    setResult(null);
    setSay('Bridge coordinates locked. Here they come.');
    setPhase('run');
  };

  // the loop: spawn, drive, decide at the bridge, clip whoever goes through
  useEffect(() => {
    if (phase !== 'run') return undefined;
    const g = game.current;
    const el = stage.current;
    if (!g || !el) return undefined;
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => (g.visible = e.intersectionRatio > 0.35), { threshold: [0, 0.35, 0.6] }) : null;
    io?.observe(el);

    const scale = () => Math.max(26, Math.min(60, el.clientWidth * 0.05)) / 40; // css px per drawing unit
    const tick = (now) => {
      const dt = Math.min(0.05, (now - g.last) / 1000);
      g.last = now;
      if (g.over) return;
      if (g.visible && !document.hidden) {
        g.t += dt;
        const W = el.clientWidth;
        const xp = W * BRIDGE_AT;
        const u = scale();
        // spawn whoever is due: they arrive at the bridge at their planned time
        while (g.next < g.plan.length) {
          const p = g.plan[g.next];
          const speed = W / p.cross;
          if (g.t < p.arrive + g.offset - (xp + 6) / speed) break;
          g.live.push({ ...p, x: -6, speed, w: WIDTH[p.kind] * u, state: 'drive', fade: 1 });
          setCars((c) => [...c, p]);
          g.next += 1;
        }
        let changed = false;
        for (const v of g.live) {
          if (v.state === 'drive') {
            v.x += v.speed * dt;
            if (v.x >= xp) {
              changed = true;
              if (held.current) {
                v.state = 'through';
                sfx().then((s) => s.zip());
                if (v.con) {
                  g.strikes += 1;
                  setSay('A Vehicon got through the bridge!');
                  sfx().then((s) => s.alarm());
                } else {
                  g.home += 1;
                  setSay(`${v.name} is home.`);
                }
              } else if (v.con) {
                v.state = 'stopped';
                g.out += 1;
                setSay('Shut out a Vehicon.');
              } else {
                v.state = 'left';
                g.strikes += 1;
                setSay(`Left ${v.name} behind!`);
                sfx().then((s) => s.buzz());
              }
            }
          } else if (v.state === 'through') {
            v.x += v.speed * dt;
            if (v.x - v.w > xp) v.done = true;
          } else if (v.state === 'left') {
            v.x += v.speed * dt;
            v.fade -= dt / 0.9;
            if (v.fade <= 0 || v.x - v.w > W) v.done = true;
          } else if (v.state === 'stopped') {
            v.speed = Math.max(0, v.speed - 1400 * dt);
            v.x += v.speed * dt;
            v.fade -= dt / 0.8;
            if (v.fade <= 0) v.done = true;
          }
          const node = els.current.get(v.key);
          if (node) {
            if (!v.sized) {
              node.style.width = `${v.w.toFixed(1)}px`;
              v.sized = true;
            }
            node.style.transform = `translate3d(${(v.x - v.w).toFixed(1)}px, 0, 0)`;
            node.style.opacity = Math.max(0, v.fade).toFixed(2);
            // whoever goes through disappears into the vortex at its center
            node.style.clipPath = v.state === 'through' ? `inset(0 ${Math.max(0, v.x - xp).toFixed(1)}px 0 0)` : '';
          }
        }
        if (g.live.some((v) => v.done)) {
          const gone = new Set(g.live.filter((v) => v.done).map((v) => v.key));
          g.live = g.live.filter((v) => !v.done);
          setCars((c) => c.filter((p) => !gone.has(p.key)));
        }
        if (changed) setHud({ home: g.home, out: g.out, strikes: g.strikes });
        if (g.strikes >= STRIKES) return finish(g, true);
        if (g.next >= g.plan.length && g.live.length === 0) return finish(g, false);
      }
      g.raf = requestAnimationFrame(tick);
    };
    // the first one sets off straight away; everyone else keeps to the plan
    g.offset = (el.clientWidth * BRIDGE_AT + 6) / (el.clientWidth / g.plan[0].cross) + 0.3;
    g.last = performance.now();
    g.raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(g.raf);
      io?.disconnect();
    };
    // the loop reads everything it needs from refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // hold Space (or Enter) to open the bridge while a run is on
  useEffect(() => {
    if (phase !== 'run') return undefined;
    const isKey = (e) => e.key === ' ' || e.key === 'Enter';
    const down = (e) => {
      const t = e.target;
      if (!isKey(e) || (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      if (!e.repeat) setBridge(true);
    };
    const up = (e) => {
      if (!isKey(e)) return;
      e.preventDefault();
      setBridge(false);
    };
    const blur = () => setBridge(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
    // setBridge only touches refs and state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(game.current?.raf ?? 0), []);

  const press = (e) => {
    if (phase !== 'run') return;
    e.preventDefault();
    capturePointer(e);
    setBridge(true);
  };
  const release = () => setBridge(false);
  const hold = { onPointerDown: press, onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release, onContextMenu: (e) => e.preventDefault() };

  return (
    <div className="gbr">
      <div ref={stage} className="gbr-stage" data-open={open || undefined} data-phase={phase} {...hold}>
        <svg className="gbr-scene" viewBox="0 0 1000 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="gbr-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1b1838" />
              <stop offset="0.55" stopColor="#7a3b5c" />
              <stop offset="1" stopColor="#f08a4b" />
            </linearGradient>
          </defs>
          <rect width="1000" height="420" fill="url(#gbr-sky)" />
          <circle cx="210" cy="250" r="46" fill="#ffc27a" opacity="0.55" />
          {/* the mesas outside Jasper, Nevada: the base is inside the tallest */}
          <path d="M0 330 L40 330 L60 262 L190 258 L214 330 L330 330 L352 290 L430 286 L452 330 L1000 330 V420 H0 Z" fill="#4a2a3a" />
          <path d="M560 330 L590 214 L800 206 L836 330 Z" fill="#3a2030" />
          <path d="M660 214 h70 v6 h-70 Z" fill="#2a1622" opacity="0.6" />
          <path d="M0 330 H1000 V420 H0 Z" fill="#2b1c22" />
          <path d="M0 334 H1000" stroke="#5b3a3f" strokeWidth="3" />
          <path d="M0 382 H1000" stroke="#d9a35f" strokeWidth="3" strokeDasharray="34 26" opacity="0.55" />
        </svg>

        <div className="gbr-road">
          {cars.map((p) => (
            <div
              key={p.key}
              ref={(n) => (n ? els.current.set(p.key, n) : els.current.delete(p.key))}
              className="gbr-car"
              data-con={p.con || undefined}
              style={{ '--w': WIDTH[p.kind], transform: 'translate3d(-110%, 0, 0)' }}
            >
              <Vehicle kind={p.kind} width={WIDTH[p.kind]} />
            </div>
          ))}
        </div>

        <div className="gbr-bridge" aria-hidden="true">
          <span className="gbr-ring" />
          <span className="gbr-vortex" />
        </div>

        <div className="gbr-hud" aria-hidden={phase === 'idle' || undefined}>
          <span>
            Home <b>{hud.home}</b>/{TEAM.length}
          </span>
          <span>
            Shut out <b>{hud.out}</b>/{VEHICONS}
          </span>
          <span className="gbr-strikes" aria-label={`${hud.strikes} of ${STRIKES} strikes`}>
            {Array.from({ length: STRIKES }, (_, i) => (
              <i key={i} data-on={i < hud.strikes || undefined} />
            ))}
          </span>
        </div>

        {phase !== 'run' && (
          <div className="gbr-card">
            {phase === 'done' && result ? (
              <>
                <p className="gbr-card-title">{result.lost ? 'Ratchet takes the controls back.' : result.perfect ? 'Everyone home. Not a Vehicon in sight.' : 'The bridge is closed.'}</p>
                <p className="gbr-card-text">
                  Team Prime home: {result.home} of {TEAM.length}. Vehicons shut out: {result.out} of {VEHICONS}.
                </p>
              </>
            ) : (
              <>
                <p className="gbr-card-title">Ratchet, we need a bridge.</p>
                <p className="gbr-card-text">Hold the bridge open as an Autobot reaches it, and let go before a Vehicon does.</p>
              </>
            )}
            <button type="button" className="btn btn-primary btn-sm mt-4" onClick={start} onPointerDown={(e) => e.stopPropagation()}>
              {phase === 'done' ? 'Bridge them again' : 'Power up the bridge'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost gbr-hold" disabled={phase !== 'run'} aria-pressed={open} {...hold}>
          {open ? 'Bridge open' : 'Hold to open the bridge'}
        </button>
        <p className="text-sm text-muted">{touch ? 'Or press and hold the scene.' : 'Or hold Space, or press and hold the scene.'}</p>
      </div>
      <p className="mt-3 min-h-[1.5em] text-sm text-body" role="status" aria-live="polite">
        {phase === 'run' ? say : ''}
      </p>
      {prefersReducedMotion() && <p className="sr-only">The vortex holds still while reduced motion is on.</p>}
    </div>
  );
}
