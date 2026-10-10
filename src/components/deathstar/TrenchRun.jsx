import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';
import { local, prefersReducedMotion } from '../../lib/hooks';
import { SCRIPTS } from '../../fun/scripts';
import { HURT, TRENCH, boundsAt, endRun, fireTorpedo, newRun, portZ, stepRun, toggleComputer, trenchStart, zoneAt } from './trench';
import { capturePointer } from '../../lib/pointer';
import { createImpacts, impactGroups } from '../../lib/impact';
import { debugOn, debugPanel } from '../../lib/debugPanel';
import { use3D } from '../../lib/gpu';
import { settle } from '../../lib/settle';
import { sayVoiced } from '../../lib/voiced';
import { speakerOf } from './voicelines';
import { LEVEL, LEVELS, TrenchCard, TrenchControls, TrenchTouch } from './TrenchHud';
import '../../styles/lazy/deathstar.css';

const sfx = () => import('../../lib/sfx');
// the films' own lines, where the run says one the site has a recording of;
// the rest in the speaker's own voice, where it's been made (lib/voiced.js)
const SAID = { trench: 'stayOnTarget', vader: 'forceIsStrong' };
const say = (key, text) => {
  if (SAID[key]) return import('../../lib/clips').then((c) => c.playClip(SAID[key]));
  const who = speakerOf(text);
  return who ? sayVoiced(who, text) : null;
};
// The HUD writes in the site's language when language mode is on.
const hudFamily = () => {
  const script = SCRIPTS[document.documentElement.dataset.script];
  return script ? `${script.font}, monospace` : '"JetBrains Mono", monospace';
};
const play = (name, voice) => sfx().then((s) => (voice ? s[name]?.(voice) : s[name]?.()));
// a hit as hard as it was (trench.js's HURT, by the hit law: lib/impact.js)
const hurtLaw = createImpacts();
const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration */
  }
};
const BEST = 'tp-trench-best';

// The trench run, on a 2D canvas (no WebGL, so it plays without a GPU). The
// rules live in ./trench.js; this draws them and handles the controls.

