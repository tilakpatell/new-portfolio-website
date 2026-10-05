// Space traffic for the universe map: the craft (and a few travellers) that
// cross the map on their own business, from the universe of whichever crew
// the visitor flies with. Star Wars brings TIE fighters and interceptors,
// X-wings, a Lambda shuttle and a Star Destroyer; Rick and Morty brings the
// Galactic Federation's patrol fighters and a cruiser, a Gromflomite on the
// wing, a Mr. Meeseeks floating by (waving) and Birdperson (flapping).
//
// Each is built here from authored shapes: plates cut to an outline and
// extruded (wings, panels, fins), parts turned on a lathe (cockpits, engines,
// domes), hulls lofted through cross-sections, painted with small canvas
// textures (panel lines, solar cells, feathers). Parts that share a material
// are merged into one mesh, with their colours in the vertices, so a model is
// at most four draws.
//
// buildTraffic(kind) → { group, length, size, update(t), dispose() }
// Every model points its nose along +z with +y up, sits centred on its own
// bounding box and is exactly 1 long in z (`size` is its whole box, after
// that), so group.lookAt(target) points it the way it flies and the caller
// scales it to taste.

import * as THREE from 'three';
import { FLEET as STARWARS_FLEET } from './fleetStarwars';
import { FLEET as RICKMORTY_FLEET } from './fleetRickmorty';
import { part, place, mirror, rod, bake, meshes, blinker, flapper, loft, box8, trap8, hex6, scaled, plateXZ, plateZY, turned, upright, ball, inset, canvasTexture, grey, panelTexture, solarTexture, standard, glowMaterial, flicker, pulse } from './trafficKit';

export const TRAFFIC = {
  starwars: ['tie', 'interceptor', 'xwing', 'shuttle', 'destroyer'],
  rickmorty: ['patrol', 'federation', 'gromflomite', 'meeseeks', 'birdperson'],
};

const { PI, sin, cos, atan2, hypot } = Math;

// ── Star Wars ──

const TIE_GREY = '#868f9b';
const TIE_DARK = '#5f6773';

// A TIE's ball cockpit, R across: a sphere with its front cut away for the
// round window (an octagonal hub in the middle, eight spokes out to the rim),
// a hatch on top, collars where the pylons meet it and the twin ion engines'
// vents at the back.
function tieCockpit(R) {
  const L = [];
  const top = Math.asin(0.76);
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const a = -PI / 2 + (i / 12) * (top + PI / 2);
    prof.push([R * cos(a), R * sin(a)]);
  }
  const rim = R * cos(top);
  prof.push([rim * 1.02, R * 0.8], [rim * 0.88, R * 0.83], [rim * 0.84, R * 0.77]);
  L.push(part(turned(prof, 28), { color: TIE_GREY }));
  const zw = R * 0.77;
  L.push(part(new THREE.CircleGeometry(rim * 0.86, 28), { at: [0, 0, zw], to: 'glass' }));
  L.push(part(turned([[rim * 0.3, zw - 0.002], [rim * 0.3, zw + R * 0.06], [rim * 0.19, zw + R * 0.06], [rim * 0.19, zw - 0.002]], 8), { color: TIE_GREY }));
  for (let i = 0; i < 8; i++) {
    const a = (i * PI) / 4;
    const r = rim * 0.58;
    L.push(part(new THREE.BoxGeometry(R * 0.05, rim * 0.56, R * 0.05), { at: [-sin(a) * r, cos(a) * r, zw + R * 0.03], rot: [0, 0, a], color: TIE_GREY }));
  }
  // the hatch on top, tipped back with the sphere
  L.push(part(new THREE.CylinderGeometry(R * 0.33, R * 0.38, R * 0.14, 16), { at: [0, R * 0.95, -R * 0.24], rot: [-0.25, 0, 0], color: TIE_DARK }));
  L.push(part(new THREE.CylinderGeometry(R * 0.2, R * 0.24, R * 0.1, 12), { at: [0, R * 1.03, -R * 0.26], rot: [-0.25, 0, 0], color: TIE_GREY }));
  // the pylons' collars
  for (const sx of [-1, 1]) L.push(part(new THREE.CylinderGeometry(R * 0.46, R * 0.5, R * 0.22, 12), { at: [sx * R * 0.92, 0, 0], rot: [0, 0, PI / 2], color: TIE_DARK }));
  // the engine vents at the back, in their housings
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(R * 0.3, R * 0.22, R * 0.12), { at: [sx * R * 0.2, -R * 0.12, -R * 0.95], color: TIE_DARK }));
    L.push(part(new THREE.PlaneGeometry(R * 0.22, R * 0.14), { at: [sx * R * 0.2, -R * 0.12, -R * 1.012], rot: [0, PI, 0], to: 'glow', color: [1.6, 0.42, 0.22] }));
  }
  return L;
}

// The pylon from the ball to a wing, along x: thicker as it nears the wing.
function tiePylon(x0, x1, w0, h0, w1, h1) {
  return loft([
    { z: x0, pts: box8(w0, h0, w0 * 0.22) },
    { z: x0 + (x1 - x0) * 0.4, pts: box8(w0 * 1.06, h0 * 1.06, w0 * 0.22) },
    { z: x1 - 0.035, pts: box8(w1, h1, w1 * 0.25) },
    { z: x1, pts: box8(w1, h1, w1 * 0.25) },
  ]).rotateY(PI / 2);
}

// A TIE's wing in its own plane (z, y), centred on x = 0: the frame round
// the outline, the dark solar panel inside, spars from the hub out to every
// corner on both faces and the hub itself, where the pylon meets it.
function solarWing(outline, { frame = 0.045, thick = 0.045, hub = [0, 0], hubR = 0.075, uv }) {
  const L = [];
  const inner = inset(outline, frame);
  L.push(part(plateZY(outline, thick, 0.008, [inner]), { color: TIE_GREY }));
  L.push(part(plateZY(inset(outline, frame * 0.5), thick * 0.3), { to: 'panel', uv }));
  for (const [z, y] of inner) {
    const dz = z - hub[0];
    const dy = y - hub[1];
    const len = hypot(dz, dy);
    const mid = (hubR + len) / 2 / len;
    L.push(part(new THREE.BoxGeometry(thick * 0.8, frame * 0.5, len - hubR), { at: [0, hub[1] + dy * mid, hub[0] + dz * mid], rot: [atan2(-dy, dz), 0, 0], color: TIE_DARK }));
  }
  L.push(part(new THREE.CylinderGeometry(hubR, hubR, thick * 1.1, 6), { at: [0, hub[1], hub[0]], rot: [PI / 6, 0, PI / 2], color: TIE_GREY }));
  L.push(part(new THREE.CylinderGeometry(hubR * 0.4, hubR * 0.6, thick * 1.8, 10), { at: [0, hub[1], hub[0]], rot: [0, 0, PI / 2], color: TIE_DARK }));
  return L;
}

function tieMaterials(k, panelTex) {
  return {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 222, spread: 10, seam: 0.66, detail: 0.2 })), metalness: 0.3, roughness: 0.45 }),
    panel: standard(k, { map: panelTex, metalness: 0.35, roughness: 0.34 }),
    glass: standard(k, { color: '#0d1916', metalness: 0.9, roughness: 0.08 }),
    glow: glowMaterial(k),
  };
}

// TIE fighter: the ball cockpit between two tall hexagonal wings.
function tie(k) {
  const L = tieCockpit(0.2);
  const hexagon = [[0, 0.6], [-0.5, 0.3], [-0.5, -0.3], [0, -0.6], [0.5, -0.3], [0.5, 0.3]];
  const uv = (x, y, z) => [z + 0.5, (y + 0.6) / 1.2];
  const right = [part(tiePylon(0.17, 0.47, 0.075, 0.062, 0.13, 0.14), { color: TIE_GREY }), ...place(solarWing(hexagon, { uv }), [0.485, 0, 0])];
  L.push(...right, ...mirror(right));
  const mats = tieMaterials(k, k.own(solarTexture(k.rand, hexagon, [0, 0], uv)));
  mats.paint.userData.density = 5;
  const M = meshes(k, L, mats);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 1));
    },
  };
}

