// The city behind the Cybertron page, in WebGL: Iacon, the Autobot capital,
// seen from among its towers, or Kaon, the Decepticons', built from the same
// kit and re-lit in furnace light. Tiered spires in plated metal with light
// along their edges and windows, skyways between them, flying traffic in the
// avenues, and the Hall of Records at the end of the great boulevard (Kaon
// raises its own citadel there instead), Optimus Prime standing colossal in
// its plaza (Megatron, in Kaon's). Two moons, a few stars, and haze the city
// fades into.
//
// The page tells it how far down the reader is (the camera glides up the
// boulevard and climbs over the city as they go), which side they are on and
// whether the site is light (a pale city by day) or dark (the night city).
// Everything that changes is a uniform: one draw of each kit piece, however
// the light falls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { LOOK as ART } from './look';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createLibrary } from '../../../lib/cc0';
import { disposeTree } from '../../../lib/stage3d';
import { megaGeometry } from '../rollout/kaon';
import { pixelRatio } from '../../../lib/device';
import { houseOn } from '../../../lib/three/house';
import { guard } from '../../../lib/three/frameGuard';
import { precompile, precompilePasses, quiet, releaseContext } from '../../../lib/three/renderer';
import { gltfLoader } from '../../../lib/three/gltf';
import { sharpen } from '../../../lib/three/textures';

const GROUND = -90; // the deck the towers stand on, deep in the haze
const HALL = { x: 0, z: -1150 }; // the Hall of Records, at the end of the boulevard
const PLAZA = 440; // the open ground around it
const HALL_SCALE = 0.8;
// the statues in the plaza, made with Meshy (public/models/meshy): how tall,
// and how far in front of the Hall, down the boulevard
const STATUE = { h: 520, ahead: 360, plinth: [280, 80, 200] };
const BLOCK = 140; // one city block, avenue to avenue
const FADE_S = 1; // seconds to change sides, or day for night

// ─── small helpers ─────────────────────────────────────────────────────────

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// faceted: no shared normals, no UVs (the plating is mapped from world position)
const flat = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('uv');
  n.computeVertexNormals();
  if (n !== g) g.dispose();
  return n;
};
const merge = (parts) => {
  const g = mergeGeometries(parts.map(flat));
  g.computeBoundingSphere();
  return g;
};

const UP = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// An n-sided prism from radius rb at y to rt at y + h, a flat face to the front.
function prism(rb, rt, h, n, y, { x = 0, z = 0, rot = 0, open = false, sz = 1 } = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, n, 1, open);
  g.rotateY(Math.PI / n + rot);
  if (sz !== 1) g.scale(1, 1, sz);
  g.translate(x, y + h / 2, z);
  return g;
}
// a thin ring of light around a prism's edge
const ring = (r, h, n, y, o = {}) => prism(r, r, h, n, y, { ...o, open: true });

// a corner of an n-sided prism of radius r, at height y
const corner = (r, y, k, n, { x = 0, z = 0, rot = 0, sz = 1 } = {}) => {
  const a = ((2 * k + 1) * Math.PI) / n + rot;
  return V(x + r * Math.sin(a), y, z + r * Math.cos(a) * sz);
};

// a square bar of side t from a to b
function beam(a, b, t, d = t) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.BoxGeometry(t, dir.length(), d);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

// A blade: a profile [radial, up] extruded t thick, standing out from the axis
// along +z, then turned to angle phi at radius r and height y.
function blade(pts, t, phi, r, y) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  g.rotateY(-Math.PI / 2);
  g.translate(0, y, r);
  g.rotateY(phi);
  return g;
}
// a point on a blade's profile, in the same frame
const onBlade = (a, b, phi, r, y) => V((r + a) * Math.sin(phi), y + b, (r + a) * Math.cos(phi));

// ─── the tower kit ─────────────────────────────────────────────────────────
// Each tower is about 1 unit across at the foot and 7 to 12 tall: a plinth
// with buttresses, tiers that taper and step back, collars where they meet,
// fins up the faces, and a crown with an antenna mast. Its lights (strips up
// the corners, rings at the collars, the fins' edges) are a mesh of their own.

const STYLES = [
  { seed: 11, n: 8, tiers: 5, first: 2.6, rest: [1.3, 2.2], taper: 0.88, step: 0.8, fins: 3, crown: 'needle', buttress: 4 },
  { seed: 23, n: 4, tiers: 4, first: 3.4, rest: [1.6, 2.6], taper: 0.9, step: 0.82, fins: 4, crown: 'blades', buttress: 4, blades: true },
  { seed: 37, n: 8, tiers: 6, first: 1.6, rest: [0.9, 1.4], taper: 0.92, step: 0.74, fins: 2, crown: 'dome', disc: 2, buttress: 0 },
  { seed: 41, n: 6, tiers: 3, first: 3.6, rest: [2.4, 3.2], taper: 0.86, step: 0.84, fins: 3, crown: 'blades', ribs: true, buttress: 3 },
  { seed: 53, n: 6, tiers: 4, first: 2.4, rest: [1.4, 2.0], taper: 0.9, step: 0.82, fins: 0, crown: 'needle', twin: true, buttress: 0 },
  { seed: 67, n: 8, tiers: 6, first: 2.2, rest: [1.0, 1.6], taper: 0.84, step: 0.8, fins: 2, crown: 'needle', buttress: 8, slim: true },
];
// the terraced blocks the towers stand among, filling the city's lower levels
const PODIUM = { seed: 91, n: 4, tiers: 3, first: 0.55, rest: [0.2, 0.34], taper: 0.97, step: 0.84, fins: 0, crown: 'roof', buttress: 0 };
// far away, a tower is a silhouette and some windows: fewer pieces, no light mesh
const FAR_STYLES = [
  { seed: 71, n: 6, tiers: 3, first: 3, rest: [1.8, 2.6], taper: 0.88, step: 0.78, fins: 0, crown: 'needle', buttress: 0, plain: true },
  { seed: 83, n: 4, tiers: 3, first: 3.4, rest: [1.4, 2.2], taper: 0.92, step: 0.8, fins: 0, crown: 'mast', buttress: 0, plain: true },
];

