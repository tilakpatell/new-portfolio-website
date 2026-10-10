// The Scranton office in 3D: its materials and props, built to the set as the
// show's own photographs have it. Honey maple laminate desks on wood drawer
// pedestals, each with a black flat panel showing the Dunder Mifflin Digital
// Hub, a white blotter, a black keyboard and a Cisco phone; navy task chairs;
// blue-grey carpet, cream walls, a drop ceiling with fluorescent troffers;
// Michael's darker cherry desk and the curved reception counter.
//
// Surfaces are photographed PBR textures and a few props (the wall clock, the
// plants, legal pads, pens) scanned models, all CC0 from Poly Haven and
// ambientCG (scripts/build-office.py builds them into public/). Loaded only
// when the office is drawn in 3D. Anything that fails to load is replaced by
// a plain stand-in, so the office is never missing a piece.

import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../../lib/texture';
import { SCREENS, mugBand, nameplate, paper, paperBox, screens, sign, speckle } from './paint';
import { gltfLoader } from '../../lib/three/gltf';
import { loadTexture, sharpen } from '../../lib/three/textures';

// The scanned models and how big they are in the office (metres, the larger
// of width and depth unless `h` gives the height instead).
const MODELS = {
  clock: { h: 0.34 },
  plant: { h: 0.82 },
  notepads: { w: 0.3 },
  stationery: { w: 0.24 },
};

const TEXTURES = ['carpet', 'ceiling', 'wall', 'fabric', 'plastic', 'tiles', 'wood'];

// Merge geometries into one, whatever they were built as: each made
// non-indexed with just position, normal and uv, so any mix of three's
// shapes can be joined into a single draw.
export function merge(list) {
  const flat = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
    n.clearGroups();
    return n;
  });
  return mergeGeometries(flat, false);
}

// A box's faces (BoxGeometry's order: +x, -x, +y, -y, +z, -z) made to read
// one spot (u, v) of its texture: a plain part of a label, so a box that's
// printed on some sides only needs just the one material.
export function plainFaces(geo, faces, u, v) {
  const uv = geo.attributes.uv;
  for (const f of faces) for (let i = 0; i < 4; i++) uv.setXY(f * 4 + i, u, v);
  uv.needsUpdate = true;
  return geo;
}

export async function loadKit(renderer) {
  // (decoded off the main thread, as sharp at a slant as the device's tier
  // allows, and shared between the office from above and the one you walk)
  const tex = (url, srgb) => loadTexture(url, { renderer, color: srgb, wrap: true }).catch(() => null);
  const sets = {};
  await Promise.all(
    TEXTURES.map(async (name) => {
      const [map, normalMap, roughnessMap] = await Promise.all([
        name === 'plastic' ? null : tex(`/textures/office/${name}_color.webp`, true),
        tex(`/textures/office/${name}_normal.webp`, false),
        tex(`/textures/office/${name}_rough.webp`, false),
      ]);
      sets[name] = { map, normalMap, roughnessMap };
    }),
  );

  const gltf = gltfLoader();
  const models = {};
  await Promise.all(
    Object.keys(MODELS).map((name) =>
      gltf
        .loadAsync(`/models/office/${name}.glb`)
        .then((g) => (models[name] = fit(g.scene, MODELS[name])))
        .catch(() => (models[name] = null)),
    ),
  );

  // the light: an office HDRI, prefiltered for reflections and ambient light
  let env = null;
  try {
    const hdr = await new HDRLoader().loadAsync('/hdri/office.hdr');
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    env = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    hdr.dispose();
  } catch {
    env = null;
  }

  return makeKit(sets, models, env);
}

