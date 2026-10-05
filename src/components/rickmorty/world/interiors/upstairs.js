// The Smith house upstairs, for ../interiors.js: Summer's room (pink and
// teal, Summer on her purple phone), Morty's room as the show draws it (pale
// walls with blue trim and cracked plaster, green carpet and the round space
// rug, his bed, the blue nightstand with its red lamp and little elephant,
// the bookshelf of books and toys, the red desk with a rocket on it, posters,
// the SCIENCE pennant, the dartboard on the door, his jacket on its hook),
// the hall and the stairwell, Beth and Jerry's room, and the balcony with its
// railing, the street painted beyond it.

import * as THREE from 'three';
import { AREAS, FURNITURE, INNER_WALLS, PEOPLE, RUGS } from '../rules';
import { rng, speckle } from '../kit';
import { BOX, CYL8, casing, ceilingLights, DOOR_H, doorway, fitText, floors, framed, grainOf, innerWalls, lathe, makeRoom, PLANE, roomAt, TAU, tiledPaint, tintedCeilings, wallLine, wallRun, win, windowView } from './shell';
import { needCast, person } from './people';
import { CREAM, HEIGHTS, HOUSE_LIGHT, INNER, LOOKS, TRIM, WOOD_FLOOR, bed, carpet, desk, dresser, woodFloor } from './furniture';
import { BOOKS_MORTY, bookcase, chair, domeLight, jacket, mortyBed, mortyDesk, nightstand, openDoor, P, wallShelf } from './smiths';
import { mortyCells } from './smithpaint';

