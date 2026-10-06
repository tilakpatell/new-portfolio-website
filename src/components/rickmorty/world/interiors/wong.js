// Dr. Wong's office (../scene.js's LAZY; through its door in the house next
// to Shoney's), as "Pickle Rick" has it: a calm, warm room, soft beige walls
// over a darker wainscot, a muted carpet, the blinds half down over the
// window onto the street, her diplomas framed on the wall; her armchair at the
// north with a side table and a lamp by it, the couch the family sits on
// facing her across a low table, a second chair at the west, a tall plant in
// the corner and her desk by the wall. Dr. Wong sits in her armchair, in her
// own sat clip, and is left out if her figure won't load. Everything stands
// where rules.js's FURNITURE says. Built the first time the door is used, so
// the world's first download doesn't carry it.

import { AREAS, FURNITURE, LINKS, PEOPLE } from '../rules';
import { BOX, ceilings, doorAt, fitText, makeRoom, tiledPaint, wallLine, win, windowView } from './shell';
import { carpet, couch, desk, deskLamp } from './furniture';
import { armchair, coffeeTable, plant } from './smiths';
import { seatOwn } from './people';
import { at } from '../kit';

const A = AREAS.wong;
const H = 2.8;
const WALL = 0xe6d9c2;
const WAINSCOT = [0.9, 0x8a6e52];
// drawn a tenth over life, as the Smiths are, and where the hips of someone in an armchair sit
const WONG_H = 1.9;
const SEAT_HIPS = 0.5;

export async function buildWong(kit) {
  const R = makeRoom(kit, 'wong');
  paintCells(R);

  // ── the floor, the ceiling, the walls ──
  const floor = tiledPaint(kit.mats, 'c137-wong-carpet', 128, 1.6, carpet, { color: 0x8d8170 });
  R.tiled.add(BOX, floor, at((A.x0 + A.x1) / 2, -0.05, (A.z0 + A.z1) / 2, 0, A.x1 - A.x0 + 0.4, 0.1, A.z1 - A.z0 + 0.4));
  ceilings(R, [[A.x0 - 0.2, A.x1 + 0.2, A.z0 - 0.2, A.z1 + 0.2]], H, 0xf2eadb);
  const F = R.fixed;
  const wall = { color: WALL, dado: WAINSCOT, skirt: 0x5e4734, h: H };
  // the window onto the street, west; the diplomas, east; the way out, south
  wallLine(R, F, [A.x0, A.z0 - 0.2], [A.x0, A.z1 + 0.2], { ...wall, into: [1, 0] }, [win(899.6, 1.6, 1.0, 1.3, 'street', { bars: [2, 2], frame: 0xf2ece0 })]);
  wallLine(R, F, [A.x1, A.z0 - 0.2], [A.x1, A.z1 + 0.2], { ...wall, into: [-1, 0] });
  wallLine(R, F, [A.x0 - 0.2, A.z0], [A.x1 + 0.2, A.z0], { ...wall, into: [0, 1] });
  const exit = LINKS.find((l) => l.id === 'wong-exit');
  wallLine(R, F, [A.x0 - 0.2, A.z1], [A.x1 + 0.2, A.z1], { ...wall, into: [0, -1] }, [doorAt(exit.x, { w: 1.0, color: 0x7a5a3e, trim: 0xf2ece0, panels: true })]);
  // the blinds over the window, her diplomas and a print, the clock she keeps time by
  R.fixed(A.x0, 899.6, Math.PI / 2).decal('blinds', 0, 1.95, 0.08, 1.65, 0.75).box(0xe8e4dc, 0, 2.36, 0.06, 1.7, 0.06, 0.08);
  const ew = R.fixed(A.x1, 899, -Math.PI / 2);
  for (const [u, y] of [
    [-1.1, 1.7],
    [-0.45, 1.75],
    [0.2, 1.7],
  ])
    ew.box(0x3a2a1e, u, y, 0.02, 0.48, 0.36, 0.03).decal('diploma', u, y, 0.04, 0.42, 0.3);
  ew.box(0x2a2a2e, 1.5, 1.55, 0.02, 0.9, 0.62, 0.03).decal('print', 1.5, 1.55, 0.04, 0.84, 0.56);
  R.fixed(-300, A.z0, 0).cyl(0x3a2a1e, 0, 2.15, 0.03, 0.17, 0.05, Math.PI / 2).decal('clock', 0, 2.15, 0.06, 0.3, 0.3);

  // ── the furniture ──
  const it = (id) => FURNITURE.find((f) => f.id === id);
  armchair(R, it('wong-armchair'));
  armchair(R, it('wong-chair'));
  coffeeTable(R, it('wong-table'));
  couch(R, it('wong-couch'), { body: 0x6a8a86, cushion: 0x86a6a0 });
  const side = it('wong-side');
  const sf = R.frame(side.x, side.z, 0, { list: 'fixed' });
  sf.cyl(0x6a4a30, 0, side.h - 0.04, 0, side.w / 2, 0.04).cyl(0x5a3e28, 0, 0, 0, 0.04, side.h - 0.04).cyl(0x5a3e28, 0, 0, 0, 0.16, 0.03);
  // her lamp and a box of tissues on the side table; her notepad on the low one
  deskLamp(sf, 0, side.h, 0, 0x8a6e52);
  sf.box(0xf2ece0, 0.12, side.h, 0.1, 0.14, 0.08, 0.1).box(0xffffff, 0.12, side.h + 0.08, 0.1, 0.06, 0.03, 0.04);
  const t = it('wong-table');
  R.frame(t.x, t.z, 0, { list: 'fixed' }).box(0xf6f2e6, -0.35, t.h, -0.1, 0.22, 0.012, 0.3, 0.1).cyl(0x2a2a2e, -0.3, t.h + 0.012, -0.1, 0.006, 0.01, Math.PI / 2, 0.4);
  const p = it('wong-plant');
  plant(R.frame(p.x, p.z, 0, { list: 'fixed' }), 0, 0, 0, { pot: 0x8a6e52, s: 3 });
  const dk = desk(R, it('wong-desk'));
  dk.box(0xf6f2e6, -0.3, it('wong-desk').h, 0.05, 0.3, 0.02, 0.22, 0.1).box(0x3a3a3e, 0.15, it('wong-desk').h, 0, 0.32, 0.015, 0.24, -0.2);
  deskLamp(dk, -0.6, it('wong-desk').h, -0.15, 0x2f5a52);

  // ── Dr. Wong, in her armchair, facing the couch ──
  await seatOwn(R, 'drwong', PEOPLE.find((o) => o.id === 'drwong'), { h: WONG_H, seatY: SEAT_HIPS });

  return R.build({ light: { sun: [0xfff2dc, 0.55], hemi: [0xfff4e4, 0x8a7a68, 1.8], fog: null, background: 0x16120e } });
}

