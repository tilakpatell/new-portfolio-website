// More of the Rick and Morty universe's traffic (see trafficModels.js for
// how a model is put together and what it returns): ordinary aliens going
// about their day, the Council of Ricks hunting you, the Galactic
// Federation's gunships and the cruisers they come out of, Evil Morty and
// his guard, and a few of the show's own (a Zigerion scam ship, Krombopulos
// Michael's, Squanchy's and Mr. Poopybutthole's).
//
// The hunters are fleetRickmortyFoes.js's, the friends fleetRickmortyFriends.js's,
// what they share fleetRickmortyKit.js's; their FLEETs are this one's.
//
// saucer: an alien family's flying saucer on the commute, tangerine and
// cream, a suitcase strapped on behind, the family bobbing under the dome
// (Dad at the wheel, Mum beside him, the kid in the back), a ring of rim
// lights chasing round and a soft green glow underneath.
// hauler: a junky space truck, a cab-over with a big split windscreen and
// a long rusty chassis carrying three mismatched containers strapped down
// ("PLUMBUS", "Shleemypants Shipping", "Blips and Chitz"), a chunky engine
// behind whose exhaust sputters.
// gearship: a Gear People ship from Gearworld: a great brass gear for a
// body, turning slowly, the cockpit in its hub (a porthole forward under a
// toothed dome) and three little gears meshing on girders behind it.
// councilship: a Council of Ricks hunter: Rick's space cruiser in Citadel
// white and teal, the glass dome over the seats with a lab-coated Rick at
// the wheel, the exhaust cans glowing green, the Council's emblem on its
// flanks and a hunter light flashing red and teal on top.

import * as THREE from 'three';
import { part, place, rod, between, meshes, blinker, loft, box8, plateXZ, plateZY, turned, upright, canvasTexture, grey, panelTexture, standard, glowMaterial, flicker, pulse } from './trafficKit';
import { bubble, bobber, turner, bead, circle, gearOutline, spokeHoles, rustTexture } from './fleetRickmortyKit';
import { FLEET as FOES } from './fleetRickmortyFoes';
import { FLEET as FRIENDS } from './fleetRickmortyFriends';

const { PI, sin, cos, abs, min } = Math;

// ── The family saucer ──

// An ordinary alien family's flying saucer on the commute: a wide lens of a
// hull, tangerine on top and cream beneath, a chrome rim band ringed with
// lights that chase round it, red tail lights and a suitcase strapped on
// behind (it's the family car), and under the glass dome the family
// themselves (Dad at the wheel, Mum beside him, the kid in the back, blobby
// and eyestalked, bobbing along); the anti-grav glowing soft green
// underneath, its light spilling down below.
function saucer(k) {
  const TANGERINE = '#ef7a2e';
  const CREAM = '#f1e5c6';
  const CHROME = '#c7ccd3';
  const DARK = '#3a3f47';
  const L = [];
  const SEG = 32;
  // the hull, turned: the underside, the rim band, the deck and its stripe,
  // the dome's collar and the dome
  L.push(part(upright([[0.0001, -0.078], [0.08, -0.077], [0.2, -0.055], [0.3, -0.035], [0.38, -0.016], [0.416, -0.006]], SEG), { color: CREAM }));
  L.push(part(upright([[0.412, -0.01], [0.431, -0.004], [0.431, 0.014], [0.412, 0.02]], SEG), { color: CHROME }));
  L.push(part(upright([[0.416, 0.016], [0.36, 0.033], [0.28, 0.051], [0.2, 0.065], [0.18, 0.068]], SEG), { color: TANGERINE }));
  L.push(part(upright([[0.302, 0.0485], [0.278, 0.0535]], SEG), { at: [0, 0.0025, 0], color: CREAM }));
  L.push(part(upright([[0.186, 0.064], [0.186, 0.076], [0.162, 0.083]], SEG), { color: CHROME }));
  const domeY = 0.078;
  const domeR = 0.168;
  L.push(part(new THREE.SphereGeometry(domeR, 24, 8, 0, PI * 2, 0, PI / 2), { at: [0, domeY, 0], scale: [1, 0.9, 1], to: 'glass' }));
  // the antenna on top of the dome, its tip blinking
  const top = domeY + domeR * 0.9;
  L.push(part(new THREE.CylinderGeometry(0.012, 0.018, 0.01, 8), { at: [0, top + 0.002, 0], color: CHROME }));
  L.push(rod([0, top, 0], [0, top + 0.055, -0.02], 0.0025, 0.002, { color: CHROME }, 4));
  L.push(bead(0.008, [0, top + 0.058, -0.021], 1, { to: 'glow', color: [3.4, 1.0, 2.0], mark: 'tip' }));
  // inside the dome: the floor (purple carpet), the dashboard and the wheel
  L.push(part(new THREE.CylinderGeometry(domeR * 0.97, domeR * 0.97, 0.008, 24, 1), { at: [0, domeY + 0.002, 0], color: '#5a3d68' }));
  L.push(part(new THREE.BoxGeometry(0.16, 0.022, 0.03), { at: [0, domeY + 0.016, 0.118], rot: [-0.3, 0, 0], color: CREAM }));
  L.push(part(new THREE.BoxGeometry(0.03, 0.006, 0.008), { at: [0.04, domeY + 0.028, 0.108], rot: [-0.3, 0, 0], to: 'glow', color: [0.5, 1.8, 1.1] }));
  L.push(part(new THREE.TorusGeometry(0.018, 0.0035, 4, 10), { at: [-0.05, domeY + 0.042, 0.092], rot: [-0.6, 0, 0], color: DARK }));
  L.push(rod([-0.05, domeY + 0.042, 0.092], [-0.05, domeY + 0.022, 0.114], 0.003, 0.003, { color: DARK }, 4));
  // the rim lights, each its own mark so update() can chase them round
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * PI * 2;
    L.push(bead(0.009, [0.432 * sin(a), 0.005, 0.432 * cos(a)], [1, 0.8, 1], { to: 'glow', color: i % 2 ? [3.2, 0.9, 1.8] : [2.6, 1.8, 0.45], mark: `rim${i}` }, 6, 3));
  }
  // the anti-grav underneath: a glowing disc in a chrome ring, and a ring
  // of pods round it
  L.push(part(new THREE.CircleGeometry(0.07, 20), { at: [0, -0.0795, 0], rot: [PI / 2, 0, 0], to: 'glow', color: [0.9, 2.4, 1.8] }));
  L.push(part(upright([[0.07, -0.0785], [0.078, -0.084], [0.09, -0.076]], 20), { color: CHROME }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    L.push(bead(0.016, [0.2 * sin(a), -0.056, 0.2 * cos(a)], [1, 0.4, 1], { to: 'glow', color: [0.7, 2.0, 1.5] }, 6, 3));
  }
  // the tail lights, set into the deck at the back in chrome surrounds
  for (const sx of [-1, 1]) {
    const a = PI + sx * 0.3;
    const at = [0.392 * sin(a), 0.027, 0.392 * cos(a)];
    L.push(part(new THREE.BoxGeometry(0.058, 0.008, 0.02), { at, rot: [0, a, 0], color: CHROME }));
    L.push(part(new THREE.BoxGeometry(0.048, 0.008, 0.012), { at: [at[0], at[1] + 0.0015, at[2]], rot: [0, a, 0], to: 'glow', color: [3.6, 0.35, 0.3], mark: 'tail' }));
  }
  // the suitcase strapped on behind the dome
  L.push(part(new THREE.BoxGeometry(0.09, 0.042, 0.058), { at: [0, 0.074, -0.255], rot: [0.12, 0, 0], color: '#8a5530' }));
  for (const x of [-0.025, 0.025]) L.push(part(new THREE.BoxGeometry(0.008, 0.045, 0.061), { at: [x, 0.074, -0.255], rot: [0.12, 0, 0], color: '#3d2a1c' }));
  L.push(part(new THREE.TorusGeometry(0.012, 0.003, 3, 8, PI), { at: [0, 0.097, -0.252], rot: [0.12, 0, 0], color: '#3d2a1c' }));

  // the family, sat on the floor of the dome, facing ahead
  const fam = [];
  const blob = (h, w) => upright([[0.0001, 0], [w * 0.8, 0], [w, h * 0.2], [w * 0.96, h * 0.55], [w * 0.72, h * 0.84], [w * 0.36, h], [0.0001, h * 1.02]], 10);
  const member = (mark, color, [x, z], h, w, stalks) => {
    const y = domeY + 0.006;
    fam.push(part(blob(h, w), { at: [x, y, z], color, mark }));
    fam.push(bead(w * 0.2, [x, y + h * 0.42, z + w * 0.92], [1.6, 0.55, 0.5], { color: '#3a1420', mark }, 6, 3));
    for (const sx of [-1, 1]) fam.push(bead(w * 0.28, [x + sx * w * 0.95, y + h * 0.3, z + w * 0.15], [0.8, 1.2, 0.8], { color, mark }, 5, 4));
    // the eyestalks, each with its eye looking ahead
    for (const [dx, up, lean, r] of stalks) {
      const tip = [x + dx, y + h + up, z + lean];
      fam.push(rod([x + dx * 0.5, y + h * 0.9, z], tip, 0.0028, 0.0022, { color, mark }, 4));
      fam.push(bead(r, tip, 1, { color: '#f6f6f2', mark }, 7, 4));
      fam.push(bead(r * 0.5, [tip[0], tip[1], tip[2] + r * 0.72], 1, { color: '#111214', mark }, 5, 3));
    }
  };
  member('dad', '#7cc94a', [-0.05, 0.042], 0.076, 0.037, [
    [-0.017, 0.032, 0.01, 0.01],
    [0.017, 0.036, 0.008, 0.01],
  ]);
  member('mum', '#b77fe0', [0.053, 0.037], 0.07, 0.035, [
    [-0.021, 0.028, 0.008, 0.0088],
    [0, 0.04, 0.012, 0.0092],
    [0.021, 0.028, 0.008, 0.0088],
  ]);
  fam.push(bead(0.009, [0.053, domeY + 0.006 + 0.076, 0.022], [1.4, 0.8, 0.8], { color: '#f05a8c', mark: 'mum' }));
  member('kid', '#f4d03f', [0.0, -0.075], 0.05, 0.028, [[0, 0.032, 0.01, 0.0135]]);
  for (const p of fam) p.to = 'crew';

  // the soft glow spilling down under it: an open cone, bright at the top
  // and fading to nothing, added on
  const beam = part(new THREE.CylinderGeometry(0.072, 0.15, 0.07, 24, 1, true), { at: [0, -0.115, 0], to: 'beam', color: [0.45, 1.25, 0.9], uv: 'keep' });
  const fade = canvasTexture(64, (g, S) => {
    const grad = g.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#4a4a4a');
    grad.addColorStop(1, '#000000');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  });
  fade.wrapT = THREE.ClampToEdgeWrapping;

  const paint = standard(k, { map: k.own(panelTexture(k.rand, { base: 240, spread: 5, seam: 0.84, detail: 0.06, min: 22 })), metalness: 0.15, roughness: 0.5 });
  paint.userData.density = 4;
  const mats = {
    paint,
    crew: standard(k, { roughness: 0.55, metalness: 0 }),
    glass: bubble(k, '#bff4ea', 0.22),
    glow: glowMaterial(k),
    beam: k.own(new THREE.MeshBasicMaterial({ vertexColors: true, map: k.own(fade), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })),
  };
  const M = meshes(k, [...L, ...fam, beam], mats);
  const blink = blinker(M.glow.geometry);
  const bob = bobber(M.crew.geometry);
  M.crew.frustumCulled = false;
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(1 + 0.04 * sin(t * 5.3));
      // the rim lights: two bright heads chasing round, each with a tail
      const head = Math.floor(t * 14) % N;
      for (let i = 0; i < N; i++) {
        const d = min((head - i + N) % N, (head + N / 2 - i + N) % N);
        blink(`rim${i}`, [1.15, 0.7, 0.45][d] ?? 0.22);
      }
      blink('tip', pulse(t, 1.4, 0, 0.15) ? 1 : 0.15);
      bob('dad', 0.003 * sin(t * 2.2));
      bob('mum', 0.003 * sin(t * 2.2 + 1.9));
      bob('kid', 0.009 * abs(sin(t * 4.1)));
    },
  };
}

