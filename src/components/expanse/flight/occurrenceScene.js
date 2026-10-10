// The planet's occurrences and events drawn (./events.js decides, this
// draws): each kind of occurrence a code-built stand-in (a wreck, a pit, a
// camp of tents, a bunker, a beacon's mast, a ruin's pillars, a scatter of
// bones or stones, a hut), one instanced draw a kind, baked to vertex
// colours on the flight's painted look as the planet's life is
// (./lifeScene.js's bake); the shots a camp or a raid fires as short bolts;
// a shower's craters as dark decals kept for the visit (at most 40, never
// written to the ground); and the event on now through ./eventPlays.js, its
// light and fog eased in and out and put back exactly as they were when it
// ends or you leave.
//
//   withOccurrences(spec, view) → view, its place() also stepping the
//     occurrences, its dispose() clearing them (scene.js's one call);
//     view.occurrences: the layer (events.js's), window.__FLIGHT_OCC__ for the checks
//   createOccurrenceDraw(view, { spec, field }) → events.js's draw

import * as THREE from 'three';
import { planetField } from '../../../lib/land/flight/field';
import { createFlightDirector } from '../../../lib/land/flight/director';
import { bake } from './lifeScene';
import { createOccurrences } from './events';
import { eventsOf } from './planets';
import { fade, makePlay } from './eventPlays';

const CAP = 64; // occurrences of a kind drawn at most (a 3 × 3 of cells holds 54 in all)
const CRATERS = 40;
const BOLT = { life: 0.45, length: 16, cap: 64 };
const EASE = 4; // s a look takes to come and go

// ── the stand-ins: facing +z, standing on y = 0 ──
const box = (w, h, d, x, y, z, hex, rx = 0, ry = 0, rz = 0) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z), new THREE.MeshBasicMaterial({ color: hex }));
const cone = (r, h, x, z, hex) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 6).translate(x, h / 2, z), new THREE.MeshBasicMaterial({ color: hex }));

function standIn(kind, p) {
  const g = new THREE.Group();
  const rock = p.rock ?? '#6a6a6a';
  const accent = p.accent ?? '#8a7a5a';
  const add = (m) => g.add(m);
  switch (kind) {
    case 'wreck':
      add(box(8, 5, 30, 0, 2, 0, '#5a5a62', 0.15, 0, 0.35));
      add(box(22, 1, 7, 6, 1, 4, '#44444a', 0, 0.5, -0.3));
      add(box(4, 3, 6, -3, 1.5, -14, '#2a2a2e', 0.4));
      break;
    case 'cave':
      add(new THREE.Mesh(new THREE.CylinderGeometry(22, 26, 3, 12).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: '#0e0c0c' })));
      for (let i = 0; i < 7; i++) add(box(9, 6 + (i % 3) * 3, 7, Math.cos(i * 0.9) * 26, 3, Math.sin(i * 0.9) * 26, rock, 0, i));
      break;
    case 'camp':
      for (const [x, z] of [[-14, -6], [10, -10], [0, 14]]) add(cone(7, 10, x, z, accent));
      add(box(4, 3, 4, 0, 1.5, 0, '#ff7a2a'));
      add(box(6, 3, 3, 18, 1.5, 8, '#5a4a3a'));
      break;
    case 'outpost':
      add(box(26, 10, 22, 0, 5, 0, '#7a7e86'));
      add(box(14, 4, 12, 0, 12, 0, '#5a5e66'));
      add(box(1.2, 26, 1.2, 9, 20, 7, '#3a3a3e'));
      break;
    case 'beacon':
      add(box(1.6, 38, 1.6, 0, 19, 0, '#4a4a4e'));
      add(box(5, 5, 5, 0, 40, 0, '#ffd040'));
      add(box(10, 2, 10, 0, 1, 0, rock));
      break;
    case 'ruin':
      for (let i = 0; i < 5; i++) add(box(5, 10 + ((i * 7) % 4) * 6, 5, Math.cos(i * 1.26) * 20, 5 + ((i * 7) % 4) * 3, Math.sin(i * 1.26) * 20, rock));
      add(box(30, 3, 5, 0, 24, -20, rock, 0, 0, 0.08));
      break;
    case 'field':
      for (let i = 0; i < 10; i++) add(box(3 + (i % 3) * 2, 2 + (i % 4), 6 + (i % 2) * 6, Math.cos(i * 2.4) * (12 + i * 4), 1.5, Math.sin(i * 2.4) * (12 + i * 4), i % 2 ? '#d8d0c0' : rock, 0, i, 0.3));
      break;
    default:
      add(box(16, 9, 12, 0, 4.5, 0, accent));
      add(box(18, 2, 14, 0, 10, 0, rock, 0, 0, 0.1));
      add(new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1, 12).translate(20, 0.5, 6), new THREE.MeshBasicMaterial({ color: '#4a6a8a' })));
  }
  const geo = bake(g);
  g.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return geo;
}