function tower(style) {
  const r = rng(style.seed);
  const body = [];
  const glow = [];
  const { n } = style;
  const lean = (a, b) => a + r() * (b - a);

  // one stack of tiers at (x, z), radius rad: returns where its crown starts
  const stack = (x, z, rad0, tiers) => {
    let y = 0.32;
    let rad = rad0;
    const at = { x, z };
    for (let t = 0; t < tiers; t++) {
      const h = t === 0 ? style.first * lean(0.9, 1.1) : lean(style.rest[0], style.rest[1]);
      const top = rad * style.taper;
      body.push(prism(rad, top, h, n, y, at));
      if (!style.plain) {
        // light up two or four of the corners, the full height of the tier
        for (let k = 0; k < n; k += n > 4 ? 2 : 1) {
          const a = corner(rad * 1.012, y + 0.04, k, n, at);
          const b = corner(top * 1.012, y + h - 0.04, k, n, at);
          glow.push(beam(a, b, 0.014));
        }
        // ribs on every corner of a ribbed tower
        if (style.ribs) for (let k = 0; k < n; k++) body.push(beam(corner(rad * 1.04, y, k, n, at), corner(top * 1.04, y + h, k, n, at), 0.05));
      }
      // fins up the faces of the lower tiers: blades with a slanted head
      if (t < style.fins) {
        const fd = rad * (style.blades ? 0.5 : 0.28);
        const rf = ((rad + top) / 2) * Math.cos(Math.PI / n) - 0.02;
        for (let k = 0; k < n; k += n > 4 ? 2 : 1) {
          if (style.blades && k % 2) continue;
          const phi = (2 * k * Math.PI) / n;
          const prof = [
            [0, 0],
            [fd * 0.55, 0],
            [fd, h * 0.18],
            [fd, h * 0.86],
            [0, h * 1.16],
          ];
          body.push(blade(prof, rad * 0.07, phi, rf, y));
          glow.push(beam(onBlade(fd + 0.012, h * 0.2, phi, rf, y), onBlade(fd + 0.012, h * 0.84, phi, rf, y), 0.02));
        }
      }
      // the collar where this tier meets the next, and its ring of light
      body.push(prism(top * 1.16, top * 1.1, 0.07, n, y + h, at));
      if (!style.plain || t === 0) glow.push(ring(top * 1.17, 0.022, n, y + h + 0.024, at));
      // a landing disc on one tier
      if (style.disc === t) {
        body.push(prism(rad * 1.9, rad * 1.8, 0.08, 16, y + h * 0.55, at));
        glow.push(ring(rad * 1.905, 0.024, 16, y + h * 0.55 + 0.03, at));
      }
      y += h + 0.07;
      rad = top * style.step;
    }
    return { y, rad };
  };

  // the plinth, and buttresses leaning in to the first tier
  body.push(prism(0.66, 0.6, 0.32, n, 0));
  for (let k = 0; k < style.buttress; k++) {
    const phi = (2 * k * Math.PI) / style.buttress + Math.PI / style.buttress;
    body.push(blade([[0, 0], [0.34, 0], [0.34, 0.12], [0, style.first * 0.62]], 0.08, phi, 0.4, 0.32));
    if (!style.plain) glow.push(beam(onBlade(0.345, 0.14, phi, 0.4, 0.32), onBlade(0.012, style.first * 0.6, phi, 0.4, 0.32), 0.018));
  }

  let crown;
  if (style.twin) {
    // two slender stacks with skybridges between them
    const a = stack(-0.34, 0, 0.22, style.tiers);
    const b = stack(0.34, 0, 0.2, style.tiers - 1);
    for (const y of [1.6, 3.4, 5.2]) {
      body.push(new THREE.BoxGeometry(0.36, 0.12, 0.14).translate(0, y, 0));
      glow.push(new THREE.BoxGeometry(0.36, 0.02, 0.15).translate(0, y - 0.04, 0));
    }
    body.push(prism(a.rad, 0.005, 2.2, n, a.y, { x: -0.34 }));
    body.push(prism(b.rad, 0.005, 1.4, n, b.y, { x: 0.34 }));
    crown = { y: a.y, rad: a.rad, x: -0.34, tip: a.y + 2.2 };
  } else {
    const s = stack(0, 0, style.slim ? 0.42 : 0.5, style.tiers);
    crown = { y: s.y, rad: s.rad, x: 0, tip: s.y };
    if (style.crown === 'needle') {
      const h = lean(1.8, 2.8);
      body.push(prism(s.rad, 0.004, h, n, s.y));
      if (!style.plain) for (let k = 0; k < n; k += 2) glow.push(beam(corner(s.rad * 1.01, s.y + 0.05, k, n), corner(0.01, s.y + h * 0.92, k, n), 0.016));
      crown.tip = s.y + h;
    } else if (style.crown === 'blades') {
      // a crown of blades leaning out round a short spire
      const h = lean(1.2, 1.7);
      for (let k = 0; k < n; k++) {
        const phi = (2 * k * Math.PI) / n;
        body.push(blade([[0, 0], [0.08, 0], [0.34, h * 0.8], [0.3, h], [0.02, h * 0.35]], 0.05, phi, s.rad * 0.8, s.y));
        if (!style.plain) glow.push(beam(onBlade(0.095, 0.05, phi, s.rad * 0.8, s.y), onBlade(0.345, h * 0.79, phi, s.rad * 0.8, s.y), 0.016));
      }
      body.push(prism(s.rad * 0.7, 0.004, h * 1.3, n, s.y));
      crown.tip = s.y + h * 1.3;
    } else if (style.crown === 'roof') {
      // machinery on a flat roof
      for (let k = 0; k < 4; k++) {
        const a = r() * Math.PI * 2;
        const d = r() * s.rad * 0.5;
        const bw = 0.06 + r() * 0.1;
        body.push(new THREE.BoxGeometry(bw, 0.05 + r() * 0.08, bw * (0.6 + r())).translate(Math.cos(a) * d, s.y + 0.04, Math.sin(a) * d));
      }
      return { body: merge(body), glow: merge(glow), crown };
    } else if (style.crown === 'dome') {
      const d = new THREE.SphereGeometry(s.rad * 1.05, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      d.scale(1, 0.55, 1);
      d.translate(0, s.y, 0);
      body.push(d);
      crown.tip = s.y + s.rad * 0.6;
    }
    // the antenna mast, and the light at its tip
    const mast = lean(1.2, 2.2);
    body.push(new THREE.CylinderGeometry(0.012, 0.03, mast, 4).translate(0, crown.tip + mast / 2 - 0.1, 0));
    body.push(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8).translate(0, crown.tip + mast * 0.45, 0));
    crown.tip += mast - 0.1;
  }
  return { body: merge(body), glow: glow.length ? merge(glow) : null, crown };
}

// Kaon's spikes: what grows on every roof when the Decepticons hold the city.
function spikeGeometry() {
  const parts = [new THREE.ConeGeometry(0.2, 2.8, 4).translate(0, 1.4, 0)];
  for (let k = 0; k < 5; k++) {
    const s = new THREE.ConeGeometry(0.09, 1.3 + (k % 2) * 0.7, 4).translate(0, 0.6 + (k % 2) * 0.35, 0);
    s.rotateZ(-0.42 - (k % 2) * 0.18);
    s.translate(0.42, 0, 0);
    s.rotateY((k / 5) * Math.PI * 2 + 0.3);
    parts.push(s);
  }
  return merge(parts);
}

// ─── the Hall of Records ───────────────────────────────────────────────────
// A great octagonal tower on a stepped plinth, eight buttress wings, five
// tiers with ribs and collars, a landing ring, a crown of blades round the
// spire, and the beacon at the top. In world units, standing on its plaza.

function hallOfRecords() {
  const body = [];
  const glow = [];
  const n = 8;
  body.push(prism(232, 222, 30, n, 0), prism(194, 184, 28, n, 30));
  glow.push(ring(223, 2.4, n, 26), ring(185, 2.4, n, 54));
  for (let k = 0; k < n; k++) {
    const phi = (2 * k * Math.PI) / n;
    body.push(blade([[0, 0], [160, 0], [160, 34], [130, 60], [34, 420], [0, 470]], 16, phi, 96, 0));
    glow.push(beam(onBlade(131, 64, phi, 96, 0), onBlade(37, 414, phi, 96, 0), 2.2));
    glow.push(beam(onBlade(161, 4, phi, 96, 0), onBlade(161, 32, phi, 96, 0), 2.2));
  }
  const tiers = [
    [118, 104, 240],
    [92, 82, 180],
    [74, 64, 140],
    [56, 47, 110],
    [41, 32, 90],
  ];
  let y = 58;
  tiers.forEach(([rb, rt, h], t) => {
    body.push(prism(rb, rt, h, n, y));
    for (let k = 0; k < n; k++) {
      body.push(beam(corner(rb + 3, y, k, n), corner(rt + 3, y + h, k, n), 6));
      if (k % 2 === t % 2) glow.push(beam(corner(rb + 6.4, y + 4, k, n), corner(rt + 6.4, y + h - 4, k, n), 1.5));
    }
    body.push(prism(rt * 1.22, rt * 1.14, 9, n, y + h));
    glow.push(ring(rt * 1.225, 2, n, y + h + 3.5));
    if (t === 2) {
      body.push(prism(170, 160, 7, 32, y + h * 0.5));
      glow.push(ring(170.5, 2, 32, y + h * 0.5 + 2.5));
    }
    y += h + 9;
  });
  // the crown: blades leaning out round the spire
  for (let k = 0; k < n; k++) {
    const phi = (2 * k * Math.PI) / n + Math.PI / n;
    body.push(blade([[0, 0], [12, 0], [44, 130], [36, 160], [2, 50]], 5, phi, 24, y - 40));
    glow.push(beam(onBlade(13.5, 4, phi, 24, y - 40), onBlade(45.5, 128, phi, 24, y - 40), 1.4));
  }
  const spire = 230;
  body.push(prism(30, 0.6, spire, n, y));
  for (let k = 0; k < n; k += 2) glow.push(beam(corner(30.5, y + 4, k, n), corner(1.4, y + spire * 0.9, k, n), 1.2));
  const g = merge(body);
  const l = merge(glow);
  g.scale(HALL_SCALE, HALL_SCALE, HALL_SCALE);
  l.scale(HALL_SCALE, HALL_SCALE, HALL_SCALE);
  return { body: g, glow: l, top: (y + spire) * HALL_SCALE };
}

// ─── the palettes ──────────────────────────────────────────────────────────
// Four lights on one city: Iacon by night and by day, Kaon by night and by
// day. Hex strings are colours as seen; arrays are light, in linear units,
// bright enough (above 1) for the bloom to find. The live uniforms are a
// blend of the four.

