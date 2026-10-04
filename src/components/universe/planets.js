// The planets of the universe map, one builder per universe. Each is a matte
// sphere painted on a canvas in its universe's palette, a soft rim in its
// colour, and the things that make it that universe: the Death Star's dish
// and Alderaan, the One Ring, the Infinity Stones, the crystals and element
// tiles, the mug, the portal, the travel routes. Six of those things are
// models (five made for the map with Meshy, plus Rick's cruiser from Portal
// panic); they load after the map is up and are parked on an orbit, and a
// planet whose model hasn't arrived (or never does) simply goes without.
//
// buildPlanet(u, { low }) → { id, radius, group, update(t, camera),
//   setState({ hover, selected }), mount(model) }
// `group` sits at the universe's place on the map; everything it holds stays
// within REACH (layout.js) of its centre.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SWIRL_GLSL } from '../rickmorty/swirl';
import { globeData } from '../travel/globe3d/data';

const W = 512; // every planet's canvas is W × W/2, wrapped round the sphere
const H = 256;

// ── Painting ──

// A small seeded random, so every visit paints the same planets.
function rng(id) {
  let s = [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const A = rgb(a);
  const B = rgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};
const shade = (hex, k) => (k >= 0 ? mix(hex, '#ffffff', k) : mix(hex, '#000000', -k));

function paint(draw, w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// An ellipse drawn three times across the seam, so the sphere has none.
function blob(g, x, y, rx, ry, fill, w = W) {
  g.fillStyle = fill;
  for (const dx of [-w, 0, w]) {
    g.beginPath();
    g.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
}

// Soft horizontal bands with a wobble, the way gas giants and dunes go.
function bands(g, rand, colors, n, alpha = 1, w = W, h = H) {
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const y = rand() * h;
    const th = 3 + rand() * 18;
    const amp = 2 + rand() * 6;
    const f = 1 + Math.floor(rand() * 4);
    const ph = rand() * Math.PI * 2;
    g.fillStyle = colors[Math.floor(rand() * colors.length)];
    g.beginPath();
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin((x / w) * Math.PI * 2 * f + ph) * amp);
    for (let x = w; x >= 0; x -= 8) g.lineTo(x, y + th + Math.sin((x / w) * Math.PI * 2 * f + ph + 0.8) * amp);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
}

function mottle(g, rand, colors, n, rMin, rMax, alpha) {
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const r = rMin + rand() * (rMax - rMin);
    blob(g, rand() * W, H * 0.06 + rand() * H * 0.88, r, r * (0.5 + rand() * 0.5), colors[Math.floor(rand() * colors.length)]);
  }
  g.globalAlpha = 1;
}

// Where a direction on the unit sphere lands on the planet's canvas
// (SphereGeometry's own UVs).
const uvOf = (x, y, z) => [((Math.atan2(z, -x) / (Math.PI * 2) + 1) % 1) * W, (Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI) * H];

// ── Shared pieces ──

const RIM_VERT = `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const RIM_FRAG = `
uniform vec3 uColor;
uniform float uStrength;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
  gl_FragColor = vec4(uColor * pow(f, 2.6) * uStrength, 1.0);
  #include <colorspace_fragment>
}`;

const RIM = { idle: 0.42, hover: 1.2, selected: 0.85 };

function rim(radius, swatch, seg) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: RIM_VERT,
    fragmentShader: RIM_FRAG,
    uniforms: { uColor: { value: new THREE.Color(swatch) }, uStrength: { value: RIM.idle } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.03, seg[0], seg[1]), mat);
  mesh.renderOrder = 2;
  return mesh;
}

// Something going round the planet: a tilted plane, turning, with a holder
// out at `radius` for whatever orbits.
function orbit(parent, { radius, tilt = 0, yaw = 0, speed = 0.2, phase = 0 }) {
  const plane = new THREE.Group();
  plane.rotation.set(tilt, yaw, 0);
  parent.add(plane);
  const pivot = new THREE.Group();
  plane.add(pivot);
  const holder = new THREE.Group();
  holder.position.x = radius;
  pivot.add(holder);
  return {
    plane,
    pivot,
    holder,
    set: (t) => (pivot.rotation.y = phase + t * speed),
  };
}

// A model centred on its own middle and scaled so its longest side is `size`.
function fit(root, size) {
  const box = new THREE.Box3().setFromObject(root);
  const dims = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  root.position.sub(centre);
  const holder = new THREE.Group();
  holder.add(root);
  holder.scale.setScalar(size / Math.max(dims.x, dims.y, dims.z, 1e-6));
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      // matte, like the planets: lit by the key light, no reflections needed
      if ('metalness' in m) m.metalness = 0;
      if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 1, 0.75);
    }
  });
  return holder;
}

// ── The universes ──

const BUILDERS = {
  starwars(p, { u, rand }) {
    const r = u.size;
    const P = u.palette;
    const dish = { x: W * 0.27, y: H * 0.32 };
    const map = paint((g) => {
      g.fillStyle = P.base;
      g.fillRect(0, 0, W, H);
      // hull plates, in rows that run round the station
      for (let y = 0; y < H; y += 6) {
        for (let x = 0; x < W; ) {
          const pw = 6 + Math.floor(rand() * 4) * 6;
          g.fillStyle = shade(P.base, (rand() - 0.5) * 0.22);
          g.fillRect(x, y, pw - 1, 5);
          if (rand() < 0.08) {
            g.fillStyle = shade(P.dark, rand() * 0.2);
            g.fillRect(x + 1, y + 1, 2 + rand() * 4, 2);
          }
          x += pw;
        }
      }
      g.fillStyle = shade(P.dark, 0.1);
      for (let y = 0; y < H; y += 24) g.fillRect(0, y, W, 1);
      // the equatorial trench, its upper lip catching the light
      g.fillStyle = P.dark;
      g.fillRect(0, H / 2 - 3, W, 6);
      g.fillStyle = P.light;
      g.fillRect(0, H / 2 - 4, W, 1);
      // the superlaser dish, stretched for its latitude
      const k = 1 / Math.cos((0.5 - dish.y / H) * Math.PI);
      for (const [rr, c] of [
        [27, shade(P.dark, 0.25)],
        [24, shade(P.base, -0.25)],
        [17, shade(P.base, -0.12)],
        [10, shade(P.base, -0.32)],
        [4, P.dark],
      ]) {
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(dish.x, dish.y, rr * k, rr, 0, 0, Math.PI * 2);
        g.fill();
      }
    });
    const glow = paint((g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      const k = 1 / Math.cos((0.5 - dish.y / H) * Math.PI);
      g.fillStyle = P.glow;
      g.beginPath();
      g.ellipse(dish.x, dish.y, 3 * k, 3, 0, 0, Math.PI * 2);
      g.fill();
    });
    p.body.material = new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: glow });
    p.body.rotation.y = -0.6; // the dish starts toward the camera

    // Alderaan, while it lasts
    const moonMap = paint((g, w, h) => {
      g.fillStyle = '#2b6aa3';
      g.fillRect(0, 0, w, h);
      mottle(g, rand, ['#4f8a4a', '#6e9a55', '#3f7444'], 26, 8, 26, 1);
      mottle(g, rand, ['#ffffff'], 30, 6, 18, 0.45);
    });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 32, 20), new THREE.MeshLambertMaterial({ map: moonMap }));
    const o = orbit(p.group, { radius: r * 1.6, tilt: 0.28, speed: 0.32, phase: 2.2 });
    o.holder.add(moon);
    p.orbits.push(o);
    p.tick.push((t) => (moon.rotation.y = t * 0.4));
  },

  music(p, { u, rand }) {
    const r = u.size;
    const P = u.palette;
    const map = paint((g) => {
      g.fillStyle = P.base;
      g.fillRect(0, 0, W, H);
      bands(g, rand, [P.light, shade(P.base, 0.12), shade(P.base, -0.15), P.dark], 26, 0.55);
      mottle(g, rand, [P.light, P.glow], 40, 3, 9, 0.25);
    });
    p.body.material = new THREE.MeshLambertMaterial({ map });

    // the rings are a sitar's strings: thin brass lines, plucked when it's picked
    const strings = new THREE.Group();
    strings.rotation.set(Math.PI / 2 - 0.42, 0, 0.22);
    p.group.add(strings);
    const brass = new THREE.MeshBasicMaterial({ color: '#e9c27c', transparent: true, opacity: 0.85 });
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const R = r * (1.4 + i * 0.07);
      const line = new THREE.Mesh(new THREE.TorusGeometry(R, r * (0.008 + (i === 0 ? 0.004 : 0)), 4, 128), brass);
      strings.add(line);
      lines.push(line);
    }
    let pluckAt = -1;
    p.onSelect = (t) => (pluckAt = t);
    p.tick.push((t) => {
      const age = pluckAt < 0 ? 99 : t - pluckAt;
      lines.forEach((line, i) => {
        const a = age < 3 ? 0.06 * Math.exp(-age * 2.2) * Math.sin(age * 28 + i * 1.3) : 0;
        line.rotation.x = a;
        line.rotation.y = a * 0.6;
      });
    });

    // the sitar itself, going round on its own tilt
    const o = orbit(p.group, { radius: r * 1.2, tilt: -0.55, speed: 0.2, phase: 0.6 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.78, turn: [0, Math.PI / 2, 0.35] };
  },

  middleearth(p, { u, rand }) {
    const r = u.size;
    const P = u.palette;
    const doom = { x: W * 0.68, y: H * 0.56 };
    const map = paint((g) => {
      g.fillStyle = P.base;
      g.fillRect(0, 0, W, H);
      bands(g, rand, [P.dark, P.light, shade(P.base, 0.15)], 18, 0.35);
      mottle(g, rand, [P.dark, shade(P.base, -0.25), P.light], 70, 6, 22, 0.35);
      // Mordor: ash and dark rock round the mountain
      g.globalAlpha = 0.85;
      blob(g, doom.x, doom.y, 46, 24, '#2a2018');
      g.globalAlpha = 1;
      blob(g, doom.x, doom.y, 30, 14, '#1c150f');
    });
    const glow = paint((g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      const grad = g.createRadialGradient(doom.x, doom.y, 0, doom.x, doom.y, 12);
      grad.addColorStop(0, P.glow);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(doom.x - 14, doom.y - 14, 28, 28);
    });
    p.body.material = new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: glow });

    // the One Ring, its inscription lit
    const words = paint(
      (g, w, h) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#ffd9a0';
        g.lineWidth = 1.4;
        g.lineCap = 'round';
        // a run of flowing marks in the band round the outside of the ring
        for (const y0 of [h * 0.1, h * 0.9]) {
          for (let x = 4; x < w - 6; x += 7) {
            g.beginPath();
            g.moveTo(x, y0 + 3);
            g.quadraticCurveTo(x + 2 + rand() * 3, y0 - 4 - rand() * 2, x + 5, y0 + (rand() - 0.5) * 3);
            if (rand() < 0.4) g.arc(x + 3, y0 + 2, 1.6, 0, Math.PI * 2);
            g.stroke();
          }
        }
      },
      512,
      32,
    );
    const ringMat = new THREE.MeshPhongMaterial({ color: '#d4a03a', specular: '#fff1c0', shininess: 90, emissive: '#ff6a12', emissiveMap: words, emissiveIntensity: 0.9 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.26, r * 0.06, 16, 64), ringMat);
    const o = orbit(p.group, { radius: r * 1.55, tilt: 0.42, speed: 0.22, phase: 4 });
    o.holder.add(ring);
    p.orbits.push(o);
    p.tick.push((t) => {
      ring.rotation.set(0.9 + Math.sin(t * 0.5) * 0.3, t * 0.6, 0.3);
      ringMat.emissiveIntensity = 0.75 + 0.35 * Math.sin(t * 1.7) ** 2;
    });
  },

  transformers(p, { u, rand }) {
    const r = u.size;
    const P = u.palette;
    const plates = [];
    const split = (x, y, w, h, d) => {
      if (d > 4 || (d > 2 && rand() < 0.3) || w < 12 || h < 8) {
        plates.push([x, y, w, h]);
        return;
      }
      if (w / 2 > h ? true : rand() < 0.35) {
        const k = 0.3 + rand() * 0.4;
        split(x, y, w * k, h, d + 1);
        split(x + w * k, y, w * (1 - k), h, d + 1);
      } else {
        const k = 0.3 + rand() * 0.4;
        split(x, y, w, h * k, d + 1);
        split(x, y + h * k, w, h * (1 - k), d + 1);
      }
    };
    for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 64) split(x, y, 64, 32, 0);
    const lit = plates.map(() => rand());
    const map = paint((g) => {
      g.fillStyle = P.dark;
      g.fillRect(0, 0, W, H);
      for (const [x, y, w, h] of plates) {
        g.fillStyle = mix(P.base, P.light, rand() * 0.7);
        g.fillRect(x + 1, y + 1, w - 2, h - 2);
        g.fillStyle = shade(P.light, 0.2);
        g.fillRect(x + 1, y + 1, w - 2, 1);
      }
    });
    const glow = paint((g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      g.lineWidth = 1.2;
      plates.forEach(([x, y, w, h], i) => {
        if (lit[i] > 0.22) return;
        g.strokeStyle = lit[i] < 0.07 ? u.swatch : P.glow;
        g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      });
    });
    p.body.material = new THREE.MeshPhongMaterial({ map, emissive: 0xffffff, emissiveMap: glow, shininess: 26, specular: '#3a3f4a' });
    const o = orbit(p.group, { radius: r * 1.5, tilt: 0.3, speed: 0.18, phase: 1.2 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.62, turn: [0, Math.PI, 0] };
  },

  marvel(p, { u, rand }) {
    const r = u.size;
    const P = u.palette;
    const map = paint((g) => {
      g.fillStyle = P.base;
      g.fillRect(0, 0, W, H);
      bands(g, rand, [P.dark, shade(P.dark, 0.15), '#9a2a24'], 12, 0.9);
      bands(g, rand, [P.light, shade(P.base, 0.1)], 14, 0.5);
      mottle(g, rand, [P.light, P.dark], 40, 4, 12, 0.18);
    });
    p.body.material = new THREE.MeshLambertMaterial({ map });

    // the six Stones, as small glowing moons in a ring
    const STONES = ['#3d7bff', '#ffd23d', '#ff3d3d', '#a34dff', '#3dff8a', '#ff8a3d'];
    const stones = new THREE.InstancedMesh(new THREE.OctahedronGeometry(r * 0.085, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), 6);
    const c = new THREE.Color();
    STONES.forEach((hex, i) => stones.setColorAt(i, c.set(hex)));
    const ring = new THREE.Group();
    ring.rotation.set(0.3, 0, -0.18);
    ring.add(stones);
    p.group.add(ring);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1.35, 1);
    const at = new THREE.Vector3();
    p.tick.push((t) => {
      for (let i = 0; i < 6; i++) {
        const a = t * 0.3 + (i / 6) * Math.PI * 2;
        at.set(Math.cos(a) * r * 1.3, 0, Math.sin(a) * r * 1.3);
        q.setFromEuler(e.set(t * 0.8 + i, t * 0.5, 0));
        stones.setMatrixAt(i, m.compose(at, q, s));
      }
      stones.instanceMatrix.needsUpdate = true;
    });

    const o = orbit(p.group, { radius: r * 1.55, tilt: -0.4, speed: 0.16, phase: 3 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.62, turn: [0, Math.PI / 2, 0] };
  },

  breakingbad(p, { u, rand }) {
    const r = u.size;
    const P = u.palette;
    const map = paint((g) => {
      g.fillStyle = P.base;
      g.fillRect(0, 0, W, H);
      bands(g, rand, [P.light, shade(P.base, 0.1), shade(P.base, -0.12)], 30, 0.5);
      // mesas: flat-topped rock, long and low
      for (let i = 0; i < 26; i++) {
        const x = rand() * W;
        const y = H * 0.12 + rand() * H * 0.76;
        const w = 10 + rand() * 30;
        g.globalAlpha = 0.8;
        blob(g, x, y, w, 2 + rand() * 3, P.dark);
        blob(g, x, y - 2, w * 0.8, 1.2, shade(P.light, 0.1));
      }
      g.globalAlpha = 1;
      mottle(g, rand, ['#f2ead8'], 6, 6, 14, 0.4); // salt flats
    });
    p.body.material = new THREE.MeshLambertMaterial({ map });

    // blue crystal moons
    const crystals = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(r * 0.07, 0),
      new THREE.MeshPhongMaterial({ color: '#86dcff', emissive: '#1b6f9e', specular: '#ffffff', shininess: 100, flatShading: true }),
      5,
    );
    const belt = new THREE.Group();
    belt.rotation.set(0.5, 0, 0.1);
    belt.add(crystals);
    p.group.add(belt);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const at = new THREE.Vector3();
    const sz = [1, 0.8, 1.2, 0.7, 1].map((k) => new THREE.Vector3(k, k * 1.9, k));
    p.tick.push((t) => {
      for (let i = 0; i < 5; i++) {
        const a = t * 0.26 + (i / 5) * Math.PI * 2 + (i % 2) * 0.3;
        at.set(Math.cos(a) * r * 1.32, (i % 2 ? 1 : -1) * r * 0.06, Math.sin(a) * r * 1.32);
        q.setFromEuler(e.set(0.4, t * 0.7 + i, 0.3));
        crystals.setMatrixAt(i, m.compose(at, q, sz[i]));
      }
      crystals.instanceMatrix.needsUpdate = true;
    });

    // element tiles, as the show's titles have them
    const tiles = new THREE.Group();
    tiles.rotation.set(-0.22, 0, 0.12);
    p.group.add(tiles);
    [
      ['Br', 35],
      ['Ba', 56],
      ['C', 6],
      ['N', 7],
    ].forEach(([sym, n], i) => {
      const tex = paint(
        (g, w, h) => {
          g.fillStyle = '#1d5e33';
          g.fillRect(0, 0, w, h);
          g.strokeStyle = '#7fbf6a';
          g.lineWidth = 6;
          g.strokeRect(5, 5, w - 10, h - 10);
          g.fillStyle = '#ffffff';
          g.font = '600 22px ui-monospace, Menlo, monospace';
          g.fillText(String(n), 16, 34);
          g.font = '700 64px ui-sans-serif, system-ui, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(sym, w / 2, h / 2 + 10);
        },
        128,
        128,
      );
      const tile = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
      tile.scale.setScalar(r * 0.22);
      tile.userData.a = (i / 4) * Math.PI * 2;
      tiles.add(tile);
    });
    p.tick.push((t) => {
      for (const tile of tiles.children) {
        const a = tile.userData.a - t * 0.14;
        tile.position.set(Math.cos(a) * r * 1.68, 0, Math.sin(a) * r * 1.68);
      }
    });

    const o = orbit(p.group, { radius: r * 1.5, tilt: 1.0, speed: 0.2, phase: 0.4 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.6, turn: [0, Math.PI / 2, 0] };
  },

  office(p, { u, rand }) {
    const r = u.size;
    const P = u.palette;
    const map = paint((g) => {
      g.fillStyle = P.base;
      g.fillRect(0, 0, W, H);
      mottle(g, rand, [shade(P.base, -0.04), P.light], 30, 10, 30, 0.5);
      g.fillStyle = P.dark;
      g.globalAlpha = 0.75;
      for (let y = 22; y < H - 14; y += 9) g.fillRect(0, y, W, 1);
      g.globalAlpha = 1;
      // the margin, on both sides of the sheet, and the punched holes beside one
      g.fillStyle = P.glow;
      for (const x of [W * 0.14, W * 0.64]) g.fillRect(x, 0, 2, H);
      for (const y of [H * 0.3, H * 0.5, H * 0.7]) blob(g, W * 0.07, y, 5, 5, '#c8c2b2');
    });
    p.body.material = new THREE.MeshLambertMaterial({ map });

    // the mug
    const label = paint(
      (g, w, h) => {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#111111';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '800 15px ui-sans-serif, system-ui, sans-serif';
        g.fillText("WORLD'S BEST", w * 0.25, h * 0.38);
        g.fillText('BOSS', w * 0.25, h * 0.66);
      },
      256,
      64,
    );
    const white = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const mug = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.105, r * 0.26, 28, 1), [
      new THREE.MeshLambertMaterial({ map: label }),
      new THREE.MeshLambertMaterial({ color: '#4a2b18' }),
      white,
    ]);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.07, r * 0.02, 8, 18, Math.PI), white);
    handle.position.x = -r * 0.115;
    handle.rotation.z = Math.PI / 2;
    mug.add(body, handle);
    const o = orbit(p.group, { radius: r * 1.5, tilt: 0.32, speed: 0.28, phase: 5 });
    o.holder.add(mug);
    p.orbits.push(o);
    p.tick.push((t) => mug.rotation.set(0.25 + Math.sin(t * 0.6) * 0.2, t * 0.5, 0.15));
  },

  rickmorty(p, { u, rand }) {
    const r = u.size;
    const P = u.palette;
    const lakes = [];
    for (let i = 0; i < 9; i++) lakes.push([rand() * W, H * 0.15 + rand() * H * 0.7, 6 + rand() * 14]);
    const map = paint((g) => {
      g.fillStyle = P.base;
      g.fillRect(0, 0, W, H);
      bands(g, rand, [P.dark, P.light, shade(P.base, 0.15), shade(P.base, -0.2)], 24, 0.45);
      mottle(g, rand, [P.light], 26, 6, 18, 0.25);
      for (const [x, y, s] of lakes) blob(g, x, y, s, s * 0.6, '#7fc23a');
    });
    const glow = paint((g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.55;
      for (const [x, y, s] of lakes) blob(g, x, y, s * 0.7, s * 0.4, P.glow);
      g.globalAlpha = 1;
    });
    p.body.material = new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: glow });

    // a portal hangs on the cruiser's orbit, so it flies through it
    const o = orbit(p.group, { radius: r * 1.55, tilt: 0.36, speed: 0.24, phase: 1 });
    const portalMat = new THREE.ShaderMaterial({
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float t;
        varying vec2 vUv;
        ${SWIRL_GLSL}
        void main() {
          vec4 c = portal((vUv * 2.0 - 1.0) * 1.22, t, 1.0, 3.0);
          if (c.a < 0.004) discard;
          gl_FragColor = c;
        }`,
    });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.8, r * 0.8), portalMat);
    portal.position.set(Math.cos(2.4) * r * 1.55, 0, -Math.sin(2.4) * r * 1.55);
    portal.renderOrder = 3;
    o.plane.add(portal);
    const q = new THREE.Quaternion();
    p.tick.push((t, camera) => {
      portalMat.uniforms.t.value = t;
      if (!camera) return;
      // always face the camera: undo the turns above it, then take the camera's
      portal.parent.getWorldQuaternion(q);
      portal.quaternion.copy(q.invert()).multiply(camera.quaternion);
    });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.58, turn: [0.15, Math.PI, 0] };
  },

  gaming(p, { u, rand }) {
    const r = u.size;
    const P = u.palette;
    // a ball of blocks in the Game Boy's four greens: the shell of a voxel
    // grid, with hills one block higher
    const c = r / 4.6;
    const greens = [P.dark, P.glow, P.base, P.light];
    const cells = [];
    const n = Math.ceil(r / c) + 1;
    const lift = (x, y, z) => Math.sin(x * 3.1 + rand() * 0.2) + Math.sin(y * 2.3 + 1.7) * 0.8 + Math.sin(z * 2.7 + 0.6);
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        for (let k = -n; k <= n; k++) {
          const v = new THREE.Vector3(i * c, j * c, k * c);
          const d = v.length();
          if (d > r - c * 0.5 || d < r - c * 1.6) continue;
          const h = lift(v.x / r, v.y / r, v.z / r);
          const band = h > 1.2 ? 3 : h > 0.3 ? 2 : h > -0.6 ? 1 : 0;
          cells.push([v, band]);
          if (band === 3) cells.push([v.clone().addScaledVector(v.clone().normalize(), c), 3]);
        }
      }
    }
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(c * 0.94, c * 0.94, c * 0.94), new THREE.MeshLambertMaterial(), cells.length);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    cells.forEach(([v, band], i) => {
      blocks.setMatrixAt(i, m.makeTranslation(v.x, v.y, v.z));
      blocks.setColorAt(i, col.set(greens[band]));
    });
    p.body.geometry.dispose();
    p.body.geometry = new THREE.SphereGeometry(r * 0.9, 24, 16);
    p.body.material = new THREE.MeshLambertMaterial({ color: P.dark });
    p.body.add(blocks);

    const o = orbit(p.group, { radius: r * 1.55, tilt: -0.3, speed: 0.22, phase: 2.6 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.6, turn: [0, Math.PI, 0.2] };
  },

  travel(p, { u, rand }) {
    const r = u.size;
    const P = u.palette;
    const data = globeData();
    const map = paint((g) => {
      const sea = g.createLinearGradient(0, 0, 0, H);
      sea.addColorStop(0, P.dark);
      sea.addColorStop(0.5, P.base);
      sea.addColorStop(1, P.dark);
      g.fillStyle = sea;
      g.fillRect(0, 0, W, H);
      // land as the travel globe draws it: a dot per lattice point, the
      // countries I've been to lit
      for (let i = 0; i < data.count; i++) {
        const [x, y] = uvOf(data.xyz[i * 3], data.xyz[i * 3 + 1], data.xyz[i * 3 + 2]);
        const seen = data.placeOf[data.owner[i]] >= 0;
        g.fillStyle = seen ? '#b9e27a' : shade(P.light, (rand() - 0.5) * 0.2);
        g.fillRect(x - 1, y - 1, 2.4, 2.4);
      }
      g.fillStyle = '#e8f1f6';
      g.fillRect(0, 0, W, 5);
      g.fillRect(0, H - 6, W, 6);
    });
    p.body.material = new THREE.MeshLambertMaterial({ map });

    // a few routes from home, lifted off the surface
    const routes = data.arcs.filter(Boolean);
    const pick = [0, 0.2, 0.4, 0.6, 0.8].map((k) => routes[Math.floor(k * routes.length)]).filter(Boolean);
    const tubes = pick.map((pts) => {
      const steps = pts.length / 3 - 1;
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 25 }, (_, i) => {
          const k = Math.round((i / 24) * steps) * 3;
          return new THREE.Vector3(pts[k] * r, pts[k + 1] * r, pts[k + 2] * r);
        }),
      );
      return new THREE.TubeGeometry(curve, 48, r * 0.011, 5, false);
    });
    if (tubes.length) {
      const arcs = new THREE.Mesh(mergeGeometries(tubes), new THREE.MeshBasicMaterial({ color: u.swatch }));
      for (const t of tubes) t.dispose();
      p.body.add(arcs);
    }
  },
};

