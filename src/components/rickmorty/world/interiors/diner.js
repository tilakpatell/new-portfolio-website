// Shoney's, inside (../scene.js's AREA_BUILDERS; through its door on the
// street), as "The Rickshank Rickdemption" has it: deep red booths along the
// windows, white blinds half down, pale yellow walls over a dark wainscot, a
// checked floor, the counter along the far wall with its red stools, a pie
// case, coffee on the warmer, ceiling fans turning and a lamp over each
// booth; the kitchen's swing door at the back; and a Galactic Federation
// agent in a black suit sat in the middle booth over eggs, sausage, a mug of
// coffee and the ketchup. Everything stands where rules.js's FURNITURE says.

import * as THREE from 'three';
import { AREAS, FURNITURE, LINKS, PEOPLE } from '../rules';
import { at, mergeParts } from '../kit';
import { BALL8, BOX, CYL, TAU, ceilings, doorAt, fitText, lathe, makeRoom, tiledPaint, wallLine, win, windowView } from './shell';
import { facingAhead, sitting, toonPerson } from './people';

const A = AREAS.diner;
const H = 3.0;
const YELLOW = 0xf2e2a6;
const WAINSCOT = [1.0, 0x6a2a24];
const RED = 0xa3343a;
const RED_DARK = 0x7a2228;
const CHROME = 0xc8ced4;
const AGENT = { skin: 0x9fbf6a, shirt: 0xf4f4f0, coat: 0x15161a, pants: 0x15161a, shoes: 0x0e0e0e, hair: 0x9fbf6a, tie: 0x1e5a5a, sit: true };

export async function buildDiner(kit) {
  const R = makeRoom(kit, 'diner');
  const m = kit.mats;
  paintCells(R);

  // ── the floor, the ceiling, the walls ──
  const floor = tiledPaint(m, 'c137-diner-checks', 128, 1.2, (g, w, h) => {
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = (x + y) % 2 ? '#e8e0cc' : '#8a2e2c';
        g.fillRect((x * w) / 4, (y * h) / 4, w / 4, h / 4);
      }
  });
  R.tiled.add(BOX, floor, at((A.x0 + A.x1) / 2, -0.05, (A.z0 + A.z1) / 2, 0, A.x1 - A.x0 + 0.4, 0.1, A.z1 - A.z0 + 0.4));
  ceilings(R, [[A.x0 - 0.2, A.x1 + 0.2, A.z0 - 0.2, A.z1 + 0.2]], H, 0xf2ead2);
  const F = R.fixed;
  const wall = { color: YELLOW, dado: WAINSCOT, skirt: 0x4a1a16, h: H };
  const booths = FURNITURE.filter((f) => f.kind === 'booth-table');
  // the windows over the booths, west; the counter's wall, east; the kitchen door, north; the way out, south
  wallLine(R, F, [A.x0, A.z0 - 0.2], [A.x0, A.z1 + 0.2], { ...wall, into: [1, 0] }, booths.map((b, i) => win(b.z, 1.9, 1.05, 1.5, `street${i}`, { bars: [2, 1], frame: 0xc8a46a })));
  wallLine(R, F, [A.x1, A.z0 - 0.2], [A.x1, A.z1 + 0.2], { ...wall, into: [-1, 0] });
  wallLine(R, F, [A.x0 - 0.2, A.z0], [A.x1 + 0.2, A.z0], { ...wall, into: [0, 1] }, [doorAt(-298.6, { w: 1.0, color: 0xb8bec4, trim: 0x8a9096, glass: 'porthole', panels: false })]);
  const exit = LINKS.find((l) => l.id === 'diner-exit');
  wallLine(R, F, [A.x0 - 0.2, A.z1], [A.x1 + 0.2, A.z1], { ...wall, into: [0, -1] }, [doorAt(exit.x, { w: 1.6, color: 0x9cc6d8, trim: 0xc8a46a, glass: 'doorglass', panels: false })]);
  // the blinds, half down over each window
  for (const b of booths) R.fixed(A.x0, b.z, Math.PI / 2).decal('blinds', 0, 2.05, 0.08, 1.95, 0.95).box(0xe8e4dc, 0, 2.52, 0.06, 2.0, 0.06, 0.08);
  // the menu board over the counter, a clock, the sign over the kitchen door
  const ew = R.fixed(A.x1, 798.5, -Math.PI / 2);
  ew.box(0x2a2a2e, 0, 1.75, 0.03, 3.2, 0.9, 0.05).decal('menu', 0, 2.2, 0.06, 3.1, 0.82);
  ew.cyl(0x2a2a2e, 2.6, 2.45, 0.04, 0.2, 0.05, Math.PI / 2).decal('clock', 2.6, 2.45, 0.07, 0.36, 0.36);
  R.fixed(-298.6, A.z0, 0).decal('kitchen', 0, 2.35, 0.03, 0.9, 0.28);
  R.fixed(-303, A.z0, 0).decal('pies', 0, 1.7, 0.012, 1.1, 0.8);

  // ── the booths, the counter, the stools ──
  for (const it of FURNITURE.filter((f) => f.area === 'diner')) {
    if (it.kind === 'booth') bench(R, it);
    else if (it.kind === 'booth-table') table(R, it, it.id === 'booth2');
    else if (it.kind === 'diner-counter') counter(R, it);
    else if (it.kind === 'stool') stool(R, it);
  }

  // ── the lights: a pendant over each booth, two fans turning ──
  const top = R.frame(0, 0, 0, { list: 'fixed' });
  for (const b of booths) {
    top.cyl(0x2a2a2e, b.x, 2.2, b.z, 0.008, H - 2.2).part(lathe([[0.04, 0], [0.24, -0.2], [0.26, -0.24]], 16), 0x2f5a3a, b.x, 2.2, b.z);
    top.glow(BALL8, 0xfff0c8, 1.6, b.x, 2.0, b.z, 0, 0.12);
  }
  const fans = [-302.4, -296.8].map((x) => fan(R, x, 799));
  for (const x of [-302.4, -296.8]) top.box(0xe8e4dc, x, H - 0.03, 802.2, 0.6, 0.03, 1.2).glow(BOX, 0xf8fbff, 1.7, x, H - 0.035, 802.2, 0, 0.5, 0.02, 1.1);

  // ── the agent, sat in the middle booth, facing the door ──
  const p = PEOPLE.find((o) => o.id === 'dineragent');
  await seated(R, p);

  R.tick((t) => {
    for (const f of fans) f.rotation.y = t * 2.4;
  });
  return R.build({ light: { sun: [0xfff4e0, 0.6], hemi: [0xfff6e8, 0x9a8a78, 1.85], fog: null, background: 0x15110d } });
}