// ── paint ──

function paintCells(R) {
  R.cell('street', 128, 96, windowView(31, { house: true }));
  R.cell('blinds', 192, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = '#f2eee6';
      g.fillRect(0, y, w, 6);
      g.fillStyle = '#c8c2b6';
      g.fillRect(0, y + 6, w, 1);
    }
  });
  R.cell('diploma', 96, 72, (g, w, h) => {
    g.fillStyle = '#f6f0de';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b89a5a';
    g.lineWidth = 3;
    g.strokeRect(5, 5, w - 10, h - 10);
    fitText(g, 'DOCTOR OF', w / 2, 20, w - 24, 9, { color: '#3a2a1e', font: 'Georgia, serif' });
    fitText(g, 'PSYCHIATRY', w / 2, 34, w - 24, 12, { color: '#3a2a1e', font: 'Georgia, serif' });
    g.fillStyle = '#b8262c';
    g.beginPath();
    g.arc(w - 18, h - 18, 7, 0, Math.PI * 2);
    g.fill();
  });
  R.cell('print', 168, 112, (g, w, h) => {
    // a calm print: hills under an evening sky
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#f2c48a');
    sky.addColorStop(1, '#f6e6c8');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#8a9a6a';
    g.beginPath();
    g.moveTo(0, h * 0.7);
    g.quadraticCurveTo(w * 0.35, h * 0.45, w * 0.7, h * 0.68);
    g.quadraticCurveTo(w * 0.85, h * 0.75, w, h * 0.62);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
  });
  R.cell('clock', 64, 64, (g, w, h) => {
    g.fillStyle = '#f6f2e8';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2a2a2a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2, 14);
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2 + 12, h / 2 + 6);
    g.stroke();
  });
}