// TIE interceptor: the same ball, with dagger wings: each half a blade
// pointing forward, both bent in toward the cockpit, a cannon at each tip.
function interceptor(k) {
  const R = 0.14;
  const L = tieCockpit(R);
  const half = [[0.08, 0], [0.52, 0.52], [-0.08, 0.44], [-0.42, 0.2], [-0.42, 0]];
  const hub = [-0.04, 0];
  const uv = (x, y, z) => [z + 0.5, y / 0.6];
  const blade = solarWing(half, { frame: 0.036, thick: 0.038, hub, hubR: 0.055, uv });
  blade.push(part(turned([[0.011, 0.28], [0.011, 0.42], [0.007, 0.43], [0.0055, 0.56], [0.0001, 0.561]], 8), { at: [-0.022, 0.47, 0], color: TIE_DARK }));
  const bend = 0.42;
  const wing = [...place(blade, undefined, [0, 0, bend]), ...place(place(blade, undefined, undefined, [1, -1, 1]), undefined, [0, 0, -bend])];
  const right = [part(tiePylon(R * 0.85, 0.32, 0.055, 0.045, 0.085, 0.09), { color: TIE_GREY }), ...place(wing, [0.325, 0, 0])];
  L.push(...right, ...mirror(right));
  const mats = tieMaterials(k, k.own(solarTexture(k.rand, half, hub, uv)));
  mats.paint.userData.density = 6;
  const M = meshes(k, L, mats);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 2));
    },
  };
}

// X-wing: the long wedge of a nose, the canopy and Artoo behind it, four
// S-foils open in an X, an engine at each wing's root (glowing red-orange
// behind) and a long laser cannon at each tip; Red Squadron's stripes.
function xwing(k) {
  const WHITE = '#e3e0d8';
  const GREY = '#9a9ea5';
  const RED = '#b5312a';
  const DARK = '#2c3037';
  const L = [];
  L.push(
    part(
      loft([
        { z: -0.445, pts: box8(0.112, 0.094, 0.02) },
        { z: -0.42, pts: box8(0.13, 0.11, 0.022) },
        { z: -0.06, pts: box8(0.13, 0.11, 0.022) },
        { z: 0.06, pts: trap8(0.12, 0.085, 0.095, 0.018, -0.005) },
        { z: 0.2, pts: trap8(0.096, 0.062, 0.072, 0.014, -0.015) },
        { z: 0.47, pts: trap8(0.03, 0.018, 0.022, 0.005, -0.021) },
        { z: 0.5, pts: trap8(0.012, 0.007, 0.009, 0.002, -0.021) },
      ]),
      { color: WHITE },
    ),
  );
  // the red band round the nose, and the grey panels on its flanks
  L.push(part(loft([
    { z: 0.3, pts: scaled(trap8(0.0745, 0.0465, 0.0515, 0.011, -0.0174), 1.04, 1.04, -0.0174) },
    { z: 0.34, pts: scaled(trap8(0.0667, 0.0414, 0.0457, 0.01, -0.0181), 1.04, 1.04, -0.0181) },
  ]), { color: RED }));
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.004, 0.05, 0.16), { at: [sx * 0.065, 0, -0.24], color: GREY }));
    L.push(part(new THREE.BoxGeometry(0.004, 0.022, 0.08), { at: [sx * 0.054, -0.02, 0.12], rot: [0, sx * 0.09, 0], color: GREY }));
  }
  L.push(part(new THREE.BoxGeometry(0.06, 0.008, 0.07), { at: [0, 0.057, -0.33], color: GREY }));
  L.push(part(new THREE.BoxGeometry(0.09, 0.07, 0.01), { at: [0, 0, -0.447], to: 'metal', color: DARK }));
  // the canopy, its frame, and Artoo in his socket behind it
  const canopy = (z, yb, w, h) => ({ z, pts: [[w / 2, yb], [w / 2 - 0.006, yb + h * 0.62], [w * 0.2, yb + h], [-w * 0.2, yb + h], [-w / 2 + 0.006, yb + h * 0.62], [-w / 2, yb]] });
  L.push(part(loft([canopy(-0.075, 0.048, 0.07, 0.004), canopy(-0.045, 0.05, 0.078, 0.036), canopy(0.04, 0.04, 0.072, 0.038), canopy(0.13, 0.026, 0.064, 0.014), canopy(0.17, 0.02, 0.058, 0.001)]), { to: 'glass' }));
  for (const [z, yb, w, h] of [
    [-0.045, 0.05, 0.078, 0.036],
    [0.04, 0.04, 0.072, 0.038],
  ]) {
    L.push(part(loft([canopy(z - 0.004, yb, w * 1.06, h * 1.1), canopy(z + 0.004, yb, w * 1.06, h * 1.1)]), { color: WHITE }));
  }
  L.push(rod([0, 0.087, -0.045], [0, 0.08, 0.04], 0.0035, 0.0035, { color: WHITE }, 4));
  L.push(rod([0, 0.08, 0.04], [0, 0.042, 0.13], 0.0035, 0.0035, { color: WHITE }, 4));
  const dome = [[0.027, 0], [0.027, 0.008]];
  for (let i = 1; i <= 6; i++) dome.push([0.027 * cos((i / 6) * (PI / 2)), 0.008 + 0.022 * sin((i / 6) * (PI / 2))]);
  L.push(part(upright(dome, 14), { at: [0, 0.05, -0.13], to: 'metal', color: '#d3d9df' }));
  L.push(part(new THREE.BoxGeometry(0.012, 0.009, 0.006), { at: [0, 0.07, -0.108], rot: [-0.6, 0, 0], to: 'metal', color: '#2a5fc8' }));
  L.push(part(new THREE.BoxGeometry(0.034, 0.005, 0.004), { at: [0, 0.061, -0.104], rot: [-0.3, 0, 0], to: 'metal', color: '#2a5fc8' }));
  L.push(ball(0.004, [0.008, 0.073, -0.111], 1, { to: 'metal', color: '#0b0b0d' }, 6));

  // one S-foil, root at the origin and reaching out along x: the wing, its
  // engine, its cannon and its stripe
  const S = 0.34;
  const lead = (x) => -0.1 - 0.15 * (x / S);
  const trail = (x) => -0.46 + 0.02 * (x / S);
  const wing = [];
  wing.push(part(plateXZ([[0, trail(0)], [S, trail(S)], [S, lead(S)], [0, lead(0)]], 0.013, 0.003), { color: WHITE }));
  wing.push(part(plateXZ([[0.15, trail(0.15)], [0.205, trail(0.205)], [0.205, lead(0.205)], [0.15, lead(0.15)]], 0.0195), { color: RED }));
  wing.push(part(plateXZ([[0.25, trail(0.25)], [0.27, trail(0.27)], [0.27, -0.33], [0.25, -0.33]], 0.0195), { color: RED }));
  const eng = [0.036, 0.027];
  wing.push(part(turned([[0.02, -0.497], [0.027, -0.5], [0.032, -0.49], [0.033, -0.46], [0.033, -0.33], [0.03, -0.315], [0.03, -0.245], [0.033, -0.23], [0.033, -0.19], [0.026, -0.176], [0.021, -0.182]], 12), { at: [...eng, 0], color: WHITE }));
  wing.push(part(turned([[0.0335, -0.32], [0.0335, -0.26]], 12), { at: [...eng, 0], color: GREY }));
  wing.push(part(new THREE.CircleGeometry(0.0215, 12), { at: [...eng, -0.181], to: 'metal', color: DARK }));
  wing.push(part(new THREE.CircleGeometry(0.0205, 12), { at: [...eng, -0.495], rot: [0, PI, 0], to: 'glow', color: [5.2, 1.5, 0.55] }));
  wing.push(part(new THREE.ConeGeometry(0.016, 0.028, 10, 1, true), { at: [...eng, -0.508], rot: [-PI / 2, 0, 0], to: 'glow', color: [4.2, 1.1, 0.4] }));
  wing.push(part(turned([[0.004, -0.455], [0.01, -0.448], [0.0125, -0.43], [0.0125, -0.27], [0.0085, -0.21], [0.006, -0.2]], 8), { at: [S + 0.004, 0, 0], color: WHITE }));
  wing.push(part(turned([[0.0045, -0.215], [0.0045, 0.15], [0.0078, 0.158], [0.0078, 0.232], [0.0042, 0.24], [0.003, 0.285], [0.0001, 0.287]], 6), { at: [S + 0.004, 0, 0], to: 'metal', color: '#60666e' }));
  const lift = 0.24;
  const upper = place(wing, [0.05, 0.026, 0], [0, 0, lift]);
  const lower = place(place(wing, undefined, undefined, [1, -1, 1]), [0.05, -0.026, 0], [0, 0, -lift]);
  L.push(...upper, ...lower, ...mirror([...upper, ...lower]));

  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 230, spread: 9, seam: 0.7, detail: 0.25 })), metalness: 0.15, roughness: 0.6 }),
    metal: standard(k, { metalness: 0.8, roughness: 0.32 }),
    glass: standard(k, { color: '#101c25', metalness: 0.9, roughness: 0.06 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 5;
  const M = meshes(k, L, mats);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 3));
    },
  };
}

