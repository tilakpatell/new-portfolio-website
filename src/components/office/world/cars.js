// The cars in the lot, modelled rather than boxed: each body is its side
// profile drawn as a shape, wheel arches cut out of it, extruded to its
// width with rounded edges; then the glass (windscreen, back window and
// side windows), the wheels with their hubs, the lights, grille, bumpers,
// mirrors and number plates. Mid-2000s cars in a mid-2000s lot: a sedan,
// an SUV, a hatchback, Michael's Sebring and Dwight's red '87 Trans Am with
// its pop-up lights shut and the bird on the bonnet.
//
// makeCars() → { car(kind, colour) → Group (on y = 0, nose to +z), dispose() }

import * as THREE from 'three';

// side profiles, [z (nose at +), y] from the tail round over the top to the nose,
// and the car's numbers: length, width, wheelbase, wheel radius, the glass's corners
const KINDS = {
  sedan: {
    len: 4.6,
    wide: 1.78,
    wheel: 0.32,
    base: 2.7,
    body: [
      [-2.3, 0.32],
      [-2.32, 0.62],
      [-2.2, 0.9],
      [-1.55, 0.95],
      [-1.0, 1.4],
      [0.45, 1.42],
      [1.15, 0.98],
      [2.18, 0.82],
      [2.3, 0.6],
      [2.28, 0.32],
    ],
    glass: [
      [-1.5, 0.97],
      [-0.98, 1.37],
      [0.44, 1.39],
      [1.08, 0.99],
    ],
  },
  suv: {
    len: 4.75,
    wide: 1.9,
    wheel: 0.37,
    base: 2.8,
    body: [
      [-2.37, 0.4],
      [-2.38, 1.05],
      [-2.3, 1.75],
      [-1.9, 1.82],
      [0.55, 1.82],
      [1.15, 1.18],
      [2.28, 1.05],
      [2.38, 0.75],
      [2.35, 0.4],
    ],
    glass: [
      [-2.3, 1.15],
      [-2.24, 1.72],
      [0.52, 1.74],
      [1.08, 1.2],
    ],
  },
  hatch: {
    len: 4.1,
    wide: 1.72,
    wheel: 0.3,
    base: 2.5,
    body: [
      [-2.04, 0.32],
      [-2.06, 0.85],
      [-1.9, 1.38],
      [0.3, 1.45],
      [1.0, 0.98],
      [1.95, 0.82],
      [2.06, 0.6],
      [2.04, 0.32],
    ],
    glass: [
      [-1.92, 0.98],
      [-1.82, 1.34],
      [0.28, 1.4],
      [0.95, 1.0],
    ],
  },
  sebring: {
    len: 4.85,
    wide: 1.8,
    wheel: 0.33,
    base: 2.75,
    body: [
      [-2.42, 0.34],
      [-2.44, 0.66],
      [-2.3, 0.92],
      [-1.4, 0.98],
      [-0.85, 1.36],
      [0.35, 1.38],
      [1.05, 1.0],
      [2.3, 0.84],
      [2.42, 0.62],
      [2.4, 0.34],
    ],
    glass: [
      [-1.35, 0.99],
      [-0.84, 1.33],
      [0.34, 1.35],
      [0.98, 1.01],
    ],
  },
  transam: {
    len: 4.9,
    wide: 1.84,
    wheel: 0.32,
    base: 2.56,
    body: [
      [-2.45, 0.3],
      [-2.46, 0.72],
      [-2.3, 0.86],
      [-1.75, 0.9],
      [-0.75, 1.24],
      [0.25, 1.26],
      [0.9, 0.92],
      [2.3, 0.72],
      [2.46, 0.5],
      [2.44, 0.3],
    ],
    glass: [
      [-1.7, 0.91],
      [-0.75, 1.21],
      [0.24, 1.23],
      [0.85, 0.93],
    ],
  },
};
const KIND_OF = { sedan: 'sedan', suv: 'suv', hatch: 'hatch', sebring: 'sebring', transam: 'transam' };

