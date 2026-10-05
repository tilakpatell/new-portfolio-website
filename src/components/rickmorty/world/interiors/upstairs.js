// The Smith house upstairs, for ../interiors.js: Summer's room (pink and
// teal, Summer on her purple phone), Morty's room (his bed, his desk and its
// lamp, the window, posters), the hall and the stairwell, Beth and Jerry's
// room, and the balcony with its railing, the street painted beyond it.

import * as THREE from 'three';
import { AREAS, FURNITURE, INNER_WALLS, PEOPLE } from '../rules';
import { rng } from '../kit';
import { BOX, casing, ceilingLights, ceilings, DOOR_H, doorway, fitText, floors, framed, lathe, makeRoom, PLANE, TAU, tiledPaint, wallLine, wallRun, win, windowView } from './shell';
import { needCast, person } from './people';
import { CREAM, HEIGHTS, HOUSE_LIGHT, INNER, LOOKS, TRIM, WOOD_FLOOR, bed, carpet, deskLamp, desk, dresser, roomsOf, woodFloor } from './furniture';

export async function buildUpstairs(kit) {
  const R = makeRoom(kit, 'upstairs');
  const m = kit.mats;
  await needCast(kit, ['summer']);
  const a = AREAS.upstairs;

  const wood = tiledPaint(m, 'c137-in-wood', 256, 2.6, woodFloor());
  const deck = tiledPaint(m, 'c137-in-deck', 256, 2.4, woodFloor('#9a7650'));
  floors(R, 'upstairs', (r) => (r.id === 'balcony' ? deck : r.floor === WOOD_FLOOR ? wood : tiledPaint(m, `c137-in-carpet-${r.floor}`, 128, 1.6, carpet, { color: r.floor })));

  for (let i = 1; i <= 3; i++) R.cell(`view${i}`, 128, 128, windowView(i + 4));
  posters(R);

  ceilings(R, [...roomsOf('upstairs', ['balcony']), [-306, -303.6, 401.7, 404]]);
  ceilingLights(R, roomsOf('upstairs', ['balcony', 'stairTop']));
  const F = R.fixed;
  const cream = { color: CREAM, skirt: TRIM, crown: TRIM };
  const pink = { color: 0xf3c6d6, skirt: TRIM, crown: TRIM };
  const blue = { color: 0xc6d8e6, skirt: TRIM, crown: TRIM };
  // Summer's walls pink, Morty's blue, the rest cream: the walls are split where the rooms are
  wallLine(R, F, [-306.2, 394], [-299.8, 394], { ...pink, into: [0, 1] }, [win(-302, 1.2, 1.05, 0.95, 'view1')]);
  wallLine(R, F, [-299.8, 394], [-294.5, 394], { ...blue, into: [0, 1] }, [win(-297.6, 1.2, 1.05, 0.95, 'view2', { bars: [2, 2] })]);
  wallLine(R, F, [-306, 393.8], [-306, 399.9], { ...pink, into: [1, 0] });
  wallLine(R, F, [-306, 399.9], [-306, 401.7], { ...cream, into: [1, 0] });
  wallLine(R, F, [-294.7, 393.8], [-294.7, 399.9], { ...blue, into: [-1, 0] });
  wallLine(R, F, [-294.7, 399.9], [-294.7, 408.8], { ...cream, into: [-1, 0] }, [win(407.4, 0.9, 1.05, 0.95, 'view3')]);
  // inner walls: Summer's side pink, Morty's blue, the hall cream
  for (const [x0, z0, x1, z1, th] of INNER_WALLS.upstairs) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const ex = ((x1 - x0) / L) * (th - 0.006);
    const ez = ((z1 - z0) / L) * (th - 0.006);
    const colour = z0 === z1 && z0 < 400 ? (x1 <= -299.8 ? 0xf3c6d6 : x0 >= -299.8 ? 0xc6d8e6 : CREAM) : x0 === -299.8 ? 0xdcc6dc : CREAM;
    wallRun(R, F, [x0 - ex, z0 - ez], [x1 + ex, z1 + ez], { centred: true, thick: th * 2, color: colour, skirt: TRIM, crown: TRIM });
  }
  for (const [p, q] of UP_DOORWAYS) doorway(R, p, q, { thick: INNER, color: CREAM, trim: TRIM, crown: TRIM });
  // the balcony's wide glass door: its frame over the gap, a pane slid aside
  const gd = wallRun(R, F, [-300.12, 408.8], [-296.88, 408.8], { centred: true, thick: INNER, color: CREAM, skirt: null, holes: [{ at: 1.62, w: 3.24, y0: 0, y1: DOOR_H }] });
  casing(gd.f, 1.62, 3.24, DOOR_H, gd.v0, gd.v1, 0xe9e4d8);
  const glass = new THREE.Mesh(BOX, m.glass);
  glass.position.set(-300.9, DOOR_H / 2, 408.62);
  glass.scale.set(1.5, DOOR_H - 0.05, 0.03);
  R.add(glass);
  F(-300.9, 408.62, 0).box(0xe9e4d8, 0, 0, 0, 1.56, 0.05, 0.05).box(0xe9e4d8, 0, DOOR_H - 0.05, 0, 1.56, 0.05, 0.05).box(0xe9e4d8, -0.76, 0, 0, 0.05, DOOR_H, 0.05).box(0xe9e4d8, 0.76, 0, 0, 0.05, DOOR_H, 0.05);
  // the stairwell and the yard side: these sink when they're in the way
  wallLine(R, R.cutaway(-302.4, 404, -302.4, 408.8), [-302.4, 403.88], [-302.4, 408.8], { ...cream, into: [1, 0] }, [win(406.6, 1.2, 1.05, 0.95, 'view1')]);
  wallLine(R, R.cutaway(-303.6, 404, -302.4, 404), [-303.72, 404], [-302.28, 404], { ...cream, into: [0, -1] });
  stairwell(R);
  balcony(R, a);

  // furniture
  for (const it of FURNITURE.filter((f) => f.area === 'upstairs')) {
    if (it.id === 'bed-summer') {
      const f = bed(R, it, { frame: 0xf4f0e6, blanket: 0x3fb5b0, sheet: 0xf7d6e2, pillow: 0xf0559a, board: 0xf4f0e6 });
      f.ball(0xf0559a, 0.18, 0.6, 0.45, 0.13, 0.55).ball(0xf7d6e2, -0.15, 0.58, 0.62, 0.1, 0.5);
    } else if (it.id === 'desk-summer') {
      const f = desk(R, it, { top: 0xf4f0e6, legs: 0xe8e3d6 });
      // a mirror, make-up, a laptop
      f.decal('mirror', 0.2, it.h + 0.45, -it.d / 2 + 0.04, 0.42, 0.62);
      f.box(0x3fb5b0, -0.45, it.h, -0.05, 0.36, 0.02, 0.25).box(0x3fb5b0, -0.45, it.h + 0.02, -0.17, 0.36, 0.24, 0.015, 0, -0.25);
      for (let i = 0; i < 4; i++) f.cyl([0xf0559a, 0xe0402a, 0xf2d23c, 0x6b3a7a][i], 0.45 + i * 0.06, it.h, 0.1, 0.018, 0.08 + (i % 2) * 0.04);
    } else if (it.id === 'bed-morty') bed(R, it, { frame: 0x7c5232, blanket: 0x3a5a8a, sheet: 0xd6e2ea });
    else if (it.id === 'desk-morty') {
      const f = desk(R, it, { top: 0x9a6a3e, legs: 0x6b4426 });
      deskLamp(f, -0.5, it.h, -0.2, 0x3a6fb0);
      f.box(0x2b2b30, 0.1, it.h, -0.05, 0.4, 0.025, 0.28).box(0x2b2b30, 0.1, it.h + 0.02, -0.19, 0.4, 0.27, 0.015, 0, -0.2);
      f.decal('monitor', 0.1, it.h + 0.15, -0.178, 0.34, 0.22, { bright: true, rx: -0.2 });
      for (let i = 0; i < 3; i++) f.box([0xd8452f, 0x2f6fb0, 0xf3c844][i], 0.5, it.h + i * 0.04, 0.05, 0.25, 0.035, 0.18, i * 0.15);
    } else if (it.id === 'bed-master') bed(R, it, { frame: 0x6b4426, blanket: 0xc8b07a, sheet: 0xf4f0e6 });
    else if (it.id === 'dresser-master') {
      const f = dresser(R, it, { wood: 0x8a5a34 });
      f.decal('mirrorwide', 0, it.h + 0.6, -it.d / 2 + 0.03, 1.2, 0.8);
      f.cyl(0xd8b25a, -0.6, it.h, 0, 0.06, 0.04).part(lathe([[0.14, 0], [0.08, 0.18]], 12), 0xf0e2c0, -0.6, it.h + 0.3, 0, 0);
      f.cyl(0x9aa3ab, -0.6, it.h + 0.04, 0, 0.012, 0.18);
    }
  }
  // posters and pictures on the walls
  R.fixed(-306, 396.4, Math.PI / 2).decal('summerposter', 0, 1.65, 0.01, 0.6, 0.84);
  R.fixed(-299.92, 396.4, -Math.PI / 2).decal('summerposter2', 0, 1.6, 0.012, 0.55, 0.75);
  R.fixed(-299.68, 397.1, Math.PI / 2).decal('mortyposter', 0, 1.6, 0.012, 0.6, 0.85);
  R.fixed(-294.7, 395.3, -Math.PI / 2).decal('mortyposter2', 0, 1.65, 0.01, 0.5, 0.7);
  R.fixed(-294.7, 405.3, -Math.PI / 2).decal('landscape2', 0, 1.6, 0.01, 1.1, 0.72);
  R.fixed(-300.7, 401.58, Math.PI).decal('photo2', 0, 1.6, 0.012, 0.42, 0.32);

  // Summer on her phone: a purple phone in her right hand
  const s = PEOPLE.find((p) => p.id === 'summer');
  const sum = person(R, 'summer', { ...s, h: HEIGHTS.summer, look: LOOKS.summer });
  phoneIn(R, sum);

  return R.build({ light: { ...HOUSE_LIGHT, background: 0x1e1712 } });
}

