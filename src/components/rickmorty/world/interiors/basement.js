// Rick's secret lab, under the garage (../scene.js's AREA_BUILDERS; down the
// hatch in the garage lab's floor): a concrete floor and riveted steel walls
// under a ceiling of pipes and cables; three vats of glowing green across the
// back (Pickle Rick floating in the middle one, something like Rick in the
// first), the big humming machine on the east wall with its lights blinking
// and its rings turning, two consoles of green screens on the west, a rack of
// gadgets in the corner, a containment cell with something glowing in it, a
// tank of portal fluid swirling behind its porthole, the warning signs, and
// the yellow ladder back up its lit shaft. Everything stands where rules.js's
// FURNITURE says. Lit by its glows: no lamps of its own (a light more or less
// makes every material's shader change).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../../../../lib/stage3d';
import { AREAS, FURNITURE, LINKS } from '../rules';
import { at, coloured, mergeParts, rng, speckle } from '../kit';
import { BALL, BALL8, BOX, CYL, CYL8, PLANE, TAU, fitText, lathe, makeRoom, scribble, tiledPaint, tube, wallLine } from './shell';
import { LADDER, crossed, fadeUp, glowSpot, hazardStripes, holed } from './lab';

const A = AREAS.basement;
const H = 3.4; // to the ceiling
const UP = LINKS.find((l) => l.id === 'basement-ladder');
// the shaft up to the garage, over the ladder, and how high it's drawn
const SHAFT = { x0: UP.x - 0.6, x1: UP.x + 0.6, z0: A.z1 - 1.2, z1: A.z1 };
const RISE = 1.9;
// how much each tier draws: round things' sides, the light down the shaft,
// the cables, the screens' redraws a second, the bubbles in a vat
const PLAN = {
  high: { seg: 24, haze: true, cables: 3, hz: 10, bubbles: 7 },
  mid: { seg: 16, haze: true, cables: 2, hz: 6, bubbles: 5 },
  low: { seg: 12, haze: false, cables: 1, hz: 4, bubbles: 3 },
};
const STEEL = 0x56606a;
const DARK = 0x2e3436;
const PIPE = 0x7d878c;
const GREEN = 0x48ff6a;
const ACROSS = [-303.9, -296.1]; // the two pipes across the ceiling, between the beams
const piece = (id) => FURNITURE.find((f) => f.id === id);

