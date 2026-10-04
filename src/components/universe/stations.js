// The site's own pages, as stations round the sun on the universe map (each
// builder dresses a place from universes.js: planets.js calls it with the
// place's parts to fill and its textures).
//
// Each station is a few merged meshes, one per material, so it costs a
// handful of draws: plated metal whose parts carry their own paint (a colour
// on every vertex), glass and solar cells where they're wanted, and one mesh
// for all its little lights (windows, nav lights, beacons), each blinking on
// its own clock in the shader and drawn brighter than white, so the bloom
// (post.js) gives them their glow. The lights are the authored signals; the
// metal is lit by the scene and the space environment like everything else.

import * as THREE from 'three';
import { featuredProjects } from '../../data/projects';
import { roles } from '../../data/roles';
import { glowMat, hull, paint, parts, rng, tileRing } from './kit';

// ── The kit the stations are built with ──

const UP = new THREE.Vector3(0, 1, 0);
const v3 = (a) => new THREE.Vector3(...a);
const TAU = Math.PI * 2;

// the turn that points +y along `dir`, as parts() wants it
function aim(dir, from = UP) {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(from, v3(dir).normalize()));
  return [e.x, e.y, e.z];
}

// one colour on every vertex (linear, so a light can be brighter than white)
function paintVerts(geo, color = '#ffffff', name = 'color', k = 1) {
  const c = new THREE.Color(color).multiplyScalar(k);
  const a = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
  geo.setAttribute(name, new THREE.BufferAttribute(a, 3));
  return geo;
}

// a part: its geometry, its paint, and where it goes
const P = (geo, color, pos, rot, scale) => [geo, pos, rot, scale, color];

// parts in their paints, merged into one mesh
const build = (list, material) => new THREE.Mesh(parts(list.map(([geo, pos, rot, scale, color]) => [paintVerts(geo, color), pos, rot, scale])), material);

// a round bar or a square one from a to b
function rod(a, b, r, color, seg = 6) {
  const A = v3(a);
  const B = v3(b);
  return P(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg), color, A.clone().add(B).multiplyScalar(0.5).toArray(), aim(B.clone().sub(A)));
}
function bar(a, b, w, color, d = w) {
  const A = v3(a);
  const B = v3(b);
  return P(new THREE.BoxGeometry(w, A.distanceTo(B), d), color, A.clone().add(B).multiplyScalar(0.5).toArray(), aim(B.clone().sub(A)));
}

// a lattice girder from a to b: four chords, a square frame every bay and a
// diagonal across each face of each bay, zigzagging
function girder(a, b, w, r, bay, color) {
  const A = v3(a);
  const B = v3(b);
  const len = A.distanceTo(B);
  const n = Math.max(1, Math.round(len / bay));
  const step = len / n;
  const h = w / 2;
  const diag = Math.hypot(step, w);
  const ang = Math.atan2(w, step);
  const d = r * 0.7;
  const list = [];
  for (const [x, z] of [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ])
    list.push([new THREE.BoxGeometry(r, len, r), [x, len / 2, z]]);
  for (let i = 0; i <= n; i++) {
    const y = i * step;
    list.push([new THREE.BoxGeometry(w, r, r), [0, y, -h]], [new THREE.BoxGeometry(w, r, r), [0, y, h]], [new THREE.BoxGeometry(r, r, w), [-h, y, 0]], [new THREE.BoxGeometry(r, r, w), [h, y, 0]]);
  }
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) * step;
    const k = i % 2 ? 1 : -1;
    list.push(
      [new THREE.BoxGeometry(d, diag, d), [0, y, h], [0, 0, k * ang]],
      [new THREE.BoxGeometry(d, diag, d), [0, y, -h], [0, 0, -k * ang]],
      [new THREE.BoxGeometry(d, diag, d), [h, y, 0], [k * ang, 0, 0]],
      [new THREE.BoxGeometry(d, diag, d), [-h, y, 0], [-k * ang, 0, 0]],
    );
  }
  return P(parts(list), color, A.toArray(), aim(B.clone().sub(A)));
}

const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

// every uv of a geometry at one spot of its texture (a solar wing's mast in
// the gold of the wing's frame, so it shares the wing's draw)
function uvAt(geo, u, v) {
  const a = geo.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, u, v);
  return geo;
}

// flat faces (an octagon that should look cut, not turned)
function flat(geo) {
  const g = geo.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

// Plated metal whose colour comes from its parts. Without the colour map the
// plates still show in the normal map, so painted white stays white instead
// of the map's grey; `rough` trades the roughness map for an even value (a
// broad soft sheen, where the map's glossy patches would flare in the bloom).
function metal(T, { which = 'plates', repeat = 2, metal = 0.5, map = true, rough = null } = {}) {
  const m = hull(T, '#ffffff', { repeat, metal, which });
  if (!map) m.map = null;
  if (rough !== null) Object.assign(m, { roughnessMap: null, roughness: rough });
  m.vertexColors = true;
  return m;
}

// A station's little lights, all in one mesh: windows, nav lights, beacons.
// Each is { at, rot, r | geo, color, k (how much brighter than white),
// blink: [per second, phase 0–1, share of the cycle it's lit] }; a light
// whose share is 1 or more breathes instead of blinking. The time is
// lights.material.uniforms.uTime.
const BEAD_VERT = `
attribute vec3 aColor;
attribute vec3 aBlink;
uniform float uTime;
varying vec3 vColor;
void main() {
  float c = fract(uTime * aBlink.x + aBlink.y);
  float on = aBlink.z >= 1.0 ? 0.55 + 0.45 * sin(c * 6.2832) : smoothstep(0.0, 0.015, c) * (1.0 - smoothstep(aBlink.z, aBlink.z + 0.03, c));
  vColor = aColor * (aBlink.x > 0.0 ? mix(0.04, 1.0, on) : 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BEAD_FRAG = `
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <colorspace_fragment>
}`;
function beads(list) {
  const geos = list.map(({ at, rot, r = 0.02, geo, color, k = 4, blink = [0, 0, 1] }) => {
    const g = geo ?? new THREE.IcosahedronGeometry(r, 1);
    paintVerts(g, color, 'aColor', k);
    const b = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < b.length; i += 3) b.set(blink, i);
    g.setAttribute('aBlink', new THREE.BufferAttribute(b, 3));
    return [g, at, rot];
  });
  return new THREE.Mesh(parts(geos), new THREE.ShaderMaterial({ vertexShader: BEAD_VERT, fragmentShader: BEAD_FRAG, uniforms: { uTime: { value: 0 } } }));
}

// A cone of light, as a floodlight throws it or a projector does: brightest
// at the lamp, gone by its far end, and soft at its edges (where you look
// through less of it). `from` 1 when the lamp is at the cone's foot.
const CONE_VERT = `
varying vec2 vUv;
varying float vFace;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFace = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
const CONE_FRAG = `
uniform vec3 uColor;
uniform float uFrom;
varying vec2 vUv;
varying float vFace;
void main() {
  // (clamped: at an edge a sample can land just outside the triangle, and pow() below zero is NaN)
  float along = clamp(mix(vUv.y, 1.0 - vUv.y, uFrom), 0.0, 1.0);
  gl_FragColor = vec4(uColor * pow(along, 1.8) * pow(clamp(vFace, 0.0, 1.0), 1.6), 1.0);
  #include <colorspace_fragment>
}`;
const coneMat = (color, k, from = 0) =>
  new THREE.ShaderMaterial({
    vertexShader: CONE_VERT,
    fragmentShader: CONE_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(k) }, uFrom: { value: from } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

// Solar cells: dark blue blankets in a gold frame, the cells' grid in finer
// lines; `split` leaves a gold strip down the middle for the wing's mast.
function solarMat(w, h, { cols, rows, split = false }) {
  const map = paint(
    (g) => {
      g.fillStyle = '#a5803a';
      g.fillRect(0, 0, w, h);
      const blankets = split
        ? [
            [3, w / 2 - 3],
            [w / 2 + 3, w - 3],
          ]
        : [[3, w - 3]];
      for (const [x0, x1] of blankets) {
        const grad = g.createLinearGradient(x0, 0, x1, h);
        grad.addColorStop(0, '#2a4f9e');
        grad.addColorStop(0.5, '#173777');
        grad.addColorStop(1, '#22468f');
        g.fillStyle = grad;
        g.fillRect(x0, 3, x1 - x0, h - 6);
        g.fillStyle = 'rgba(110, 150, 220, 0.38)';
        const cw = (x1 - x0) / cols;
        const ch = (h - 6) / rows;
        for (let i = 1; i < cols; i++) g.fillRect(Math.round(x0 + i * cw), 3, 1, h - 6);
        for (let j = 1; j < rows; j++) g.fillRect(x0, Math.round(3 + j * ch), x1 - x0, j % 8 ? 1 : 2);
      }
    },
    w,
    h,
  );
  return new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.12, metalness: 0.35, roughness: 0.42 });
}

// a soft round dot, for sparks and motes
const dot = () =>
  paint(
    (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, w, h);
    },
    32,
    32,
  );

// Turn a group about y toward the camera (plus `off`), easing round so a
// passing camera doesn't jerk it: for the stations with a face to show.
function faceCamera(group) {
  const at = new THREE.Vector3();
  let last = null;
  return (t, camera, off = 0) => {
    if (!camera || !group.parent) return;
    camera.getWorldPosition(at);
    group.parent.worldToLocal(at);
    const want = Math.atan2(at.x - group.position.x, at.z - group.position.z) + off;
    const dt = last === null ? 0 : Math.min(0.1, Math.max(0, t - last));
    last = t;
    const d = Math.atan2(Math.sin(want - group.rotation.y), Math.cos(want - group.rotation.y));
    group.rotation.y += d * Math.min(1, dt * 1.2 || 1);
  };
}