// a high-backed bench in deep red, tufted in channels, on a dark plinth
function bench(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  f.box(0x3a1a16, 0, 0, 0, w, 0.18, d).box(RED, 0, 0.18, 0.04, w, 0.26, d - 0.08);
  f.box(RED_DARK, 0, 0.18, -d / 2 + 0.08, w, h - 0.18, 0.16);
  for (let i = 0; i < 6; i++) f.box(RED, -w / 2 + 0.12 + i * ((w - 0.24) / 5), 0.48, -d / 2 + 0.17, 0.16, h - 0.56, 0.04);
  f.box(0x4a1a16, 0, h - 0.04, -d / 2 + 0.08, w + 0.02, 0.06, 0.2);
}

// the table: a tan top on a chrome pedestal; the agent's has his breakfast on it
function table(R, it, breakfast) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  f.cyl(CHROME, 0, 0, 0, 0.22, 0.04).cyl(CHROME, 0, 0.04, 0, 0.05, h - 0.08).box(0xd8b48a, 0, h - 0.04, 0, w, 0.04, d).box(0xb8946a, 0, h - 0.06, 0, w + 0.02, 0.02, d + 0.02);
  const y = h;
  // napkins and the sauces on every table, at the window end
  f.box(CHROME, -w / 2 + 0.12, y, 0, 0.1, 0.12, 0.06).cyl(0xf4f4f0, -w / 2 + 0.12, y, 0.12, 0.022, 0.08).cyl(0x3a3a3a, -w / 2 + 0.12, y, -0.12, 0.022, 0.08);
  if (!breakfast) return;
  // the ketchup, the plate of eggs and sausage, the mug with its logo, a knife and fork
  f.cyl(0xc8262c, -w / 2 + 0.16, y, -0.26, 0.04, 0.18).cyl(0xf4f4f0, -w / 2 + 0.16, y + 0.18, -0.26, 0.022, 0.04);
  f.cyl(0xf4f4f0, 0.05, y, 0.15, 0.17, 0.02).ball(0xffe46a, 0.02, y + 0.03, 0.14, 0.06, 0.4).ball(0xfff8e8, 0.1, y + 0.025, 0.18, 0.06, 0.25);
  f.part(new THREE.CapsuleGeometry(0.02, 0.12, 4, 8), 0x8a4a2a, 0.12, y + 0.04, 0.08, 0, 1, 1, 1, 0, Math.PI / 2);
  f.part(new THREE.CapsuleGeometry(0.02, 0.12, 4, 8), 0x8a4a2a, 0.12, y + 0.04, 0.12, 0.2, 1, 1, 1, 0, Math.PI / 2);
  f.cyl(0xf4f4f0, 0.3, y, -0.18, 0.05, 0.11).cyl(0x3a2414, 0.3, y + 0.1, -0.18, 0.045, 0.01).decal('muglogo', 0.3, y + 0.06, -0.128, 0.06, 0.04);
  f.part(new THREE.TorusGeometry(0.03, 0.008, 6, 12), 0xf4f4f0, 0.36, y + 0.06, -0.18, Math.PI / 2);
  f.box(CHROME, 0.25, y, 0.15, 0.02, 0.005, 0.18).box(CHROME, 0.28, y, 0.15, 0.02, 0.005, 0.18);
}

