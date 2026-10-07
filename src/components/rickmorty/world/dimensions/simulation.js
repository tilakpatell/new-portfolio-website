// The Zigerions' simulation ("M. Night Shaym-Aliens!"): the Smiths' street
// run on too little processing power. A plaza under a flat blue ceiling, the
// houses in two flat colours with their windows painted on, a road that is
// one grey stripe, two identical men out walking, a pop-tart waving from the
// door of his toaster, and the sun a yellow disc painted on the east wall.
// Along the north end a raised walkway behind glass, where Prince Nebulon
// watches and two Zigerions run the thing from their consoles. Everything
// built badly here is drawn without ink, so it reads flat against the real
// figures. The three slips are the place's `collect` (./destinations.js).

import * as THREE from 'three';
import { BALL, BOX, fitText } from '../interiors/shell';
import { stage } from './stage';

const LIGHT = { sun: [0xffffff, 0.9], hemi: [0xbfe6ff, 0x9aa89a, 1.9], fog: null, background: 0x7fc7ff };
const SKY = 0x7fc7ff;
const GRASS = 0x5cc24a;

// the ground: grass in one green, no specks
const FLAT = (g, w, h) => {
  g.fillStyle = '#5cc24a';
  g.fillRect(0, 0, w, h);
};

// a house in two colours: a box, a roof, windows and a door painted on
function house(R, x, z, w, d, h, wall, roof, cellId) {
  R.cell(cellId, 128, 64, (g, cw, ch) => {
    g.fillStyle = `#${wall.toString(16).padStart(6, '0')}`;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#9ad8ff';
    for (const u of [0.12, 0.62]) g.fillRect(cw * u, ch * 0.2, cw * 0.2, ch * 0.3);
    g.fillStyle = '#6a3a1a';
    g.fillRect(cw * 0.42, ch * 0.4, cw * 0.14, ch * 0.6);
  });
  const f = R.frame(x, z, 0, { list: 'fixed' });
  f.box(wall, 0, 0, 0, w, h, d);
  f.box(roof, 0, h, 0, w + 0.6, 0.5, d + 0.6);
  f.box(roof, 0, h + 0.5, 0, w * 0.7, 0.5, d * 0.7);
  f.decal(cellId, 0, h / 2, d / 2 + 0.03, w * 0.9, h * 0.9, { bright: true });
}