export async function buildUpstairs(kit) {
  const R = makeRoom(kit, 'upstairs');
  const m = kit.mats;
  await needCast(kit, ['summer']);
  const a = AREAS.upstairs;

  const grain = grainOf(kit);
  const wood = tiledPaint(m, 'c137-in-wood', 256, 2.6, woodFloor());
  const deck = tiledPaint(m, 'c137-in-deck', 256, 2.4, woodFloor('#9a7650'));
  // Morty's carpet is the show's grass green, specked
  const green = tiledPaint(m, 'c137-in-carpet-morty', 128, 1.4, (g, w, h) => speckle(g, w, h, { base: '#ffffff', specks: ['#d2dcc0', '#bccaa4', '#f4f8ec', '#a8b890'], n: 2600, size: 1.6, seed: 23 }), { color: 0x76984f });
  floors(R, 'upstairs', (r) => (r.id === 'balcony' ? deck : r.id === 'morty' ? green : r.floor === WOOD_FLOOR ? wood : tiledPaint(m, `c137-in-carpet-${r.floor}`, 128, 1.6, carpet, { color: r.floor })));

  for (let i = 1; i <= 3; i++) R.cell(`view${i}`, 128, 128, windowView(i + 4));
  posters(R);
  mortyCells(R);

  tintedCeilings(R, [...UP_ROOMS.filter(([id]) => id !== 'balcony').map(([id, ...r]) => [...r, id === 'morty' ? P.ceilMorty : 0xe9e0cc]), [-306, -303.6, 401.7, 404, 0xe9e0cc]], { grain: grainOf(kit, 2.6, { soft: true }) });
  ceilingLights(R, UP_ROOMS.filter(([id]) => !['balcony', 'stairTop', 'morty'].includes(id)).map(([, ...r]) => r));
  domeLight(R.fixed(0, 0, 0), -297.25, 396.95, 2.6);
  const F = R.fixed;
  const cream = { color: CREAM, skirt: TRIM, crown: TRIM };
  const pink = { color: 0xf3c6d6, skirt: TRIM, crown: TRIM };
  const morty = { color: P.mortyWall, skirt: P.mortyTrim, skirtH: 0.1, crown: P.mortyTrim };
  const looks = { summer: pink, morty };
  // Summer's walls pink, Morty's pale with blue trim, the rest cream: the walls are split where the rooms are
  wallLine(R, F, [-306.2, 394], [-299.8, 394], { ...pink, into: [0, 1] }, [win(-302, 1.2, 1.05, 0.95, 'view1')]);
  wallLine(R, F, [-299.8, 394], [-294.5, 394], { ...morty, into: [0, 1] }, [win(-297.6, 1.2, 1.05, 0.95, 'view2', { bars: [2, 2], frame: P.mortyTrim })]);
  wallLine(R, F, [-306, 393.8], [-306, 399.9], { ...pink, into: [1, 0] });
  wallLine(R, F, [-306, 399.9], [-306, 401.7], { ...cream, into: [1, 0] });
  wallLine(R, F, [-294.7, 393.8], [-294.7, 399.9], { ...morty, into: [-1, 0] });
  wallLine(R, F, [-294.7, 399.9], [-294.7, 408.8], { ...cream, into: [-1, 0] }, [win(407.4, 0.9, 1.05, 0.95, 'view3')]);
  // inner walls: each side its own room's
  innerWalls(R, F, 'upstairs', INNER_WALLS.upstairs, (r) => looks[r?.id] ?? cream);
  for (const [p, q] of UP_DOORWAYS) {
    const [mx, mz] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    // (each of these runs along x: its front is the hall's side, south)
    const front = looks[roomAt('upstairs', mx, mz + 0.3)?.id] ?? cream;
    const back = looks[roomAt('upstairs', mx, mz - 0.3)?.id] ?? cream;
    const trimOf = (L) => (L === morty ? P.mortyTrim : TRIM);
    doorway(R, p, q, { thick: INNER, color: front.color, trim: trimOf(front), crown: front.crown, back: { color: back.color, trim: trimOf(back), crown: back.crown } });
  }
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
    } else if (it.id === 'bed-morty') mortyBed(R, it);
    else if (it.id === 'desk-morty') mortyDesk(R, it);
    else if (it.kind === 'nightstand') nightstand(R, it);
    else if (it.id === 'bookcase-morty') onTop(bookcase(R, it, { wood: P.shelfRed, books: BOOKS_MORTY, seed: 12, levels: 4, gaps: 0.05, toys: MORTY_SHELVES }), it.h);
    else if (it.id === 'chair-morty') chair(R, it, 'windsor');
    else if (it.id === 'bed-master') bed(R, it, { frame: 0x6b4426, blanket: 0xc8b07a, sheet: 0xf4f0e6 });
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
  R.fixed(-294.7, 405.3, -Math.PI / 2).decal('landscape2', 0, 1.6, 0.01, 1.1, 0.72);
  R.fixed(-300.7, 401.58, Math.PI).decal('photo2', 0, 1.6, 0.012, 0.42, 0.32);
  mortysRoom(R);

  // Summer on her phone: a purple phone in her right hand
  const s = PEOPLE.find((p) => p.id === 'summer');
  const sum = person(R, 'summer', { ...s, h: HEIGHTS.summer, look: LOOKS.summer });
  phoneIn(R, sum);

  return R.build({ light: { ...HOUSE_LIGHT, background: 0x1e1712 }, grain });
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

// the plan's rooms upstairs, [id, x0, x1, z0, z1]
const UP_ROOMS = [
  ['summer', -306, -299.8, 394, 399.9],
  ['morty', -299.8, -294.7, 394, 399.9],
  ['upHall', -306, -294.7, 399.9, 401.7],
  ['master', -302.4, -294.7, 401.7, 408.8],
  ['balcony', -302.4, -294.7, 408.8, 410.3],
  ['stairTop', -303.6, -302.4, 401.7, 404],
];