const PALETTES = {
  iacon: {
    night: {
      zenith: '#01040b', mid: '#071530', horizon: '#0f2c47', haze: '#1b4a66', glow: [0.03, 0.09, 0.15], glowDir: [-0.4, 0.42, -1],
      smoke: 0.25, smokeCol: '#081426', smokeLit: '#163a55', stars: 1, moonTint: [0.75, 0.82, 0.95], moonK: 0.9, moonOcc: 0.2, sunDir: [0.75, 0.28, 0.6],
      fogDen: 0.00052, lowHaze: 1.6,
      hemiSky: '#36557d', hemiGround: '#0a111d', hemiK: 1, keyCol: '#a5bfe0', keyK: 1.5, keyDir: [0.55, 0.5, 0.45], rimCol: '#2fbfff', rimK: 1.4, rimDir: [-0.5, 0.25, -0.8],
      envZ: '#0b1d38', envH: '#2a6386', envG: '#04070d', envK: 1.3,
      tintA: '#b7c3d3', tintB: '#7a90aa', tintC: '#4a5463', mapGain: 3.2,
      winA: [0.3, 1.3, 2.4], winB: [0.2, 0.55, 2.2], winK: 0.9, winCut: 0.6, winBand: 0.07, winRow: 6, winSeg: 14,
      stripA: [0.3, 1.5, 2.6], stripB: [0.25, 0.65, 2.4], stripK: 0.9, street: [0.03, 0.12, 0.22],
      trafA: [1.5, 1.85, 2.3], trafB: [0.4, 1.3, 2.6], trafK: 0.9, blink: [2.6, 0.25, 0.2], beacon: [0.7, 2.2, 3.6], beam: [0.1, 0.4, 0.75],
      edge: [0.5, 2, 3.5], bloom: 0.55, exposure: 1,
    },
    day: {
      zenith: '#5f93cc', mid: '#a3c4e4', horizon: '#f0e2c6', haze: '#f3e8d4', glow: [0.55, 0.42, 0.24], glowDir: [0.5, 0.3, -1],
      smoke: 0.3, smokeCol: '#eef3f7', smokeLit: '#ffffff', stars: 0, moonTint: [0.85, 0.9, 1], moonK: 0.22, moonOcc: 1, sunDir: [0.6, 0.6, 0.4],
      fogDen: 0.00036, lowHaze: 1.3,
      hemiSky: '#cfe2f8', hemiGround: '#5f6b7c', hemiK: 1.35, keyCol: '#ffe6bd', keyK: 3.1, keyDir: [0.55, 0.75, 0.45], rimCol: '#cfe6ff', rimK: 0.4, rimDir: [-0.6, 0.3, -0.7],
      envZ: '#6f9fd2', envH: '#f0e4cc', envG: '#5d6877', envK: 1.1,
      tintA: '#c2cedd', tintB: '#8399b4', tintC: '#4f5b6c', mapGain: 3,
      winA: [0.4, 1, 1.4], winB: [0.3, 0.6, 1.3], winK: 0.42, winCut: 0.6, winBand: 0.07, winRow: 6, winSeg: 14,
      stripA: [0.25, 1.1, 1.9], stripB: [0.25, 0.6, 1.7], stripK: 0.95, street: [0.02, 0.05, 0.08],
      trafA: [0.8, 1, 1.2], trafB: [0.4, 0.8, 1.3], trafK: 0.4, blink: [1.4, 0.3, 0.2], beacon: [0.5, 1.4, 2.2], beam: [0.03, 0.07, 0.11],
      edge: [0.5, 1.6, 2.6], bloom: 0.34, exposure: 1,
    },
  },
  kaon: {
    night: {
      zenith: '#070204', mid: '#250806', horizon: '#5c1606', haze: '#a8370b', glow: [1, 0.25, 0.04], glowDir: [0.15, 0.02, -1],
      smoke: 1, smokeCol: '#120606', smokeLit: '#6e1f08', stars: 0.12, moonTint: [1, 0.5, 0.38], moonK: 0.6, moonOcc: 0.2, sunDir: [-0.2, 0.1, -1],
      fogDen: 0.0006, lowHaze: 2.2,
      hemiSky: '#4f2219', hemiGround: '#b8420f', hemiK: 0.9, keyCol: '#ff7a33', keyK: 1.8, keyDir: [0.15, 0.12, -1], rimCol: '#8a46ff', rimK: 1, rimDir: [0.6, 0.35, 0.7],
      envZ: '#120508', envH: '#7a250b', envG: '#401105', envK: 1.2,
      tintA: '#6f6a74', tintB: '#524a56', tintC: '#2c272e', mapGain: 3.2,
      winA: [2.6, 0.75, 0.2], winB: [2.4, 0.28, 0.1], winK: 1.3, winCut: 0.76, winBand: 0.06, winRow: 9, winSeg: 3,
      stripA: [3.2, 0.4, 0.22], stripB: [1.7, 0.4, 3], stripK: 0.9, street: [0.6, 0.15, 0.03],
      trafA: [3, 0.65, 0.3], trafB: [1.8, 0.5, 2.8], trafK: 0.9, blink: [3, 0.3, 0.15], beacon: [3.6, 0.5, 0.22], beam: [0.8, 0.1, 0.04],
      edge: [3.5, 0.8, 0.2], bloom: 0.6, exposure: 1,
    },
    day: {
      zenith: '#8a6660', mid: '#c9987c', horizon: '#f2c49a', haze: '#f3d0ac', glow: [0.85, 0.4, 0.14], glowDir: [0.15, 0.1, -1],
      smoke: 0.7, smokeCol: '#a8948c', smokeLit: '#e8c0a0', stars: 0, moonTint: [1, 0.85, 0.78], moonK: 0.18, moonOcc: 1, sunDir: [-0.2, 0.4, -1],
      fogDen: 0.00042, lowHaze: 1.5,
      hemiSky: '#ecd2c0', hemiGround: '#7a5446', hemiK: 1.3, keyCol: '#ffcf9f', keyK: 2.7, keyDir: [0.4, 0.55, 0.6], rimCol: '#ffd0b0', rimK: 0.4, rimDir: [-0.6, 0.3, -0.7],
      envZ: '#b9a49a', envH: '#f0dccb', envG: '#77625a', envK: 1,
      tintA: '#b3adb3', tintB: '#8c858c', tintC: '#5a545a', mapGain: 3,
      winA: [1.4, 0.5, 0.18], winB: [1.2, 0.3, 0.12], winK: 0.5, winCut: 0.76, winBand: 0.06, winRow: 9, winSeg: 3,
      stripA: [1.8, 0.4, 0.22], stripB: [1.1, 0.4, 1.6], stripK: 0.9, street: [0.1, 0.04, 0.02],
      trafA: [1.2, 0.55, 0.3], trafB: [0.9, 0.5, 1.2], trafK: 0.4, blink: [1.4, 0.3, 0.2], beacon: [2, 0.5, 0.25], beam: [0.1, 0.03, 0.02],
      edge: [2.6, 0.8, 0.2], bloom: 0.34, exposure: 1,
    },
  },
};

// each palette, made of three.js values once
const prepared = (p) => {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'string') out[k] = new THREE.Color(v);
    else if (Array.isArray(v)) out[k] = k.endsWith('Dir') ? new THREE.Vector3(...v).normalize() : new THREE.Color(...v);
    else out[k] = v;
  }
  return out;
};
const PAL = {
  iaconNight: prepared(PALETTES.iacon.night),
  iaconDay: prepared(PALETTES.iacon.day),
  kaonNight: prepared(PALETTES.kaon.night),
  kaonDay: prepared(PALETTES.kaon.day),
};

// ─── the shaders ───────────────────────────────────────────────────────────

const HASH = /* glsl */ `
  float cyHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }`;

// The fog every surface shares: thicker low down, so the towers rise out of haze.
const FOG = /* glsl */ `
  {
    float fd = length(vCyW - cameraPosition);
    float low = 1.0 - smoothstep(${GROUND.toFixed(1)}, ${(GROUND + 300).toFixed(1)}, vCyW.y);
    float den = uFogDen * uFogK * (1.0 + uLowHaze * low * low);
    float ff = 1.0 - exp(-den * den * fd * fd);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogCol, ff);
  }`;