export async function buildBasement(kit) {
  const R = makeRoom(kit, 'basement');
  const m = kit.mats;
  const plan = PLAN[kit.tier] ?? PLAN.high;
  const F = R.fixed;
  const top = R.frame(0, 0, 0, { list: 'fixed' }); // the world, for what's fixed
  const spills = []; // soft light on the floor and the walls: [x, y, z, w, h, rx, ry, colour, k]
  const screens = []; // the green screens: [region, matrix]
  const t0 = { value: 0 };

  paintCells(R);

  // ── the room: concrete, riveted steel, the ceiling with the shaft's hole in it ──
  const concrete = tiledPaint(m, 'c137-secret-concrete', 256, 3, (g, w, h) => {
    speckle(g, w, h, { base: '#6c736f', specks: ['#5f6662', '#787f7a', '#646b67', '#727a74'], n: 4600, size: 2, seed: 61 });
    const r = rng(67);
    for (let i = 0; i < 6; i++) {
      const x = r() * w;
      const y = r() * h;
      const gr = g.createRadialGradient(x, y, 2, x, y, 24 + r() * 46);
      gr.addColorStop(0, i % 3 ? 'rgba(25,32,28,0.28)' : 'rgba(60,150,70,0.16)');
      gr.addColorStop(1, 'rgba(25,32,28,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    g.strokeStyle = 'rgba(30,36,32,0.55)';
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      let x = r() * w;
      let y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += (r() - 0.5) * 30), (y += (r() - 0.5) * 30));
      g.stroke();
    }
    g.fillStyle = 'rgba(28,34,30,0.6)';
    g.fillRect(0, h - 2, w, 2);
    g.fillRect(w - 2, 0, 2, h);
  });
  R.tiled.add(BOX, concrete, at((A.x0 + A.x1) / 2, -0.05, (A.z0 + A.z1) / 2, 0, A.x1 - A.x0 + 0.4, 0.1, A.z1 - A.z0 + 0.4));
  const steel = tiledPaint(m, 'c137-secret-steel', 256, 2.4, rivetedPlates('#59645f', 71));
  const wall = { mat: steel, skirt: 0x262c2a, skirtH: 0.16, h: H };
  wallLine(R, F, [A.x0 - 0.2, A.z0], [A.x1 + 0.2, A.z0], { ...wall, into: [0, 1] });
  wallLine(R, F, [A.x0, A.z0 - 0.2], [A.x0, A.z1 + 0.2], { ...wall, into: [1, 0] });
  wallLine(R, F, [A.x1, A.z0 - 0.2], [A.x1, A.z1 + 0.2], { ...wall, into: [-1, 0] });
  wallLine(R, F, [A.x0 - 0.2, A.z1], [A.x1 + 0.2, A.z1], { ...wall, into: [0, -1] });
  const ceil = tiledPaint(m, 'c137-secret-ceiling', 256, 2.4, rivetedPlates('#3c4441', 73));
  // (its underside one surface, the shaft's hole in it)
  R.tiled.add(holed([A.x0 - 0.2, A.x1 + 0.2, A.z0 - 0.2, A.z1 + 0.2], [SHAFT.x0, SHAFT.x1, SHAFT.z0, SHAFT.z1 + 0.1], true), ceil, at(0, H, 0));
  // I-beams up the walls and across the ceiling
  for (const x of [-306.5, -302.6, -297.4, -293.5]) {
    top.box(0x3a4240, x, H - 0.28, (A.z0 + A.z1) / 2, 0.22, 0.28, A.z1 - A.z0).box(0x323937, x, H - 0.3, (A.z0 + A.z1) / 2, 0.3, 0.04, A.z1 - A.z0);
    for (const z of [A.z0 + 0.1, A.z1 - 0.1]) top.box(0x3a4240, x, 0, z, 0.24, H - 0.28, 0.2);
  }
  for (const z of [498, 502, 506]) for (const x of [A.x0 + 0.1, A.x1 - 0.1]) top.box(0x3a4240, x, 0, z, 0.2, H, 0.24);

  // ── the ladder up, and its shaft ──
  ladder(R, piece('ladder'));
  for (const [x, z, w, d] of [
    [SHAFT.x0 - 0.05, (SHAFT.z0 + SHAFT.z1) / 2, 0.1, SHAFT.z1 - SHAFT.z0 + 0.2],
    [SHAFT.x1 + 0.05, (SHAFT.z0 + SHAFT.z1) / 2, 0.1, SHAFT.z1 - SHAFT.z0 + 0.2],
    [UP.x, SHAFT.z0 - 0.05, 1.2, 0.1],
    [UP.x, SHAFT.z1 + 0.05, 1.2, 0.1],
  ])
    top.box(0x3d4340, x, H, z, w, RISE, d);
  // the garage's light at the top, and on the shaft's walls
  top.glow(PLANE, 0xfff1d6, 1.7, UP.x, H + RISE - 0.02, (SHAFT.z0 + SHAFT.z1) / 2, 0, 1.2, 1.2, 1, Math.PI / 2);
  for (const [x, z, ry] of [
    [SHAFT.x0 + 0.003, (SHAFT.z0 + SHAFT.z1) / 2, Math.PI / 2],
    [SHAFT.x1 - 0.003, (SHAFT.z0 + SHAFT.z1) / 2, -Math.PI / 2],
    [UP.x, SHAFT.z0 + 0.003, 0],
  ]) {
    top.glow(PLANE, 0xffe6bc, 0.75, x, H + RISE - 0.35, z, ry, 1.2, 0.7);
    top.glow(PLANE, 0xd8bf96, 0.36, x, H + RISE - 0.95, z, ry, 1.2, 0.5);
  }
  spills.push([UP.x, 0.012, A.z1 - 0.7, 2.2, 2.0, -Math.PI / 2, 0, 0xffe2b0, 0.55]);
  hazardBox(top, UP.x, A.z1 - 0.62, 1.3, 1.1);

  // ── what's in it ──
  for (const [i, id] of ['vat1', 'vat2', 'vat3'].entries()) vat(R, piece(id), i, spills);
  const liquid = vatLiquid(R, plan, t0);
  machine(R, piece('machine'), screens, spills);
  for (const id of ['console1', 'console2']) consoleDesk(R, piece(id), id === 'console1' ? ['code', 'wave', 'radar', 'helix', 'map'] : ['map', 'bars', 'code', 'radar', 'wave'], screens, spills);
  rack(R, piece('rack'));
  cell(R, piece('cell'), screens, spills);
  tank(R, piece('tank'), spills);
  ceilingWorks(R, plan, spills);
  signs(R);

  // the moving parts
  const pickle = await vatPickle(R, piece('vat2'));
  const machineFx = machineParts(R, piece('machine'), plan);
  const creature = cellCreature(R, piece('cell'));
  const swirl = tankSwirl(R, piece('tank'));
  const screen = greenScreens(R, screens, plan);
  const spill = softLight(R, spills);
  if (plan.haze) {
    // the light down the shaft, on the ladder
    const haze = new THREE.Mesh(
      R.own(crossed(1.1, H + RISE - 0.4)),
      R.own(new THREE.MeshBasicMaterial({ map: R.own(fadeUp(true)), color: new THREE.Color(0xffe2b4).multiplyScalar(0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
    );
    haze.position.set(UP.x, (H + RISE + 0.4) / 2, (SHAFT.z0 + SHAFT.z1) / 2 - 0.15);
    R.add(haze, { ink: false });
  }

  R.tick((t, dt) => {
    t0.value = t;
    pickle(t);
    machineFx(t, dt);
    creature(t);
    swirl(t);
    screen(t);
    spill.opacity = 0.92 + Math.sin(t * 7.3) * 0.04 + Math.sin(t * 2.1) * 0.04;
  });
  liquid.renderOrder = 1;

  return R.build({ light: { sun: [0xcff5e0, 0.42], hemi: [0xc4e6d6, 0x27332d, 1.5], fog: [0x07100c, 15, 46], background: 0x030705 } });
}

// ── paint ──

// steel plates, riveted along their seams, a little streaked
function rivetedPlates(base, seed) {
  return (g, w, h) => {
    const r = rng(seed);
    const c = new THREE.Color(base);
    const n = 2;
    const pw = w / n;
    const ph = h / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = `#${c.clone().multiplyScalar(0.9 + r() * 0.18).getHexString()}`;
        g.fillRect(i * pw, j * ph, pw, ph);
        // streaks of grime and rust down each plate
        for (let k = 0; k < 5; k++) {
          const x = i * pw + r() * pw;
          const gr = g.createLinearGradient(0, j * ph, 0, j * ph + ph);
          gr.addColorStop(0, k % 2 ? 'rgba(110,70,40,0.22)' : 'rgba(20,26,24,0.22)');
          gr.addColorStop(1, 'rgba(20,26,24,0)');
          g.fillStyle = gr;
          g.fillRect(x, j * ph, 2 + r() * 5, ph * (0.4 + r() * 0.6));
        }
      }
    // the seams, a highlight under each, and the rivets along them
    for (let i = 0; i <= n; i++) {
      g.fillStyle = 'rgba(16,20,19,0.9)';
      g.fillRect(i * pw - 2, 0, 4, h);
      g.fillRect(0, i * ph - 2, w, 4);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(i * pw + 2, 0, 1, h);
      g.fillRect(0, i * ph + 2, w, 1);
    }
    for (let i = 0; i <= n; i++)
      for (let s = 8; s < w; s += 16)
        for (const [x, y] of [
          [i * pw + 7, s],
          [s, i * ph + 7],
        ]) {
          g.fillStyle = 'rgba(16,20,19,0.8)';
          g.beginPath();
          g.arc(x + 0.6, y + 0.8, 2.6, 0, TAU);
          g.fill();
          g.fillStyle = 'rgba(200,210,205,0.55)';
          g.beginPath();
          g.arc(x - 0.4, y - 0.4, 1.6, 0, TAU);
          g.fill();
        }
  };
}

// the pictures: the signs, the vats' numbers, the gauges, a blueprint, the drain
function paintCells(R) {
  const INK = '#1e1e22';
  const YEL = '#f2c23c';
  R.cell('hazard', 256, 32, hazardStripes);
  R.cell('danger', 128, 160, (g, w, h) => {
    g.fillStyle = YEL;
    g.fillRect(0, 0, w, h);
    g.fillStyle = INK;
    g.fillRect(0, 0, w, 34);
    fitText(g, 'DANGER', w / 2, 18, w - 16, 24, { color: YEL });
    g.beginPath();
    g.moveTo(w / 2, 44);
    g.lineTo(w - 16, 116);
    g.lineTo(16, 116);
    g.closePath();
    g.fill();
    g.fillStyle = YEL;
    g.beginPath();
    g.moveTo(w / 2, 58);
    g.lineTo(w - 30, 108);
    g.lineTo(30, 108);
    g.closePath();
    g.fill();
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(w / 2 + 6, 62);
    g.lineTo(w / 2 - 10, 89);
    g.lineTo(w / 2 + 1, 89);
    g.lineTo(w / 2 - 6, 106);
    g.lineTo(w / 2 + 12, 80);
    g.lineTo(w / 2 + 1, 80);
    g.closePath();
    g.fill();
    fitText(g, 'HIGH VOLTAGE', w / 2, 138, w - 14, 17, { color: INK });
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.strokeRect(2, 2, w - 4, h - 4);
  });
  // the biohazard and radiation marks, black on yellow
  const sign = (name, word, mark) =>
    R.cell(name, 128, 160, (g, w, h) => {
      g.fillStyle = YEL;
      g.fillRect(0, 0, w, h);
      g.fillStyle = INK;
      g.strokeStyle = INK;
      mark(g, w / 2, 70);
      fitText(g, word, w / 2, 138, w - 14, 19, { color: INK });
      g.lineWidth = 4;
      g.strokeRect(2, 2, w - 4, h - 4);
    });
  sign('bio', 'BIOHAZARD', (g, cx, cy) => {
    g.lineWidth = 7;
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k * TAU) / 3;
      g.beginPath();
      g.arc(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17, 19, 0, TAU);
      g.stroke();
    }
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cx, cy, 22, 0, TAU);
    g.stroke();
    g.fillStyle = YEL;
    g.beginPath();
    g.arc(cx, cy, 6, 0, TAU);
    g.fill();
  });
  sign('rad', 'RADIATION', (g, cx, cy) => {
    g.beginPath();
    g.arc(cx, cy, 8, 0, TAU);
    g.fill();
    for (const c of [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6]) {
      g.beginPath();
      g.arc(cx, cy, 40, c - Math.PI / 6, c + Math.PI / 6);
      g.arc(cx, cy, 13, c + Math.PI / 6, c - Math.PI / 6, true);
      g.closePath();
      g.fill();
    }
  });
  R.cell('keepout', 192, 72, (g, w, h) => {
    g.fillStyle = '#f4f0e6';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c8302a';
    g.lineWidth = 6;
    g.strokeRect(4, 4, w - 8, h - 8);
    fitText(g, 'KEEP OUT', w / 2, 30, w - 30, 34, { color: '#c8302a' });
    fitText(g, 'CONTAINMENT CELL', w / 2, 55, w - 40, 13, { color: INK, weight: '700' });
  });
  R.cell('fluid', 192, 80, (g, w, h) => {
    g.fillStyle = '#163d26';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9dff5a';
    g.lineWidth = 3;
    g.strokeRect(5, 5, w - 10, h - 10);
    fitText(g, 'PORTAL FLUID', w / 2, 32, w - 26, 26, { color: '#9dff5a' });
    fitText(g, 'DO NOT DRINK', w / 2, 58, w - 60, 14, { color: '#f2ecd8', weight: '700' });
  });
  R.cell('staff', 224, 96, (g, w, h) => {
    g.fillStyle = '#f4f0e6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8302a';
    g.fillRect(0, 0, w, 40);
    fitText(g, 'AUTHORISED', w / 2, 21, w - 24, 28, { color: '#f4f0e6' });
    fitText(g, 'PERSONNEL ONLY', w / 2, 68, w - 24, 24, { color: INK });
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
  for (const n of [1, 2, 3])
    R.cell(`vat${n}`, 64, 32, (g, w, h) => {
      g.fillStyle = '#2c3236';
      g.fillRect(0, 0, w, h);
      fitText(g, `0${n}`, w / 2, h / 2 + 1, w - 10, 26, { color: YEL, font: 'Courier New, monospace' });
    });
  R.cell('gauge', 64, 64, (g, w, h) => {
    g.fillStyle = '#2b2b30';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4f0e6';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 5, 0, TAU);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      g.beginPath();
      g.moveTo(w / 2 + Math.cos(a) * 20, h / 2 + Math.sin(a) * 20);
      g.lineTo(w / 2 + Math.cos(a) * 25, h / 2 + Math.sin(a) * 25);
      g.stroke();
    }
    g.fillStyle = '#c8302a';
    g.fillRect(w / 2 + 12, h / 2 - 22, 9, 6);
    g.strokeStyle = '#c8302a';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2 + 16, h / 2 - 14);
    g.stroke();
  });
  R.cell('blueprint', 192, 128, (g, w, h) => {
    g.fillStyle = '#1f4f8f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 12) g.strokeRect(x, -1, 12, h + 2);
    for (let y = 0; y < h; y += 12) g.strokeRect(-1, y, w + 2, 12);
    // a portal gun, side on: body, the green tube, the barrel, dimension lines
    g.strokeStyle = '#eef6ff';
    g.lineWidth = 2;
    g.strokeRect(40, 46, 80, 34);
    g.strokeRect(58, 32, 46, 14);
    g.beginPath();
    g.arc(132, 63, 12, 0, TAU);
    g.stroke();
    g.strokeRect(52, 80, 20, 26);
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(40, 116);
    g.lineTo(144, 116);
    g.stroke();
    g.setLineDash([]);
    scribble(g, 14, 14, 70, 2, { color: '#eef6ff', seed: 5 });
    scribble(g, 150, 30, 34, 6, { color: '#eef6ff', gap: 9, seed: 9 });
  });
  R.cell('grate', 64, 64, (g, w, h) => {
    g.fillStyle = '#3a4042';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#121616';
    for (let i = 0; i < 6; i++) g.fillRect(8, 8 + i * 8.5, w - 16, 4.5);
  });
  R.cell('gadgets', 96, 28, (g, w, h) => {
    g.fillStyle = '#e8dcb0';
    g.fillRect(0, 0, w, h);
    fitText(g, 'GADGETS', w / 2, h / 2 + 1, w - 12, 18, { color: '#2a2a3a', font: 'Comic Sans MS, Marker Felt, sans-serif', weight: '700' });
  });
}