const UP_DOORWAYS = [
  [
    [-304.48, 399.9],
    [-302.92, 399.9],
  ],
  [
    [-298.28, 399.9],
    [-296.72, 399.9],
  ],
  [
    [-298.88, 401.7],
    [-297.32, 401.7],
  ],
];

function posters(R) {
  R.cell('summerposter', 96, 136, framed((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#f0559a');
    gr.addColorStop(1, '#6b3a9a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3fb5b0';
    g.beginPath();
    g.arc(w / 2, h * 0.42, w * 0.3, 0, TAU);
    g.fill();
    fitText(g, 'SUMMER', w / 2, h * 0.84, w - 10, 20, { color: '#fff' });
  }, { border: '#f4f0e6', inner: 3 }));
  R.cell('summerposter2', 88, 120, framed((g, w, h) => {
    g.fillStyle = '#3fb5b0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7e27a';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(14 + i * 15, 20 + (i % 2) * 14, 6, 0, TAU);
      g.fill();
    }
    fitText(g, 'LIVE', w / 2, h * 0.62, w - 10, 26, { color: '#f0559a' });
    fitText(g, 'TOUR', w / 2, h * 0.82, w - 10, 20, { color: '#fff' });
  }, { border: '#f4f0e6', inner: 3 }));
  R.cell('mortyposter', 96, 136, framed((g, w, h) => {
    g.fillStyle = '#1a2240';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = '#fff';
      g.fillRect((i * 37) % w, (i * 53) % h, 1.5, 1.5);
    }
    g.fillStyle = '#9dff5a';
    g.beginPath();
    g.ellipse(w / 2, h * 0.45, w * 0.32, h * 0.22, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#1a2240';
    g.beginPath();
    g.ellipse(w / 2, h * 0.45, w * 0.2, h * 0.13, 0, 0, TAU);
    g.fill();
    fitText(g, 'SPACE', w / 2, h * 0.85, w - 10, 22, { color: '#f2d23c' });
  }, { border: '#2b2b30', inner: 3 }));
  R.cell('mortyposter2', 80, 112, framed((g, w, h) => {
    g.fillStyle = '#d8452f';
    g.fillRect(0, 0, w, h);
    fitText(g, 'BALL', w / 2, h * 0.3, w - 10, 20, { color: '#fff2c0' });
    fitText(g, 'FONDLERS', w / 2, h * 0.48, w - 10, 16, { color: '#fff2c0' });
    for (let i = 0; i < 3; i++) {
      g.fillStyle = ['#f2d23c', '#3fa0d8', '#7ac74f'][i];
      g.beginPath();
      g.arc(18 + i * 22, h * 0.75, 9, 0, TAU);
      g.fill();
    }
  }, { border: '#2b2b30', inner: 3 }));
  R.cell('mirror', 64, 96, framed((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#f2e6f0');
    gr.addColorStop(1, '#c9b2c9');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(w * 0.25, 0, 5, h);
  }, { border: '#f0559a', inner: 4 }));
  R.cell('mirrorwide', 120, 80, framed((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#dff2f6');
    gr.addColorStop(1, '#a9c9d2');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(w * 0.2, 0, 7, h);
  }, { border: '#8a5a34', inner: 5 }));
  R.cell('landscape2', 160, 104, framed((g, w, h) => {
    g.fillStyle = '#f2c48a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8762e';
    g.beginPath();
    g.arc(w * 0.5, h * 0.62, h * 0.24, 0, TAU);
    g.fill();
    g.fillStyle = '#3a5a8a';
    g.fillRect(0, h * 0.62, w, h * 0.38);
  }, { border: '#c9a24a' }));
  R.cell('photo2', 72, 56, framed((g, w, h) => {
    g.fillStyle = '#c9dbe6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c9a0';
    g.beginPath();
    g.arc(w * 0.35, h * 0.5, 9, 0, TAU);
    g.arc(w * 0.65, h * 0.5, 9, 0, TAU);
    g.fill();
  }, { border: '#2b2b30', inner: 4 }));
  R.cell('monitor', 64, 48, (g, w, h) => {
    g.fillStyle = '#1a2240';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#9dff5a';
    g.fillRect(6, 8, 30, 4);
    g.fillRect(6, 16, 44, 4);
    g.fillRect(6, 24, 22, 4);
  });
}