// the light and the fog, as they were, and an event's look eased over them
function createAtmosphere(view) {
  const scene = view.scene;
  const fog = scene.fog;
  const sky = scene.children.find((o) => o.material?.uniforms?.uLow);
  let base = null;
  let house = null; // the house look's uniforms (its fog is the sky's: eased toward fog.color)
  let grounds = null; // the ground's uWet (a surge raises it)
  let mix = 1;
  let looked = false;
  const tint = new THREE.Color();
  const dark = new THREE.Color('#14141e');
  const warm = new THREE.Color('#c8603a');
  // (taken as a look starts, so whatever set the light since the scene was made is kept)
  const find = () => {
    base = {
      near: fog?.near,
      far: fog?.far,
      color: fog?.color.clone(),
      hemi: view.hemi?.intensity,
      sun: view.sun?.intensity,
      low: sky?.material.uniforms.uLow.value.clone(),
      high: sky?.material.uniforms.uHigh.value.clone(),
    };
    grounds = [];
    scene.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!house && m?.userData?.house) house = m.userData.house;
        if (m?.uniforms?.uWet && !grounds.some((g) => g.u === m.uniforms.uWet)) grounds.push({ u: m.uniforms.uWet, x: m.uniforms.uWet.value.x });
      }
    });
    if (house) mix = house.uLookFogMix.value;
  };
  const restore = () => {
    if (!looked) return;
    looked = false;
    if (fog) {
      fog.near = base.near;
      fog.far = base.far;
      fog.color.copy(base.color);
    }
    if (view.hemi) view.hemi.intensity = base.hemi;
    if (view.sun) view.sun.intensity = base.sun;
    if (sky) {
      sky.material.uniforms.uLow.value.copy(base.low);
      sky.material.uniforms.uHigh.value.copy(base.high);
    }
    if (house) house.uLookFogMix.value = mix;
    for (const g of grounds ?? []) g.u.value.x = g.x;
  };
  return {
    apply(look, k) {
      if (!look || k <= 0) return restore();
      if (!looked) find();
      looked = true;
      if (fog && look.vis) {
        fog.far = base.far + (look.vis - base.far) * k;
        fog.near = base.near + (Math.min(base.near, look.vis * 0.08) - base.near) * k;
      }
      if (fog && look.tint) {
        tint.set(look.tint);
        fog.color.copy(base.color).lerp(tint, k);
        if (house) house.uLookFogMix.value = mix + (0.1 - mix) * k;
        if (sky) {
          sky.material.uniforms.uLow.value.copy(base.low).lerp(tint, k * 0.85);
          sky.material.uniforms.uHigh.value.copy(base.high).lerp(tint, k * 0.7);
        }
      }
      const dim = (look.dim ?? 0) * k;
      if (view.hemi) view.hemi.intensity = base.hemi * (1 - dim) + (look.flash ?? 0) * 2.5;
      if (view.sun) view.sun.intensity = base.sun * (1 - dim);
      if (dim && sky) {
        const to = look.warm ? warm : dark;
        sky.material.uniforms.uLow.value.copy(base.low).lerp(to, dim);
        sky.material.uniforms.uHigh.value.copy(base.high).lerp(dark, dim);
        if (fog) fog.color.copy(base.color).lerp(to, dim);
      }
      for (const g of grounds) g.u.value.x = g.x + (look.surge ?? 0) * k;
    },
    restore,
  };
}

