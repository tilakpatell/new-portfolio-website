// The Smith house's ground floor, for ../interiors.js: the kitchen with Beth
// at the stove, the living room with Jerry on the couch in front of the TV
// playing interdimensional cable (./tv.js), the dining room's yellow table
// with the butter robot on it, the entry with its red rug and the front
// door, the hall, the den, the back room and the stairs. Drawn from
// rules.js's PLAN, INNER_WALLS, FURNITURE, RUGS and PEOPLE: cream walls with
// white skirting, wood floors, every piece of furniture on its collider
// (./furniture.js). Upstairs is ./upstairs.js.

import * as THREE from 'three';
import { faceForward, heading } from '../../portal/meshyCast';
import { AREAS, FURNITURE, INNER_WALLS, PEOPLE, RUGS } from '../rules';
import { ceilingLights, ceilings, doorAt, doorway, floors, framed, makeRoom, scribble, TAU, tiledPaint, wallLine, wallRun, win, windowView } from './shell';
import { needCast, person, sitting } from './people';
import { BROWN, CREAM, HEIGHTS, HOUSE_LIGHT, INNER, LOOKS, TRIM, WOOD_FLOOR, butterRobot, carpet, computer, couch, counter, desk, deskLamp, dresser, fridge, lino, roomsOf, shelf, stove, table, tvStand, bed, woodFloor } from './furniture';
import { cableTV } from './tv';

// ── the stairs ──

// steps rising north from the foot of the stairs (by the 'stairs-up' link),
// with a banister up their open side (the rules' low wall)
function stairs(R, it) {
  const f = R.frame(0, 0, 0, { list: 'fixed' });
  // on the rules' stair-run: its front (+z) is the foot, its height the top step's
  const x0 = it.x - it.w / 2;
  const x1 = it.x + it.w / 2;
  const foot = it.z + it.d / 2;
  const top = it.z - it.d / 2;
  const n = 7;
  const run = (foot - top) / n;
  const rise = it.h / n;
  const cx = (x0 + x1) / 2;
  for (let i = 0; i < n; i++) {
    const z1 = foot - i * run;
    const y = (i + 1) * rise;
    f.box(0xefdfb9, cx, 0, z1 - run / 2 - 0.01, x1 - x0, y - 0.03, run);
    f.box(0xb08a5a, cx, y - 0.03, z1 - run / 2 - 0.02, x1 - x0, 0.035, run + 0.03);
    f.box(TRIM, cx, y - rise, z1 - 0.005, x1 - x0 - 0.02, rise - 0.03, 0.01);
  }
  // the banister: newel posts, a rail up the slope, balusters
  const rail = 0.95;
  const post = (z, y) => f.box(0x8a5a34, x0 + 0.05, 0, z, 0.09, y + rail + 0.08, 0.09).box(0x8a5a34, x0 + 0.05, y + rail + 0.08, z, 0.12, 0.06, 0.12);
  post(foot - 0.06, 0);
  post(top + 0.05, n * rise - rise);
  const len = Math.hypot(foot - top, (n - 1) * rise);
  const slope = Math.atan2((n - 1) * rise, foot - top);
  f.cbox(0x8a5a34, x0 + 0.05, rail + ((n - 1) * rise) / 2 + 0.12, (foot + top) / 2, 0.07, 0.06, len, 0, slope);
  for (let i = 0; i < n * 2; i++) {
    const z = foot - (i + 0.5) * (run / 2);
    const step = Math.floor(i / 2) + 1;
    const y = step * rise;
    const yr = rail + ((foot - z) / (foot - top)) * (n - 1) * rise + 0.1;
    f.box(TRIM, x0 + 0.05, y, z, 0.03, Math.max(0.1, yr - y), 0.03);
  }
}

// ── the ground floor ──