// Patches a standard or basic material for the city. Features, by define:
// CY_INFO     per-instance data (random, -, tint, -) from an aInfo attribute
// CY_PLATE    plating mapped from world position, the colour from a tint
// CY_WINDOWS  bands of lit windows, from world position
// CY_STRIP    a light strip: its colour from the palette
// CY_STREETS  glowing street lines on the deck
// CY_GROW     grows up from its foot as uGrow goes 0 to 1 (Kaon's spikes)
// CY_DISSOLVE 1: only Iacon's, -1: only Kaon's; it breaks up or builds in panels
// CY_OWNUV    keeps the model's own texture coordinates (the statues)
function cityMaterial(material, U, { defines = {}, fogK = 1, tile = 36, key }) {
  material.defines = { ...(material.defines || {}), ...defines };
  const own = { uFogK: { value: fogK }, uInfo: { value: new THREE.Vector4(0.5, 0, 0.5, 0) } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, own);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCyW;
        varying vec3 vCyN;
        varying vec4 vCyInfo;
        uniform vec4 uInfo;
        uniform float uGrow;
        #ifdef CY_INFO
          attribute vec4 aInfo;
        #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef CY_GROW
          transformed.y *= uGrow;
        #endif
        {
          #ifdef USE_INSTANCING
            mat4 cym = modelMatrix * instanceMatrix;
          #else
            mat4 cym = modelMatrix;
          #endif
          vCyW = (cym * vec4(transformed, 1.0)).xyz;
          vCyN = normalize(mat3(cym) * normal);
          #ifdef CY_INFO
            vCyInfo = aInfo;
          #else
            vCyInfo = uInfo;
          #endif
          #ifndef CY_OWNUV
          vec2 wuv = vec2((abs(vCyN.x) > abs(vCyN.z) ? vCyW.z : vCyW.x) / ${tile.toFixed(1)}, (abs(vCyN.y) > 0.7 ? vCyW.z : vCyW.y) / ${tile.toFixed(1)});
          #ifdef USE_MAP
            vMapUv = wuv;
          #endif
          #ifdef USE_NORMALMAP
            vNormalMapUv = wuv;
          #endif
          #ifdef USE_ROUGHNESSMAP
            vRoughnessMapUv = wuv;
          #endif
          #ifdef USE_AOMAP
            vAoMapUv = wuv;
          #endif
          #endif
        }`,
      );
    let fs = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCyW;
        varying vec3 vCyN;
        varying vec4 vCyInfo;
        uniform float uSide, uFogDen, uFogK, uLowHaze, uEnvK, uMapGain, uWinK, uWinCut, uWinBand, uWinRow, uWinSeg, uStripK;
        uniform vec3 uFogCol, uEnvZ, uEnvH, uEnvG, uTintA, uTintB, uTintC, uWinA, uWinB, uStripA, uStripB, uStreet, uEdge;
        ${HASH}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float cyEdge = 0.0;
        #ifdef CY_DISSOLVE
        {
          float dz = cyHash(floor(vCyW * 0.085) + 0.5);
          float dk = CY_DISSOLVE > 0 ? 1.0 - uSide : uSide;
          if (dz > dk) discard;
          cyEdge = (1.0 - smoothstep(0.0, 0.1, dk - dz)) * step(0.002, dk) * (1.0 - step(0.998, dk));
        }
        #endif`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef CY_PLATE
          #ifdef USE_MAP
            vec3 plate = texture2D(map, vMapUv).rgb;
            diffuseColor.rgb *= vec3(dot(plate, vec3(0.2126, 0.7152, 0.0722)) * uMapGain);
          #endif
          float tz = vCyInfo.z;
          diffuseColor.rgb *= tz < 0.5 ? mix(uTintA, uTintB, tz * 2.0) : mix(uTintB, uTintC, tz * 2.0 - 1.0);
        #else
          #include <map_fragment>
        #endif
        #ifdef CY_STRIP
          diffuseColor.rgb = mix(uStripA, uStripB, step(0.62, vCyInfo.x)) * uStripK * (0.75 + 0.5 * vCyInfo.x);
        #endif`,
      )
      .replace('#include <fog_fragment>', FOG);
    if (fs.includes('#include <emissivemap_fragment>')) {
      fs = fs.replace(
        '#include <emissivemap_fragment>',
        `totalEmissiveRadiance = vec3(0.0);
        #ifdef CY_WINDOWS
        {
          // floors of windows, cells along each face, some lit and some dark
          float upright = 1.0 - smoothstep(0.35, 0.7, abs(vCyN.y));
          float along = abs(vCyN.x) > abs(vCyN.z) ? vCyW.z : vCyW.x;
          float fy = (vCyW.y - ${GROUND.toFixed(1)}) / uWinRow;
          float f = fract(fy);
          float aa = fwidth(fy);
          float band = smoothstep(0.5 - uWinBand - aa, 0.5 - uWinBand + aa, f) * (1.0 - smoothstep(0.5 + uWinBand - aa, 0.5 + uWinBand + aa, f));
          float ca = along / uWinSeg;
          float cf = fract(ca);
          float gap = clamp(0.9 / uWinSeg, 0.04, 0.3);
          float mull = smoothstep(gap * 0.5, gap, cf) * (1.0 - smoothstep(1.0 - gap, 1.0 - gap * 0.5, cf));
          float rnd = cyHash(vec3(floor(ca), floor(fy), vCyInfo.x * 113.0 + 7.0));
          float lit = step(uWinCut, rnd) * (0.55 + 0.9 * fract(rnd * 31.7));
          float pattern = band * mull * lit;
          // far off, the bands become their average glow, not a shimmer
          pattern = mix(pattern, 2.0 * uWinBand * 0.9 * (1.0 - uWinCut), smoothstep(0.3, 0.9, aa));
          vec3 wc = mix(uWinA, uWinB, step(0.5, cyHash(vec3(floor(fy * 0.25), vCyInfo.x * 31.0, 3.0))));
          totalEmissiveRadiance = wc * pattern * upright * uWinK * step(${(GROUND + 8).toFixed(1)}, vCyW.y) * (0.6 + 0.8 * vCyInfo.x);
        }
        #endif
        #ifdef CY_STREETS
        {
          vec2 g = abs(fract((vCyW.xz - vec2(70.0, 60.0)) / ${BLOCK.toFixed(1)}) - 0.5);
          float line = smoothstep(0.47, 0.495, max(g.x, g.y));
          totalEmissiveRadiance = uStreet * line;
        }
        #endif
        totalEmissiveRadiance += uEdge * cyEdge * 3.0;`,
      );
    }
    if (fs.includes('#include <lights_fragment_maps>')) {
      // the sky in the metal: a reflection made from the palette, no cube map
      fs = fs.replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
        {
          vec3 rv = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
          vec3 sk = mix(uEnvH, uEnvZ, smoothstep(0.0, 0.7, rv.y));
          sk = mix(uEnvG, sk, smoothstep(-0.3, 0.06, rv.y));
          sk = mix(sk, (uEnvH + uEnvZ + uEnvG) / 3.0, material.roughness * 0.6);
          radiance += sk * uEnvK;
        }`,
      );
    }
    if (material.isMeshBasicMaterial) {
      // a basic strip: dissolve edges glow too
      fs = fs.replace('#include <opaque_fragment>', 'outgoingLight += uEdge * cyEdge * 3.0;\n#include <opaque_fragment>');
    }
    shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () => `cy-${key}`;
  material.userData.cy = own;
  return material;
}

const SKY = {
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = position;
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uZenith, uMid, uHorizon, uHaze, uGlow, uGlowDir, uFogCol, uMoonA, uMoonB, uMoonTint, uSunDir, uSmokeCol, uSmokeLit;
    uniform float uMoonK, uMoonOcc, uSmoke, uTime;
    varying vec3 vDir;
    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float a = 0.5, s = 0.0;
      for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
      return s;
    }
    // a moon: a lit sphere with a terminator, dark seas and a halo
    vec3 moon(vec3 col, vec3 d, vec3 m, float R, float seed) {
      float c = dot(d, m);
      float ang = acos(clamp(c, -1.0, 1.0));
      col += uMoonTint * uMoonK * 0.05 * exp(-max(ang - R, 0.0) * 30.0);
      if (ang < R * 1.02) {
        vec3 t1 = normalize(cross(m, vec3(0.0, 1.0, 0.0)));
        vec3 t2 = cross(t1, m);
        vec2 q = vec2(dot(d, t1), dot(d, t2)) / sin(R);
        float r2 = dot(q, q);
        vec3 nw = q.x * t1 + q.y * t2 - sqrt(max(0.0, 1.0 - r2)) * m;
        float lit = smoothstep(-0.05, 0.25, dot(nw, uSunDir));
        float sea = fbm(q * 2.2 + seed);
        float pits = smoothstep(0.62, 0.7, vnoise(q * 9.0 + seed * 3.0));
        vec3 mc = uMoonTint * ((0.55 + 0.6 * sea - 0.18 * pits) * lit + 0.035);
        col = mix(col, col * uMoonOcc + mc * uMoonK, smoothstep(1.0, 0.94, r2));
      }
      return col;
    }
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
      col = mix(col, uZenith, smoothstep(0.16, 0.8, h));
      col += uHaze * exp(-max(h, 0.0) * 9.0) * 0.6;
      float g = max(dot(d, uGlowDir), 0.0);
      col += uGlow * (pow(g, 3.0) * 0.4 + pow(g, 20.0) * 0.6) * smoothstep(-0.2, 0.05, h);
      // smoke, or thin cloud: streaks low over the city
      vec2 sp = d.xz / (max(h, 0.0) + 0.14) * 0.9 + vec2(uTime * 0.006, uTime * 0.002);
      float s = smoothstep(0.42, 0.85, fbm(sp)) * uSmoke * smoothstep(-0.02, 0.08, h) * (1.0 - smoothstep(0.25, 0.7, h));
      col = mix(col, mix(uSmokeLit, uSmokeCol, smoothstep(0.0, 0.3, h)), s * 0.85);
      col = moon(col, d, uMoonA, 0.085, 1.7);
      col = moon(col, d, uMoonB, 0.034, 9.3);
      col = mix(col, uFogCol, smoothstep(0.03, -0.06, h));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// Flying traffic: each vehicle a streak of light, a camera-facing quad from
// its head back along its lane, moved entirely on the GPU.
const TRAFFIC = {
  vertexShader: /* glsl */ `
    attribute vec2 corner;
    attribute vec3 aA;
    attribute vec3 aB;
    attribute vec4 aMove; // kind (0 line, 1 circle), speed, phase, length
    attribute vec2 aLook; // colour (0 or 1), brightness
    uniform float uTime, uFogDen, uLowHaze;
    uniform vec3 uTrafA, uTrafB;
    uniform float uTrafK;
    varying float vHead;
    varying float vSide;
    varying vec3 vCol;
    void main() {
      float circle = step(0.5, aMove.x);
      float L = mix(length(aB - aA), 6.2831853 * aB.x, circle);
      float t = fract(aMove.z + uTime * abs(aMove.y) / L);
      float tt = t - corner.x * aMove.w / L;
      vec3 pos;
      vec3 dir;
      if (circle < 0.5) {
        dir = normalize(aB - aA);
        pos = aA + (aB - aA) * tt;
      } else {
        float a = tt * 6.2831853 * sign(aMove.y);
        pos = aA + vec3(cos(a), 0.0, sin(a)) * aB.x;
        dir = vec3(-sin(a), 0.0, cos(a)) * sign(aMove.y);
      }
      vec3 toCam = cameraPosition - pos;
      float dist = length(toCam);
      vec3 side = normalize(cross(dir, toCam / dist));
      float w = max(0.7, dist * 0.0013);
      pos += side * corner.y * w;
      vHead = 1.0 - corner.x;
      vSide = corner.y;
      float low = 1.0 - smoothstep(${GROUND.toFixed(1)}, ${(GROUND + 300).toFixed(1)}, pos.y);
      float den = uFogDen * (1.0 + uLowHaze * low * low);
      float keep = exp(-den * den * dist * dist) * smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.95, 1.0, t));
      vCol = mix(uTrafA, uTrafB, aLook.x) * aLook.y * uTrafK * keep;
      gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying float vHead;
    varying float vSide;
    varying vec3 vCol;
    void main() {
      float a = pow(max(vHead, 0.0), 2.2) * max(0.0, 1.0 - vSide * vSide);
      gl_FragColor = vec4(vCol * a, 1.0);
    }`,
};

// Lights at the tips of the masts, blinking out of step.
const BLINK = {
  vertexShader: /* glsl */ `
    attribute float aPhase;
    uniform float uTime, uPx, uFogDen;
    varying float vOn;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float dist = -mv.z;
      gl_PointSize = clamp(uPx * 1400.0 / dist, 1.2 * uPx, 5.0 * uPx);
      float on = smoothstep(0.0, 0.08, fract(uTime * 0.55 + aPhase)) * (1.0 - smoothstep(0.3, 0.42, fract(uTime * 0.55 + aPhase)));
      vOn = on * exp(-uFogDen * uFogDen * dist * dist * 0.6);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uBlink;
    varying float vOn;
    void main() {
      vec2 q = gl_PointCoord - 0.5;
      float a = smoothstep(0.5, 0.0, length(q));
      gl_FragColor = vec4(uBlink * a * vOn, 1.0);
    }`,
};

const STARS = {
  vertexShader: /* glsl */ `
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime, uPx;
    varying float vK;
    void main() {
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
      gl_PointSize = aSize * uPx;
      vK = (0.75 + 0.25 * sin(uTime * (0.6 + aPhase) + aPhase * 40.0)) * smoothstep(0.04, 0.3, normalize(position).y);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uStars;
    varying float vK;
    void main() {
      vec2 q = gl_PointCoord - 0.5;
      float a = smoothstep(0.5, 0.1, length(q));
      gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * a * vK * uStars * 1.4, 1.0);
    }`,
};

// The beacon's beam: a cone of light up from the Hall's spire into the sky.
const BEAM = {
  vertexShader: /* glsl */ `
    varying float vUp;
    varying float vRim;
    void main() {
      vUp = uv.y;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vec3 n = normalize(mat3(modelMatrix) * normal);
      vRim = abs(dot(n, normalize(cameraPosition - w.xyz)));
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uBeam;
    varying float vUp;
    varying float vRim;
    void main() {
      float a = pow(max(1.0 - vUp, 0.0), 2.0) * smoothstep(0.0, 0.03, vUp) * vRim * vRim;
      gl_FragColor = vec4(uBeam * a, 1.0);
    }`,
};

// ─── the camera's road ─────────────────────────────────────────────────────
// Up the boulevard toward the Hall, then climbing and swinging round it to
// look out over the city: where it is, and what it looks at.
const PATH = [
  [36, 55, 380],
  [-22, 82, 150],
  [34, 128, -110],
  [200, 215, -400],
  [420, 360, -690],
  [560, 540, -940],
];
const LOOK = [
  [0, 300, -1150],
  [0, 320, -1150],
  [0, 380, -1150],
  [-20, 440, -1160],
  [-100, 450, -1200],
  [-280, 360, -1320],
];

// ─── the city ──────────────────────────────────────────────────────────────

export async function createCybertronBackdrop(canvas, { side = 0, dark = true, calm = false, onLost } = {}) {
  const renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true }));
  // (what arrives late is held back until it's ready, not waited for:
  // lib/three/frameGuard; the first frame drawn whole, as the city's
  // pictures aren't sent before it)
  guard(renderer, { firstWhole: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // (the house tone mapper: houseOn, below, before the first frame)
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 16 / 9, 2, 9000);

  // the scene, then bloom for the lights, then the tone map
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), ART.bloom.strength, ART.bloom.radius, ART.bloom.threshold);
  composer.addPass(bloom);
  const output = new OutputPass();
  composer.addPass(output);

  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // the plating: a scanned CC0 metal, loaded once; plain metal if it can't be
  const lib = createLibrary(renderer);
  // the statues: Optimus Prime in Iacon's plaza, Megatron in Kaon's (null if
  // one can't load: the plaza stands empty)
  const gltf = gltfLoader();
  const statue = (name) =>
    gltf
      .loadAsync(`/models/meshy/${name}.glb`)
      .then((g) => g.scene)
      .catch(() => null);
  const [plates, deck, optimusModel, megatronModel] = await Promise.all([lib.load('plate-road'), lib.load('plate-deck'), statue('optimus-prime'), statue('megatron')]);

  // the uniforms every city surface shares
  const U = {
    uTime: { value: 0 },
    uSide: { value: side },
    uGrow: { value: side },
    uFogCol: { value: new THREE.Color() },
    uFogDen: { value: 0.0006 },
    uLowHaze: { value: 2 },
    uEnvZ: { value: new THREE.Color() },
    uEnvH: { value: new THREE.Color() },
    uEnvG: { value: new THREE.Color() },
    uEnvK: { value: 1 },
    uMapGain: { value: 3 },
    uTintA: { value: new THREE.Color() },
    uTintB: { value: new THREE.Color() },
    uTintC: { value: new THREE.Color() },
    uWinA: { value: new THREE.Color() },
    uWinB: { value: new THREE.Color() },
    uWinK: { value: 1 },
    uWinCut: { value: 0.6 },
    uWinBand: { value: 0.2 },
    uWinRow: { value: 7 },
    uWinSeg: { value: 14 },
    uStripA: { value: new THREE.Color() },
    uStripB: { value: new THREE.Color() },
    uStripK: { value: 1 },
    uStreet: { value: new THREE.Color() },
    uEdge: { value: new THREE.Color() },
  };

  const metal = (extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.62, roughness: plates ? 1 : 0.5, ...extra });
    if (plates) {
      m.map = plates.color;
      m.normalMap = plates.normal;
      m.normalScale = new THREE.Vector2(1.1, 1.1);
      m.roughnessMap = plates.arm;
      m.aoMap = plates.arm;
      m.aoMapIntensity = 0.7;
    }
    return m;
  };
  const strip = () => new THREE.MeshBasicMaterial({ color: 0xffffff });

  const towerMat = cityMaterial(metal(), U, { defines: { CY_INFO: '', CY_PLATE: '', CY_WINDOWS: '' }, key: 'tower' });
  const towerGlow = cityMaterial(strip(), U, { defines: { CY_INFO: '', CY_STRIP: '' }, key: 'strip' });
  const bridgeMat = cityMaterial(metal(), U, { defines: { CY_INFO: '', CY_PLATE: '' }, key: 'bridge', tile: 24 });
  const spikeMat = cityMaterial(metal({ metalness: 0.75 }), U, { defines: { CY_INFO: '', CY_PLATE: '', CY_GROW: '' }, key: 'spike' });
  const hallMat = cityMaterial(metal(), U, { defines: { CY_PLATE: '', CY_WINDOWS: '', CY_DISSOLVE: '1' }, fogK: 0.72, key: 'hall' });
  const hallGlow = cityMaterial(strip(), U, { defines: { CY_STRIP: '', CY_DISSOLVE: '1' }, fogK: 0.72, key: 'hallstrip' });
  const citadelMat = cityMaterial(metal({ metalness: 0.75 }), U, { defines: { CY_INFO: '', CY_PLATE: '', CY_WINDOWS: '', CY_DISSOLVE: '-1' }, fogK: 0.72, key: 'citadel' });
  const plazaMat = cityMaterial(metal(), U, { defines: { CY_PLATE: '' }, fogK: 0.8, key: 'plaza', tile: 30 });
  hallMat.userData.cy.uInfo.value.set(0.7, 0, 0.18, 0);
  hallGlow.userData.cy.uInfo.value.set(0.2, 0, 0, 0);
  plazaMat.userData.cy.uInfo.value.set(0.5, 0, 0.7, 0);
  const groundMat = cityMaterial(
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: deck ? 1 : 0.6, map: deck?.color ?? null, normalMap: deck?.normal ?? null, roughnessMap: deck?.arm ?? null }),
    U,
    { defines: { CY_PLATE: '', CY_STREETS: '' }, key: 'ground', tile: 18 },
  );
  groundMat.userData.cy.uInfo.value.set(0.5, 0, 0.95, 0);

  // ── the camera's road, sampled, so nothing stands in its way
  const path = new THREE.CatmullRomCurve3(PATH.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const look = new THREE.CatmullRomCurve3(LOOK.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const samples = path.getSpacedPoints(160);
  const nearPath = (x, z) => {
    let best = Infinity;
    let y = 0;
    for (const s of samples) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < best) {
        best = d;
        y = s.y;
      }
    }
    return { d: best, y };
  };
  const segToPath = (a, b) => {
    let best = Infinity;
    const ab = new THREE.Vector3().subVectors(b, a);
    const l2 = ab.lengthSq();
    const p = new THREE.Vector3();
    for (const s of samples) {
      const t = clamp01(p.subVectors(s, a).dot(ab) / l2);
      best = Math.min(best, p.copy(a).addScaledVector(ab, t).distanceTo(s));
    }
    return best;
  };

  // ── the kit, and where each tower stands
  const kit = STYLES.map(tower);
  const farKit = FAR_STYLES.map(tower);
  const podiumKit = tower(PODIUM);
  const near = kit.map(() => []);
  const far = farKit.map(() => []);
  const podia = [];
  const placed = []; // for skyways, spikes and mast lights
  const farPlaced = [];
  const r = rng(1984);
  const hallD = (x, z) => Math.hypot(x - HALL.x, z - HALL.z);

  const stand = (list, kitItem, x, z, w, h, ry, info) => {
    // nothing in the camera's way: lower a tower under its road, or leave it out
    const { d, y } = nearPath(x, z);
    const reach = w * 0.85 + 26;
    const natural = kitItem.crown.tip;
    let sy = h / natural;
    if (d < reach) {
      const room = y - 32 - GROUND;
      if (room < natural * sy * 0.98) sy = room / natural;
      if (sy * natural < 70 || d < w * 0.5 + 8) return null;
    }
    const m = new THREE.Matrix4().compose(V(x, GROUND, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), V(w, sy, w * info.sz));
    list.push({ m, info });
    return { x, z, w, sy, crown: kitItem.crown, ry, sz: info.sz };
  };

  // the city blocks near the boulevard: detailed towers, one to three a block
  for (let bx = -8; bx < 8; bx++) {
    for (let bz = -14; bz < 7; bz++) {
      const cx = (bx + 0.5) * BLOCK;
      const cz = (bz + 0.5) * BLOCK - 10;
      if (Math.abs(cx) < 80) continue; // the boulevard
      if (hallD(cx, cz) < PLAZA + 40) continue;
      // the block itself, terraced, then the towers rising from it
      stand(podia, podiumKit, cx + (r() - 0.5) * 8, cz + (r() - 0.5) * 8, 96 + r() * 22, 24 + r() * 74, 0, { rand: r(), tint: 0.45 + r() * 0.5, sz: 0.8 + r() * 0.18 });
      const many = r() < 0.35 ? 2 : 1;
      for (let i = 0; i < many; i++) {
        const w = many > 1 ? 22 + r() * 12 : 32 + r() * 26;
        const off = many > 1 ? (i ? 1 : -1) * 26 : 0;
        const jx = (r() - 0.5) * (many > 1 ? 10 : 30);
        const jz = (r() - 0.5) * 30;
        const x = cx + jx + (r() < 0.5 ? off : 0);
        const z = cz + jz + (r() < 0.5 ? 0 : off);
        const v = Math.floor(r() * kit.length);
        const boost = 1 + 0.7 * Math.exp(-hallD(x, z) / 900);
        const h = (150 + r() * 210) * boost * (r() < 0.1 ? 1.55 : 1);
        const info = { rand: r(), tint: r(), sz: 0.78 + r() * 0.22 };
        const s = stand(near[v], kit[v], x, z, w, h, (Math.floor(r() * 4) * Math.PI) / 2 + (r() < 0.3 ? Math.PI / 8 : 0), info);
        if (s) placed.push(s);
      }
    }
  }
  // the city beyond: bigger, plainer towers out to the haze
  for (let bx = -14; bx < 14; bx++) {
    for (let bz = -18; bz < 6; bz++) {
      const cx = (bx + 0.5) * 260;
      const cz = (bz + 0.5) * 260 - 200;
      if (Math.abs(cx) < 1180 && cz > -2090 && cz < 1000) continue; // the detailed city
      if (r() < 0.22) continue;
      const x = cx + (r() - 0.5) * 120;
      const z = cz + (r() - 0.5) * 120;
      const v = Math.floor(r() * farKit.length);
      const w = 50 + r() * 60;
      const h = (300 + r() * 520) * (1 + 0.6 * Math.exp(-hallD(x, z) / 1600));
      const s = stand(far[v], farKit[v], x, z, w, h, r() * Math.PI, { rand: r(), tint: r(), sz: 0.8 + r() * 0.2 });
      if (s) farPlaced.push(s);
    }
  }

  const city = new THREE.Group();
  scene.add(city);
  const info = (list) => {
    const a = new Float32Array(list.length * 4);
    list.forEach((t, i) => a.set([t.info.rand, 0, t.info.tint, 0], i * 4));
    return new THREE.InstancedBufferAttribute(a, 4);
  };
  const instanced = (geo, mat, list) => {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((t, i) => mesh.setMatrixAt(i, t.m));
    mesh.count = list.length;
    mesh.computeBoundingSphere();
    mesh.frustumCulled = false;
    city.add(mesh);
    return mesh;
  };
  kit.forEach((k, v) => {
    if (!near[v].length) return;
    const a = info(near[v]);
    k.body.setAttribute('aInfo', a);
    instanced(k.body, towerMat, near[v]);
    if (k.glow) {
      k.glow.setAttribute('aInfo', a);
      instanced(k.glow, towerGlow, near[v]);
    }
  });
  if (podia.length) {
    const a = info(podia);
    podiumKit.body.setAttribute('aInfo', a);
    podiumKit.glow.setAttribute('aInfo', a);
    instanced(podiumKit.body, towerMat, podia);
    instanced(podiumKit.glow, towerGlow, podia);
  }
  farKit.forEach((k, v) => {
    if (!far[v].length) return;
    k.body.setAttribute('aInfo', info(far[v]));
    instanced(k.body, towerMat, far[v]);
    k.glow?.dispose();
  });

  // Kaon's spikes on every roof, grown when the Decepticons take the city
  const spikeList = placed.concat(farPlaced).map((p) => {
    const y = GROUND + p.crown.y * p.sy;
    const s = p.w * p.crown.rad * 1.5;
    const off = V(p.crown.x * p.w, 0, 0).applyAxisAngle(UP, p.ry);
    return { m: new THREE.Matrix4().compose(V(p.x + off.x, y, p.z + off.z), new THREE.Quaternion().setFromAxisAngle(UP, p.ry), V(s, p.w * 0.9, s)), info: { rand: 0.5, tint: 0.85 } };
  });
  const spikeGeo = spikeGeometry();
  spikeGeo.setAttribute('aInfo', info(spikeList));
  const spikes = instanced(spikeGeo, spikeMat, spikeList);

  // skyways between neighbours, clear of the camera's road
  const bridges = [];
  const used = new Set();
  placed.forEach((a, i) => {
    if (r() < 0.45) return;
    let best = -1;
    let bd = Infinity;
    placed.forEach((b, j) => {
      if (j === i || used.has(`${Math.min(i, j)}-${Math.max(i, j)}`)) return;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > 45 && d < 175 && d < bd) {
        bd = d;
        best = j;
      }
    });
    if (best < 0) return;
    const b = placed[best];
    const low = Math.min(a.crown.y * a.sy, b.crown.y * b.sy);
    const y = GROUND + low * (0.3 + r() * 0.5);
    const pa = V(a.x, y, a.z);
    const pb = V(b.x, y, b.z);
    if (segToPath(pa, pb) < 40) return;
    used.add(`${Math.min(i, best)}-${Math.max(i, best)}`);
    const len = pa.distanceTo(pb);
    const ry = Math.atan2(pb.x - pa.x, pb.z - pa.z);
    bridges.push({ m: new THREE.Matrix4().compose(V((pa.x + pb.x) / 2, y, (pa.z + pb.z) / 2), new THREE.Quaternion().setFromAxisAngle(UP, ry), V(7 + r() * 5, 5, len)), info: { rand: r(), tint: 0.3 + r() * 0.6 } });
  });
  const bridgeGeo = merge([new THREE.BoxGeometry(1, 0.42, 1), new THREE.BoxGeometry(0.46, 0.5, 1).translate(0, -0.42, 0), new THREE.BoxGeometry(1.12, 0.12, 1).translate(0, 0.24, 0)]);
  const bridgeGlowGeo = merge([new THREE.BoxGeometry(0.03, 0.05, 1).translate(0.575, 0.2, 0), new THREE.BoxGeometry(0.03, 0.05, 1).translate(-0.575, 0.2, 0), new THREE.BoxGeometry(0.1, 0.03, 1).translate(0, -0.68, 0)]);
  const bridgeInfo = info(bridges);
  bridgeGeo.setAttribute('aInfo', bridgeInfo);
  bridgeGlowGeo.setAttribute('aInfo', bridgeInfo);
  instanced(bridgeGeo, bridgeMat, bridges);
  instanced(bridgeGlowGeo, towerGlow, bridges);

  // the deck far below, and the plaza
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000).rotateX(-Math.PI / 2), groundMat);
  ground.position.y = GROUND;
  scene.add(ground);
  const plaza = new THREE.Mesh(merge([prism(PLAZA, PLAZA + 18, 46, 32, 0), prism(PLAZA - 40, PLAZA - 36, 6, 32, 46)]), plazaMat);
  plaza.position.set(HALL.x, GROUND, HALL.z);
  scene.add(plaza);

  // the Hall of Records, and the citadel Kaon raises in its place
  const hall = hallOfRecords();
  const hallMesh = new THREE.Mesh(hall.body, hallMat);
  const hallLights = new THREE.Mesh(hall.glow, hallGlow);
  const hallBase = GROUND + 50;
  for (const m of [hallMesh, hallLights]) {
    m.position.set(HALL.x, hallBase, HALL.z);
    scene.add(m);
  }
  // the statues before it, on a plinth, facing down the boulevard; each side's
  // breaks up or builds in panels with its city
  const statueAt = V(HALL.x, hallBase, HALL.z + STATUE.ahead);
  const [pw, ph, pd] = STATUE.plinth;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd).translate(0, ph / 2, 0), plazaMat);
  plinth.position.copy(statueAt);
  scene.add(plinth);
  const statues = [optimusModel, megatronModel].map((model, i) => {
    if (!model) return null;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const k = STATUE.h / Math.max(size.y, 1e-6);
    const holder = new THREE.Group();
    model.scale.setScalar(k);
    model.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
    holder.add(model);
    holder.position.copy(statueAt).add(V(0, ph, 0));
    model.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      o.material = cityMaterial(new THREE.MeshStandardMaterial({ map: src.map ?? null, color: src.color ?? 0xffffff, metalness: 0.55, roughness: 0.42 }), U, {
        defines: { CY_OWNUV: '', CY_DISSOLVE: i === 0 ? '1' : '-1' },
        fogK: 0.72,
        key: i === 0 ? 'statue-a' : 'statue-d',
      });
      src.dispose();
    });
    scene.add(holder);
    return holder;
  });
  // a megastructure from the Roll out kit, raised to the Hall's height, and
  // two lesser ones beside it
  const megaGeo = megaGeometry(4);
  megaGeo.computeBoundingBox();
  const megaH = megaGeo.boundingBox.max.y;
  const citadels = [
    { x: 0, z: 0, w: 290, h: 860, ry: 0.4 },
    { x: -340, z: 150, w: 110, h: 420, ry: 1.3 },
    { x: 330, z: 170, w: 100, h: 470, ry: 2.2 },
  ];
  const citadelTop = hallBase + citadels[0].h;
  const citadelList = citadels.map((c) => ({ m: new THREE.Matrix4().compose(V(HALL.x + c.x, hallBase, HALL.z + c.z), new THREE.Quaternion().setFromAxisAngle(UP, c.ry), V(c.w, c.h / megaH, c.w)), info: { rand: 0.4, tint: 0.55 } }));
  megaGeo.setAttribute('aInfo', info(citadelList));
  const citadel = new THREE.InstancedMesh(megaGeo, citadelMat, citadelList.length);
  citadelList.forEach((c, i) => citadel.setMatrixAt(i, c.m));
  citadel.frustumCulled = false;
  scene.add(citadel);

  // the beacon on the spire, and its beam up into the sky
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.12, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  beacon.scale.setScalar(150);
  scene.add(beacon);
  const beamU = { uBeam: { value: new THREE.Color() } };
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(70, 5, 3200, 24, 1, true).translate(0, 1600, 0), new THREE.ShaderMaterial({ ...BEAM, uniforms: beamU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  scene.add(beam);
  const hallTop = hallBase + hall.top;

  // ── the sky, its moons and its stars
  const skyU = {
    uZenith: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uHaze: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uGlowDir: { value: new THREE.Vector3(0, 0, -1) },
    uFogCol: U.uFogCol,
    uMoonA: { value: new THREE.Vector3(-0.4, 0.42, -1).normalize() },
    uMoonB: { value: new THREE.Vector3(0.36, 0.5, -1).normalize() },
    uMoonTint: { value: new THREE.Color() },
    uMoonK: { value: 1 },
    uMoonOcc: { value: 0.2 },
    uSunDir: { value: new THREE.Vector3(0.7, 0.3, 0.6).normalize() },
    uSmoke: { value: 0 },
    uSmokeCol: { value: new THREE.Color() },
    uSmokeLit: { value: new THREE.Color() },
    uTime: U.uTime,
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ ...SKY, uniforms: skyU, side: THREE.BackSide, depthWrite: false }));
  sky.scale.setScalar(6000);
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  scene.add(sky);

  const px = { value: 1 };
  const starU = { uTime: U.uTime, uPx: px, uStars: { value: 1 } };
  const starGeo = new THREE.BufferGeometry();
  {
    const sr = rng(7);
    const n = 700;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = sr() * Math.PI * 2;
      const y = 0.03 + Math.pow(sr(), 0.8) * 0.97;
      const rr = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * rr * 5500, y * 5500, Math.sin(a) * rr * 5500], i * 3);
      size[i] = 1 + Math.pow(sr(), 6) * 2.6;
      phase[i] = sr();
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  }
  const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({ ...STARS, uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  stars.frustumCulled = false;
  stars.renderOrder = -1;
  scene.add(stars);

  // ── lights on the mast tips
  const blinkU = { uTime: U.uTime, uPx: px, uFogDen: U.uFogDen, uBlink: { value: new THREE.Color() } };
  const blinkGeo = new THREE.BufferGeometry();
  {
    const pos = [];
    const phase = [];
    for (const p of placed) {
      const off = V(p.crown.x * p.w, 0, 0).applyAxisAngle(UP, p.ry);
      pos.push(p.x + off.x, GROUND + p.crown.tip * p.sy + 1, p.z + off.z);
      phase.push(r());
    }
    pos.push(HALL.x, hallTop - 60, HALL.z);
    phase.push(0.5);
    blinkGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    blinkGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  }
  const blinks = new THREE.Points(blinkGeo, new THREE.ShaderMaterial({ ...BLINK, uniforms: blinkU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  blinks.frustumCulled = false;
  scene.add(blinks);

  // ── flying traffic, in lanes down the avenues and round the Hall
  const trafU = { uTime: U.uTime, uFogDen: U.uFogDen, uLowHaze: U.uLowHaze, uTrafA: { value: new THREE.Color() }, uTrafB: { value: new THREE.Color() }, uTrafK: { value: 1 } };
  const lanes = [];
  const line = (a, b, look, gap) => {
    if (segToPath(a, b) < 34) return;
    lanes.push({ a, b, kind: 0, look, gap });
  };
  const tr = rng(77);
  for (const [x, y, back] of [
    [-50, -45, 1], [-36, -15, 1], [36, -15, 0], [50, -45, 0], [-58, 18, 1], [58, 22, 0], [-44, 235, 1], [44, 245, 0],
  ]) {
    const a = V(x, y, 1500);
    const b = V(x, y, HALL.z + PLAZA - 30);
    if (back) line(b, a, 1, 60 + tr() * 50);
    else line(a, b, 0, 60 + tr() * 50);
  }
  for (let k = -7; k <= 7; k++) {
    if (!k) continue;
    const x = k * BLOCK;
    for (const dir of [0, 1]) {
      if (tr() < 0.3) continue;
      const y = GROUND + 45 + tr() * 200;
      const xx = x + (dir ? 7 : -7);
      const a = V(xx, y, 1300);
      const b = V(xx, y, -2300);
      if (dir) line(b, a, 1, 110 + tr() * 140);
      else line(a, b, 0, 110 + tr() * 140);
    }
  }
  for (let k = -14; k <= 7; k++) {
    const z = k * BLOCK - 10;
    if (Math.abs(z - HALL.z) < PLAZA) continue;
    for (const dir of [0, 1]) {
      if (tr() < 0.35) continue;
      const y = GROUND + 45 + tr() * 200;
      const zz = z + (dir ? 7 : -7);
      const a = V(-1500, y, zz);
      const b = V(1500, y, zz);
      if (dir) line(b, a, 1, 120 + tr() * 160);
      else line(a, b, 0, 120 + tr() * 160);
    }
  }
  // high lanes across the whole city
  for (let i = 0; i < 3; i++) {
    const y = 420 + tr() * 220;
    const a = V(-2600, y, -400 - tr() * 2200);
    const b = V(2600, y, -400 - tr() * 2200);
    line(i % 2 ? b : a, i % 2 ? a : b, i % 2, 140);
  }
  // round the Hall
  for (let i = 0; i < 3; i++) lanes.push({ c: V(HALL.x, hallBase + 120 + i * 150, HALL.z), rad: 236 + i * 8, kind: 1, look: i % 2, gap: 80 + tr() * 30, dir: i % 2 ? 1 : -1 });

  const cars = [];
  for (const l of lanes) {
    const L = l.kind ? Math.PI * 2 * l.rad : l.a.distanceTo(l.b);
    const count = Math.max(2, Math.floor(L / l.gap));
    const speed = (l.kind ? 70 : 90) + tr() * 70;
    for (let i = 0; i < count; i++) {
      const phase = (i + tr() * 0.6) / count;
      const len = 18 + tr() * 24;
      const bright = 0.6 + tr() * 0.8;
      if (l.kind) cars.push([l.c.x, l.c.y, l.c.z, l.rad, 0, 0, 1, speed * l.dir, phase, len, l.look, bright]);
      else cars.push([l.a.x, l.a.y, l.a.z, l.b.x, l.b.y, l.b.z, 0, speed, phase, len, l.look, bright]);
    }
  }
  const trafGeo = new THREE.InstancedBufferGeometry();
  trafGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  trafGeo.setAttribute('corner', new THREE.Float32BufferAttribute([0, -1, 0, 1, 1, -1, 1, 1], 2));
  trafGeo.setIndex([0, 2, 1, 1, 2, 3]);
  {
    const A = new Float32Array(cars.length * 3);
    const B = new Float32Array(cars.length * 3);
    const M = new Float32Array(cars.length * 4);
    const K = new Float32Array(cars.length * 2);
    cars.forEach((c, i) => {
      A.set(c.slice(0, 3), i * 3);
      B.set(c.slice(3, 6), i * 3);
      M.set(c.slice(6, 10), i * 4);
      K.set(c.slice(10, 12), i * 2);
    });
    trafGeo.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 3));
    trafGeo.setAttribute('aB', new THREE.InstancedBufferAttribute(B, 3));
    trafGeo.setAttribute('aMove', new THREE.InstancedBufferAttribute(M, 4));
    trafGeo.setAttribute('aLook', new THREE.InstancedBufferAttribute(K, 2));
    trafGeo.instanceCount = cars.length;
  }
  const traffic = new THREE.Mesh(trafGeo, new THREE.ShaderMaterial({ ...TRAFFIC, uniforms: trafU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  traffic.frustumCulled = false;
  scene.add(traffic);

  // ── lights: the sky above, the ground's glow below, a key and a rim
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  const key = new THREE.DirectionalLight(0xffffff, 1);
  const rim = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(hemi, key, key.target, rim, rim.target);
  // the house look (lib/three/house) on the statues, the Hall and the
  // citadel: the shade one colour from the sky light, under the house tone
  // mapper (its exposure on top of each palette's, which were set under ACES;
  // the city's own shaders and its fog left as they are)
  const house = houseOn({ renderer, scene, sun: key, hemi, look: { fog: false } });

  // ── the light, blended from the four palettes
  const live = { side, dark: dark ? 1 : 0 };
  const goal = { side, dark: dark ? 1 : 0 };
  const tmpA = new THREE.Color();
  const tmpB = new THREE.Color();
  const tmpV = new THREE.Vector3();
  const tmpW = new THREE.Vector3();
  // a value of the blend: night or day, Iacon or Kaon
  const pick = (k) => {
    const s = smooth(live.side);
    const n = smooth(live.dark);
    const a = PAL.iaconDay[k];
    if (typeof a === 'number') {
      const i = a + (PAL.iaconNight[k] - a) * n;
      const j = PAL.kaonDay[k] + (PAL.kaonNight[k] - PAL.kaonDay[k]) * n;
      return i + (j - i) * s;
    }
    if (a.isVector3) {
      tmpV.copy(a).lerp(PAL.iaconNight[k], n);
      tmpW.copy(PAL.kaonDay[k]).lerp(PAL.kaonNight[k], n);
      return tmpV.lerp(tmpW, s).normalize();
    }
    tmpA.copy(a).lerp(PAL.iaconNight[k], n);
    tmpB.copy(PAL.kaonDay[k]).lerp(PAL.kaonNight[k], n);
    return tmpA.lerp(tmpB, s);
  };
  const light = () => {
    for (const [u, k] of [
      [skyU.uZenith, 'zenith'], [skyU.uMid, 'mid'], [skyU.uHorizon, 'horizon'], [skyU.uHaze, 'haze'], [skyU.uGlow, 'glow'], [skyU.uMoonTint, 'moonTint'], [skyU.uSmokeCol, 'smokeCol'], [skyU.uSmokeLit, 'smokeLit'],
      [U.uEnvZ, 'envZ'], [U.uEnvH, 'envH'], [U.uEnvG, 'envG'], [U.uTintA, 'tintA'], [U.uTintB, 'tintB'], [U.uTintC, 'tintC'], [U.uWinA, 'winA'], [U.uWinB, 'winB'],
      [U.uStripA, 'stripA'], [U.uStripB, 'stripB'], [U.uStreet, 'street'], [U.uEdge, 'edge'], [trafU.uTrafA, 'trafA'], [trafU.uTrafB, 'trafB'], [blinkU.uBlink, 'blink'], [beamU.uBeam, 'beam'],
    ]) u.value.copy(pick(k));
    for (const [u, k] of [
      [skyU.uMoonK, 'moonK'], [skyU.uSmoke, 'smoke'], [starU.uStars, 'stars'], [U.uFogDen, 'fogDen'], [U.uLowHaze, 'lowHaze'], [U.uEnvK, 'envK'], [U.uMapGain, 'mapGain'],
      [U.uWinK, 'winK'], [U.uWinCut, 'winCut'], [U.uWinBand, 'winBand'], [U.uWinRow, 'winRow'], [U.uWinSeg, 'winSeg'], [U.uStripK, 'stripK'], [trafU.uTrafK, 'trafK'], [skyU.uMoonOcc, 'moonOcc'],
    ]) u.value = pick(k);
    skyU.uGlowDir.value.copy(pick('glowDir'));
    skyU.uSunDir.value.copy(pick('sunDir'));
    // the fog is the colour of the sky at the horizon
    U.uFogCol.value.copy(skyU.uHaze.value).multiplyScalar(0.6).add(skyU.uHorizon.value);
    hemi.color.copy(pick('hemiSky'));
    hemi.groundColor.copy(pick('hemiGround'));
    hemi.intensity = pick('hemiK');
    key.color.copy(pick('keyCol'));
    key.intensity = pick('keyK');
    key.position.copy(pick('keyDir')).multiplyScalar(1000);
    rim.color.copy(pick('rimCol'));
    rim.intensity = pick('rimK');
    rim.position.copy(pick('rimDir')).multiplyScalar(1000);
    beacon.material.color.copy(pick('beacon'));
    bloom.strength = pick('bloom');
    renderer.toneMappingExposure = pick('exposure') * house.exposure;
    house.follow();
    // Iacon's Hall goes and Kaon's citadel comes, panel by panel; spikes grow
    const s = live.side;
    U.uSide.value = s;
    U.uGrow.value = smooth(clamp01((s - 0.25) / 0.75));
    spikes.visible = U.uGrow.value > 0.002;
    hallMesh.visible = hallLights.visible = s < 0.999;
    citadel.visible = s > 0.001;
    if (statues[0]) statues[0].visible = s < 0.999;
    if (statues[1]) statues[1].visible = s > 0.001;
    beacon.position.set(HALL.x, hallTop + (citadelTop - hallTop) * smooth(s) + 4, HALL.z);
    beam.position.copy(beacon.position);
  };

  // ── the camera
  const view = { p: 0, goal: 0, t: 0 };
  let calmNow = calm;
  let tall = 1;
  const camAt = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const place = () => {
    const p = clamp01(view.p);
    path.getPoint(p, camAt);
    look.getPoint(p, camLook);
    if (!calmNow) {
      // a gentle drift, as if the camera were hanging in the air
      const t = view.t;
      camAt.x += Math.sin(t * 0.11) * 7 + Math.sin(t * 0.047) * 5;
      camAt.y += Math.sin(t * 0.13 + 1) * 4;
      camAt.z += Math.cos(t * 0.09) * 6;
      camLook.x += Math.sin(t * 0.06 + 2) * 18;
      camLook.y += Math.sin(t * 0.08) * 10;
    }
    // a tall screen stands a little further back and looks a little higher
    if (tall > 1) {
      tmpV.subVectors(camAt, camLook).normalize();
      camAt.addScaledVector(tmpV, (tall - 1) * 90);
      camLook.y += (tall - 1) * 60;
    }
    camera.position.copy(camAt);
    camera.lookAt(camLook);
    sky.position.copy(camAt);
    stars.position.copy(camAt);
  };

  let size = { w: 1, h: 1 };
  let ratioCap = pixelRatio(1.5); // lib/device: 1 on a weak device
  const resize = (w, h) => {
    size = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
    // at most 1.5 device pixels a pixel, and about three million in all
    const ratio = Math.min(ratioCap, window.devicePixelRatio || 1, Math.sqrt(3.0e6 / (size.w * size.h)));
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(size.w, size.h);
    px.value = ratio;
    camera.aspect = size.w / size.h;
    tall = Math.max(1, 1.1 / camera.aspect);
    camera.fov = camera.aspect >= 1 ? 50 : Math.min(72, 50 + (1 - camera.aspect) * 34);
    camera.updateProjectionMatrix();
  };

  // Moves the camera, the fades and the clock on by ms; says whether
  // anything is still on its way (the traffic is always moving, unless calm).
  const update = (ms = 16) => {
    const dt = Math.min(0.25, ms / 1000);
    let busy = false;
    if (calmNow) {
      view.p = view.goal;
      live.side = goal.side;
      live.dark = goal.dark;
    } else {
      view.t += dt;
      U.uTime.value += dt;
      const k = 1 - Math.exp(-2.6 * dt);
      const dp = view.goal - view.p;
      view.p += dp * k;
      if (Math.abs(dp) > 0.0004) busy = true;
      else view.p = view.goal;
      for (const f of ['side', 'dark']) {
        const d = goal[f] - live[f];
        if (Math.abs(d) > 1e-4) {
          live[f] += Math.sign(d) * Math.min(Math.abs(d), dt / FADE_S);
          busy = true;
        } else live[f] = goal[f];
      }
    }
    light();
    place();
    return busy;
  };

  const draw = () => {
    if (lost) return;
    renderer.info.reset();
    composer.render();
  };

  // when frames run long: fewer pixels, then no bloom
  let level = 0;
  const degrade = () => {
    level += 1;
    if (level === 1) {
      ratioCap = 1;
      resize(size.w, size.h);
      return true;
    }
    if (level === 2) {
      bloom.enabled = false;
      return true;
    }
    return false;
  };

  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    disposeTree(scene);
    kit.forEach((k) => k.glow?.dispose());
    glowTex.dispose();
    lib.dispose();
    composer.dispose?.();
    bloom.dispose?.();
    output.dispose?.();
    target.dispose();
    renderer.dispose();
    releaseContext(renderer); // (lib/three/renderer: once nothing is compiling)
  };

  light();
  place();
  house.follow({ adopt: true });
  // every shader (the city's, into the composer's buffer, and the passes')
  // linked in the background before the first frame, so drawing it doesn't stop the page
  await Promise.all([precompile(renderer, scene, camera, scene, composer.readBuffer), precompilePasses(renderer, composer, camera)]);

  return {
    renderer,
    scene,
    camera,
    resize,
    update,
    draw,
    degrade,
    dispose,
    setProgress: (p) => {
      view.goal = clamp01(p);
    },
    setSide: (s) => {
      goal.side = s;
    },
    setDark: (d) => {
      goal.dark = d ? 1 : 0;
    },
    setCalm: (c) => {
      calmNow = c;
    },
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, points: renderer.info.render.points, lines: renderer.info.render.lines, towers: placed.length, cars: cars.length, bridges: bridges.length }),
    get lost() {
      return lost;
    },
  };
}