// Morty's bookshelf, shelf by shelf (bottom first): a basketball, a robot
// and a ship; folders and a box; books, a robot head, test tubes; books and
// a little alien bust
const MORTY_SHELVES = [
  (f, y) => {
    f.ball(0xe0782e, -0.45, y + 0.12, 0.02, 0.12);
    f.box(0x2f4fa0, -0.18, y, 0.02, 0.1, 0.16, 0.08).box(0xc8362e, -0.18, y + 0.16, 0.02, 0.08, 0.08, 0.07).box(0xd8b04a, -0.18, y + 0.24, 0.02, 0.05, 0.05, 0.05);
    f.box(0x8a5a34, 0.3, y, 0.03, 0.42, 0.08, 0.12).cyl(0x6b4426, 0.3, y + 0.08, 0.03, 0.008, 0.3);
    f.box(0xf4f0e6, 0.2, y + 0.1, 0.03, 0.18, 0.2, 0.006).box(0xd8d4f0, 0.39, y + 0.1, 0.03, 0.14, 0.16, 0.006);
  },
  (f, y) => {
    for (let i = 0; i < 6; i++) f.box([0x5a9ac8, 0xe8e3d6, 0x3f8f3a, 0xe8c45a, 0xd8452f, 0x2b2b30][i], -0.5, y + i * 0.025, 0.02, 0.26, 0.022, 0.24, i * 0.08);
    f.box(0xe08ac8, -0.05, y, 0.03, 0.2, 0.22, 0.04, 0.1).box(0x9ad8f0, -0.05, y + 0.04, 0.052, 0.14, 0.1, 0.004, 0.1);
    f.box(0x2a2a2e, 0.35, y, 0.03, 0.34, 0.13, 0.22).box(0xd8b04a, 0.35, y + 0.06, 0.142, 0.06, 0.03, 0.006);
  },
  (f, y) => {
    let u = -0.62;
    for (let i = 0; i < 10; i++) {
      const bw = 0.035 + ((i * 7) % 4) * 0.008;
      f.box(BOOKS_MORTY[(i * 3) % BOOKS_MORTY.length], u + bw / 2, y, 0.02, bw, 0.2 + ((i * 5) % 3) * 0.03, 0.22);
      u += bw + 0.005;
    }
    f.box(0xf4f0e6, 0.02, y, 0.02, 0.14, 0.14, 0.12).box(0x2a2a2e, 0.02, y + 0.06, 0.081, 0.08, 0.03, 0.004).ball(0x6a8ab0, 0.02, y + 0.17, 0.02, 0.06);
    f.box(0x8a5a34, 0.35, y, 0.02, 0.32, 0.03, 0.08);
    for (let i = 0; i < 4; i++) f.cyl([0x9dff5a, 0xe0402a, 0x5ab0e8, 0xf2d23c][i], 0.23 + i * 0.08, y + 0.02, 0.02, 0.016, 0.14 + (i % 2) * 0.03);
  },
  (f, y) => {
    let u = -0.62;
    for (let i = 0; i < 12; i++) {
      const bw = 0.03 + ((i * 5) % 3) * 0.012;
      f.box(BOOKS_MORTY[(i * 5 + 2) % BOOKS_MORTY.length], u + bw / 2, y, 0.02, bw, 0.18 + ((i * 7) % 4) * 0.02, 0.22, 0, 0, i === 11 ? 0.25 : 0);
      u += bw + 0.005;
    }
    f.box(0xe8c45a, 0.22, y, 0.03, 0.08, 0.08, 0.08, 0.4).box(0xd8452f, 0.24, y + 0.08, 0.03, 0.06, 0.06, 0.06, 0.2);
    f.ball(0x8ad870, 0.42, y + 0.14, 0.03, 0.07, 1.2).box(0x5a5a62, 0.42, y, 0.03, 0.1, 0.06, 0.1);
  },
];

// on top of Morty's bookshelf: helmets, a robot's head, a toy truck
function onTop(f, y) {
  f.ball(0x6a8ab0, -0.55, y + 0.08, 0, 0.09, 0.9).box(0x2a2a30, -0.55, y + 0.06, 0.07, 0.12, 0.05, 0.02);
  f.ball(0x5a6a50, -0.33, y + 0.07, 0, 0.08, 0.85);
  f.box(0x4a5a8a, -0.1, y, 0, 0.14, 0.12, 0.12).box(0x9dd8ff, -0.1, y + 0.05, 0.061, 0.1, 0.03, 0.004);
  f.box(0xc8d040, 0.3, y + 0.04, 0, 0.34, 0.1, 0.13).box(0x6aa040, 0.4, y + 0.14, 0, 0.13, 0.09, 0.12).box(0x9aa3ab, 0.2, y + 0.14, 0, 0.16, 0.05, 0.11, 0, 0, 0.3);
  for (const u of [0.18, 0.42]) for (const v of [-0.06, 0.06]) f.cyl(0x2a2a2e, u, y + 0.04, v, 0.04, 0.03, Math.PI / 2, 0, CYL8);
}