// the counter along the east wall: a red front with chrome trim, a pale top;
// on it a pie case, coffee pots on a warmer, the till, menus
function counter(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  f.box(RED_DARK, 0, 0, 0, w, h - 0.05, d).box(CHROME, 0, 0.08, d / 2 + 0.005, w, 0.04, 0.01).box(CHROME, 0, h - 0.15, d / 2 + 0.005, w, 0.04, 0.01);
  f.box(0xf2ece0, 0, h - 0.05, 0.03, w + 0.06, 0.05, d + 0.1);
  const y = h;
  // the pie case: glass on a chrome base, pies on two shelves
  f.box(CHROME, -1.9, y, -0.05, 0.9, 0.05, 0.5);
  for (const yy of [0.08, 0.32]) for (const u of [-2.1, -1.7]) f.cyl(0xd8a05a, u, y + yy, -0.05, 0.14, 0.06).cyl(0xc8504a, u, y + yy + 0.06, -0.05, 0.12, 0.01);
  f.glow(BOX, 0xeaf6ff, 0.35, -1.9, y + 0.3, -0.05, 0, 0.9, 0.55, 0.5);
  // the coffee warmer and its two pots
  f.box(0x2a2a2e, 0.4, y, -0.1, 0.6, 0.06, 0.3);
  for (const u of [0.25, 0.55]) f.part(lathe([[0.08, 0], [0.1, 0.06], [0.07, 0.16], [0.05, 0.2]], 12), 0x3a2414, u, y + 0.06, -0.1).cyl(0xff8a2a, u, y + 0.24, -0.1, 0.06, 0.03);
  // the till, menus in a stand
  f.box(0x5a6068, 2.1, y, -0.05, 0.4, 0.24, 0.32).box(0x2a2a2e, 2.1, y + 0.24, -0.1, 0.36, 0.12, 0.02, 0, -0.5);
  f.box(0xc8262c, 1.4, y, 0.1, 0.24, 0.3, 0.04, 0, 0.1).box(0xc8262c, 1.45, y, 0.12, 0.24, 0.3, 0.04, 0, 0.1);
}

// a stool: a chrome post, a red cushion
function stool(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  f.cyl(CHROME, 0, 0, 0, 0.2, 0.03).cyl(CHROME, 0, 0.03, 0, 0.04, it.h - 0.1).cyl(RED, 0, it.h - 0.1, 0, 0.21, 0.1).cyl(CHROME, 0, it.h - 0.12, 0, 0.215, 0.03);
}

// a ceiling fan: a hub on a down-rod, five wooden blades (turned by the room's tick)
function fan(R, x, z) {
  const g = new THREE.Group();
  const parts = [];
  const p = (geo, color, xx, y, zz, ry, sx, sy, sz) => parts.push({ geo, color, matrix: at(xx, y, zz, ry, sx, sy, sz) });
  p(CYL, 0x4a3a2a, 0, 0, 0, 0, 0.16, 0.14, 0.16);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    p(BOX, 0x8a5a34, Math.cos(a) * 0.45, -0.02, Math.sin(a) * 0.45, -a, 0.6, 0.02, 0.14);
  }
  const mesh = new THREE.Mesh(R.own(mergeParts(parts)), R.kit.mats.toon(0xffffff, { vertexColors: true }));
  g.add(mesh);
  g.position.set(x, H - 0.45, z);
  R.add(g);
  R.frame(0, 0, 0, { list: 'fixed' }).cyl(0x4a3a2a, x, H - 0.45, z, 0.02, 0.45);
  return g;
}