export async function buildSimulation(kit) {
  const S = stage(kit, 'simulation', { floor: FLAT, floorTile: 8, wall: SKY, ceiling: SKY, skirt: GRASS });
  const { R, P, A } = S;
  const H = S.d.ceiling;

  // the road: one grey stripe across the plaza, a yellow line down it
  R.frame(...P(0, 1), 0, { list: 'fixed' }).box(0x6a6a6a, 0, 0.01, 0, A.x1 - A.x0, 0.04, 6).box(0xf2d84a, 0, 0.05, 0, A.x1 - A.x0, 0.02, 0.2);
  // the houses: the Smiths' in its two colours, a neighbour's, the garage a box
  house(R, ...P(-12, -8.6), 10, 8, 5.6, 0xf2e2b8, 0x8a5a3a, 'sim-house');
  house(R, ...P(12, -8.6), 9, 7, 5, 0xd8e8f2, 0x5a5a7a, 'sim-house-b');
  R.frame(...P(-19.5, -7), 0, { list: 'fixed' }).box(0xf2e2b8, 0, 0, 0, 5, 3.2, 6).box(0x8a5a3a, 0, 3.2, 0, 5.4, 0.4, 6.4);
  // a tree or two, a ball on a stick
  for (const [dx, dz] of [[-24, 6], [22, -2], [-6, -12]]) R.frame(...P(dx, dz), 0, { list: 'fixed' }).cyl(0x7a5a3a, 0, 0, 0, 0.3, 2.2).ball(0x3aa83a, 0, 3.4, 0, 1.6);
  // (the two men, the pop-tart and his toaster are models, placed from ./destinations.js's extras)
  // the sun: a yellow disc painted high on the east wall, rays and all
  R.cell('sim-sun', 128, 128, (g, w, h) => {
    g.fillStyle = '#7fc7ff';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffe24a';
    g.lineWidth = 6;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(w / 2 + Math.cos(a) * w * 0.3, h / 2 + Math.sin(a) * h * 0.3);
      g.lineTo(w / 2 + Math.cos(a) * w * 0.46, h / 2 + Math.sin(a) * h * 0.46);
      g.stroke();
    }
    g.fillStyle = '#ffe24a';
    g.beginPath();
    g.arc(w / 2, h / 2, w * 0.26, 0, Math.PI * 2);
    g.fill();
  });
  R.frame(A.x1 - 0.14, P(0, -4)[1], -Math.PI / 2, { list: 'fixed' }).decal('sim-sun', 0, 6.4, 0.06, 3.6, 3.6, { bright: true });
  // a cloud or two, flat white boxes hung from the ceiling
  for (const [dx, dz] of [[-16, 8], [10, -2], [20, 12]]) R.frame(...P(dx, dz), 0, { list: 'fixed' }).box(0xffffff, 0, H - 1.6, 0, 4, 0.8, 1.6).box(0xffffff, 0.8, H - 1.2, 0, 2.4, 0.8, 1.2);

  // ── the walkway along the north end: a dark deck, glass, the consoles ──
  const [wx, wz] = P(0, -17.6);
  const W = R.frame(wx, wz, 0, { list: 'fixed' });
  W.box(0x2a2a3a, 0, 0, 0, A.x1 - A.x0, 3.2, 4.8).box(0x4a4a5e, 0, 3.2, 0, A.x1 - A.x0, 0.1, 4.8);
  W.box(0x1a1a28, 0, 3.3, 2.3, A.x1 - A.x0, 0.9, 0.12);
  const glass = R.own(new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.22, depthWrite: false }));
  const pane = new THREE.Mesh(BOX, glass);
  pane.position.set(wx, 3.2 + 0.9 + (H - 4.1) / 2, wz + 2.36);
  pane.scale.set(A.x1 - A.x0, H - 4.1, 0.04);
  R.add(pane, { ink: false });
  // the consoles, one each side of the prince, their screens lit
  for (const dx of [-7, 7]) {
    const f = R.frame(...P(dx, -16.2), 0, { y: 3.3 });
    f.box(0x3a3a4e, 0, 0, 0, 3, 1, 0.8).box(0x1a1a28, 0, 1, 0, 3, 0.6, 0.1, 0, -0.5);
    f.glow(BOX, 0x6ad8ff, 1.3, 0, 1.3, 0.06, 0, 2.6, 0.5, 0.02, -0.5);
    for (let k = 0; k < 4; k++) f.glow(BALL, k % 2 ? 0xff5a3a : 0x6aff8a, 1.6, -1 + k * 0.6, 1.04, 0.3, 0, 0.1);
  }
  // the wall behind them: the Zigerion fleet's purple, a band of lights
  R.frame(...P(0, -19.86), 0, { list: 'fixed' }).box(0x3a2a5a, 0, 0, 0, A.x1 - A.x0, H, 0.12);
  for (let dx = -26; dx <= 26; dx += 2) R.frame(...P(dx, -19.7), 0, { list: 'fixed' }).glow(BALL, 0x9a6aff, 1.4, 0, 6.5, 0, 0, 0.3);
  R.cell('sim-sign', 192, 48, (g, w, h) => {
    g.fillStyle = '#1a1a28';
    g.fillRect(0, 0, w, h);
    fitText(g, 'SIMULATION 3 · 2% CPU', w / 2, h / 2, w - 12, 20, { color: '#9a6aff' });
  });
  R.frame(...P(0, -19.7), 0, { list: 'fixed' }).decal('sim-sign', 0, 8, 0.06, 7, 1.6, { bright: true });

  // the glitch: when the slips are all found, the sim fails round him: a red
  // wash flickers over everything till he's out or caught
  const washMat = R.own(new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const wash = new THREE.Mesh(BOX, washMat);
  wash.position.set(...P(0, 0)[0] !== undefined ? [P(0, 0)[0], H / 2, P(0, 0)[1]] : [0, 0, 0]);
  wash.scale.set(A.x1 - A.x0 - 0.4, H - 0.2, A.z1 - A.z0 - 0.4);
  wash.renderOrder = 5;
  R.add(wash, { ink: false });

  S.people();
  let glitch = false;
  const area = S.done(LIGHT, (t) => {
    washMat.opacity = glitch ? 0.1 + 0.12 * (Math.sin(t * 7) > 0) : 0;
  });
  area.actions = {
    ...area.actions,
    // the last slip spotted: the Zigerions come down off the walkway after him
    collected: () => {
      glitch = true;
      for (const n of S.npcs) {
        if (!n.id.startsWith('zig-console')) continue;
        n.y = 0;
        n.c.group.position.set(...P(n.id.endsWith('a') ? -4 : 4, -14), 0);
      }
      S.hunt(true);
    },
    calm: () => {
      glitch = false;
      S.calm();
    },
  };
  return area;
}