// the stairwell beside the hall: steps going down into it, a banister round it
function stairwell(R) {
  const f = R.frame(0, 0, 0, { list: 'fixed' });
  const x0 = -306;
  const x1 = -303.6;
  const z0 = 401.7;
  const z1 = 404;
  // the pit's walls going down, and the flight
  f.box(CREAM, (x0 + x1) / 2, -2.6, z0 + 0.06, x1 - x0, 2.6, 0.12).box(CREAM, (x0 + x1) / 2, -2.6, z1 - 0.06, x1 - x0, 2.6, 0.12).box(CREAM, x0 + 0.06, -2.6, (z0 + z1) / 2, 0.12, 2.6, z1 - z0);
  const n = 9;
  const run = (x1 - x0 - 0.1) / n;
  for (let i = 0; i < n; i++) {
    const y = -(i + 1) * 0.24;
    f.box(0xb08a5a, x1 - (i + 0.5) * run, y - 0.6, (z0 + z1) / 2, run + 0.02, 0.6, z1 - z0 - 0.24);
  }
  // the banister: along the hall and the top of the stairs
  const rail = (a, b) => {
    const [ax, az] = a;
    const [bx, bz] = b;
    const len = Math.hypot(bx - ax, bz - az);
    const turn = Math.atan2(-(bz - az), bx - ax);
    const s = R.frame(ax, az, turn, { list: 'fixed' });
    s.box(0x8a5a34, len / 2, 0.92, 0, len + 0.06, 0.07, 0.08);
    for (let u = 0.06; u < len; u += 0.14) s.box(TRIM, u, 0, 0, 0.03, 0.92, 0.03);
    s.box(0x8a5a34, 0, 0, 0, 0.1, 1.05, 0.1).box(0x8a5a34, len, 0, 0, 0.1, 1.05, 0.1);
  };
  rail([x0, z0 + 0.06], [x1, z0 + 0.06]);
  rail([x1 + 0.04, z0 + 0.06], [x1 + 0.04, z1 - 0.1]);
  // the roof of the single-storey middle outside, south of the stairwell
  const roof = tiledPaint(R.kit.mats, 'c137-in-shingle', 128, 1.8, (g, w, h) => {
    const r = rng(4);
    g.fillStyle = '#6f452b';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++)
      for (let x = -1; x < 6; x++) {
        g.fillStyle = r() < 0.2 ? '#5a3721' : r() < 0.35 ? '#7b4f33' : '#6f452b';
        g.fillRect(x * 24 + (y % 2) * 12 + 1, y * 16 + 1, 22, 14);
        g.fillStyle = '#4b2d1a';
        g.fillRect(x * 24 + (y % 2) * 12, y * 16 + 13, 24, 3);
      }
  });
  R.tiled.add(BOX, roof, new THREE.Matrix4().compose(new THREE.Vector3(-304.5, -0.75, 407.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, 0, 0)), new THREE.Vector3(4.2, 0.08, 7.2)));
}

