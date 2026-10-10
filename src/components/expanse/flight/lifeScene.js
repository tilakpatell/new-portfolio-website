// A planet's life drawn: everything ./life.js streams in, one InstancedMesh a
// model, so Coruscant's three hundred ships in three kinds are three draws.
// A model is the site's own where it has one, built in code as the galaxy
// builds it (galaxy/fleet.js's ships, galaxy/surface/figures.js's people and
// beasts), or a code-built stand-in from the row's `body` and `tint` where it
// has none; each is baked to one geometry with its colours in the vertices,
// flat on the house look, as the flight is painted (look.js). (The
// catalogue's GLB scans are PBR: one art a world, docs/health/RULES.md, keeps
// them out of the flight.) Ground life far off is dropped from its draw
// (lib/three/lod.js's bands); nothing casts a shadow, as the flight draws
// none. Shots are short bolts. Drawn relative to the floating origin.
//
//   withLife(spec, view) → view, its place() also stepping and drawing the
//     planet's life, its dispose() freeing it (scene.js's one call)
//   createLifeLayer(scene, { spec, tier, field, onHit }) → { step(ship, at, dt), stats(), dispose() }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lodBand } from '../../../lib/three/lod';
import { LEVELS, quality } from '../../../lib/device';
import { planetField } from '../../../lib/land/flight/field';
import { isDead, lifeFor } from '../../../lib/land/flight/lifeTables';
import { FIGURES, GALAXY_KINDS, buildFigure, buildGalaxyShip } from '../../galaxy/shared/models';
import { BUILT_KINDS } from '../../universe/shared/flying';
import { createLife } from './life';
import { say } from './lifeNews';

const SHIPS = new Set([...GALAXY_KINDS, ...BUILT_KINDS]);
const FIG = new Set(FIGURES);
// m nose to tail a ship is drawn at, by kind (the rest, a fighter's)
const LENGTH = { transport: 90, hauler: 70, freighter: 60, coreship: 180, acclamator: 300, cloudcar: 9, shuttle: 20, gunship: 18, patrol: 14, deachopper: 16, saucer: 14 };
const FIGHTER = 12;
// (people and beasts drawn half again their size: seen from a fighter's cockpit, at speed)
const FIGURE_SCALE = 1.5;
const FAR = { ground: [3000], air: [14000] }; // m: past these, not drawn
const BOLT = { life: 0.35, length: 14, cap: 96 };

// ── models ──

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const tinted = (geo, hex) => Object.assign(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hex })), {});
// the code-built bodies, facing +z, standing on y = 0 (a flyer and a craft about their middle)
function bodyOf(body, tint) {
  const c = new THREE.Color(tint ?? '#8a8a8a');
  const dark = c.clone().multiplyScalar(0.6).getHex();
  const hex = c.getHex();
  const g = new THREE.Group();
  const add = (geo, h = hex) => g.add(tinted(geo, h));
  if (body === 'beast') {
    add(box(1, 0.9, 2, 0, 1.2, 0));
    add(box(0.6, 0.6, 0.7, 0, 1.6, 1.2));
    for (const [x, z] of [[-0.35, 0.7], [0.35, 0.7], [-0.35, -0.7], [0.35, -0.7]]) add(box(0.22, 0.8, 0.22, x, 0.4, z), dark);
  } else if (body === 'flyer') {
    add(box(0.5, 0.4, 1.4, 0, 0, 0));
    add(box(3.2, 0.06, 0.8, 0, 0.1, -0.1), dark);
    add(box(0.3, 0.3, 0.4, 0, 0.15, 0.8));
  } else if (body === 'walker') {
    add(box(4, 3, 7, 0, 11, 0));
    add(box(2, 1.8, 2.4, 0, 10.5, 4.6));
    for (const [x, z] of [[-1.6, 2.4], [1.6, 2.4], [-1.6, -2.4], [1.6, -2.4]]) add(box(0.8, 9.5, 0.8, x, 4.75, z), dark);
  } else if (body === 'speeder' || body === 'craft') {
    add(box(1.8, 0.7, 5, 0, 0, 0));
    add(box(0.9, 0.5, 1.2, 0, 0.55, -0.6), dark);
    if (body === 'speeder') for (const x of [-1.2, 1.2]) add(box(0.5, 0.5, 2.2, x, 0, -1.6), dark);
  } else if (body === 'drone') {
    g.add(tinted(new THREE.IcosahedronGeometry(0.9, 0), hex));
    for (const a of [0, 1, 2, 3]) add(box(0.08, 2.2, 0.08, Math.cos(a * 1.57) * 0.6, -1.4, Math.sin(a * 1.57) * 0.6), dark);
  } else {
    // a person
    add(box(0.55, 0.8, 0.32, 0, 1.2, 0));
    add(box(0.32, 0.32, 0.32, 0, 1.8, 0));
    for (const x of [-0.14, 0.14]) add(box(0.2, 0.8, 0.22, x, 0.4, 0), dark);
  }
  return g;
}
// the player's kind of craft, in someone else's colours
function wedgeOf(tint) {
  const g = new THREE.Group();
  const c = new THREE.Color(tint ?? '#7a7a8a');
  const hull = new THREE.ConeGeometry(1.4, 12, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4);
  g.add(tinted(hull, c.getHex()));
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 1.5, 7, 0, -4.5, 0, 0, -5, 0, 0, 1.5, 0, 0, -5, -7, 0, -4.5], 3));
  g.add(tinted(wing, c.clone().multiplyScalar(0.7).getHex()));
  return g;
}