// Lambda-class shuttle: a boxy body with the cockpit out in front on a
// neck, the tall fixed fin on top and the two wings folded down and out in
// flight, so it's an upside-down Y from the front; two engines behind.
function shuttle(k) {
  const WHITE = '#cfd1cf';
  const EDGE = '#43474d';
  const DARK = '#2b2e33';
  const L = [];
  const body = [
    { z: -0.42, pts: trap8(0.15, 0.1, 0.11, 0.02, 0.005) },
    { z: -0.39, pts: trap8(0.18, 0.12, 0.14, 0.026, 0.005) },
    { z: 0.12, pts: trap8(0.18, 0.12, 0.14, 0.026, 0.005) },
    { z: 0.19, pts: trap8(0.12, 0.085, 0.1, 0.018, -0.01) },
    { z: 0.25, pts: trap8(0.135, 0.095, 0.115, 0.02, -0.012) },
    { z: 0.41, pts: trap8(0.135, 0.09, 0.115, 0.02, -0.012) },
    { z: 0.47, pts: trap8(0.105, 0.06, 0.08, 0.016, -0.02) },
    { z: 0.5, pts: trap8(0.07, 0.035, 0.045, 0.01, -0.024) },
  ];
  L.push(part(loft(body), { color: WHITE }));
  // the cockpit's windows, a band over the top of its nose
  const win = (s, z) => ({ z, pts: scaled([s.pts[1], s.pts[2], s.pts[3], s.pts[4]], 1.02, 1.02, -0.015) });
  L.push(part(loft([win(body[5], 0.41), win(body[6], 0.47)]), { to: 'glass' }));
  for (const x of [-0.03, 0, 0.03]) L.push(rod([x, 0.047, 0.408], [x * 0.75, 0.021, 0.472], 0.0028, 0.0028, { color: WHITE }, 4));
  // the twin cannons under the cockpit's chin, and the intakes behind it
  for (const sx of [-1, 1]) {
    L.push(rod([sx * 0.028, -0.076, 0.34], [sx * 0.028, -0.076, 0.47], 0.0065, 0.0065, { to: 'metal', color: '#4a4f56' }, 6));
    L.push(rod([sx * 0.028, -0.076, 0.47], [sx * 0.028, -0.076, 0.53], 0.003, 0.003, { to: 'metal', color: '#2b2e33' }, 5));
    L.push(part(new THREE.BoxGeometry(0.01, 0.05, 0.05), { at: [sx * 0.066, -0.012, 0.215], rot: [0, sx * -0.6, 0], to: 'metal', color: DARK }));
  }
  L.push(part(new THREE.BoxGeometry(0.07, 0.012, 0.1), { at: [0, -0.072, 0.34], to: 'metal', color: '#5a5f66' }));
  // the fin and the wings: one outline, the fin a little taller
  const fin = [[-0.41, 0], [0.04, 0], [-0.17, 0.6], [-0.35, 0.6]];
  const wingO = [[-0.41, 0], [0.02, 0], [-0.16, 0.5], [-0.33, 0.5]];
  const blade = (o, h) => {
    const lead = (y) => o[1][0] + (o[2][0] - o[1][0]) * (y / h);
    return [
      part(plateZY(o, 0.024, 0.005), { color: WHITE }),
      part(plateZY([[o[0][0] + 0.02, h - 0.045], [lead(h - 0.045), h - 0.045], [o[2][0], h], [o[3][0] + 0.01, h]], 0.03), { color: EDGE }),
      part(plateZY([[o[0][0] + 0.03, 0.02], [o[1][0] - 0.06, 0.02], [lead(0.11) - 0.04, 0.11], [o[0][0] + 0.05, 0.11]], 0.027), { color: '#b9bcbd' }),
    ];
  };
  L.push(...place(blade(fin, 0.6), [0, 0.068, 0]));
  L.push(part(new THREE.BoxGeometry(0.05, 0.03, 0.42), { at: [0, 0.078, -0.18], color: WHITE }));
  const side = place(blade(wingO, 0.5), [0.066, 0.055, 0], [0, 0, -(PI / 2 + 0.7)]);
  L.push(...side, ...mirror(side));
  for (const sx of [-1, 1]) {
    // the wing's hinge, the engines and their glow, the side panels
    L.push(part(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8), { at: [sx * 0.066, 0.055, -0.18], rot: [PI / 2, 0, 0], color: EDGE }));
    L.push(part(new THREE.BoxGeometry(0.068, 0.062, 0.025), { at: [sx * 0.046, 0.002, -0.425], to: 'metal', color: DARK }));
    L.push(part(new THREE.PlaneGeometry(0.052, 0.046), { at: [sx * 0.046, 0.002, -0.4385], rot: [0, PI, 0], to: 'glow', color: [1.5, 2.2, 3.6] }));
    L.push(part(new THREE.BoxGeometry(0.004, 0.06, 0.3), { at: [sx * 0.087, -0.01, -0.16], rot: [0, 0, sx * 0.15], color: '#a9adb0' }));
  }
  // the belly: the landing gear's doors and the ramp
  for (const [x, z] of [
    [0.05, -0.3],
    [-0.05, -0.3],
    [0.05, 0.04],
    [-0.05, 0.04],
  ]) {
    L.push(part(new THREE.BoxGeometry(0.03, 0.006, 0.07), { at: [x, -0.067, z], to: 'metal', color: '#5a5f66' }));
  }
  L.push(part(new THREE.BoxGeometry(0.07, 0.006, 0.2), { at: [0, -0.067, -0.13], to: 'metal', color: '#6a6f76' }));
  L.push(ball(0.009, [0, 0.668, -0.345], 1, { to: 'glow', color: [5.5, 0.6, 0.4], mark: 'tip' }, 6));

  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 228, spread: 10, seam: 0.7, detail: 0.25 })), metalness: 0.25, roughness: 0.5 }),
    metal: standard(k, { metalness: 0.75, roughness: 0.38 }),
    glass: standard(k, { color: '#0e1820', metalness: 0.9, roughness: 0.06 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 5;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 4));
      blink('tip', pulse(t, 1.6, 0, 0.12) ? 1 : 0.15);
    },
  };
}