export function makeCars() {
  const own = [];
  const keep = (x) => (own.push(x), x);
  const mats = new Map();
  const paintOf = (c) => {
    if (!mats.has(c)) mats.set(c, keep(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.28 })));
    return mats.get(c);
  };
  const M = {
    glass: keep(new THREE.MeshStandardMaterial({ color: 0x1a2129, roughness: 0.05, metalness: 0.8, envMapIntensity: 1.4, side: THREE.DoubleSide })),
    tyre: keep(new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9 })),
    hub: keep(new THREE.MeshStandardMaterial({ color: 0xbfc3c7, roughness: 0.28, metalness: 0.9 })),
    trim: keep(new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.55 })),
    arch: keep(new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 1 })),
    head: keep(new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.1, metalness: 0.5 })),
    tail: keep(new THREE.MeshStandardMaterial({ color: 0x8a1016, roughness: 0.2, emissive: 0x2a0204, emissiveIntensity: 1 })),
    plate: keep(new THREE.MeshStandardMaterial({ color: 0xeeece4, roughness: 0.5 })),
    gold: keep(new THREE.MeshStandardMaterial({ color: 0xd2a640, roughness: 0.35, metalness: 0.85 })),
  };
  // per kind: the body's geometry, made once
  const bodies = new Map();
  const bodyOf = (kind) => {
    if (bodies.has(kind)) return bodies.get(kind);
    const k = KINDS[kind];
    const s = new THREE.Shape();
    // the outline, with the wheel arches cut up into the bottom edge
    const [first, ...rest] = k.body;
    s.moveTo(first[0], first[1]);
    for (const [z, y] of rest) s.lineTo(z, y);
    const archR = k.wheel + 0.07;
    const front = k.base / 2;
    const rear = -k.base / 2;
    const bottom = k.body[0][1];
    // along the bottom, nose to tail, round each arch
    s.lineTo(front + archR, bottom);
    s.absarc(front, k.wheel, archR, 0, Math.PI, false);
    s.lineTo(rear + archR, bottom);
    s.absarc(rear, k.wheel, archR, 0, Math.PI, false);
    s.lineTo(first[0], first[1]);
    const depth = k.wide - 0.12;
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 });
    // the profile is in (z, y): lay it so x is across the car and z along
    // it, nose to +z (the extrusion's depth becomes the width, centred)
    geo.rotateY(-Math.PI / 2);
    geo.translate(depth / 2, 0, 0);
    geo.computeVertexNormals();
    // the glass: the side windows, a little proud of the body, and the
    // windscreen and back window across the top
    const [g0, g1, g2, g3] = k.glass;
    const side = new THREE.Shape();
    side.moveTo(g0[0] + 0.05, g0[1] + 0.03);
    side.lineTo(g1[0] + 0.07, g1[1] - 0.03);
    side.lineTo(g2[0] - 0.05, g2[1] - 0.03);
    side.lineTo(g3[0] - 0.08, g3[1] + 0.03);
    side.closePath();
    const sideGeo = new THREE.ShapeGeometry(side);
    sideGeo.rotateY(-Math.PI / 2); // (facing -x)
    const glassParts = [];
    for (const sx of [-1, 1]) {
      const g = sideGeo.clone();
      if (sx > 0) g.scale(-1, 1, 1); // (the glass is two-sided)
      g.translate(sx * (k.wide / 2 + 0.004), 0, 0);
      glassParts.push(g);
    }
    // a strip of glass along the profile from a to b, w across, stood off
    // the body's skin (its rounded edge puts that 5 cm outside the outline)
    const strip = (a, b, w) => {
      const dz = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dz, dy);
      let nz = dy / l;
      let ny = -dz / l;
      if (ny < 0) [nz, ny] = [-nz, -ny];
      const o = 0.062;
      const A = [a[0] + nz * o, a[1] + ny * o];
      const B = [b[0] + nz * o, b[1] + ny * o];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, A[1], A[0], w / 2, A[1], A[0], w / 2, B[1], B[0], -w / 2, A[1], A[0], w / 2, B[1], B[0], -w / 2, B[1], B[0]], 3));
      g.computeVertexNormals();
      return g;
    };
    glassParts.push(strip(g3, g2, k.wide * 0.84), strip(g0, g1, k.wide * 0.82));
    const glass = mergeFlat(glassParts);
    for (const g of [sideGeo, ...glassParts]) g.dispose();
    const out = { body: keep(geo), glass: keep(glass), k };
    bodies.set(kind, out);
    return out;
  };
  const shared = {
    tyre: keep(new THREE.CylinderGeometry(1, 1, 1, 22).rotateZ(Math.PI / 2)),
    hub: keep(new THREE.CylinderGeometry(1, 1, 1, 18).rotateZ(Math.PI / 2)),
    box: keep(new THREE.BoxGeometry(1, 1, 1)),
  };
  const part = (geo, mat, [x, y, z], [sx, sy, sz] = [1, 1, 1], parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const car = (kindIn, colour) => {
    const kind = KIND_OF[kindIn] ?? 'sedan';
    const { body, glass, k } = bodyOf(kind);
    const g = new THREE.Group();
    const paint = paintOf(colour);
    part(body, paint, [0, 0, 0], [1, 1, 1], g);
    part(glass, M.glass, [0, 0, 0], [1, 1, 1], g).castShadow = false;
    // the wheels: tyre and hub; and the arches, cut right through the
    // extruded body, closed with dark between the wheels
    const halfW = k.wide / 2;
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const at = [sx * (halfW - 0.13), k.wheel, (sz * k.base) / 2];
        part(shared.tyre, M.tyre, at, [0.21, k.wheel, k.wheel], g);
        part(shared.hub, M.hub, [at[0] + sx * 0.1, at[1], at[2]], [0.02, k.wheel * 0.62, k.wheel * 0.62], g).castShadow = false;
      }
      part(shared.box, M.arch, [0, k.wheel + 0.02, (sz * k.base) / 2], [k.wide - 0.48, (k.wheel + 0.07) * 1.6, (k.wheel + 0.07) * 1.9], g).castShadow = false;
    }
    // nose and tail: bumpers, lights, the grille, plates
    const nose = k.body[k.body.length - 1][0];
    const tail = k.body[0][0];
    const lowY = k.body[0][1] + 0.12;
    const noseTop = k.body[k.body.length - 2][1];
    // (the skin is 5 cm outside the outline: the extrusion's rounded edge)
    part(shared.box, M.trim, [0, lowY, nose + 0.06], [k.wide - 0.04, 0.16, 0.12], g);
    part(shared.box, M.trim, [0, lowY, tail - 0.06], [k.wide - 0.04, 0.16, 0.12], g);
    const lightY = Math.min(noseTop - 0.08, lowY + 0.3);
    if (kind !== 'transam') for (const sx of [-1, 1]) part(shared.box, M.head, [sx * (halfW - 0.28), lightY, nose + 0.06], [0.34, 0.12, 0.04], g).castShadow = false;
    else part(shared.box, M.trim, [0, lightY - 0.04, nose + 0.065], [k.wide - 0.3, 0.05, 0.03], g); // the Trans Am's slot of a grille, its lights folded away
    if (kind !== 'transam') part(shared.box, M.trim, [0, lightY - 0.02, nose + 0.06], [0.62, 0.1, 0.04], g);
    for (const sx of [-1, 1]) part(shared.box, M.tail, [sx * (halfW - 0.25), lightY + 0.04, tail - 0.06], [0.4, 0.12, 0.04], g).castShadow = false;
    part(shared.box, M.plate, [0, lowY + 0.02, nose + 0.115], [0.3, 0.15, 0.01], g).castShadow = false;
    part(shared.box, M.plate, [0, lowY + 0.24, tail - 0.075], [0.3, 0.15, 0.01], g).castShadow = false;
    // mirrors, at the front of the side windows
    const [, , , g3] = k.glass;
    for (const sx of [-1, 1]) part(shared.box, paint, [sx * (halfW + 0.06), g3[1] + 0.06, g3[0] - 0.12], [0.12, 0.1, 0.16], g);
    // the door's shut line and a handle each side
    for (const sx of [-1, 1]) {
      part(shared.box, M.trim, [sx * (halfW + 0.006), (lowY + g3[1]) / 2 + 0.05, (g3[0] + k.glass[1][0]) / 2 + 0.1], [0.004, g3[1] - lowY - 0.1, 0.006], g).castShadow = false;
      part(shared.box, M.trim, [sx * (halfW + 0.012), g3[1] - 0.12, (g3[0] + k.glass[1][0]) / 2 - 0.15], [0.02, 0.03, 0.14], g).castShadow = false;
    }
    if (kind === 'transam') {
      // the screaming chicken, gold on the bonnet, and the spoiler on the boot
      // (on the bonnet's slope, from the windscreen's foot to the nose)
      const [h0, h1] = [k.body[k.body.length - 4], k.body[k.body.length - 3]];
      const bird = part(shared.box, M.gold, [0, (h0[1] + h1[1]) / 2 + 0.056, (h0[0] + h1[0]) / 2], [0.95, 0.008, 0.62], g);
      bird.rotation.x = Math.atan2(h0[1] - h1[1], h1[0] - h0[0]);
      bird.castShadow = false;
      part(shared.box, paint, [0, k.body[2][1] + 0.1, tail + 0.22], [k.wide - 0.1, 0.04, 0.24], g);
      for (const sx of [-1, 1]) part(shared.box, paint, [sx * (halfW - 0.2), k.body[2][1] + 0.05, tail + 0.22], [0.05, 0.1, 0.1], g);
    }
    return g;
  };

  return {
    car,
    dispose() {
      for (const o of own) o.dispose?.();
    },
  };
}

// a few flat pieces as one geometry (position and normal)
function mergeFlat(list) {
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const geo = new THREE.BufferGeometry();
  for (const key of ['position', 'normal']) {
    const total = flat.reduce((n, g) => n + g.attributes[key].array.length, 0);
    const a = new Float32Array(total);
    let o = 0;
    for (const g of flat) {
      a.set(g.attributes[key].array, o);
      o += g.attributes[key].array.length;
    }
    geo.setAttribute(key, new THREE.BufferAttribute(a, 3));
  }
  for (const g of flat) if (!list.includes(g)) g.dispose();
  return geo;
}