// an Object3D's meshes as one geometry, each mesh's colour in its vertices
export function bake(object) {
  object.updateMatrixWorld(true);
  const parts = [];
  object.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    g = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.computeVertexNormals();
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const col = m?.color ?? new THREE.Color('#888888');
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(arr, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
    parts.push(g);
  });
  const merged = parts.length ? mergeGeometries(parts, false) : new THREE.BoxGeometry(1, 1, 1);
  for (const p of parts) p.dispose();
  return merged;
}

const freeObject = (o) =>
  o.traverse((m) => {
    m.geometry?.dispose();
    for (const x of Array.isArray(m.material) ? m.material : [m.material]) {
      x?.map?.dispose?.();
      x?.emissiveMap?.dispose?.();
      x?.dispose?.();
    }
  });

// a model's one geometry, scaled to its size, facing +z, a ship centred on its middle
export function modelGeometry(model, row = {}, air = false) {
  let object;
  let built = null; // (a ship's builder, which frees its own kit)
  let fit = null;
  if (FIG.has(model)) object = buildFigure(model)?.model;
  else if (SHIPS.has(model) && air) {
    // (a builder that can't paint its panels, with no canvas to paint on, gives way to the stand-in)
    try {
      built = buildGalaxyShip(model);
      object = built.group;
    } catch {
      object = null;
    }
    fit = LENGTH[model] ?? FIGHTER;
  } else if (model === 'wedge') {
    object = wedgeOf(row.tint);
    fit = LENGTH[row.name] ?? FIGHTER;
  }
  if (!object) {
    object = bodyOf(row.body ?? (air ? 'craft' : 'person'), row.tint);
    if (air) fit ??= LENGTH[row.name] ?? (row.body === 'flyer' || row.body === 'drone' || row.body === 'person' ? null : FIGHTER);
  }
  const g = bake(object);
  freeObject(object);
  built?.dispose();
  g.computeBoundingBox();
  const bb = g.boundingBox;
  if (fit) {
    const size = bb.getSize(new THREE.Vector3());
    const s = fit / Math.max(size.x, size.y, size.z, 1e-3);
    const mid = bb.getCenter(new THREE.Vector3());
    g.translate(-mid.x, -mid.y, -mid.z).scale(s, s, s);
  } else if (!air) g.scale(FIGURE_SCALE, FIGURE_SCALE, FIGURE_SCALE);
  return g;
}

// ── pools: one InstancedMesh a model, written afresh each frame, grown as needed ──

function createDraws(scene) {
  const root = new THREE.Group();
  root.name = 'flight-life';
  scene.add(root);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  material.name = 'flight-life';
  const draws = new Map(); // key → { geometry, mesh, cap }
  const meshOf = (d, cap) => {
    const mesh = new THREE.InstancedMesh(d.geometry, material, cap);
    mesh.frustumCulled = false; // (its instances are spread over the land: see lib/three/pool.js)
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  };
  const drawOf = (key, make) => {
    let d = draws.get(key);
    if (!d) {
      d = { geometry: make(), cap: 16, n: 0 };
      d.mesh = meshOf(d, d.cap);
      root.add(d.mesh);
      draws.set(key, d);
    }
    return d;
  };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  return {
    root,
    material,
    begin() {
      for (const d of draws.values()) d.n = 0;
    },
    put(key, make, x, y, z, yaw, pitch = 0, roll = 0) {
      const d = drawOf(key, make);
      if (d.n >= d.cap) {
        // (grown: a new mesh twice the size, the old one's written instances kept)
        const was = d.mesh;
        d.cap *= 2;
        d.mesh = meshOf(d, d.cap);
        d.mesh.instanceMatrix.array.set(was.instanceMatrix.array.subarray(0, d.n * 16));
        root.remove(was);
        was.dispose();
        root.add(d.mesh);
      }
      e.set(pitch, yaw, roll);
      m.compose(p.set(x, y, z), q.setFromEuler(e), one);
      d.mesh.setMatrixAt(d.n++, m);
    },
    end() {
      for (const d of draws.values()) {
        d.mesh.count = d.n;
        d.mesh.instanceMatrix.needsUpdate = true;
      }
    },
    count: () => draws.size,
    dispose() {
      for (const d of draws.values()) {
        d.mesh.dispose();
        d.geometry.dispose();
      }
      draws.clear();
      material.dispose();
      root.removeFromParent();
    },
  };
}