export async function buildHouse(kit) {
  const R = makeRoom(kit, 'house');
  const m = kit.mats;
  const [, clip] = await Promise.all([needCast(kit, ['beth', 'jerry']), sitting()]);

  // floors: wood, the kitchen's lino, the back room's carpet
  const wood = tiledPaint(m, 'c137-in-wood', 256, 2.6, woodFloor());
  const linoM = tiledPaint(m, 'c137-in-lino', 128, 1.2, lino);
  floors(R, 'house', (r) => (r.id === 'kitchen' ? linoM : r.floor === WOOD_FLOOR ? wood : tiledPaint(m, `c137-in-carpet-${r.floor}`, 128, 1.6, carpet, { color: r.floor })), { den: 0.001 });

  // pictures: window views, the rug, posters and frames
  for (let i = 1; i <= 4; i++) R.cell(`view${i}`, 128, 128, windowView(i));
  R.cell('tiles', 256, 32, (g, w, h) => {
    for (let x = 0; x < w; x += 16)
      for (let y = 0; y < h; y += 16) {
        g.fillStyle = (x / 16 + y / 16) % 5 === 0 ? '#8fc0d8' : '#f4f2ea';
        g.fillRect(x, y, 16, 16);
        g.strokeStyle = '#c9c4b4';
        g.strokeRect(x + 0.5, y + 0.5, 15, 15);
      }
  });
  R.cell('fridgeart', 96, 80, (g) => {
    g.clearRect(0, 0, 96, 80);
    g.fillStyle = '#f1ecd9';
    g.fillRect(0, 0, 96, 80);
    g.fillStyle = '#fff';
    g.fillRect(6, 6, 38, 30);
    g.strokeStyle = '#3a6fb0';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(25, 22, 8, 0, TAU);
    g.stroke();
    g.fillStyle = '#e0402a';
    g.fillRect(14, 30, 22, 3);
    g.fillStyle = '#f7e27a';
    g.fillRect(52, 10, 34, 26);
    scribble(g, 55, 16, 28, 3, { gap: 6 });
    g.fillStyle = '#8fd0e8';
    g.fillRect(20, 46, 44, 28);
    g.fillStyle = '#e8762e';
    g.beginPath();
    g.arc(34, 58, 6, 0, TAU);
    g.fill();
    for (const [x, y, c] of [
      [24, 6, '#e0402a'],
      [68, 10, '#3f8f3a'],
      [42, 46, '#3a6fb0'],
    ]) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, 3.5, 0, TAU);
      g.fill();
    }
  });
  const rug = RUGS.find((r) => r.id === 'entry');
  R.cell('rug', 128, 168, (g, w, h) => {
    g.fillStyle = '#a23a2e';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8c88a';
    g.lineWidth = 4;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 2;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#7a2420';
    g.beginPath();
    g.moveTo(w / 2, 32);
    g.lineTo(w - 30, h / 2);
    g.lineTo(w / 2, h - 32);
    g.lineTo(30, h / 2);
    g.fill();
    g.strokeStyle = '#e8c88a';
    g.stroke();
    g.fillStyle = '#e8c88a';
    for (let x = 4; x < w; x += 6) {
      g.fillRect(x, 0, 2, 3);
      g.fillRect(x, h - 3, 2, 3);
    }
  });
  R.cell('livingrug', 160, 112, (g, w, h) => {
    g.fillStyle = '#d9c9a0';
    g.beginPath();
    g.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, TAU);
    g.fill();
    g.strokeStyle = '#8a6a4a';
    g.lineWidth = 3;
    for (const k of [0.82, 0.62]) {
      g.beginPath();
      g.ellipse(w / 2, h / 2, (w / 2) * k, (h / 2) * k, 0, 0, TAU);
      g.stroke();
    }
  });
  R.cell('landscape', 160, 112, framed((g, w, h) => {
    g.fillStyle = '#9edcf5';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#6a8fb0';
    g.beginPath();
    g.moveTo(0, h * 0.7);
    g.lineTo(w * 0.3, h * 0.3);
    g.lineTo(w * 0.55, h * 0.62);
    g.lineTo(w * 0.75, h * 0.38);
    g.lineTo(w, h * 0.7);
    g.fill();
    g.fillStyle = '#5aa84a';
    g.fillRect(0, h * 0.7, w, h * 0.3);
  }, { border: '#c9a24a' }));
  R.cell('family', 112, 88, framed((g, w, h) => {
    g.fillStyle = '#e8dcc0';
    g.fillRect(0, 0, w, h);
    const heads = [
      ['#e8762e', '#f0559a'],
      ['#f0d27a', '#c8362e'],
      ['#6b4126', '#7d8a3c'],
      ['#6b3a1e', '#f2d23c'],
    ];
    heads.forEach(([hair, shirt], i) => {
      const x = 16 + i * (w - 32) / 3;
      g.fillStyle = shirt;
      g.fillRect(x - 9, h * 0.55, 18, h * 0.45);
      g.fillStyle = '#f2c9a0';
      g.beginPath();
      g.arc(x, h * 0.42, 9, 0, TAU);
      g.fill();
      g.fillStyle = hair;
      g.fillRect(x - 9, h * 0.42 - 11, 18, 6);
    });
  }));
  R.cell('mirror', 64, 112, framed((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#dff2f6');
    gr.addColorStop(1, '#a9c9d2');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(w * 0.2, 0, 6, h);
  }, { border: '#c9a24a' }));
  R.cell('monitor', 64, 48, (g, w, h) => {
    g.fillStyle = '#2f6fb0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e3d6';
    g.fillRect(4, 4, 26, 18);
    g.fillRect(34, 4, 26, 30);
    g.fillStyle = '#7ac74f';
    g.fillRect(0, h - 6, w, 6);
  });
  R.cell('photo', 72, 56, framed((g, w, h) => {
    g.fillStyle = '#8fd0e8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7e27a';
    g.beginPath();
    g.arc(w * 0.7, h * 0.3, 7, 0, TAU);
    g.fill();
    g.fillStyle = '#d8b48a';
    g.fillRect(0, h * 0.65, w, h * 0.35);
  }, { border: '#2b2b30', inner: 4 }));

  // ── walls and ceilings ──
  // (and over the yard in the corner outside, for when the camera's out there behind a sunk wall)
  ceilings(R, [...roomsOf('house'), [AREAS.house.x0, -294.5, 3.4, AREAS.house.z1]]);
  ceilingLights(R, roomsOf('house', ['stairs']));
  const F = R.fixed;
  const wall = { color: CREAM, skirt: TRIM, crown: TRIM };
  const view = (i) => `view${i}`;
  // the outer walls on the area's edges (never between the camera and Morty)
  wallLine(R, F, [-312.2, -8], [-287.8, -8], { ...wall, into: [0, 1] }, [win(-309.45, 1.2, 1.05, 0.95, view(1)), win(-301.8, 2.6, 0.85, 1.25, view(2), { bars: [3, 2] }), win(-292.5, 1.5, 1.05, 1.0, view(3), { bars: [2, 1] })]);
  wallLine(R, F, [-288, -8.2], [-288, 8.7], { ...wall, into: [-1, 0] }, [win(-7.2, 0.9, 1.0, 1.0, view(4)), win(-0.55, 0.8, 1.0, 1.0, view(1)), win(5.6, 1.4, 0.95, 1.05, view(2), { bars: [2, 2] })]);
  wallLine(R, F, [-294.7, 8.5], [-287.8, 8.5], { ...wall, into: [0, -1] }, [win(-291.2, 1.2, 1.25, 0.8, view(3))]);
  wallLine(R, F, [-312, -8.2], [-312, 3.6], { ...wall, into: [1, 0] }, [doorAt(1.1, { color: 0x8a5a34, trim: TRIM })]);
  // the outer walls with the yard outside them, south-west: they sink when
  // they come between the camera and Morty
  wallLine(R, R.cutaway(-312.2, 3.4, -306.7, 3.4), [-312.2, 3.4], [-306.7, 3.4], { ...wall, into: [0, -1] }, [win(-309.45, 1.2, 1.05, 0.95, view(4))]);
  wallLine(R, R.cutaway(-306.7, 3.4, -299.5, 3.4), [-306.7, 3.4], [-299.5, 3.4], { ...wall, into: [0, -1] }, [win(-303.1, 2.9, 0.8, 1.25, view(2), { frame: 0x6b4426, bars: [4, 1] })]);
  wallLine(R, R.cutaway(-299.5, 3.4, -294.5, 3.4), [-299.5, 3.4], [-294.5, 3.4], { ...wall, into: [0, -1] }, [doorAt(-297.6, { w: 1.0, color: BROWN, trim: TRIM, glass: null })]);
  wallLine(R, R.cutaway(-294.5, 3.4, -294.5, 8.7), [-294.5, 3.4], [-294.5, 8.7], { ...wall, into: [1, 0] }, [win(6.0, 1.2, 1.0, 1.0, view(1))]);
  // between the rooms, and the doorways in them
  for (const [x0, z0, x1, z1, th] of INNER_WALLS.house) {
    // (run on into the wall each meets, its end just inside it)
    const L = Math.hypot(x1 - x0, z1 - z0);
    const ex = ((x1 - x0) / L) * (th - 0.006);
    const ez = ((z1 - z0) / L) * (th - 0.006);
    wallRun(R, F, [x0 - ex, z0 - ez], [x1 + ex, z1 + ez], { centred: true, thick: th * 2, ...wall });
  }
  for (const [a, b] of HOUSE_DOORWAYS) doorway(R, a, b, { thick: INNER, color: CREAM, trim: TRIM, crown: TRIM });

  // ── what's on the floor and the walls ──
  const fl = R.frame(0, 0, 0, { list: 'fixed' });
  fl.decal('rug', rug.x, 0.006, rug.z, rug.w, rug.d, { rx: -Math.PI / 2 });
  fl.decal('livingrug', -300.2, 0.006, -3.5, 2.6, 3.0, { rx: -Math.PI / 2, ry: Math.PI / 2 });
  // pictures: over the couch, in the hall, the dining room, the den; a mirror in the entry
  R.fixed(-306.58, -3.6, Math.PI / 2).decal('landscape', 0, 1.6, 0.012, 1.1, 0.78);
  R.fixed(-294.9, -1.46, 0).decal('family', 0, 1.6, 0, 0.6, 0.46).decal('photo', 0.95, 1.55, 0, 0.42, 0.32);
  R.fixed(-303.1, -1.76, 0).decal('landscape', 0, 1.6, 0, 0.9, 0.62);
  R.fixed(-299.36, -1.0, Math.PI / 2).decal('mirror', 0, 1.5, 0, 0.42, 0.75);
  R.fixed(-296.76, -4.1, Math.PI / 2).decal('photo', 0, 1.7, 0, 0.36, 0.28);
  R.fixed(-288, 1.6, -Math.PI / 2).decal('family', 0, 1.6, 0.012, 0.5, 0.4);

  // ── furniture ──
  for (const it of FURNITURE.filter((f) => f.area === 'house')) {
    if (it.kind === 'counter') counter(R, it);
    else if (it.kind === 'stove') stove(R, it);
    else if (it.kind === 'fridge') fridge(R, it);
    else if (it.kind === 'tv') cableTV(R, tvStand(R, it), 0, 1.12, -0.084 + 0.001, 1.5, 0.82);
    else if (it.kind === 'couch') couch(R, it);
    else if (it.kind === 'table') table(R, it);
    else if (it.kind === 'desk') {
      const f = desk(R, it);
      computer(f, -0.3, it.h, -0.05);
      deskLamp(f, 0.75, it.h, -0.25);
      f.box(0xf4f0e6, 0.25, it.h, 0.1, 0.3, 0.01, 0.22, 0.2).cyl(0xc8362e, 0.6, it.h, 0.15, 0.04, 0.1);
    } else if (it.kind === 'shelf') shelf(R, it);
    else if (it.kind === 'bed') bed(R, it, { blanket: 0x7a7f8f, frame: 0x5a4a3a });
    else if (it.kind === 'stairs') stairs(R, it);
    else if (it.kind === 'dresser') {
      const f = dresser(R, it, { wood: 0x6b5a48 });
      f.box(0x9aa3ab, 0.5, it.h, 0, 0.12, 0.2, 0.12).decal('photo', -0.3, it.h + 0.14, 0, 0.3, 0.24, { rx: -0.2 });
    }
  }

  // ── people ──
  const P = (id) => PEOPLE.find((p) => p.id === id);
  const beth = P('beth');
  person(R, 'beth', { ...beth, h: HEIGHTS.beth, look: LOOKS.beth });
  // Jerry on the couch, facing the TV: Rick's sat clip on his skeleton, or,
  // without it, sat in shapes
  const jerry = P('jerry');
  const j = person(R, 'jerry', { ...jerry, h: HEIGHTS.jerry, look: { ...LOOKS.jerry, sit: true }, meshy: !!clip });
  if (j.cast?.mixer) {
    const c = j.cast;
    const sit = c.mixer.clipAction(facingAhead(c, clip));
    sit.play();
    for (const a of Object.values(c.act)) a.setEffectiveWeight(0);
    sit.setEffectiveWeight(1);
    j.group.position.x -= JERRY_SIT.back;
    j.group.position.y = JERRY_SIT.y;
    let last = null;
    R.tick((t) => {
      c.mixer.update(last == null ? 0 : Math.min(0.1, t - last));
      last = t;
    });
    // (the tick person() added plays the idle; its weights stay at nought)
    c.update = () => {};
  } else j.group.position.x -= 0.15;

  // the butter robot on the table by its hotspot
  butterRobot(R, -302.6, 0.75, 0.8, -Math.PI / 2 + 0.3);

  return R.build({ light: HOUSE_LIGHT });
}

