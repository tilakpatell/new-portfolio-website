// Dot Matrix, the world, in WebGL: the island from ./rules.js built in code
// (the tiles as columns of ground, the trees, rocks, houses, pipes, signs,
// the dock, Block Drop tower, the snake's pen, the cloud, and the giant Game
// Boy in the square, whose screen runs the real console's demo), the hero,
// the walkers, the plants and the snake. Everything is grey: it's drawn
// small, then ./dither.js turns brightness into the four shades.
//
// It draws what the component hands it every frame and decides nothing.
//
// createDotMatrix(canvas, { onLost }) returns { render(state, ms), fx(type,
// data), screenOf(x, y, z), setPalette(id), resize(w, h), dispose(), lost,
// info }.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRenderer, disposeTree, precompile } from '../../lib/three/renderer';
import { device } from '../../lib/device';
import { H as SCREEN_H, W as SCREEN_W } from '../../stages/gb/font';
import { newConsole, renderConsole, stepConsole } from '../../stages/gb/console';
import { createDither, shadeValue } from './dither';
import {
  BLOCKS,
  BLOCK_LO,
  CARTRIDGES,
  CLOUD,
  COINS,
  GAMEBOY,
  H,
  MAP,
  PIPES,
  SIGNS,
  TOWER,
  W,
  WALKERS,
  WALKER_BACK,
  WATER,
  floorAt,
  legend,
  pipeTop,
  plantOut,
  snakeAt,
  walkerAt,
} from './rules';

// a grey as it should look (0 black, 1 white), in the linear working space
const grey = (v) => new THREE.Color().setRGB(v, v, v, THREE.SRGBColorSpace);
const lambert = (v, o = {}) => new THREE.MeshLambertMaterial({ color: grey(v), ...o });

// a seeded random, so the island's scatter is the same every visit
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── little pixel textures ──