// The balcony: a wooden railing round it, and the street beyond, painted
function balcony(R, a) {
  const f = R.frame(0, 0, 0, { list: 'solid' });
  const wood = 0x8a5a34;
  const z = a.z1;
  const rail = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    const turn = Math.atan2(-(bz - az), bx - ax);
    const s = R.frame(ax, az, turn);
    s.box(wood, len / 2, 0.96, 0, len + 0.1, 0.07, 0.12).box(wood, len / 2, 0.08, 0, len, 0.05, 0.06);
    for (let u = 0.1; u < len; u += 0.16) s.box(0x9a6a3e, u, 0.1, 0, 0.04, 0.86, 0.04);
    s.box(wood, 0, 0, 0, 0.1, 1.05, 0.1).box(wood, len, 0, 0, 0.1, 1.05, 0.1);
  };
  rail(-302.4, z + 0.04, -294.7, z + 0.04);
  rail(-294.66, 408.8, -294.66, z + 0.04);
  rail(-302.44, 408.8, -302.44, z + 0.04);
  f.box(0x6b4426, (-302.4 - 294.7) / 2, -0.2, z - 0.7, 7.8, 0.2, 1.62);
  // the view: the front lawn, the street and the houses across it
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 320;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 200);
  gr.addColorStop(0, '#79c6ef');
  gr.addColorStop(1, '#d6f1fb');
  g.fillStyle = gr;
  g.fillRect(0, 0, 1024, 320);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (const [x, y, r] of [
    [160, 60, 26],
    [190, 50, 34],
    [225, 62, 24],
    [700, 80, 22],
    [728, 70, 30],
    [760, 82, 20],
  ]) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  // houses across the street, as small as they'd be 40 m off (the painting
  // stands 26 m out, its horizon at eye height)
  const r = rng(7);
  const base = 212;
  for (let i = 0; i < 12; i++) {
    const x = 6 + i * 86 + r() * 10;
    const hw = 70 + r() * 10;
    g.fillStyle = ['#f0c9a8', '#c9dbe6', '#e9c9a1', '#f0dd9a', '#d9bfd8', '#b7d3c6'][i % 6];
    g.fillRect(x, base - 32, hw, 32);
    g.fillStyle = ['#7a4038', '#56606e', '#6e4a36'][i % 3];
    g.beginPath();
    g.moveTo(x - 5, base - 31);
    g.lineTo(x + hw / 2, base - 48);
    g.lineTo(x + hw + 5, base - 31);
    g.fill();
    g.fillStyle = '#8fc4dc';
    g.fillRect(x + 8, base - 24, 13, 10);
    g.fillRect(x + hw - 21, base - 24, 13, 10);
    g.fillStyle = '#7a4a2a';
    g.fillRect(x + hw / 2 - 5, base - 18, 10, 18);
    g.fillStyle = r() < 0.5 ? '#3f8f3a' : '#56a84a';
    g.beginPath();
    g.arc(x + hw + 8, base - 16, 13 + r() * 6, 0, TAU);
    g.fill();
    g.fillStyle = '#6b4a2a';
    g.fillRect(x + hw + 6, base - 6, 4, 6);
  }
  g.fillStyle = '#7cc35a';
  g.fillRect(0, base, 1024, 4);
  g.fillStyle = '#d8d4cb';
  g.fillRect(0, base + 4, 1024, 3);
  g.fillStyle = '#5a5d63';
  g.fillRect(0, base + 7, 1024, 14);
  g.fillStyle = '#f2d23c';
  for (let x = 0; x < 1024; x += 40) g.fillRect(x, base + 13, 18, 2);
  g.fillStyle = '#d8d4cb';
  g.fillRect(0, base + 21, 1024, 4);
  g.fillStyle = '#7cc35a';
  g.fillRect(0, base + 25, 1024, 320 - base - 25);
  // the Smiths' own front walk and a tree, close
  g.fillStyle = '#d8d4cb';
  g.beginPath();
  g.moveTo(500, 320);
  g.lineTo(520, 320);
  g.lineTo(514, base + 25);
  g.lineTo(508, base + 25);
  g.fill();
  const tex = R.own(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = R.own(new THREE.CylinderGeometry(26, 26, 22, 32, 1, true, -Math.PI * 0.5, Math.PI));
  const back = new THREE.Mesh(geo, R.own(new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
  back.position.set(-299, 3, 404);
  R.add(back, { ink: false });
  // the lawn below, out to the painting
  const lawn = new THREE.Mesh(R.own(new THREE.CircleGeometry(26, 32, Math.PI, Math.PI)), R.kit.mats.toon(0x7cc35a));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(-299, -3.2, 404);
  R.add(lawn);
}

// A purple phone in Summer's right hand, the arm bent to hold it up where
// she can see it (or in front of her, if she's in shapes)
function phoneIn(R, fig) {
  const phone = new THREE.Group();
  const body = new THREE.Mesh(BOX, R.kit.mats.toon(0x7a3fc0));
  body.scale.set(0.075, 0.15, 0.012);
  phone.add(body);
  const glow = new THREE.Mesh(PLANE, R.kit.mats.glow(0xbfe8ff, 1.3));
  glow.scale.set(0.064, 0.13, 1);
  glow.position.z = 0.0065;
  phone.add(glow);
  R.noInk.push(glow);
  const c = fig.cast;
  const bones = c ? Object.fromEntries(['RightArm', 'RightForeArm', 'RightHand'].map((n) => [n, c.group.getObjectByName(n)])) : {};
  if (c && bones.RightHand && bones.RightForeArm && bones.RightArm) {
    bones.RightHand.add(phone);
    // her right arm held still, the phone up where she can see it: each
    // bone's rest turn and then PHONE_POSE's, set after the idle's every frame
    // (so the idle's swing of that arm never moves it)
    const e = new THREE.Euler();
    const held = ['RightArm', 'RightForeArm', 'RightHand'].map((n, i) => [bones[n], bones[n].quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(e.set(...PHONE_POSE.bones[i])))]);
    R.tick(() => {
      for (const [b, q] of held) b.quaternion.copy(q);
    });
    // the hand's own scale is the model's: undo it, so the phone is its size in metres
    fig.group.updateMatrixWorld(true);
    const s = new THREE.Vector3();
    bones.RightHand.getWorldScale(s);
    phone.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
    phone.position.set(...PHONE_POSE.at).divide(s);
    phone.rotation.set(...PHONE_POSE.turn);
  } else {
    phone.position.set(0.12, 1.15, 0.28);
    phone.rotation.x = -0.5;
    fig.group.add(phone);
  }
}
// the turns (Euler x, y, z in each bone's own frame, after its rest turn)
// that hold the phone up in front of her: right arm, forearm, hand, found by
// trying them on Summer's model; and where the phone sits in her hand
const PHONE_POSE = { bones: [[0.3, 0.3, 0.9], [0, 0, 2.1], [0, 0, 0]], at: [0, 0.07, 0], turn: [-1.07, -0.52, 2.68] };