// Rick's sat clip for someone else of the cast, turned (as meshyCast turns
// every clip it loads) so its hips face the way the sitter's walk does: ahead
function facingAhead(c, clip) {
  const own = clip.clone();
  const hips = c.group.getObjectByName('Hips');
  const ref = c.act.walk?.getClip();
  if (!hips?.parent || !ref) return own;
  c.group.updateMatrixWorld(true);
  // up, in the hips' parent's frame within the model
  const rel = c.body.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hips.parent.getWorldQuaternion(new THREE.Quaternion()));
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rel.invert());
  const ahead = heading(ref, up);
  if (ahead != null) faceForward(own, up, ahead);
  return own;
}

// how far Jerry sits back from where he stands, and how low (the sat clip turns his bones only)
const JERRY_SIT = { back: 0.12, y: -0.45 };
// the open doorways between the rooms (each a little in from the walls' ends)
const HOUSE_DOORWAYS = [
  [
    [-306.7, -5.88],
    [-306.7, -4.32],
  ],
  [
    [-306.7, 0.12],
    [-306.7, 1.68],
  ],
  [
    [-305.08, -1.9],
    [-302.32, -1.9],
  ],
  [
    [-296.9, -7.9],
    [-296.9, -6.32],
  ],
  [
    [-299.5, 0.42],
    [-299.5, 1.98],
  ],
  [
    [-293.28, -1.6],
    [-291.72, -1.6],
  ],
  [
    [-291.78, 0.5],
    [-290.22, 0.5],
  ],
  [
    [-295.7, -1.18],
    [-295.7, 0.38],
  ],
];