// Luke's X-wing from behind: four wings in an X, an engine at each root.
function drawXwing(ctx, x, y, s, bank, t, firing) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank);
  ctx.lineCap = 'round';
  for (const a of [-0.42, 0.42, Math.PI - 0.42, Math.PI + 0.42]) {
    ctx.strokeStyle = '#cfd5dd';
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 7 * s, Math.sin(a) * 7 * s);
    ctx.lineTo(Math.cos(a) * 46 * s, Math.sin(a) * 46 * s);
    ctx.stroke();
    ctx.strokeStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 22 * s, Math.sin(a) * 22 * s);
    ctx.lineTo(Math.cos(a) * 30 * s, Math.sin(a) * 30 * s);
    ctx.stroke();
    // laser cannon at the tip, bright as it fires
    ctx.fillStyle = firing ? '#ff6b5a' : '#e8ecf0';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 47 * s, Math.sin(a) * 47 * s, (firing ? 2.8 : 1.8) * s, 0, Math.PI * 2);
    ctx.fill();
    // engine glow
    const glow = 0.75 + 0.25 * Math.sin(t * 30 + a * 3);
    ctx.fillStyle = `rgba(255,140,90,${glow})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 12 * s, Math.sin(a) * 12 * s, 3.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e1e5ea';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a4048';
  ctx.beginPath();
  ctx.arc(0, -1 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Vader's TIE Advanced: a round cockpit between two bent wings.
function drawTieAdvanced(ctx, x, y, s, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.strokeStyle = '#aeb5bd';
  ctx.fillStyle = '#2c3138';
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 8 * s, -12 * s);
    ctx.lineTo(side * 14 * s, -4 * s);
    ctx.lineTo(side * 14 * s, 4 * s);
    ctx.lineTo(side * 8 * s, 12 * s);
    ctx.lineTo(side * 10 * s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side * 4 * s, 0);
    ctx.lineTo(side * 10 * s, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#4a5058';
  ctx.beginPath();
  ctx.arc(0, 0, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// A TIE fighter head on: two flat hexagonal wings, a ball cockpit, the window.
function drawTieFighter(ctx, x, y, r, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = a;
  ctx.fillStyle = '#3a4048';
  ctx.strokeStyle = '#9aa3ad';
  ctx.lineWidth = Math.max(1, r * 0.06);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const wx = side * r * 1.05;
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i + Math.PI / 6;
      const px = wx + Math.cos(ang) * r * 0.28;
      const py = Math.sin(ang) * r * 0.95;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side * r * 0.32, 0);
    ctx.lineTo(side * r * 0.95, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#5a626c';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#12161b';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// The stars over the station, fixed, drawn only where there's sky.
const STARS = (() => {
  const r = rng(99);
  return Array.from({ length: 90 }, () => ({ x: r(), y: r(), s: r() < 0.15 ? 2 : 1, a: 0.35 + r() * 0.6 }));
})();

// `clock` is how many seconds are left in the Battle of Yavin, if one is on;
// `over` ends a run in progress with that message (the Empire fired first).

export default function TrenchRun({ onWin, clock = null, over = null }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const game = useRef(null);
  const raf = useRef(0);
  const { unlock } = useAchievements();
  const [level, setLevel] = useState(() => (LEVELS.includes(local.get(LEVEL, 'red5')) ? local.get(LEVEL, 'red5') : 'red5'));
  const [best, setBest] = useState(() => {
    const b = local.get(BEST, {});
    return b && typeof b === 'object' ? b : {};
  });
  const [ui, setUi] = useState({ phase: 'ready', shields: 3, maxShields: 3, torpedoes: 2, computer: true, score: 0, message: '', newBest: false });
  const fx = useRef({ combo: null, near: 0, lowered: false });
  // WebGL where there's a graphics chip for it (./Trench3D.js), the 2D canvas otherwise
  const three = use3D();
  const glCanvas = useRef(null);
  const glRef = useRef(null);
  const resizeRef = useRef(null);
  const glDrop = useRef(null);
  const [glState, setGlState] = useState('off'); // off | loading | on | failed | lost
  const glStateRef = useRef('off');
  glStateRef.current = glState;
  const threeOn = useRef(three.on);
  threeOn.current = three.on;
  useEffect(() => {
    if (!three.on) {
      setGlState('off');
      return undefined;
    }
    let dead = false;
    const drop = (why) => {
      glRef.current?.dispose();
      glRef.current = null;
      if (!dead) setGlState(why);
    };
    glDrop.current = drop;
    let panel = null;
    setGlState('loading');
    const start = () =>
      import('./Trench3D')
        .then(({ createTrench3D }) => {
          if (dead || !glCanvas.current) return;
          try {
            // 3D stays 3D: frames that can't keep up lower its resolution and
            // effects; only a lost or failed context falls back to 2D.
            const t3 = createTrench3D(glCanvas.current, { onLost: () => drop('lost') });
            // its shaders link in the background (the dark of space meanwhile),
            // so its first frame doesn't stop the page
            settle(t3.ready).then(() => {
              if (dead || t3.lost) return t3.dispose();
              glRef.current = t3;
              // ?debug: the feel's numbers and the hit law's
              if (debugOn()) panel = debugPanel({ title: 'the trench', groups: [...t3.tune(), ...impactGroups(hurtLaw)], id: 'trench' });
              resizeRef.current?.();
              setGlState('on');
            });
          } catch {
            drop('failed');
          }
        })
        .catch(() => drop('failed'));
    // the trench is well down the page: its context is made as it comes near,
    // so on the way in the hero has the graphics chip (and a phone's memory)
    // to itself
    let near = null;
    if (typeof IntersectionObserver === 'undefined' || !glCanvas.current) start();
    else {
      near = new IntersectionObserver(
        ([e]) => {
          if (!e.isIntersecting) return;
          near.disconnect();
          near = null;
          start();
        },
        { rootMargin: '100% 0px 100% 0px' },
      );
      near.observe(glCanvas.current);
    }
    return () => {
      dead = true;
      near?.disconnect();
      panel?.dispose();
      glRef.current?.dispose();
      glRef.current = null;
    };
  }, [three.on]);
  // Obi-Wan's line, while it plays; it ends with the run
  const force = useRef(null);
  useEffect(() => {
    if (ui.phase !== 'running') force.current?.stop();
  }, [ui.phase]);
  useEffect(() => () => force.current?.stop(), []);

  const start = useCallback(() => {
    audioContext(); // in the click, so the run can be heard
    const g = newRun({ seed: (Date.now() & 0xffffff) || 1, level });
    g.last = 0;
    game.current = g;
    if (import.meta.env.DEV) window.__TRENCH__ = g; // for the browser tests
    fx.current.combo = null;
    setUi({ phase: 'running', shields: g.shields, maxShields: g.maxShields, torpedoes: 2, computer: true, score: 0, message: 'Red Five, standing by.', newBest: false });
    wrap.current?.focus({ preventScroll: true });
  }, [level]);

  // What the simulation said this frame: sounds, the radio, the score.
  const drain = useCallback(
    (g) => {
      if (!g.events.length) return;
      let message = null;
      let changed = false;
      for (const e of g.events) {
        switch (e.type) {
          case 'laser':
            play('laser');
            break;
          case 'kill':
            play('pop');
            buzz(15);
            if (e.combo > 1) fx.current.combo = { n: e.combo, t: g.t };
            changed = true;
            break;
          case 'near':
            fx.current.near = g.t;
            changed = true;
            break;
          case 'hit': {
            const k = hurtLaw.hit(e.force ?? HURT.crash, 'hit');
            play('hit', k ? { gain: k.gain, pitch: k.pitch } : null);
            buzz(90);
            message = e.shields === 1 ? 'Shields failing. One more hit.' : e.shields > 1 ? 'Hit. Shields holding.' : message;
            changed = true;
            break;
          }
          case 'torpedo':
            play('torpedo');
            changed = true;
            break;
          case 'blastfx':
            play('thunder');
            buzz(40);
            break;
          case 'blast':
            play('crumble');
            message = e.text;
            changed = true;
            break;
          case 'away':
            unlock('trench');
            onWin?.({ force: e.force }); // (with the Force, Han has nothing to say down here: the page says it)
            message = e.text;
            changed = true;
            break;
          case 'boom':
            play('boom');
            break;
          case 'vader':
          case 'han':
            play('flyby');
            say(e.type, e.text);
            message = e.text;
            break;
          case 'r2':
            play('beeps');
            say(e.type, e.text);
            message = e.text;
            changed = true;
            break;
          case 'computer':
            changed = true;
            break;
          case 'say':
            say(e.key, e.text);
            message = e.text;
            changed = true;
            break;
          case 'hold':
          case 'miss':
            message = e.text;
            changed = true;
            break;
          case 'won':
          case 'lost': {
            if (e.type === 'won') say(e.type, e.text); // (Han's, with the computer on)
            message = e.text;
            changed = true;
            const prev = best[g.level] ?? 0;
            const isBest = e.type === 'won' && g.score > prev;
            if (isBest) {
              const next = { ...best, [g.level]: g.score };
              setBest(next);
              local.set(BEST, next);
            }
            setUi((u) => ({ ...u, newBest: isBest }));
            break;
          }
          default:
        }
      }
      g.events.length = 0;
      if (changed || message)
        setUi((u) => ({
          ...u,
          phase: g.status,
          shields: g.shields,
          torpedoes: g.torpedoes,
          computer: g.computer,
          score: g.score,
          message: message ?? u.message,
        }));
    },
    [best, onWin, unlock],
  );
  const drainRef = useRef(drain);
  drainRef.current = drain;

  const fire = useCallback(() => {
    const g = game.current;
    if (!g) return;
    fireTorpedo(g);
    drainRef.current(g);
  }, []);

  useEffect(() => {
    const g = game.current;
    if (!over || !g || g.status !== 'running') return;
    endRun(g, over);
    drainRef.current(g);
  }, [over]);

  const switchComputer = useCallback(() => {
    const g = game.current;
    if (!g || g.status !== 'running') return;
    const on = toggleComputer(g);
    if (!on) {
      audioContext();
      import('../../lib/clips').then(async (c) => {
        force.current?.stop();
        force.current = await c.playClip('useTheForce');
        // switched back on, or the run ended, before it loaded
        if (!game.current || game.current.status !== 'running' || game.current.computer) force.current?.stop();
      });
    } else force.current?.stop();
    drainRef.current(g);
    setUi((u) => ({ ...u, computer: on, message: on ? 'Targeting computer on.' : 'You switched off your targeting computer. Use the Force: a hit is worth half again.' }));
  }, []);

  // The loop
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    const size = { w: 0, h: 0, dpr: 1 };
    const perf = { acc: 0, n: 0 };
    const calm = prefersReducedMotion();
    const resize = () => {
      const r = cv.getBoundingClientRect();
      size.dpr = fx.current.lowered ? 1 : Math.min(2, window.devicePixelRatio || 1);
      size.w = r.width;
      size.h = r.height;
      cv.width = Math.round(r.width * size.dpr);
      cv.height = Math.round(r.height * size.dpr);
      glRef.current?.resize(size.w, size.h);
      draw();
    };
    resizeRef.current = resize;
    const project = (x, y, z, g) => {
      const f = size.h * 0.95;
      const s = f / Math.max(TRENCH.near, z);
      return [size.w / 2 + (x - g.px * 0.85) * s * 0.55, size.h * 0.46 - (y - g.py * 0.85) * s * 0.42];
    };

    // before the first run, a slow fly-over of the surface
    const idle = { z: 0, px: 0, py: 1.9, tx: 0, ty: 1.9, items: [], towers: [], ties: [], bolts: [], lasers: [], rear: [], shots: [], blasts: [], scorch: [], fx: [], computer: true, flash: 0, shake: 0, status: 'ready', t: 0, vader: {} };
    const idleState = () => {
      if (!calm) {
        const t = performance.now() / 1000;
        idle.t = t;
        idle.z = (t * 2.6) % 80;
        idle.px = idle.tx = Math.sin(t * 0.35) * 0.9;
        idle.py = idle.ty = 1.85 + Math.sin(t * 0.5) * 0.25;
      }
      return idle;
    };

    function draw(ms = 16) {
      const g = game.current ?? idleState();
      const { w, h, dpr } = size;
      if (!w) return;
      const detail = !fx.current.lowered;
      const { near: NEAR, far: FAR } = TRENCH;
      const gl = glRef.current && !glRef.current.lost ? glRef.current : null;
      // the port: how far, and whether a torpedo would go in from here
      const portD = portZ() - g.z;
      const [wLo, wHi] = TRENCH.window;
      const inWindow = portD > wLo && portD < wHi;
      const lined = Math.abs(g.px) < TRENCH.lined.x && g.py < TRENCH.lined.y;
      let portAt = null;
      // the ship rocks when hit, and the station shakes as it goes
      let sx = 0;
      let sy = 0;
      if (!calm && !gl) {
        const k = (g.win?.boom ? Math.max(0, 0.9 - (g.win.t - 0.6)) * 14 : 0) + (g.shake ?? 0) * 18;
        if (k) {
          sx = (Math.random() - 0.5) * k;
          sy = (Math.random() - 0.5) * k;
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
      if (gl) {
        // the world is drawn in WebGL underneath; this canvas is only the HUD
        try {
          gl.render(g, ms, { calm });
        } catch {
          glDrop.current?.('failed'); // a driver that falls over mid-run: carry on in 2D
        }
        ctx.clearRect(-20, -20, w + 40, h + 40);
      }
      // 3D on its way: just the dark of space until it's ready, never the 2D world first
      const waiting = !gl && threeOn.current && (glStateRef.current === 'loading' || glStateRef.current === 'off');
      if (waiting) {
        ctx.fillStyle = '#05060b';
        ctx.fillRect(-20, -20, w + 40, h + 40);
      } else if (!gl || !glRef.current) {
        ctx.fillStyle = '#05060b';
        ctx.fillRect(-20, -20, w + 40, h + 40);

        // stars, above the station's horizon
        const horizon = project(0, 1, FAR, g)[1];
        if (horizon > 0) {
          for (const st of STARS) {
            const y = st.y * horizon;
            const x = (((st.x * w - g.px * 6 - g.z * 0.3) % w) + w) % w;
            ctx.fillStyle = `rgba(220,228,255,${st.a})`;
            ctx.fillRect(x, y, st.s, st.s);
          }
        }

        // Trench walls and floor, and the surface either side: solid panels,
        // fogged with distance, with the station's surface detail. Panels are
        // keyed to world position so the detail stays put as you fly past it.
        const step = 2;
        const base = Math.floor(g.z / step);
        const quad = (pts) => {
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fill();
        };
        const shade = (v, z) => {
          const f = Math.max(0, Math.min(1, z / FAR));
          const c = Math.round(v * (1 - f) + 6 * f);
          return `rgb(${c},${c + 1},${c + 4})`;
        };
        const over = g.py > 1.05; // the camera is above the surface
        const reach = over ? 16 : 7;
        if (over) {
          // the plating right under the ship, nearer than the panels start
          ctx.fillStyle = shade(36, NEAR);
          const y0 = project(0, 1, NEAR, g)[1];
          ctx.fillRect(-20, y0 - 1, w + 40, h - y0 + 21);
        }
        for (let k = Math.ceil(FAR / step); k >= 0; k--) {
          const z1 = (base + k) * step - g.z;
          const z2 = z1 + step;
          if (z2 <= NEAR) continue;
          const a = Math.max(NEAR, z1);
          const seed = base + k;
          const tone = seed % 2 ? 52 : 44;
          const P = (x, y, z) => project(x, y, z, g);
          ctx.fillStyle = shade(tone - 8, a);
          quad([P(-reach, 1, a), P(-1, 1, a), P(-1, 1, z2), P(-reach, 1, z2)]);
          quad([P(1, 1, a), P(reach, 1, a), P(reach, 1, z2), P(1, 1, z2)]);
          if (over && detail && seed % 3 === 0) {
            // the surface's plating seams
            ctx.fillStyle = shade(tone + 10, a);
            quad([P(-reach, 1, a), P(-1, 1, a), P(-1, 1, a + 0.08), P(-reach, 1, a + 0.08)]);
            quad([P(1, 1, a), P(reach, 1, a), P(reach, 1, a + 0.08), P(1, 1, a + 0.08)]);
          }
          ctx.fillStyle = shade(tone, a);
          quad([P(-1, 1, a), P(-1, -1, a), P(-1, -1, z2), P(-1, 1, z2)]);
          quad([P(1, 1, a), P(1, -1, a), P(1, -1, z2), P(1, 1, z2)]);
          ctx.fillStyle = shade(tone - 16, a);
          quad([P(-1, -1, a), P(1, -1, a), P(1, -1, z2), P(-1, -1, z2)]);
          if (detail && !over) {
            // a few raised blocks on each wall
            const rand = rng(seed * 7 + 3);
            ctx.fillStyle = shade(tone + 22, a);
            for (let n = 0; n < 3; n++) {
              const side = rand() < 0.5 ? -1 : 1;
              const y0 = rand() * 1.6 - 0.9;
              const hgt = 0.08 + rand() * 0.22;
              const za = a + rand() * (z2 - a) * 0.6;
              const zb = Math.min(z2, za + 0.4 + rand() * 0.6);
              quad([P(side, y0 + hgt, za), P(side, y0, za), P(side, y0, zb), P(side, y0 + hgt, zb)]);
            }
          }
        }
        ctx.strokeStyle = 'rgba(190,200,215,0.18)';
        ctx.lineWidth = 1;
        for (const [x, y] of [[-1, 1], [-1, -1], [1, -1], [1, 1]]) {
          const [x1, y1] = project(x, y, NEAR, g);
          const [x2, y2] = project(x, y, FAR, g);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // The exhaust port, on the floor at the end of the trench. Close in and
        // it glows; inside firing range it pulses, green once you're lined up.
        if (portD < FAR && portD > NEAR) {
          const [px, py] = project(0, -0.98, portD, g);
          const [ex] = project(0.32, -0.98, portD, g);
          const r = Math.max(2, ex - px);
          portAt = [px, py, r];
          if ((g.status === 'running' || g.status === 'winning') && portD < 30) {
            const pulse = inWindow ? 0.55 + 0.45 * Math.sin((g.t ?? 0) * 10) : 0.5;
            const hue = inWindow && lined ? '120,255,160' : '255,179,71';
            ctx.strokeStyle = `rgba(${hue},${pulse})`;
            ctx.lineWidth = 2;
            for (const k of [1.6, 2.3]) {
              ctx.beginPath();
              ctx.ellipse(px, py, r * k, r * k * 0.4, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.fillStyle = `rgba(${hue},${0.25 * pulse})`;
            ctx.beginPath();
            ctx.ellipse(px, py, r * 2.3, r * 0.92, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#0b0c10';
          ctx.strokeStyle = '#d9dde3';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(px, py, r, r * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // scorch marks where torpedoes went off, on the floor and the walls
        for (const m of g.scorch ?? []) {
          const d = m.z - g.z;
          if (d < NEAR || d > FAR) continue;
          const [x, y] = project(m.x, m.y, d, g);
          const [x2] = project(m.x + m.r, m.y, d, g);
          const r = Math.max(2, Math.abs(x2 - x));
          const floor = m.on === 'floor';
          const sc = ctx.createRadialGradient(x, y, 0, x, y, r);
          sc.addColorStop(0, 'rgba(8,6,5,0.85)');
          sc.addColorStop(0.55, 'rgba(24,18,14,0.55)');
          sc.addColorStop(1, 'rgba(24,18,14,0)');
          ctx.fillStyle = sc;
          ctx.beginPath();
          ctx.ellipse(x, y, floor ? r : r * 0.45, floor ? r * 0.32 : r, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Everything in the world, far to near
        const things = [];
        for (const it of g.items) {
          const d = it.z - g.z;
          if (d > NEAR && d < FAR && !it.blasted && !(it.kind === 'turret' && !it.alive)) things.push([d, 'item', it]);
        }
        for (const tw of g.towers) {
          const d = tw.z - g.z;
          if (tw.alive && d > NEAR && d < FAR) things.push([d, 'tower', tw]);
        }
        for (const t of g.ties) {
          const d = t.z - g.z;
          if (t.alive && d > NEAR && d < FAR) things.push([d, 'tie', t]);
        }
        things.sort((a, b) => b[0] - a[0]);
        for (const [d, kind, it] of things) {
          const a = Math.min(1, 1.2 - d / FAR);
          if (kind === 'tower') {
            const P = (x, y, z) => project(x, y, z, g);
            const x0 = it.x - 0.16;
            const x1 = it.x + 0.16;
            const top = 1 + it.h;
            // the side facing the trench, the front, the roof, then a gun slit
            const inner = it.x > 0 ? x0 : x1;
            ctx.fillStyle = shade(58, d);
            quad([P(inner, 1, d), P(inner, 1, d + 0.3), P(inner, top, d + 0.3), P(inner, top, d)]);
            ctx.fillStyle = shade(84, d);
            quad([P(x0, 1, d), P(x1, 1, d), P(x1, top, d), P(x0, top, d)]);
            ctx.fillStyle = shade(120, d);
            quad([P(x0, top, d), P(x1, top, d), P(x1, top, d + 0.3), P(x0, top, d + 0.3)]);
            ctx.fillStyle = shade(24, d);
            quad([P(x0 + 0.04, top - 0.12, d), P(x1 - 0.04, top - 0.12, d), P(x1 - 0.04, top - 0.18, d), P(x0 + 0.04, top - 0.18, d)]);
            const [gx, gy] = P(it.x, top + 0.05, d);
            ctx.fillStyle = `rgba(255,120,90,${a * 0.85})`;
            ctx.fillRect(gx - 2, gy - 2, 4, 4);
          } else if (kind === 'tie') {
            const [x, y] = project(it.x, it.y, d, g);
            const [x2] = project(it.x + 0.26, it.y, d, g);
            drawTieFighter(ctx, x, y, Math.max(2, x2 - x), a);
          } else if (it.kind === 'catwalk') {
            const [x1, y1] = project(-1, it.y + 0.16, d, g);
            const [x2, y2] = project(1, it.y - 0.16, d, g);
            ctx.fillStyle = `rgba(190,196,204,${a * 0.9})`;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            ctx.fillStyle = `rgba(60,64,72,${a})`;
            ctx.fillRect(x1, y1 + (y2 - y1) * 0.55, x2 - x1, (y2 - y1) * 0.12);
          } else if (it.kind === 'wall') {
            const xa = it.side < 0 ? -1 : -0.05;
            const xb = it.side < 0 ? 0.05 : 1;
            const [x1, y1] = project(xa, 1, d, g);
            const [x2, y2] = project(xb, -1, d, g);
            ctx.fillStyle = `rgba(150,156,166,${a * 0.85})`;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            ctx.strokeStyle = `rgba(40,44,50,${a})`;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          } else if (it.kind === 'turret') {
            const x0 = it.side * 0.92;
            const [x1, y1] = project(x0 - 0.1, it.y + 0.12, d, g);
            const [x2, y2] = project(x0 + 0.1, it.y - 0.12, d, g);
            ctx.fillStyle = `rgba(96,102,112,${a})`;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            ctx.fillStyle = `rgba(255,120,90,${a})`;
            ctx.fillRect((x1 + x2) / 2 - 1.5, (y1 + y2) / 2 - 1.5, 3, 3);
          } else if (it.kind === 'bolt') {
            const [x1, y1] = project(it.x, it.y, d, g);
            const [x2, y2] = project(it.x, it.y, d + 1.4, g);
            ctx.strokeStyle = `rgba(141,255,107,${a})`;
            ctx.lineWidth = Math.max(1.5, 5 / d);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.lineWidth = 1;
          }
        }

        // bolts aimed at you (green), your lasers (red), missed torpedoes
        for (const b of g.bolts) {
          const d = b.z - g.z;
          if (d < NEAR || d > FAR) continue;
          const [x1, y1] = project(b.x, b.y, d, g);
          const [x2, y2] = project(b.x - b.vx * 0.06, b.y - b.vy * 0.06, d - b.vz * 0.06, g);
          ctx.strokeStyle = 'rgba(141,255,107,0.95)';
          ctx.lineWidth = Math.max(1.5, 5 / d);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        for (const l of g.lasers) {
          const d = l.z - g.z;
          if (d < NEAR || d > FAR) continue;
          const [x1, y1] = project(l.x, l.y, d, g);
          const [x2, y2] = project(l.x, l.y, d + 1.3, g);
          ctx.strokeStyle = 'rgba(255,82,64,0.95)';
          ctx.lineWidth = Math.max(1.5, 6 / d);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
        // torpedoes in flight: a hot blue-white core and a trail
        for (const s of g.shots) {
          const d = s.z - g.z;
          if (d < NEAR || d > FAR) continue;
          const [x1, y1] = project(s.x, s.y, d, g);
          const [x0, y0] = project(s.x, s.y - s.vy * 0.08, Math.max(NEAR, d - 2.2), g);
          const r = Math.max(2.5, 14 / d);
          const trail = ctx.createLinearGradient(x0, y0, x1, y1);
          trail.addColorStop(0, 'rgba(120,170,255,0)');
          trail.addColorStop(1, 'rgba(170,210,255,0.8)');
          ctx.strokeStyle = trail;
          ctx.lineWidth = r * 0.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.lineCap = 'butt';
          ctx.lineWidth = 1;
          const glow = ctx.createRadialGradient(x1, y1, 0, x1, y1, r * 2);
          glow.addColorStop(0, 'rgba(255,255,255,1)');
          glow.addColorStop(0.3, 'rgba(170,215,255,0.9)');
          glow.addColorStop(1, 'rgba(80,140,255,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x1, y1, r * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        // where they went off: a fireball that blooms and fades
        for (const b of g.blasts ?? []) {
          const d = b.z - g.z;
          if (d < NEAR || d > FAR) continue;
          const k = b.t / b.life;
          const [x, y] = project(b.x, b.y, d, g);
          const [x2] = project(b.x + 0.5 + k * 0.6, b.y, d, g);
          const r = Math.max(3, Math.abs(x2 - x));
          const fire = ctx.createRadialGradient(x, y, 0, x, y, r);
          fire.addColorStop(0, `rgba(255,250,230,${1 - k})`);
          fire.addColorStop(0.3, `rgba(255,190,90,${0.9 * (1 - k)})`);
          fire.addColorStop(0.7, `rgba(230,80,20,${0.5 * (1 - k)})`);
          fire.addColorStop(1, 'rgba(120,30,10,0)');
          ctx.fillStyle = fire;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // explosions
        for (const f of g.fx) {
          const d = f.z - g.z;
          if (d < NEAR || d > FAR) continue;
          const [x, y] = project(f.x, f.y, d, g);
          const k = f.t / f.life;
          const r = Math.max(1, (5 / d) * (1 - k * 0.5));
          ctx.fillStyle = `rgba(255,${Math.round(200 - k * 120)},${Math.round(120 - k * 100)},${1 - k})`;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }

        // Vader's shots streak past from behind
        for (const b of g.rear ?? []) {
          const d = b.z - g.z;
          if (d < NEAR || d > FAR) continue;
          const [x1, y1] = project(b.x, b.y, d, g);
          const [x2, y2] = project(b.x, b.y, d + 1.6, g);
          ctx.strokeStyle = 'rgba(141,255,107,0.95)';
          ctx.lineWidth = Math.max(1.5, 5 / d);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.lineWidth = 1;
        }

        // Luke's X-wing, banking with the steering
        const shipX = w / 2 + (g.tx - g.px) * 60;
        const shipY = h * 0.72;
        if (g.status !== 'won') {
          const s = Math.max(0.55, Math.min(1.2, h / 420));
          drawXwing(ctx, shipX, shipY, s, (g.tx - g.px) * 0.9 + g.px * 0.12, g.t ?? 0, (g.laserCool ?? 0) > TRENCH.laser.cooldown - 0.05);
        }

        // The two proton torpedoes, dropping into the port
        if (g.status === 'winning' && g.win && !g.win.boom && portAt) {
          const p = Math.min(1, g.win.t / 0.6);
          const e = p * p;
          for (const side of [-1, 1]) {
            const x0 = shipX + side * 10;
            const x = x0 + (portAt[0] - x0) * e;
            const y = shipY + (portAt[1] - shipY) * e - Math.sin(p * Math.PI) * 30;
            const glow = ctx.createRadialGradient(x, y, 0, x, y, 12);
            glow.addColorStop(0, 'rgba(255,255,255,1)');
            glow.addColorStop(0.35, 'rgba(160,210,255,0.9)');
            glow.addColorStop(1, 'rgba(80,140,255,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (g.win?.boom && !g.win.at) {
          g.win.at = project(0, -0.98, Math.max(NEAR + 0.05, portZ() - g.z), g);
          g.win.sparks = Array.from({ length: 70 }, () => ({
            a: Math.random() * Math.PI * 2,
            v: 80 + Math.random() * 520,
            life: 0.6 + Math.random() * 1.1,
            s: 1.5 + Math.random() * 3,
            c: Math.floor(Math.random() * 70),
          }));
        }

      }

      // Rear view: Vader closing in, then sent spinning by Han
      if (g.vader && (g.vader.on || g.vader.away > 0) && !g.win?.boom) {
        const bw = Math.min(150, w * 0.26);
        const bh = bw * 0.6;
        const bx = w - bw - 12;
        const by = 12;
        ctx.fillStyle = 'rgba(5,6,11,0.85)';
        ctx.strokeStyle = 'rgba(255,179,71,0.7)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = 'rgba(255,179,71,0.85)';
        ctx.font = `600 9px ${hudFamily()}`;
        ctx.textAlign = 'left';
        ctx.fillText('REAR', bx + 6, by + 12);
        const shrink = g.vader.gone ? Math.max(0.15, g.vader.away) : 1;
        drawTieAdvanced(ctx, bx + bw / 2 + Math.sin((g.t ?? 0) * 2) * bw * 0.12, by + bh / 2 + 4, (bw / 70) * shrink, g.vader.spin);
      }

      // Direct hit: a flash, a fireball from the port, a shockwave racing out
      // across the screen, sparks, and the station shaking itself apart
      if (g.win?.boom && (g.win.at || gl)) {
        const e = g.win.t - 0.6;
        if (!gl) {
          const [cx0, cy0] = g.win.at;
          const big = Math.hypot(w, h);
          const fire = Math.min(1, e / 1.2);
          const R = 20 + fire * big * 0.75;
          const fb = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, R);
          fb.addColorStop(0, `rgba(255,255,240,${0.95 * (1 - fire * 0.6)})`);
          fb.addColorStop(0.3, `rgba(255,190,90,${0.85 * (1 - fire * 0.7)})`);
          fb.addColorStop(0.7, `rgba(255,90,30,${0.5 * (1 - fire)})`);
          fb.addColorStop(1, 'rgba(255,60,20,0)');
          ctx.fillStyle = fb;
          ctx.fillRect(0, 0, w, h);
          const ring = Math.min(1, e / 1.4);
          ctx.strokeStyle = `rgba(200,230,255,${0.9 * (1 - ring)})`;
          ctx.lineWidth = Math.max(1, 14 * (1 - ring));
          ctx.beginPath();
          ctx.ellipse(cx0, cy0, ring * big * 0.9, ring * big * 0.28, 0, 0, Math.PI * 2);
          ctx.stroke();
          for (const sp of g.win.sparks) {
            const d = e * sp.v;
            const a = Math.max(0, 1 - e / sp.life);
            if (!a) continue;
            ctx.fillStyle = `rgba(255,${180 + sp.c},120,${a})`;
            ctx.fillRect(cx0 + Math.cos(sp.a) * d, cy0 + Math.sin(sp.a) * d * 0.6, sp.s, sp.s);
          }
        }
        if (e < 1.7) {
          ctx.fillStyle = `rgba(255,214,140,${Math.min(1, (1.7 - e) * 2)})`;
          ctx.font = `700 ${Math.round(Math.min(44, w / 9))}px ${hudFamily()}`;
          ctx.textAlign = 'center';
          ctx.fillText('DIRECT HIT', w / 2, h * 0.24);
        }
      }

      // Crosshair over the surface, targeting computer in the trench
      const zone = zoneAt(g.z);
      if (g.status === 'running') {
        const cx = w / 2;
        const cy = h * 0.46;
        if (zone !== 'trench') {
          ctx.strokeStyle = 'rgba(255,120,100,0.75)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.moveTo(cx - 24, cy);
          ctx.lineTo(cx - 8, cy);
          ctx.moveTo(cx + 8, cy);
          ctx.lineTo(cx + 24, cy);
          ctx.moveTo(cx, cy - 24);
          ctx.lineTo(cx, cy - 8);
          ctx.moveTo(cx, cy + 8);
          ctx.lineTo(cx, cy + 24);
          ctx.stroke();
        } else if (g.computer) {
          ctx.strokeStyle = 'rgba(255,179,71,0.85)';
          ctx.fillStyle = 'rgba(255,179,71,0.9)';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - 34, cy - 22, 68, 44);
          ctx.beginPath();
          ctx.moveTo(cx - 60, cy);
          ctx.lineTo(cx - 40, cy);
          ctx.moveTo(cx + 40, cy);
          ctx.lineTo(cx + 60, cy);
          ctx.stroke();
          if (portD < TRENCH.torpedoRange) {
            ctx.font = `600 12px ${hudFamily()}`;
            ctx.textAlign = 'center';
            ctx.fillText(`RANGE ${Math.max(0, Math.round(portD * 100))}`, cx, cy + 42);
            if (inWindow) {
              ctx.fillStyle = lined ? 'rgba(120,255,160,0.95)' : 'rgba(255,179,71,0.9)';
              ctx.font = `700 14px ${hudFamily()}`;
              ctx.fillText(lined ? 'LOCK · FIRE' : 'LOCK · STAY LOW', cx, cy - 30);
            }
          }
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ctx.beginPath();
          ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // the score, the zone, and how far to the port
        ctx.textAlign = 'left';
        ctx.font = `700 14px ${hudFamily()}`;
        ctx.fillStyle = 'rgba(255,214,140,0.95)';
        ctx.fillText(String(g.score).padStart(6, '0'), 12, 22);
        ctx.font = `600 10px ${hudFamily()}`;
        ctx.fillStyle = 'rgba(255,214,140,0.7)';
        const toTrench = trenchStart() - g.z;
        ctx.fillText(zone === 'surface' ? `SURFACE · TRENCH IN ${Math.max(0, Math.round(toTrench * 10))}` : zone === 'dive' ? 'GOING IN' : `TRENCH · PORT ${Math.max(0, Math.round(portD * 10))}`, 12, 37);
        // combo and near-miss call-outs
        const c = fx.current.combo;
        if (c && g.t - c.t < 1) {
          const k = (g.t - c.t) / 1;
          ctx.textAlign = 'center';
          ctx.font = `800 ${Math.round(22 + c.n * 4 - k * 6)}px ${hudFamily()}`;
          ctx.fillStyle = `rgba(255,214,140,${1 - k})`;
          ctx.fillText(`x${c.n} COMBO`, w / 2, h * 0.3 - k * 16);
        }
        if (g.t - fx.current.near < 0.7) {
          const k = (g.t - fx.current.near) / 0.7;
          ctx.textAlign = 'center';
          ctx.font = `700 13px ${hudFamily()}`;
          ctx.fillStyle = `rgba(160,230,255,${1 - k})`;
          ctx.fillText(`CLOSE · +${TRENCH.points.near}`, w / 2, h * 0.6 - k * 10);
        }
      }

      if (g.flash > 0) {
        ctx.fillStyle = `rgba(255,240,210,${calm ? g.flash * 0.45 : g.flash})`;
        ctx.fillRect(0, 0, w, h);
      }
    }

    let idleLast = 0;
    const loop = (now) => {
      raf.current = requestAnimationFrame(loop);
      const g = game.current;
      if (!g) {
        draw(idleLast ? now - idleLast : 16);
        idleLast = now;
        return;
      }
      const ms = g.last ? now - g.last : 16;
      g.last = now;
      // a slow machine (no GPU) drops to one canvas pixel per CSS pixel
      if (g.status === 'running' && !fx.current.lowered && size.dpr > 1) {
        perf.acc += ms;
        perf.n += 1;
        if (perf.n >= 90) {
          if (perf.acc / perf.n > 26) {
            fx.current.lowered = true;
            resize();
          }
          perf.acc = 0;
          perf.n = 0;
        }
      }
      if (g.status === 'running' || g.status === 'winning') {
        stepRun(g, Math.min(0.05, ms / 1000));
        drainRef.current(g);
      }
      draw(ms);
    };

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(cv);
    resize();
    // Only animate while the game is on screen.
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([e]) => {
            if (e.isIntersecting && !raf.current) raf.current = requestAnimationFrame(loop);
            if (!e.isIntersecting) {
              cancelAnimationFrame(raf.current);
              raf.current = 0;
              if (game.current) game.current.last = 0;
            }
          })
        : null;
    io?.observe(cv);
    raf.current = requestAnimationFrame(loop);
    const onVis = () => {
      if (game.current) game.current.last = 0;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Keys steer and fire from anywhere on the page while a run is on, so a
  // mouse or trackpad hand is free for the buttons. Touch drags to steer.
  const running = ui.phase === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const STEER = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
    const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const onDown = (e) => {
      const g = game.current;
      if (!g || g.status !== 'running' || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (STEER[key]) {
        e.preventDefault();
        g.keys[STEER[key]] = true;
      } else if (key === ' ') {
        // a focused button already acts on its own key press
        if (e.target instanceof HTMLButtonElement && e.target.dataset.trench == null) return;
        e.preventDefault();
        g.keys.fire = true;
      } else if (key === 'f' || key === 'Enter') {
        if (e.target instanceof HTMLButtonElement && e.target.dataset.trench == null) return;
        e.preventDefault();
        if (!e.repeat) fire();
      } else if (key === 't' && !e.repeat) switchComputer();
    };
    const onUp = (e) => {
      const g = game.current;
      if (!g) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (STEER[key]) g.keys[STEER[key]] = false;
      if (key === ' ') g.keys.fire = false;
    };
    const onBlur = () => {
      if (game.current) game.current.keys = {};
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      onBlur();
    };
  }, [running, fire, switchComputer]);

  // While a run is on, the page knows, so the guide's ? steps out from under
  // the fire buttons (extras.css); it is back on the title and end cards.
  useEffect(() => {
    if (!running) return undefined;
    const root = document.documentElement;
    root.dataset.playing = 'trench';
    return () => {
      if (root.dataset.playing === 'trench') delete root.dataset.playing;
    };
  }, [running]);

  // Before a run, Space or Enter on the screen starts one.
  const onKeyDown = (e) => {
    if (running || e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      start();
    }
  };

  // Touch: the ship follows the finger's movement, not its position, so the
  // finger never hides it. A mouse press fires the lasers while held.
  const drag = useRef(null);
  const onPointerDown = (e) => {
    const g = game.current;
    if (!g || g.status !== 'running') return;
    if (e.pointerType === 'mouse') {
      if (e.button === 0) {
        g.keys.fire = true;
        capturePointer(e);
      }
      return;
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: g.tx, ty: g.ty };
    capturePointer(e);
  };
  const onPointerMove = (e) => {
    const g = game.current;
    const d = drag.current;
    if (!g || !d || d.id !== e.pointerId || g.status !== 'running') return;
    const r = canvas.current.getBoundingClientRect();
    const b = boundsAt(g.z);
    const sxScale = b.x / TRENCH.bounds.trench.x;
    const syScale = (b.y1 - b.y0) / 1.7;
    g.tx = Math.max(-b.x, Math.min(b.x, d.tx + ((e.clientX - d.x) / r.width) * 2.6 * sxScale));
    g.ty = Math.max(b.y0, Math.min(b.y1, d.ty - ((e.clientY - d.y) / r.height) * 2.6 * syScale));
  };
  const endDrag = (e) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
    if (e.pointerType === 'mouse' && game.current) game.current.keys.fire = false;
  };
  // the Lasers buttons fire while held
  const lasers = (on) => {
    const g = game.current;
    if (g && g.status === 'running') g.keys.fire = on;
  };
  const holdLasers = {
    onPointerDown: (e) => {
      e.stopPropagation();
      capturePointer(e);
      lasers(true);
    },
    onPointerUp: () => lasers(false),
    onPointerCancel: () => lasers(false),
    onLostPointerCapture: () => lasers(false),
    onContextMenu: (e) => e.preventDefault(),
  };

  return (
    <div className="trench">
      <div
        ref={wrap}
        className="trench-screen"
        tabIndex={0}
        role="group"
        aria-label="Trench run. The arrow keys or W A S D steer, Space fires the lasers, F or Enter fires a torpedo, T switches the targeting computer. On a touch screen, drag to steer."
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: running ? 'none' : 'auto' }}
      >
        {three.on && <canvas ref={glCanvas} className="trench-gl" data-on={glState === 'on' || undefined} aria-hidden="true" />}
        <canvas ref={canvas} className="trench-canvas" />
        {running && <TrenchTouch computer={ui.computer} torpedoes={ui.torpedoes} onComputer={switchComputer} onFire={fire} holdLasers={holdLasers} />}
        {ui.phase !== 'running' && ui.phase !== 'winning' && <TrenchCard ui={ui} best={best} level={level} setLevel={setLevel} onStart={start} />}
      </div>
      <TrenchControls ui={ui} running={running} clock={clock} three={three} glState={glState} holdLasers={holdLasers} onFire={fire} onComputer={switchComputer} />
    </div>
  );
}