// The agent, sat: his Meshy figure in Rick's sat clip (turned to face ahead,
// as Jerry sits on the couch), or in shapes, on the bench, facing the door
const SIT = { back: 0.12, y: -0.45 };
async function seated(R, p) {
  const kit = R.kit;
  try {
    const need = kit.need ? kit.need(['fedagent'], { clips: ['idle', 'walk', 'sit'] }) : null;
    await Promise.race([need, new Promise((done) => setTimeout(done, 9000))]);
  } catch {
    /* in shapes */
  }
  const clip = await sitting();
  const c = clip ? (kit.cast?.make?.('fedagent') ?? null) : null;
  if (c?.mixer) {
    c.group.scale.setScalar(1.9 / c.height);
    c.group.position.set(p.x, SIT.y, p.z - SIT.back);
    c.group.rotation.y = p.face + Math.PI / 2;
    R.group.add(c.group);
    const sit = c.mixer.clipAction(facingAhead(c, clip));
    sit.play();
    for (const a of Object.values(c.act)) a.setEffectiveWeight(0);
    sit.setEffectiveWeight(1);
    let last = null;
    R.tick((t) => {
      c.mixer.update(last == null ? 0 : Math.min(0.1, t - last));
      last = t;
    });
    return;
  }
  const fig = toonPerson(R, AGENT, 1.9);
  fig.group.position.set(p.x, 0, p.z);
  fig.group.rotation.y = p.face + Math.PI / 2;
  R.group.add(fig.group);
  R.tick(fig.tick);
}

// ── paint ──

function paintCells(R) {
  for (let i = 0; i < 3; i++) R.cell(`street${i}`, 128, 96, windowView(11 + i, { house: true }));
  R.cell('blinds', 192, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = '#f2eee6';
      g.fillRect(0, y, w, 6);
      g.fillStyle = '#c8c2b6';
      g.fillRect(0, y + 6, w, 1);
    }
    g.fillStyle = '#d8d2c6';
    g.fillRect(w * 0.2, 0, 2, h);
    g.fillRect(w * 0.8, 0, 2, h);
  });
  R.cell('menu', 384, 100, (g, w, h) => {
    g.fillStyle = '#1e1e22';
    g.fillRect(0, 0, w, h);
    fitText(g, 'SHONEY’S', w / 2, 18, w - 40, 22, { color: '#f6e04a', font: 'Georgia, serif' });
    g.fillStyle = '#e8e4dc';
    g.font = '11px sans-serif';
    const items = ['ALL-AMERICAN BREAKFAST', 'BIG BOY BURGER', 'STRAWBERRY PIE', 'BOTTOMLESS COFFEE', 'SLAMMIN’ HASH BROWNS', 'SOUP OF THE DAY'];
    items.forEach((s, i) => g.fillText(s, 14 + (i % 2) * (w / 2), 44 + Math.floor(i / 2) * 18));
  });
  R.cell('clock', 64, 64, (g, w, h) => {
    g.fillStyle = '#f6f2e8';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 2, 0, TAU);
    g.fill();
    g.strokeStyle = '#2a2a2a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2, 12);
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2 + 14, h / 2 + 4);
    g.stroke();
  });
  R.cell('kitchen', 128, 40, (g, w, h) => {
    g.fillStyle = '#b8262c';
    g.fillRect(0, 0, w, h);
    fitText(g, 'KITCHEN', w / 2, h / 2 + 1, w - 16, 26, { color: '#f6f2e8' });
  });
  R.cell('pies', 128, 96, (g, w, h) => {
    g.fillStyle = '#f6e04a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8262c';
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
    fitText(g, 'TRY OUR', w / 2, 22, w - 24, 16, { color: '#b8262c' });
    fitText(g, 'PIE', w / 2, 58, w - 24, 40, { color: '#b8262c', font: 'Georgia, serif' });
  });
  R.cell('muglogo', 48, 32, (g, w, h) => {
    g.fillStyle = '#f4f4f0';
    g.fillRect(0, 0, w, h);
    fitText(g, 'SHONEY’S', w / 2, h / 2, w - 4, 10, { color: '#c8262c', font: 'Georgia, serif' });
  });
  R.cell('porthole', 48, 48, (g, w, h) => {
    g.fillStyle = '#b8bec4';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8eaf2';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 6, 0, TAU);
    g.fill();
  });
  R.cell('doorglass', 64, 128, windowView(23, { house: true }));
}