// Imperial Star Destroyer: the long flat dagger, upper and lower hulls with
// the trench running round between them, the superstructure stepping up
// toward the stern, the bridge tower with its two shield domes, and the
// engines glowing blue across the stern.
function destroyer(k) {
  const GREY = '#a6abb2';
  const L = [];
  const W0 = 0.31;
  const sec = (z) => {
    const w = W0 * (0.5 - z);
    const f = w / W0;
    const [s, hU, hs, hL, b, tr, lip, tin] = [0.036, 0.052, 0.012, 0.04, 0.05, 0.016, 0.008, 0.0035].map((v) => v * f);
    return {
      z,
      pts: [[w, -lip], [w - tr, -tin], [w - tr, tin], [w, lip], [s, hU], [s, hU + hs], [-s, hU + hs], [-s, hU], [-w, lip], [-w + tr, tin], [-w + tr, -tin], [-w, -lip], [-b, -hL], [b, -hL]],
    };
  };
  L.push(part(loft([sec(-0.5), sec(0), sec(0.45), sec(0.497)]), { color: GREY }));
  // the trench: a dark band set into it all the way round
  const band = (z) => {
    const w = W0 * (0.5 - z);
    const f = w / W0;
    const x = w - 0.016 * f * 0.45;
    return { z, pts: [[x, -0.0028 * f], [x, 0.0028 * f], [-x, 0.0028 * f], [-x, -0.0028 * f]] };
  };
  L.push(part(loft([band(-0.499), band(0.49)]), { to: 'metal', color: '#24282e' }));
  // the long lines down the upper hull, parallel to its edges, and the
  // spine's edges
  const hullLine = (sx, phi, lift = 0.0012) => (z) => {
    const f = 0.5 - z;
    const [ex, ey, px, py] = [W0 * f, 0.008 * f, 0.036 * f, 0.052 * f];
    return [sx * (ex + (px - ex) * phi), ey + (py - ey) * phi + lift, z];
  };
  for (const sx of [-1, 1]) {
    for (const phi of [0.3, 0.62]) {
      const at = hullLine(sx, phi);
      L.push(rod(at(-0.497), at(0.43), 0.0017, 0.0017, { to: 'metal', color: '#7b8189' }, 4));
    }
    const sp = hullLine(sx, 1, 0.012);
    L.push(rod(sp(-0.497), sp(0.4), 0.0016, 0.0016, { to: 'metal', color: '#6d737b' }, 4));
  }
  // the superstructure: decks stepping up toward the stern, each with a
  // sloped front
  const deck = (zf, wf, wb, top) =>
    loft([
      { z: -0.497, pts: [[wb, 0], [wb * 0.93, top], [-wb * 0.93, top], [-wb, 0]] },
      { z: zf - 0.03, pts: [[wf, 0], [wf * 0.93, top], [-wf * 0.93, top], [-wf, 0]] },
      { z: zf, pts: [[wf * 0.9, 0], [wf * 0.8, top - 0.016], [-wf * 0.8, top - 0.016], [-wf * 0.9, 0]] },
    ]);
  const decks = [
    [0.1, 0.06, 0.205, 0.08],
    [-0.06, 0.06, 0.16, 0.098],
    [-0.2, 0.055, 0.12, 0.116],
    [-0.31, 0.05, 0.085, 0.134],
  ];
  decks.forEach(([zf, wf, wb, top], i) => L.push(part(deck(zf, wf, wb, top), { color: i % 2 ? '#9ea3aa' : GREY })));
  // the tower: a neck, the bridge across its top, the shield domes on that
  L.push(part(loft([{ z: -0.455, pts: box8(0.05, 0.08, 0.008, 0.17) }, { z: -0.39, pts: box8(0.044, 0.08, 0.008, 0.17) }]), { color: GREY }));
  L.push(
    part(
      loft([
        { z: -0.47, pts: box8(0.17, 0.03, 0.006, 0.217) },
        { z: -0.4, pts: box8(0.17, 0.03, 0.006, 0.217) },
        { z: -0.385, pts: box8(0.15, 0.016, 0.004, 0.212) },
      ]),
      { color: GREY },
    ),
  );
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.CylinderGeometry(0.007, 0.009, 0.016, 8), { at: [sx * 0.056, 0.237, -0.44], color: GREY }));
    L.push(ball(0.019, [sx * 0.056, 0.252, -0.44], 1, { to: 'metal', color: '#c4c8ce' }, 14));
  }
  L.push(part(new THREE.BoxGeometry(0.13, 0.004, 0.003), { at: [0, 0.214, -0.3865], rot: [0.5, 0, 0], to: 'glow', color: [1.5, 1.45, 1.3] }));
  // the engines: three great ones and four smaller
  const engines = [
    [0, 0.012, 0.034],
    [0.078, 0.006, 0.029],
    [-0.078, 0.006, 0.029],
    [0.142, 0.002, 0.016],
    [-0.142, 0.002, 0.016],
    [0.04, 0.094, 0.014],
    [-0.04, 0.094, 0.014],
  ];
  for (const [x, y, r] of engines) {
    L.push(part(turned([[r * 0.8, -0.488], [r * 0.8, -0.503], [r, -0.51], [r * 1.14, -0.5], [r * 1.14, -0.49]], 16), { at: [x, y, 0], to: 'metal', color: '#4b5057' }));
    L.push(part(new THREE.CircleGeometry(r * 0.8, 16), { at: [x, y, -0.502], rot: [0, PI, 0], to: 'glow', color: [1.0, 2.5, 6.6] }));
  }
  // greebles on the decks and along the spine, and the hangar underneath
  for (let i = 0; i < 46; i++) {
    const [zf, , wb, top] = decks[Math.floor(k.rand() * decks.length)];
    const z = zf - 0.03 + (-0.49 - zf + 0.03) * k.rand();
    const w = wb * 0.8 * k.rand() * (k.rand() < 0.5 ? -1 : 1);
    const [sx, sy, sz] = [0.008 + 0.022 * k.rand(), 0.004 + 0.01 * k.rand(), 0.008 + 0.03 * k.rand()];
    L.push(part(new THREE.BoxGeometry(sx, sy, sz), { at: [w, top + sy / 2, z], to: 'metal', color: k.rand() < 0.5 ? '#6c7179' : '#8e939a' }));
  }
  for (let i = 0; i < 14; i++) {
    const z = 0.15 + 0.3 * k.rand();
    const f = 0.5 - z;
    L.push(part(new THREE.BoxGeometry(0.012, 0.006, 0.02), { at: [(k.rand() - 0.5) * 0.04 * f, 0.064 * f + 0.003, z], to: 'metal', color: '#8a8f96' }));
  }
  L.push(part(new THREE.BoxGeometry(0.05, 0.003, 0.12), { at: [0, -0.024, -0.08], to: 'metal', color: '#1e2126' }));

  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { min: 6, base: 222, spread: 26, seam: 0.55, detail: 0.4 })), metalness: 0.25, roughness: 0.5 }),
    metal: standard(k, { metalness: 0.7, roughness: 0.4 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 7;
  const M = meshes(k, L, mats);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(1 + 0.06 * sin(t * 2.1) + 0.03 * sin(t * 13));
    },
  };
}

// ── Rick and Morty ──

const FED_BLUE = [0.5, 2.1, 5.6];