// what's on Morty's walls and floor: the space rug, posters, the pennant, the
// open door with its dartboard, his jacket, the shelf over his bed, cracks
function mortysRoom(R) {
  const E = Math.PI / 2;
  const W = -Math.PI / 2;
  const N = Math.PI;
  const rug = RUGS.find((r) => r.id === 'morty');
  R.fixed(0, 0, 0).decal('spacerug', rug.x, 0.008, rug.z, rug.w, rug.d, { rx: -Math.PI / 2 });
  // the east wall: the beach, the magnet, a small one, the shelf over the bed's head, a vent
  const east = (z) => R.fixed(-294.7, z, W);
  east(395.2).decal('beach', 0, 1.56, 0.012, 0.72, 0.9, { rz: 0.05 });
  east(396.42).decal('magnet', 0, 1.74, 0.012, 0.6, 0.76, { rz: -0.05 });
  east(397.25).decal('smallposter', 0, 1.46, 0.012, 0.36, 0.48);
  wallShelf(east(398.2), 0, 1.52, 0);
  east(399.2).decal('vent', 0, 2.36, 0.012, 0.42, 0.21);
  // the north wall: a map
  R.fixed(-299.15, 394, 0).decal('map', 0, 1.55, 0.012, 0.52, 0.4);
  // the west wall: his space poster
  R.fixed(-299.68, 397.1, E).decal('mortyposter', 0, 1.6, 0.012, 0.6, 0.85);
  // the south wall: the door open against it, its dartboard; the pennant; his jacket on a hook
  const door = R.fixed(-295.72, 399.7, N);
  openDoor(door, 0.88);
  door.cyl(0x1d1d22, 0.44, 1.55, 0.03, 0.2, 0.02, E).decal('dartboard', 0.44, 1.55, 0.041, 0.38, 0.38);
  R.fixed(-295.18, 399.78, N).decal('pennant', 0, 2.16, 0.02, 0.8, 0.29, { rz: 0.16 }).cyl(0x8a5a34, -0.4, 1.95, 0.025, 0.01, 0.38, 0, 0.16);
  jacket(R.fixed(-299.15, 399.78, N), 0, 1.72, 0);
  // the plaster cracked and chipped, up by the ceiling
  for (const [x, z, t, u, w] of [
    [-294.7, 395.9, W, 0, 0.42],
    [-298.3, 394, 0, 0, 0.36],
    [-295.4, 399.78, N, 0, 0.3],
    [-299.68, 395.6, E, 0, 0.4],
  ])
    R.fixed(x, z, t).decal(w > 0.38 ? 'crack1' : 'crack2', u, 2.37, 0.014, w, w * 0.6);
  R.fixed(0, 0, 0).decal('crack2', -296.4, 2.595, 395.6, 0.5, 0.3, { rx: Math.PI / 2 });
}

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
// The turns (Euler x, y, z in each bone's own frame, after its rest turn)
// that hold the phone up in front of her: right arm, forearm, hand; where the
// phone sits in her hand, and its turn there. Found on summer.glb by search:
// in the lab harness, with the scene showing her, each candidate's turns were
// set on the bones and the hand's place read back in her own frame
// (getWorldPosition, then her group's worldToLocal); the score was the hand's
// distance from just in front of her chest (-0.1, 1.2, 0.3 m) plus the
// elbow's from beside her ribs (-0.22, 0.98, 0.06), over a grid of turns
// (arm -1.8..1.8 in 0.3 steps on each axis, the forearm ±1.5..2.4 on one).
// `turn` aims the phone's face at her 'headfront' node. A re-exported
// summer.glb with another rest pose needs the search run again.

const PHONE_POSE = { bones: [[0.3, 0.3, 0.9], [0, 0, 2.1], [0, 0, 0]], at: [0, 0.07, 0], turn: [-1.07, -0.52, 2.68] };