function pixels(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
const hex = (v) => {
  const n = Math.round(v * 255);
  return `rgb(${n},${n},${n})`;
};
// a block: a face with a dark rim, a lit top-left and a shaded bottom-right
const blockFace = (face, mark) =>
  pixels(16, (g, s) => {
    g.fillStyle = hex(face);
    g.fillRect(0, 0, s, s);
    g.fillStyle = hex(Math.min(1, face + 0.2));
    g.fillRect(1, 1, s - 2, 1);
    g.fillRect(1, 1, 1, s - 2);
    g.fillStyle = hex(face * 0.6);
    g.fillRect(1, s - 2, s - 2, 1);
    g.fillRect(s - 2, 1, 1, s - 2);
    g.fillStyle = hex(0.08);
    g.strokeStyle = hex(0.08);
    g.fillRect(0, 0, s, 1);
    g.fillRect(0, s - 1, s, 1);
    g.fillRect(0, 0, 1, s);
    g.fillRect(s - 1, 0, 1, s);
    mark?.(g, s);
  });
const QUESTION = ['0111100', '1100110', '0000110', '0001100', '0011000', '0000000', '0011000'];
const glyph = (rows, x0, y0, colour) => (g) => {
  g.fillStyle = colour;
  rows.forEach((r, y) => [...r].forEach((b, x) => b === '1' && g.fillRect(x0 + x, y0 + y, 1, 1)));
};
const bricks = () =>
  pixels(16, (g, s) => {
    g.fillStyle = hex(0.62);
    g.fillRect(0, 0, s, s);
    g.fillStyle = hex(0.22);
    for (let y = 0; y < s; y += 4) {
      g.fillRect(0, y, s, 1);
      const off = (y / 4) % 2 ? 4 : 0;
      for (let x = off; x < s; x += 8) g.fillRect(x, y, 1, 4);
    }
  });
const planks = () =>
  pixels(16, (g, s) => {
    g.fillStyle = hex(0.7);
    g.fillRect(0, 0, s, s);
    g.fillStyle = hex(0.3);
    for (let x = 0; x < s; x += 4) g.fillRect(x, 0, 1, s);
    g.fillRect(2, 3, 1, 1);
    g.fillRect(10, 11, 1, 1);
  });

// ── the ground ──

// what the ground is at a tile, for building (the tower's tiles are grass;
// the sea, the stepping stones and the dock have none of their own)
const groundOf = (ix, iz) => {
  if (ix < 0 || iz < 0 || ix >= W || iz >= H) return null;
  const t = legend(MAP[iz][ix]);
  if (t.ground <= WATER) return null;
  return { kind: t.kind, y: t.ground };
};

function buildTerrain() {
  const pos = [];
  const nor = [];
  const col = [];
  const c = new THREE.Color();
  const quad = (v, n, shade) => {
    c.copy(grey(shade));
    for (const i of [0, 1, 2, 0, 2, 3]) {
      pos.push(...v[i]);
      nor.push(...n);
      col.push(c.r, c.g, c.b);
    }
  };
  const TOP = { grass: 0.64, long: 0.56, path: 0.93, sand: 0.99, tree: 0.64, boulder: 0.64, wall: 0.64, house: 0.64, gameboy: 0.93, pipe: 0.64, sign: 0.64 };
  const SIDE = { sand: 0.82, path: 0.6 };
  const BOTTOM = -1.4;
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const g = groundOf(ix, iz);
      if (!g) continue;
      const y = g.y;
      const check = (ix + iz) % 2 ? 0.05 : 0;
      quad(
        [
          [ix, y, iz],
          [ix, y, iz + 1],
          [ix + 1, y, iz + 1],
          [ix + 1, y, iz],
        ],
        [0, 1, 0],
        (TOP[g.kind] ?? 0.64) - check,
      );
      // the sides that show: wherever the neighbour's ground is lower
      const sides = [
        [1, 0, [1, 0, 0], (lo, hi) => [[ix + 1, lo, iz + 1], [ix + 1, lo, iz], [ix + 1, hi, iz], [ix + 1, hi, iz + 1]]],
        [-1, 0, [-1, 0, 0], (lo, hi) => [[ix, lo, iz], [ix, lo, iz + 1], [ix, hi, iz + 1], [ix, hi, iz]]],
        [0, 1, [0, 0, 1], (lo, hi) => [[ix, lo, iz + 1], [ix + 1, lo, iz + 1], [ix + 1, hi, iz + 1], [ix, hi, iz + 1]]],
        [0, -1, [0, 0, -1], (lo, hi) => [[ix + 1, lo, iz], [ix, lo, iz], [ix, hi, iz], [ix + 1, hi, iz]]],
      ];
      for (const [dx, dz, n, face] of sides) {
        const nb = groundOf(ix + dx, iz + dz);
        const lo = nb ? nb.y : BOTTOM;
        if (lo >= y) continue;
        // in bands a unit high, alternately darker, like the cliffs of a tile map
        for (let b = Math.floor(lo); b < y; b++) {
          const a = Math.max(lo, b);
          const top = Math.min(y, b + 1);
          if (top <= a) continue;
          const shade = (SIDE[g.kind] ?? 0.52) - (((b % 2) + 2) % 2) * 0.06;
          quad(face(a, top), n, shade);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

// the sea: ripples that come and go, so the dither shimmers, and foam where
// it meets the land
function buildSea() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vPos = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uCam;
      varying vec3 vPos;
      void main() {
        vec2 p = vPos.xz;
        float a = sin(p.x * 1.1 + uTime * 1.3) * sin(p.y * 0.9 - uTime * 0.9);
        float b = sin((p.x + p.y) * 0.55 - uTime * 0.7);
        float v = 0.44 + 0.07 * a + 0.04 * b;
        // the odd bright crest
        v += 0.3 * smoothstep(0.86, 0.98, sin(p.x * 0.7 + p.y * 1.6 + uTime * 1.1) * sin(p.y * 0.5 - uTime * 0.4 + p.x * 0.2));
        float f = smoothstep(26.0, 72.0, distance(vPos, uCam));
        v = mix(v, 1.0, f);
        gl_FragColor = vec4(vec3(pow(v, 2.2)), 1.0);
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(320, 320).rotateX(-Math.PI / 2), mat);
  sea.position.set(W / 2, WATER, H / 2);
  // foam: a strip along every edge where land meets the sea
  const strips = [];
  const isLand = (ix, iz) => Boolean(groundOf(ix, iz)) || (MAP[iz]?.[ix] ?? '~') === 'B';
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      if (!isLand(ix, iz)) continue;
      const w = 0.28;
      if (!isLand(ix + 1, iz)) strips.push(new THREE.PlaneGeometry(w, 1).rotateX(-Math.PI / 2).translate(ix + 1 + w / 2, 0, iz + 0.5));
      if (!isLand(ix - 1, iz)) strips.push(new THREE.PlaneGeometry(w, 1).rotateX(-Math.PI / 2).translate(ix - w / 2, 0, iz + 0.5));
      if (!isLand(ix, iz + 1)) strips.push(new THREE.PlaneGeometry(1, w).rotateX(-Math.PI / 2).translate(ix + 0.5, 0, iz + 1 + w / 2));
      if (!isLand(ix, iz - 1)) strips.push(new THREE.PlaneGeometry(1, w).rotateX(-Math.PI / 2).translate(ix + 0.5, 0, iz - w / 2));
    }
  }
  const foam = new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({ color: grey(0.97) }));
  for (const s of strips) s.dispose();
  foam.position.y = WATER + 0.015;
  return { sea, foam, mat };
}

function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        float v = mix(1.0, 0.8, smoothstep(0.05, 0.75, vDir.y));
        gl_FragColor = vec4(vec3(pow(v, 2.2)), 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 12), mat);
  sky.renderOrder = -1;
  return sky;
}

// ── things ──

function buildTrees(rand) {
  const spots = [];
  for (let iz = 0; iz < H; iz++) for (let ix = 0; ix < W; ix++) if (legend(MAP[iz][ix]).kind === 'tree') spots.push([ix + 0.5, legend(MAP[iz][ix]).ground, iz + 0.5]);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6).translate(0, 0.45, 0), lambert(0.22, { flatShading: true }), spots.length);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.66, 0), lambert(0.42, { flatShading: true }), spots.length);
  const cap = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.46, 0), lambert(0.5, { flatShading: true }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  spots.forEach(([x, y, z], i) => {
    const k = 0.9 + rand() * 0.25;
    q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0));
    m.compose(new THREE.Vector3(x, y, z), q, s.set(1, k, 1));
    trunk.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, y + 1.25 * k, z), q, s.set(k, k, k));
    crown.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x + 0.08, y + 1.8 * k, z - 0.05), q, s.set(k, k, k));
    cap.setMatrixAt(i, m);
  });
  const group = new THREE.Group();
  for (const mesh of [trunk, crown, cap]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

// tufts in the long grass, and the odd flower on the short
function buildGrass(rand) {
  const tufts = [];
  const flowers = [];
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const t = legend(MAP[iz][ix]);
      if (t.kind === 'long') for (let k = 0; k < 4; k++) tufts.push([ix + 0.15 + rand() * 0.7, t.ground, iz + 0.15 + rand() * 0.7]);
      else if (t.kind === 'grass' && rand() < 0.1) flowers.push([ix + 0.2 + rand() * 0.6, t.ground, iz + 0.2 + rand() * 0.6]);
    }
  }
  const blade = new THREE.ConeGeometry(0.09, 0.38, 4).translate(0, 0.19, 0);
  const tuft = new THREE.InstancedMesh(blade, lambert(0.32, { flatShading: true }), tufts.length);
  const bloom = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1).translate(0, 0.08, 0), lambert(1, { emissive: grey(0.4) }), flowers.length);
  const m = new THREE.Matrix4();
  tufts.forEach(([x, y, z], i) => tuft.setMatrixAt(i, m.makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeScale(1, 0.7 + rand() * 0.6, 1))));
  flowers.forEach(([x, y, z], i) => bloom.setMatrixAt(i, m.makeTranslation(x, y, z)));
  tuft.receiveShadow = true;
  const group = new THREE.Group();
  group.add(tuft, bloom);
  return group;
}