// Galactic Federation patrol fighter: a sleek white dart with a blue-tinted
// canopy, swept wings angled down with fins at their tips, two engine pods
// and blue running lights.
function patrol(k) {
  const WHITE = '#dde1e6';
  const GREY = '#8c939c';
  const DARK = '#363b43';
  const L = [];
  L.push(
    part(
      loft([
        { z: -0.46, pts: hex6(0.1, 0.06, 0.005) },
        { z: -0.4, pts: hex6(0.14, 0.085, 0.005) },
        { z: 0.0, pts: hex6(0.16, 0.1, 0.01) },
        { z: 0.28, pts: hex6(0.1, 0.07, 0) },
        { z: 0.5, pts: hex6(0.012, 0.01, -0.012) },
      ]),
      { color: WHITE },
    ),
  );
  L.push(part(new THREE.SphereGeometry(0.05, 18, 8, 0, PI * 2, 0, PI / 2), { at: [0, 0.042, 0.11], rot: [0.05, 0, 0], scale: [0.78, 0.62, 2.4], to: 'glass' }));
  L.push(part(new THREE.BoxGeometry(0.03, 0.02, 0.36), { at: [0, -0.045, -0.12], color: GREY }));
  const wing = [];
  wing.push(part(plateXZ([[0, -0.36], [0.34, -0.44], [0.37, -0.38], [0, 0.1]], 0.016, 0.004), { color: WHITE }));
  wing.push(part(plateXZ([[0.12, -0.4], [0.34, -0.445], [0.36, -0.41], [0.12, -0.3]], 0.019), { color: GREY }));
  const finO = [[-0.46, 0], [-0.33, 0], [-0.4, 0.13], [-0.46, 0.13]];
  wing.push(part(plateZY(finO, 0.012, 0.003), { at: [0.355, 0, 0], rot: [0, 0, -0.35], color: WHITE }));
  wing.push(ball(0.008, [0.355 + sin(0.35) * 0.13, cos(0.35) * 0.13, -0.43], 1, { to: 'glow', color: FED_BLUE, mark: 'tips' }, 6));
  wing.push(rod([0.04, 0.009, 0.06], [0.3, 0.009, -0.33], 0.0028, 0.0028, { to: 'glow', color: FED_BLUE }, 4));
  wing.push(part(plateXZ([[0, 0.16], [0.07, 0.12], [0.075, 0.14], [0, 0.24]], 0.01, 0.002), { at: [-0.01, 0.03, 0], color: WHITE }));
  const right = place(wing, [0.05, -0.02, 0], [0, 0, -0.14]);
  L.push(...right, ...mirror(right));
  for (const sx of [-1, 1]) {
    const at = [sx * 0.085, 0.012, 0];
    L.push(part(turned([[0.018, -0.5], [0.028, -0.505], [0.034, -0.49], [0.036, -0.44], [0.036, -0.25], [0.03, -0.2], [0.022, -0.19]], 12), { at, color: WHITE }));
    L.push(part(turned([[0.037, -0.42], [0.037, -0.4]], 12), { at, color: GREY }));
    L.push(part(new THREE.CircleGeometry(0.0225, 12), { at: [at[0], at[1], -0.193], to: 'metal', color: DARK }));
    L.push(part(new THREE.CircleGeometry(0.019, 12), { at: [at[0], at[1], -0.5], rot: [0, PI, 0], to: 'glow', color: [0.8, 2.6, 6.4] }));
    L.push(part(new THREE.ConeGeometry(0.015, 0.03, 10, 1, true), { at: [at[0], at[1], -0.514], rot: [-PI / 2, 0, 0], to: 'glow', color: [0.6, 2.1, 5.6] }));
    // the running light down each flank
    L.push(rod([sx * 0.068, 0.006, -0.38], [sx * 0.081, 0.01, 0.0], 0.003, 0.003, { to: 'glow', color: FED_BLUE }, 4));
    L.push(rod([sx * 0.081, 0.01, 0.0], [sx * 0.05, 0.0, 0.28], 0.003, 0.003, { to: 'glow', color: FED_BLUE }, 4));
  }
  L.push(ball(0.007, [0, -0.016, 0.47], 1, { to: 'glow', color: [3, 3, 3.2], mark: 'nose' }, 6));
  // twin cannons slung under the wing roots
  for (const sx of [-1, 1]) {
    L.push(rod([sx * 0.07, -0.032, -0.05], [sx * 0.07, -0.032, 0.2], 0.007, 0.007, { to: 'metal', color: '#4a5059' }, 6));
    L.push(rod([sx * 0.07, -0.032, 0.2], [sx * 0.07, -0.032, 0.3], 0.0035, 0.0035, { to: 'metal', color: '#2e333a' }, 6));
  }

  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 232, spread: 8, seam: 0.72, detail: 0.15, min: 18 })), metalness: 0.2, roughness: 0.4 }),
    metal: standard(k, { metalness: 0.8, roughness: 0.35 }),
    glass: standard(k, { color: '#1d4f8f', metalness: 0.85, roughness: 0.08 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 5;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 5));
      blink('tips', pulse(t, 1.2, 0, 0.1) || pulse(t, 1.2, 0.85, 0.1) ? 1.4 : 0.25);
      blink('nose', pulse(t, 2.1, 0.5, 0.06) ? 1.2 : 0.1);
    },
  };
}

// Galactic Federation cruiser: a long, angular grey hull ending in two
// forward prongs, a stepped bridge on top, a keel blade below, wings bent
// down to engine pods, and blue glowing strips all along.
function federation(k) {
  const GREY = '#858c95';
  const DARK = '#4a5058';
  const L = [];
  L.push(
    part(
      loft([
        { z: -0.5, pts: hex6(0.2, 0.11, 0, 0.32) },
        { z: -0.44, pts: hex6(0.24, 0.14, 0, 0.32) },
        { z: 0.0, pts: hex6(0.27, 0.15, 0, 0.32) },
        { z: 0.22, pts: hex6(0.22, 0.12, -0.005, 0.32) },
        { z: 0.31, pts: hex6(0.16, 0.085, -0.01, 0.32) },
      ]),
      { color: GREY },
    ),
  );
  // the prongs, splaying a little as they reach forward
  const diamond = (w, h, cx, y) => [[cx + w / 2, y], [cx, y + h / 2], [cx - w / 2, y], [cx, y - h / 2]];
  for (const sx of [-1, 1]) {
    L.push(
      part(
        loft([
          { z: 0.22, pts: diamond(0.07, 0.07, sx * 0.05, -0.008) },
          { z: 0.42, pts: diamond(0.05, 0.045, sx * 0.064, -0.012) },
          { z: 0.5, pts: diamond(0.008, 0.008, sx * 0.07, -0.016) },
        ]),
        { color: GREY },
      ),
    );
    L.push(rod([sx * 0.074, -0.012, 0.3], [sx * 0.07, -0.014, 0.46], 0.0035, 0.0035, { to: 'glow', color: FED_BLUE }, 4));
  }
  L.push(part(new THREE.BoxGeometry(0.06, 0.035, 0.01), { at: [0, -0.01, 0.31], to: 'glow', color: [0.4, 1.6, 5] }));
  // its scowl: two slanted slits of blue light up on the prow
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.06, 0.006, 0.011), { at: [sx * 0.034, 0.0495, 0.25], rot: [0.24, sx * 0.45, 0], to: 'glow', color: [0.6, 2.4, 6.4] }));
  }
  // turrets on the hull's back, ahead of the bridge
  for (const [x, z] of [
    [0.045, 0.1],
    [-0.045, 0.1],
    [0, 0.17],
  ]) {
    const y = 0.072 - (z - 0.1) * 0.09;
    L.push(part(new THREE.CylinderGeometry(0.016, 0.02, 0.012, 8), { at: [x, y, z], color: DARK }));
    L.push(rod([x - 0.005, y + 0.008, z], [x - 0.005, y + 0.008, z + 0.05], 0.0025, 0.0025, { color: DARK }, 4));
    L.push(rod([x + 0.005, y + 0.008, z], [x + 0.005, y + 0.008, z + 0.05], 0.0025, 0.0025, { color: DARK }, 4));
  }
  // the bridge: two decks, the upper with its window strip
  L.push(
    part(
      loft([
        { z: -0.42, pts: [[0.075, 0.05], [0.055, 0.115], [-0.055, 0.115], [-0.075, 0.05]] },
        { z: -0.1, pts: [[0.075, 0.05], [0.055, 0.115], [-0.055, 0.115], [-0.075, 0.05]] },
        { z: 0.04, pts: [[0.06, 0.05], [0.04, 0.07], [-0.04, 0.07], [-0.06, 0.05]] },
      ]),
      { color: GREY },
    ),
  );
  L.push(
    part(
      loft([
        { z: -0.38, pts: [[0.045, 0.11], [0.03, 0.15], [-0.03, 0.15], [-0.045, 0.11]] },
        { z: -0.22, pts: [[0.045, 0.11], [0.03, 0.15], [-0.03, 0.15], [-0.045, 0.11]] },
        { z: -0.16, pts: [[0.04, 0.11], [0.022, 0.125], [-0.022, 0.125], [-0.04, 0.11]] },
      ]),
      { color: DARK },
    ),
  );
  L.push(part(new THREE.BoxGeometry(0.05, 0.005, 0.003), { at: [0, 0.136, -0.19], rot: [-0.9, 0, 0], to: 'glow', color: FED_BLUE }));
  L.push(part(new THREE.BoxGeometry(0.09, 0.005, 0.003), { at: [0, 0.092, -0.035], rot: [-1.1, 0, 0], to: 'glow', color: FED_BLUE }));
  // the keel, and the fin over the stern
  L.push(part(plateZY([[-0.44, 0], [0.06, 0], [-0.12, -0.11], [-0.38, -0.13]], 0.022, 0.005), { at: [0, -0.06, 0], color: DARK }));
  L.push(part(plateZY([[-0.42, 0], [-0.25, 0], [-0.4, 0.09], [-0.47, 0.09]], 0.016, 0.004), { at: [0, 0.145, 0], color: GREY }));
  L.push(ball(0.006, [0, 0.238, -0.465], 1, { to: 'glow', color: [5.5, 0.7, 0.5], mark: 'tips' }, 6));
  // the wings and the engine pods at their tips
  const wing = [];
  wing.push(part(plateXZ([[0, -0.38], [0.24, -0.46], [0.27, -0.34], [0, -0.04]], 0.02, 0.005), { color: GREY }));
  wing.push(rod([0.01, 0.006, -0.05], [0.26, 0.006, -0.335], 0.003, 0.003, { to: 'glow', color: FED_BLUE }, 4));
  const pod = [0.27, 0, 0];
  wing.push(part(loft([{ z: -0.5, pts: hex6(0.05, 0.06) }, { z: -0.47, pts: hex6(0.06, 0.07) }, { z: -0.28, pts: hex6(0.06, 0.07) }, { z: -0.2, pts: hex6(0.02, 0.03) }]), { at: pod, color: DARK }));
  wing.push(part(new THREE.PlaneGeometry(0.04, 0.045), { at: [0.27, 0, -0.502], rot: [0, PI, 0], to: 'glow', color: [0.6, 2.4, 6.4] }));
  wing.push(ball(0.007, [0.27, 0.04, -0.3], 1, { to: 'glow', color: [5.5, 0.7, 0.5], mark: 'tips' }, 6));
  const right = place(wing, [0.12, -0.02, 0], [0, 0, -0.32]);
  L.push(...right, ...mirror(right));
  for (const sx of [-1, 1]) {
    L.push(rod([sx * 0.1, 0, -0.5], [sx * 0.135, 0, 0.0], 0.0035, 0.0035, { to: 'glow', color: FED_BLUE }, 4));
    L.push(rod([sx * 0.135, 0, 0.0], [sx * 0.11, -0.005, 0.22], 0.0035, 0.0035, { to: 'glow', color: FED_BLUE }, 4));
    // windows down the flanks
    for (let i = 0; i < 7; i++) {
      const z = -0.36 + i * 0.07;
      const x = 0.12 + 0.015 * (1 - Math.abs(z) / 0.44);
      L.push(part(new THREE.BoxGeometry(0.003, 0.008, 0.016), { at: [sx * (x * 0.78 + 0.004), 0.034, z], rot: [0, 0, sx * -0.85], to: 'glow', color: [0.6, 1.4, 3] }));
    }
  }
  for (const x of [0, -0.06, 0.06]) {
    L.push(part(turned([[0.024, -0.49], [0.024, -0.512], [0.03, -0.515], [0.032, -0.49]], 12), { at: [x, 0, 0], color: DARK }));
    L.push(part(new THREE.CircleGeometry(0.024, 12), { at: [x, 0, -0.505], rot: [0, PI, 0], to: 'glow', color: [0.6, 2.4, 6.4] }));
  }

  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { min: 10, base: 222, spread: 18, seam: 0.6, detail: 0.35 })), metalness: 0.3, roughness: 0.45 }),
    metal: standard(k, { metalness: 0.8, roughness: 0.35 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 5;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(1 + 0.08 * sin(t * 3.1) + 0.03 * sin(t * 19));
      blink('tips', pulse(t, 1.5, 0, 0.1) ? 1 : 0.1);
    },
  };
}

