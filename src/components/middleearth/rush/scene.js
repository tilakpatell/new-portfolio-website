// The rush, drawn: a kitchen built from the level's tiles out of the
// Shire's timber, plaster and stone (../shire/props), the stations on their
// counters, the hobbits, whatever's being carried or cooked, a ring over
// each station that's working, and a fixed camera up over the front, as
// Overcooked has it. ./rules.js says what's where; this only shows it.
//
// createRushScene(canvas, level, { onLost }) → { render(view, ms), resize,
// screenOf(x, y, z), dispose, lost, info }. view = { s (the rules' state),
// players (where to draw each: { slot, x, z, face, held, moving, work }),
// me (your slot, or null), t }.

import * as THREE from 'three';
import { createStage, disposeTree, hot } from '../../../lib/stage3d';
import { pose } from '../mapFigures';
import { makePerson } from '../shire/people';
import { B, ball, barrelParts, createShireKit, cyl, lathe, parts } from '../shire/props';
import { dotTexture } from '../towns/bake';
import { COLOURS, HOBBITS } from './cast';
import { facingTile } from './rules';

const TOP = 0.92; // a counter's top
const SCALE = 0.92; // the hobbits, to the tiles
const BIG = 1.7; // things, chunky enough to read from up here
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ── the things in hand and on the counters ──

function itemMaker(K) {
  const { mats, paint } = K;
  const m = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, ...o });
  const M = {
    pewter: mats.pewter,
    dirty: m(0x6a6458, { roughness: 0.9 }),
    ale: m(0xc07a1c, { roughness: 0.3, emissive: hot(0x6a3a08, 0.4) }),
    foam: m(0xfff4dc, { roughness: 0.9 }),
    wood: paint(0xb08050),
    stew: m(0x7a4a22, { roughness: 0.5 }),
    carrot: m(0xe8741c),
    leaf: m(0x4a8a2a),
    potato: m(0xb8925a, { roughness: 0.95 }),
    flesh: m(0xf0dca0),
    dough: m(0xf2e2c0, { roughness: 1 }),
    loaf: m(0xb8742a, { roughness: 0.8 }),
    burnt: m(0x1e1814, { roughness: 1 }),
    smear: m(0x5a4a30, { roughness: 1 }),
  };
  const mesh = (geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = 1) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(...p);
    o.rotation.set(...r);
    o.scale.setScalar(s);
    o.castShadow = true;
    return o;
  };
  const G = {
    mug: lathe([[0, 0], [0.085, 0], [0.09, 0.02], [0.09, 0.2], [0.078, 0.2], [0.078, 0.025], [0, 0.025]], 14),
    handle: new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI),
    top: new THREE.CircleGeometry(0.078, 14),
    bowl: lathe([[0, 0], [0.07, 0], [0.13, 0.05], [0.15, 0.1], [0.135, 0.1], [0.115, 0.055], [0, 0.03]], 16),
    bowlTop: new THREE.CircleGeometry(0.125, 16),
    carrot: cyl(0.045, 0.004, 0.24, 8),
    tuft: cyl(0.01, 0.03, 0.07, 5),
    disc: cyl(0.04, 0.04, 0.02, 8),
    potato: ball(0.075, 8, 6),
    cube: B(0.045, 0.045, 0.045),
    dough: ball(0.1, 10, 6),
    loaf: ball(0.12, 12, 8),
  };
  const build = {
    mug(s) {
      const g = new THREE.Group();
      g.add(mesh(G.mug, s === 'dirty' ? M.dirty : M.pewter));
      g.add(mesh(G.handle, s === 'dirty' ? M.dirty : M.pewter, [0.09, 0.1, 0], [0, 0, -Math.PI / 2]));
      if (s === 'ale') {
        g.add(mesh(G.top, M.ale, [0, 0.17, 0], [-Math.PI / 2, 0, 0]));
        const foam = mesh(G.potato, M.foam, [0, 0.19, 0]);
        foam.scale.set(1.05, 0.35, 1.05);
        g.add(foam);
      } else if (s === 'dirty') g.add(mesh(G.top, M.smear, [0, 0.06, 0], [-Math.PI / 2, 0, 0]));
      return g;
    },
    bowl(s) {
      const g = new THREE.Group();
      g.add(mesh(G.bowl, s === 'dirty' ? M.dirty : M.wood));
      if (s === 'stew') {
        g.add(mesh(G.bowlTop, M.stew, [0, 0.085, 0], [-Math.PI / 2, 0, 0]));
        for (let i = 0; i < 4; i++) g.add(mesh(G.cube, i % 2 ? M.carrot : M.flesh, [Math.cos(i * 1.7) * 0.06, 0.09, Math.sin(i * 1.7) * 0.06], [i, i * 2, 0], 0.8));
      } else if (s === 'dirty') g.add(mesh(G.bowlTop, M.smear, [0, 0.05, 0], [-Math.PI / 2, 0, 0], 0.8));
      return g;
    },
    carrot(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 5; i++) g.add(mesh(G.disc, M.carrot, [Math.cos(i * 1.3) * 0.06, 0.012 + (i % 2) * 0.014, Math.sin(i * 1.3) * 0.06], [0.3 * i, 0, 0.2]));
      else {
        g.add(mesh(G.carrot, M.carrot, [0, 0.05, 0], [0, 0, Math.PI / 2]));
        g.add(mesh(G.tuft, M.leaf, [0.15, 0.05, 0], [0, 0, -Math.PI / 2]));
      }
      return g;
    },
    potato(s) {
      const g = new THREE.Group();
      if (s === 'chopped') for (let i = 0; i < 6; i++) g.add(mesh(G.cube, M.flesh, [Math.cos(i * 1.1) * 0.06, 0.025 + (i % 2) * 0.03, Math.sin(i * 1.1) * 0.06], [i, i, 0]));
      else {
        const o = mesh(G.potato, M.potato, [0, 0.07, 0]);
        o.scale.set(1.25, 0.85, 0.95);
        g.add(o);
      }
      return g;
    },
    dough() {
      const g = new THREE.Group();
      const o = mesh(G.dough, M.dough, [0, 0.06, 0]);
      o.scale.set(1.2, 0.6, 1);
      g.add(o);
      return g;
    },
    loaf(s) {
      const g = new THREE.Group();
      const o = mesh(G.loaf, s === 'burnt' ? M.burnt : M.loaf, [0, 0.07, 0]);
      o.scale.set(1.5, 0.7, 0.95);
      g.add(o);
      return g;
    },
  };
  const protos = new Map();
  return {
    // a fresh copy of one (sharing its geometry and materials)
    make(it) {
      const sig = `${it.k}:${it.s}`;
      if (!protos.has(sig)) protos.set(sig, build[it.k](it.s));
      return protos.get(sig).clone();
    },
    M,
    dispose() {
      for (const g of Object.values(G)) g.dispose();
      for (const x of [M.dirty, M.ale, M.foam, M.stew, M.carrot, M.leaf, M.potato, M.flesh, M.dough, M.loaf, M.burnt, M.smear]) x.dispose();
    },
  };
}