function buildRocks(rand) {
  const group = new THREE.Group();
  const rock = lambert(0.58, { flatShading: true });
  const wet = lambert(0.5, { flatShading: true });
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const k = legend(MAP[iz][ix]).kind;
      if (k === 'boulder') {
        const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), rock);
        b.scale.set(0.95, 0.82, 0.95);
        b.position.set(ix + 0.5, 0.48, iz + 0.5);
        b.rotation.y = rand() * 3;
        b.castShadow = b.receiveShadow = true;
        group.add(b);
      } else if (k === 'stone') {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 1.1, 7), wet);
        s.position.set(ix + 0.5, 0.3 - 0.55, iz + 0.5);
        s.rotation.y = rand() * 3;
        s.castShadow = s.receiveShadow = true;
        group.add(s);
      }
    }
  }
  return group;
}

function buildWalls(tex) {
  const spots = [];
  for (let iz = 0; iz < H; iz++) for (let ix = 0; ix < W; ix++) if (MAP[iz][ix] === '#') spots.push([ix + 0.5, iz + 0.5]);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.6, 1).translate(0, 0.8, 0), new THREE.MeshLambertMaterial({ map: tex }), spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, 0, z)));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// the houses: white walls, a flat dark roof you can stand on, a door and windows
function buildHouses() {
  const group = new THREE.Group();
  const seen = new Set();
  const wall = lambert(1, { emissive: grey(0.32) });
  const roof = lambert(0.24);
  const dark = lambert(0.1);
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      if (MAP[iz][ix] !== 'H' || seen.has(`${ix},${iz}`)) continue;
      let x1 = ix;
      while (MAP[iz][x1 + 1] === 'H') x1++;
      let z1 = iz;
      while (MAP[z1 + 1]?.[ix] === 'H') z1++;
      for (let z = iz; z <= z1; z++) for (let x = ix; x <= x1; x++) seen.add(`${x},${z}`);
      const w = x1 - ix + 1;
      const d = z1 - iz + 1;
      const h = new THREE.Group();
      h.position.set(ix + w / 2, 0, iz + d / 2);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 1.8, d - 0.06).translate(0, 0.9, 0), wall);
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.22, d + 0.16).translate(0, 1.89, 0), roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.06).translate(0, 0.45, d / 2), dark);
      const winA = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.06).translate(-w / 2 + 0.55, 1.15, d / 2), dark);
      const winB = winA.clone();
      winB.position.x = w - 1.1;
      for (const m of [body, top, door, winA, winB]) {
        m.castShadow = m.receiveShadow = true;
        h.add(m);
      }
      group.add(h);
    }
  }
  return group;
}

function buildDock(tex) {
  const group = new THREE.Group();
  const deck = new THREE.MeshLambertMaterial({ map: tex });
  const post = lambert(0.3);
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      if (MAP[iz][ix] !== 'B') continue;
      const p = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 1).translate(ix + 0.5, -0.08, iz + 0.5), deck);
      p.receiveShadow = true;
      group.add(p);
      if (MAP[iz][ix + 1] !== 'B' || MAP[iz][ix - 1] !== 'B') {
        const x = MAP[iz][ix + 1] !== 'B' ? ix + 0.88 : ix + 0.12;
        const q = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6).translate(x, -0.35, iz + 0.5), post);
        q.castShadow = true;
        group.add(q);
      }
    }
  }
  return group;
}

// Block Drop tower: a column of blocks per tile, shaded four at a time so it
// reads as pieces that landed
function buildTower(tex) {
  const cubes = [];
  for (const [ix, iz, top] of TOWER) for (let y = 0; y < top; y++) cubes.push([ix + 0.5, y + 0.5, iz + 0.5]);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: tex }), cubes.length);
  const shades = [0.95, 0.62, 0.8, 0.5];
  const m = new THREE.Matrix4();
  cubes.forEach(([x, y, z], i) => {
    mesh.setMatrixAt(i, m.makeTranslation(x, y, z));
    mesh.setColorAt(i, grey(shades[Math.floor(i / 4) % shades.length]));
  });
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function buildPipe(p) {
  const g = new THREE.Group();
  g.position.set(p.ix + 0.5, p.base, p.iz + 0.5);
  const green = lambert(0.62);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.0, 16).translate(0, 0.5, 0), green);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.26, 16).translate(0, 1.12, 0), lambert(0.72));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16).rotateX(-Math.PI / 2).translate(0, 1.252, 0), new THREE.MeshBasicMaterial({ color: grey(0.05) }));
  for (const m of [body, lip]) {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  g.add(hole);
  return g;
}