export function buildPlanet(u, { low = false } = {}) {
  const seg = low ? [32, 20] : [64, 40];
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(u.size, seg[0], seg[1]), new THREE.MeshLambertMaterial({ color: u.palette.base }));
  group.add(body);
  const halo = rim(u.size, u.swatch, seg);
  group.add(halo);
  const p = { group, body, orbits: [], tick: [], slot: null, onSelect: null };
  BUILDERS[u.id]?.(p, { u, rand: rng(u.id), seg });
  const spin = 0.05 + rng(`${u.id}-spin`)() * 0.05;
  const turn0 = body.rotation.y;
  let selected = false;
  let t0 = 0;

  return {
    id: u.id,
    radius: u.size,
    group,
    update(t, camera) {
      t0 = t;
      body.rotation.y = turn0 + t * spin;
      for (const o of p.orbits) o.set(t);
      for (const fn of p.tick) fn(t, camera);
    },
    setState({ hover, selected: sel }) {
      halo.material.uniforms.uStrength.value = hover ? RIM.hover : sel ? RIM.selected : RIM.idle;
      if (sel && !selected) p.onSelect?.(t0);
      selected = sel;
    },
    // a loaded model, parked on its orbit (true when this planet takes one)
    mount(model) {
      if (!p.slot || !model) return false;
      const holder = fit(model, p.slot.size);
      holder.rotation.set(...p.slot.turn);
      p.slot.holder.add(holder);
      p.tick.push((t) => (holder.rotation.y = p.slot.turn[1] + Math.sin(t * 0.4) * 0.25));
      return true;
    },
  };
}

const MODELS = {
  music: '/models/universe/music.glb',
  transformers: '/models/universe/transformers.glb',
  marvel: '/models/universe/marvel.glb',
  breakingbad: '/models/universe/breakingbad.glb',
  rickmorty: '/games/meshy/cruiser.glb',
  gaming: '/models/universe/gaming.glb',
};

// Load the models one by one, handing each over as it arrives; a model that
// fails is skipped.
export function loadModels(onModel) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return Promise.all(
    Object.entries(MODELS).map(([id, url]) =>
      loader
        .loadAsync(url)
        .then((g) => onModel(id, g.scene))
        .catch(() => {}),
    ),
  );
}