export function createOccurrenceDraw(view, { spec, field }) {
  const root = new THREE.Group();
  root.name = 'flight-occurrences';
  view.scene.add(root);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  material.name = 'flight-occurrences';
  const meshes = new Map(); // kind → InstancedMesh
  const meshOf = (kind) => {
    if (!meshes.has(kind)) {
      const mesh = new THREE.InstancedMesh(standIn(kind, spec.palette ?? {}), material, CAP);
      mesh.frustumCulled = false;
      mesh.count = 0;
      root.add(mesh);
      meshes.set(kind, mesh);
    }
    return meshes.get(kind);
  };
  let placed = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();

  // bolts: short streaks from the shooter to where it aimed
  const boltMat = new THREE.MeshBasicMaterial({ color: '#ff5a3a', fog: false });
  const bolts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.4, BOLT.length), boltMat, BOLT.cap);
  bolts.frustumCulled = false;
  bolts.count = 0;
  root.add(bolts);
  const live = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const fwd = new THREE.Vector3(0, 0, 1);

  // craters: dark discs on the ground, for the visit
  const craterMat = new THREE.MeshBasicMaterial({ color: '#1a1410', transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const craters = new THREE.InstancedMesh(new THREE.CircleGeometry(9, 14).rotateX(-Math.PI / 2), craterMat, CRATERS);
  craters.frustumCulled = false;
  craters.count = 0;
  root.add(craters);
  const holes = [];

  const atmos = createAtmosphere(view);
  const ctx = {
    root,
    material,
    camera: view.camera,
    field,
    spec,
    fire: (from, to) => live.length < BOLT.cap && live.push({ from, to, age: 0 }),
    crater: (x, y, z) => holes.length < CRATERS && holes.push([x, y + 0.3, z]),
  };
  let play = null;
  let playing = null;

  return {
    occurrences(list) {
      placed = list;
    },
    // (events.js's shape, { from, to }; the plays call ctx.fire with the two apart)
    fire: ({ from, to }) => ctx.fire(from, to),
    begin(ev) {
      play?.dispose();
      playing = ev;
      play = null;
      try {
        play = makePlay(ev, ctx, view.lastShip ?? { x: ev.at[0], y: 0, z: ev.at[1] });
      } catch (err) {
        // (an event that can't be drawn is one fewer thing on the screen, never a broken frame)
        console.warn(`flight: ${ev.kind} could not be played`, err);
      }
    },
    end(ev) {
      if (playing?.id !== ev.id) return;
      play?.dispose();
      play = null;
      playing = null;
      atmos.restore();
    },
    step(ship, at, dt, ev) {
      // the occurrences
      for (const mesh of meshes.values()) mesh.count = 0;
      for (const o of placed) {
        const mesh = meshOf(o.kind);
        if (mesh.count >= CAP) continue;
        q.setFromAxisAngle(up, o.yaw);
        mesh.setMatrixAt(mesh.count++, m.compose(p.set(o.at[0] - at[0], o.at[1] - at[1], o.at[2] - at[2]), q, one));
      }
      for (const mesh of meshes.values()) mesh.instanceMatrix.needsUpdate = true;
      // the event on now, and its look
      if (play && ev) {
        const age = Date.now() / 1000 - ev.t0;
        play.step(ship, at, dt, age, fade(age, ev.ttl, EASE));
        atmos.apply(play.look, fade(age, ev.ttl, EASE));
      }
      // the bolts
      let n = 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        s.age += dt;
        if (s.age > BOLT.life) {
          live.splice(i, 1);
          continue;
        }
        a.set(s.from[0] - at[0], s.from[1] - at[1], s.from[2] - at[2]);
        b.set(s.to[0] - at[0], s.to[1] - at[1], s.to[2] - at[2]);
        q.setFromUnitVectors(fwd, b.clone().sub(a).normalize());
        a.lerp(b, s.age / BOLT.life);
        bolts.setMatrixAt(n++, m.compose(a, q, one));
      }
      bolts.count = n;
      bolts.instanceMatrix.needsUpdate = true;
      // the craters
      for (let i = 0; i < holes.length; i++) craters.setMatrixAt(i, m.compose(p.set(holes[i][0] - at[0], holes[i][1] - at[1], holes[i][2] - at[2]), q.identity(), one));
      craters.count = holes.length;
      craters.instanceMatrix.needsUpdate = true;
    },
    clear() {
      play?.dispose();
      play = null;
      playing = null;
      atmos.restore();
      placed = [];
      live.length = 0;
      holes.length = 0;
    },
    stats: () => ({ kinds: meshes.size, bolts: live.length, craters: holes.length, playing: playing?.kind ?? null }),
    dispose() {
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        mesh.dispose();
      }
      meshes.clear();
      bolts.geometry.dispose();
      bolts.dispose();
      craters.geometry.dispose();
      craters.dispose();
      boltMat.dispose();
      craterMat.dispose();
      material.dispose();
      root.removeFromParent();
    },
  };
}

export function withOccurrences(spec, view) {
  const field = planetField(spec);
  const draw = createOccurrenceDraw(view, { spec, field });
  const layer = createOccurrences({ spec, field, draw, director: createFlightDirector({ spec, list: eventsOf(spec) }) });
  const place = view.place;
  const dispose = view.dispose;
  view.occurrences = layer;
  let warned = false;
  const frames = [];
  layer.frameMs = () => ({ worst: Math.max(0, ...frames), mean: frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length) });
  view.place = (s, at, dt = 0) => {
    place(s, at, dt);
    view.lastShip = s;
    const t0 = performance.now();
    try {
      layer.step(s, at, dt);
    } catch (err) {
      // (a fault here costs the occurrences their frame, never the flight its own)
      if (!warned) console.warn('flight: the occurrences failed a frame', err);
      warned = true;
    }
    // (the occurrences' own share of the frame, for the perf probe's notes: the worst of the last second's)
    const ms = performance.now() - t0;
    frames.push(ms);
    if (frames.length > 60) frames.shift();
  };
  view.dispose = () => {
    layer.dispose();
    draw.dispose();
    if (typeof window !== 'undefined' && window.__FLIGHT_OCC__ === layer) delete window.__FLIGHT_OCC__;
    dispose();
  };
  if (typeof window !== 'undefined') window.__FLIGHT_OCC__ = Object.assign(layer, { draw });
  return view;
}