// a plant in a pipe: a stem, two leaves, and a head that's a pair of jaws
function buildPlant() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 6).translate(0, 0.35, 0), lambert(0.3));
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lambert(0.36, { flatShading: true }));
  leaf.scale.set(1.2, 0.25, 0.6);
  leaf.position.set(0.18, 0.25, 0);
  const leaf2 = leaf.clone();
  leaf2.position.x = -0.18;
  const head = new THREE.Group();
  head.position.y = 0.86;
  const skin = lambert(0.86);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), skin);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: grey(0.05), side: THREE.DoubleSide }));
  // spots on the top half
  const spot = lambert(0.15);
  for (const [x, y, z] of [
    [0.15, 0.22, 0.12],
    [-0.16, 0.18, 0.16],
    [0.02, 0.29, -0.08],
    [-0.12, 0.2, -0.2],
  ]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), spot);
    s.position.set(x, y, z);
    top.add(s);
  }
  const upper = new THREE.Group(); // hinged at the back
  upper.position.z = -0.28;
  top.position.z = 0.28;
  upper.add(top);
  const lower = new THREE.Group();
  lower.position.z = -0.28;
  jaw.position.z = 0.28;
  lower.add(jaw);
  head.add(upper, lower, mouth);
  g.add(stem, leaf, leaf2, head);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return { group: g, head, upper, lower };
}

function buildSign(s) {
  const g = new THREE.Group();
  g.position.set(s.ix + 0.5, 0, s.iz + 0.5);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12).translate(0, 0.4, 0), lambert(0.3));
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.56, 0.1).translate(0, 0.85, 0), lambert(0.9));
  const line = lambert(0.2);
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.02).translate(0, 0.95, 0.06), line);
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.02).translate(-0.08, 0.8, 0.06), line);
  for (const m of [post, board, l1, l2]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function buildCartridge() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.13), lambert(0.74));
  const label = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.02).translate(0, 0.07, 0.075), lambert(0.28));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.02).translate(0, 0.16, 0.088), lambert(0.92));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.02).translate(0, -0.22, 0.075), lambert(0.4));
  const grip2 = grip.clone();
  grip2.position.y = -0.06;
  const back = label.clone();
  back.position.z = -0.15;
  for (const m of [shell, label, stripe, grip, grip2, back]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function buildWalker() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 10).translate(0, 0.2, 0), lambert(0.9));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0.2));
  cap.scale.y = 0.78;
  cap.position.y = 0.3;
  const eye = lambert(0.98);
  const pupil = lambert(0.04);
  const eyes = [-0.11, 0.11].map((x) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.04), eye);
    e.position.set(x, 0.42, 0.3);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.02), pupil);
    p.position.set(0, -0.02, 0.025);
    e.add(p);
    return e;
  });
  const feet = [-0.12, 0.12].map((x) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.24).translate(0, 0.04, 0.03), lambert(0.12));
    f.position.x = x;
    return f;
  });
  g.add(body, cap, ...eyes, ...feet);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return { group: g, feet };
}

// the hero: a little lad in a cap, all boxes, who swings his arms and legs
function buildHero() {
  const g = new THREE.Group();
  const part = (w, h, d, v, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(v));
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };
  const limb = (w, h, d, v, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = part(w, h, d, v, 0, -h / 2, 0);
    pivot.add(m);
    return pivot;
  };
  const legL = limb(0.14, 0.32, 0.16, 0.16, -0.1, 0.32);
  const legR = limb(0.14, 0.32, 0.16, 0.16, 0.1, 0.32);
  const body = part(0.4, 0.32, 0.28, 0.55, 0, 0.47, 0);
  const armL = limb(0.1, 0.28, 0.12, 0.55, -0.26, 0.6);
  const armR = limb(0.1, 0.28, 0.12, 0.55, 0.26, 0.6);
  const head = new THREE.Group();
  head.position.y = 0.78;
  head.add(part(0.36, 0.3, 0.32, 0.93, 0, 0, 0));
  head.add(part(0.4, 0.11, 0.36, 0.1, 0, 0.17, -0.01)); // the cap
  head.add(part(0.3, 0.04, 0.16, 0.1, 0, 0.13, 0.22)); // its peak
  head.add(part(0.05, 0.08, 0.02, 0.04, -0.08, 0.0, 0.165));
  head.add(part(0.05, 0.08, 0.02, 0.04, 0.08, 0.0, 0.165));
  g.add(legL, legR, body, armL, armR, head);
  // seen through whatever's in front of him: the same shapes, drawn dark,
  // only where they're hidden
  const xray = new THREE.MeshBasicMaterial({ color: 0x000000, depthFunc: THREE.GreaterDepth, depthWrite: false });
  const solid = [];
  g.traverse((o) => o.isMesh && solid.push(o));
  for (const o of solid) {
    const ghost = new THREE.Mesh(o.geometry, xray);
    ghost.renderOrder = 10;
    o.add(ghost);
  }
  return { group: g, legL, legR, armL, armR, head, body };
}