export const STATIONS = {
  // Home: a wheel station, as in 2001. A lathed hub with a docking collar
  // ringed by lights, four spokes with pods, and the habitat ring: a plated
  // tube in twelve segments with rows of warm windows (some rooms dark). A
  // mast runs through the hub: solar panels and a beacon above, a radiator
  // module below. The wheel turns slowly, its face tipped toward you.
  home(p, { u, T }) {
    const s = u.size;
    const xyz = (...v) => v.map((x) => x * s);
    const prof = (pts) => pts.map(([x, y]) => [x * s, y * s]);
    p.body.visible = false;
    const st = new THREE.Group(); // turned so the wheel's face is always tipped toward you
    const tip = new THREE.Group();
    tip.rotation.set(0.45, 0, 0.12);
    const wheel = new THREE.Group();
    st.add(tip);
    tip.add(wheel);
    p.body.parent.add(st);
    const R = s * 0.86; // the ring
    const r = s * 0.1; // its tube
    const JOINTS = 12;
    const WHITE = '#ebe7de';
    const GREY = '#a2a8b2';
    const DARK = '#50565f';

    // The habitat ring's paint and its windows, on the same layout (u round
    // the ring, v round the tube from its outer edge): dark window bands round
    // the outside and along the top and bottom, a seam at each joint between
    // segments, and in the bands small warm windows (a few cool), a third of
    // the rooms dark.
    const BANDS = [
      [0, 0.075],
      [0.25, 0.035],
      [0.75, 0.03],
    ]; // [v, half its height]
    const rows = [0.035, 0.965, 0.25, 0.75];
    const yOf = (v, h) => (1 - v) * h;
    const skin = paint(
      (g, w, h) => {
        g.fillStyle = '#ece8df';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#3a3e46';
        for (const [v, half] of BANDS) {
          for (const vv of [v, v + 1]) g.fillRect(0, yOf(vv + half, h), w, half * 2 * h);
        }
        g.fillStyle = 'rgba(70, 74, 82, 0.55)';
        for (let i = 0; i < JOINTS; i++) g.fillRect((i / JOINTS) * w - 1, 0, 3, h);
        g.fillStyle = 'rgba(255, 255, 255, 0.35)';
        for (const [v, half] of BANDS) g.fillRect(0, yOf(v + half, h) - 1, w, 1);
      },
      512,
      64,
    );
    const rand = rng('home');
    const windows = paint(
      (g, w, h) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        for (const v of rows) {
          for (let x = 2; x < w; x += 5) {
            const at = ((x / w) * JOINTS) % 1;
            if (at < 0.07 || at > 0.93 || rand() < 0.34) continue;
            const c = rand();
            g.fillStyle = c < 0.08 ? '#bcdcff' : c < 0.6 ? '#ffc778' : '#ffdfae';
            g.fillRect(x, Math.round(yOf(v, h) - 1), 2, 2);
          }
        }
      },
      512,
      64,
    );
    const ringMat = hull(T, '#ffffff', { repeat: 1, which: 'plates', metal: 0.3 });
    Object.assign(ringMat, { map: skin, roughnessMap: null, roughness: 0.55 });
    ringMat.normalMap?.repeat.set(40, 2);
    Object.assign(ringMat, { emissiveMap: windows, emissiveIntensity: 2.6 });
    ringMat.emissive.set('#ffffff');
    // a torus lies in xy; turned so its tube's top (v = 0.25) is up, and flattened a little
    const ring = new THREE.Mesh(parts([[new THREE.TorusGeometry(R, r, 18, 128), [0, 0, 0], [-Math.PI / 2, 0, 0], [1, 1, 0.82]]]), ringMat);

    const spokes = [0, 1, 2, 3].map((i) => (i / 4) * TAU + Math.PI / 4);
    const POD = [
      [0, -0.075],
      [0.03, -0.072],
      [0.05, -0.052],
      [0.056, -0.02],
      [0.056, 0.02],
      [0.05, 0.052],
      [0.03, 0.072],
      [0, 0.075],
    ];
    const frame = build(
      [
        // the hub: a lathed drum with a docking collar on top
        P(
          lathe(
            prof([
              [0, -0.25],
              [0.06, -0.25],
              [0.08, -0.21],
              [0.14, -0.165],
              [0.195, -0.105],
              [0.215, -0.055],
              [0.215, 0.055],
              [0.195, 0.105],
              [0.14, 0.16],
              [0.09, 0.185],
              [0.09, 0.245],
              [0.11, 0.25],
              [0.11, 0.29],
              [0.075, 0.3],
              [0, 0.3],
            ]),
            40,
          ),
          WHITE,
        ),
        P(new THREE.TorusGeometry(s * 0.217, s * 0.009, 6, 48), GREY, [0, s * 0.07, 0], [Math.PI / 2, 0, 0]),
        P(new THREE.TorusGeometry(s * 0.217, s * 0.009, 6, 48), GREY, [0, -s * 0.07, 0], [Math.PI / 2, 0, 0]),
        P(new THREE.CylinderGeometry(s * 0.06, s * 0.06, s * 0.02, 20), DARK, xyz(0, 0.3, 0)), // the docking port's hatch
        // the joints between the ring's segments
        ...Array.from({ length: JOINTS }, (_, i) => {
          const a = (i / JOINTS) * TAU;
          return P(new THREE.TorusGeometry(r * 1.13, s * 0.015, 6, 20), GREY, [Math.cos(a) * R, 0, Math.sin(a) * R], [0, -a, 0], [1, 0.82, 1]);
        }),
        // the spokes, each with a conduit beside it, a pod part way out, a
        // collar where it leaves the hub and a block where it meets the ring
        ...spokes.flatMap((a) => {
          const c = Math.cos(a);
          const sn = Math.sin(a);
          const out = R - r * 0.75;
          return [
            rod(xyz(c * 0.2, 0, sn * 0.2), [c * out, 0, sn * out], s * 0.026, WHITE, 10),
            rod(xyz(c * 0.2, 0.045, sn * 0.2), [c * out, s * 0.045, sn * out], s * 0.008, GREY, 5),
            P(lathe(prof(POD), 14), WHITE, xyz(c * 0.5, 0, sn * 0.5), aim([c, 0, sn])),
            P(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.05, 12), GREY, xyz(c * 0.225, 0, sn * 0.225), aim([c, 0, sn])),
            P(new THREE.BoxGeometry(s * 0.1, s * 0.11, s * 0.09), GREY, [c * (R - r * 0.9), 0, sn * (R - r * 0.9)], [0, -a, 0]),
          ];
        }),
        // the mast through the hub: the solar panels' spar above, a
        // radiator module on a short mast below
        rod(xyz(0, 0.3, 0), xyz(0, 1.17, 0), s * 0.016, GREY, 8),
        P(new THREE.CylinderGeometry(s * 0.032, s * 0.032, s * 0.04, 12), DARK, xyz(0, 0.56, 0)),
        P(new THREE.CylinderGeometry(s * 0.032, s * 0.032, s * 0.05, 12), DARK, xyz(0, 0.94, 0)),
        P(new THREE.BoxGeometry(s * 0.96, s * 0.016, s * 0.016), GREY, xyz(0, 0.94, 0)),
        rod(xyz(0, -0.25, 0), xyz(0, -0.53, 0), s * 0.016, GREY, 8),
        P(
          lathe(
            prof([
              [0, -0.67],
              [0.04, -0.67],
              [0.065, -0.64],
              [0.065, -0.55],
              [0.045, -0.53],
              [0, -0.53],
            ]),
            16,
          ),
          GREY,
        ),
        ...[0, 1, 2].map((i) => {
          const a = (i / 3) * TAU;
          return P(new THREE.BoxGeometry(s * 0.005, s * 0.12, s * 0.11), WHITE, [Math.cos(a) * s * 0.12, -s * 0.6, Math.sin(a) * s * 0.12], [0, Math.PI / 2 - a, 0]);
        }),
      ],
      metal(T, { which: 'plates', repeat: 2, metal: 0.45, map: false, rough: 0.5 }),
    );

    // four solar panels on the spar
    const pv = new THREE.Mesh(
      parts([-1, 1].flatMap((side) => [0.205, 0.39].map((x) => [new THREE.BoxGeometry(s * 0.17, s * 0.006, s * 0.17), xyz(side * x, 0.94, 0)]))),
      solarMat(128, 128, { cols: 6, rows: 6 }),
    );

    const lights = beads([
      // the docking lights round the collar, chasing
      ...Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * TAU;
        return { at: xyz(Math.cos(a) * 0.113, 0.27, Math.sin(a) * 0.113), r: s * 0.011, color: i % 2 ? '#9dffcf' : '#fff2d6', k: 5, blink: [0.45, i / 10, 0.16] };
      }),
      // the hub's portholes
      ...Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * TAU;
        return { geo: new THREE.BoxGeometry(s * 0.022, s * 0.014, s * 0.004), at: xyz(Math.cos(a) * 0.216, 0.0, Math.sin(a) * 0.216), rot: [0, Math.PI / 2 - a, 0], color: i % 5 ? '#ffd9a0' : '#3a2a18', k: 3 };
      }),
      // red and green on the ring's rim, and the pods' windows
      ...spokes.map((a, i) => ({ at: [Math.cos(a) * (R + r * 0.97), 0, Math.sin(a) * (R + r * 0.97)], r: s * 0.014, color: i % 2 ? '#ff3b30' : '#3dff7a', k: 6, blink: [0.5, i * 0.25, 0.12] })),
      ...spokes.map((a) => ({ at: [Math.cos(a) * s * 0.5, s * 0.052, Math.sin(a) * s * 0.5], r: s * 0.012, color: '#ffd9a0', k: 3 })),
      // the beacon atop the mast, a strobe below, the panels' tips
      { at: xyz(0, 1.185, 0), r: s * 0.026, color: '#ff5a3c', k: 7, blink: [0.6, 0, 0.18] },
      { at: xyz(0, -0.69, 0), r: s * 0.016, color: '#ffffff', k: 7, blink: [0.8, 0.5, 0.06] },
      { at: xyz(-0.485, 0.94, 0), r: s * 0.01, color: '#ff3b30', k: 5, blink: [0.5, 0.6, 0.12] },
      { at: xyz(0.485, 0.94, 0), r: s * 0.01, color: '#3dff7a', k: 5, blink: [0.5, 0.6, 0.12] },
    ]);

    wheel.add(ring, frame, pv, lights);
    const face = faceCamera(st);
    p.tick.push((t, camera) => {
      face(t, camera, 0.5);
      wheel.rotation.y = t * 0.1;
      lights.material.uniforms.uTime.value = t;
    });
  },

  // Experience: an orbital complex like the ISS. A long lattice truss with
  // eight solar wings on rotating joints, white radiators, and six
  // pressurised modules (one per role, each with a band of its own colour):
  // a chain fore and aft under the truss, two off the forward node, a
  // capsule docked at the front, and a cupola's lit windows underneath.
  experience(p, { u, T }) {
    const s = u.size;
    const xyz = (...v) => v.map((x) => x * s);
    const prof = (pts) => pts.map(([x, y]) => [x * s, y * s]);
    p.body.visible = false;
    const tilt = new THREE.Group();
    tilt.rotation.set(0.12, 0, -0.08);
    const st = new THREE.Group(); // turned to keep a three-quarter view of it
    tilt.add(st);
    p.body.parent.add(tilt);
    const BANDS = ['#ff9900', '#e5484d', '#e8e8ec', '#3d8bfd', '#8b5cf6', '#22c3a6']; // a colour per role, newest first
    const WHITE = '#eef0f3';
    const NODE = '#d6d9df';
    const STEEL = '#b9bec7';
    const DARK = '#5a606b';
    const TY = 0.17; // the truss's height over the modules

    // a module: a lathed can with coned ends and docking rings
    const can = (R, L) =>
      lathe(
        prof([
          [0, -L / 2],
          [R * 0.48, -L / 2],
          [R * 0.48, -L / 2 + R * 0.14],
          [R * 0.8, -L / 2 + R * 0.24],
          [R, -L / 2 + R * 0.46],
          [R, L / 2 - R * 0.46],
          [R * 0.8, L / 2 - R * 0.24],
          [R * 0.48, L / 2 - R * 0.14],
          [R * 0.48, L / 2],
          [0, L / 2],
        ]),
        20,
      );
    // [centre, axis, radius, length]: the lab ahead of the main node, two
    // off the forward node, two aft
    const MODS = [
      [[0, 0, 0.29], [0, 0, 1], 0.088, 0.36],
      [[0.25, 0, 0.55], [1, 0, 0], 0.08, 0.3],
      [[-0.25, 0, 0.55], [-1, 0, 0], 0.086, 0.3],
      [[0, 0, -0.3], [0, 0, -1], 0.08, 0.4],
      [[0, 0, -0.66], [0, 0, -1], 0.075, 0.32],
    ];
    const modules = build(
      [
        ...MODS.flatMap(([c, ax, R, L], i) => {
          const at = (k) => xyz(c[0] + ax[0] * k, c[1] + ax[1] * k, c[2] + ax[2] * k);
          return [
            P(can(R, L), WHITE, xyz(...c), aim(ax)),
            P(new THREE.CylinderGeometry(s * R * 1.035, s * R * 1.035, s * L * 0.08, 20, 1, true), BANDS[i], at(L * 0.2), aim(ax)),
            P(new THREE.CylinderGeometry(s * R * 1.012, s * R * 1.012, s * L * 0.025, 20, 1, true), NODE, at(-L * 0.18), aim(ax)),
          ];
        }),
        // the nodes the modules join at
        P(can(0.086, 0.2), NODE, [0, 0, 0], aim([0, 0, 1])),
        P(can(0.086, 0.16), NODE, xyz(0, 0, 0.55), aim([0, 0, 1])),
        // the capsule docked at the front, on its adapter, with its band
        P(new THREE.CylinderGeometry(s * 0.05, s * 0.06, s * 0.04, 16), NODE, xyz(0, 0, 0.645), aim([0, 0, 1])),
        P(
          lathe(
            prof([
              [0, -0.06],
              [0.062, -0.06],
              [0.074, -0.046],
              [0.076, -0.034],
              [0.05, 0.05],
              [0.03, 0.075],
              [0, 0.08],
            ]),
            20,
          ),
          WHITE,
          xyz(0, 0, 0.725),
          aim([0, 0, 1]),
        ),
        P(new THREE.CylinderGeometry(s * 0.0765, s * 0.0745, s * 0.014, 20, 1, true), BANDS[5], xyz(0, 0, 0.69), aim([0, 0, 1])),
        // the cupola under the main node
        P(
          lathe(
            prof([
              [0, -0.155],
              [0.032, -0.152],
              [0.05, -0.13],
              [0.056, -0.1],
              [0.06, -0.075],
              [0, -0.075],
            ]),
            12,
          ),
          NODE,
        ),
        // Kibo's open deck, off the port module
        P(new THREE.BoxGeometry(s * 0.1, s * 0.025, s * 0.14), STEEL, xyz(-0.45, -0.03, 0.55)),
        // radiators standing up off the truss, three panels each on a spine
        ...[-1, 1].flatMap((side) => [
          rod(xyz(side * 0.36, TY + 0.03, 0), xyz(side * 0.36, 0.6, 0), s * 0.008, STEEL),
          ...[0.27, 0.385, 0.5].map((y) => P(new THREE.BoxGeometry(s * 0.15, s * 0.1, s * 0.008), '#f6f6f2', xyz(side * 0.36, y, 0), [0, side * 0.5, 0])),
        ]),
      ],
      metal(T, { which: 'plates', repeat: 1, metal: 0.15, map: false, rough: 0.6 }),
    );

    // the truss, its middle section, the rotating joints and the pylon down to the node
    const truss = build(
      [
        girder(xyz(-0.98, TY, 0), xyz(0.98, TY, 0), s * 0.075, s * 0.009, s * 0.1, STEEL),
        P(new THREE.BoxGeometry(s * 0.36, s * 0.1, s * 0.11), '#cfd3da', xyz(0, TY, 0)),
        P(new THREE.CylinderGeometry(s * 0.07, s * 0.07, s * 0.06, 20), DARK, xyz(-0.49, TY, 0), [0, 0, Math.PI / 2]),
        P(new THREE.CylinderGeometry(s * 0.07, s * 0.07, s * 0.06, 20), DARK, xyz(0.49, TY, 0), [0, 0, Math.PI / 2]),
        P(new THREE.BoxGeometry(s * 0.05, s * 0.06, s * 0.05), STEEL, xyz(0, 0.105, 0)),
      ],
      metal(T, { which: 'plates', repeat: 1, metal: 0.65, rough: 0.5 }),
    );

    // Eight solar wings, a pair on each side of each of four roots, all
    // turning together about the truss (the sun-tracking joints). Each blade
    // has a mast down its middle and a box at its root, mapped onto the gold
    // of the cells' frame so they're the same draw.
    const wings = new THREE.Group();
    wings.position.y = s * TY;
    const GOLD = [0.5, 0.5];
    wings.add(
      new THREE.Mesh(
        parts(
          [-0.85, -0.63, 0.63, 0.85].flatMap((x) =>
            [-1, 1].flatMap((side) => [
              [new THREE.BoxGeometry(s * 0.18, s * 0.005, s * 0.66), xyz(x, 0, side * 0.41)],
              [uvAt(new THREE.BoxGeometry(s * 0.012, s * 0.012, s * 0.68), ...GOLD), xyz(x, 0.007, side * 0.41)],
              [uvAt(new THREE.BoxGeometry(s * 0.19, s * 0.01, s * 0.014), ...GOLD), xyz(x, 0, side * 0.745)],
              [uvAt(new THREE.BoxGeometry(s * 0.06, s * 0.04, s * 0.05), ...GOLD), xyz(x, 0, side * 0.065)],
            ]),
          ),
        ),
        solarMat(64, 256, { cols: 4, rows: 40, split: true }),
      ),
    );

    const rand = rng('experience');
    const lights = beads([
      // red to port, green to starboard, a white strobe on the capsule's nose
      { at: xyz(-0.99, TY, 0), r: s * 0.016, color: '#ff3b30', k: 6, blink: [0.5, 0, 0.14] },
      { at: xyz(0.99, TY, 0), r: s * 0.016, color: '#3dff7a', k: 6, blink: [0.5, 0, 0.14] },
      { at: xyz(0, 0, 0.81), r: s * 0.012, color: '#ffffff', k: 7, blink: [0.7, 0.4, 0.05] },
      { at: xyz(0, 0, -0.83), r: s * 0.012, color: '#ffb347', k: 5, blink: [0.4, 0.7, 0.12] },
      // the cupola's windows, warm, and a few on every module
      ...Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * TAU;
        return { geo: new THREE.BoxGeometry(s * 0.03, s * 0.022, s * 0.004), at: xyz(Math.cos(a) * 0.057, -0.105, Math.sin(a) * 0.057), rot: [0, Math.PI / 2 - a, 0], color: '#ffd9a0', k: 3.2 };
      }),
      { at: xyz(0, -0.155, 0), geo: new THREE.CylinderGeometry(s * 0.024, s * 0.024, s * 0.004, 12), color: '#ffe2b0', k: 3 },
      ...MODS.flatMap(([c, ax, R, L]) =>
        [-0.28, -0.08, 0.32].map((k) => ({
          at: xyz(c[0] + ax[0] * L * k, c[1] + R * 0.99, c[2] + ax[2] * L * k),
          geo: new THREE.CylinderGeometry(s * 0.011, s * 0.011, s * 0.004, 8),
          color: rand() < 0.2 ? '#2a2016' : '#ffd9a0',
          k: 3,
        })),
      ),
      // status lights along the truss's middle section
      ...[-0.12, -0.04, 0.04, 0.12].map((x, i) => ({ at: xyz(x, TY + 0.051, 0.03), r: s * 0.007, color: i % 2 ? '#7fd0ff' : '#ffffff', k: 4, blink: [0.3, i * 0.2, 0.5] })),
    ]);

    st.add(modules, truss, wings, lights);
    // the station keeps a three-quarter view (swaying slowly), and the
    // wings turn on their joints to show you their cells
    const face = faceCamera(st);
    const cam = new THREE.Vector3();
    let last = null;
    p.tick.push((t, camera) => {
      face(t, camera, 0.7 + Math.sin(t * 0.05) * 0.3);
      if (camera) {
        st.worldToLocal(camera.getWorldPosition(cam));
        const want = Math.atan2(cam.z, cam.y - s * TY) - 0.3;
        const dt = last === null ? 0 : Math.min(0.1, Math.max(0, t - last));
        wings.rotation.x += (want - wings.rotation.x) * Math.min(1, dt * 1.5 || 1);
        last = t;
      }
      lights.material.uniforms.uTime.value = t;
    });
    // the six companies, round it
    tileRing(
      p,
      roles.map((r) => [r.short ?? r.company, r.company === (r.short ?? r.company) ? null : r.company]),
      u.swatch,
      { radius: s * 1.65, tilt: 0.3, speed: 0.1 },
    );
  },

  // Projects: a shipyard. A spacedock of octagonal frames and lattice
  // girders round a ship that's half built: plated at the front (a lathed
  // hull with its cockpit glass), only its ribs at the back, glowing in the
  // station's colour round its core. Two gantry cranes ride the top rails
  // (one lowering a hull plate), floodlights throw cones of light on the
  // work, a welder's sparks fly where the plating stops, the control
  // block's windows are lit and strip lights ring the dock's two mouths. It
  // keeps the ship three-quarters on to you.
  projects(p, { u, T }) {
    const s = u.size;
    const xyz = (...v) => v.map((x) => x * s);
    const prof = (pts) => pts.map(([x, y]) => [x * s, y * s]);
    p.body.visible = false;
    const tilt = new THREE.Group();
    tilt.rotation.set(0.1, 0, 0.06);
    const st = new THREE.Group();
    tilt.add(st);
    p.body.parent.add(tilt);
    const STEEL = '#c3cad6';
    const DARK = '#5b6270';
    const HULL = '#eef2f7';
    const RIB = (z) => 0.22 - 0.06 * (z / 0.7) ** 2; // the ship's radius along its unbuilt back
    const EX = [1.15, 0.82]; // the hull is wider than it's tall

    // The dock: four octagonal frames, lattice girders along their top and
    // bottom corners (the top two are the cranes' rails), cradle struts and side clamps holding the ship, the control
    // block over the front frame, the floodlights' housings, and the welder.
    const DR = 0.52; // the frames' radius, to their corners
    const corner = (k, z) => xyz(Math.cos(((k + 0.5) * TAU) / 8) * DR, Math.sin(((k + 0.5) * TAU) / 8) * DR, z);
    const FRAMES = [-0.72, -0.24, 0.24, 0.72];
    const under = { '-0.72': -0.08, '-0.24': -0.172, 0.24: -0.18, 0.72: -0.15 }; // the hull's underside at each frame
    const LAMPS = [corner(1, -0.72), corner(3, 0.72), corner(5, -0.24), corner(7, 0.72)].map((a) => a.map((x) => x / s));
    const TORCH = [0.222, 0.11, 0.005];
    const TOP = DR * Math.sin((1.5 * TAU) / 8); // the rails' height
    const RAIL = DR * Math.cos((1.5 * TAU) / 8); // and their half spacing
    const dock = build(
      [
        ...FRAMES.flatMap((z) => Array.from({ length: 8 }, (_, k) => bar(corner(k, z), corner(k + 1, z), s * 0.032, STEEL, s * 0.06))),
        ...[1, 2, 5, 6].map((k) => girder(corner(k, -0.95), corner(k, 0.95), s * 0.06, s * 0.01, s * 0.16, STEEL)),
        // cradle struts under the hull at each frame, clamps at its sides
        ...FRAMES.flatMap((z) => [
          ...[-1, 1].flatMap((x) => [
            bar(xyz(x * 0.15, -0.47, z), xyz(x * 0.07, under[z] - 0.01, z), s * 0.022, DARK),
            P(new THREE.BoxGeometry(s * 0.07, s * 0.014, s * 0.05), DARK, xyz(x * 0.06, under[z] - 0.012, z)),
          ]),
        ]),
        ...[-0.24, 0.24].flatMap((z) => [-1, 1].flatMap((x) => [bar(xyz(x * 0.47, 0, z), xyz(x * 0.275, 0, z), s * 0.028, DARK), P(new THREE.BoxGeometry(s * 0.014, s * 0.07, s * 0.05), DARK, xyz(x * 0.27, 0, z))])),
        P(new THREE.BoxGeometry(s * 0.3, s * 0.09, s * 0.13), '#dfe4ea', xyz(0, TOP + 0.075, -0.72)),
        P(new THREE.BoxGeometry(s * 0.07, s * 0.035, s * 0.04), DARK, xyz(0.08, TOP + 0.135, -0.72)),
        ...LAMPS.map((at) => P(new THREE.BoxGeometry(s * 0.055, s * 0.055, s * 0.06), DARK, xyz(...at))),
        // the ship's stringers over its ribs
        ...Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * TAU;
          return bar(xyz(Math.cos(a) * 0.22 * EX[0], Math.sin(a) * 0.22 * EX[1], 0), xyz(Math.cos(a) * RIB(0.7) * EX[0], Math.sin(a) * RIB(0.7) * EX[1], 0.7), s * 0.012, DARK);
        }),
        // the welder: a little drone on an arm, at the plating's edge
        P(new THREE.BoxGeometry(s * 0.05, s * 0.035, s * 0.05), '#e8b23a', xyz(0.33, 0.2, 0.04)),
        bar(xyz(0.31, 0.19, 0.035), xyz(TORCH[0] + 0.01, TORCH[1] + 0.008, TORCH[2]), s * 0.008, DARK),
      ],
      metal(T, { which: 'plates', repeat: 1, metal: 0.6, rough: 0.55 }),
    );

    // the ship: the plated front, its nose to -z, a spine along its back and
    // chines down its sides with a stripe in the station's colour
    const ship = build(
      [
        P(
          lathe(
            prof([
              [0, 0.82],
              [0.025, 0.805],
              [0.06, 0.76],
              [0.1, 0.68],
              [0.14, 0.57],
              [0.175, 0.44],
              [0.2, 0.3],
              [0.215, 0.15],
              [0.22, 0.02],
              [0.215, 0.0],
              [0.19, 0.0],
              [0, 0.025],
            ]),
            36,
          ),
          HULL,
          [0, 0, 0],
          [-Math.PI / 2, 0, 0],
          [EX[0], 1, EX[1]],
        ),
        P(new THREE.BoxGeometry(s * 0.05, s * 0.035, s * 0.46), '#c9d0da', xyz(0, 0.175, -0.22)),
        ...[-1, 1].flatMap((x) => [P(new THREE.BoxGeometry(s * 0.05, s * 0.016, s * 0.58), '#c9d0da', xyz(x * 0.236, -0.01, -0.27)), P(new THREE.BoxGeometry(s * 0.052, s * 0.005, s * 0.54), u.swatch, xyz(x * 0.236, -0.001, -0.27))]),
        P(new THREE.TorusGeometry(s * 0.22, s * 0.012, 6, 40), '#9aa3b0', [0, 0, 0], [0, 0, 0], [EX[0], EX[1], 1]),
      ],
      metal(T, { which: 'plates', repeat: 3, metal: 0.15, map: false, rough: 0.55 }),
    );
    const canopy = new THREE.Mesh(
      parts([[new THREE.SphereGeometry(s * 0.075, 20, 12), xyz(0, 0.128, -0.5), [0, 0, 0], [0.9, 0.55, 2.0]]]),
      new THREE.MeshStandardMaterial({ color: '#0a1622', metalness: 0.9, roughness: 0.08, emissive: '#1d6f8f', emissiveIntensity: 0.35 }),
    );
    // the unbuilt back: its ribs glowing, a dimmer core down the middle, the engine ring
    const ribs = build(
      [
        ...[0.1, 0.22, 0.34, 0.46, 0.58, 0.7].map((z) => P(new THREE.TorusGeometry(s * RIB(z), s * 0.009, 6, 40), u.swatch, xyz(0, 0, z), [0, 0, 0], [EX[0], EX[1], 1])),
        P(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.62, 12), '#2b6f8f', xyz(0, 0, 0.4), [Math.PI / 2, 0, 0]),
        P(new THREE.TorusGeometry(s * 0.12, s * 0.014, 8, 32), u.swatch, xyz(0, 0, 0.76)),
      ],
      new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    );
    ribs.material.color.setScalar(2.4);

    // floodlights: a cone from each lamp toward the work
    const seam = new THREE.Vector3(0, 0, 0.02);
    const cones = new THREE.Mesh(
      parts(
        LAMPS.map((at) => {
          const from = v3(xyz(...at));
          const dir = seam.clone().multiplyScalar(s).sub(from);
          const len = dir.length() * 0.85;
          const g = new THREE.ConeGeometry(len * 0.26, len, 20, 1, true).translate(0, -len / 2, 0);
          return [g, from.toArray(), aim(dir, new THREE.Vector3(0, -1, 0))];
        }),
      ),
      coneMat('#fff1d6', 0.42),
    );

    // the cranes: two gantries on the top rails, safety yellow; the first
    // holding a plate over the seam, the second an arm over the ribs
    const YELLOW = '#f0b23a';
    const gantry = (z, x, extra) => [
      P(new THREE.BoxGeometry(s * (RAIL * 2 + 0.1), s * 0.03, s * 0.026), YELLOW, xyz(0, TOP + 0.06, z - 0.028)),
      P(new THREE.BoxGeometry(s * (RAIL * 2 + 0.1), s * 0.03, s * 0.026), YELLOW, xyz(0, TOP + 0.06, z + 0.028)),
      ...[-1, 1].map((k) => P(new THREE.BoxGeometry(s * 0.07, s * 0.07, s * 0.15), YELLOW, xyz(k * RAIL, TOP + 0.04, z))),
      P(new THREE.BoxGeometry(s * 0.08, s * 0.045, s * 0.09), DARK, xyz(x, TOP + 0.035, z)),
      ...extra,
    ];
    const crane = build(
      [
        ...gantry(0.03, 0.08, [
          rod(xyz(0.06, TOP + 0.02, 0.03), xyz(0.06, 0.3, 0.03), s * 0.003, DARK, 4),
          rod(xyz(0.1, TOP + 0.02, 0.03), xyz(0.1, 0.3, 0.03), s * 0.003, DARK, 4),
          P(new THREE.BoxGeometry(s * 0.12, s * 0.012, s * 0.03), DARK, xyz(0.08, 0.295, 0.03)),
          P(new THREE.BoxGeometry(s * 0.17, s * 0.008, s * 0.13), '#d8dee6', xyz(0.08, 0.28, 0.03), [0, 0, -0.3]),
        ]),
        ...gantry(0.5, -0.06, [bar(xyz(-0.06, TOP + 0.02, 0.5), xyz(-0.06, 0.3, 0.5), s * 0.02, YELLOW), bar(xyz(-0.06, 0.3, 0.5), xyz(-0.13, 0.24, 0.47), s * 0.016, YELLOW)]),
      ],
      metal(T, { which: 'hull', repeat: 1, metal: 0.3, map: false, rough: 0.55 }),
    );

    const lights = beads([
      // the floodlights' lamps
      ...LAMPS.map((at) => ({ at: xyz(...at), r: s * 0.022, color: '#fff3dc', k: 6 })),
      // the control block's windows, a strip on each side, a room or two dark
      ...[-1, 1].flatMap((side) =>
        Array.from({ length: 6 }, (_, i) => ({ geo: new THREE.BoxGeometry(s * 0.026, s * 0.018, s * 0.004), at: xyz(-0.115 + i * 0.046, TOP + 0.08, -0.72 + side * 0.066), color: i === 2 && side > 0 ? '#2a2016' : '#ffd9a0', k: 2.4 })),
      ),
      // a beacon on the block, marker lights chasing along the bottom girders toward the ship
      { at: xyz(0.08, TOP + 0.16, -0.72), r: s * 0.014, color: '#ff4a3a', k: 6, blink: [0.6, 0, 0.18] },
      ...[5, 6].flatMap((k) => Array.from({ length: 9 }, (_, i) => ({ at: corner(k, -0.88 + i * 0.22).map((v, j) => (j === 1 ? v + s * 0.04 : v)), r: s * 0.009, color: '#ffb347', k: 5, blink: [0.5, -i * 0.07, 0.18] }))),
      // the rails' ends, red to port and green to starboard
      ...[1, 2].flatMap((k) => [-0.96, 0.96].map((z) => ({ at: corner(k, z), r: s * 0.012, color: k === 2 ? '#ff3b30' : '#3dff7a', k: 5, blink: [0.4, z > 0 ? 0.5 : 0, 0.14] }))),
      // strip lights round the inside of the end frames, the dock's mouths
      ...[-0.72, 0.72].flatMap((z) =>
        Array.from({ length: 8 }, (_, k) => {
          const [geo, at, rot] = bar(corner(k, z).map((v, j) => (j < 2 ? v * 0.93 : v)), corner(k + 1, z).map((v, j) => (j < 2 ? v * 0.93 : v)), s * 0.006);
          return { geo, at, rot, color: '#d8f3ff', k: 2.2 };
        }),
      ),
    ]);
    const crLights = beads([
      { at: xyz(-RAIL, TOP + 0.085, 0.03), r: s * 0.01, color: '#ffb347', k: 5, blink: [0.8, 0, 0.3] },
      { at: xyz(RAIL, TOP + 0.085, 0.5), r: s * 0.01, color: '#ffb347', k: 5, blink: [0.8, 0.5, 0.3] },
    ]);

    // the welder at work: a flickering torch and a spray of sparks
    const torch = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.016, 1), glowMat(new THREE.Color(5, 6, 9)));
    torch.position.set(...xyz(...TORCH));
    const N = 40;
    const sparkPos = new Float32Array(N * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: new THREE.Color(5, 3, 1.3), map: dot(), size: s * 0.03, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sparks.frustumCulled = false;
    const rand = rng('sparks');
    const spark = Array.from({ length: N }, () => ({ age: rand(), life: 0.3 + rand() * 0.5, v: new THREE.Vector3() }));
    const out = new THREE.Vector3(0.6, 0.75, 0.1).normalize(); // away from the hull, at the torch

    st.add(dock, ship, canopy, ribs, cones, crane, lights, crLights, torch, sparks);
    const face = faceCamera(st);
    let last = 0;
    p.tick.push((t, camera) => {
      const dt = Math.min(0.1, Math.max(0, t - last));
      last = t;
      face(t, camera, -2.3 + Math.sin(t * 0.06) * 0.3); // the nose toward you, three-quarters on
      crane.position.z = crLights.position.z = Math.sin(t * 0.15) * s * 0.05;
      lights.material.uniforms.uTime.value = t;
      crLights.material.uniforms.uTime.value = t;
      const on = Math.sin(t * 19) + Math.sin(t * 6.1) > 0.1;
      torch.visible = on;
      torch.scale.setScalar(0.8 + Math.random() * 0.5);
      spark.forEach((sp, i) => {
        sp.age += dt;
        if (sp.age > sp.life && on) {
          sp.age = 0;
          sp.life = 0.25 + rand() * 0.45;
          sp.v.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.4).add(out).normalize().multiplyScalar(s * (0.2 + rand() * 0.35));
        }
        const live = sp.age < sp.life;
        const a = Math.min(sp.age, sp.life);
        sparkPos.set(live ? [torch.position.x + sp.v.x * a, torch.position.y + sp.v.y * a - a * a * s * 0.25, torch.position.z + sp.v.z * a] : [0, -1e3, 0], i * 3);
      });
      sparkGeo.attributes.position.needsUpdate = true;
    });
    // what's been built here
    tileRing(
      p,
      featuredProjects.slice(0, 4).map((pr) => [pr.title, pr.subtitle]),
      u.swatch,
      { radius: s * 1.75, tilt: 0.22, speed: 0.09 },
    );
  },

  // The Résumé: a holographic archive. A sleek projector, a lathed dais with
  // a lit rim, three emitters and a lens, throws the page up as a hologram
  // (scanlines, a sweep, a flicker, a lit edge, slipping now and then)
  // inside slowly turning rings, with motes of data rising through it. The
  // page turns to face you.
  resume(p, { u, T }) {
    const s = u.size;
    const xyz = (...v) => v.map((x) => x * s);
    const prof = (pts) => pts.map(([x, y]) => [x * s, y * s]);
    p.body.visible = false;
    const st = new THREE.Group();
    p.body.parent.add(st);
    const GLOW = u.palette.glow;
    const Y0 = -0.78; // the dais
    const PAGE_Y = 0.07;

    // the page, as light: the name, a rule and the sections' lines on black
    // (black adds nothing, so only the writing shows), with corner marks
    const page = paint(
      (g, w, h) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(199, 184, 255, 0.10)';
        g.fillRect(8, 8, w - 16, h - 16);
        g.strokeStyle = 'rgba(220, 210, 255, 0.9)';
        g.lineWidth = 2;
        for (const [x, y, dx, dy] of [
          [8, 8, 1, 1],
          [w - 8, 8, -1, 1],
          [8, h - 8, 1, -1],
          [w - 8, h - 8, -1, -1],
        ]) {
          g.beginPath();
          g.moveTo(x, y + dy * 18);
          g.lineTo(x, y);
          g.lineTo(x + dx * 18, y);
          g.stroke();
        }
        g.fillStyle = '#ffffff';
        g.font = '700 26px ui-sans-serif, system-ui, sans-serif';
        g.fillText('Tilak Patel', 24, 46);
        g.fillStyle = 'rgba(199, 184, 255, 0.95)';
        g.fillRect(24, 60, w - 48, 3);
        const rand = rng('resume');
        let y = 92;
        for (let b = 0; b < 5; b++) {
          g.fillStyle = 'rgba(235, 228, 255, 0.95)';
          g.fillRect(24, y, 90 + rand() * 60, 9);
          y += 20;
          for (let l = 0; l < 3 + Math.floor(rand() * 2); l++) {
            g.fillStyle = 'rgba(199, 184, 255, 0.55)';
            g.fillRect(34, y, (w - 80) * (0.55 + rand() * 0.45), 5);
            y += 12;
          }
          y += 10;
        }
      },
      256,
      340,
    );
    const holoMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: page }, uTint: { value: new THREE.Color(GLOW) }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uTint;
        uniform float uTime;
        varying vec2 vUv;
        float hash(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          vec2 uv = vUv;
          // now and then a few lines slip sideways, as a weak signal does
          float tick = floor(uTime * 9.0);
          uv.x += step(0.96, hash(tick)) * (hash(floor(uv.y * 30.0) + tick) - 0.5) * 0.03;
          vec3 ink = texture2D(uMap, uv).rgb;
          float scan = 0.78 + 0.22 * sin(uv.y * 210.0 - uTime * 3.0);
          float off = (fract(uTime * 0.12) * 1.5 - 0.25 - uv.y) * 12.0;
          float sweep = exp(-off * off);
          float flicker = 0.93 + 0.07 * sin(uTime * 31.0) * sin(uTime * 7.3);
          vec2 e = min(uv, 1.0 - uv);
          float rim = smoothstep(0.022, 0.0, min(e.x, e.y * 0.75));
          vec3 c = ink * 1.8 * scan + uTint * (0.05 + rim * 1.3 + sweep * 0.35);
          gl_FragColor = vec4(c * flicker, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const holo = new THREE.Group();
    holo.position.y = s * PAGE_Y;
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.86, s * 1.14), holoMat);
    sheet.renderOrder = 3;
    holo.add(sheet);

    // the dais: a lathed disc, tapering below to a keel, a dark inlay on
    // top, and three emitters leaning in toward the page
    const EMIT = [0, 1, 2].map((i) => (i / 3) * TAU + Math.PI / 2);
    const dais = build(
      [
        P(
          lathe(
            prof([
              [0, Y0 - 0.17],
              [0.04, Y0 - 0.17],
              [0.09, Y0 - 0.12],
              [0.3, Y0 - 0.07],
              [0.55, Y0 - 0.04],
              [0.62, Y0 - 0.012],
              [0.63, Y0 + 0.015],
              [0.605, Y0 + 0.045],
              [0.58, Y0 + 0.05],
              [0.24, Y0 + 0.05],
              [0.2, Y0 + 0.075],
              [0.165, Y0 + 0.08],
              [0, Y0 + 0.08],
            ]),
            56,
          ),
          '#d9d6e4',
        ),
        P(
          lathe(
            prof([
              [0.57, Y0 + 0.052],
              [0.25, Y0 + 0.052],
            ]),
            56,
          ),
          '#262335',
        ),
        ...EMIT.flatMap((a) => {
          const c = Math.cos(a);
          const sn = Math.sin(a);
          return [
            rod(xyz(c * 0.5, Y0 + 0.04, sn * 0.5), xyz(c * 0.43, Y0 + 0.2, sn * 0.43), s * 0.018, '#bdb8cc', 8),
            P(new THREE.CylinderGeometry(s * 0.032, s * 0.026, s * 0.05, 12), '#3a3650', xyz(c * 0.425, Y0 + 0.22, sn * 0.425), aim([-c * 0.6, 1, -sn * 0.6])),
          ];
        }),
      ],
      metal(T, { which: 'hull', repeat: 1, metal: 0.7, rough: 0.42 }),
    );

    // its lights: the rim, the lens, the emitters' tips, a ring of points chasing round the inlay
    const lights = beads([
      { geo: new THREE.TorusGeometry(s * 0.629, s * 0.006, 6, 96), at: xyz(0, Y0 + 0.012, 0), rot: [Math.PI / 2, 0, 0], color: GLOW, k: 3.2 },
      { geo: new THREE.CylinderGeometry(s * 0.14, s * 0.14, s * 0.006, 32), at: xyz(0, Y0 + 0.081, 0), color: GLOW, k: 2.4 },
      ...EMIT.map((a) => ({ at: xyz(Math.cos(a) * 0.415, Y0 + 0.245, Math.sin(a) * 0.415), r: s * 0.02, color: GLOW, k: 5 })),
      ...Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * TAU;
        return { at: xyz(Math.cos(a) * 0.41, Y0 + 0.054, Math.sin(a) * 0.41), r: s * 0.007, color: '#ffffff', k: 4, blink: [0.35, i / 24, 0.2] };
      }),
      { at: xyz(0, Y0 - 0.17, 0), r: s * 0.014, color: GLOW, k: 5, blink: [0.4, 0, 1.2] },
    ]);

    // the projection: a faint cone of light from the lens up round the page
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.56, s * 0.13, s * 1.3, 32, 1, true), coneMat(GLOW, 0.22, 1));
    beam.position.y = s * (Y0 + 0.08 + 0.65);

    // rings round the page, each a few long arcs, turning slowly on their
    // own tilts: two crossing about its middle, a small one low over the dais
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(GLOW).multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const rings = [
      [0.76, 3, 0.86, [Math.PI / 2 - 0.32, 0, 0.12], PAGE_Y, 0.1],
      [0.84, 4, 0.8, [Math.PI / 2 + 0.38, 0, -0.18], PAGE_Y + 0.05, -0.07],
      [0.46, 6, 0.6, [Math.PI / 2, 0, 0], Y0 + 0.2, 0.22],
    ].map(([R, n, fill, tilt, y, speed]) => {
      const holder = new THREE.Group();
      holder.rotation.set(...tilt);
      holder.position.y = s * y;
      const mesh = new THREE.Mesh(parts(Array.from({ length: n }, (_, i) => [new THREE.TorusGeometry(s * R, s * 0.004, 4, 40, (TAU / n) * fill), [0, 0, 0], [0, 0, (i / n) * TAU]])), ringMat);
      holder.add(mesh);
      st.add(holder);
      return [mesh, speed];
    });

    // motes of data rising from the dais through the page
    const M = 48;
    const rand = rng('motes');
    const motes = Array.from({ length: M }, () => ({ a: rand() * TAU, r: 0.08 + rand() * 0.5, y: rand(), v: 0.08 + rand() * 0.12 }));
    const motePos = new Float32Array(M * 3);
    const moteCol = new Float32Array(M * 3);
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3).setUsage(THREE.DynamicDrawUsage));
    moteGeo.setAttribute('color', new THREE.BufferAttribute(moteCol, 3).setUsage(THREE.DynamicDrawUsage));
    const glow = new THREE.Color(GLOW).multiplyScalar(3);
    const dots = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: dot(), size: s * 0.035, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    dots.frustumCulled = false;

    st.add(dais, lights, beam, holo, dots);
    const face = faceCamera(holo);
    p.tick.push((t, camera) => {
      face(t, camera, Math.sin(t * 0.3) * 0.3);
      holo.position.y = s * (PAGE_Y + Math.sin(t * 0.9) * 0.02);
      holoMat.uniforms.uTime.value = t;
      lights.material.uniforms.uTime.value = t;
      for (const [mesh, speed] of rings) mesh.rotation.z = t * speed;
      motes.forEach((m, i) => {
        const y = (m.y + t * m.v) % 1;
        const a = m.a + t * 0.15;
        motePos.set(xyz(Math.cos(a) * m.r, Y0 + 0.08 + y * 1.55, Math.sin(a) * m.r), i * 3);
        const k = Math.min(1, y * 6) * (1 - y) ** 1.5;
        moteCol.set([glow.r * k, glow.g * k, glow.b * k], i * 3);
      });
      moteGeo.attributes.position.needsUpdate = true;
      moteGeo.attributes.color.needsUpdate = true;
    });
  },

  // Contact: a comms array. A big lathed dish (a white face, plated ribbed
  // back, a rim) with its feed horn on a three-strut tripod, on an alt-az
  // mount: a turntable and a yoke on a small station module with lit
  // windows, two smaller dishes and two antenna masts round it, a beacon,
  // and pulses leaving the feed. The dish slews slowly, keeping its face
  // turned partly toward you.
  contact(p, { u, T }) {
    const s = u.size;
    const xyz = (...v) => v.map((x) => x * s);
    const prof = (pts) => pts.map(([x, y]) => [x * s, y * s]);
    p.body.visible = false;
    const st = new THREE.Group();
    st.rotation.set(0.1, 0, -0.05);
    p.body.parent.add(st);
    const GLOW = u.palette.glow;
    const WHITE = '#e6e9ee';
    const STEEL = '#aab0ba';
    const DARK = '#4f5560';
    const Y0 = -0.62; // the module's middle
    const D = 0.62; // the dish's radius
    const F = 0.42; // its focal length
    const V = 0.08; // its vertex, ahead of the elevation axle
    const depth = (r) => V + (r * r) / (4 * F);

    // a small dish, as one closed shell: its back out to the rim, then its face back in
    const dishShell = (R, f, t, n = 8) => {
      const back = Array.from({ length: n + 1 }, (_, i) => {
        const r = (i / n) * R;
        return [r, (r * r) / (4 * f) - t];
      });
      const front = Array.from({ length: n + 1 }, (_, i) => {
        const r = ((n - i) / n) * R;
        return [r, (r * r) / (4 * f)];
      });
      return lathe(prof([...back, ...front]), 20);
    };
    const SMALL = [0.5, 2.6].map((a) => [a, [Math.cos(a), 0.8, Math.sin(a)]]);
    const MASTS = [
      [4.2, 0.42, 0.55],
      [5.3, 0.36, 0.45],
    ]; // [angle round the module, elevation, length]
    const mastEnd = ([a, el, len]) => xyz(Math.cos(a) * (0.3 + Math.cos(el) * len), Y0 + Math.sin(el) * len, Math.sin(a) * (0.3 + Math.cos(el) * len));
    const base = build(
      [
        // the module: a lathed drum with a docking port below
        P(
          lathe(
            prof([
              [0, Y0 - 0.22],
              [0.075, Y0 - 0.22],
              [0.085, Y0 - 0.2],
              [0.085, Y0 - 0.16],
              [0.14, Y0 - 0.15],
              [0.26, Y0 - 0.12],
              [0.3, Y0 - 0.08],
              [0.3, Y0 + 0.06],
              [0.26, Y0 + 0.1],
              [0.16, Y0 + 0.12],
              [0, Y0 + 0.12],
            ]),
            32,
          ),
          WHITE,
        ),
        P(new THREE.TorusGeometry(s * 0.302, s * 0.008, 6, 48), STEEL, xyz(0, Y0 - 0.045, 0), [Math.PI / 2, 0, 0]),
        P(new THREE.TorusGeometry(s * 0.302, s * 0.008, 6, 48), STEEL, xyz(0, Y0 + 0.045, 0), [Math.PI / 2, 0, 0]),
        // radiator fins
        ...[1.6, 3.6].map((a) => P(new THREE.BoxGeometry(s * 0.005, s * 0.11, s * 0.24), '#f2f2ee', xyz(Math.cos(a) * 0.42, Y0, Math.sin(a) * 0.42), [0, Math.PI / 2 - a, 0])),
        // the small dishes on their booms
        ...SMALL.flatMap(([a, dir]) => [
          bar(xyz(Math.cos(a) * 0.29, Y0 - 0.02, Math.sin(a) * 0.29), xyz(Math.cos(a) * 0.42, Y0 + 0.02, Math.sin(a) * 0.42), s * 0.022, STEEL),
          P(dishShell(0.11, 0.09, 0.008), WHITE, xyz(Math.cos(a) * 0.45, Y0 + 0.04, Math.sin(a) * 0.45), aim(dir)),
          rod(xyz(Math.cos(a) * 0.45, Y0 + 0.04, Math.sin(a) * 0.45), [Math.cos(a) * s * 0.45 + dir[0] * s * 0.07, s * (Y0 + 0.04) + dir[1] * s * 0.07, Math.sin(a) * s * 0.45 + dir[2] * s * 0.07], s * 0.004, DARK, 4),
        ]),
        // the antenna masts, leaning out, with their elements
        ...MASTS.flatMap((m) => {
          const [a, rise] = m;
          const from = xyz(Math.cos(a) * 0.3, Y0, Math.sin(a) * 0.3);
          const to = mastEnd(m);
          const tang = [-Math.sin(a), 0, Math.cos(a)];
          return [
            rod(from, to, s * 0.007, STEEL),
            ...[0.35, 0.55, 0.75, 0.92].map((k) => {
              const c = [0, 1, 2].map((j) => from[j] + (to[j] - from[j]) * k);
              const w = s * 0.07 * (1.1 - k * 0.5);
              return rod([c[0] - tang[0] * w, c[1], c[2] - tang[2] * w], [c[0] + tang[0] * w, c[1], c[2] + tang[2] * w], s * 0.003, STEEL, 4);
            }),
            P(new THREE.BoxGeometry(s * 0.04, s * 0.03, s * 0.04), DARK, from, [0, -a, rise]),
          ];
        }),
      ],
      metal(T, { which: 'plates', repeat: 2, metal: 0.2, map: false, rough: 0.6 }),
    );

    // the alt-az mount: a turntable on the module and a yoke holding the axle
    const az = new THREE.Group();
    az.position.y = s * (Y0 + 0.12);
    const EL_Y = 0.5; // the elevation axle, over the turntable
    const mount = build(
      [
        P(new THREE.CylinderGeometry(s * 0.15, s * 0.17, s * 0.05, 28), DARK, xyz(0, 0.025, 0)),
        P(new THREE.BoxGeometry(s * 0.46, s * 0.04, s * 0.13), STEEL, xyz(0, 0.07, 0)),
        ...[-1, 1].flatMap((x) => [P(new THREE.BoxGeometry(s * 0.04, s * 0.46, s * 0.08), STEEL, xyz(x * 0.21, 0.29, 0)), P(new THREE.CylinderGeometry(s * 0.05, s * 0.05, s * 0.05, 16), DARK, xyz(x * 0.21, EL_Y, 0), [0, 0, Math.PI / 2])]),
        bar(xyz(-0.21, 0.09, 0), xyz(-0.07, 0.24, 0), s * 0.02, STEEL),
        bar(xyz(0.21, 0.09, 0), xyz(0.07, 0.24, 0), s * 0.02, STEEL),
      ],
      metal(T, { which: 'plates', repeat: 1, metal: 0.6, rough: 0.5 }),
    );
    az.add(mount);

    // the dish, its axis +y, tipped on the axle
    const el = new THREE.Group();
    el.position.y = s * EL_Y;
    az.add(el);
    const N = 14;
    const faceProf = Array.from({ length: N + 1 }, (_, i) => {
      const r = 0.035 + ((N - i) / N) * (D - 0.035);
      return [r, depth(r)];
    });
    const backProf = Array.from({ length: N + 1 }, (_, i) => {
      const r = 0.035 + (i / N) * (D - 0.035);
      return [r, depth(r) - 0.014];
    });
    // its face in panels: seams running out from the middle and rings round it
    const panels = paint(
      (g, w, h) => {
        g.fillStyle = '#f2f4f7';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#c3c9d2';
        for (let i = 0; i < 24; i++) g.fillRect(Math.round((i / 24) * w), 0, 1, h);
        for (const v of [0.22, 0.45, 0.68, 0.86]) g.fillRect(0, Math.round(v * h), w, 1);
        g.fillStyle = '#9aa2ad';
        g.fillRect(0, h - 3, w, 3);
      },
      256,
      64,
    );
    const dishFace = new THREE.Mesh(lathe(prof(faceProf), 64), new THREE.MeshStandardMaterial({ map: panels, metalness: 0.1, roughness: 0.5 }));
    const RIBS = 8;
    const dishBack = build(
      [
        P(lathe(prof(backProf), 64), STEEL),
        P(new THREE.TorusGeometry(s * D, s * 0.014, 6, 72), '#c4c9d1', xyz(0, depth(D) - 0.006, 0), [Math.PI / 2, 0, 0]),
        // ribs under the back, following its curve in three straight runs
        ...Array.from({ length: RIBS }, (_, i) => {
          const a = (i / RIBS) * TAU;
          const pt = (r) => xyz(Math.cos(a) * r, depth(r) - 0.035, Math.sin(a) * r);
          return [0.1, 0.27, 0.44].map((r0) => bar(pt(r0), pt(r0 + 0.17), s * 0.016, DARK, s * 0.03));
        }).flat(),
        // the hub behind it, the axle through it, an equipment box
        P(new THREE.CylinderGeometry(s * 0.1, s * 0.13, s * 0.1, 20), DARK, xyz(0, 0.03, 0)),
        P(new THREE.CylinderGeometry(s * 0.028, s * 0.028, s * 0.4, 12), STEEL, [0, 0, 0], [0, 0, Math.PI / 2]),
        P(new THREE.BoxGeometry(s * 0.14, s * 0.08, s * 0.1), STEEL, xyz(0, -0.03, -0.08)),
        // the feed on its tripod, its horn opening toward the dish
        ...[0, 1, 2].map((i) => {
          const a = (i / 3) * TAU + Math.PI / 2;
          return rod(xyz(Math.cos(a) * D * 0.97, depth(D * 0.97), Math.sin(a) * D * 0.97), xyz(0, V + F + 0.03, 0), s * 0.007, STEEL, 5);
        }),
        P(
          lathe(
            prof([
              [0, V + F + 0.1],
              [0.028, V + F + 0.1],
              [0.03, V + F + 0.04],
              [0.05, V + F],
              [0.042, V + F],
              [0, V + F + 0.03],
            ]),
            16,
          ),
          DARK,
        ),
      ],
      metal(T, { which: 'plates', repeat: 2, metal: 0.55, rough: 0.5 }),
    );
    // the feed's glow and the warning lights on the rim
    const dishLights = beads([
      { geo: new THREE.CylinderGeometry(s * 0.036, s * 0.036, s * 0.004, 16), at: xyz(0, V + F + 0.004, 0), color: GLOW, k: 4 },
      { at: xyz(D, depth(D), 0), r: s * 0.012, color: '#ff3b30', k: 6, blink: [0.5, 0, 0.15] },
      { at: xyz(-D, depth(D), 0), r: s * 0.012, color: '#ff3b30', k: 6, blink: [0.5, 0.5, 0.15] },
    ]);

    // the message going out: rings leaving the feed along the dish's axis,
    // growing and fading, three at a time (one mesh; the shader moves them)
    const pulseGeo = parts([0, 1, 2].map(() => [new THREE.TorusGeometry(1, s * 0.01, 4, 72), [0, 0, 0], [Math.PI / 2, 0, 0]]));
    const ph = new Float32Array(pulseGeo.attributes.position.count);
    for (let i = 0; i < ph.length; i++) ph[i] = Math.floor((i / ph.length) * 3) / 3;
    pulseGeo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    const pulseMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(GLOW).multiplyScalar(3) }, uFrom: { value: s * (V + F) }, uReach: { value: s * 0.95 }, uSize: { value: new THREE.Vector2(s * 0.08, s * 0.55) } },
      vertexShader: `
        attribute float aPhase;
        uniform float uTime, uFrom, uReach;
        uniform vec2 uSize;
        varying float vFade;
        void main() {
          float k = fract(uTime * 0.32 + aPhase);
          vec2 d = normalize(position.xz);
          vec3 p = vec3(0.0);
          p.xz = d * mix(uSize.x, uSize.y, k) + (position.xz - d);
          p.y = position.y + uFrom + k * uReach;
          vFade = (1.0 - k) * (1.0 - k) * smoothstep(0.0, 0.1, k);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(uColor * vFade, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pulses = new THREE.Mesh(pulseGeo, pulseMat);
    pulses.frustumCulled = false;
    el.add(dishFace, dishBack, dishLights, pulses);

    // the module's lights: its windows, the masts' beacon and strobe, the port's lights
    const rand = rng('contact');
    const lights = beads([
      ...Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * TAU + 0.1;
        return { geo: new THREE.BoxGeometry(s * 0.05, s * 0.026, s * 0.005), at: xyz(Math.cos(a) * 0.302, Y0 + 0.002, Math.sin(a) * 0.302), rot: [0, Math.PI / 2 - a, 0], color: rand() < 0.25 ? '#2a2016' : rand() < 0.15 ? '#cfe6ff' : '#ffd9a0', k: 3.2 };
      }),
      { at: mastEnd(MASTS[0]), r: s * 0.018, color: '#ff4a3a', k: 7, blink: [0.55, 0, 0.18] },
      { at: mastEnd(MASTS[1]), r: s * 0.012, color: '#ffffff', k: 7, blink: [0.8, 0.3, 0.06] },
      { at: xyz(0.085, Y0 - 0.2, 0), r: s * 0.01, color: '#3dff7a', k: 5, blink: [0.5, 0, 0.5] },
      { at: xyz(-0.085, Y0 - 0.2, 0), r: s * 0.01, color: '#ff3b30', k: 5, blink: [0.5, 0.5, 0.5] },
      ...SMALL.map(([a, dir]) => ({ at: [Math.cos(a) * s * 0.45 + dir[0] * s * 0.07, s * (Y0 + 0.04) + dir[1] * s * 0.07, Math.sin(a) * s * 0.45 + dir[2] * s * 0.07], r: s * 0.008, color: GLOW, k: 4 })),
    ]);

    st.add(base, az, lights);
    const face = faceCamera(az);
    p.tick.push((t, camera) => {
      face(t, camera, 1.05 + Math.sin(t * 0.07) * 0.3);
      el.rotation.x = 0.62 + Math.sin(t * 0.05 + 1) * 0.1;
      pulseMat.uniforms.uTime.value = t;
      lights.material.uniforms.uTime.value = t;
      dishLights.material.uniforms.uTime.value = t;
    });
  },

  // The Terminal: a monolith server tower. A beveled dark slab whose face
  // is the green terminal screen (a prompt being typed, the cursor
  // blinking), drive bays and activity lights under it, vents down its
  // sides with thin lines glowing between the louvres, cables into its back,
  // an octagonal plinth ringed with lights, and green glyphs drifting up
  // round it like code rain. It turns to face you.
  terminal(p, { u, T }) {
    const s = u.size;
    const xyz = (...v) => v.map((x) => x * s);
    p.body.visible = false;
    const st = new THREE.Group();
    p.body.parent.add(st);
    const GREEN = u.palette.glow;
    const W = 0.74;
    const H = 1.56;
    const Y = 0.12; // the slab's middle
    const FRONT = 0.13; // its face

    // the slab: a rounded rectangle extruded with a bevel, its face to +z
    const shape = new THREE.Shape();
    const rr = 0.06 * s;
    const x0 = (-W / 2) * s;
    const y0 = (-H / 2) * s;
    shape.moveTo(x0 + rr, y0);
    shape.lineTo(-x0 - rr, y0);
    shape.quadraticCurveTo(-x0, y0, -x0, y0 + rr);
    shape.lineTo(-x0, -y0 - rr);
    shape.quadraticCurveTo(-x0, -y0, -x0 - rr, -y0);
    shape.lineTo(x0 + rr, -y0);
    shape.quadraticCurveTo(x0, -y0, x0, -y0 - rr);
    shape.lineTo(x0, y0 + rr);
    shape.quadraticCurveTo(x0, y0, x0 + rr, y0);
    const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.2 * s, bevelEnabled: true, bevelThickness: 0.03 * s, bevelSize: 0.025 * s, bevelSegments: 3, curveSegments: 4 });
    slabGeo.translate(0, 0, -0.1 * s);
    const SLAB = '#30363f';
    const LOUVRE = '#16191e';
    const TRIM = '#4d5562';
    const side = (W / 2 + 0.025) * s;
    const VENTS = 14;
    const cable = (a, b, c) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v3(xyz(...a)), v3(xyz(...b)), v3(xyz(...c))]), 20, s * 0.016, 6);
    const body = build(
      [
        P(slabGeo, SLAB, xyz(0, Y, 0)),
        // the screen's bezel, standing a little proud of the face
        P(new THREE.BoxGeometry(s * 0.66, s * 0.025, s * 0.012), TRIM, xyz(0, 0.83, FRONT)),
        P(new THREE.BoxGeometry(s * 0.66, s * 0.025, s * 0.012), TRIM, xyz(0, -0.01, FRONT)),
        P(new THREE.BoxGeometry(s * 0.025, s * 0.86, s * 0.012), TRIM, xyz(-0.318, 0.41, FRONT)),
        P(new THREE.BoxGeometry(s * 0.025, s * 0.86, s * 0.012), TRIM, xyz(0.318, 0.41, FRONT)),
        // the drive bays under it, two columns of three
        ...[0, 1, 2].flatMap((row) => [-1, 1].map((col) => P(new THREE.BoxGeometry(s * 0.27, s * 0.055, s * 0.012), LOUVRE, xyz(col * 0.15, -0.2 - row * 0.085, FRONT)))),
        // the vents down each side: louvres
        ...[-1, 1].flatMap((x) => Array.from({ length: VENTS }, (_, i) => P(new THREE.BoxGeometry(s * 0.014, s * 0.012, s * 0.17), LOUVRE, [x * side, s * (-0.45 + i * 0.06), 0]))),
        // the plinth: two octagonal tiers and a keel under them
        P(flat(new THREE.CylinderGeometry(s * 0.58, s * 0.62, s * 0.07, 8)), TRIM, xyz(0, -0.785, 0), [0, Math.PI / 8, 0]),
        P(flat(new THREE.CylinderGeometry(s * 0.46, s * 0.5, s * 0.06, 8)), SLAB, xyz(0, -0.72, 0), [0, Math.PI / 8, 0]),
        P(flat(new THREE.CylinderGeometry(s * 0.5, s * 0.24, s * 0.12, 8)), SLAB, xyz(0, -0.88, 0), [0, Math.PI / 8, 0]),
        // the cables into its back
        P(cable([-0.3, -0.69, -0.32], [-0.26, -0.5, -0.24], [-0.15, -0.42, -0.12]), LOUVRE),
        P(cable([0.32, -0.69, -0.28], [0.25, -0.56, -0.22], [0.12, -0.5, -0.12]), LOUVRE),
        // a sensor mast on top
        rod(xyz(0.22, 0.9, -0.02), xyz(0.22, 1.08, -0.02), s * 0.008, TRIM),
      ],
      metal(T, { which: 'hull', repeat: 1, metal: 0.7, map: false, rough: 0.42 }),
    );

    // the screen: the prompt typed out, the cursor blinking, redrawn only
    // when what shows changes
    const LINES = ['$ whoami', 'tilak', '$ ls ~/universe', 'experience  projects', 'resume  contact', '$ cat role', 'TPM & engineer'];
    const CMD = 'cd ~/terminal';
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 340;
    const g = canvas.getContext('2d');
    const screenTex = new THREE.CanvasTexture(canvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    screenTex.anisotropy = 4;
    const draw = (typed, cursor) => {
      const w = canvas.width;
      const h = canvas.height;
      g.fillStyle = '#020a05';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(125,255,154,0.16)';
      g.fillRect(0, 0, w, 24);
      g.fillStyle = '#7dff9a';
      g.font = '600 13px ui-monospace, Menlo, monospace';
      g.fillText('tty1  tilak@universe', 10, 16);
      g.font = '600 18px ui-monospace, Menlo, monospace';
      LINES.forEach((l, i) => g.fillText(l, 14, 54 + i * 34));
      const last = '$ ' + CMD.slice(0, typed);
      g.fillText(last, 14, 54 + LINES.length * 34);
      if (cursor) g.fillRect(14 + g.measureText(last).width + 2, 40 + LINES.length * 34, 10, 18);
      g.fillStyle = 'rgba(125,255,154,0.05)';
      for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
      screenTex.needsUpdate = true;
    };
    draw(0, true);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.6, s * 0.8), new THREE.MeshBasicMaterial({ map: screenTex, color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: false }));
    screen.position.set(...xyz(0, 0.41, FRONT + 0.002));

    // its lights: activity on the drive bays, glowing lines between the
    // louvres climbing the sides, the plinth's ring, the mast's tip
    const rand = rng('terminal');
    const lights = beads([
      ...[0, 1, 2].flatMap((row) => [-1, 1].map((col) => ({ at: xyz(col * 0.15 + 0.1, -0.2 - row * 0.085, FRONT + 0.008), r: s * 0.008, color: rand() < 0.3 ? '#ffb347' : GREEN, k: 5, blink: [1 + rand() * 3, rand(), 0.3 + rand() * 0.4] }))),
      ...Array.from({ length: 8 }, (_, i) => ({ geo: new THREE.BoxGeometry(s * 0.03, s * 0.008, s * 0.004), at: xyz(-0.245 + i * 0.07, -0.07, FRONT + 0.004), color: GREEN, k: 4, blink: [0.7 + rand() * 1.5, rand(), 0.5] })),
      ...[-1, 1].flatMap((x) =>
        Array.from({ length: VENTS - 1 }, (_, i) => ({ geo: new THREE.BoxGeometry(s * 0.004, s * 0.004, s * 0.15), at: [x * (side + s * 0.002), s * (-0.42 + i * 0.06), 0], color: GREEN, k: 3.5, blink: [0.3, -i * 0.04, 0.35] })),
      ),
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * TAU;
        const r = 0.6 / Math.cos(Math.PI / 8);
        return { at: xyz(Math.cos(a) * r * 0.97, -0.785, Math.sin(a) * r * 0.97), r: s * 0.01, color: i % 2 ? '#ffffff' : GREEN, k: 3.5, blink: [0.25, i / 8, 0.3] };
      }),
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * TAU + Math.PI / 8;
        const r = 0.5 * Math.cos(Math.PI / 8);
        return { geo: new THREE.BoxGeometry(s * 0.37, s * 0.005, s * 0.005), at: xyz(Math.cos(a) * r, -0.69, Math.sin(a) * r), rot: [0, Math.PI / 2 - a, 0], color: GREEN, k: 2.6 };
      }),
      { at: xyz(0.22, 1.09, -0.02), r: s * 0.014, color: GREEN, k: 6, blink: [0.5, 0, 0.2] },
      // thin lines down the face's edges
      ...[-1, 1].map((x) => ({ geo: new THREE.BoxGeometry(s * 0.005, s * 1.3, s * 0.004), at: xyz(x * (W / 2 - 0.035), 0.16, FRONT + 0.002), color: GREEN, k: 1.8 })),
      { at: xyz(0, -0.46, FRONT + 0.006), geo: new THREE.TorusGeometry(s * 0.02, s * 0.004, 6, 20), color: GREEN, k: 4, blink: [0.25, 0, 1.2] },
    ]);

    // code rain: glyphs drifting up round the tower (a 4×4 sheet of them,
    // one picked per point in the shader), fading in low and out high
    const atlas = paint(
      (ag, w) => {
        ag.clearRect(0, 0, w, w);
        ag.fillStyle = '#ffffff';
        ag.font = '700 26px ui-monospace, Menlo, monospace';
        ag.textAlign = 'center';
        ag.textBaseline = 'middle';
        '01{}<>/$#=+*;:λ_'.split('').forEach((c, i) => ag.fillText(c, (i % 4) * 32 + 16, Math.floor(i / 4) * 32 + 17));
      },
      128,
      128,
    );
    atlas.generateMipmaps = false;
    atlas.minFilter = THREE.LinearFilter;
    const R = 64;
    const drops = Array.from({ length: R }, () => ({ a: rand() * TAU, r: 0.46 + rand() * 0.32, y: rand(), v: 0.05 + rand() * 0.08 }));
    const rainPos = new Float32Array(R * 3);
    const rainCol = new Float32Array(R * 3);
    const glyph = new Float32Array(R).map(() => Math.floor(rand() * 16));
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    rainGeo.setAttribute('color', new THREE.BufferAttribute(rainCol, 3).setUsage(THREE.DynamicDrawUsage));
    rainGeo.setAttribute('aGlyph', new THREE.BufferAttribute(glyph, 1).setUsage(THREE.DynamicDrawUsage));
    const rainMat = new THREE.PointsMaterial({ map: atlas, size: s * 0.1, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    rainMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlyph;\nvarying float vGlyph;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlyph = aGlyph;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGlyph;')
        .replace('#include <map_particle_fragment>', 'vec2 cell = vec2(mod(vGlyph, 4.0), floor(vGlyph / 4.0));\ndiffuseColor *= texture2D(map, vec2((cell.x + gl_PointCoord.x) / 4.0, 1.0 - (cell.y + gl_PointCoord.y) / 4.0));');
    };
    rainMat.customProgramCacheKey = () => 'code-rain';
    const rain = new THREE.Points(rainGeo, rainMat);
    rain.frustumCulled = false;
    const green = new THREE.Color(GREEN).multiplyScalar(3);

    st.add(body, screen, lights, rain);
    const face = faceCamera(st);
    let shown = '';
    p.tick.push((t, camera) => {
      face(t, camera, Math.sin(t * 0.3) * 0.35);
      lights.material.uniforms.uTime.value = t;
      // type the command, hold it with the cursor blinking, start again
      const k = t % 7;
      const typed = Math.min(CMD.length, Math.floor(Math.max(0, k - 0.8) * 7));
      const cursor = typed < CMD.length && k > 0.8 ? true : Math.floor(t * 1.6) % 2 === 0;
      const now = `${typed}${cursor}`;
      if (now !== shown) {
        shown = now;
        draw(typed, cursor);
      }
      drops.forEach((d, i) => {
        const y = (d.y + t * d.v) % 1;
        const a = d.a + Math.sin(t * 0.2 + i) * 0.02;
        rainPos.set(xyz(Math.cos(a) * d.r, -0.72 + y * 1.85, Math.sin(a) * d.r), i * 3);
        const f = Math.min(1, y * 5) * (1 - y) ** 1.2;
        rainCol.set([green.r * f, green.g * f, green.b * f], i * 3);
        if (rand() < 0.01) glyph[i] = Math.floor(rand() * 16);
      });
      rainGeo.attributes.position.needsUpdate = true;
      rainGeo.attributes.color.needsUpdate = true;
      rainGeo.attributes.aGlyph.needsUpdate = true;
    });
  },
};