// A Gromflomite on the wing: the fly-headed soldier of the Federation, with
// great red compound eyes, mandibles and feelers, a green-brown chitin body
// in a grey harness, legs tucked back and a pair of glassy wings, buzzing.
function gromflomite(k) {
  const CHITIN = '#6a7436';
  const BROWN = '#6e5a2e';
  const DARK = '#2f3418';
  const HARNESS = '#8c96a2';
  const L = [];
  L.push(ball(0.082, [0, 0.02, 0.36], [1, 0.9, 0.95], { color: BROWN }, 12));
  for (const sx of [-1, 1]) {
    L.push(ball(0.066, [sx * 0.062, 0.04, 0.37], [0.82, 1, 1.02], { to: 'eyes', uv: 'keep' }, 14));
    L.push(part(new THREE.ConeGeometry(0.014, 0.06, 6), { at: [sx * 0.022, -0.045, 0.43], rot: [PI / 2 + 0.6, 0, sx * 0.4], color: DARK }));
    L.push(rod([sx * 0.02, 0.085, 0.4], [sx * 0.07, 0.16, 0.5], 0.004, 0.003, { color: DARK }, 5));
    L.push(ball(0.008, [sx * 0.07, 0.16, 0.5], 1, { color: DARK }, 6));
  }
  L.push(rod([0, -0.03, 0.4], [0, -0.07, 0.44], 0.012, 0.008, { color: DARK }, 6));
  L.push(rod([0, 0.0, 0.29], [0, 0.01, 0.33], 0.04, 0.04, { color: DARK }, 8));
  L.push(ball(0.1, [0, 0.0, 0.17], [1, 0.95, 1.25], { color: CHITIN }, 14));
  // the harness: a belt round the thorax and a strap over it
  L.push(part(new THREE.TorusGeometry(0.098, 0.013, 6, 18), { at: [0, -0.004, 0.11], color: HARNESS }));
  L.push(part(new THREE.TorusGeometry(0.1, 0.01, 6, 18), { at: [0, 0, 0.19], rot: [0, PI / 2, 0.5], scale: [1, 0.95, 1.2], color: HARNESS }));
  // the abdomen, in rings
  const rings = [
    [0.08, 0.088, 0],
    [0.01, 0.094, -0.01],
    [-0.08, 0.09, -0.02],
    [-0.16, 0.082, -0.032],
    [-0.24, 0.07, -0.045],
    [-0.32, 0.054, -0.06],
    [-0.4, 0.035, -0.075],
    [-0.46, 0.012, -0.088],
  ];
  for (let i = 0; i < rings.length - 1; i++) {
    const [za, ra, ya] = rings[i];
    const [zb, rb, yb] = rings[i + 1];
    const prof = [[rb * 0.8, zb - za], [rb * 1.02, zb - za + 0.012], [ra * 1.03, -0.008], [ra * 0.86, 0.004]];
    L.push(part(turned(prof, 14), { at: [0, ya, za], rot: [atan2(ya - yb, za - zb) * 0.6, 0, 0], color: i % 2 ? BROWN : CHITIN }));
  }
  // legs, tucked back in flight
  for (const sx of [-1, 1]) {
    for (const z0 of [0.24, 0.17, 0.1]) {
      const hip = [sx * 0.05, -0.06, z0];
      const knee = [sx * 0.12, -0.11, z0 - 0.04];
      const foot = [sx * 0.1, -0.15, z0 - 0.16];
      L.push(rod(hip, knee, 0.012, 0.009, { color: DARK }, 5), rod(knee, foot, 0.009, 0.005, { color: DARK }, 5));
    }
  }
  // the wings, one mesh, flapped by moving its vertices
  const wingO = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * PI * 2;
    const x = 0.27 + 0.27 * cos(a);
    const w = 0.06 + 0.035 * Math.min(1, x / 0.2);
    wingO.push([x, w * sin(a)]);
  }
  const wingParts = [];
  for (const sx of [-1, 1]) {
    wingParts.push(
      part(plateXZ(wingO, 0.004), {
        at: [sx * 0.035, 0.085, 0.2],
        rot: [0, sx * 0.55, sx * 0.12],
        scale: [sx, 1, 1],
        to: 'wings',
        uv: (x, y, z) => [Math.abs(x) / 0.54, z / 0.2 + 0.5],
      }),
    );
  }
  const veins = canvasTexture(256, (g, S) => {
    g.fillStyle = '#9fb3a6';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(20,26,18,0.95)';
    g.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(0, S / 2);
      g.bezierCurveTo(S * 0.3, S / 2 + i * 6, S * 0.6, S / 2 + i * 22, S, S / 2 + i * 30);
      g.stroke();
    }
    g.lineWidth = 2;
    for (let x = 30; x < S; x += 26 + k.rand() * 14) {
      g.beginPath();
      g.moveTo(x, S * 0.2);
      g.lineTo(x + 8, S * 0.8);
      g.stroke();
    }
  });
  const facets = canvasTexture(128, (g, S) => {
    g.fillStyle = '#2c0806';
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 8) {
      for (let x = (y / 8) % 2 ? 4 : 0; x < S; x += 8) {
        g.fillStyle = `rgb(${88 + k.rand() * 30},${22 + k.rand() * 12},${16})`;
        g.beginPath();
        g.arc(x + 4, y + 4, 3, 0, PI * 2);
        g.fill();
      }
    }
  });
  facets.repeat.set(6, 3);
  const mats = {
    paint: standard(k, { map: k.own(chitinTexture(k.rand)), metalness: 0.2, roughness: 0.42 }),
    eyes: standard(k, { map: k.own(facets), metalness: 0.1, roughness: 0.3 }),
    wings: k.own(
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        map: k.own(veins),
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        forceSinglePass: true, // (thin as a leaf: one pass draws the same)
        depthWrite: false,
        roughness: 0.35,
        metalness: 0,
        iridescence: 0.7,
        iridescenceIOR: 1.35,
      }),
    ),
  };
  mats.paint.userData.density = 6;
  const M = meshes(k, [...L, ...wingParts], mats);
  const flap = flapper(M.wings, 0.035, 0.085, 0.4);
  return {
    root: Object.values(M),
    update(t) {
      flap(0.15 + 0.6 * sin(t * PI * 2 * 7.5));
    },
  };
}