// hazard stripes round a rectangle on the floor, centred on (x, z), w × d
// (but on the sides named in `skip`: 'n', 's', 'e', 'w')
function hazardBox(f, x, z, w, d, skip = '', band = 0.14) {
  for (const s of [-1, 1]) {
    if (!skip.includes(s < 0 ? 'n' : 's')) f.decal('hazard', x, 0.003, z + s * (d / 2 - band / 2), w, band, { rx: -Math.PI / 2 });
    if (!skip.includes(s < 0 ? 'w' : 'e')) f.decal('hazard', x + s * (w / 2 - band / 2), 0.003, z, d - band * 2, band, { rx: -Math.PI / 2, ry: Math.PI / 2 });
  }
}

// ── the ladder ──

// yellow rails from the floor up through the ceiling to the garage, rungs,
// brackets to the wall
function ladder(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const len = H + RISE - 0.05;
  for (const s of [-1, 1]) {
    f.box(LADDER, s * 0.27, 0, 0, 0.055, len, 0.045);
    for (const y of [0.6, 1.9, 3.1, 4.3]) f.box(0x6f7880, s * 0.27, y, -0.04, 0.04, 0.05, 0.08);
    f.box(0x3a3d42, s * 0.27, 0, 0, 0.075, 0.04, 0.07);
  }
  for (let y = 0.3; y < len - 0.1; y += 0.3) f.cyl(0x9aa3ab, 0, y, 0, 0.018, 0.54, 0, Math.PI / 2);
}

// ── the vats ──

// a vat: a steel plinth with its number, the glass held in four struts and
// two rings, a cap with a pipe up to the ceiling, a hose back to the wall;
// in the first, something like a body; in the third, a brain on a cord
// (the middle one's pickle is vatPickle's)
const VAT_R = 0.6; // the liquid's radius
const VAT_Y = [0.34, 2.25]; // its foot and its top
function vat(R, it, i, spills) {
  const f = R.frame(it.x, it.z, it.turn);
  f.cyl(0x3f474c, 0, 0, 0, 0.8, 0.3).cyl(0x2c3236, 0, 0.3, 0, 0.72, 0.05);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    f.ball(0x9aa3ab, Math.cos(a) * 0.78, 0.2, Math.sin(a) * 0.78, 0.022, 1, BALL8);
  }
  f.cbox(0x2c3236, 0, 0.16, 0.79, 0.34, 0.18, 0.04).decal(`vat${i + 1}`, 0, 0.16, 0.812, 0.3, 0.15);
  const ring = new THREE.TorusGeometry(VAT_R + 0.03, 0.035, 8, 32);
  for (const y of [VAT_Y[0], VAT_Y[1]]) f.part(ring, 0x6f7880, 0, y, 0, 0, 1, 1, 1, Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    f.box(0x6f7880, Math.cos(a) * (VAT_R + 0.05), VAT_Y[0], Math.sin(a) * (VAT_R + 0.05), 0.07, VAT_Y[1] - VAT_Y[0], 0.07, -a);
  }
  f.cyl(0x4a5358, 0, VAT_Y[1], 0, 0.72, 0.22).cyl(0x3a4046, 0, VAT_Y[1] + 0.22, 0, 0.42, 0.1).cyl(0x5a636a, 0, VAT_Y[1] + 0.32, 0, 0.12, H - VAT_Y[1] - 0.32);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    f.ball(0x9aa3ab, Math.cos(a) * 0.62, VAT_Y[1] + 0.22, Math.sin(a) * 0.62, 0.025, 1, BALL8);
  }
  // a hose back to the wall, a valve on it
  f.cyl(0x2b2b30, 0.35, 0.15, -1.3, 0.07, 1.2, Math.PI / 2).part(new THREE.TorusGeometry(0.1, 0.018, 6, 16), 0xc8302a, 0.35, 0.36, -1.1, 0, 1, 1, 1, Math.PI / 2).cyl(0x6f7880, 0.35, 0.22, -1.1, 0.02, 0.14);
  // what's floating in it
  const inside = R.frame(it.x, it.z, it.turn, { list: 'fixed' });
  if (i === 0) {
    // a body, dark through the green: legs, a coat, arms, a head with spiky hair
    const c = 0x123a20;
    for (const s of [-1, 1]) inside.cyl(c, s * 0.09, 0.5, 0, 0.065, 0.72).cyl(c, s * 0.26, 1.45, 0, 0.05, 0.6, 0, s * 0.22);
    inside.part(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), c, 0, 1.45, 0).ball(c, 0, 1.94, 0.01, 0.135);
    for (let k = 0; k < 7; k++) {
      const a = -1.2 + k * 0.4;
      inside.part(new THREE.ConeGeometry(0.045, 0.2, 5), c, Math.sin(a) * 0.1, 2.0 + Math.cos(a) * 0.04, -0.06, 0, 1, 1, 1, -0.5, -a * 1.1);
    }
    inside.cyl(0x1d4a26, 0, 2.08, 0, 0.015, VAT_Y[1] - 2.08);
  } else if (i === 2) {
    // a brain on its cord
    const pink = 0xb07a7a;
    const r = rng(19);
    for (let k = 0; k < 9; k++) inside.ball(pink, (r() - 0.5) * 0.24, 1.42 + (r() - 0.5) * 0.12, (r() - 0.5) * 0.18, 0.1 + r() * 0.04);
    inside.part(tube([[0, 1.32, 0], [0.04, 1.0, 0.03], [-0.03, 0.7, 0], [0.02, VAT_Y[0] + 0.02, 0.05]], 0.02, 16), 0x8a5a5a, 0, 0, 0);
    inside.cyl(0x1d4a26, 0.05, 1.55, 0, 0.012, VAT_Y[1] - 1.55).cyl(0x1d4a26, -0.06, 1.52, 0.02, 0.012, VAT_Y[1] - 1.52);
  }
  // its green on the floor and on the wall behind
  spills.push([it.x, 0.012, it.z + 0.45, 3.2, 2.8, -Math.PI / 2, 0, GREEN, 0.6]);
  spills.push([it.x, 1.4, A.z0 + 0.02, 3.0, 3.2, 0, 0, GREEN, 0.4]);
}