// the bolts: short streaks from the shooter to where it aimed
function createBolts(root) {
  const geo = new THREE.BoxGeometry(0.35, 0.35, BOLT.length);
  const mat = new THREE.MeshBasicMaterial({ color: '#ff5a3a', fog: false });
  const mesh = new THREE.InstancedMesh(geo, mat, BOLT.cap);
  mesh.frustumCulled = false;
  mesh.count = 0;
  root.add(mesh);
  const live = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const fwd = new THREE.Vector3(0, 0, 1);
  const one = new THREE.Vector3(1, 1, 1);
  return {
    fire(s) {
      for (let k = 0; k < s.n && live.length < BOLT.cap; k++) live.push({ from: s.from, to: s.at, age: -k * 0.06 });
    },
    step(dt, at) {
      let n = 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        s.age += dt;
        if (s.age > BOLT.life) {
          live.splice(i, 1);
          continue;
        }
        if (s.age < 0) continue;
        const k = s.age / BOLT.life;
        a.set(s.from[0] - at[0], s.from[1] - at[1], s.from[2] - at[2]);
        b.set(s.to[0] - at[0], s.to[1] - at[1], s.to[2] - at[2]);
        const dir = b.clone().sub(a).normalize();
        a.lerp(b, k);
        q.setFromUnitVectors(fwd, dir);
        mesh.setMatrixAt(n++, m.compose(a, q, one));
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

export function createLifeLayer(scene, { spec, tier = 'mid', field = planetField(spec), onHit = null } = {}) {
  const life = lifeFor(spec);
  // a dead world: no pool, no brain, nothing to step
  if (isDead(life)) return { step() {}, stats: () => ({ dead: true, draws: 0 }), dispose() {} };
  const streamer = createLife({ spec, life, tier, field, onHit });
  const draws = createDraws(scene);
  const bolts = createBolts(draws.root);
  const bands = new Map(); // id → its LOD band last frame
  const makers = new Map();
  const makerOf = (a) => {
    const key = `${a.air ? 'a' : 'g'}:${a.model}:${a.row?.body ?? ''}:${a.row?.tint ?? ''}`;
    if (!makers.has(key)) makers.set(key, () => modelGeometry(a.model, a.row, a.air));
    return [key, makers.get(key)];
  };
  let lastNews = -Infinity;
  let t = 0;
  let ms = 0;
  return {
    step(ship, at, dt) {
      const t0 = performance.now();
      t += dt;
      const out = streamer.update(ship, dt);
      for (const id of out.drop) bands.delete(id);
      for (const s of out.shots) bolts.fire(s);
      // (one line, and not again within ten seconds)
      if (out.news.length && t - lastNews > 10) {
        lastNews = t;
        say(out.news[0]);
      }
      draws.begin();
      for (const a of streamer.actors.values()) {
        const d = Math.hypot(a.b.x - ship.x, a.b.z - ship.z);
        const band = lodBand(d, a.air ? FAR.air : FAR.ground, bands.get(a.id) ?? -1, 0.1);
        bands.set(a.id, band);
        if (band > 0) continue;
        const [key, make] = makerOf(a);
        // (a ship's yaw is the flight's, nose down −z; the models face +z)
        if (a.air) draws.put(key, make, a.b.x - at[0], a.b.y - at[1], a.b.z - at[2], a.b.yaw + Math.PI, -a.b.pitch, a.b.roll);
        else draws.put(key, make, a.b.x - at[0], a.b.y - at[1], a.b.z - at[2], a.b.yaw);
      }
      draws.end();
      bolts.step(dt, at);
      ms = performance.now() - t0;
    },
    // (the checks look at who's about: scripts' screenshots and the perf probe)
    actors: streamer.actors,
    stats: () => ({ ...streamer.stats(), draws: draws.count(), frameMs: ms }),
    dispose() {
      bolts.dispose();
      draws.dispose();
    },
  };
}

// the tier the visitor's device is drawn at (lib/device), for the life's density and budget
const tierNow = () => {
  try {
    const level = quality().level;
    return LEVELS.includes(level) ? level : 'mid';
  } catch {
    return 'mid';
  }
};

export function withLife(spec, view) {
  const layer = createLifeLayer(view.scene, { spec, tier: tierNow() });
  const place = view.place;
  const dispose = view.dispose;
  view.life = layer;
  view.place = (s, at, dt = 0) => {
    place(s, at, dt);
    layer.step(s, at, dt);
  };
  view.dispose = () => {
    layer.dispose();
    dispose();
  };
  if (typeof window !== 'undefined') window.__FLIGHT_LIFE__ = layer;
  return view;
}