// the giant Game Boy in the square, its screen the console's own demo
function buildGameBoy() {
  const g = new THREE.Group();
  const w = GAMEBOY.x1 - GAMEBOY.x0 - 0.2;
  const h = 6.6;
  const d = 1.3;
  // its shape, face on: a tall slab with the bottom right corner rounded
  const s = new THREE.Shape();
  const r = 1.1;
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2 - r, 0);
  s.quadraticCurveTo(w / 2, 0, w / 2, r);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: d - 0.16, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1, curveSegments: 8 }).translate(0, 0, -d / 2 + 0.08), lambert(0.84));
  g.add(body);
  const front = d / 2 + 0.01;
  const dark = lambert(0.22);
  const darker = lambert(0.1);
  // the bezel round the screen, and the screen
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 2.7, 0.06).translate(0, 4.75, front), dark);
  g.add(bezel);
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  // the console draws in the DMG's own four greens: each pixel goes out as
  // exactly the shade it is, so the dither leaves it alone
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { tScreen: { value: tex }, uShade: { value: [0, 1, 2, 3].map(shadeValue) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tScreen;
      uniform float uShade[4];
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tScreen, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float v = l > 0.63 ? uShade[3] : l > 0.47 ? uShade[2] : l > 0.25 ? uShade[1] : uShade[0];
        gl_FragColor = vec4(vec3(v), 1.0);
      }`,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.8).translate(-0.05, 4.7, front + 0.04), screenMat);
  g.add(screen);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04).translate(-w / 2 + 0.45, 5.0, front + 0.04), darker);
  g.add(led);
  // the D-pad, A and B, Start and Select, the speaker's slots
  const pad = new THREE.Group();
  pad.position.set(-0.95, 2.0, front);
  pad.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.2), darker), new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.2), darker));
  g.add(pad);
  const button = new THREE.CylinderGeometry(0.26, 0.26, 0.2, 14).rotateX(Math.PI / 2);
  const b = new THREE.Mesh(button, dark);
  b.position.set(0.55, 1.85, front);
  const a = new THREE.Mesh(button, dark);
  a.position.set(1.2, 2.2, front);
  g.add(a, b);
  for (const x of [-0.42, 0.18]) {
    const pill = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.08), dark);
    pill.position.set(x, 1.0, front);
    pill.rotation.z = 0.45;
    g.add(pill);
  }
  for (let i = 0; i < 6; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.05), darker);
    slot.position.set(0.85 + i * 0.17, 0.62, front);
    slot.rotation.z = 0.5;
    g.add(slot);
  }
  g.traverse((o) => o.isMesh && o !== screen && ((o.castShadow = true), (o.receiveShadow = true)));
  g.position.set((GAMEBOY.x0 + GAMEBOY.x1) / 2, 0, (GAMEBOY.z0 + GAMEBOY.z1) / 2);
  const sys = newConsole({ start: 'attract', palette: 'dmg' });
  const idle = { pressed: new Set(), up: false, down: false, left: false, right: false, a: false, b: false, start: false, select: false };
  let acc = 0;
  return {
    group: g,
    tick(dt) {
      stepConsole(sys, Math.min(dt, 0.05), idle, {});
      acc += dt;
      if (acc < 1 / 30) return;
      acc = 0;
      renderConsole(ctx, sys);
      tex.needsUpdate = true;
    },
  };
}

// the cloud over the sea: flat on top, puffed out round the sides
function buildCloud(rand) {
  const g = new THREE.Group();
  const white = lambert(1, { emissive: grey(0.35) });
  const w = CLOUD.x1 - CLOUD.x0 + 1;
  const d = CLOUD.z1 - CLOUD.z0 + 1;
  const cx = CLOUD.x0 + w / 2;
  const cz = CLOUD.z0 + d / 2;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d).translate(cx, CLOUD.lo + 0.5, cz), white);
  slab.receiveShadow = true;
  g.add(slab);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + rand() * 0.35, 1), white);
    p.position.set(cx + Math.cos(a) * (w / 2 + 0.1), CLOUD.lo + 0.35 + rand() * 0.2, cz + Math.sin(a) * (d / 2 + 0.1));
    p.scale.y = 0.7;
    g.add(p);
  }
  return g;
}

// clouds far off in the sky, three puffs each, drifting
function buildSkyClouds(rand) {
  const g = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: grey(0.995) });
  const list = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + rand() * 1.4, 1), white);
      p.position.set((k - 1) * 2.6, k === 1 ? 0.9 : 0, rand() * 0.5);
      p.scale.y = 0.62;
      c.add(p);
    }
    const a = (i / 7) * Math.PI * 2 + rand() * 0.5;
    const r = 52 + rand() * 18;
    c.userData = { a, r, y: 15 + rand() * 9, speed: 0.004 + rand() * 0.004 };
    list.push(c);
    g.add(c);
  }
  return {
    group: g,
    tick(t) {
      for (const c of list) {
        const { a, r, y, speed } = c.userData;
        const ang = a + t * speed;
        c.position.set(W / 2 + Math.cos(ang) * r, y, H / 2 + Math.sin(ang) * r);
        c.lookAt(W / 2, y, H / 2);
      }
    },
  };
}

// ── the scene ──

export function createDotMatrix(canvas, { onLost } = {}) {
  const tier = device().tier;
  const gl = createRenderer(canvas, { alpha: false, antialias: false, ratio: 1, onLost });
  const { renderer } = gl;
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = tier !== 'low';
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.setClearColor(0xffffff, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 30, 74);
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.5, 200);
  const rand = rng(1989);

  // the light: a high sun over the south-west, and a sky's worth of fill
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  const SUN = new THREE.Vector3(-0.42, 1, 0.5).normalize();
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 70 });
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 0.9));

  const target = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(2, 2) });
  const dither = createDither(camera);

  // ── the island ──
  const block = blockFace(0.92);
  const brickTex = bricks();
  const plankTex = planks();
  scene.add(buildSky());
  const sea = buildSea();
  scene.add(sea.sea, sea.foam);
  scene.add(buildTerrain());
  scene.add(buildTrees(rand));
  scene.add(buildGrass(rand));
  scene.add(buildRocks(rand));
  scene.add(buildWalls(brickTex));
  scene.add(buildHouses());
  scene.add(buildDock(plankTex));
  scene.add(buildTower(block));
  scene.add(buildCloud(rand));
  const skyClouds = buildSkyClouds(rand);
  scene.add(skyClouds.group);
  for (const p of PIPES) scene.add(buildPipe(p));
  for (const s of SIGNS) scene.add(buildSign(s));
  const gameboy = buildGameBoy();
  scene.add(gameboy.group);

  // "?" blocks: a fresh face, and a spent one
  const qTex = blockFace(0.96, glyph(QUESTION, 5, 4, hex(0.1)));
  const spentTex = blockFace(0.48, (g) => {
    g.fillStyle = hex(0.15);
    for (const [x, y] of [
      [3, 3],
      [12, 3],
      [3, 12],
      [12, 12],
    ])
      g.fillRect(x, y, 1, 1);
  });
  const qMat = new THREE.MeshLambertMaterial({ map: qTex, emissive: grey(0.25) });
  const spentMat = new THREE.MeshLambertMaterial({ map: spentTex });
  const blocks = new Map();
  for (const b of BLOCKS) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), qMat);
    m.position.set(b.ix + 0.5, BLOCK_LO + 0.5, b.iz + 0.5);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    blocks.set(b.id, { mesh: m, bump: -1 });
  }

  // coins, all in one draw
  const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 14).rotateX(Math.PI / 2);
  const coinMat = lambert(0.5, { emissive: grey(0.12) });
  const coins = new THREE.InstancedMesh(coinGeo, coinMat, COINS.length);
  coins.castShadow = true;
  scene.add(coins);
  // a coin popping out of a block
  const pops = Array.from({ length: 3 }, () => {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.visible = false;
    scene.add(m);
    return { mesh: m, t: -1 };
  });

  const carts = new Map();
  for (const c of CARTRIDGES) {
    const m = buildCartridge();
    m.position.set(c.at[0], c.at[1] + 0.75, c.at[2]);
    scene.add(m);
    carts.set(c.id, m);
  }

  const walkers = new Map();
  for (const w of WALKERS) {
    const m = buildWalker();
    scene.add(m.group);
    walkers.set(w.id, m);
  }

  const plants = new Map();
  for (const p of PIPES.filter((x) => x.plant)) {
    const m = buildPlant();
    m.group.position.set(p.ix + 0.5, pipeTop(p) - 1.05, p.iz + 0.5);
    scene.add(m.group);
    plants.set(p.id, { ...m, pipe: p });
  }

  const snake = Array.from({ length: snakeAt(0).length }, (_, i) => {
    const head = i === 0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(head ? 0.74 : 0.62, head ? 0.56 : 0.5, head ? 0.74 : 0.62).translate(0, head ? 0.28 : 0.25, 0), lambert(head ? 0.18 : 0.42 + (i % 2) * 0.1));
    m.castShadow = true;
    if (head) {
      for (const x of [-0.18, 0.18]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.04), lambert(0.98));
        e.position.set(x, 0.38, 0.37);
        m.add(e);
      }
    }
    scene.add(m);
    return m;
  });

  const hero = buildHero();
  scene.add(hero.group);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(blob);

  // bits that fly: dust, sparkles, spray
  const BITS = 96;
  const bitMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), new THREE.MeshBasicMaterial({ color: 0xffffff }), BITS);
  bitMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bitMesh.frustumCulled = false;
  scene.add(bitMesh);
  const bits = Array.from({ length: BITS }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, s: 1, shade: 1 }));
  let nextBit = 0;
  const spray = (x, y, z, n, { speed = 2, up = 3, g = 9, life = 0.6, shade = 1, size = 1 } = {}) => {
    for (let i = 0; i < n; i++) {
      const b = bits[nextBit];
      bitMesh.setColorAt(nextBit, grey(shade));
      nextBit = (nextBit + 1) % BITS;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      Object.assign(b, { life, max: life, x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: up * (0.5 + Math.random() * 0.7), g, s: size * (0.7 + Math.random() * 0.6), shade });
    }
    if (bitMesh.instanceColor) bitMesh.instanceColor.needsUpdate = true;
  };
  // (every bit needs a colour before the first spray, so the buffer exists)
  for (let i = 0; i < BITS; i++) bitMesh.setColorAt(i, grey(1));

  // ── sizes ──
  const size = { w: 1, h: 1, cssW: 1, cssH: 1, px: 3 };
  let coarser = 0; // pixels made bigger after slow frames
  const resize = (cssW, cssH) => {
    size.cssW = Math.max(1, cssW);
    size.cssH = Math.max(1, cssH);
    size.px = Math.max(2, Math.min(7, Math.round(size.cssH / 215) + coarser));
    size.w = Math.max(32, Math.ceil(size.cssW / size.px));
    size.h = Math.max(32, Math.ceil(size.cssH / size.px));
    gl.setSize(size.w, size.h);
    target.setSize(size.w, size.h);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };

  // slow frames: bigger pixels, a step at a time
  const perf = { acc: 0, n: 0, warm: 40 };
  const watch = (ms) => {
    if (perf.warm-- > 0) return;
    perf.acc += Math.min(ms, 200);
    perf.n += 1;
    if (perf.n < 150) return;
    const avg = perf.acc / perf.n;
    perf.acc = perf.n = 0;
    if (avg > 34 && coarser < 3) {
      coarser += 1;
      if (coarser >= 2 && renderer.shadowMap.enabled) {
        renderer.shadowMap.enabled = false;
        scene.traverse((o) => o.material && [].concat(o.material).forEach((m) => (m.needsUpdate = true)));
      }
      resize(size.cssW, size.cssH);
    }
  };

  // ── per frame ──
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const look = new THREE.Vector3();
  const cam = { x: 0, y: 0, z: 0, ready: false };
  let walkPhase = 0;
  let disposed = false;
  let lost = false;
  let warmed = false;
  const fx = { warp: 0, warpDir: 0 };

  const render = (state, ms = 16) => {
    if (disposed || gl.lost) return;
    const dt = Math.min(0.05, ms / 1000);
    const { game, yaw = 0, dist = 12.5, pitch = 0.68 } = state;
    const t = game.t;
    const h = game.hero;
    const now = performance.now() / 1000;

    // the hero
    hero.group.position.set(h.x, h.y, h.z);
    hero.group.rotation.y = h.face;
    const sp = Math.min(1, h.moving / 4.6);
    walkPhase += dt * (4 + sp * 8) * (h.ground ? sp : 0);
    if (h.ground) {
      const swing = Math.sin(walkPhase) * 0.75 * sp;
      hero.legL.rotation.x = swing;
      hero.legR.rotation.x = -swing;
      hero.armL.rotation.x = -swing * 0.9;
      hero.armR.rotation.x = swing * 0.9;
      hero.armR.rotation.z = 0;
      hero.body.position.y = 0.47 + Math.abs(Math.sin(walkPhase)) * 0.03 * sp;
    } else {
      hero.legL.rotation.x = 0.6;
      hero.legR.rotation.x = -0.35;
      hero.armL.rotation.x = 0.3;
      hero.armR.rotation.x = -2.6; // a fist in the air
      hero.armR.rotation.z = -0.15;
    }
    // squeezing into a pipe, or out of one
    const squeeze = fx.warp > 0 ? (fx.warpDir < 0 ? fx.warp : 1 - fx.warp) : 1;
    hero.group.scale.set(1.15, 1.15 * Math.max(0.02, squeeze), 1.15);
    if (fx.warp > 0) fx.warp = Math.max(0, fx.warp - dt / 0.45);
    hero.group.visible = (game.hurt <= 0 || Math.floor(now * 14) % 2 === 0) && game.over <= 0 && squeeze > 0.03;
    const floor = floorAt(h.x, h.z, h.y + 0.05);
    blob.visible = hero.group.visible && floor > WATER;
    blob.position.set(h.x, floor + 0.03, h.z);
    const lift = Math.max(0, h.y - floor);
    blob.scale.setScalar(Math.max(0.35, 1 - lift * 0.18));

    // the camera: round the hero, high up, following smoothly
    const ty = h.y * 0.7 + 0.7;
    if (!cam.ready) Object.assign(cam, { x: h.x, y: ty, z: h.z, ready: true });
    const k = 1 - Math.exp(-6 * dt);
    cam.x += (h.x - cam.x) * k;
    cam.z += (h.z - cam.z) * k;
    cam.y += (ty - cam.y) * (1 - Math.exp(-3 * dt));
    // (a tall, narrow screen stands further back, to see as much across)
    const far = dist * (camera.aspect < 1 ? 1 + (1 - camera.aspect) * 0.65 : 1);
    camera.position.set(cam.x + Math.sin(yaw) * Math.cos(pitch) * far, cam.y + Math.sin(pitch) * far, cam.z + Math.cos(yaw) * Math.cos(pitch) * far);
    look.set(cam.x, cam.y, cam.z);
    camera.lookAt(look);
    sun.position.set(cam.x + SUN.x * 30, cam.y + SUN.y * 30, cam.z + SUN.z * 30);
    sun.target.position.set(cam.x, cam.y, cam.z);
    sea.mat.uniforms.uTime.value = now;
    sea.mat.uniforms.uCam.value.copy(camera.position);
    skyClouds.tick(now);
    gameboy.tick(dt);

    // coins spin; the ones taken are gone
    COINS.forEach((c, i) => {
      if (game.coins.has(c.id)) m4.makeScale(0, 0, 0);
      else m4.compose(v3.set(c.x, c.y + Math.sin(now * 2 + i) * 0.06, c.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, now * 3 + i * 0.4), one);
      coins.setMatrixAt(i, m4);
    });
    coins.instanceMatrix.needsUpdate = true;
    for (const p of pops) {
      if (p.t < 0) continue;
      p.t += dt;
      const k2 = p.t / 0.6;
      p.mesh.visible = k2 < 1;
      p.mesh.position.y = p.y + Math.sin(Math.min(1, k2) * Math.PI) * 1.4 + 0.2;
      p.mesh.rotation.y = p.t * 16;
      if (k2 >= 1) p.t = -1;
    }

    // cartridges turn and bob
    for (const c of CARTRIDGES) {
      const m = carts.get(c.id);
      m.visible = !game.found.has(c.id);
      if (!m.visible) continue;
      m.rotation.y = now * 1.6;
      m.position.y = c.at[1] + 0.72 + Math.sin(now * 2.2) * 0.1;
    }

    // "?" blocks: spent, and the little jump a bump gives them
    for (const b of BLOCKS) {
      const s = blocks.get(b.id);
      s.mesh.material = game.used.has(b.id) ? spentMat : qMat;
      if (s.bump >= 0) {
        s.bump += dt;
        s.mesh.position.y = BLOCK_LO + 0.5 + Math.sin(Math.min(1, s.bump / 0.22) * Math.PI) * 0.28;
        if (s.bump > 0.22) s.bump = -1;
      }
    }

    // walkers
    for (const w of WALKERS) {
      const m = walkers.get(w.id);
      const flat = game.flat[w.id];
      const p = walkerAt(w, t);
      if (flat != null && t - flat < WALKER_BACK) {
        const since = t - flat;
        m.group.visible = since < 0.9;
        m.group.scale.set(1.25, 0.25, 1.25);
        continue;
      }
      m.group.visible = true;
      const pop = flat != null ? Math.min(1, (t - flat - WALKER_BACK) / 0.3) : 1;
      m.group.scale.set(1, pop, 1);
      m.group.position.set(p.x, p.y, p.z);
      m.group.rotation.y = p.face;
      const step = Math.sin(t * 9 + w.speed * 3);
      m.feet[0].position.z = step * 0.08;
      m.feet[1].position.z = -step * 0.08;
      m.group.position.y = Math.abs(step) * 0.03;
    }

    // plants: up and down their pipes, jaws snapping, leaning at the hero
    for (const [id, m] of plants) {
      const out = plantOut(game.plants[id]);
      const p = m.pipe;
      m.group.visible = out > 0.02;
      m.group.position.y = pipeTop(p) - 1.05 + out * 1.0;
      const bite = Math.max(0, Math.sin(now * 9 + p.ix)) * 0.5;
      m.upper.rotation.x = -bite;
      m.lower.rotation.x = bite * 0.6;
      const dx = h.x - (p.ix + 0.5);
      const dz = h.z - (p.iz + 0.5);
      const d = Math.hypot(dx, dz);
      m.group.rotation.y = Math.atan2(dx, dz);
      m.head.rotation.x = d < 3 ? 0.35 * out : 0;
    }

    // the snake
    snakeAt(t).forEach((s, i) => {
      snake[i].position.set(s.x, 0, s.z);
      snake[i].rotation.y = s.face;
      snake[i].scale.y = 1 + Math.sin(t * 8 - i * 0.7) * 0.06;
    });

    // flying bits
    for (let i = 0; i < BITS; i++) {
      const b = bits[i];
      if (b.life <= 0) {
        bitMesh.setMatrixAt(i, m4.makeScale(0, 0, 0));
        continue;
      }
      b.life -= dt;
      b.vy -= b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      const s = b.s * Math.max(0, b.life / b.max);
      bitMesh.setMatrixAt(i, m4.compose(v3.set(b.x, b.y, b.z), q.identity(), new THREE.Vector3(s, s, s)));
    }
    bitMesh.instanceMatrix.needsUpdate = true;

    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    dither.render(renderer, target);
    watch(ms);
  };

  // ── events from the game ──
  const api = {
    get lost() {
      return lost || gl.lost;
    },
    info: size,
    renderer,
    render,
    resize,
    setPalette: (id) => dither.setPalette(id),
    set fade(v) {
      dither.fade = v;
    },
    fx(type, data = {}) {
      const at = data.at ?? null;
      if (type === 'bump' && data.block) {
        const s = blocks.get(data.block);
        if (s) s.bump = 0;
      } else if (type === 'block' && data.gives === 'coin') {
        const b = BLOCKS.find((x) => x.id === data.id);
        const p = pops.find((x) => x.t < 0) ?? pops[0];
        Object.assign(p, { t: 0, y: BLOCK_LO + 1 });
        p.mesh.position.set(b.ix + 0.5, BLOCK_LO + 1.2, b.iz + 0.5);
        p.mesh.visible = true;
      } else if (type === 'block' && data.gives === 'heart') {
        const b = BLOCKS.find((x) => x.id === data.id);
        spray(b.ix + 0.5, BLOCK_LO + 1.2, b.iz + 0.5, 14, { speed: 2.2, up: 4, life: 0.8, shade: 0.98 });
      } else if (type === 'coin' && at) spray(at.x, at.y, at.z, 6, { speed: 1.4, up: 2.5, g: 6, life: 0.4, shade: 1, size: 0.7 });
      else if (type === 'cart' && at) spray(at.x, at.y + 0.6, at.z, 26, { speed: 3, up: 5, g: 7, life: 1.1, shade: 1 });
      else if (type === 'stomp' && at) spray(at.x, 0.15, at.z, 10, { speed: 2.6, up: 1.5, g: 8, life: 0.45, shade: 0.55 });
      else if (type === 'land' && at) spray(at.x, at.y + 0.05, at.z, 6, { speed: 1.6, up: 0.8, g: 6, life: 0.3, shade: 0.6, size: 0.8 });
      else if (type === 'splash' && at) spray(at.x, WATER + 0.1, at.z, 18, { speed: 1.8, up: 5, g: 14, life: 0.7, shade: 1 });
      else if (type === 'hurt' && at) spray(at.x, at.y + 0.6, at.z, 8, { speed: 2.4, up: 3, life: 0.5, shade: 0.1 });
      else if (type === 'warp') {
        fx.warp = 1;
        fx.warpDir = data.dir ?? -1;
      }
    },
    // where a point in the world is on the canvas, in CSS pixels
    screenOf(x, y, z) {
      v3.set(x, y, z).project(camera);
      return { x: ((v3.x + 1) / 2) * size.cssW, y: ((1 - v3.y) / 2) * size.cssH, on: v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 };
    },
    // the shaders, compiled before the first frame
    warm(state) {
      if (warmed) return Promise.resolve();
      warmed = true;
      render(state, 16);
      return precompile(renderer, scene, camera);
    },
    dispose() {
      disposed = true;
      disposeTree(scene);
      dither.dispose();
      target.depthTexture?.dispose();
      target.dispose();
      for (const t of [block, brickTex, plankTex, qTex, spentTex]) t.dispose();
      gl.dispose();
    },
  };
  canvas.addEventListener('webglcontextlost', () => (lost = true));
  return api;
}