// ── The hauler ──

// The containers' paintwork, all in one: three logo placards and, along the
// bottom, corrugated ribs (grey, so a container's paint shows through).
// CARGO_ROWS are where each band starts and ends on the canvas, top down;
// cargoRegion(i) gives placard i's [v0, v1] in the texture.
const CARGO_ROWS = [0, 170, 340, 470, 512];
const cargoRegion = (i) => [1 - CARGO_ROWS[i + 1] / 512, 1 - CARGO_ROWS[i] / 512];
function cargoTexture() {
  return canvasTexture(512, (g, S) => {
    const font = (px, weight = 900) => `${weight} ${px}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // PLUMBUS: pink letters on cream, a plumbus doodled beside them
    let [y0, y1] = [CARGO_ROWS[0], CARGO_ROWS[1]];
    g.fillStyle = '#efe4cf';
    g.fillRect(0, y0, S, y1 - y0);
    g.strokeStyle = '#c84a7a';
    g.lineWidth = 6;
    g.strokeRect(6, y0 + 6, S - 12, y1 - y0 - 12);
    const cy = (y0 + y1) / 2;
    g.save();
    g.translate(92, cy + 4);
    g.rotate(-0.25);
    // the plumbus doodle: its knobbly pink head, the handle and the base
    g.fillStyle = '#e88aa8';
    g.beginPath();
    g.ellipse(0, -28, 30, 34, 0, 0, PI * 2);
    g.fill();
    g.fillStyle = '#f2a9c0';
    g.beginPath();
    g.ellipse(-8, -36, 12, 14, 0, 0, PI * 2);
    g.fill();
    g.fillStyle = '#d9739a';
    g.fillRect(-9, 0, 18, 46);
    g.beginPath();
    g.ellipse(0, 52, 26, 11, 0, 0, PI * 2);
    g.fill();
    g.fillStyle = '#b3507a';
    g.beginPath();
    g.ellipse(30, -18, 9, 6, 0.6, 0, PI * 2);
    g.ellipse(-28, -12, 8, 6, -0.6, 0, PI * 2);
    g.fill();
    g.strokeStyle = '#7d2d50';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-14, -18);
    g.quadraticCurveTo(0, -6, 14, -20);
    g.stroke();
    g.restore();
    g.fillStyle = '#c3346d';
    g.font = font(78);
    g.fillText('PLUMBUS', 316, cy - 8);
    g.fillStyle = '#6b4a5a';
    g.font = font(22, 700);
    g.fillText('everyone has one', 316, cy + 44);
    // Shleemypants Shipping: cream on navy, with a swoosh
    [y0, y1] = [CARGO_ROWS[1], CARGO_ROWS[2]];
    g.fillStyle = '#1f2d4d';
    g.fillRect(0, y0, S, y1 - y0);
    g.strokeStyle = '#f0b43c';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(30, y1 - 30);
    g.quadraticCurveTo(S / 2, y1 - 2, S - 30, y1 - 44);
    g.stroke();
    g.fillStyle = '#f3ead2';
    g.font = font(56);
    g.fillText('SHLEEMYPANTS', S / 2, y0 + 52);
    g.font = font(40, 800);
    g.fillStyle = '#f0b43c';
    g.fillText('SHIPPING', S / 2, y0 + 104);
    // Blips and Chitz: neon on black
    [y0, y1] = [CARGO_ROWS[2], CARGO_ROWS[3]];
    g.fillStyle = '#120c1c';
    g.fillRect(0, y0, S, y1 - y0);
    g.font = font(54);
    g.lineWidth = 7;
    g.strokeStyle = '#e0328c';
    g.strokeText('BLIPS & CHITZ', S / 2, (y0 + y1) / 2);
    g.fillStyle = '#f7f06a';
    g.fillText('BLIPS & CHITZ', S / 2, (y0 + y1) / 2);
    for (let x = 18; x < S; x += 36) {
      g.fillStyle = x % 72 < 36 ? '#3ce0e6' : '#f7f06a';
      g.fillRect(x, y0 + 10, 12, 6);
      g.fillRect(x + 18, y1 - 16, 12, 6);
    }
    // the ribs
    [y0, y1] = [CARGO_ROWS[3], CARGO_ROWS[4]];
    for (let x = 0; x < S; x += 16) {
      const grad = g.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, grey(150));
      grad.addColorStop(0.3, grey(235));
      grad.addColorStop(0.6, grey(205));
      grad.addColorStop(1, grey(140));
      g.fillStyle = grad;
      g.fillRect(x, y0, 16, y1 - y0);
    }
  });
}

// A shipping container's box, its texture laid on as corrugated ribs
// across every face (the ribs' band is at the bottom of cargoTexture).
function container(w, h, len) {
  const g = new THREE.BoxGeometry(w, h, len);
  const uv = g.attributes.uv;
  const ribs = 34;
  const band = (v) => 0.004 + v * 0.07;
  // faces in BoxGeometry's order: ±x (u along z), ±y (u along x, v along z), ±z (u along x)
  for (let f = 0; f < 6; f++) {
    for (let i = f * 4; i < f * 4 + 4; i++) {
      const [u, v] = [uv.getX(i), uv.getY(i)];
      if (f < 2) uv.setXY(i, u * len * ribs, band(v));
      else if (f < 4) uv.setXY(i, v * len * ribs, band(u));
      else uv.setXY(i, u * w * ribs, band(v));
    }
  }
  return g;
}

// A junky alien cargo hauler, the delivery truck of space: a cab-over cab
// in faded mustard (a big split windscreen, headlights and a grille, a
// light bar and air horns on the roof, mirrors, exhaust stacks behind),
// patched here and there; a long dark chassis with saddle tanks and hover
// pads, carrying three mismatched containers strapped down, each a little
// askew; and behind, a chunky engine with one big nozzle and two odd
// smaller ones, its exhaust flickering and now and then coughing.
function hauler(k) {
  const MUSTARD = '#c09340';
  const RUST = '#9a4a24';
  const CHASSIS = '#433c36';
  const STEEL = '#8d8d88';
  const DARK = '#2a2826';
  const L = [];
  // the cab, lofted: the roof, the windscreen sloping down to the front
  const cab = (z, w, top, c) => ({ z, pts: box8(w, top + 0.095, c, (top - 0.095) / 2) });
  L.push(part(loft([cab(0.27, 0.21, 0.088, 0.026), cab(0.42, 0.21, 0.088, 0.026), cab(0.447, 0.204, 0.074, 0.026), cab(0.478, 0.206, 0.005, 0.022), cab(0.49, 0.2, -0.005, 0.02)]), { color: MUSTARD }));
  // the windscreen in two panes, the pillar between, the visor over it
  const slope = Math.atan2(0.03, 0.069);
  const ws = [0, 0.0405 + 0.0016 * sin(slope), 0.4625 + 0.0016 * cos(slope)];
  for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.074, 0.064, 0.004), { at: [sx * 0.04, ws[1], ws[2]], rot: [-slope, 0, 0], to: 'glass' }));
  L.push(part(new THREE.BoxGeometry(0.008, 0.07, 0.006), { at: ws, rot: [-slope, 0, 0], color: MUSTARD }));
  L.push(part(new THREE.BoxGeometry(0.19, 0.005, 0.034), { at: [0, 0.086, 0.453], rot: [0.12, 0, 0], color: DARK }));
  // the side windows, and a door handle
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.004, 0.05, 0.075), { at: [sx * 0.105, 0.042, 0.39], to: 'glass' }));
    L.push(part(new THREE.BoxGeometry(0.005, 0.006, 0.018), { at: [sx * 0.106, 0.004, 0.36], color: STEEL }));
  }
  // the front: grille, headlights, bumper
  L.push(part(new THREE.BoxGeometry(0.085, 0.045, 0.006), { at: [0, -0.042, 0.49], color: DARK }));
  for (let i = 0; i < 4; i++) L.push(part(new THREE.BoxGeometry(0.08, 0.004, 0.006), { at: [0, -0.058 + i * 0.011, 0.492], color: STEEL }));
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.CylinderGeometry(0.019, 0.021, 0.008, 14), { at: [sx * 0.068, -0.038, 0.491], rot: [PI / 2, 0, 0], color: STEEL }));
    L.push(part(new THREE.CircleGeometry(0.015, 14), { at: [sx * 0.068, -0.038, 0.4955], to: 'glow', color: [2.6, 2.4, 1.8] }));
    L.push(part(new THREE.BoxGeometry(0.018, 0.008, 0.004), { at: [sx * 0.093, -0.012, 0.4915], to: 'glow', color: [3.3, 1.6, 0.3], mark: 'amber' }));
  }
  L.push(part(new THREE.BoxGeometry(0.232, 0.026, 0.03), { at: [0, -0.085, 0.494], color: STEEL }));
  // on the roof: the light bar, the air horns, an antenna and a patch
  L.push(part(new THREE.BoxGeometry(0.13, 0.014, 0.022), { at: [0, 0.096, 0.405], color: DARK }));
  for (const x of [-0.04, 0, 0.04]) L.push(part(new THREE.BoxGeometry(0.026, 0.01, 0.004), { at: [x, 0.097, 0.4165], to: 'glow', color: [3.3, 1.6, 0.3], mark: 'amber' }));
  for (const sx of [-1, 1]) L.push(rod([sx * 0.03, 0.094, 0.36], [sx * 0.034, 0.1, 0.42], 0.004, 0.009, { color: STEEL }, 8));
  L.push(rod([-0.08, 0.088, 0.3], [-0.09, 0.2, 0.27], 0.0025, 0.0015, { color: DARK }, 4));
  L.push(bead(0.006, [-0.09, 0.2, 0.27], 1, { to: 'glow', color: [4.2, 0.5, 0.35], mark: 'beacon' }));
  L.push(part(new THREE.BoxGeometry(0.06, 0.004, 0.05), { at: [0.03, 0.0895, 0.325], rot: [0, 0.1, 0], color: '#6f7d55' }));
  // the mirrors on their arms
  for (const sx of [-1, 1]) {
    L.push(rod([sx * 0.104, 0.03, 0.445], [sx * 0.14, 0.035, 0.452], 0.0025, 0.0025, { color: DARK }, 4));
    L.push(part(new THREE.BoxGeometry(0.008, 0.038, 0.02), { at: [sx * 0.142, 0.032, 0.452], color: DARK }));
  }
  // patches riveted over the rust holes, mismatched
  const patch = (w, h, at, color, side) => {
    L.push(part(new THREE.BoxGeometry(0.003, h, w), { at, color }));
    for (const [dy, dz] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      L.push(part(new THREE.BoxGeometry(0.004, 0.004, 0.004), { at: [at[0] + side * 0.001, at[1] + dy * (h / 2 - 0.005), at[2] + dz * (w / 2 - 0.005)], color: DARK }));
    }
  };
  patch(0.05, 0.04, [-0.1063, -0.035, 0.39], RUST, -1);
  patch(0.045, 0.035, [0.1063, -0.05, 0.3], '#7c7a72', 1);
  patch(0.032, 0.028, [0.1063, 0.015, 0.44], '#5f7486', 1);
  // the exhaust stacks behind the cab
  for (const sx of [-1, 1]) {
    L.push(rod([sx * 0.088, -0.06, 0.256], [sx * 0.088, 0.15, 0.256], 0.011, 0.011, { color: STEEL }, 10));
    L.push(part(new THREE.CylinderGeometry(0.0125, 0.0125, 0.004, 10), { at: [sx * 0.088, 0.152, 0.256], rot: [0.5, 0, 0], color: DARK }));
  }
  // the chassis: two rails, the deck on them, the cross members beneath
  for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.03, 0.035, 0.76), { at: [sx * 0.074, -0.076, -0.07], color: CHASSIS }));
  L.push(part(new THREE.BoxGeometry(0.2, 0.012, 0.64), { at: [0, -0.056, -0.05], color: '#5a5048' }));
  for (const z of [-0.32, -0.17, -0.02, 0.13]) L.push(part(new THREE.BoxGeometry(0.17, 0.018, 0.02), { at: [0, -0.09, z], color: CHASSIS }));
  // amber marker lights along the deck's edges
  for (const sx of [-1, 1]) {
    for (const z of [-0.3, -0.1, 0.1]) L.push(part(new THREE.BoxGeometry(0.004, 0.006, 0.012), { at: [sx * 0.1015, -0.056, z], to: 'glow', color: [3.3, 1.6, 0.3], mark: 'amber' }));
  }
  // the saddle tanks, strapped on
  for (const sx of [-1, 1]) {
    L.push(part(turned([[0.0001, -0.07], [0.02, -0.068], [0.026, -0.06], [0.026, 0.06], [0.02, 0.068], [0.0001, 0.07]], 12), { at: [sx * 0.112, -0.088, 0.16], color: '#b2b4b2' }));
    for (const dz of [-0.035, 0.035]) L.push(part(new THREE.TorusGeometry(0.027, 0.003, 3, 10), { at: [sx * 0.112, -0.088, 0.16 + dz], color: DARK }));
  }
  // the hover pads under it, glowing faintly
  for (const z of [0.38, 0.02, -0.3]) {
    for (const sx of [-1, 1]) {
      L.push(part(new THREE.CylinderGeometry(0.026, 0.03, 0.012, 12), { at: [sx * 0.074, -0.1, z], color: DARK }));
      L.push(part(new THREE.CircleGeometry(0.022, 12), { at: [sx * 0.074, -0.1065, z], rot: [PI / 2, 0, 0], to: 'glow', color: [0.5, 1.5, 1.3] }));
    }
  }

  // the containers: [width, height, length, z of its middle, turn, paint,
  // strap colour, which placard]
  const loads = [
    [0.19, 0.13, 0.175, 0.1475, 0.0, '#d6ccb4', '#d9a521', 0],
    [0.2, 0.155, 0.2, -0.065, 0.04, '#9b3d2a', '#e07a2a', 1],
    [0.18, 0.115, 0.165, -0.275, -0.035, '#3e7063', '#d9a521', 2],
  ];
  for (const [w, h, len, z, turn, paint, strap, sign] of loads) {
    const C = [];
    C.push(part(container(w, h, len), { to: 'cargo', color: paint, uv: 'keep' }));
    // the corner castings
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) C.push(part(new THREE.BoxGeometry(0.014, 0.014, 0.014), { at: [sx * (w / 2 - 0.005), sy * (h / 2 - 0.005), sz * (len / 2 - 0.005)], color: DARK }));
      }
    }
    // the placard on each side, between the straps
    const pw = len * 0.68;
    const [v0, v1] = cargoRegion(sign);
    const aspect = 512 / (CARGO_ROWS[sign + 1] - CARGO_ROWS[sign]);
    const ph = pw / aspect;
    for (const sx of [-1, 1]) {
      const uv = (x, y, zz) => [sx > 0 ? (pw / 2 - zz) / pw : (zz + pw / 2) / pw, v0 + ((y + ph / 2) / ph) * (v1 - v0)];
      C.push(part(new THREE.PlaneGeometry(pw, ph), { at: [sx * (w / 2 + 0.0012), 0.004, 0], rot: [0, (sx * PI) / 2, 0], to: 'cargo', uv }));
    }
    // two straps over it, ratchets on one side
    for (const sz of [-1, 1]) {
      const zz = sz * len * 0.42;
      C.push(part(new THREE.BoxGeometry(w + 0.008, 0.004, 0.013), { at: [0, h / 2 + 0.002, zz], color: strap }));
      for (const sx of [-1, 1]) C.push(part(new THREE.BoxGeometry(0.004, h + 0.004, 0.013), { at: [sx * (w / 2 + 0.002), 0.002, zz], color: strap }));
      C.push(part(new THREE.BoxGeometry(0.008, 0.02, 0.018), { at: [w / 2 + 0.005, -h * 0.2, zz], color: STEEL }));
    }
    L.push(...place(C, [0, -0.05 + h / 2, z], [0, turn, 0]));
  }
  // the lock bars on the back container's doors
  for (const x of [-0.05, -0.02, 0.02, 0.05]) L.push(rod([x, -0.045, -0.36], [x, 0.06, -0.36], 0.0025, 0.0025, { color: '#2c4a42' }, 4));

  // the engine: a block with cooling fins and a patched-on box on top, a big
  // nozzle and two odd small ones, the tail lights
  L.push(
    part(
      loft([
        { z: -0.448, pts: box8(0.15, 0.1, 0.025, -0.025) },
        { z: -0.432, pts: box8(0.18, 0.12, 0.03, -0.025) },
        { z: -0.36, pts: box8(0.19, 0.13, 0.03, -0.025) },
        { z: -0.35, pts: box8(0.175, 0.115, 0.03, -0.025) },
      ]),
      { color: '#5a534b' },
    ),
  );
  for (let i = 0; i < 5; i++) L.push(part(new THREE.BoxGeometry(0.004, 0.018, 0.06), { at: [-0.05 + i * 0.025, 0.048, -0.4], color: STEEL }));
  L.push(part(new THREE.BoxGeometry(0.05, 0.028, 0.04), { at: [0.055, 0.035, -0.385], rot: [0, 0.2, 0], color: RUST }));
  const nozzle = (r, len) => turned([[r * 0.7, 0.002], [r * 0.8, -len * 0.4], [r, -len], [r * 0.88, -len - 0.003], [r * 0.6, -len * 0.5], [r * 0.5, 0.0]], 12);
  L.push(part(nozzle(0.05, 0.055), { at: [0, -0.035, -0.445], color: '#3a3532' }));
  L.push(part(new THREE.CircleGeometry(0.03, 14), { at: [0, -0.035, -0.47], rot: [0, PI, 0], to: 'glow', color: [3.7, 1.4, 0.26], mark: 'jet' }));
  L.push(part(new THREE.ConeGeometry(0.034, 0.065, 12, 1, true), { at: [0, -0.035, -0.53], rot: [-PI / 2, 0, 0], to: 'glow', color: [2.8, 0.85, 0.15], mark: 'jet' }));
  for (const [x, y, r, len] of [
    [0.07, 0.02, 0.019, 0.03],
    [-0.066, 0.026, 0.014, 0.045],
  ]) {
    L.push(part(nozzle(r, len), { at: [x, y, -0.444], color: x > 0 ? STEEL : RUST }));
    L.push(part(new THREE.CircleGeometry(r * 0.6, 10), { at: [x, y, -0.444 - len * 0.5], rot: [0, PI, 0], to: 'glow', color: [3.4, 1.4, 0.32], mark: 'jet' }));
  }
  for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.022, 0.012, 0.004), { at: [sx * 0.058, 0.004, -0.4485], to: 'glow', color: [3.8, 0.35, 0.25], mark: 'tail' }));

  const paint = standard(k, { map: k.own(rustTexture(k.rand)), metalness: 0.35, roughness: 0.62 });
  paint.userData.density = 3.5;
  const cargo = standard(k, { map: k.own(cargoTexture()), metalness: 0.25, roughness: 0.6 });
  const mats = {
    paint,
    cargo,
    glass: standard(k, { color: '#1a2a2c', metalness: 0.9, roughness: 0.1 }),
    glow: glowMaterial(k),
  };
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      // the exhaust: flickering, and now and then a cough
      const cough = sin(t * 1.7) + sin(t * 4.3 + 1) > 1.75;
      blink('jet', cough ? 0.25 : Math.round(flicker(t * 1.6, 7) * 10) / 10);
      blink('amber', pulse(t, 1.1, 0, 0.5) ? 1 : 0.3);
      blink('beacon', pulse(t, 1.7, 0.3, 0.1) ? 1 : 0.1);
      blink('tail', cough ? 1.3 : 0.8);
    },
  };
}

// ── The gear ship ──

// A Gear People ship, from Gearworld: its body one great brass gear, flat,
// with bold teeth and five windows between its spokes, turning slowly on
// the hub; in the hub the cockpit, a steel drum with a porthole forward and
// two lamps beside it, under a brass dome ringed with teeth of its own (a
// lamp on a spire on top); behind it, on girders reaching back over the
// big gear, three little gears meshing (brass, steel and copper), the two
// small ones turning against the middle one; a thruster at the end of the
// middle girder and two under the keel, glowing amber.
function gearship(k) {
  const BRASS = '#dbb55c';
  const BRONZE = '#a8743c';
  const COPPER = '#b8673e';
  const STEEL = '#8e959d';
  const DECK = '#6c737b';
  const DARK = '#3b3a38';
  const AMBER = [3.2, 1.5, 0.36];
  const big = [];
  // the great gear, centred on the axis it turns about: the toothed plate,
  // a raised rim inside the teeth, the hub ring, rivets round the rim
  big.push(part(plateXZ(gearOutline(0.413, 0.462, 18), 0.04, 0, spokeHoles(5, 0.15, 0.335, 0.075)), { to: 'gear', color: BRASS }));
  big.push(part(plateXZ(circle(0.4, 32), 0.052, 0, [circle(0.352, 32)]), { to: 'gear', color: BRONZE }));
  big.push(part(plateXZ(circle(0.165, 24), 0.056, 0, [circle(0.08, 16)]), { to: 'gear', color: BRONZE }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2 + 0.2;
    big.push(part(new THREE.BoxGeometry(0.011, 0.006, 0.011), { at: [0.376 * cos(a), 0.027, 0.376 * sin(a)], rot: [0, -a, 0], to: 'gear', color: STEEL }));
  }

  const L = [];
  // the axle column through the middle, and the keel under it
  L.push(part(new THREE.CylinderGeometry(0.078, 0.078, 0.1, 16, 1, true), { at: [0, -0.005, 0], color: STEEL }));
  L.push(part(upright([[0.0001, -0.13], [0.045, -0.128], [0.095, -0.105], [0.115, -0.065], [0.11, -0.032]], 16), { color: STEEL }));
  L.push(part(upright([[0.116, -0.062], [0.121, -0.052], [0.115, -0.042]], 16), { color: BRONZE }));
  // the little gears' layout: [teeth, x, z]; the pitch is the same for
  // all (so they mesh), each one's radius following from its teeth
  const pitch = 0.05;
  const radius = (n) => (n * pitch) / (PI * 2);
  const g1 = [14, 0, -0.235];
  const meshAt = (from, n, ang) => {
    const d = radius(from[0]) + radius(n);
    return [n, from[1] + d * cos(ang), from[2] + d * sin(ang)];
  };
  const g2 = meshAt(g1, 9, -0.6);
  const g3 = meshAt(g1, 9, PI + 0.6);
  // what holds them above the turning gear: a round plate under the
  // cockpit (a bronze lip under it), and girders reaching back from it to a
  // pedestal under each little gear (the middle one on to the thruster)
  const deckY = 0.046;
  L.push(part(plateXZ(circle(0.15, 24), 0.014), { at: [0, deckY, 0], color: DECK }));
  L.push(part(plateXZ(circle(0.158, 24), 0.006), { at: [0, deckY - 0.008, 0], color: BRONZE }));
  // a girder from a to b, both (x, z): a bronze bar with a dark channel down it
  const girder = (a, b, w) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const rot = [0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0];
    L.push(part(new THREE.BoxGeometry(w, 0.012, len), { at: [mid[0], deckY, mid[1]], rot, color: BRONZE }));
    L.push(part(new THREE.BoxGeometry(w * 0.45, 0.014, len - 0.02), { at: [mid[0], deckY + 0.002, mid[1]], rot, color: DARK }));
  };
  girder([0, -0.12], [0, -0.38], 0.04);
  for (const g of [g2, g3]) girder([g[1] * 0.45, -0.1], [g[1], g[2]], 0.034);
  for (const g of [g1, g2, g3]) {
    L.push(part(new THREE.CylinderGeometry(radius(g[0]) * 0.55, radius(g[0]) * 0.6, 0.014, 14), { at: [g[1], deckY + 0.001, g[2]], color: DECK }));
  }
  // the cockpit: the drum, the toothed ring and the dome on it, the dome's
  // ribs, and the spire with its lamp
  L.push(part(new THREE.CylinderGeometry(0.11, 0.112, 0.085, 20, 1, true), { at: [0, deckY + 0.05, 0.02], color: STEEL }));
  L.push(part(plateXZ(gearOutline(0.112, 0.128, 16, 0.1), 0.018), { at: [0, deckY + 0.094, 0.02], color: BRONZE }));
  const dome = [];
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (PI / 2);
    dome.push([0.108 * cos(a), 0.065 * sin(a)]);
  }
  L.push(part(upright(dome, 20), { at: [0, deckY + 0.1, 0.02], color: BRASS }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    L.push(part(new THREE.BoxGeometry(0.006, 0.004, 0.09), { at: [0.055 * sin(a), deckY + 0.151, 0.02 + 0.055 * cos(a)], rot: [-0.62 * cos(a), a, 0], color: BRONZE }));
  }
  L.push(rod([0, deckY + 0.16, 0.02], [0, deckY + 0.215, 0.02], 0.005, 0.003, { color: DARK }, 5));
  L.push(bead(0.009, [0, deckY + 0.22, 0.02], 1, { to: 'glow', color: AMBER, mark: 'spire' }));
  // the porthole forward: its brass ring and bolts, the glass, the lamps
  const port = [0, deckY + 0.052, 0.13];
  L.push(part(new THREE.TorusGeometry(0.04, 0.009, 4, 14), { at: port, color: BRASS }));
  L.push(part(new THREE.CircleGeometry(0.04, 18), { at: [port[0], port[1], port[2] - 0.002], to: 'glass' }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    L.push(part(new THREE.BoxGeometry(0.006, 0.006, 0.006), { at: [port[0] + 0.04 * cos(a), port[1] + 0.04 * sin(a), port[2] + 0.009], rot: [0, 0, a], color: BRONZE }));
  }
  for (const sx of [-1, 1]) {
    const at = [sx * 0.075, deckY + 0.035, 0.1];
    L.push(part(turned([[0.0001, -0.018], [0.014, -0.014], [0.016, 0.0], [0.014, 0.002]], 10), { at, rot: [0, sx * 0.6, 0], color: BRASS }));
    L.push(part(new THREE.CircleGeometry(0.012, 10), { at: [at[0] + sx * 0.0013, at[1], at[2] + 0.0025], rot: [0, sx * 0.6, 0], to: 'glow', color: [2.9, 2.4, 1.3] }));
  }
  // the thruster at the end of the middle girder, and the two under the keel
  const nozzle = (r, len, seg = 12) => turned([[r * 0.75, 0.0], [r, -len * 0.3], [r * 1.25, -len], [r * 1.1, -len - 0.004], [r * 0.7, -len * 0.4], [r * 0.6, 0.002]], seg);
  const jet = [0, deckY + 0.032, -0.39];
  L.push(part(new THREE.CylinderGeometry(0.03, 0.034, 0.06, 12), { at: jet, rot: [PI / 2, 0, 0], color: BRONZE }));
  L.push(part(nozzle(0.03, 0.05), { at: [jet[0], jet[1], jet[2] - 0.03], color: BRASS }));
  L.push(part(new THREE.CircleGeometry(0.026, 12), { at: [jet[0], jet[1], jet[2] - 0.06], rot: [0, PI, 0], to: 'glow', color: AMBER, mark: 'jet' }));
  L.push(part(new THREE.ConeGeometry(0.03, 0.05, 12, 1, true), { at: [jet[0], jet[1], jet[2] - 0.105], rot: [-PI / 2, 0, 0], to: 'glow', color: [2.5, 1.05, 0.25], mark: 'jet' }));
  for (const sx of [-1, 1]) {
    L.push(part(nozzle(0.022, 0.06, 8), { at: [sx * 0.05, -0.085, -0.09], color: BRASS }));
    L.push(part(new THREE.CircleGeometry(0.02, 8), { at: [sx * 0.05, -0.085, -0.13], rot: [0, PI, 0], to: 'glow', color: AMBER, mark: 'jet' }));
  }
  // amber lamps on the plate's edge and along the girders
  for (const [x, z] of [
    [0.13, -0.075],
    [-0.13, -0.075],
    [g2[1] * 0.72, (g2[2] - 0.1) / 2],
    [g3[1] * 0.72, (g3[2] - 0.1) / 2],
  ]) {
    L.push(bead(0.008, [x, deckY + 0.011, z], 1, { to: 'glow', color: AMBER, mark: 'lamps' }));
  }

  // the little gears
  const cogs = [];
  const gy = deckY + 0.016;
  const cog = ([n, x, z], color, mark, phase) => {
    const r = radius(n);
    cogs.push(part(plateXZ(gearOutline(r - 0.009, r + 0.008, n, phase), 0.02, 0, [circle(r * 0.3, 8)]), { at: [x, gy, z], to: 'cogs', color, mark }));
    for (let i = 0; i < 3; i++) {
      const a = phase + (i / 3) * PI * 2 + PI / 3;
      cogs.push(part(new THREE.BoxGeometry(r * 0.22, 0.023, r * 0.22), { at: [x + r * 0.55 * cos(a), gy, z + r * 0.55 * sin(a)], rot: [0, -a, 0], to: 'cogs', color: DARK, mark }));
    }
    L.push(part(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.036, 8), { at: [x, gy + 0.004, z], color: STEEL }));
  };
  // each small one turned so its teeth fall in the big one's gaps where
  // they meet: if the big one is a fraction f of a tooth past pointing at
  // it, the small one is half a tooth less f past pointing back
  const facing = (phase, n, ang, n2) => {
    const f = ((((ang - phase) / ((PI * 2) / n)) % 1) + 1) % 1;
    return ang + PI - (0.5 - f) * ((PI * 2) / n2);
  };
  cog(g1, BRASS, 'g1', -0.6);
  cog(g2, STEEL, 'g2', facing(-0.6, g1[0], -0.6, g2[0]));
  cog(g3, COPPER, 'g3', facing(-0.6, g1[0], PI + 0.6, g3[0]));

  // worked brass: fine brushed streaks and the odd soft dent
  const hammered = canvasTexture(128, (g, S) => {
    g.fillStyle = grey(224);
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y++) {
      g.fillStyle = `rgba(${k.rand() < 0.5 ? '255,250,235' : '70,55,30'},${0.03 + k.rand() * 0.05})`;
      g.fillRect(0, y, S, 1);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(60,45,25,${0.03 + k.rand() * 0.05})`;
      g.beginPath();
      g.arc(k.rand() * S, k.rand() * S, 2 + k.rand() * 4, 0, PI * 2);
      g.fill();
    }
  });
  const metal = standard(k, { map: k.own(hammered), metalness: 0.35, roughness: 0.4 });
  metal.userData.density = 5;
  const mats = {
    gear: metal,
    cogs: metal,
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 226, spread: 10, seam: 0.65, detail: 0.3, min: 12 })), metalness: 0.35, roughness: 0.42 }),
    glass: standard(k, { color: '#2a4a52', metalness: 0.9, roughness: 0.06, emissive: '#3a2a10', emissiveIntensity: 0.6 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 5;
  const M = meshes(k, [...big, ...cogs, ...L], mats);
  const turn = turner(M.cogs.geometry);
  M.cogs.frustumCulled = false;
  const blink = blinker(M.glow.geometry);
  const ratio = g1[0] / g2[0];
  return {
    root: Object.values(M),
    update(t) {
      M.gear.rotation.y = -t * 0.35;
      const a = t * 0.9;
      turn('g1', a, g1[1], g1[2]);
      turn('g2', -a * ratio, g2[1], g2[2]);
      turn('g3', -a * ratio, g3[1], g3[2]);
      blink('jet', Math.round(flicker(t, 9) * 20) / 20);
      blink('spire', pulse(t, 2, 0, 0.12) ? 1 : 0.2);
      blink('lamps', Math.round((0.75 + 0.25 * sin(t * 3)) * 10) / 10);
    },
  };
}

// ── The Council of Ricks hunter ──

// The Council of Ricks' emblem: a stylised Rick (long face, spiky hair, the
// unibrow) in a teal ring lettered round with the Council's name.
function emblemTexture() {
  return canvasTexture(256, (g, S) => {
    const c = S / 2;
    g.fillStyle = '#e9eef0';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#17a89c';
    g.beginPath();
    g.arc(c, c, 126, 0, PI * 2);
    g.fill();
    g.fillStyle = '#f2f6f7';
    g.beginPath();
    g.arc(c, c, 92, 0, PI * 2);
    g.fill();
    g.strokeStyle = '#0d5c56';
    g.lineWidth = 4;
    g.stroke();
    // the lettering round the ring
    g.fillStyle = '#ffffff';
    g.font = '700 20px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const words = 'COUNCIL • OF • RICKS • ';
    const chars = [...words, ...words];
    chars.forEach((ch, i) => {
      const a = (i / chars.length) * PI * 2 - PI / 2;
      g.save();
      g.translate(c + 109 * cos(a), c + 109 * sin(a));
      g.rotate(a + PI / 2);
      g.fillText(ch, 0, 0);
      g.restore();
    });
    // Rick: the hair first, spikes fanned up and out round the crown
    g.fillStyle = '#9fc2d9';
    g.strokeStyle = '#1d3a4a';
    g.lineWidth = 4;
    g.beginPath();
    const hx = c;
    const hy = c - 6;
    const spikes = 9;
    for (let i = 0; i <= spikes; i++) {
      const a = PI + (i / spikes) * PI;
      const r = i % 2 ? 46 : 78;
      const x = hx + r * cos(a) * 1.05;
      const y = hy + r * sin(a) * 0.95;
      if (i === 0) g.moveTo(x, y + 10);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    g.stroke();
    // the face, long, and its features
    g.fillStyle = '#e8d6c0';
    g.beginPath();
    g.ellipse(hx, hy + 18, 38, 52, 0, 0, PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffffff';
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.arc(hx + sx * 15, hy + 6, 11, 0, PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#1d2a33';
      g.beginPath();
      g.arc(hx + sx * 15, hy + 6, 3.5, 0, PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
    }
    g.strokeStyle = '#7fa6c0';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(hx - 30, hy - 10);
    g.quadraticCurveTo(hx, hy - 2, hx + 30, hy - 10);
    g.stroke();
    g.strokeStyle = '#1d3a4a';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(hx - 18, hy + 46);
    g.quadraticCurveTo(hx, hy + 40, hx + 18, hy + 46);
    g.stroke();
  });
}

// A Council of Ricks hunter: a Rick's space cruiser, but the Council's: the
// same saucer-car (a deep lens of a hull, the glass dome over the seats with
// its arch, an exhaust can each side at the back glowing green, headlights
// on stalks at the nose, a little fin behind) in Citadel white and silver
// with teal seams and rim band; the Council's emblem on a badge on each
// flank and on the foredeck; at the wheel a Rick in a white lab coat with
// spiky blue-grey hair; twin blasters under the nose, and on the arch over
// the dome the hunter light, flashing red and teal.
function councilship(k) {
  const WHITE = '#e8edf0';
  const SILVER = '#b4bdc5';
  const TEAL = '#1cb3a6';
  const DARK = '#2b3238';
  const COAT = '#f1f4f5';
  const SKIN = '#e3cfb6';
  const HAIR = '#a6c3d6';
  const L = [];
  const ZS = 1.08; // a little longer than it's wide
  const hull = { scale: [1, 1, ZS] };
  // the hull, turned: the deep underside, the teal rim band, the deck up to
  // the dome's ring
  const lower = [[0.0001, -0.15], [0.12, -0.145], [0.22, -0.116], [0.3, -0.077], [0.36, -0.04], [0.4, -0.012], [0.418, 0.0]];
  const upper = [[0.418, 0.024], [0.38, 0.042], [0.32, 0.066], [0.26, 0.088], [0.222, 0.1]];
  const SEG = 32;
  L.push(part(upright(lower, SEG), { ...hull, color: WHITE }));
  L.push(part(upright([[0.413, -0.004], [0.43, 0.002], [0.43, 0.022], [0.413, 0.028]], SEG), { ...hull, color: TEAL }));
  L.push(part(upright(upper, SEG), { ...hull, color: WHITE }));
  L.push(part(upright([[0.228, 0.096], [0.228, 0.112], [0.206, 0.117]], SEG), { ...hull, color: SILVER }));
  L.push(part(new THREE.CircleGeometry(0.21, 24), { at: [0, 0.111, 0], rot: [-PI / 2, 0, 0], scale: [1, ZS, 1], color: DARK }));
  // the teal seams, radiating over the deck and under the hull
  const along = (prof, r) => {
    for (let i = 0; i < prof.length - 1; i++) {
      const [ra, ya] = prof[i];
      const [rb, yb] = prof[i + 1];
      if ((r - ra) * (r - rb) <= 0) return ya + ((r - ra) / (rb - ra || 1)) * (yb - ya);
    }
    return prof.at(-1)[1];
  };
  const onHull = (prof, r, a, lift) => [r * sin(a), along(prof, r) + lift, r * cos(a) * ZS];
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * PI * 2;
    L.push(rod(onHull(upper, 0.235, a, 0.002), onHull(upper, 0.405, a, 0.002), 0.006, 0.006, { color: TEAL }, 3));
    L.push(rod(onHull(lower, 0.17, a, -0.003), onHull(lower, 0.3, a, -0.003), 0.006, 0.006, { color: TEAL }, 3));
    L.push(rod(onHull(lower, 0.3, a, -0.003), onHull(lower, 0.405, a, -0.003), 0.006, 0.006, { color: TEAL }, 3));
  }
  // the dome, its arch, and the hunter light on top
  const domeY = 0.113;
  const domeR = 0.212;
  L.push(part(new THREE.SphereGeometry(domeR, 24, 8, 0, PI * 2, 0, PI / 2), { at: [0, domeY, 0], scale: [1, 0.95, ZS], to: 'glass' }));
  L.push(...place([part(new THREE.TorusGeometry(domeR + 0.004, 0.0075, 4, 18, PI), { rot: [0, PI / 2, 0], color: SILVER })], [0, domeY, 0], undefined, [1, 0.95, ZS]));
  const topY = domeY + (domeR + 0.004) * 0.95;
  L.push(part(new THREE.BoxGeometry(0.07, 0.016, 0.03), { at: [0, topY + 0.008, 0], color: SILVER }));
  L.push(part(new THREE.BoxGeometry(0.012, 0.022, 0.032), { at: [0, topY + 0.013, 0], color: DARK }));
  for (const [sx, color, mark] of [
    [-1, [6, 0.45, 0.35], 'red'],
    [1, [0.3, 2.5, 2.25], 'teal'],
  ]) {
    L.push(part(new THREE.SphereGeometry(0.014, 10, 4, 0, PI * 2, 0, PI / 2), { at: [sx * 0.021, topY + 0.015, 0], scale: [1, 1.1, 0.9], to: 'glow', color, mark }));
  }
  // inside: the seats, the dashboard with its screen, the wheel
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.075, 0.022, 0.075), { at: [sx * 0.072, domeY + 0.016, -0.03], color: '#1f4f57' }));
    L.push(part(new THREE.BoxGeometry(0.075, 0.1, 0.02), { at: [sx * 0.072, domeY + 0.07, -0.078], rot: [-0.18, 0, 0], color: '#1f4f57' }));
  }
  L.push(part(new THREE.BoxGeometry(0.26, 0.034, 0.05), { at: [0, domeY + 0.022, 0.15], rot: [-0.35, 0, 0], color: DARK }));
  L.push(part(new THREE.BoxGeometry(0.06, 0.003, 0.03), { at: [-0.06, domeY + 0.04, 0.143], rot: [-0.35, 0, 0], to: 'glow', color: [0.4, 2.0, 1.9] }));
  const wheel = [0.072, domeY + 0.075, 0.09];
  L.push(part(new THREE.TorusGeometry(0.026, 0.0045, 4, 12), { at: wheel, rot: [-0.85, 0, 0], color: DARK }));
  L.push(rod(wheel, [0.072, domeY + 0.04, 0.14], 0.004, 0.004, { color: DARK }, 5));
  // the Rick at the wheel: lab coat, the blue shirt at its neck, his head
  // and his spiky blue-grey hair, hands on the wheel
  const rx = 0.072;
  const rz = -0.035;
  const sy = domeY + 0.027;
  L.push(part(upright([[0.032, 0], [0.036, 0.03], [0.034, 0.06], [0.027, 0.078], [0.012, 0.086]], 10), { at: [rx, sy, rz], scale: [1, 1, 0.8], color: COAT }));
  L.push(part(new THREE.BoxGeometry(0.018, 0.05, 0.004), { at: [rx, sy + 0.055, rz + 0.026], rot: [-0.12, 0, 0], color: '#8cc8e6' }));
  L.push(rod([rx, sy + 0.08, rz], [rx, sy + 0.1, rz + 0.004], 0.009, 0.009, { color: SKIN }, 6));
  const head = [rx, sy + 0.122, rz + 0.006];
  L.push(bead(0.026, head, [0.9, 1.15, 0.95], { color: SKIN }, 10, 7));
  for (const sx of [-1, 1]) {
    L.push(bead(0.0075, [head[0] + sx * 0.0095, head[1] + 0.006, head[2] + 0.022], 1, { color: '#ffffff' }));
    L.push(bead(0.0032, [head[0] + sx * 0.0095, head[1] + 0.006, head[2] + 0.029], 1, { color: '#111111' }, 4, 3));
  }
  L.push(part(new THREE.BoxGeometry(0.03, 0.004, 0.006), { at: [head[0], head[1] + 0.016, head[2] + 0.023], color: '#7fa0b6' }));
  for (const [dx, dy, dz] of [
    [0, 1, -0.35],
    [0.55, 0.75, -0.4],
    [-0.55, 0.75, -0.4],
    [0.85, 0.25, -0.45],
    [-0.85, 0.25, -0.45],
    [0.35, 0.35, -0.85],
    [-0.35, 0.35, -0.85],
    [0, 0.6, -0.8],
  ]) {
    const n = Math.hypot(dx, dy, dz);
    const d = [dx / n, dy / n, dz / n];
    const base = [head[0] + d[0] * 0.012, head[1] + d[1] * 0.016, head[2] + d[2] * 0.012];
    const tip = [head[0] + d[0] * 0.055, head[1] + d[1] * 0.058, head[2] + d[2] * 0.05];
    L.push(between(new THREE.ConeGeometry(0.014, 1, 5), base, tip, { color: HAIR }));
  }
  for (const sx of [-1, 1]) {
    const sh = [rx + sx * 0.03, sy + 0.07, rz];
    const hand = [wheel[0] + sx * 0.022, wheel[1] + 0.008, wheel[2] - 0.004];
    const el = [rx + sx * 0.04, sy + 0.035, rz + 0.05];
    L.push(rod(sh, el, 0.0085, 0.0075, { color: COAT }, 5), rod(el, hand, 0.0075, 0.007, { color: COAT }, 5));
    L.push(bead(0.0075, hand, 1, { color: SKIN }));
  }
  // the exhaust cans at the back, on their pipes, glowing green
  for (const sx of [-1, 1]) {
    const at = [sx * 0.27, 0.078, -0.33];
    L.push(part(turned([[0.04, -0.125], [0.05, -0.12], [0.053, -0.105], [0.053, 0.035], [0.046, 0.05], [0.0001, 0.054]], 12), { at, color: SILVER }));
    L.push(part(turned([[0.0545, -0.07], [0.0545, -0.045]], 12), { at, color: TEAL }));
    L.push(part(new THREE.CircleGeometry(0.04, 14), { at: [at[0], at[1], at[2] - 0.115], rot: [0, PI, 0], to: 'glow', color: [0.7, 2.6, 0.45] }));
    L.push(part(new THREE.ConeGeometry(0.035, 0.075, 14, 1, true), { at: [at[0], at[1], at[2] - 0.155], rot: [-PI / 2, 0, 0], to: 'glow', color: [0.45, 1.9, 0.3] }));
    L.push(rod([sx * 0.19, 0.075, -0.2], [sx * 0.235, 0.082, -0.26], 0.014, 0.014, { color: SILVER }, 6));
    L.push(rod([sx * 0.235, 0.082, -0.26], [at[0], at[1], at[2] + 0.05], 0.014, 0.014, { color: SILVER }, 6));
    L.push(rod([sx * 0.3, 0.025, -0.31], [sx * 0.275, 0.05, -0.33], 0.009, 0.009, { color: DARK }, 6));
  }
  // the headlights on their stalks
  for (const sx of [-1, 1]) {
    const at = [sx * 0.135, 0.084, 0.388];
    L.push(rod([sx * 0.128, 0.04, 0.36], [at[0], at[1], at[2] - 0.022], 0.007, 0.006, { color: DARK }, 6));
    L.push(part(turned([[0.0001, -0.03], [0.022, -0.022], [0.03, -0.004], [0.031, 0.002], [0.026, 0.004]], 14), { at, rot: [0.1, 0, 0], color: SILVER }));
    L.push(part(turned([[0.031, -0.01], [0.032, -0.002]], 14), { at, rot: [0.1, 0, 0], color: TEAL }));
    L.push(part(new THREE.CircleGeometry(0.026, 14), { at: [at[0], at[1] - 0.0002, at[2] + 0.002], rot: [0.1, 0, 0], to: 'glow', color: [2.6, 2.35, 1.6] }));
  }
  // the little fin behind the dome
  L.push(part(plateZY([[-0.25, 0], [-0.38, 0], [-0.44, 0.115], [-0.4, 0.12]], 0.014, 0.004), { at: [0, 0.042, 0], color: TEAL }));
  // twin blasters under the nose
  for (const sx of [-1, 1]) {
    L.push(rod([sx * 0.05, -0.04, 0.33], [sx * 0.05, -0.04, 0.43], 0.008, 0.008, { color: DARK }, 6));
    L.push(rod([sx * 0.05, -0.04, 0.43], [sx * 0.05, -0.04, 0.46], 0.004, 0.004, { color: DARK }, 6));
    L.push(bead(0.004, [sx * 0.05, -0.04, 0.462], 1, { to: 'glow', color: [0.4, 2.6, 2.4] }));
  }
  // the Council's emblem: a badge on each flank, and one on the foredeck
  const D = [];
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.CylinderGeometry(0.052, 0.052, 0.008, 18), { at: [sx * 0.43, 0.012, 0], rot: [0, 0, PI / 2], color: SILVER }));
    D.push(part(new THREE.CircleGeometry(0.046, 20), { at: [sx * 0.4345, 0.012, 0], rot: [0, (sx * PI) / 2, 0], to: 'decal', uv: 'keep' }));
  }
  const tilt = 0.35;
  D.push(part(new THREE.CircleGeometry(0.05, 28), { at: [0, along(upper, 0.3) + 0.004, 0.3 * ZS], rot: [-(PI / 2 - tilt), 0, 0], to: 'decal', uv: 'keep' }));

  const paint = standard(k, { map: k.own(panelTexture(k.rand, { base: 230, spread: 7, seam: 0.74, detail: 0.15, min: 18 })), metalness: 0.15, roughness: 0.55 });
  paint.userData.density = 5;
  const mats = {
    paint,
    decal: standard(k, { map: k.own(emblemTexture()), metalness: 0.2, roughness: 0.35 }),
    glass: bubble(k, '#c8f2f0', 0.22),
    glow: glowMaterial(k),
  };
  const M = meshes(k, [...L, ...D], mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 11));
      // the hunter light: red, red, teal, teal, round again
      const ph = (t * 2.4) % 1;
      blink('red', ph < 0.12 || (ph > 0.22 && ph < 0.34) ? 1.2 : 0.12);
      blink('teal', (ph > 0.5 && ph < 0.62) || (ph > 0.72 && ph < 0.84) ? 1.2 : 0.12);
    },
  };
}

export const FLEET = { saucer, hauler, gearship, councilship, ...FOES, ...FRIENDS };