// Mottled chitin: a grey ground (the vertex colours tint it) with darker
// blotches and fine growth lines.
function chitinTexture(rand) {
  return canvasTexture(128, (g, S) => {
    g.fillStyle = grey(215);
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(40,35,20,${0.08 + rand() * 0.14})`;
      g.beginPath();
      g.arc(rand() * S, rand() * S, 2 + rand() * 9, 0, PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(30,25,10,0.35)';
    for (let y = 0; y < S; y += 9) g.fillRect(0, y, S, 1);
  });
}

// Mr. Meeseeks, floating by: tall and light blue, a big round head with
// big round eyes, a wide smile, waving one arm. (He leans forward into the
// way he's going, so he's taller than he is long: see `size`.)
function meeseeks(k) {
  const SKIN = '#7fcaf0';
  const L = [];
  const limb = (a, b, r1, r2, seg = 8) => rod(a, b, r1, r2, { color: SKIN }, seg);
  const joint = (r, at, seg = 8) => ball(r, at, 1, { color: SKIN }, seg);
  for (const sx of [-1, 1]) {
    const hip = [sx * 0.07, 0.9, 0];
    const knee = [sx * 0.085, 0.5, 0.06];
    const ankle = [sx * 0.08, 0.14, -0.06];
    L.push(limb(hip, knee, 0.048, 0.04), joint(0.04, knee), limb(knee, ankle, 0.04, 0.03), joint(0.031, ankle, 6));
    L.push(ball(0.045, [sx * 0.085, 0.105, 0.0], [0.85, 0.55, 1.6], { color: SKIN }, 8));
  }
  L.push(ball(0.1, [0, 0.9, 0], [1.1, 0.75, 0.82], { color: SKIN }, 10));
  L.push(part(upright([[0.092, 0.86], [0.104, 0.95], [0.108, 1.1], [0.114, 1.25], [0.13, 1.36], [0.11, 1.41], [0.05, 1.45], [0.038, 1.47]], 12), { scale: [1, 1, 0.78], color: SKIN }));
  // the head: rounder at the crown than the chin, the face on its front
  const hy = 1.8;
  const head = [];
  for (let i = 0; i <= 12; i++) {
    const a = -PI / 2 + (i / 12) * PI;
    head.push([0.215 * cos(a) * (1 + 0.1 * sin(a)), hy + 0.24 * sin(a)]);
  }
  L.push(limb([0, 1.42, 0], [0, hy - 0.19, 0.01], 0.038, 0.036));
  L.push(part(upright(head, 16), { scale: [1, 1, 0.92], color: SKIN }));
  for (const sx of [-1, 1]) {
    L.push(ball(0.075, [sx * 0.08, hy + 0.035, 0.174], [1, 1.1, 0.5], { color: '#cdd3d8' }, 12));
    L.push(ball(0.024, [sx * 0.074, hy + 0.03, 0.212], [1, 1, 0.5], { color: '#101215' }, 6));
    L.push(ball(0.035, [sx * 0.212, hy, 0], [0.5, 1, 0.8], { color: SKIN }, 6));
  }
  L.push(ball(0.03, [0, hy - 0.06, 0.19], [0.8, 1, 1.1], { color: SKIN }, 6));
  L.push(ball(0.065, [0, hy - 0.15, 0.133], [1.5, 0.6, 0.45], { color: '#40161a' }, 10));
  L.push(ball(0.03, [0, hy - 0.168, 0.15], [1.3, 0.5, 0.5], { color: '#c8606a' }, 6));
  // the arm that hangs
  const sh = [-0.132, 1.37, 0];
  const el = [-0.24, 1.12, 0.07];
  const wr = [-0.28, 0.9, 0.12];
  L.push(joint(0.04, sh), limb(sh, el, 0.036, 0.032), joint(0.033, el, 6), limb(el, wr, 0.032, 0.027));
  L.push(ball(0.036, [-0.285, 0.86, 0.13], [0.75, 1.3, 1], { color: SKIN }, 8));
  // the arm that waves: upper arm from the shoulder, forearm and hand from
  // the elbow, each its own mesh so update() can swing them
  const elbow = [0.2, 0.17, 0.02];
  const upper = [joint(0.04, [0, 0, 0]), limb([0, 0, 0], elbow, 0.036, 0.032), joint(0.033, elbow, 6)];
  const fore = [limb([0, 0, 0], [0.03, 0.26, 0], 0.032, 0.027), ball(0.042, [0.035, 0.3, 0], [1.05, 1.15, 0.5], { color: SKIN }, 8)];
  for (let i = 0; i < 3; i++) {
    const x = 0.035 + (i - 1) * 0.022;
    fore.push(limb([x, 0.33, 0], [x + (i - 1) * 0.018, 0.41, 0], 0.011, 0.009, 5));
  }
  fore.push(limb([0.0, 0.29, 0], [-0.045, 0.34, 0.01], 0.011, 0.009, 5));
  const skin = standard(k, { roughness: 0.62, metalness: 0 });
  const body = new THREE.Mesh(k.own(bake(L)), skin);
  const upperMesh = new THREE.Mesh(k.own(bake(upper)), skin);
  const foreMesh = new THREE.Mesh(k.own(bake(fore)), skin);
  const shoulder = new THREE.Group();
  shoulder.position.set(0.132, 1.37, 0);
  const forearm = new THREE.Group();
  forearm.position.set(...elbow);
  forearm.add(foreMesh);
  shoulder.add(upperMesh, forearm);
  const pose = new THREE.Group();
  pose.rotation.x = 0.3;
  pose.add(body, shoulder);
  return {
    root: [pose],
    update(t) {
      const w = t * PI * 2 * 1.4;
      forearm.rotation.z = 0.5 * sin(w);
      shoulder.rotation.z = 0.08 * sin(w + 0.7);
      pose.position.y = 0.02 * sin(t * 1.3);
    },
  };
}

// Birdperson in flight: a man's body in brown feathers with a tan breast,
// a bird's head with a hooked yellow beak and a crest, his belt and
// loincloth, legs trailing, great brown wings spread and beating.
function birdperson(k) {
  const BROWN = '#6b4a2c';
  const TAN = '#c9a274';
  const DARKB = '#3b2716';
  const BEAK = '#e2b450';
  const RED = '#7b2b1d';
  const L = [];
  L.push(ball(0.115, [0, 0, 0.17], [1, 0.78, 1.7], { color: BROWN }, 14));
  L.push(ball(0.1, [0, -0.03, 0.22], [0.88, 0.62, 1.35], { color: TAN }, 12));
  L.push(rod([0, 0.01, 0.3], [0, 0.045, 0.4], 0.048, 0.04, { color: BROWN }, 10));
  L.push(ball(0.07, [0, 0.055, 0.43], [0.9, 0.95, 1.12], { color: BROWN }, 14));
  L.push(ball(0.052, [0, 0.035, 0.45], [0.95, 0.75, 1], { color: TAN }, 10));
  // the beak, hooked down at its tip
  const tri = (w, h, y) => [[w / 2, y], [0, y + h / 2], [-w / 2, y], [0, y - h / 2]];
  L.push(
    part(
      loft([
        { z: 0.48, pts: tri(0.05, 0.044, 0.05) },
        { z: 0.535, pts: tri(0.032, 0.032, 0.042) },
        { z: 0.572, pts: tri(0.016, 0.02, 0.026) },
        { z: 0.588, pts: tri(0.006, 0.01, 0.008) },
        { z: 0.591, pts: tri(0.002, 0.004, -0.006) },
      ]),
      { color: BEAK },
    ),
  );
  for (const sx of [-1, 1]) {
    L.push(ball(0.015, [sx * 0.042, 0.078, 0.475], 1, { color: '#e6dcc0' }, 8));
    L.push(ball(0.009, [sx * 0.046, 0.08, 0.484], 1, { color: '#0d0d0d' }, 6));
  }
  // the crest, swept back from the crown
  for (let i = 0; i < 3; i++) {
    L.push(part(new THREE.ConeGeometry(0.02, 0.12, 4), { at: [(i - 1) * 0.024, 0.115 - Math.abs(i - 1) * 0.012, 0.37], rot: [-PI / 2 - 0.45, 0, 0], scale: [1, 1, 0.4], color: DARKB }));
  }
  // belt and loincloth
  L.push(part(new THREE.TorusGeometry(0.085, 0.016, 6, 18), { at: [0, -0.005, 0.02], scale: [1, 0.85, 1], color: RED }));
  L.push(part(plateXZ([[-0.04, 0], [0.04, 0], [0.03, -0.11], [-0.03, -0.11]], 0.006), { at: [0, -0.06, 0.01], rot: [-0.25, 0, 0], color: RED }));
  // arms along his sides
  for (const sx of [-1, 1]) {
    const sh = [sx * 0.085, 0.005, 0.3];
    const el = [sx * 0.105, -0.03, 0.16];
    const wr = [sx * 0.09, -0.045, 0.04];
    L.push(rod(sh, el, 0.03, 0.025, { color: BROWN }, 8), rod(el, wr, 0.025, 0.02, { color: BROWN }, 8));
    L.push(rod([sx * 0.1, -0.035, 0.11], [sx * 0.092, -0.044, 0.05], 0.025, 0.023, { color: RED }, 8));
    L.push(ball(0.022, [sx * 0.088, -0.05, 0.02], [0.8, 0.8, 1.2], { color: TAN }, 8));
    // legs trailing, the talons pointing back
    const hip = [sx * 0.045, -0.01, 0];
    const knee = [sx * 0.055, -0.035, -0.2];
    const ankle = [sx * 0.05, -0.02, -0.4];
    L.push(rod(hip, knee, 0.045, 0.034, { color: BROWN }, 8), ball(0.034, knee, 1, { color: DARKB }, 8), rod(knee, ankle, 0.034, 0.024, { color: DARKB }, 8));
    for (const [dx, dy] of [
      [-0.012, -0.005],
      [0, -0.012],
      [0.012, -0.005],
    ]) {
      L.push(part(new THREE.ConeGeometry(0.007, 0.05, 5), { at: [sx * 0.05 + dx, -0.02 + dy, -0.43], rot: [-PI / 2 + 0.25, 0, 0], color: BEAK }));
    }
  }
  // the wings: one mesh of both, flapped by moving its vertices
  const wingO = [[0, 0.05], [0.18, 0.09], [0.36, 0.06], [0.56, 0.0], [0.74, -0.06], [0.73, -0.12], [0.64, -0.1], [0.66, -0.18], [0.56, -0.14], [0.57, -0.23], [0.47, -0.18], [0.46, -0.26], [0.36, -0.2], [0.3, -0.24], [0.24, -0.21], [0.17, -0.24], [0.1, -0.21], [0.04, -0.22], [0, -0.16]].map(([x, z]) => [x * 0.88, z * 0.95]);
  const uv = (x, y, z) => [Math.abs(x) / 0.66, (z + 0.26) / 0.35];
  const wings = [];
  for (const sx of [-1, 1]) wings.push(part(plateXZ(wingO, 0.014), { at: [sx * 0.06, 0.07, 0.28], scale: [sx, 1, 1], to: 'wings', uv }));
  const feathers = canvasTexture(256, (g, S) => {
    // (drawn on the outline as first measured, before it was scaled to fit him)
    const P = (x, z) => [(x / 0.75) * S, (1 - (z + 0.27) / 0.37) * S];
    g.fillStyle = '#6a4a2c';
    g.fillRect(0, 0, S, S);
    // long flight feathers fanning from the arm, darker at their tips
    for (let i = 0; i < 26; i++) {
      const f = i / 25;
      const [x0, y0] = P(0.05 + f * 0.6, 0.0);
      const [x1, y1] = P(0.02 + f * 0.74, -0.27 + f * 0.1);
      const grad = g.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, '#7a5634');
      grad.addColorStop(0.7, '#5b3d22');
      grad.addColorStop(1, '#2e1e10');
      g.strokeStyle = grad;
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.strokeStyle = 'rgba(230,200,150,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    }
    // coverts along the leading edge, lighter
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 18; i++) {
        const [x, y] = P(0.02 + i * 0.04 + row * 0.02, 0.06 - row * 0.05 - i * 0.004);
        g.fillStyle = row === 0 ? '#9a7348' : row === 1 ? '#86613b' : '#77542f';
        g.beginPath();
        g.ellipse(x, y, 9, 13, 0.3, 0, PI * 2);
        g.fill();
      }
    }
  });
  const mats = {
    paint: standard(k, { roughness: 0.75, metalness: 0 }),
    wings: standard(k, { map: k.own(feathers), roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
  };
  const M = meshes(k, [...L, ...wings], mats);
  const flap = flapper(M.wings, 0.06, 0.07, 0.6);
  const pose = new THREE.Group();
  pose.add(M.paint, M.wings);
  return {
    root: [pose],
    update(t) {
      const w = t * PI * 2 * 1.3;
      flap(0.12 + 0.38 * sin(w));
      pose.position.y = -0.025 * sin(w);
    },
  };
}

const BUILD = { tie, interceptor, xwing, shuttle, destroyer, patrol, federation, gromflomite, meeseeks, birdperson, ...STARWARS_FLEET, ...RICKMORTY_FLEET };
// every kind there's a built model of
export const BUILT_KINDS = Object.keys(BUILD);

// A model's own things to free, and its own random numbers (the same every
// time for the same kind, so a model always looks the same).
export function makeKit(kind) {
  const owned = [];
  let s = [...kind].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return {
    own(x) {
      owned.push(x);
      return x;
    },
    rand() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    dispose() {
      for (const o of owned) o.dispose();
      owned.length = 0;
    },
  };
}

export function buildTraffic(kind) {
  if (!BUILD[kind]) kind = 'tie';
  return buildModel(BUILD[kind], kind);
}

// A model from its builder (one of BUILD's, or another fleet's that's put
// together the same way: the galaxy's, galaxy/fleet.js): built with a kit of
// its own, centred on its box and exactly 1 long in z.
export function buildModel(build, kind) {
  const k = makeKit(kind);
  const made = build(k);
  const body = new THREE.Group();
  body.add(...made.root);
  // centred on its own box, and exactly 1 long in z
  body.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(body, true);
  const size = box.getSize(new THREE.Vector3());
  const s = 1 / size.z;
  body.scale.setScalar(s);
  body.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-s);
  const group = new THREE.Group();
  group.name = `traffic-${kind}`;
  group.add(body);
  return {
    group,
    length: 1,
    size: size.multiplyScalar(s),
    update(t) {
      made.update?.(t);
    },
    dispose() {
      k.dispose();
    },
  };
}