// A ring over a station, filling clockwise from the top.
function ringMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color() }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uK; uniform vec3 uCol; uniform float uFlash; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.x, p.y) / 6.2831853 + 0.5;
        vec3 back = vec3(0.08, 0.06, 0.05);
        vec3 col = r < 0.6 ? back : (a > 1.0 - uK ? uCol : vec3(0.22, 0.2, 0.18));
        col = mix(col, vec3(1.0, 0.25, 0.15), uFlash * step(0.6, r));
        float edge = smoothstep(1.0, 0.92, r);
        gl_FragColor = vec4(col, 0.95 * edge);
      }`,
  });
}

export function createRushScene(canvas, level, { onLost } = {}) {
  const stage = createStage(canvas, { shadows: true, fov: 38, near: 0.1, far: 80, bloom: { strength: 0.5, radius: 0.45, threshold: 0.9 }, onLost });
  stage.grade({ contrast: 0.1, saturation: 1.02, vignette: 0.26, grain: 0.012, shadow: [0.02, 0.012, 0.0], high: [0.03, 0.02, 0.0] });
  const { scene, camera, renderer } = stage;
  renderer.info.autoReset = false; // (counted over the whole frame, for the QA scripts)
  const kit = createShireKit(renderer);
  const { mats, paint } = kit;
  const items = itemMaker(kit.K);
  const rows = level.tiles;
  const W = rows[0].length;
  const D = rows.length;
  const X = (x) => x - W / 2; // tile units to the world
  const Z = (z) => z - D / 2;
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= D ? 'x' : rows[j][i]);

  scene.background = new THREE.Color(0x1a120c);
  scene.fog = new THREE.Fog(0x1a120c, 18, 40);
  const hemi = new THREE.HemisphereLight(0xffe2b8, 0x3a2414, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
  sun.position.set(-4, 10, 7);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -W / 2 - 1, right: W / 2 + 1, top: D / 2 + 2, bottom: -D / 2 - 2, near: 1, far: 30 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  // ── the room ──
  const room = new THREE.Group();
  scene.add(room);
  const bk = parts();
  // flagstones underfoot, so the counters stand out from the floor
  bk.add(mats.ashlar, B(W + 2, 0.1, D + 2), { p: [0, -0.05, 0.5], uv: 0.45 });
  const wallH = 3.2;
  bk.add(mats.plaster, B(W + 2, wallH, 0.2), { p: [0, wallH / 2, Z(0) - 0.1], uv: 0.5 });
  for (const s of [-1, 1]) bk.add(mats.plaster, B(0.2, wallH, D + 1), { p: [s * (W / 2 + 0.1), wallH / 2, 0], uv: 0.5 });
  // beams and panelling on the back wall
  for (let x = -W / 2; x <= W / 2; x += 2) bk.add(mats.timber, B(0.22, wallH, 0.12), { p: [x, wallH / 2, Z(0) + 0.02], uv: 1 });
  bk.add(mats.timber, B(W + 2, 0.18, 0.14), { p: [0, wallH - 0.4, Z(0) + 0.03], uv: 1 });
  bk.add(mats.timber, B(W + 2, 0.12, 0.12), { p: [0, 1.25, Z(0) + 0.03], uv: 1 });
  for (const s of [-1, 1]) bk.add(mats.timber, B(0.12, 0.18, D + 1), { p: [s * (W / 2 + 0.02), wallH - 0.4, 0], uv: 1 });
  // hanging pans and herbs over the back counters
  for (let x = -W / 2 + 1.5; x < W / 2 - 1; x += 2.6) {
    bk.add(mats.iron, cyl(0.16, 0.12, 0.05, 12), { p: [x, 2.0, Z(0) + 0.18], r: [Math.PI / 2, 0, 0] });
    bk.add(mats.iron, B(0.03, 0.22, 0.03), { p: [x, 2.22, Z(0) + 0.14] });
    bk.add(mats.wheat, cyl(0.06, 0.02, 0.36, 5), { p: [x + 1.1, 2.15, Z(0) + 0.16], color: 0x9aa060 });
  }

  // which way a station faces: towards the floor next to it (the camera's side first)
  const frontOf = (i, j) => {
    for (const [a, b, turn] of [[0, 1, 0], [-1, 0, -Math.PI / 2], [1, 0, Math.PI / 2], [0, -1, Math.PI]]) if (at(i + a, j + b) === '.') return { a, b, turn };
    return { a: 0, b: 1, turn: 0 };
  };

  const stations = {}; // key → { c, x, z, front, contents, glow }
  const fires = [];
  const darkWood = paint(0x5a3418);
  const board = paint(0xd8b484);
  const topWood = paint(0xd2a46c);
  const brick = mats.brick;
  for (let j = 0; j < D; j++)
    for (let i = 0; i < W; i++) {
      const c = at(i, j);
      if (c === '.' || c === 'x') continue;
      const x = X(i + 0.5);
      const z = Z(j + 0.5);
      const f = frontOf(i, j);
      const st = { c, x, z, front: f };
      stations[`${i},${j}`] = st;
      const stone = c === 'P' || c === 'O';
      // the counter
      bk.add(stone ? brick : mats.timber, B(0.98, TOP - 0.06, 0.98), { p: [x, (TOP - 0.06) / 2, z], uv: 1 });
      bk.add(c === 'S' ? darkWood : stone ? mats.dressed : topWood, B(1.0, 0.06, 1.0), { p: [x, TOP - 0.03, z], uv: 1 });
      // a dark lip round the top, so each counter reads as one
      bk.add(darkWood, B(1.02, 0.05, 1.02), { p: [x, TOP - 0.085, z], uv: 1 });
      bk.at([x, TOP, z], f.turn, () => {
        if (c === 'B') {
          bk.add(board, B(0.7, 0.05, 0.5), { p: [0, 0.025, -0.02], uv: 1 });
          bk.add(mats.steel, B(0.26, 0.012, 0.05), { p: [0.18, 0.06, 0.18], r: [0, 0.4, 0] });
          bk.add(mats.timber, B(0.12, 0.025, 0.035), { p: [0.02, 0.06, 0.25], r: [0, 0.4, 0] });
        } else if (c === 'P') {
          // the hearth's fire under the pot, and the pot
          bk.add(mats.iron, lathe([[0.2, 0], [0.32, 0.06], [0.35, 0.2], [0.33, 0.36], [0.3, 0.36], [0.31, 0.2], [0.29, 0.07], [0.18, 0.03]], 16), { p: [0, 0.02, 0] });
          bk.add(mats.iron, new THREE.TorusGeometry(0.33, 0.02, 6, 18), { p: [0, 0.37, 0], r: [Math.PI / 2, 0, 0] });
          for (const s of [-1, 1]) bk.add(mats.iron, cyl(0.02, 0.02, 0.5, 5), { p: [s * 0.4, 0.2, 0] });
          bk.add(mats.iron, cyl(0.015, 0.015, 0.82, 5), { p: [0, 0.45, 0], r: [0, 0, Math.PI / 2] });
        } else if (c === 'O') {
          bk.add(brick, new THREE.SphereGeometry(0.44, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 0, -0.04], uv: 1 });
          bk.add(mats.void, new THREE.CircleGeometry(0.2, 12, 0, Math.PI), { p: [0, 0.0, 0.405], r: [0, 0, 0] });
          bk.add(mats.iron, cyl(0.05, 0.06, 0.3, 8), { p: [0.12, 0.5, -0.12] });
        } else if (c === 'T') {
          // a barrel on its side, its tap over the front of the counter
          bk.at([0, 0.32, -0.44], [Math.PI / 2, 0, 0], () => barrelParts(bk, kit.K, { h: 0.6, r: 0.26 }));
          bk.add(mats.timber, B(0.6, 0.1, 0.12), { p: [0, 0.05, -0.32] });
          bk.add(mats.timber, B(0.6, 0.1, 0.12), { p: [0, 0.05, 0.06] });
          bk.add(mats.brass, cyl(0.025, 0.025, 0.16, 8), { p: [0, 0.34, 0.22], r: [Math.PI / 2, 0, 0] });
          bk.add(mats.brass, cyl(0.022, 0.016, 0.1, 8), { p: [0, 0.29, 0.3] });
          bk.add(mats.brass, B(0.02, 0.12, 0.03), { p: [0, 0.43, 0.24] });
        } else if (c === 'W') {
          bk.add(mats.barnwood, lathe([[0.3, 0], [0.42, 0.28], [0.44, 0.3], [0.4, 0.3], [0.38, 0.27], [0.27, 0.03], [0, 0.03]], 16), { p: [0, 0, 0] });
          for (const y of [0.08, 0.22]) bk.add(mats.iron, cyl(0.335 + y * 0.42, 0.34 + y * 0.42, 0.03, 16, true), { p: [0, y, 0] });
        } else if (c === 'X') {
          bk.add(mats.iron, lathe([[0.18, 0], [0.24, 0.34], [0.22, 0.34], [0.165, 0.02], [0, 0.02]], 12));
          bk.add(items.M.smear, new THREE.CircleGeometry(0.2, 12), { p: [0, 0.27, 0], r: [-Math.PI / 2, 0, 0] });
        } else if (c === 'S') {
          bk.add(mats.brass, cyl(0.02, 0.02, 1.0, 6), { p: [0, 0.08, 0.44], r: [0, 0, Math.PI / 2] });
        } else if (c === 'R') {
          bk.add(mats.barnwood, B(0.8, 0.04, 0.6), { p: [0, 0.02, 0] });
        } else if (c === 'm' || c === 'b') {
          bk.add(mats.timber, B(0.9, 0.9, 0.06), { p: [0, 0.45, -0.42] });
          for (const y of [0.02, 0.45]) bk.add(mats.wood, B(0.9, 0.04, 0.42), { p: [0, y, -0.2] });
        } else if (c === 'c' || c === 'p' || c === 'd') {
          // a crate (a tub for the dough), full
          if (c === 'd') bk.add(mats.barnwood, lathe([[0.32, 0], [0.38, 0.3], [0.34, 0.3], [0.3, 0.03], [0, 0.03]], 14));
          else {
            for (const [a, b, w, d] of [[0, -0.36, 0.8, 0.06], [0, 0.36, 0.8, 0.06], [-0.37, 0, 0.06, 0.78], [0.37, 0, 0.06, 0.78]]) bk.add(mats.barnwood, B(w, 0.3, d), { p: [a, 0.15, b], uv: 1 });
            bk.add(mats.barnwood, B(0.74, 0.03, 0.72), { p: [0, 0.03, 0] });
          }
        }
      });
      // the crates' heaps, the dough: things, not built in (they share the items' look)
      if (c === 'c' || c === 'p' || c === 'd') {
        const heap = new THREE.Group();
        const n = c === 'd' ? 1 : 7;
        for (let k = 0; k < n; k++) {
          const it = items.make({ k: c === 'c' ? 'carrot' : c === 'p' ? 'potato' : 'dough', s: 'raw' });
          it.position.set(Math.cos(k * 2.4) * 0.18 * (k > 0), 0.12 + (k % 3) * 0.05, Math.sin(k * 2.4) * 0.18 * (k > 0));
          it.rotation.y = k * 1.3;
          if (c === 'd') it.scale.setScalar(2.4);
          heap.add(it);
        }
        heap.position.set(x, TOP, z);
        room.add(heap);
      }
      if (c === 'P' || c === 'O') {
        // the fire's glow
        const glow = new THREE.Mesh(B(0.5, 0.18, 0.04), new THREE.MeshBasicMaterial({ color: hot(0xff7a2a, 2.4) }));
        const out = c === 'P' ? 0.5 : 0.42;
        glow.position.set(x + f.a * out, c === 'P' ? 0.32 : TOP + 0.1, z + f.b * out);
        glow.rotation.y = f.turn;
        room.add(glow);
        st.glow = glow;
        fires.push(st);
      }
    }
  bk.build(room);
  room.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });

  // the fires' light: two point lights, shared out among the hearths and ovens
  const fireLights = [0, 1].map(() => {
    const l = new THREE.PointLight(0xff8a3a, 3, 5, 1.6);
    scene.add(l);
    return l;
  });
  fireLights.forEach((l, k) => {
    const group = fires.filter((_, n) => n % 2 === k);
    if (!group.length) return;
    const cx = group.reduce((a, f) => a + f.x, 0) / group.length;
    const cz = group.reduce((a, f) => a + f.z, 0) / group.length;
    l.position.set(cx, TOP + 0.6, cz + 0.8);
  });

  // ── the stations' changing parts ──
  const potTops = {};
  const potMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5 });
  const POT = { empty: potMat(0x3a3a3a), part: potMat(0x8a7a5a), cooking: potMat(0x8a5a2a), done: potMat(0x7a4a22), burnt: potMat(0x141010) };
  const water = new THREE.MeshStandardMaterial({ color: 0x5a7a8a, roughness: 0.2, metalness: 0.1 });
  for (const [k, st] of Object.entries(stations)) {
    if (st.c === 'P') {
      const top = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), POT.empty);
      top.rotation.x = -Math.PI / 2;
      top.position.set(st.x, TOP + 0.3, st.z);
      room.add(top);
      potTops[k] = top;
    } else if (st.c === 'W') {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16), water);
      w.rotation.x = -Math.PI / 2;
      w.position.set(st.x, TOP + 0.24, st.z);
      room.add(w);
    }
  }

  // ── hobbits ──
  const figures = HOBBITS.map((id, slot) => {
    const f = makePerson(id);
    f.group.scale.setScalar(SCALE);
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 24), new THREE.MeshBasicMaterial({ color: COLOURS[slot], transparent: true, opacity: 0.85, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    const g = new THREE.Group();
    g.add(f.group, disc);
    g.visible = false;
    scene.add(g);
    return { f, g, disc };
  });

  // ── what's held and what's set down ──
  const shown = new Map(); // where → { sig, mesh }
  const place = (where, it, x, y, z, ry = 0, s0 = 1) => {
    const s = s0 * BIG;
    if (!it) return;
    const sig = `${it.k}:${it.s}`;
    let e = shown.get(where);
    if (!e || e.sig !== sig) {
      if (e) room.remove(e.mesh);
      e = { sig, mesh: items.make(it) };
      room.add(e.mesh);
      shown.set(where, e);
    }
    e.used = true;
    e.mesh.position.set(x, y, z);
    e.mesh.rotation.y = ry;
    e.mesh.scale.setScalar(s);
  };

  // ── progress rings ──
  const ringGeo = new THREE.PlaneGeometry(0.5, 0.5);
  const rings = Array.from({ length: 16 }, () => {
    const r = new THREE.Mesh(ringGeo, ringMaterial());
    r.renderOrder = 10;
    r.visible = false;
    scene.add(r);
    return r;
  });
  const GREEN = new THREE.Color(0x6ad04a);
  const BLUE = new THREE.Color(0x5ab4f0);
  const GOLD = new THREE.Color(0xf0c040);
  const RED = new THREE.Color(0xf05030);

  // the tile you'd act on, lit up in your colour
  const aim = new THREE.Group();
  const aimEdge = new THREE.LineSegments(new THREE.EdgesGeometry(B(1.02, 0.16, 1.02)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  const aimFill = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
  aimFill.position.y = 0.075;
  aim.add(aimEdge, aimFill);
  aim.visible = false;
  scene.add(aim);

  // ── puffs: steam, smoke, sparkle ──
  const dot = dotTexture();
  const puffs = Array.from({ length: 48 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, transparent: true, depthWrite: false, color: 0xffffff }));
    sp.visible = false;
    sp.userData = { life: 0, max: 1, v: V() };
    scene.add(sp);
    return sp;
  });
  let puffAt = 0;
  const puff = (x, y, z, { color = 0xffffff, size = 0.3, life = 1.2, v = [0, 0.6, 0], opacity = 0.6 } = {}) => {
    const sp = puffs[puffAt++ % puffs.length];
    sp.visible = true;
    sp.position.set(x, y, z);
    sp.material.color.set(color);
    sp.material.opacity = opacity;
    sp.scale.setScalar(size);
    Object.assign(sp.userData, { life, max: life, size, opacity });
    sp.userData.v.set(...v);
  };

  // ── the camera: up over the front, the whole kitchen in view ──
  const look = V(0, 0.4, 0.5);
  const fit = (w, h) => {
    const aspect = w / Math.max(1, h);
    const pitch = aspect < 0.9 ? 1.2 : 0.98; // steeper on a tall screen
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needH = D * Math.sin(pitch) + 1.6;
    const needW = W + 1.2;
    const d = Math.max(needH / (2 * tan), needW / (2 * tan * aspect));
    camera.position.set(look.x, look.y + Math.sin(pitch) * d, look.z + Math.cos(pitch) * d);
    camera.lookAt(look);
  };
  const resize = (w, h) => {
    stage.resize(w, h);
    fit(w, h);
  };

  let last = 0;
  const render = (view, ms = 16) => {
    const dt = Math.min(0.05, ms / 1000);
    const { s, players, me, t } = view;
    last = t;
    for (const e of shown.values()) e.used = false;

    // stations: their contents, their rings
    let ri = 0;
    const ring = (x, y, z, k, col, flash = 0) => {
      const r = rings[ri++];
      if (!r) return;
      r.visible = true;
      r.position.set(x, y, z);
      r.quaternion.copy(camera.quaternion);
      r.material.uniforms.uK.value = Math.max(0, Math.min(1, k));
      r.material.uniforms.uCol.value.copy(col);
      r.material.uniforms.uFlash.value = flash;
    };
    const T = level.times;
    for (const [k, st] of Object.entries(stations)) {
      const sp = s.spots[k];
      if (!sp) continue;
      const { x, z, front } = st;
      if (st.c === '#' || st.c === 'B' || st.c === 'S') {
        if (sp.item) place(k, sp.item, x, TOP + (st.c === 'B' ? 0.05 : 0), z, front.turn);
        if (st.c === 'B' && sp.item?.s === 'raw' && sp.prog > 0) ring(x, TOP + 0.75, z, sp.prog, GREEN);
      } else if (st.c === 'O') {
        if (sp.item) place(k, sp.item, x + front.a * 0.18, TOP + 0.02, z + front.b * 0.18, front.turn);
        if (sp.item?.k === 'dough') ring(x, TOP + 0.95, z, sp.prog / T.bake, GREEN);
        else if (sp.item?.k === 'loaf' && sp.item.s === 'baked' && sp.prog > T.char * 0.35) ring(x, TOP + 0.95, z, sp.prog / T.char, RED, Math.sin(t * 14) > 0 ? 0.6 : 0);
        if (sp.item?.s === 'burnt' && Math.random() < dt * 6) puff(x, TOP + 0.6, z, { color: 0x222222, size: 0.5, life: 1.8, opacity: 0.5 });
      } else if (st.c === 'T') {
        if (sp.item) place(k, sp.item, x + front.a * 0.3, TOP, z + front.b * 0.3, front.turn);
        if (sp.item?.s === 'clean') ring(x, TOP + 0.95, z, sp.prog / T.fill, GOLD);
        else if (sp.item?.s === 'ale' && sp.prog > T.spill * 0.35) ring(x, TOP + 0.95, z, sp.prog / T.spill, RED, Math.sin(t * 14) > 0 ? 0.6 : 0);
      } else if (st.c === 'P') {
        const top = potTops[k];
        top.material = POT[sp.s] ?? POT.empty;
        top.position.y = TOP + 0.18 + 0.05 * Math.min(3, sp.n || (sp.s === 'empty' ? 0 : 3)) + (sp.s === 'cooking' || sp.s === 'done' ? Math.sin(t * 9) * 0.006 : 0);
        if (sp.s === 'cooking') {
          ring(x, TOP + 1.05, z, sp.cook / T.cook, GREEN);
          if (Math.random() < dt * 5) puff(x + (Math.random() - 0.5) * 0.3, TOP + 0.4, z, { size: 0.32, life: 1.4, opacity: 0.35 });
        } else if (sp.s === 'done') {
          const k2 = (sp.cook - T.cook) / T.burn;
          if (k2 > 0.35) ring(x, TOP + 1.05, z, k2, RED, Math.sin(t * 14) > 0 ? 0.6 : 0);
          if (Math.random() < dt * 8) puff(x + (Math.random() - 0.5) * 0.3, TOP + 0.4, z, { size: 0.36, life: 1.4, opacity: 0.45 });
        } else if (sp.s === 'burnt') {
          if (sp.prog > 0) ring(x, TOP + 1.05, z, sp.prog, BLUE);
          if (Math.random() < dt * 10) puff(x + (Math.random() - 0.5) * 0.3, TOP + 0.5, z, { color: 0x1a1a1a, size: 0.55, life: 2, opacity: 0.55 });
        } else if (sp.s === 'part' && sp.n) {
          // the pieces in, before it's full
          for (let n = 0; n < sp.n; n++) place(`${k}:${n}`, { k: n % 2 ? 'potato' : 'carrot', s: 'chopped' }, x + Math.cos(n * 2.1) * 0.1, TOP + 0.22, z + Math.sin(n * 2.1) * 0.1, n, 0.8);
        }
      } else if (st.c === 'W') {
        sp.dirty.slice(0, 3).forEach((kind, n) => place(`${k}:d${n}`, { k: kind, s: 'dirty' }, x - 0.12 + n * 0.12, TOP + 0.12 + n * 0.02, z - 0.05, n, 0.9));
        sp.clean.slice(0, 3).forEach((kind, n) => place(`${k}:c${n}`, { k: kind, s: 'clean' }, x + front.a * 0.35 - 0.25 + n * 0.16, TOP + 0.31, z + front.b * 0.35 + 0.1, n, 0.85));
        if (sp.prog > 0) ring(x, TOP + 0.95, z, sp.prog, BLUE);
        if (sp.dirty.length && s.players.some((p) => p.work) && Math.random() < dt * 6) puff(x, TOP + 0.3, z, { color: 0xeaf6ff, size: 0.18, life: 0.7, v: [0, 0.4, 0], opacity: 0.8 });
      } else if (st.c === 'm' || st.c === 'b') {
        const kind = st.c === 'm' ? 'mug' : 'bowl';
        for (let n = 0; n < Math.min(6, sp.n); n++) {
          const row = n < 3 ? 0 : 1;
          const col = n % 3;
          // along the shelf, a little back from its front edge (turned as the station is)
          const ox = (col - 1) * 0.26;
          const oz = -0.18;
          const c = Math.cos(front.turn);
          const sn = Math.sin(front.turn);
          place(`${k}:${n}`, { k: kind, s: 'clean' }, x + c * ox + sn * oz, TOP + (row ? 0.47 : 0.04), z - sn * ox + c * oz, 0, 0.9);
        }
      } else if (st.c === 'R') {
        let n = 0;
        for (const kind of ['mug', 'bowl'])
          for (let q = 0; q < Math.min(4, sp[kind] ?? 0); q++, n++) place(`${k}:${kind}${q}`, { k: kind, s: 'dirty' }, x - 0.28 + (n % 4) * 0.19, TOP + 0.04 + Math.floor(n / 4) * 0.06, z + (n >= 4 ? 0.12 : -0.1), n, 0.85);
      }
    }
    for (; ri < rings.length; ri++) rings[ri].visible = false;

    // the hobbits, and what they carry
    figures.forEach((h, slot) => {
      const p = players.find((q) => q.slot === slot);
      h.g.visible = Boolean(p);
      if (!p) return;
      h.g.position.set(X(p.x), 0, Z(p.z));
      h.f.group.rotation.y = p.face;
      pose(h.f, t + slot, { moving: p.moving, speed: 1.1 });
      const arms = h.f.arms;
      if (p.held) {
        arms[0].rotation.z = -1.25;
        arms[1].rotation.z = -1.25;
        const hx = X(p.x) + Math.cos(p.face) * 0.34;
        const hz = Z(p.z) - Math.sin(p.face) * 0.34;
        place(`p${slot}`, p.held, hx, 0.55 + (p.moving ? Math.abs(Math.sin(t * 13)) * 0.03 : 0), hz, p.face);
      } else if (p.work) {
        arms[1].rotation.z = -1.0 + Math.sin(t * 22) * 0.6;
        arms[0].rotation.z = -0.6;
      }
      h.disc.material.opacity = slot === me ? 0.95 : 0.6;
    });

    // your aim
    const mine = me != null ? s.players[me] : null;
    const tile = mine ? facingTile(s, players.find((q) => q.slot === me) ?? mine) : null;
    aim.visible = Boolean(tile);
    if (tile) {
      aim.position.set(X(tile[0] + 0.5), TOP + 0.02, Z(tile[1] + 0.5));
      aimEdge.material.color.set(COLOURS[me]);
      aimFill.material.color.set(COLOURS[me]);
      aimEdge.material.opacity = 0.7 + Math.sin(t * 6) * 0.25;
      aimFill.material.opacity = 0.2 + Math.sin(t * 6) * 0.08;
    }

    for (const [where, e] of shown) {
      if (e.used) continue;
      room.remove(e.mesh);
      shown.delete(where);
    }

    // the fires flicker
    for (const st of fires) st.glow.material.color.copy(hot(0xff7a2a, 2 + Math.sin(t * 11 + st.x) * 0.4 + Math.sin(t * 17) * 0.2));
    fireLights.forEach((l, k) => (l.intensity = 2.6 + Math.sin(t * 9 + k * 2) * 0.5 + Math.sin(t * 23 + k) * 0.25));

    for (const sp of puffs) {
      const u = sp.userData;
      if (!sp.visible) continue;
      u.life -= dt;
      if (u.life <= 0) {
        sp.visible = false;
        continue;
      }
      sp.position.addScaledVector(u.v, dt);
      const k = u.life / u.max;
      sp.material.opacity = u.opacity * k;
      sp.scale.setScalar(u.size * (1.6 - k * 0.6));
    }
    renderer.info.reset();
    stage.render(ms);
  };

  // effects for what happened (the rules' events)
  const fx = (e) => {
    if (!e.at) return;
    const x = X(e.at[0] + 0.5);
    const z = Z(e.at[1] + 0.5);
    if (e.type === 'served') for (let k = 0; k < 10; k++) puff(x, TOP + 0.4, z, { color: 0xffd060, size: 0.16, life: 0.9, v: [(Math.random() - 0.5) * 1.6, 1.2 + Math.random(), (Math.random() - 0.5) * 1.6], opacity: 1 });
    else if (e.type === 'spilt') for (let k = 0; k < 8; k++) puff(x, TOP + 0.1, z + 0.4, { color: 0xd09030, size: 0.14, life: 0.8, v: [(Math.random() - 0.5) * 1.2, 0.8, 0.6 + Math.random() * 0.6], opacity: 0.9 });
    else if (e.type === 'chopped' || e.type === 'washed') for (let k = 0; k < 5; k++) puff(x, TOP + 0.2, z, { color: e.type === 'washed' ? 0xeaf6ff : 0xffffff, size: 0.12, life: 0.5, v: [(Math.random() - 0.5), 1, (Math.random() - 0.5)], opacity: 0.9 });
    else if (e.type === 'nope') for (let k = 0; k < 3; k++) puff(x, TOP + 0.4, z, { color: 0xff4030, size: 0.14, life: 0.4, v: [(Math.random() - 0.5) * 0.6, 0.6, 0], opacity: 0.9 });
  };

  // where a point in tile units is on screen (CSS px), or null
  const screenOf = (x, y, z) => {
    const p = V(X(x), y, Z(z)).project(camera);
    if (p.z > 1) return null;
    const { w, h } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h };
  };

  return {
    render,
    fx,
    resize,
    screenOf,
    get lost() {
      return stage.lost;
    },
    get info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, quality: stage.quality, t: last };
    },
    dispose() {
      items.dispose();
      dot.dispose();
      for (const r of rings) r.material.dispose();
      ringGeo.dispose();
      for (const sp of puffs) sp.material.dispose();
      disposeTree(room);
      stage.dispose();
    },
  };
}
