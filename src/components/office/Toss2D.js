// Paper toss on a 2D canvas, for devices without a graphics chip: the same
// room from the same chair, drawn in perspective with the canvas's own
// shapes. A whole game, not a placeholder: it draws exactly what the rules
// (./toss.js) say, as the 3D view does.

import { TOSS, predict } from './toss';

const H = 2.7;
const BACK = -1.6;
const CAM = { x: 0, y: 1.28, z: -0.62 };
const LOOK = { x: 0, y: 0.55, z: 4.6 };
let FOV = 58;

// the camera's axes, for projecting world points onto the canvas
function basis() {
  const f = { x: LOOK.x - CAM.x, y: LOOK.y - CAM.y, z: LOOK.z - CAM.z };
  const fl = Math.hypot(f.x, f.y, f.z);
  f.x /= fl;
  f.y /= fl;
  f.z /= fl;
  // The rules' frame has x to the thrower's right: screen right is +x,
  // and up is forward × right.
  let r = { x: f.z, y: 0, z: -f.x };
  const rl = Math.hypot(r.x, r.z);
  r = { x: r.x / rl, y: 0, z: r.z / rl };
  const u = { x: f.y * r.z - f.z * r.y, y: f.z * r.x - f.x * r.z, z: f.x * r.y - f.y * r.x };
  return { f, r, u };
}
const B = basis();