// The vats' liquid: one shader for all three, drawn twice: the far side
// solid (so the wall behind's lines don't show through it), whatever's
// floating inside, then the near side over it, see-through, bright at the
// edges, glinting like glass. Bubbles rise in both.
const LIQUID_VERT = `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  varying float vSeed;
  void main() {
    vUv = uv;
    vSeed = floor(position.x / 5.0 + 0.5);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const LIQUID_FRAG = `
  uniform float t;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  varying float vSeed;
  float h1(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    // in metres: round the vat and up it
    vec2 p = vec2(vUv.x * CIRC, vUv.y * TALL);
    float bub = 0.0;
    for (int i = 0; i < BUBBLES; i++) {
      float fi = float(i) + vSeed * 11.0;
      float sp = 0.22 + 0.3 * h1(fi * 2.3);
      vec2 c = vec2(h1(fi * 1.7) * CIRC + sin(t * 2.0 + fi) * 0.03, fract(t * sp * 0.45 + h1(fi * 3.1)) * (TALL + 0.2) - 0.1);
      float r = 0.025 + 0.022 * h1(fi * 4.7);
      vec2 d = p - c;
      d.x = mod(d.x + CIRC * 0.5, CIRC) - CIRC * 0.5;
      float l = length(d);
      bub = max(bub, smoothstep(r, r * 0.55, l) * (0.45 + 0.55 * smoothstep(r * 0.1, r * 0.8, l)));
    }
    float band = 0.5 + 0.5 * sin(p.y * 7.0 - t * 1.4 + sin(p.x * 2.6 + t * 0.6) * 1.6);
    vec3 lit = vec3(0.36, 1.0, 0.32);
  #ifdef FRONT
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    float glint = smoothstep(0.07, 0.0, abs(vN.x - 0.52)) + 0.5 * smoothstep(0.04, 0.0, abs(vN.x + 0.66));
    vec3 c = lit * (0.45 + 0.75 * f) + vec3(0.04, 0.1, 0.04) * band + vec3(0.75, 1.0, 0.7) * (bub * 0.8 + glint * 0.55);
    gl_FragColor = vec4(c, clamp(0.14 + 0.5 * f + bub * 0.5 + glint * 0.35, 0.0, 0.92));
  #else
    vec3 deep = vec3(0.03, 0.3, 0.09);
    vec3 c = mix(deep, lit, 0.3 + 0.22 * band + 0.32 * (1.0 - vUv.y)) + vec3(0.6, 1.0, 0.55) * bub * 0.55;
    gl_FragColor = vec4(c, 1.0);
  #endif
  }`;
function vatLiquid(R, plan, t0) {
  const tall = VAT_Y[1] - VAT_Y[0];
  const geos = ['vat1', 'vat2', 'vat3'].map((id) => {
    const it = piece(id);
    return new THREE.CylinderGeometry(VAT_R, VAT_R, tall, plan.seg + 8).translate(it.x, (VAT_Y[0] + VAT_Y[1]) / 2, it.z);
  });
  const geo = R.own(mergeGeometries(geos, false));
  for (const g of geos) g.dispose();
  const defines = { CIRC: (TAU * VAT_R).toFixed(3), TALL: tall.toFixed(3), BUBBLES: plan.bubbles };
  const mat = (front) =>
    R.own(
      new THREE.ShaderMaterial({
        uniforms: { t: t0 },
        defines: front ? { ...defines, FRONT: '' } : defines,
        vertexShader: LIQUID_VERT,
        fragmentShader: LIQUID_FRAG,
        side: front ? THREE.FrontSide : THREE.BackSide,
        transparent: front,
        depthWrite: !front,
      }),
    );
  // (the far side is inked: in the ink pass it stands solid, so its outline shows)
  R.add(new THREE.Mesh(geo, mat(false)));
  const near = new THREE.Mesh(geo, mat(true));
  R.add(near, { ink: false });
  return near;
}

// Pickle Rick, in the middle vat: the Meshy pickle if it loads (in time),
// otherwise one in shapes; bobbing, turning a little
async function vatPickle(R, it) {
  const kit = R.kit;
  let pk = null;
  try {
    const need = kit.need ? kit.need(['pickle'], { clips: [] }) : kit.cast?.load(null, ['pickle'], { clips: [] });
    await Promise.race([need, new Promise((done) => setTimeout(done, 8000))]);
    pk = kit.cast?.prop?.('pickle', 0.95) ?? null;
  } catch {
    pk = null;
  }
  if (!pk) pk = toonPickle(R);
  const holder = new THREE.Group();
  holder.add(pk);
  R.add(holder);
  const y = 0.78;
  holder.position.set(it.x, y, it.z);
  return (t) => {
    holder.position.y = y + Math.sin(t * 0.9) * 0.06;
    holder.rotation.y = Math.sin(t * 0.33) * 0.35;
    holder.rotation.z = Math.sin(t * 0.6) * 0.06;
  };
}

// a pickle in shapes: green and knobbly, round eyes, a frown, teeth
function toonPickle(R) {
  const parts = [];
  const p = (geo, color, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => parts.push({ geo, color, matrix: at(x, y, z, ry, sx, sy, sz, rx, rz) });
  p(new THREE.CapsuleGeometry(0.16, 0.58, 6, 14), 0x6fae3e, 0, 0.45, 0, 0, 1.1, 1, 0.95);
  const r = rng(29);
  for (let i = 0; i < 18; i++) {
    const a = r() * TAU;
    p(BALL8, 0x5a9432, Math.cos(a) * 0.17, 0.2 + r() * 0.55, Math.sin(a) * 0.155, 0, 0.05);
  }
  for (const s of [-1, 1]) {
    p(BALL, 0xfbfaf4, s * 0.07, 0.68, 0.13, 0, 0.13);
    p(BALL8, 0x111111, s * 0.068, 0.68, 0.19, 0, 0.04);
    p(BOX, 0x3e5e22, s * 0.075, 0.77, 0.15, 0, 0.11, 0.025, 0.03, 0, s * 0.25);
  }
  p(BOX, 0x2a1a14, 0, 0.55, 0.165, 0, 0.16, 0.05, 0.03);
  p(BOX, 0xfbfaf4, 0, 0.565, 0.172, 0, 0.13, 0.015, 0.02);
  const mesh = new THREE.Mesh(R.own(mergeParts(parts)), R.kit.mats.toon(0xffffff, { vertexColors: true }));
  mesh.castShadow = true;
  return mesh;
}

// ── the machine ──

// The big humming machine on the east wall: a hazard-striped plinth, a tall
// core wound with copper between two cabinets of lights, dials, switches, a
// lever and a red button, a hood over it all with its pipes into the ceiling.
// Its rings and its glowing core are machineParts'.
function machine(R, it, screens, spills) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d } = it;
  const front = d / 2;
  f.box(DARK, 0, 0, 0, w, 0.22, d).decal('hazard', 0, 0.11, front + 0.002, w, 0.16);
  // the core
  f.cyl(0x4a5358, 0, 0.22, 0.15, 0.62, 0.3).cyl(0x5d676e, 0, 0.5, 0.15, 0.48, 2.3);
  const coil = new THREE.TorusGeometry(0.5, 0.028, 6, 28);
  for (let k = 0; k < 7; k++) for (const y0 of [0.72, 2.08]) f.part(coil, 0xc8743a, 0, y0 + k * 0.062, 0.15, 0, 1, 1, 1, Math.PI / 2);
  for (const y of [0.62, 1.22, 1.98, 2.58]) f.part(new THREE.TorusGeometry(0.52, 0.04, 8, 28), 0x3a4046, 0, y, 0.15, 0, 1, 1, 1, Math.PI / 2);
  // a grille over the core's window
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    f.box(0x3a4046, Math.cos(a) * 0.5, 1.24, 0.15 + Math.sin(a) * 0.5, 0.035, 0.76, 0.035, -a);
  }
  // the cabinets either side
  for (const s of [-1, 1]) {
    const u = s * 1.32;
    f.box(STEEL, u, 0.22, -0.05, 0.75, 2.58, 1.8);
    f.box(0x4a535c, u, 0.3, 0.86, 0.66, 0.62, 0.02);
    for (let k = 0; k < 6; k++) f.box(0x1e2326, u, 0.36 + k * 0.09, 0.875, 0.56, 0.03, 0.02);
    f.box(0x2b2b30, u, 1.88, 0.86, 0.68, 0.4, 0.02);
    screens.push([s < 0 ? 'lightsL' : 'lightsR', f.mat(u, 2.08, 0.872, 0, 0.62, 0.31, 1)]);
    f.cbox(0x2b2b30, u - 0.16, 1.58, 0.86, 0.24, 0.24, 0.03).decal('gauge', u - 0.16, 1.58, 0.877, 0.2, 0.2);
    f.cbox(0x2b2b30, u + 0.16, 1.58, 0.86, 0.24, 0.24, 0.03).decal('gauge', u + 0.16, 1.58, 0.877, 0.2, 0.2);
    for (let k = 0; k < 5; k++) f.cbox(0x9aa3ab, u - 0.24 + k * 0.12, 1.2, 0.87, 0.04, 0.06, 0.04).cbox(0xe8e3d6, u - 0.24 + k * 0.12, 1.24, 0.9, 0.018, 0.06, 0.018, 0, 0.5);
  }
  // the lever (south) and the red button (north)
  f.cbox(0x3a3d42, 1.32, 1.0, 0.88, 0.22, 0.12, 0.04).cyl(0x9aa3ab, 1.32, 1.06, 1.0, 0.02, 0.32, -0.9, 0).ball(0xc8302a, 1.32, 1.16, 1.13, 0.05);
  f.cbox(0xf2c23c, -1.32, 1.02, 0.875, 0.2, 0.2, 0.02).cyl(0xd8201c, -1.32, 1.02, 0.9, 0.065, 0.06, Math.PI / 2);
  f.decal('danger', -1.32, 0.62, 0.9, 0.26, 0.32);
  // the hood, its vents and its pipes up
  f.box(0x3f474c, 0, 2.8, 0.2, w, 0.4, 1.5).box(DARK, 0, 2.78, 0.2, w + 0.04, 0.05, 1.54);
  for (let k = 0; k < 7; k++) f.box(0x1e2326, -0.9 + k * 0.3, 2.88, front - 0.1, 0.16, 0.22, 0.02);
  for (const u of [-1.1, -0.35, 0.5, 1.2]) f.cyl(PIPE, u, 3.2, -0.3, 0.09, H - 3.2).cyl(0x3a4046, u, 3.2, -0.3, 0.12, 0.06);
  // cables off it along the floor, to the vats
  const cf = R.frame(0, 0, 0);
  const x0 = it.x - front;
  cf.part(tube([[x0 + 0.05, 0.4, it.z - 1.2], [x0 - 0.3, 0.05, it.z - 1.4], [x0 - 1.6, 0.04, it.z - 2.3], [-295.4, 0.04, 497.6], [-295.3, 0.15, 496.9]], 0.04, 40), 0x1e2326, 0, 0, 0);
  cf.part(tube([[x0 + 0.05, 0.4, it.z - 0.9], [x0 - 0.4, 0.04, it.z - 1.1], [x0 - 2.4, 0.04, it.z - 2.0], [-299.4, 0.04, 497.7], [-299.6, 0.15, 496.9]], 0.035, 48), 0xc8302a, 0, 0, 0);
  spills.push([x0 - 0.8, 0.012, it.z, 2.4, 3.8, -Math.PI / 2, 0, GREEN, 0.5]);
  hazardBox(R.frame(0, 0, 0, { list: 'fixed' }), x0 - 0.45, it.z, 0.9, w + 0.3, 'e');
}

// the machine's moving parts: two glowing rings turning round the core,
// opposite ways, and the core's window pulsing with its hum
function machineParts(R, it, plan) {
  const f = R.frame(it.x, it.z, it.turn);
  const centre = new THREE.Vector3().setFromMatrixPosition(f.mat(0, 0, 0.15));
  const parts = [{ geo: new THREE.TorusGeometry(0.8, 0.03, 6, plan.seg * 2), color: hot(0x2a9a40, 1.1) }];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    parts.push({ geo: BALL8, color: hot(0x9dff7a, 2.4), matrix: at(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8, 0, 0.12) });
  }
  const ringGeo = R.own(mergeParts(parts.map((p) => ({ ...p, matrix: p.matrix ?? at(0, 0, 0, 0, 1, 1, 1, Math.PI / 2) }))));
  const ringMat = R.own(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const rings = [1.32, 1.92].map((y, i) => {
    const r = new THREE.Mesh(ringGeo, ringMat);
    r.position.set(centre.x, y, centre.z);
    r.rotation.x = i ? -0.08 : 0.08;
    R.add(r, { ink: false });
    return r;
  });
  const coreMat = R.own(new THREE.MeshBasicMaterial({ color: hot(0x7dff6a, 1.6) }));
  const base = coreMat.color.clone();
  const core = new THREE.Mesh(R.own(new THREE.CylinderGeometry(0.49, 0.49, 0.5, plan.seg, 1, true)), coreMat);
  core.position.set(centre.x, 1.62, centre.z);
  R.add(core, { ink: false });
  return (t, dt) => {
    rings[0].rotation.y += dt * 1.6;
    rings[1].rotation.y -= dt * 2.2;
    coreMat.color.copy(base).multiplyScalar(0.82 + 0.18 * Math.sin(t * 9) + 0.08 * Math.sin(t * 23));
  };
}

// ── the consoles ──

// A console on the west wall: a steel desk, its control panel sloped to
// whoever stands at it (buttons, knobs, switches, a big red button under a
// guard), three monitors on it and two over them on a bracket, each with its
// green screen (`views`, regions of greenScreens' canvas)
function consoleDesk(R, it, views, screens, spills) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d } = it;
  const back = -d / 2;
  f.box(0x4a535c, 0, 0, 0, w, 0.78, d).box(0x30363b, 0, 0, d / 2 - 0.02, w - 0.1, 0.1, 0.06);
  f.box(0x3a4249, 0, 0.78, back + 0.2, w, 0.06, 0.4);
  // the sloped panel: (pu, pv) on it, `up` off it
  const a = 0.36;
  const py = 0.86;
  const pv0 = 0.18;
  f.cbox(0x3a4249, 0, py, pv0, w, 0.08, 0.46, 0, a);
  const on = (pu, pv, up) => {
    const k = 0.04 + up;
    return [pu, py + k * Math.cos(a) - pv * Math.sin(a), pv0 + k * Math.sin(a) + pv * Math.cos(a)];
  };
  const r = rng(it.z);
  const COLS = [0xc8302a, 0xf2c23c, 0x3a8fd8, 0xe8e3d6, 0x5ab04a];
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 2; j++) {
      const [u, y, v] = on(-0.85 + i * 0.09, -0.12 + j * 0.08, 0.01);
      f.cyl(COLS[Math.floor(r() * COLS.length)], u, y, v, 0.022, 0.025, a, 0, CYL8);
    }
  for (let i = 0; i < 3; i++) {
    const [u, y, v] = on(0.05 + i * 0.13, -0.08, 0.02);
    f.cyl(0x2b2b30, u, y, v, 0.035, 0.04, a).cyl(0xe8e3d6, u, y + 0.02, v + 0.03, 0.006, 0.03, a);
  }
  for (let i = 0; i < 6; i++) {
    const [u, y, v] = on(0.08 + i * 0.07, 0.1, 0.012);
    f.cbox(0x9aa3ab, u, y, v, 0.03, 0.02, 0.05, 0, a).cbox(0xe8e3d6, u, y + 0.03, v - 0.01, 0.012, 0.05, 0.012, 0, a - 0.6);
  }
  const [bu, by, bv] = on(0.75, 0, 0.02);
  f.part(new THREE.TorusGeometry(0.075, 0.015, 6, 20), 0xf2c23c, bu, by, bv, 0, 1, 1, 1, a - Math.PI / 2).cyl(0xd8201c, bu, by, bv, 0.055, 0.05, a);
  for (let i = 0; i < 5; i++) {
    const [u, y, v] = on(-0.85 + i * 0.09, 0.12, 0.004);
    f.glow(BOX, i % 3 ? 0x9dff5a : 0xff8a1e, 1.6, u, y, v, 0, 0.04, 0.008, 0.03, a);
  }
  // the monitors: three on the desk, two on a bracket over them
  const crt = (u, y, v, size, view, color) => {
    const [sw, sh, sd] = size;
    f.box(color, u, y, v - sd / 2, sw, sh, sd).box(0x2b2b30, u, y + 0.03, v - sd + 0.02, sw * 0.7, sh * 0.8, 0.1);
    f.box(0x1a1d20, u, y + sh * 0.1, v + 0.002, sw * 0.86, sh * 0.8, 0.012);
    screens.push([view, f.mat(u, y + sh * 0.5, v + 0.01, 0, sw * 0.78, sh * 0.68, 1)]);
  };
  crt(-0.62, 0.84, back + 0.4, [0.5, 0.42, 0.36], views[0], 0xcfc8b4);
  crt(0, 0.84, back + 0.4, [0.52, 0.44, 0.36], views[1], 0x8a9094);
  crt(0.62, 0.84, back + 0.4, [0.5, 0.42, 0.36], views[2], 0xcfc8b4);
  f.box(0x3a3d42, 0, 1.36, back + 0.12, w - 0.3, 0.04, 0.24);
  for (const s of [-1, 1]) f.box(0x3a3d42, s * 0.95, 0.84, back + 0.03, 0.04, 0.52, 0.04);
  crt(-0.36, 1.4, back + 0.3, [0.56, 0.46, 0.3], views[3], 0x8a9094);
  crt(0.36, 1.4, back + 0.3, [0.56, 0.46, 0.3], views[4], 0xcfc8b4);
  // cables down the back, a mug
  for (const u of [-0.5, 0.1, 0.55]) f.cyl(0x1e2326, u, 0.1, back + 0.03, 0.015, 1.3);
  f.cyl(0xe8e3d6, 0.92, 0.84, back + 0.15, 0.04, 0.09);
  spills.push([it.x + 1.0, 0.012, it.z, 1.6, 2.4, -Math.PI / 2, 0, 0x5aff7a, 0.3]);
}

// ── the rack ──

// grey steel shelving full of gadgets: portal guns, a helmet with aerials, a
// ray gun, jars glowing, a battery with a little world's light in it, coils
function rack(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  const GREY = 0x8d949a;
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(GREY, s * (w / 2 - 0.03), 0, t * (d / 2 - 0.03), 0.04, h, 0.04);
  const levels = [0.1, 0.62, 1.14, 1.66, h - 0.03];
  for (const y of levels) f.box(0x9aa1a7, 0, y, 0, w, 0.03, d).box(0x7d848a, 0, y - 0.04, d / 2 - 0.02, w, 0.04, 0.02);
  const on = (i) => levels[i] + 0.03;
  // a crate, a toolbox, a coil of cable, the battery
  f.box(0x8a6a4a, -0.6, on(0), -0.02, 0.6, 0.36, 0.5).box(0xc8302a, 0.1, on(0), 0, 0.42, 0.2, 0.24).cbox(0x2b2b30, 0.1, on(0) + 0.25, 0, 0.2, 0.03, 0.03);
  f.part(new THREE.TorusGeometry(0.14, 0.035, 6, 20), 0xd87a2a, 0.62, on(0) + 0.035, 0, 0, 1, 1, 1, Math.PI / 2);
  f.box(0x2b2b30, -0.55, on(1), 0, 0.34, 0.3, 0.34).glow(BOX, 0xbfe6ff, 2.2, -0.55, on(1) + 0.15, 0.172, 0, 0.18, 0.14, 0.004);
  // two portal guns: grey body, the green tube on top, a nub at the front
  for (const [u, ry] of [
    [0.05, 0.3],
    [0.55, -0.2],
  ]) {
    const g = f.sub(u, 0, ry, on(1));
    g.box(0xc9ccc6, 0, 0, 0, 0.12, 0.1, 0.26).box(0x9aa3ab, 0, -0.0, -0.06, 0.06, 0.16, 0.06, 0, -0.3);
    g.glow(CYL, 0x8dff5a, 1.8, 0, 0.13, -0.02, 0, 0.06, 0.16, 0.06, Math.PI / 2);
    g.ball(0xe8e3d6, 0, 0.05, 0.14, 0.05);
  }
  // the helmet with its aerials; the ray gun
  f.part(new THREE.SphereGeometry(0.15, 16, 8, 0, TAU, 0, Math.PI / 2), 0x6f8fb0, -0.55, on(2), 0).cyl(0x3a3d42, -0.55, on(2), 0, 0.155, 0.03);
  for (const s of [-1, 1]) f.cyl(0x9aa3ab, -0.55 + s * 0.08, on(2) + 0.12, 0, 0.006, 0.18, 0, s * 0.3).ball(0xc8302a, -0.55 + s * 0.13, on(2) + 0.28, 0, 0.02);
  const rg = f.sub(-0.05, 0, 0.2, on(2));
  rg.cyl(0xd8a24a, 0, 0.06, 0, 0.04, 0.3, Math.PI / 2).box(0x8a5a34, 0, 0, -0.08, 0.05, 0.1, 0.06, 0, 0.3).glow(BALL, 0xff5a3a, 2, 0, 0.06, 0.16, 0, 0.05);
  for (let k = 0; k < 3; k++) rg.part(new THREE.TorusGeometry(0.05, 0.012, 6, 14), 0x9aa3ab, 0, 0.06, -0.04 + k * 0.06);
  // jars, glowing
  for (const [u, c] of [
    [0.38, 0x6dff4a],
    [0.58, 0xff8a1e],
    [0.78, 0x58c8ff],
  ]) {
    f.glow(CYL, c, 1.5, u, on(2) + 0.09, 0.02, 0, 0.11, 0.16, 0.11);
    f.cyl(0x9aa3ab, u, on(2) + 0.2, 0.02, 0.07, 0.03);
  }
  // the top shelves: a box of lights, a coil, a spring, boxes
  f.box(0x4a535c, -0.55, on(3), 0, 0.42, 0.26, 0.3);
  for (let k = 0; k < 4; k++) f.glow(BALL8, [0xff3a2a, 0x9dff5a, 0xffc04a, 0x9dff5a][k], 2, -0.7 + k * 0.1, on(3) + 0.16, 0.152, 0, 0.035);
  f.part(new THREE.TorusGeometry(0.12, 0.03, 8, 20), 0xc8743a, 0.05, on(3) + 0.12, 0, 0, 1, 1, 1, 0.2);
  const spring = [];
  for (let i = 0; i <= 40; i++) spring.push([0.6 + Math.cos(i * 0.9) * 0.06, on(3) + i * 0.006, Math.sin(i * 0.9) * 0.06]);
  f.part(tube(spring, 0.01, 80), 0x9aa3ab, 0, 0, 0);
  f.box(0xc9a46a, -0.4, on(4), 0, 0.7, 0.3, 0.5).box(0x8a6a4a, 0.45, on(4), 0, 0.6, 0.24, 0.45);
  f.decal('gadgets', 0, on(4) - 0.1, d / 2 + 0.002, 0.42, 0.12);
}

// ── the containment cell ──

// A steel cage in the corner: a floor plate and a roof, posts, bars on its
// three open sides, a heavy door with a lock and its little screen, a red
// light on top and a sign; something glows inside (cellCreature)
function cell(R, it, screens, spills) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  const e = w / 2 - 0.06;
  f.box(0x3a4046, 0, 0, 0, w, 0.08, d).box(0x3a4046, 0, h - 0.14, 0, w, 0.14, d).box(DARK, 0, h - 0.18, 0, w - 0.1, 0.04, d - 0.1);
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(0x4a535c, s * e, 0, t * e, 0.12, h - 0.1, 0.12);
  const bar = (u0, v0, u1, v1, skip = null) => {
    const n = Math.round(Math.hypot(u1 - u0, v1 - v0) / 0.16);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const u = u0 + (u1 - u0) * k;
      const v = v0 + (v1 - v0) * k;
      if (skip && skip(u, v)) continue;
      f.cyl(0x8d949a, u, 0.08, v, 0.022, h - 0.22, 0, 0, CYL8);
    }
    for (const y of [0.5, 1.4]) f.cbox(0x4a535c, (u0 + u1) / 2, y, (v0 + v1) / 2, Math.abs(u1 - u0) + 0.04, 0.05, Math.abs(v1 - v0) + 0.04);
  };
  bar(-e, -e, e, -e);
  bar(-e, e, e, e);
  // the west side: bars, and the door in the middle of them
  const dv = 0.55;
  bar(-e, -e, -e, e, (u, v) => Math.abs(v) < dv);
  for (let i = 0; i < 6; i++) f.cyl(0x8d949a, -e - 0.03, 0.12, -dv + 0.12 + i * 0.19, 0.024, h - 0.3, 0, 0, CYL8);
  for (const y of [0.12, 0.9, h - 0.2]) f.cbox(0x5a636a, -e - 0.03, y, 0, 0.07, 0.07, dv * 2);
  for (const s of [-1, 1]) f.cbox(0x5a636a, -e - 0.03, (h - 0.1) / 2, s * dv, 0.08, h - 0.22, 0.07);
  // its lock, a red light on it, its screen
  f.cbox(0x2b2b30, -e - 0.1, 1.15, dv - 0.12, 0.1, 0.32, 0.18).glow(BALL8, 0xff2a1a, 2.4, -e - 0.16, 1.26, dv - 0.12, 0, 0.03);
  for (let i = 0; i < 6; i++) f.glow(BOX, 0xffc04a, 1.2, -e - 0.152, 1.06 + Math.floor(i / 3) * 0.06, dv - 0.17 + (i % 3) * 0.05, 0, 0.004, 0.035, 0.035);
  f.cbox(0x2b2b30, -e - 0.05, 1.62, -dv - 0.22, 0.04, 0.22, 0.4);
  screens.push(['cell', f.mat(-e - 0.075, 1.62, -dv - 0.22, -Math.PI / 2, 0.34, 0.15, 1)]);
  // the sign on the north bars, the red light on the roof
  f.cbox(0x2b2b30, 0.3, 1.55, -e - 0.05, 0.66, 0.26, 0.02).decal('keepout', 0.3, 1.55, -e - 0.062, 0.62, 0.23, { ry: Math.PI });
  f.cyl(0x2b2b30, -e + 0.2, h, -e + 0.2, 0.08, 0.06).glow(new THREE.SphereGeometry(0.07, 12, 6, 0, TAU, 0, Math.PI / 2), 0xff3a2a, 2.2, -e + 0.2, h + 0.06, -e + 0.2);
  // the stripe round it on the floor, its glow inside and on the wall
  hazardBox(R.frame(0, 0, 0, { list: 'fixed' }), it.x - 0.13, it.z, w + 0.26, d + 0.5, 'e');
  spills.push([it.x, 0.09, it.z, 3.0, 3.0, -Math.PI / 2, 0, 0xb050ff, 0.7]);
  spills.push([A.x1 - 0.02, 1.2, it.z, 3.0, 2.4, 0, -Math.PI / 2, 0xb050ff, 0.35]);
}

// what's in the cell: a violet glowing lump with eyes, hanging in the air,
// breathing, looking about
function cellCreature(R, it) {
  const blob = new THREE.IcosahedronGeometry(0.34, 3);
  const pos = blob.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const lump = new THREE.Color(0xa040f0);
  const lit = new THREE.Color(0xe0a0ff);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const r = 0.34 * (1 + 0.14 * Math.sin(v.x * 4 + 1) * Math.sin(v.y * 3 + 2) + 0.08 * Math.sin(v.z * 6));
    pos.setXYZ(i, v.x * r, v.y * r * 1.15, v.z * r);
    c.copy(lump).lerp(lit, Math.max(0, v.y * 0.6 + v.z * 0.3));
    c.toArray(col, i * 3);
  }
  blob.setAttribute('color', new THREE.BufferAttribute(col, 3));
  blob.deleteAttribute('uv');
  blob.computeVertexNormals();
  const eyes = [];
  for (const s of [-1, 1]) {
    eyes.push(coloured(BALL, 0xfff6c0).applyMatrix4(at(s * 0.11, 0.08, 0.3, 0, 0.13, 0.1, 0.06)));
    eyes.push(coloured(BALL8, 0x000000).applyMatrix4(at(s * 0.11, 0.08, 0.335, 0, 0.05)));
  }
  for (const g of eyes) g.deleteAttribute('uv');
  const geo = R.own(mergeGeometries([blob, ...eyes], false));
  blob.dispose();
  for (const g of eyes) g.dispose();
  const mesh = new THREE.Mesh(geo, R.own(new THREE.MeshBasicMaterial({ vertexColors: true, color: hot(0xffffff, 1.35) })));
  const y = 1.15;
  mesh.position.set(it.x + 0.15, y, it.z);
  mesh.rotation.y = -Math.PI / 2;
  R.add(mesh);
  return (t) => {
    const b = Math.sin(t * 1.7);
    mesh.position.y = y + Math.sin(t * 1.1) * 0.08;
    mesh.rotation.y = -Math.PI / 2 + Math.sin(t * 0.45) * 0.7 + Math.sin(t * 1.9) * 0.08;
    mesh.scale.set(1 + b * 0.05, 1 - b * 0.05, 1 + b * 0.05);
  };
}

// ── the tank of portal fluid ──

// A steel tank on legs, banded and riveted under a domed top with its pipe
// up; a sight glass glowing green up its side, a valve wheel, a gauge, its
// label; and a porthole facing the room, the fluid swirling behind it
// (tankSwirl), the way the portal swirls
const TANK_R = 0.95;
const PORT = 1.5; // the porthole's height
const tankTurn = (it) => Math.atan2((A.x0 + A.x1) / 2 - it.x, (A.z0 + A.z1) / 2 - it.z);
function tank(R, it, spills) {
  const f = R.frame(it.x, it.z, tankTurn(it));
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(0x3a4046, s * 0.6, 0, t * 0.6, 0.12, 0.42, 0.12);
  f.cyl(0x3f474c, 0, 0.34, 0, TANK_R + 0.03, 0.08).cyl(0x6f7a80, 0, 0.4, 0, TANK_R, 2.2);
  f.part(new THREE.SphereGeometry(TANK_R, 24, 8, 0, TAU, 0, Math.PI / 2), 0x6f7a80, 0, 2.6, 0, 0, 1, 0.36, 1);
  const band = new THREE.TorusGeometry(TANK_R + 0.01, 0.035, 6, 40);
  for (const y of [0.6, 2.42]) f.part(band, 0x4a5358, 0, y, 0, 0, 1, 1, 1, Math.PI / 2);
  for (const y of [0.68, 2.34])
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * TAU;
      f.ball(0x9aa3ab, Math.sin(a) * (TANK_R + 0.01), y, Math.cos(a) * (TANK_R + 0.01), 0.018, 1, BALL8);
    }
  f.cyl(0x5a636a, 0, 2.88, 0, 0.2, 0.1).cyl(PIPE, 0.35, 2.85, -0.2, 0.08, H - 2.85).cyl(0x3a4046, 0.35, 2.82, -0.2, 0.11, 0.08);
  // the porthole: its collar out of the tank, the bezel ring and its bolts
  f.cyl(0x4a5358, 0, PORT, TANK_R - 0.12, 0.62, 0.3, Math.PI / 2);
  f.part(new THREE.RingGeometry(0.46, 0.64, 40), 0x8f989e, 0, PORT, TANK_R + 0.036);
  f.part(new THREE.TorusGeometry(0.47, 0.02, 6, 40), 0x6f7880, 0, PORT, TANK_R + 0.036);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    f.ball(0xc9ccc6, Math.cos(a) * 0.56, PORT + Math.sin(a) * 0.56, TANK_R + 0.04, 0.022, 1, BALL8);
  }
  // the label under it
  f.cbox(0x2b2b30, 0, 0.86, TANK_R - 0.02, 0.66, 0.3, 0.06).decal('fluid', 0, 0.86, TANK_R + 0.012, 0.62, 0.26);
  // the sight glass up its side, the valve, the gauge
  const sa = 0.85;
  const sx = Math.sin(sa) * (TANK_R + 0.1);
  const sz = Math.cos(sa) * (TANK_R + 0.1);
  for (const y of [0.7, 2.3]) f.cbox(0x5a636a, sx * 0.97, y, sz * 0.97, 0.1, 0.06, 0.14, sa);
  R.tiled.add(CYL, R.kit.mats.glass, f.mat(sx, 1.5, sz, 0, 0.11, 1.56, 0.11));
  f.glow(CYL, 0x7dff6a, 1.6, sx, 1.22, sz, 0, 0.07, 1.0, 0.07);
  const va = -0.95;
  const vx = Math.sin(va) * (TANK_R + 0.2);
  const vz = Math.cos(va) * (TANK_R + 0.2);
  f.part(CYL, PIPE, vx * 0.88, 1.1, vz * 0.88, va, 0.1, 0.3, 0.1, Math.PI / 2).part(new THREE.TorusGeometry(0.14, 0.02, 6, 20), 0xc8302a, vx, 1.1, vz, va);
  for (let k = 0; k < 3; k++) f.cbox(0xc8302a, vx, 1.1, vz, 0.012, 0.27, 0.012, va, 0, (k * Math.PI) / 3);
  f.cbox(0x2b2b30, Math.sin(-0.45) * (TANK_R + 0.02), 2.05, Math.cos(-0.45) * (TANK_R + 0.02), 0.24, 0.24, 0.05, -0.45).decal('gauge', Math.sin(-0.45) * (TANK_R + 0.05), 2.05, Math.cos(-0.45) * (TANK_R + 0.05), 0.2, 0.2, { ry: -0.45 });
  // its green on the floor before it
  const p = new THREE.Vector3().setFromMatrixPosition(f.mat(0, 0, TANK_R + 0.8));
  spills.push([p.x, 0.012, p.z, 2.6, 2.6, -Math.PI / 2, 0, 0x9dff5a, 0.55]);
}

// the swirl behind the porthole: the portal's own shader on a square the
// bezel crops round
function tankSwirl(R, it) {
  const f = R.frame(it.x, it.z, tankTurn(it));
  const mat = R.own(R.kit.portal());
  mat.uniforms.seed.value = 4.2;
  const mesh = new THREE.Mesh(R.own(new THREE.PlaneGeometry(1.4, 1.4)), mat);
  f.mat(0, PORT, TANK_R + 0.032).decompose(mesh.position, mesh.quaternion, mesh.scale);
  mesh.renderOrder = 2;
  R.add(mesh, { ink: false });
  return (t) => {
    mat.uniforms.t.value = t * 0.8;
  };
}

// ── the ceiling: pipes, cables, lamps ──

function ceilingWorks(R, plan, spills) {
  const f = R.frame(0, 0, 0, { list: 'fixed' });
  const xm = (A.x0 + A.x1) / 2;
  const len = A.x1 - A.x0;
  // along the north wall, and the manifold over the vats
  f.cyl(PIPE, xm, 3.0, A.z0 + 0.35, 0.1, len, 0, Math.PI / 2).cyl(0xa04a32, xm, 2.82, A.z0 + 0.62, 0.065, len, 0, Math.PI / 2);
  f.cyl(0x4f7a5a, -300, 2.95, 496, 0.11, 12.4, 0, Math.PI / 2);
  for (const x of [-306.2, -293.8]) f.ball(0x4f7a5a, x, 2.95, 496, 0.11).cyl(0x4f7a5a, x, 2.95, 496, 0.11, H - 2.95);
  for (const x of [-305, -300, -295]) f.cyl(0x3a4046, x, 2.95, 496, 0.15, 0.12, 0, Math.PI / 2);
  // along the east wall, and two across the room
  f.cyl(PIPE, A.x1 - 0.2, 3.0, (A.z0 + A.z1) / 2, 0.09, A.z1 - A.z0, Math.PI / 2).cyl(0xc8c4b8, A.x1 - 0.42, 3.04, (A.z0 + A.z1) / 2, 0.06, A.z1 - A.z0, Math.PI / 2);
  for (const [i, x] of ACROSS.entries()) f.cyl(i ? 0xa04a32 : PIPE, x, 3.12, (A.z0 + A.z1) / 2, 0.075, A.z1 - A.z0, Math.PI / 2);
  // brackets holding them up
  for (let x = A.x0 + 1; x < A.x1; x += 2.2) f.box(0x3a4240, x, 3.0, A.z0 + 0.35, 0.05, H - 3.0, 0.04).box(0x3a4240, x, 2.82, A.z0 + 0.62, 0.05, H - 2.82, 0.04);
  for (let z = A.z0 + 1; z < A.z1; z += 2.2) {
    if (Math.abs(z - 500.5) > 1.9) f.box(0x3a4240, A.x1 - 0.3, 2.86, z, 0.6, 0.04, 0.05).box(0x3a4240, A.x1 - 0.03, 2.86, z, 0.04, H - 2.86, 0.05);
    for (const x of ACROSS) f.box(0x3a4240, x, 3.12, z, 0.04, H - 3.12, 0.04);
  }
  // valves on the drops
  for (const x of [-306.2, -293.8]) f.part(new THREE.TorusGeometry(0.12, 0.018, 6, 18), 0xc8302a, x, 3.15, 496.16, 0).cyl(PIPE, x, 3.15, 496.08, 0.02, 0.1, Math.PI / 2);
  // cables slung from hooks, sagging between them
  const runs = [
    [502.2, [0x1e2326, 0xc8302a, 0x3a6f3a]],
    [505.6, [0x1e2326, 0xf2c23c, 0x2f5f9a]],
  ];
  for (const [z, cols] of runs) {
    for (let x = A.x0 + 1; x <= A.x1 - 1 + 1e-6; x += 4.5) f.box(0x3a4240, x, 3.18, z, 0.04, H - 3.18, 0.04).box(0x3a4240, x, 3.16, z, 0.04, 0.04, 0.24);
    for (let x = A.x0 + 1; x < A.x1 - 1.5; x += 4.5)
      for (let c = 0; c < plan.cables; c++) {
        const pts = [];
        const sag = 0.24 + c * 0.07;
        for (let k = 0; k <= 10; k++) {
          const s = k / 10;
          pts.push([x + s * 4.5, 3.17 - Math.sin(s * Math.PI) * sag, z - 0.06 + c * 0.06]);
        }
        f.part(tube(pts, 0.018, 16), cols[c], 0, 0, 0);
      }
  }
  // lamps on stems: a green enamel shade, a caged bulb
  const shade = lathe([[0.27, 0], [0.24, 0.05], [0.12, 0.17], [0.05, 0.2]], plan.seg);
  const cage = new THREE.TorusGeometry(0.09, 0.006, 4, 16);
  for (const [x, z] of [
    [-305.2, 500],
    [-294.8, 500],
    [-300, 503.5],
    [-305.2, 507.2],
    [-294.8, 507.2],
  ]) {
    const y = 2.72;
    f.cyl(0x2b2b30, x, y + 0.2, z, 0.012, H - y - 0.2).part(shade, 0x2f5a44, x, y, z);
    f.glow(BALL, 0xffe8b0, 2.4, x, y - 0.02, z, 0, 0.12);
    f.glow(new THREE.CircleGeometry(0.24, plan.seg), 0xffd890, 1.25, x, y + 0.005, z, 0, 1, 1, 1, Math.PI / 2);
    for (const dy of [-0.05, -0.11]) f.part(cage, 0x2b2b30, x, y + dy, z, 0, 1, 1, 1, Math.PI / 2);
    spills.push([x, 0.012, z, 3.0, 3.0, -Math.PI / 2, 0, 0xfff0d0, 0.13]);
  }
}

// ── the signs ──

function signs(R) {
  const plate = (x, y, z, ry, w, h, name) => R.frame(x, z, ry, { list: 'fixed' }).cbox(0x2b2b30, 0, y, 0.01, w + 0.04, h + 0.04, 0.02).decal(name, 0, y, 0.022, w, h);
  plate(A.x1, 1.75, 497.3, -Math.PI / 2, 0.4, 0.5, 'danger');
  plate(-303.45, 2.05, A.z0, 0, 0.36, 0.45, 'bio');
  plate(-296.55, 2.05, A.z0, 0, 0.36, 0.45, 'rad');
  plate(A.x0, 1.75, 508.6, Math.PI / 2, 0.36, 0.45, 'rad');
  plate(-301.8, 1.85, A.z1, Math.PI, 0.62, 0.27, 'staff');
  plate(A.x0, 1.7, 501, Math.PI / 2, 0.66, 0.44, 'blueprint');
  R.frame(0, 0, 0, { list: 'fixed' }).decal('grate', -300, 0.004, 502.6, 0.5, 0.5, { rx: -Math.PI / 2 });
}

// ── the moving light ──

// The screens: one canvas, every console's, the machine's and the cell's
// pictures drawn into its regions a few times a second, on planes (`list`:
// [region, matrix]) merged into one mesh
const W = 512;
const HT = 256;
const REGIONS = {
  code: [0, 0, 128, 96],
  wave: [128, 0, 128, 96],
  radar: [256, 0, 128, 96],
  helix: [384, 0, 128, 96],
  bars: [0, 96, 128, 96],
  map: [128, 96, 128, 96],
  lightsL: [256, 96, 128, 64],
  lightsR: [384, 96, 128, 64],
  cell: [256, 160, 128, 48],
};
const CODE = [
  'PORTAL CAL   0.0137',
  'VAT 01   4.1C   OK',
  'VAT 02   PICKLE OK',
  'VAT 03   4.0C   OK',
  'CELL 1   SEALED',
  'FLUID    87%',
  '0x3F9A 0x11C7 0xBEEF',
  'SCAN C-137 ....... OK',
  'SCAN C-132 ....... ??',
  'MEGA SEEDS     0',
  'GRID LOAD    64%',
  'COIL TEMP   312K',
  'HUM  60.0 HZ',
  'RUN  SEQ 7/9',
];
const BRIGHT = '#9dff7a';
const MID = '#46c04e';
const DIM = '#164f26';
const BG = '#03170b';
function greenScreens(R, list, plan) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = HT;
  const g = c.getContext('2d');
  const tex = R.own(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  const geos = list.map(([name, matrix]) => {
    const [x, y, w, h] = REGIONS[name];
    const q = PLANE.clone();
    const uv = q.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + 0.5 + uv.getX(i) * (w - 1)) / W, 1 - (y + 0.5 + (1 - uv.getY(i)) * (h - 1)) / HT);
    return q.applyMatrix4(matrix);
  });
  const mesh = new THREE.Mesh(R.own(mergeGeometries(geos, false)), R.own(new THREE.MeshBasicMaterial({ map: tex, color: hot(0xffffff, 1.3) })));
  for (const q of geos) q.dispose();
  R.add(mesh, { ink: false });
  let last = -1;
  const draw = (t) => {
    g.fillStyle = BG;
    g.fillRect(0, 0, W, HT);
    g.font = '9px monospace';
    g.textBaseline = 'top';
    g.textAlign = 'left';
    // scrolling readings
    let [x, y, w, h] = REGIONS.code;
    const off = Math.floor(t * 2.5);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i === 7 ? BRIGHT : MID;
      g.fillText(CODE[(off + i) % CODE.length], x + 5, y + 4 + i * 11);
    }
    if (t % 1 < 0.5) g.fillRect(x + 5, y + 4 + 8 * 11 - 2, 6, 7);
    // a trace across a grid
    [x, y, w, h] = REGIONS.wave;
    grid(g, x, y, w, h);
    g.strokeStyle = BRIGHT;
    g.lineWidth = 1.6;
    g.beginPath();
    for (let i = 0; i <= w; i += 3) {
      const yy = y + h / 2 + Math.sin(i * 0.09 + t * 5) * h * 0.28 * (0.6 + 0.4 * Math.sin(t * 0.7)) + Math.sin(i * 0.31 - t * 9) * 3;
      if (i) g.lineTo(x + i, yy);
      else g.moveTo(x + i, yy);
    }
    g.stroke();
    // the radar's sweep and what it finds
    [x, y, w, h] = REGIONS.radar;
    const cx = x + w / 2;
    const cy = y + h / 2;
    g.strokeStyle = DIM;
    g.lineWidth = 1;
    for (const r of [14, 28, 42]) {
      g.beginPath();
      g.arc(cx, cy, r, 0, TAU);
      g.stroke();
    }
    const sweep = (t * 1.8) % TAU;
    g.strokeStyle = BRIGHT;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(sweep) * 44, cy + Math.sin(sweep) * 44);
    g.stroke();
    for (const [a, r] of [
      [0.8, 30],
      [2.6, 18],
      [4.4, 38],
    ]) {
      const since = (sweep - a + TAU) % TAU;
      g.fillStyle = since < 1.4 ? BRIGHT : DIM;
      g.fillRect(cx + Math.cos(a) * r - 2, cy + Math.sin(a) * r - 2, 4, 4);
    }
    // a helix turning
    [x, y, w, h] = REGIONS.helix;
    for (let i = 0; i < 18; i++) {
      const yy = y + 6 + i * 5;
      const a = i * 0.5 + t * 2.2;
      const x1 = x + w / 2 + Math.sin(a) * 30;
      const x2 = x + w / 2 - Math.sin(a) * 30;
      g.fillStyle = DIM;
      g.fillRect(Math.min(x1, x2), yy, Math.abs(x1 - x2), 1);
      g.fillStyle = Math.cos(a) > 0 ? BRIGHT : MID;
      g.fillRect(x1 - 2, yy - 1, 4, 3);
      g.fillStyle = Math.cos(a) > 0 ? MID : BRIGHT;
      g.fillRect(x2 - 2, yy - 1, 4, 3);
    }
    // levels
    [x, y, w, h] = REGIONS.bars;
    grid(g, x, y, w, h);
    for (let i = 0; i < 7; i++) {
      const v = 0.35 + 0.3 * Math.sin(t * (1.3 + i * 0.37) + i) + 0.15 * Math.sin(t * 4.1 + i * 2);
      g.fillStyle = i === 3 ? BRIGHT : MID;
      g.fillRect(x + 10 + i * 16, y + h - 8 - v * (h - 16), 11, v * (h - 16));
    }
    // a map of somewhere else, C-137 marked
    [x, y, w, h] = REGIONS.map;
    g.fillStyle = DIM;
    for (let i = 0; i < 11; i++) for (let j = 0; j < 8; j++) g.fillRect(x + 8 + i * 11, y + 8 + j * 11, 2, 2);
    g.fillStyle = BRIGHT;
    if (t % 0.8 < 0.5) g.fillRect(x + 8 + 6 * 11 - 2, y + 8 + 3 * 11 - 2, 6, 6);
    g.fillText('C-137', x + 8 + 6 * 11 + 6, y + 8 + 3 * 11 - 4);
    // the machine's lights
    lights(g, REGIONS.lightsL, t, 0);
    lights(g, REGIONS.lightsR, t, 40);
    // the cell's
    [x, y, w, h] = REGIONS.cell;
    g.font = 'bold 13px monospace';
    g.fillStyle = t % 1.2 < 0.8 ? '#ff5a4a' : '#5a1a14';
    g.fillText('CONTAINED', x + 8, y + 6);
    g.fillStyle = '#5a1a14';
    g.fillRect(x + 8, y + 30, w - 16, 8);
    g.fillStyle = '#ff8a5a';
    g.fillRect(x + 8, y + 30, (w - 16) * (0.6 + 0.25 * Math.sin(t * 1.3)), 8);
    // scanlines over the lot
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let yy = 0; yy < HT; yy += 3) g.fillRect(0, yy, W, 1);
  };
  draw(0);
  return (t) => {
    if (t - last < 1 / plan.hz && t >= last) return;
    last = t;
    draw(t);
    tex.needsUpdate = true;
  };
}
function grid(g, x, y, w, h) {
  g.fillStyle = DIM;
  for (let i = 16; i < w; i += 16) g.fillRect(x + i, y, 1, h);
  for (let j = 16; j < h; j += 16) g.fillRect(x, y + j, w, 1);
}
const LIGHT_COLS = ['#ff4a3a', '#ffc04a', '#9dff5a'];
const LIGHT_OFF = ['#4a1a14', '#4a3a14', '#1e4a1a'];
function lights(g, [x, y], t, seed) {
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 4; j++) {
      const n = seed + i * 4 + j;
      const rate = 1.2 + (n % 5) * 0.55;
      const on = (Math.imul(n * 7919 + Math.floor(t * rate + n * 0.37), 2654435761) >>> 0) % 7 > 2;
      g.fillStyle = (on ? LIGHT_COLS : LIGHT_OFF)[n % 3];
      g.beginPath();
      g.arc(x + 9 + i * 15.5, y + 9 + j * 15, 5, 0, TAU);
      g.fill();
    }
}

// Soft light on the floor and the walls (each spill [x, y, z, w, h, rx, ry,
// colour, k]): one additive mesh, its brightness humming
function softLight(R, spills) {
  const parts = spills.map(([x, y, z, w, h, rx, ry, color, k]) => ({ geo: PLANE, color: hot(color, k), matrix: at(x, y, z, ry, w, h, 1, rx) }));
  const mat = R.own(new THREE.MeshBasicMaterial({ map: R.own(glowSpot()), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const mesh = new THREE.Mesh(R.own(mergeParts(parts)), mat);
  mesh.renderOrder = 1;
  R.add(mesh, { ink: false });
  return mat;
}
