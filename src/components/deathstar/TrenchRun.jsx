import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';
import { fmtClock } from './battle';
import { SCRIPTS } from '../../fun/scripts';

const sfx = () => import('../../lib/sfx');
// The HUD writes in the site's language when language mode is on.
const hudFamily = () => {
  const script = SCRIPTS[document.documentElement.dataset.script];
  return script ? `${script.font}, monospace` : '"JetBrains Mono", monospace';
};
const play = (name) => sfx().then((s) => s[name]());

// The trench run, on a 2D canvas (no WebGL, so it plays without a GPU).
// Fly Luke's X-wing down the trench, dodge catwalks, walls and turbolaser fire,
// shake Vader's TIE on the final approach, then put a proton torpedo into the
// thermal exhaust port. Three shields, two torpedoes. Turning the targeting
// computer off is optional, but noticed.

// Luke's X-wing from behind: four wings in an X, an engine at each root.
function drawXwing(ctx, x, y, s, bank, t) {
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
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 22 * s, Math.sin(a) * 22 * s);
    ctx.lineTo(Math.cos(a) * 30 * s, Math.sin(a) * 30 * s);
    ctx.stroke();
    // laser cannon at the tip
    ctx.fillStyle = '#e8ecf0';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 47 * s, Math.sin(a) * 47 * s, 1.8 * s, 0, Math.PI * 2);
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
function drawTie(ctx, x, y, s, spin) {
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

const LEN = 150; // trench length before the port, in world units
const SPEED = 7.2; // units a second
const PORT_Z = LEN + 18;
const NEAR = 0.7;
const FAR = 46;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function course(seed) {
  const rand = rng(seed);
  const items = [];
  for (let z = 16; z < LEN - 4; z += 6.5 + rand() * 3) {
    const r = rand();
    if (r < 0.42) items.push({ kind: 'catwalk', z, y: -0.55 + rand() * 1.1 });
    else if (r < 0.78) items.push({ kind: 'wall', z, side: rand() < 0.5 ? -1 : 1 });
    else items.push({ kind: 'bolt', z: z + 10, x: rand() * 1.6 - 0.8, y: rand() * 1.4 - 0.7, speed: 9 + rand() * 4 });
  }
  return items;
}

// `clock` is how many seconds are left in the Battle of Yavin, if one is on;
// `over` ends a run in progress with that message (the Empire fired first).

export default function TrenchRun({ onWin, clock = null, over = null }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const game = useRef(null);
  const raf = useRef(0);
  const { unlock } = useAchievements();
  const [ui, setUi] = useState({ phase: 'ready', shields: 3, torpedoes: 2, computer: true, range: null, message: '' });

  const start = useCallback(() => {
    audioContext(); // in the click, so the run can be heard
    game.current = {
      seed: Date.now() & 0xffff,
      items: course(Date.now() & 0xffff),
      z: 0,
      px: 0,
      py: 0,
      tx: 0,
      ty: 0,
      keys: new Set(),
      shields: 3,
      torpedoes: 2,
      computer: true,
      flash: 0,
      shots: [],
      rear: [],
      vader: { on: false, gone: false, cooldown: 1.2, spin: 0, away: 0 },
      t: 0,
      phase: 'running',
      last: 0,
    };
    setUi({ phase: 'running', shields: 3, torpedoes: 2, computer: true, range: null, message: 'Stay on target.' });
    wrap.current?.focus({ preventScroll: true });
  }, []);

  const fire = useCallback(() => {
    const g = game.current;
    if (!g || g.phase !== 'running' || g.torpedoes <= 0) return;
    const dist = PORT_Z - g.z;
    if (dist > 26) {
      setUi((u) => ({ ...u, message: 'Save your torpedoes for the exhaust port.' }));
      return;
    }
    g.torpedoes -= 1;
    play('torpedo');
    const onTarget = Math.abs(g.px) < 0.45 && g.py < 0.1;
    if (dist > 2.5 && dist < 9 && onTarget) {
      g.phase = 'won';
      g.flash = 1;
      setTimeout(() => play('hit'), 380);
      unlock('trench');
      setUi((u) => ({
        ...u,
        phase: 'won',
        torpedoes: g.torpedoes,
        message: g.computer ? 'Great shot. That was one in a million.' : 'The Force is strong with this one. Great shot.',
      }));
      onWin?.();
    } else {
      g.shots.push({ z: g.z + 1, x: g.px, y: g.py });
      setUi((u) => ({ ...u, torpedoes: g.torpedoes, message: dist >= 9 ? 'Too early. It just impacted on the surface.' : 'Negative. It just impacted on the surface.' }));
      if (g.torpedoes <= 0) {
        g.phase = 'lost';
        setUi((u) => ({ ...u, phase: 'lost', torpedoes: 0, message: 'Out of torpedoes. Pull up, and try again.' }));
      }
    }
  }, [onWin, unlock]);

  useEffect(() => {
    const g = game.current;
    if (!over || !g || g.phase !== 'running') return;
    g.phase = 'lost';
    setUi((u) => ({ ...u, phase: 'lost', message: over }));
  }, [over]);

  const toggleComputer = useCallback(() => {
    const g = game.current;
    if (!g || g.phase !== 'running') return;
    g.computer = !g.computer;
    if (!g.computer) {
      audioContext();
      import('../../lib/clips').then((c) => c.playClip('useTheForce'));
    }
    setUi((u) => ({ ...u, computer: g.computer, message: g.computer ? 'Targeting computer on.' : 'You switched off your targeting computer. Use the Force.' }));
  }, []);

  // The loop
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    const size = { w: 0, h: 0, dpr: 1 };
    const resize = () => {
      const r = cv.getBoundingClientRect();
      size.dpr = Math.min(2, window.devicePixelRatio || 1);
      size.w = r.width;
      size.h = r.height;
      cv.width = Math.round(r.width * size.dpr);
      cv.height = Math.round(r.height * size.dpr);
      draw();
    };
    const project = (x, y, z, g) => {
      const f = size.h * 0.95;
      const s = f / Math.max(NEAR, z);
      return [size.w / 2 + (x - g.px * 0.85) * s * 0.55, size.h * 0.46 - (y - g.py * 0.85) * s * 0.42];
    };

    function draw() {
      const g = game.current ?? { z: 0, px: 0, py: 0, items: [], computer: true, flash: 0, shots: [], phase: 'ready' };
      const { w, h, dpr } = size;
      if (!w) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05060b';
      ctx.fillRect(0, 0, w, h);

      // Trench walls and floor: solid panels, fogged with distance, with the
      // station's surface detail. Panels are keyed to world position so the
      // detail stays put as you fly past it.
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
      for (let k = Math.ceil(FAR / step); k >= 0; k--) {
        const z1 = (base + k) * step - g.z;
        const z2 = z1 + step;
        if (z2 <= NEAR) continue;
        const a = Math.max(NEAR, z1);
        const seed = base + k;
        const tone = seed % 2 ? 52 : 44;
        const P = (x, y, z) => project(x, y, z, g);
        ctx.fillStyle = shade(tone, a);
        quad([P(-1, 1, a), P(-1, -1, a), P(-1, -1, z2), P(-1, 1, z2)]);
        quad([P(1, 1, a), P(1, -1, a), P(1, -1, z2), P(1, 1, z2)]);
        ctx.fillStyle = shade(tone - 16, a);
        quad([P(-1, -1, a), P(1, -1, a), P(1, -1, z2), P(-1, -1, z2)]);
        // the station's surface beyond the rim
        ctx.fillStyle = shade(tone - 8, a);
        quad([P(-7, 1, a), P(-1, 1, a), P(-1, 1, z2), P(-7, 1, z2)]);
        quad([P(1, 1, a), P(7, 1, a), P(7, 1, z2), P(1, 1, z2)]);
        // surface detail: a few raised blocks on each wall
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

      // The exhaust port, on the floor at the end of the trench
      const portD = PORT_Z - g.z;
      if (portD < FAR && portD > NEAR) {
        const [px, py] = project(0, -0.98, portD, g);
        const [ex] = project(0.32, -0.98, portD, g);
        const r = Math.max(2, ex - px);
        ctx.fillStyle = '#0b0c10';
        ctx.strokeStyle = '#d9dde3';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(px, py, r, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Obstacles, far to near
      const items = [...g.items].filter((it) => it.z - g.z > NEAR && it.z - g.z < FAR).sort((a, b) => b.z - a.z);
      for (const it of items) {
        const d = it.z - g.z;
        const a = Math.min(1, 1.2 - d / FAR);
        if (it.kind === 'catwalk') {
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

      // Missed torpedoes streak away
      for (const s of g.shots) {
        const d = s.z - g.z;
        if (d < NEAR || d > FAR) continue;
        const [x1, y1] = project(s.x, s.y - 0.1, d, g);
        ctx.fillStyle = '#ffd27a';
        ctx.beginPath();
        ctx.arc(x1, y1, Math.max(1.5, 6 / d), 0, Math.PI * 2);
        ctx.fill();
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
      if (g.phase !== 'won') {
        const s = Math.max(0.55, Math.min(1.2, h / 420));
        drawXwing(ctx, w / 2 + (g.tx - g.px) * 60, h * 0.72, s, (g.tx - g.px) * 0.9 + g.px * 0.12, g.t ?? 0);
      }

      // Rear view: Vader closing in, then sent spinning by Han
      if (g.vader && (g.vader.on || g.vader.away > 0)) {
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
        drawTie(ctx, bx + bw / 2 + Math.sin((g.t ?? 0) * 2) * bw * 0.12, by + bh / 2 + 4, (bw / 70) * shrink, g.vader.spin);
      }

      // Targeting computer
      if (g.computer && g.phase === 'running') {
        ctx.strokeStyle = 'rgba(255,179,71,0.85)';
        ctx.fillStyle = 'rgba(255,179,71,0.9)';
        ctx.lineWidth = 1;
        const cx = w / 2;
        const cy = h * 0.46;
        ctx.strokeRect(cx - 34, cy - 22, 68, 44);
        ctx.beginPath();
        ctx.moveTo(cx - 60, cy);
        ctx.lineTo(cx - 40, cy);
        ctx.moveTo(cx + 40, cy);
        ctx.lineTo(cx + 60, cy);
        ctx.stroke();
        if (portD < 26) {
          ctx.font = `600 12px ${hudFamily()}`;
          ctx.textAlign = 'center';
          ctx.fillText(`RANGE ${Math.max(0, Math.round(portD * 100))}`, cx, cy + 42);
          if (portD > 2.5 && portD < 9) ctx.fillText('LOCK', cx, cy - 30);
        }
      } else if (g.phase === 'running') {
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.46, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (g.flash > 0) {
        ctx.fillStyle = `rgba(255,240,210,${g.flash})`;
        ctx.fillRect(0, 0, w, h);
      }
    }

    const loop = (now) => {
      raf.current = requestAnimationFrame(loop);
      const g = game.current;
      if (!g) {
        draw();
        return;
      }
      const dt = g.last ? Math.min(0.05, (now - g.last) / 1000) : 0.016;
      g.last = now;
      if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 0.8);
      if (g.phase === 'running') {
        // steering: keys nudge the target, the ship eases towards it
        const k = g.keys;
        const kx = (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0);
        const ky = (k.has('ArrowUp') || k.has('w') ? 1 : 0) - (k.has('ArrowDown') || k.has('s') ? 1 : 0);
        g.tx = Math.max(-0.88, Math.min(0.88, g.tx + kx * dt * 1.9));
        g.ty = Math.max(-0.85, Math.min(0.85, g.ty + ky * dt * 1.9));
        g.px += (g.tx - g.px) * Math.min(1, dt * 7);
        g.py += (g.ty - g.py) * Math.min(1, dt * 7);
        const prev = g.z;
        g.z += SPEED * dt;
        for (const it of g.items) {
          if (it.kind === 'bolt') it.z -= it.speed * dt;
          if (it.hit) continue;
          const before = it.z - prev + (it.kind === 'bolt' ? it.speed * dt : 0);
          const now2 = it.z - g.z;
          if (before > 1 && now2 <= 1) {
            let hit = false;
            if (it.kind === 'catwalk') hit = Math.abs(g.py - it.y) < 0.26;
            else if (it.kind === 'wall') hit = it.side < 0 ? g.px < 0.17 : g.px > -0.17;
            else hit = Math.hypot(g.px - it.x, g.py - it.y) < 0.3;
            if (hit) {
              it.hit = true;
              g.shields -= 1;
              g.flash = 0.35;
              play('hit');
              if (g.shields <= 0) {
                g.phase = 'lost';
                setUi((u) => ({ ...u, phase: 'lost', shields: 0, message: 'Shields are gone. Pull up, and try again.' }));
              } else {
                setUi((u) => ({ ...u, shields: g.shields, message: g.shields === 1 ? 'Shields failing. One more hit.' : 'Hit. Shields holding.' }));
              }
            }
          }
        }
        g.shots.forEach((s) => (s.z += SPEED * 3 * dt));
        g.t += dt;
        const left = PORT_Z - g.z;
        const v = g.vader;
        if (!v.on && !v.gone && left < 46) {
          v.on = true;
          play('flyby');
          setUi((u) => ({ ...u, message: 'Vader: “The Force is strong with this one.”' }));
        }
        if (v.on && !v.gone) {
          v.cooldown -= dt;
          if (v.cooldown <= 0) {
            v.cooldown = 0.9 + Math.random() * 0.6;
            g.rear.push({ z: g.z - 2.5, x: g.px + (Math.random() - 0.5) * 0.9, y: g.py + (Math.random() - 0.5) * 0.7, hitChecked: false });
          }
          if (left < 15) {
            play('flyby');
            v.gone = true;
            v.on = false;
            v.away = 1;
            setUi((u) => ({ ...u, message: 'Han: “You’re all clear, kid. Now blow this thing.”' }));
          }
        }
        if (v.gone && v.away > 0) {
          v.away = Math.max(0, v.away - dt * 0.6);
          v.spin += dt * 9;
        }
        for (const b of g.rear) {
          b.z += (SPEED + 16) * dt;
          if (!b.hitChecked && b.z >= g.z) {
            b.hitChecked = true;
            if (Math.hypot(b.x - g.px, b.y - g.py) < 0.18) {
              g.shields -= 1;
              g.flash = 0.35;
              play('hit');
              if (g.shields <= 0) {
                g.phase = 'lost';
                setUi((u) => ({ ...u, phase: 'lost', shields: 0, message: 'Vader got you. Pull up, and try again.' }));
              } else setUi((u) => ({ ...u, shields: g.shields, message: 'Hit from behind. Keep moving.' }));
            }
          }
        }
        g.rear = g.rear.filter((b) => b.z - g.z < FAR);
        if (PORT_Z - g.z < NEAR + 0.5) {
          g.phase = 'lost';
          setUi((u) => ({ ...u, phase: 'lost', message: 'You flew past the port. Pull up, and try again.' }));
        }
      }
      draw();
    };

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(cv);
    resize();
    // Only animate while the game is on screen.
    let visible = true;
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf.current) raf.current = requestAnimationFrame(loop);
      if (!visible) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
        if (game.current) game.current.last = 0;
      }
    }) : null;
    io?.observe(cv);
    raf.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);

  // Keys steer from anywhere on the page while a run is on, so a mouse or
  // trackpad hand is free for the buttons. Touch drags to steer.
  const running = ui.phase === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const STEER = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'];
    const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const onDown = (e) => {
      const g = game.current;
      if (!g || g.phase !== 'running' || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (STEER.includes(key)) {
        e.preventDefault();
        g.keys.add(key);
      } else if (key === ' ' || key === 'Enter') {
        // a focused button already acts on its own key press
        if (e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        if (!e.repeat) fire();
      } else if (key === 't' && !e.repeat) toggleComputer();
    };
    const onUp = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      game.current?.keys.delete(key);
    };
    const onBlur = () => game.current?.keys.clear();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [running, fire, toggleComputer]);

  // Before a run, Space or Enter on the screen starts one.
  const onKeyDown = (e) => {
    if (running || e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      start();
    }
  };

  // Touch: the ship follows the finger's movement, not its position, so the
  // finger never hides it. A mouse click fires.
  const drag = useRef(null);
  const onPointerDown = (e) => {
    const g = game.current;
    if (!g || g.phase !== 'running') return;
    if (e.pointerType === 'mouse') {
      if (e.button === 0) fire();
      return;
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: g.tx, ty: g.ty };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const g = game.current;
    const d = drag.current;
    if (!g || !d || d.id !== e.pointerId || g.phase !== 'running') return;
    const r = canvas.current.getBoundingClientRect();
    g.tx = Math.max(-0.88, Math.min(0.88, d.tx + ((e.clientX - d.x) / r.width) * 2.6));
    g.ty = Math.max(-0.85, Math.min(0.85, d.ty - ((e.clientY - d.y) / r.height) * 2.6));
  };
  const endDrag = (e) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  return (
    <div className="trench">
      <div
        ref={wrap}
        className="trench-screen"
        tabIndex={0}
        role="group"
        aria-label="Trench run. The arrow keys or W A S D steer, Space fires a torpedo, T switches the targeting computer. On a touch screen, drag to steer."
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: running ? 'none' : 'auto' }}
      >
        <canvas ref={canvas} className="trench-canvas" />
        {running && (
          <div className="trench-touch" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="trench-touch-btn" onClick={toggleComputer} aria-pressed={!ui.computer} aria-label={ui.computer ? 'Switch off targeting computer' : 'Targeting computer off'}>
              T
            </button>
            <button type="button" className="trench-touch-btn trench-touch-fire" onClick={fire} disabled={ui.torpedoes <= 0} aria-label="Fire torpedo">
              Fire
            </button>
          </div>
        )}
        {ui.phase !== 'running' && (
          <div className="trench-overlay">
            <p className="stretch-semi text-2xl font-semibold text-white">
              {ui.phase === 'won' ? 'The Death Star is gone.' : ui.phase === 'lost' ? 'Pull up.' : 'Trench run'}
            </p>
            <p className="mt-2 max-w-sm text-sm text-white/80">
              {ui.phase === 'ready'
                ? 'Steer with the arrow keys or W A S D, or drag on a touch screen. Space or a click fires, T switches off the targeting computer. Dodge the catwalks, walls and turbolaser fire, then hit the exhaust port.'
                : ui.message}
            </p>
            <button type="button" className="btn btn-primary mt-5" onClick={start}>
              {ui.phase === 'ready' ? 'Start the run' : 'Fly it again'}
            </button>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary btn-sm" onClick={fire} disabled={!running || ui.torpedoes <= 0}>
          Fire torpedo
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleComputer} disabled={!running} aria-pressed={!ui.computer}>
          {ui.computer ? 'Switch off targeting computer' : 'Targeting computer off'}
        </button>
        <span className="mono text-xs text-muted">
          Shields {'■'.repeat(ui.shields)}
          {'□'.repeat(3 - ui.shields)} · Torpedoes {ui.torpedoes}
          {clock != null && ` · Yavin 4 in range in ${fmtClock(clock)}`}
        </span>
        <span className="mono min-h-[1.2em] w-full text-sm text-accent" role="status">
          {running ? ui.message : ''}
        </span>
      </div>
    </div>
  );
}