// Centre a model on its footprint, sit it on the floor and scale it to size.
function fit(root, spec) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      // a clock's glass came with real transmission, which has three draw
      // every opaque thing in the scene a second time, every frame, to see
      // through it: a sheen of plain clear glass looks the same at a clock's size
      const m = o.material;
      if (m?.transmission > 0) {
        o.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false, normalMap: m.normalMap ?? null, roughnessMap: m.roughnessMap ?? null });
        o.castShadow = false;
        m.dispose();
      }
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const k = spec.h ? spec.h / size.y : spec.w / Math.max(size.x, size.z);
  const holder = new THREE.Group();
  root.position.set(-(box.min.x + size.x / 2), -box.min.y, -(box.min.z + size.z / 2));
  holder.add(root);
  holder.scale.setScalar(k);
  holder.userData.size = size.clone().multiplyScalar(k);
  return holder;
}

export function makeKit(sets, models, env) {
  const disposables = [];
  const keep = (x) => {
    disposables.push(x);
    return x;
  };

  // ── Materials ────────────────────────────────────────────────────────────
  // A textured surface whose texture repeats every `tile` metres over a w×h area.
  const surface = (name, w, h, tile, extra = {}) => {
    const s = sets[name] || {};
    const rep = (t) => {
      if (!t) return null;
      const c = keep(t.clone());
      c.repeat.set(w / tile, h / tile);
      c.needsUpdate = true;
      return c;
    };
    return keep(new THREE.MeshStandardMaterial({ map: rep(s.map), normalMap: rep(s.normalMap), roughnessMap: rep(s.roughnessMap), roughness: 1, metalness: 0, ...extra }));
  };
  const M = {
    plasticDark: keep(new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.55, metalness: 0.05, normalMap: sets.plastic?.normalMap || null, roughnessMap: sets.plastic?.roughnessMap || null })),
    plasticLight: keep(new THREE.MeshStandardMaterial({ color: 0xc9c6bd, roughness: 0.5, metalness: 0.02 })),
    metal: keep(new THREE.MeshStandardMaterial({ color: 0xa7abb0, roughness: 0.32, metalness: 0.9 })),
    chrome: keep(new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.12, metalness: 1 })),
    fabric: keep(new THREE.MeshStandardMaterial({ color: 0x3a4566, map: sets.fabric?.map || null, normalMap: sets.fabric?.normalMap || null, roughnessMap: sets.fabric?.roughnessMap || null, roughness: 1 })),
    rubber: keep(new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.8 })),
    white: keep(new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 })),
  };
  if (M.fabric.map) M.fabric.map.repeat.set(2, 2);

  // ── Scanned models ───────────────────────────────────────────────────────
  const stand = (w, h, d, color) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), keep(new THREE.MeshStandardMaterial({ color, roughness: 0.7 })));
    m.position.y = h / 2;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    g.userData.size = new THREE.Vector3(w, h, d);
    return g;
  };
  const STAND_INS = { clock: [0.34, 0.34, 0.05, 0xeeeeee], plant: [0.5, 0.82, 0.5, 0x3f7d3a], notepads: [0.3, 0.02, 0.2, 0xf2e27a], stationery: [0.24, 0.05, 0.12, 0x999999] };
  // a copy of a model (geometry and materials shared), or its stand-in
  const model = (name) => {
    const src = models[name];
    if (!src) return stand(...STAND_INS[name]);
    const c = src.clone(true);
    c.userData.size = src.userData.size;
    return c;
  };

  // ── Office chair: five-star base on casters, gas lift, seat, back, arms ──
  const chairGeo = (() => {
    const fabric = [];
    const dark = [];
    const seat = new RoundedBoxGeometry(0.5, 0.09, 0.48, 3, 0.03);
    seat.translate(0, 0.415, 0);
    fabric.push(seat);
    const back = new RoundedBoxGeometry(0.46, 0.56, 0.07, 3, 0.03);
    back.rotateX(-0.12);
    back.translate(0, 0.805, -0.25);
    fabric.push(back);
    const lift = new THREE.CylinderGeometry(0.025, 0.03, 0.225, 12);
    lift.translate(0, 0.2625, 0);
    dark.push(lift);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = new THREE.BoxGeometry(0.05, 0.035, 0.3);
      leg.translate(0, 0.08, 0.15);
      leg.rotateY(a);
      dark.push(leg);
      const caster = new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10);
      caster.rotateZ(Math.PI / 2);
      caster.translate(Math.sin(a) * 0.3, 0.028, Math.cos(a) * 0.3);
      dark.push(caster);
    }
    for (const side of [-1, 1]) {
      const post = new THREE.BoxGeometry(0.03, 0.2, 0.04);
      post.translate(side * 0.27, 0.545, -0.02);
      dark.push(post);
      const rest = new RoundedBoxGeometry(0.06, 0.03, 0.26, 2, 0.012);
      rest.translate(side * 0.27, 0.655, 0.0);
      dark.push(rest);
      const strut = new THREE.BoxGeometry(0.04, 0.3, 0.03);
      strut.rotateX(-0.12);
      strut.translate(0, 0.585, -0.24);
      if (side === 1) dark.push(strut);
    }
    return { fabric: keep(merge(fabric)), dark: keep(merge(dark)) };
  })();
  const chair = () => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(chairGeo.fabric, M.fabric);
    const b = new THREE.Mesh(chairGeo.dark, M.plasticDark);
    a.castShadow = b.castShadow = true;
    a.receiveShadow = b.receiveShadow = true;
    g.add(a, b);
    return g;
  };

  // ── Monitor, keyboard, mouse ─────────────────────────────────────────────
  const screenSheet = keep(new THREE.CanvasTexture(screens()));
  screenSheet.colorSpace = THREE.SRGBColorSpace;
  sharpen(screenSheet);
  const monitorGeo = (() => {
    const body = new RoundedBoxGeometry(0.46, 0.3, 0.035, 2, 0.008);
    body.translate(0, 0.33, 0);
    const neck = new THREE.BoxGeometry(0.05, 0.16, 0.03);
    neck.translate(0, 0.12, -0.03);
    const foot = new RoundedBoxGeometry(0.22, 0.015, 0.17, 2, 0.006);
    foot.translate(0, 0.0075, -0.01);
    return keep(merge([body, neck, foot]));
  })();
  const screenMats = SCREENS.map((_, i) => {
    const t = keep(screenSheet.clone());
    t.repeat.set(0.25, 0.5);
    t.offset.set((i % 4) * 0.25, Math.floor(i / 4) === 0 ? 0.5 : 0);
    t.needsUpdate = true;
    return keep(new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0 }));
  });
  const screenGeo = keep(new THREE.PlaneGeometry(0.42, 0.26));
  const monitor = (which = 0) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(monitorGeo, M.plasticDark);
    b.castShadow = true;
    const s = new THREE.Mesh(screenGeo, screenMats[which % screenMats.length]);
    s.position.set(0, 0.335, 0.0185);
    g.add(b, s);
    return g;
  };
  const keyboardGeo = keep(new RoundedBoxGeometry(0.44, 0.022, 0.15, 2, 0.006));
  const mouseGeo = keep(new THREE.SphereGeometry(0.03, 12, 8));
  mouseGeo.scale(0.8, 0.45, 1.2);
  const keyboard = () => {
    const g = new THREE.Group();
    const k = new THREE.Mesh(keyboardGeo, M.plasticDark);
    k.position.y = 0.011;
    const m = new THREE.Mesh(mouseGeo, M.plasticDark);
    m.position.set(0.3, 0.014, 0.02);
    g.add(k, m);
    return g;
  };

  // ── The wastebasket: black, fluted, open; the paper toss's target ────────
  const binGeo = (() => {
    const pts = [];
    const B = { rim: 0.15, base: 0.115, height: 0.34, wall: 0.006 };
    pts.push(new THREE.Vector2(0, 0.004));
    pts.push(new THREE.Vector2(B.base, 0.004));
    pts.push(new THREE.Vector2(B.base + 0.002, 0.012));
    pts.push(new THREE.Vector2(B.rim, B.height - 0.012));
    pts.push(new THREE.Vector2(B.rim + 0.006, B.height));
    pts.push(new THREE.Vector2(B.rim - B.wall, B.height));
    pts.push(new THREE.Vector2(B.base - B.wall, 0.016));
    pts.push(new THREE.Vector2(0, 0.016));
    const g = new THREE.LatheGeometry(pts, 48);
    // flutes: ripple the wall in and out around the basket
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const r = Math.hypot(x, z);
      if (r < 0.05 || y > B.height - 0.015 || y < 0.02) continue;
      const a = Math.atan2(z, x);
      const k = 1 + 0.018 * Math.cos(a * 24);
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
    g.computeVertexNormals();
    return keep(g);
  })();
  const binMat = keep(new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide, normalMap: sets.plastic?.normalMap || null }));
  const bin = () => {
    const m = new THREE.Mesh(binGeo, binMat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // ── A crumpled sheet of paper ─────────────────────────────────────────────
  const paperTex = keep(new THREE.CanvasTexture(paper()));
  paperTex.colorSpace = THREE.SRGBColorSpace;
  const paperMat = keep(new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.88, metalness: 0, flatShading: true }));
  const ballGeos = [1, 2, 3, 4].map((seed) => {
    const g = new THREE.IcosahedronGeometry(0.036, 2);
    const r = rng(seed * 31);
    const pos = g.attributes.position;
    // crumple: push each vertex in or out, the same amount wherever it is shared
    const seen = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
      if (!seen.has(key)) seen.set(key, 0.78 + r() * 0.36);
      const k = seen.get(key);
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    return keep(g);
  });
  const paperBall = (seed = 0) => {
    const m = new THREE.Mesh(ballGeos[seed % ballGeos.length], paperMat);
    m.castShadow = true;
    return m;
  };

  // ── The desk fan: weighted base, neck, motor, cage, three blades, ribbons ─
  const fan = () => {
    const g = new THREE.Group();
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(keep(geo), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    add(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 28), M.plasticLight, 0, 0.02, 0);
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 12), M.chrome, 0, 0.17, 0);
    const head = new THREE.Group();
    head.position.set(0, 0.32, 0);
    g.add(head);
    const motor = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.055, 0.08, 6, 16)), M.plasticLight);
    motor.rotation.x = Math.PI / 2;
    motor.position.z = -0.06;
    head.add(motor);
    const cageMat = keep(new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.3, metalness: 0.8 }));
    // the cage: four rings and sixteen spokes, one mesh
    const cageParts = [];
    for (const [r, z] of [
      [0.17, 0.035],
      [0.17, -0.005],
      [0.11, 0.06],
      [0.05, 0.075],
    ]) {
      const ring = new THREE.TorusGeometry(r, 0.0035, 6, 48);
      ring.translate(0, 0, z);
      cageParts.push(ring);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const spoke = new THREE.CylinderGeometry(0.002, 0.002, 0.17, 4);
      spoke.rotateZ(a);
      spoke.translate(Math.sin(-a) * 0.085, Math.cos(a) * 0.085, 0.07);
      cageParts.push(spoke);
    }
    head.add(new THREE.Mesh(keep(merge(cageParts)), cageMat));
    const blades = new THREE.Group();
    blades.position.z = 0.015;
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0.02);
    bladeShape.quadraticCurveTo(0.07, 0.04, 0.14, 0.005);
    bladeShape.quadraticCurveTo(0.08, -0.05, 0, -0.02);
    const bladeGeo = keep(new THREE.ShapeGeometry(bladeShape, 8));
    const bladeMat = keep(new THREE.MeshStandardMaterial({ color: 0x7fb2d8, roughness: 0.35, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(bladeGeo, bladeMat);
      b.rotation.z = (i / 3) * Math.PI * 2;
      b.rotation.y = 0.35;
      blades.add(b);
    }
    head.add(blades);
    // ribbons tied to the cage: they stream the way the wind blows
    const ribbons = [];
    const ribbonMat = keep(new THREE.MeshStandardMaterial({ color: 0xe8453c, roughness: 0.7, side: THREE.DoubleSide }));
    for (let i = 0; i < 3; i++) {
      const geo = keep(new THREE.PlaneGeometry(0.012, 0.2, 1, 8));
      geo.translate(0, -0.1, 0);
      const rb = new THREE.Mesh(geo, ribbonMat);
      rb.position.set((i - 1) * 0.08, 0.14, 0.04);
      head.add(rb);
      ribbons.push(rb);
    }
    return { group: g, head, blades, ribbons };
  };

  // ── Things on desks ──────────────────────────────────────────────────────
  const mugTex = keep(new THREE.CanvasTexture(mugBand()));
  mugTex.colorSpace = THREE.SRGBColorSpace;
  const mug = () => {
    const g = new THREE.Group();
    const cupMat = keep(new THREE.MeshStandardMaterial({ map: mugTex, roughness: 0.18 }));
    const cup = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.042, 0.04, 0.1, 32, 1, true)), cupMat);
    cup.position.y = 0.05;
    const inside = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.039, 0.037, 0.098, 32, 1, true)), keep(new THREE.MeshStandardMaterial({ color: 0xf7f6f2, roughness: 0.2, side: THREE.BackSide })));
    inside.position.y = 0.051;
    const coffee = new THREE.Mesh(keep(new THREE.CircleGeometry(0.038, 24)), keep(new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.1 })));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.085;
    const base = new THREE.Mesh(keep(new THREE.CircleGeometry(0.04, 24)), M.white);
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.002;
    const handle = new THREE.Mesh(keep(new THREE.TorusGeometry(0.025, 0.007, 8, 20, Math.PI)), M.white);
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(0.042, 0.055, 0);
    g.add(cup, inside, coffee, base, handle);
    return g;
  };
  const beet = () => {
    const g = new THREE.Group();
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector2(Math.sin(t * Math.PI) ** 0.8 * 0.05 * (1 - t * 0.35), t * 0.11 - 0.02));
    }
    const root = new THREE.Mesh(keep(new THREE.LatheGeometry(pts.reverse(), 20)), keep(new THREE.MeshStandardMaterial({ color: 0x7a1530, roughness: 0.55 })));
    root.rotation.z = Math.PI / 2.4;
    root.position.y = 0.045;
    root.castShadow = true;
    g.add(root);
    const leafMat = keep(new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.6, side: THREE.DoubleSide }));
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.04, 0.12)), leafMat);
      leaf.position.set(-0.07 - i * 0.008, 0.07, (i - 1.5) * 0.02);
      leaf.rotation.set(0.3 * (i - 1.5), 0, 0.9 + i * 0.1);
      g.add(leaf);
    }
    return g;
  };
  // Jim's prank: Dwight's stapler, set in a block of lime Jell-O. It's
  // see-through without transmission, which has three draw every opaque thing
  // in the office a second time, every frame the block's in view: wet-looking
  // lime, three-quarters opaque, the stapler showing through, a little lit
  // from inside and a soft sheen at its edges
  const jello = () => {
    const g = new THREE.Group();
    const block = new THREE.Mesh(
      keep(new RoundedBoxGeometry(0.26, 0.11, 0.13, 3, 0.02)),
      keep(new THREE.MeshPhysicalMaterial({ color: 0x8fe36a, roughness: 0.08, sheen: 0.6, sheenColor: 0xd6ffb0, sheenRoughness: 0.3, emissive: 0x3a8a22, emissiveIntensity: 0.25, transparent: true, opacity: 0.75, depthWrite: false })),
    );
    block.position.y = 0.055;
    const st = stapler();
    st.position.set(0, 0.025, 0);
    st.rotation.y = 0.15;
    g.add(st, block);
    const plate = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.17, 0.17, 0.008, 40)), M.white);
    plate.position.y = 0.004;
    plate.receiveShadow = true;
    g.add(plate);
    return g;
  };
  const plates = new Map();
  const plateGeo = keep(new THREE.PlaneGeometry(0.3, 0.056));
  const holderGeo = keep(new THREE.BoxGeometry(0.31, 0.062, 0.03));
  const holderMat = keep(new THREE.MeshStandardMaterial({ color: 0xb9bdc1, roughness: 0.3, metalness: 0.85 }));
  const nameplateFor = (name, title, light = false) => {
    const k = `${name}|${light}`;
    if (!plates.has(k)) {
      const t = keep(new THREE.CanvasTexture(nameplate(name, title, light)));
      t.colorSpace = THREE.SRGBColorSpace;
      sharpen(t);
      plates.set(k, keep(new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.1 })));
    }
    const g = new THREE.Group();
    const face = new THREE.Mesh(plateGeo, plates.get(k));
    face.position.set(0, 0.034, 0.012);
    face.rotation.x = -0.35;
    const back = new THREE.Mesh(holderGeo, holderMat);
    back.position.y = 0.025;
    back.rotation.x = -0.35;
    back.position.z = -0.002;
    g.add(back, face);
    return g;
  };

  // Dwight's stapler: a black desk stapler with its chrome magazine
  const stapler = () => {
    const g = new THREE.Group();
    const black = keep(new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.35, metalness: 0.2 }));
    const base = new THREE.Mesh(keep(new RoundedBoxGeometry(0.19, 0.018, 0.045, 2, 0.006)), black);
    base.position.y = 0.009;
    const arm = new THREE.Mesh(keep(new RoundedBoxGeometry(0.18, 0.026, 0.038, 2, 0.01)), black);
    arm.position.set(0.004, 0.04, 0);
    arm.rotation.z = 0.06;
    const mag = new THREE.Mesh(keep(new THREE.BoxGeometry(0.16, 0.012, 0.03)), M.chrome);
    mag.position.set(0.006, 0.024, 0);
    const hinge = new THREE.Mesh(keep(new THREE.BoxGeometry(0.02, 0.03, 0.04)), black);
    hinge.position.set(-0.085, 0.024, 0);
    g.add(base, arm, mag, hinge);
    return g;
  };

  // ── Desks, as on the set ─────────────────────────────────────────────────
  // Honey maple laminate on a wood drawer pedestal, a modesty panel behind;
  // Michael's is the same build in a darker cherry, with two pedestals.
  const woodMat = (tint) => {
    const s0 = sets.wood || {};
    return keep(new THREE.MeshStandardMaterial({ map: s0.map || null, normalMap: s0.normalMap || null, roughnessMap: s0.roughnessMap || null, color: tint, roughness: 0.55, metalness: 0 }));
  };
  const maple = woodMat(0xf6cf9c);
  const cherry = woodMat(0x6a3424);
  const pullMat = keep(new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.3, metalness: 0.9 }));
  const deskGeo = new Map();
  const desk = ({ w = 1.5, d = 0.76, pedestals = 'right', exec = false } = {}) => {
    const key = `${w}|${d}|${pedestals}|${exec}`;
    if (!deskGeo.has(key)) {
      const wood = [];
      const pulls = [];
      const top = new RoundedBoxGeometry(w, 0.032, d, 2, 0.006);
      top.translate(0, 0.744, 0);
      wood.push(top);
      const pedW = 0.42;
      const sides = pedestals === 'both' ? [-1, 1] : pedestals === 'left' ? [-1] : [1];
      for (const sd of sides) {
        const ped = new THREE.BoxGeometry(pedW, 0.72, d - 0.06);
        ped.translate(sd * (w / 2 - pedW / 2 - 0.02), 0.36, 0.01);
        wood.push(ped);
        // three drawers with their pulls, facing the chair (+z)
        for (let k = 0; k < 3; k++) {
          const y = 0.62 - k * 0.22;
          const pull = new THREE.BoxGeometry(0.12, 0.012, 0.02);
          pull.translate(sd * (w / 2 - pedW / 2 - 0.02), y, d / 2 - 0.02 + 0.012);
          pulls.push(pull);
        }
      }
      // a leg panel at the open end, and the modesty panel along the back
      if (pedestals !== 'both') {
        const leg = new THREE.BoxGeometry(0.035, 0.72, d - 0.08);
        leg.translate(-sides[0] * (w / 2 - 0.04), 0.36, 0);
        wood.push(leg);
      }
      const modesty = new THREE.BoxGeometry(w - 0.1, 0.42, 0.02);
      modesty.translate(0, 0.48, -d / 2 + 0.05);
      wood.push(modesty);
      deskGeo.set(key, { wood: keep(merge(wood)), pulls: keep(merge(pulls)) });
    }
    const geo = deskGeo.get(key);
    const g = new THREE.Group();
    const a = new THREE.Mesh(geo.wood, exec ? cherry : maple);
    const b = new THREE.Mesh(geo.pulls, pullMat);
    a.castShadow = a.receiveShadow = true;
    g.add(a, b);
    g.userData.size = new THREE.Vector3(w, 0.76, d);
    return g;
  };

  // the white blotter under each keyboard
  const blotterGeo = keep(new THREE.BoxGeometry(0.56, 0.004, 0.36));
  const blotterMat = keep(new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.9 }));
  const blotter = () => {
    const m = new THREE.Mesh(blotterGeo, blotterMat);
    m.position.y = 0.002;
    m.receiveShadow = true;
    return m;
  };

  // a Cisco IP phone, as on every desk on the set: a silver-grey wedge with
  // its grey screen, the charcoal handset on the left
  const phoneGeo = (() => {
    const body = new THREE.BoxGeometry(0.2, 0.05, 0.19);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) < 0) p.setY(i, p.getY(i) + (p.getY(i) > 0 ? 0.04 : 0)); // raised at the back
    body.translate(0, 0.025, 0);
    body.computeVertexNormals();
    const handset = new RoundedBoxGeometry(0.05, 0.035, 0.2, 2, 0.015);
    handset.translate(-0.12, 0.06, 0);
    return { body: keep(merge([body])), handset: keep(merge([handset])) };
  })();
  const phoneBodyMat = keep(new THREE.MeshStandardMaterial({ color: 0x9a9fa5, roughness: 0.38, metalness: 0.45 }));
  const phoneScreenMat = keep(new THREE.MeshStandardMaterial({ color: 0x9fb0a6, emissive: 0x6f8478, emissiveIntensity: 0.25, roughness: 0.3 }));
  const phoneScreenGeo = keep(new THREE.PlaneGeometry(0.1, 0.06));
  const phone = () => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(phoneGeo.body, phoneBodyMat);
    const h = new THREE.Mesh(phoneGeo.handset, M.plasticDark);
    const scr = new THREE.Mesh(phoneScreenGeo, phoneScreenMat);
    scr.position.set(0.02, 0.078, -0.035);
    scr.rotation.x = -1.1;
    g.add(b, h, scr);
    return g;
  };

  // a mug of pens (the pens one mesh, coloured per pen)
  const pensGeo = (() => {
    const colors = [0x1f4ea0, 0xd03a2a, 0x111111, 0xe8c12a, 0x2c8a3c, 0x1f4ea0];
    const r0 = rng(9);
    const parts = colors.map((c) => {
      const pen = new THREE.CylinderGeometry(0.004, 0.004, 0.15, 6);
      pen.rotateX((r0() - 0.5) * 0.4);
      pen.rotateZ((r0() - 0.5) * 0.4);
      pen.translate((r0() - 0.5) * 0.04, 0.1, (r0() - 0.5) * 0.04);
      const col = new THREE.Color(c);
      const n = pen.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.toArray(arr, i * 3);
      pen.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return pen.toNonIndexed();
    });
    return keep(mergeGeometries(parts, false));
  })();
  const pensMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }));
  const cupGeo = keep(new THREE.CylinderGeometry(0.035, 0.032, 0.1, 18, 1, true));
  const pencilCup = () => {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(cupGeo, M.plasticDark);
    cup.position.y = 0.05;
    g.add(cup, new THREE.Mesh(pensGeo, pensMat));
    return g;
  };

  // a black dome desk lamp, the kind on Creed's and Ryan's desks
  const deskLamp = () => {
    const g = new THREE.Group();
    const black = M.plasticDark;
    const base = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 24)), black);
    base.position.y = 0.01;
    const stem = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 8)), black);
    stem.position.set(0, 0.19, 0);
    stem.rotation.z = 0.25;
    const shade = new THREE.Mesh(keep(new THREE.SphereGeometry(0.075, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), keep(new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide })));
    shade.position.set(-0.08, 0.36, 0);
    shade.rotation.z = 0.5;
    const bulb = new THREE.Mesh(keep(new THREE.SphereGeometry(0.025, 10, 8)), keep(new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe2a8, emissiveIntensity: 1.6 })));
    bulb.position.set(-0.075, 0.335, 0);
    for (const m of [base, stem, shade]) m.castShadow = true;
    g.add(base, stem, shade, bulb);
    return g;
  };

  // the reception counter: a curve of honey wood with a speckled laminate top
  const speckleTex = keep(new THREE.CanvasTexture(speckle()));
  speckleTex.colorSpace = THREE.SRGBColorSpace;
  speckleTex.wrapS = speckleTex.wrapT = THREE.RepeatWrapping;
  speckleTex.repeat.set(4, 1);
  const reception = () => {
    const g = new THREE.Group();
    const R = 1.2;
    const arc = Math.PI * 0.62;
    const front = new THREE.Mesh(keep(new THREE.CylinderGeometry(R, R, 1.06, 40, 1, true, -arc / 2, arc)), maple);
    front.position.y = 0.53;
    const topGeo = new THREE.RingGeometry(R - 0.32, R + 0.04, 40, 1, -arc / 2 + Math.PI / 2, arc);
    topGeo.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(keep(topGeo), keep(new THREE.MeshStandardMaterial({ map: speckleTex, roughness: 0.4 })));
    top.position.y = 1.07;
    top.rotation.y = Math.PI;
    for (const m of [front, top]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    g.add(front, top);
    return g;
  };

  // a box of Dunder Mifflin paper
  const boxTex = keep(new THREE.CanvasTexture(paperBox()));
  boxTex.colorSpace = THREE.SRGBColorSpace;
  const boxMat = keep(new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.8 }));
  // (one material, so a room's boxes batch into one draw: the top and the
  // bottom read a plain corner of the label)
  const boxGeo = keep(plainFaces(new THREE.BoxGeometry(0.44, 0.27, 0.3), [2, 3], 0.02, 0.98));
  const paperBoxMesh = () => {
    const m = new THREE.Mesh(boxGeo, boxMat);
    m.position.y = 0.135;
    m.castShadow = m.receiveShadow = true;
    return m;
  };

  // ── The room's own parts ─────────────────────────────────────────────────
  const signTex = keep(new THREE.CanvasTexture(sign()));
  signTex.colorSpace = THREE.SRGBColorSpace;
  const companySign = () => new THREE.Mesh(keep(new THREE.PlaneGeometry(2.0, 0.5)), keep(new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 })));
  // a fluorescent troffer: an aluminium frame round a glowing diffuser
  const lightPanel = () => {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(keep(new THREE.BoxGeometry(1.2, 0.03, 0.6)), M.metal);
    const glow = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.12, 0.52)), keep(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f7ff, emissiveIntensity: 2.2, roughness: 1 })));
    glow.rotation.x = Math.PI / 2;
    glow.position.y = -0.016;
    g.add(frame, glow);
    return g;
  };

  return {
    env,
    sets,
    M,
    surface,
    model,
    chair,
    monitor,
    keyboard,
    bin,
    paperBall,
    fan,
    mug,
    beet,
    jello,
    stapler,
    desk,
    blotter,
    phone,
    pencilCup,
    deskLamp,
    reception,
    paperBox: paperBoxMesh,
    nameplate: nameplateFor,
    companySign,
    lightPanel,
    screenCount: SCREENS.length,
    dispose() {
      for (const d of disposables) d.dispose?.();
      for (const s of Object.values(sets)) for (const t of Object.values(s)) t?.dispose?.();
      for (const m of Object.values(models))
        m?.traverse?.((o) => {
          if (!o.isMesh) return;
          o.geometry?.dispose?.();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const mt of mats) {
            for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) mt?.[k]?.dispose?.();
            mt?.dispose?.();
          }
        });
      env?.dispose?.();
    },
  };
}