export function createToss2D(canvas) {
  const ctx = canvas.getContext('2d');
  const size = { w: 1, h: 1, dpr: 1 };
  const resize = (w, h) => {
    size.dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.w = Math.max(1, Math.round(w));
    size.h = Math.max(1, Math.round(h));
    canvas.width = Math.round(size.w * size.dpr);
    canvas.height = Math.round(size.h * size.dpr);
    // as in 3D: a tall screen opens the field of view to keep the room's width
    const aspect = Math.max(0.3, size.w / size.h);
    FOV = Math.max(58, (2 * Math.atan(Math.tan((36 * Math.PI) / 180) / aspect) * 180) / Math.PI);
  };
  // world → canvas: x, y in CSS pixels, d the depth (for sizes and order)
  const P = (x, y, z) => {
    const dx = x - CAM.x;
    const dy = y - CAM.y;
    const dz = z - CAM.z;
    const d = dx * B.f.x + dy * B.f.y + dz * B.f.z;
    const sx = dx * B.r.x + dy * B.r.y + dz * B.r.z;
    const sy = dx * B.u.x + dy * B.u.y + dz * B.u.z;
    const k = size.h / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
    const dd = Math.max(0.05, d);
    return { x: size.w / 2 + (sx / dd) * k, y: size.h / 2 - (sy / dd) * k, d: dd, k };
  };
  const poly = (pts, fill, stroke) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  };
  const quad = (a, b, c, d, fill, stroke) => poly([P(...a), P(...b), P(...c), P(...d)], fill, stroke);

  // a box from the floor up: its top and the faces you can see
  const box = (x0, x1, z0, z1, h, top, side, front) => {
    quad([x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], top);
    quad([x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0], front);
    if (x0 > CAM.x) quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], side);
    if (x1 < CAM.x) quad([x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0], side);
  };

  const room = () => {
    const X = TOSS.room.x;
    const Z = TOSS.room.z;
    // walls, ceiling, floor
    quad([-X, 0, BACK], [-X, 0, Z], [-X, H, Z], [-X, H, BACK], '#e9e2d1');
    quad([X, 0, BACK], [X, 0, Z], [X, H, Z], [X, H, BACK], '#efe8d8');
    quad([-X, H, BACK], [X, H, BACK], [X, H, Z], [-X, H, Z], '#f2f0ea');
    quad([-X, 0, BACK], [X, 0, BACK], [X, 0, Z], [-X, 0, Z], '#5d6677');
    // the carpet's loop pattern, a hint of it
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1;
    for (let z = 0; z < Z; z += 0.6) {
      const a = P(-X, 0, z);
      const b = P(X, 0, z);
      ctx.strokeStyle = '#2f3644';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // ceiling grid and the troffers
    ctx.strokeStyle = 'rgba(150,150,145,0.35)';
    for (let z = 0; z < Z; z += 0.6) {
      const a = P(-X, H, z);
      const b = P(X, H, z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let z = 0.6; z < Z; z += 2.4) for (const x of [-1.5, 1.5]) quad([x - 0.6, H - 0.01, z - 0.3], [x + 0.6, H - 0.01, z - 0.3], [x + 0.6, H - 0.01, z + 0.3], [x - 0.6, H - 0.01, z + 0.3], '#fbfcff', '#b9bec6');
    // the far wall: Michael's office through the glass, blinds half open
    quad([-X, 0, Z], [X, 0, Z], [X, H, Z], [-X, H, Z], '#d6dde3');
    ctx.strokeStyle = 'rgba(235,233,226,0.85)';
    ctx.lineWidth = Math.max(1, P(0, 0, Z).k * 0.02 / P(0, 0, Z).d);
    for (let y = 0.3; y < H - 0.2; y += 0.12) {
      const a = P(-X, y, Z);
      const b = P(X, y, Z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (const x of [-X, -1.4, -0.4, 1.6, 1.7, X]) quad([x - 0.025, 0, Z], [x + 0.025, 0, Z], [x + 0.025, H, Z], [x - 0.025, H, Z], '#9aa0a6');
    // windows down the left wall
    for (const z of [1.2, 4.2, 7.2]) quad([-X, 0.85, z - 1.1], [-X, 0.85, z + 1.1], [-X, 2.25, z + 1.1], [-X, 2.25, z - 1.1], '#cfe0ee');
    // desks along the walls
    for (const [x0, x1, z] of [
      [-X, -X + 0.78, 2.4],
      [-X, -X + 0.78, 5.6],
      [X - 0.78, X, 2.0],
      [X - 0.78, X, 5.2],
    ])
      box(x0, x1, z - 0.75, z + 0.75, 0.76, '#e8b878', '#b7884f', '#c99a5e');
  };

  const bin = (b, flash) => {
    const { rim, base, height } = TOSS.bin;
    const top = P(b.x, height, b.z);
    const bot = P(b.x, 0, b.z);
    const rt = (rim / top.d) * top.k;
    const rb = (base / bot.d) * bot.k;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(bot.x + 2, bot.y, rb * 1.5, rb * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // the body, then the opening
    const tilt = Math.max(0.18, Math.min(0.5, (CAM.y - height) / Math.max(1, top.d)));
    ctx.fillStyle = '#1d1f23';
    ctx.beginPath();
    ctx.moveTo(top.x - rt, top.y);
    ctx.lineTo(bot.x - rb, bot.y);
    ctx.ellipse(bot.x, bot.y, rb, rb * tilt, 0, Math.PI, 0, true);
    ctx.lineTo(top.x + rt, top.y);
    ctx.closePath();
    ctx.fill();
    // flutes
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(top.x + (rt * i) / 4, top.y + rt * tilt * 0.9);
      ctx.lineTo(bot.x + (rb * i) / 4, bot.y + rb * tilt * 0.9);
      ctx.stroke();
    }
    ctx.fillStyle = '#0c0d0f';
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, rt, rt * tilt, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = flash > 0 ? `rgba(255,236,170,${0.4 + flash * 0.6})` : '#3a3d43';
    ctx.lineWidth = flash > 0 ? 3 : 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;
  };

  const paper = (x, y, z, rot = 0, shadow = true) => {
    const p = P(x, y, z);
    const r = (TOSS.r / p.d) * p.k;
    if (shadow && y > TOSS.r * 1.2) {
      const g = P(x, 0, z);
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.06, 0.3 - y * 0.1)})`;
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, r * 1.2, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const grad = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#c9cbd0');
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = rot + (i / 9) * Math.PI * 2;
      const rr = r * (0.82 + 0.18 * Math.sin(i * 2.7 + rot));
      if (i) ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
      else ctx.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,90,110,0.35)';
    ctx.stroke();
  };

  const fan = (wind, t) => {
    const speed = Math.hypot(wind.x, wind.z);
    const side = speed < 0.01 ? -1 : wind.x >= 0 ? -1 : 1;
    const x = side * (TOSS.room.x - 0.3);
    box(x - 0.23, x + 0.23, 3.7, 4.3, 1.02, '#c9c6bd', '#a19e96', '#b5b2aa');
    const c = P(x, 1.34, 4.0);
    const r = (0.17 / c.d) * c.k;
    ctx.strokeStyle = '#8a8f96';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(127,178,216,0.8)';
    for (let i = 0; i < 3; i++) {
      const a = (speed > 0.01 ? t * 20 : 0) + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.ellipse(c.x + Math.cos(a) * r * 0.45, c.y + Math.sin(a) * r * 0.45, r * 0.45, r * 0.18, a, 0, Math.PI * 2);
      ctx.fill();
    }
    if (speed > 0.01) {
      ctx.strokeStyle = '#e8453c';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        const sy = c.y + i * r * 0.5;
        ctx.beginPath();
        ctx.moveTo(c.x, sy);
        const len = r * (1.6 + speed * 0.5);
        ctx.quadraticCurveTo(c.x - side * len * 0.5, sy + Math.sin(t * 14 + i) * 4, c.x - side * len, sy + Math.sin(t * 12 + i * 2) * 6);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
  };

  let time = 0;
  const misses = [];
  let flash = 0;
  const render = (s, { dt = 1 / 60, aim = null, guide = false } = {}) => {
    time += dt;
    flash = Math.max(0, flash - dt * 1.8);
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    room();
    // back to front: what is furthest first
    const things = [];
    if (s.desk) things.push({ z: s.desk.z1, draw: () => box(s.desk.x0, s.desk.x1, s.desk.z0, s.desk.z1, s.desk.top, '#e8b878', '#b7884f', '#c99a5e') });
    things.push({ z: s.bin.z + 0.01, draw: () => bin(s.bin, flash) });
    things.push({ z: 4.3, draw: () => fan(s.wind, time) });
    for (const m of misses) things.push({ z: m.z, draw: () => paper(m.x, TOSS.r, m.z, m.r, false) });
    const b = s.ball;
    if (s.phase === 'flying' && b) {
      // inside the bin it is drawn before the bin's front
      things.push({ z: b.inside ? s.bin.z + 0.02 : b.z, draw: () => paper(b.x, b.y, b.z, time * b.spin) });
    }
    things.sort((a, c) => c.z - a.z).forEach((t) => t.draw());
    // the aim guide
    if (guide && aim && s.phase === 'aim') {
      ctx.fillStyle = 'rgba(255,179,71,0.95)';
      for (const p of predict(s, aim, 2.2, 0.05)) {
        const q = P(p.x, p.y, p.z);
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(1.5, (0.012 / q.d) * q.k), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Jim's desk along the bottom, and the ball in his hand
    quad([-0.85, 0.76, -0.5], [0.85, 0.76, -0.5], [0.85, 0.76, 0.27], [-0.85, 0.76, 0.27], '#efc188');
    quad([-0.85, 0.72, 0.27], [0.85, 0.72, 0.27], [0.85, 0.76, 0.27], [-0.85, 0.76, 0.27], '#c99a5e');
    if (s.phase === 'aim') paper(TOSS.release.x, TOSS.release.y, TOSS.release.z, 0.4, false);
    const inPile = TOSS.balls - s.throws - (s.phase === 'aim' ? 1 : 0);
    for (let i = 0; i < inPile; i++) paper(0.32 + ((i % 4) - 1.5) * 0.06, 0.79 + Math.floor(i / 4) * 0.05, -0.18 + (i % 2) * 0.05, i, false);
    // misses stay where they stopped
    if (s.last && !s.last.made && misses.length < s.throws - s.made) misses.push({ x: s.last.at.x, z: s.last.at.z, r: time });
    if (s.throws === 0) misses.length = 0;
  };

  return {
    render,
    resize,
    celebrate(swish) {
      flash = swish ? 1 : 0.5;
    },
    clear() {
      misses.length = 0;
    },
    project: (x, y, z) => {
      const p = P(x, y, z);
      return { x: p.x, y: p.y, front: true };
    },
    dispose() {},
  };
}
