// Everything on the universe map that isn't the ship: the sun in the middle,
// the site's own pages as stations round it, and the fandoms as planets
// further out. The planets wear real planetary maps recoloured for their
// worlds, and the stations real metal plates (scripts/build-universe-textures.py
// makes them, from Solar System Scope's maps and ambientCG's materials); each
// has the things that make it that place, in orbit or on board: the Death
// Star's dish and Alderaan, the One Ring, the Infinity Stones, the crystals and
// element tiles, the mug, the portal, the travel routes; the home station's
// lit windows, Experience's six modules, the Projects shipyard, the Résumé, the
// Contact dish, the Terminal's screen. Six models (five made with Meshy, plus
// Rick's cruiser from the C-137 page) load after the map is up and are parked on
// orbits; a planet whose model never arrives simply goes without.
//
// loadTextures({ small }) → the textures (any that fail are just missing)
// buildPlanet(u, T) → { id, radius, group, update(t, camera), setState, mount }
// buildSun(T) → { group, update(t) }

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SWIRL_GLSL } from '../rickmorty/swirl';
import { globeData } from '../travel/globe3d/data';
import { SUN } from './layout';
import { featuredProjects } from '../../data/projects';
import { roles } from '../../data/roles';

const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // the scene's key light

// ── Textures ──

const BASE = '/textures/universe/';
const PLANET_MAPS = ['starwars', 'music', 'middleearth', 'transformers', 'marvel', 'breakingbad', 'office', 'rickmorty', 'earth', 'earth-clouds', 'earth-night', 'sun', 'sky'];
const FIXED = ['alderaan', 'middleearth-glow', 'rickmorty-glow', 'starwars-glow', 'transformers-glow'];
const DATA = ['plates-normal', 'plates-rough', 'hull-normal', 'hull-rough', 'paper-normal', 'cybertron-normal', 'middleearth-normal', 'breakingbad-normal', 'earth-rough'];
const COLOUR = ['plates', 'hull'];

export async function loadTextures({ small = false } = {}) {
  const loader = new THREE.TextureLoader();
  const T = {};
  const get = async (name, file, colour) => {
    try {
      const t = await loader.loadAsync(BASE + file);
      t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      T[name] = t;
    } catch {
      /* missing: whoever wanted it does without */
    }
  };
  await Promise.all([
    ...PLANET_MAPS.map((n) => get(n, `${n}${small ? '-sm' : ''}.webp`, n !== 'earth-clouds')),
    ...FIXED.map((n) => get(n, `${n}.webp`, true)),
    ...DATA.map((n) => get(n, `${n}.webp`, false)),
    ...COLOUR.map((n) => get(n, `${n}.webp`, true)),
  ]);
  return T;
}

// A tiling copy of a texture (the image is shared; the repeat is its own).
export function tiled(t, nx, ny) {
  if (!t) return null;
  const c = t.clone();
  c.wrapS = THREE.RepeatWrapping;
  c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(nx, ny);
  c.needsUpdate = true;
  return c;
}

// ── Small canvas paintings, for labels and tiles ──

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

function paint(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ── Shared pieces ──

// The air round a planet, in its colour, brightest on its sunlit side: a
// halo just outside its edge (the back of a slightly bigger sphere, fading
// out from the limb) and a glow on the surface's own rim (added to the
// planet's material, below), so it's one extra draw a planet as before.
const HALO = 1.2; // the halo's reach, as a share of the planet's radius
const HALO_VERT = `
uniform vec3 uLight;
varying vec3 vN;
varying vec3 vV;
varying vec3 vL;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vL = normalize((viewMatrix * vec4(uLight, 0.0)).xyz);
  gl_Position = projectionMatrix * mv;
}`;
const HALO_FRAG = `
uniform vec3 uColor;
uniform float uStrength;
uniform float uReach;
varying vec3 vN;
varying vec3 vV;
varying vec3 vL;
void main() {
  vec3 n = normalize(vN);
  // how far out from the planet's edge this ray passes, 0 at the edge and 1
  // at the halo's, so the air thins out evenly rather than ending in a rim
  float c = -dot(n, normalize(vV));
  float x = clamp((sqrt(max(1.0 - c * c, 0.0)) * uReach - 1.0) / (uReach - 1.0), 0.0, 1.0);
  float lit = 0.12 + 0.88 * smoothstep(-0.45, 0.5, dot(n, vL));
  gl_FragColor = vec4(uColor * pow(1.0 - x, 3.0) * uStrength * lit, 1.0);
  #include <colorspace_fragment>
}`;

const RIM = { idle: 0.5, hover: 1.3, selected: 0.95 };

function halo(radius, color, seg) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: HALO_VERT,
    fragmentShader: HALO_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: RIM.idle }, uLight: { value: LIGHT }, uReach: { value: HALO } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * HALO, seg[0], seg[1]), mat);
  mesh.renderOrder = 2;
  return mesh;
}

// The glow on a planet's own rim, in its material, and (for Earth) its
// cities' lights on the night side: both follow the sun.
function airGlow(mat, color, { night = null } = {}) {
  const u = {
    uRimColor: { value: new THREE.Color(color) },
    uRimStrength: { value: RIM.idle * 0.8 },
    uSunW: { value: LIGHT },
    uNight: { value: night },
  };
  mat.userData.air = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform vec3 uSunW;\nuniform sampler2D uNight;`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 sunV = normalize((viewMatrix * vec4(uSunW, 0.0)).xyz);
          float day = dot(normal, sunV);
          float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
          totalEmissiveRadiance += uRimColor * rim * uRimStrength * (0.2 + 0.8 * smoothstep(-0.3, 0.6, day));
          ${night ? 'totalEmissiveRadiance += texture2D(uNight, vMapUv).rgb * 1.5 * smoothstep(0.12, -0.3, day);' : ''}
        }`,
      );
  };
  mat.customProgramCacheKey = () => (night ? 'air-night' : 'air');
  return mat;
}

// Something going round: a tilted plane, turning, with a holder out at `radius`.
function orbit(parent, { radius, tilt = 0, yaw = 0, speed = 0.2, phase = 0 }) {
  const plane = new THREE.Group();
  plane.rotation.set(tilt, yaw, 0);
  parent.add(plane);
  const pivot = new THREE.Group();
  plane.add(pivot);
  const holder = new THREE.Group();
  holder.position.x = radius;
  pivot.add(holder);
  return { plane, pivot, holder, set: (t) => (pivot.rotation.y = phase + t * speed) };
}

// A model centred on its own middle and scaled so its longest side is `size`.
function fit(root, size) {
  const box = new THREE.Box3().setFromObject(root);
  const dims = box.getSize(new THREE.Vector3());
  root.position.sub(box.getCenter(new THREE.Vector3()));
  const holder = new THREE.Group();
  holder.add(root);
  holder.scale.setScalar(size / Math.max(dims.x, dims.y, dims.z, 1e-6));
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if ('metalness' in m) m.metalness = 0;
      if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 1, 0.75);
    }
  });
  return holder;
}

// Geometries placed by [geometry, position, rotation, scale], merged into one.
function parts(list) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const geos = list.map(([geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    m.compose(new THREE.Vector3(...pos), q.setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    return g.applyMatrix4(m);
  });
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity });

// Turn something to face the camera every frame (undo its parents' turns,
// then take the camera's).
function facing(mesh) {
  const q = new THREE.Quaternion();
  return (t, camera) => {
    if (!camera || !mesh.parent) return;
    mesh.parent.getWorldQuaternion(q);
    mesh.quaternion.copy(q.invert()).multiply(camera.quaternion);
  };
}

function rounded(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// A station's big sign: its name in its colour and a line under it, on a
// dark glass panel with a lit edge, always facing you. A click on it opens
// the page (the scene does the picking).
function bigSign(u) {
  const [title, line] = u.sign;
  const W2 = 768;
  const H2 = 216;
  const tex = paint(
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      rounded(g, 14, 14, w - 28, h - 28, 26);
      g.fillStyle = 'rgba(6, 10, 20, 0.84)';
      g.fill();
      g.shadowColor = u.swatch;
      g.shadowBlur = 22;
      g.lineWidth = 5;
      g.strokeStyle = u.swatch;
      g.stroke();
      g.shadowBlur = 0;
      rounded(g, 26, 26, w - 52, h - 52, 18);
      g.lineWidth = 1.5;
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.stroke();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = u.swatch;
      g.shadowColor = u.swatch;
      g.shadowBlur = 18;
      g.font = '800 92px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
      if ('letterSpacing' in g) g.letterSpacing = '6px';
      g.fillText(title, w / 2, h * 0.43);
      g.shadowBlur = 0;
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.fillStyle = 'rgba(255,255,255,0.86)';
      g.font = '500 30px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
      g.fillText(`${line}  →`, w / 2, h * 0.76);
    },
    W2,
    H2,
  );
  const w = u.size * 2.9;
  const h = (w * H2) / W2;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.y = u.size * 1.45 + h / 2;
  mesh.renderOrder = 5;
  mesh.userData.size = [w, h];
  return mesh;
}

// A small hologram tile, for what a station holds (a project, a company)
function holoTile(title, sub, color) {
  const tex = paint(
    (g, w, h) => {
      rounded(g, 6, 6, w - 12, h - 12, 14);
      g.fillStyle = 'rgba(8, 18, 32, 0.78)';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = color;
      g.stroke();
      g.fillStyle = color;
      g.font = '700 40px ui-sans-serif, system-ui, sans-serif';
      g.textBaseline = 'middle';
      g.fillText(title, 26, sub ? h * 0.38 : h / 2, w - 52);
      if (sub) {
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.font = '400 24px ui-sans-serif, system-ui, sans-serif';
        g.fillText(sub, 26, h * 0.72, w - 52);
      }
    },
    512,
    144,
  );
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.118), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = 4;
  return mesh;
}

// Tiles in a slow ring round a station, each turned to face you. They show
// only while you're at the station (or it's picked), fading in and out, so
// the map stays clear from further off.
function tileRing(p, items, color, { radius, tilt = 0.25, speed = 0.12, bob = 0.04 }) {
  const ring = new THREE.Group();
  ring.rotation.set(tilt, 0, 0);
  ring.visible = false;
  p.group.add(ring);
  let want = 0;
  let shown = 0;
  let last = 0;
  p.focus.push((on) => (want = on ? 1 : 0));
  const tiles = items.map(([title, sub], i) => {
    const tile = holoTile(title, sub, color);
    ring.add(tile);
    const face = facing(tile);
    const a0 = (i / items.length) * Math.PI * 2;
    p.tick.push((t, camera) => {
      const a = a0 + t * speed;
      tile.position.set(Math.cos(a) * radius, Math.sin(t * 0.8 + i) * bob, Math.sin(a) * radius);
      face(t, camera);
    });
    return tile;
  });
  p.tick.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    shown += (want - shown) * Math.min(1, dt * 5 || (want ? 1 : 0)); // (instantly when the clock is stopped)
    ring.visible = shown > 0.01;
    for (const tile of tiles) tile.material.opacity = shown;
  });
  return tiles;
}

// a station's hull: real metal plates, tinted
function hull(T, color, { repeat = 2, metal = 0.35, which = 'plates' } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    map: tiled(T[which], repeat, repeat),
    normalMap: tiled(T[`${which}-normal`], repeat, repeat),
    roughnessMap: tiled(T[`${which}-rough`], repeat, repeat),
    roughness: 1,
    metalness: metal,
  });
}

// ── The fandoms ──

const BUILDERS = {
  starwars(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.starwars ?? null,
      color: T.starwars ? '#ffffff' : u.palette.base,
      normalMap: tiled(T['plates-normal'], 32, 16),
      normalScale: new THREE.Vector2(0.6, 0.6),
      emissive: '#ffffff',
      emissiveMap: T['starwars-glow'] ?? null,
      emissiveIntensity: T['starwars-glow'] ? 1 : 0,
      roughness: 0.75,
      metalness: 0.2,
    });
    p.body.rotation.y = -0.6; // the dish starts toward the camera

    // Alderaan, while it lasts
    const moon = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 32, 20), new THREE.MeshStandardMaterial({ map: T.alderaan ?? null, color: T.alderaan ? '#ffffff' : '#2b6aa3', roughness: 1 }));
    const o = orbit(p.group, { radius: r * 1.6, tilt: 0.28, speed: 0.32, phase: 2.2 });
    o.holder.add(moon);
    p.orbits.push(o);
    p.tick.push((t) => (moon.rotation.y = t * 0.4));
  },

  music(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({ map: T.music ?? null, color: T.music ? '#ffffff' : u.palette.base, roughness: 1 });
    // the rings are a sitar's strings: thin brass lines, plucked when it's picked
    const strings = new THREE.Group();
    strings.rotation.set(Math.PI / 2 - 0.42, 0, 0.22);
    p.group.add(strings);
    const brass = new THREE.MeshStandardMaterial({ color: '#e9c27c', metalness: 0.8, roughness: 0.35, emissive: '#6b4a14', emissiveIntensity: 0.6 });
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const line = new THREE.Mesh(new THREE.TorusGeometry(r * (1.4 + i * 0.07), r * (0.008 + (i === 0 ? 0.004 : 0)), 5, 160), brass);
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
    const o = orbit(p.group, { radius: r * 1.2, tilt: -0.55, speed: 0.2, phase: 0.6 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.78, turn: [0, Math.PI / 2, 0.35] };
  },

  middleearth(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.middleearth ?? null,
      color: T.middleearth ? '#ffffff' : u.palette.base,
      normalMap: T['middleearth-normal'] ?? null,
      normalScale: new THREE.Vector2(1.1, 1.1),
      emissive: '#ffffff',
      emissiveMap: T['middleearth-glow'] ?? null,
      emissiveIntensity: T['middleearth-glow'] ? 1.4 : 0,
      roughness: 0.95,
    });
    // the One Ring, its inscription lit
    const rand = rng('ring');
    const words = paint(
      (g, w, h) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#ffd9a0';
        g.lineWidth = 1.4;
        g.lineCap = 'round';
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
    const ringMat = new THREE.MeshStandardMaterial({ color: '#e0a83a', metalness: 1, roughness: 0.22, emissive: '#ff6a12', emissiveMap: words, emissiveIntensity: 0.9 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.26, r * 0.06, 20, 72), ringMat);
    const o = orbit(p.group, { radius: r * 1.55, tilt: 0.42, speed: 0.22, phase: 4 });
    o.holder.add(ring);
    p.orbits.push(o);
    p.tick.push((t) => {
      ring.rotation.set(0.9 + Math.sin(t * 0.5) * 0.3, t * 0.6, 0.3);
      ringMat.emissiveIntensity = 0.75 + 0.35 * Math.sin(t * 1.7) ** 2;
    });
  },

  transformers(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.transformers ?? null,
      color: T.transformers ? '#ffffff' : u.palette.base,
      normalMap: tiled(T['cybertron-normal'], 24, 12),
      normalScale: new THREE.Vector2(0.8, 0.8),
      emissive: '#ffffff',
      emissiveMap: T['transformers-glow'] ?? null,
      emissiveIntensity: T['transformers-glow'] ? 1.3 : 0,
      roughness: 0.55,
      metalness: 0.45,
    });
    const o = orbit(p.group, { radius: r * 1.5, tilt: 0.3, speed: 0.18, phase: 1.2 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.62, turn: [0, Math.PI, 0] };
  },

  marvel(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({ map: T.marvel ?? null, color: T.marvel ? '#ffffff' : u.palette.base, roughness: 1 });
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

  breakingbad(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.breakingbad ?? null,
      color: T.breakingbad ? '#ffffff' : u.palette.base,
      normalMap: T['breakingbad-normal'] ?? null,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 1,
    });
    // blue crystal moons
    const crystals = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(r * 0.07, 0),
      new THREE.MeshStandardMaterial({ color: '#8fe0ff', emissive: '#1b6f9e', emissiveIntensity: 0.9, metalness: 0.1, roughness: 0.15, flatShading: true }),
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
          const grad = g.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, '#2a7a44');
          grad.addColorStop(1, '#13492a');
          g.fillStyle = grad;
          g.fillRect(0, 0, w, h);
          g.strokeStyle = '#8fd07a';
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

  office(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.office ?? null,
      color: T.office ? '#ffffff' : u.palette.base,
      normalMap: tiled(T['paper-normal'], 4, 2),
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.92,
    });
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
    const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
    const mug = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.105, r * 0.26, 32, 1), [
      new THREE.MeshStandardMaterial({ map: label, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: '#4a2b18', roughness: 0.2 }),
      white,
    ]);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.07, r * 0.02, 10, 20, Math.PI), white);
    handle.position.x = -r * 0.115;
    handle.rotation.z = Math.PI / 2;
    mug.add(body, handle);
    const o = orbit(p.group, { radius: r * 1.5, tilt: 0.32, speed: 0.28, phase: 5 });
    o.holder.add(mug);
    p.orbits.push(o);
    p.tick.push((t) => mug.rotation.set(0.25 + Math.sin(t * 0.6) * 0.2, t * 0.5, 0.15));
  },

  rickmorty(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.rickmorty ?? null,
      color: T.rickmorty ? '#ffffff' : u.palette.base,
      emissive: '#ffffff',
      emissiveMap: T['rickmorty-glow'] ?? null,
      emissiveIntensity: T['rickmorty-glow'] ? 1 : 0,
      roughness: 1,
    });
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
    p.slot = { holder: o.holder, size: r * 0.58, turn: [0.15, Math.PI, 0] }; // its nose (the headlights) is +z: turned along the orbit
  },

  gaming(p, { u }) {
    const r = u.size;
    const P = u.palette;
    const rand = rng('gaming');
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
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(c * 0.94, c * 0.94, c * 0.94), new THREE.MeshStandardMaterial({ roughness: 0.8 }), cells.length);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    cells.forEach(([v, band], i) => {
      blocks.setMatrixAt(i, m.makeTranslation(v.x, v.y, v.z));
      blocks.setColorAt(i, col.set(greens[band]));
    });
    p.body.geometry.dispose();
    p.body.geometry = new THREE.SphereGeometry(r * 0.9, 24, 16);
    p.body.material = new THREE.MeshStandardMaterial({ color: P.dark, roughness: 1 });
    p.body.add(blocks);
    const o = orbit(p.group, { radius: r * 1.55, tilt: -0.3, speed: 0.22, phase: 2.6 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.6, turn: [0, Math.PI, 0.2] };
  },

  travel(p, { u, T }) {
    const r = u.size;
    // the oceans catch the sun (a roughness map), the cities light the night side (in airGlow)
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.earth ?? null,
      color: T.earth ? '#ffffff' : u.palette.base,
      roughnessMap: T['earth-rough'] ?? null,
      roughness: T['earth-rough'] ? 1 : 0.85,
      metalness: 0,
    });
    p.night = T['earth-night'] ?? null;
    // the clouds, drifting a little faster than the ground
    if (T['earth-clouds']) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.012, 64, 40),
        new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: T['earth-clouds'], transparent: true, depthWrite: false, roughness: 1 }),
      );
      p.group.add(clouds);
      p.tick.push((t) => (clouds.rotation.y = t * 0.075));
    }
    // a few routes from home, lifted off the surface (the travel globe's own)
    const data = globeData();
    const routes = data.arcs.filter(Boolean);
    const pick = [0, 0.2, 0.4, 0.6, 0.8].map((k) => routes[Math.floor(k * routes.length)]).filter(Boolean);
    const tubes = pick.map((pts) => {
      const steps = pts.length / 3 - 1;
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 25 }, (_, i) => {
          const k = Math.round((i / 24) * steps) * 3;
          return new THREE.Vector3(pts[k] * r * 1.01, pts[k + 1] * r * 1.01, pts[k + 2] * r * 1.01);
        }),
      );
      return new THREE.TubeGeometry(curve, 48, r * 0.01, 5, false);
    });
    if (tubes.length) {
      const arcs = new THREE.Mesh(mergeGeometries(tubes), glowMat(u.swatch));
      for (const t of tubes) t.dispose();
      p.body.add(arcs);
    }
  },

  // ── The stations ──

  // Home: a hub and a wheel, its windows warm
  home(p, { u, T }) {
    const s = u.size;
    p.body.visible = false;
    const st = new THREE.Group();
    st.rotation.set(0.35, 0, 0.12);
    const metal = new THREE.Mesh(
      parts([
        [new THREE.SphereGeometry(s * 0.42, 32, 20)],
        [new THREE.TorusGeometry(s * 0.95, s * 0.11, 16, 72), [0, 0, 0], [Math.PI / 2, 0, 0]],
        ...[0, 1, 2].map((i) => [new THREE.CylinderGeometry(s * 0.035, s * 0.035, s * 0.95, 8), [Math.cos((i * Math.PI * 2) / 3) * s * 0.5, 0, Math.sin((i * Math.PI * 2) / 3) * s * 0.5], [Math.PI / 2, 0, -(i * Math.PI * 2) / 3 + Math.PI / 2]]),
        [new THREE.CylinderGeometry(s * 0.05, s * 0.08, s * 0.7, 10), [0, s * 0.55, 0]],
      ]),
      hull(T, '#e6e2d8'),
    );
    const windows = new THREE.Mesh(new THREE.TorusGeometry(s * 0.95, s * 0.112, 4, 72, Math.PI * 2), new THREE.MeshBasicMaterial({ color: u.palette.glow, toneMapped: false, wireframe: true, transparent: true, opacity: 0.55 }));
    windows.rotation.x = Math.PI / 2;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(s * 0.06, 12, 8), glowMat(u.palette.glow));
    beacon.position.y = s * 0.92;
    st.add(metal, windows, beacon);
    p.body.parent.add(st);
    p.tick.push((t) => {
      st.rotation.y = t * 0.25;
      beacon.material.color.set(u.palette.glow).multiplyScalar(0.5 + 0.5 * (Math.sin(t * 3) > 0.6 ? 1 : 0.2));
    });
  },

  // Experience: a long station with a module for each role, and solar wings
  experience(p, { u, T }) {
    const s = u.size;
    p.body.visible = false;
    const st = new THREE.Group();
    st.rotation.set(0.25, 0.4, -0.15);
    const TINTS = ['#ffb35c', '#d9dde4', '#c9ced8', '#e4e7ec', '#cfd4dc', '#dfe3ea']; // AWS first
    const frame = new THREE.Mesh(
      parts([
        [new THREE.BoxGeometry(s * 2.2, s * 0.08, s * 0.08)],
        [new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.1, 24), [s * 1.12, 0, 0], [0, 0, Math.PI / 2]],
      ]),
      hull(T, '#cdd1d8', { repeat: 3 }),
    );
    st.add(frame);
    TINTS.forEach((tint, i) => {
      const mod = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.15, s * 0.15, s * 0.28, 20), hull(T, tint, { repeat: 1, which: i % 2 ? 'hull' : 'plates' }));
      mod.position.set(-s * 0.95 + i * s * 0.36, i % 2 ? s * 0.16 : -s * 0.16, 0);
      st.add(mod);
    });
    const pv = paint(
      (g, w, h) => {
        g.fillStyle = '#0d1b33';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#3a5f9a';
        g.lineWidth = 2;
        for (let x = 0; x <= w; x += 16) g.strokeRect(x, 0, 16, h);
        for (let y = 0; y <= h; y += 16) g.strokeRect(0, y, w, 16);
      },
      128,
      64,
    );
    const wingMat = new THREE.MeshStandardMaterial({ map: pv, metalness: 0.6, roughness: 0.3, emissive: '#0a1630' });
    for (const sz of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(s * 1.4, s * 0.01, s * 0.5), wingMat);
      wing.position.set(0, 0, sz * s * 0.55);
      st.add(wing);
    }
    const lights = new THREE.Mesh(new THREE.SphereGeometry(s * 0.035, 8, 6), glowMat(u.palette.glow));
    lights.position.set(s * 1.2, 0, 0);
    st.add(lights);
    p.body.parent.add(st);
    p.tick.push((t) => (st.rotation.y = 0.4 + t * 0.12));
    // the six companies, round it
    tileRing(
      p,
      roles.map((r) => [r.short ?? r.company, r.company === (r.short ?? r.company) ? null : r.company]),
      u.swatch,
      { radius: s * 1.65, tilt: 0.3, speed: 0.1 },
    );
  },

  // Projects: a shipyard. A dock ring with gantry arms holding a ship
  // that's half built (plated at the front, its ribs still showing at the
  // back), welders' sparks, and the featured projects round it as holograms.
  projects(p, { u, T }) {
    const s = u.size;
    p.body.visible = false;
    const st = new THREE.Group();
    st.rotation.set(0.62, 0.5, 0.08); // tipped toward you, so the ship in the ring shows
    const arms = [0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      return [new THREE.BoxGeometry(s * 0.07, s * 0.07, s * 0.62), [Math.cos(a) * s * 0.66, 0, Math.sin(a) * s * 0.66], [0, -a + Math.PI / 2, 0]];
    });
    const dock = new THREE.Mesh(
      parts([
        [new THREE.TorusGeometry(s * 0.98, s * 0.075, 14, 80), [0, 0, 0], [Math.PI / 2, 0, 0]],
        [new THREE.TorusGeometry(s * 0.98, s * 0.03, 8, 80), [0, s * 0.16, 0], [Math.PI / 2, 0, 0]],
        ...arms,
        [new THREE.CylinderGeometry(s * 0.14, s * 0.18, s * 0.42, 18), [0, -s * 0.42, 0]],
        [new THREE.BoxGeometry(s * 0.5, s * 0.08, s * 0.5), [0, -s * 0.66, 0]],
      ]),
      hull(T, '#a9b6c9', { repeat: 2, which: 'hull' }),
    );
    st.add(dock);
    // the ship on the slipway: the front plated, the back still ribs
    const ship = new THREE.Group();
    ship.rotation.y = Math.PI / 5;
    const plated = new THREE.Mesh(
      parts([
        [new THREE.ConeGeometry(s * 0.2, s * 0.55, 20), [0, 0, -s * 0.5], [-Math.PI / 2, 0, 0]],
        [new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.35, 20), [0, 0, -s * 0.05], [Math.PI / 2, 0, 0]],
        [new THREE.BoxGeometry(s * 0.95, s * 0.025, s * 0.22), [0, -s * 0.02, s * 0.05]],
      ]),
      hull(T, '#eef2f7', { repeat: 1 }),
    );
    const ribs = new THREE.Mesh(
      parts([
        ...[0.2, 0.32, 0.44].map((z) => [new THREE.TorusGeometry(s * 0.19, s * 0.012, 6, 28), [0, 0, s * z]]),
        [new THREE.BoxGeometry(s * 0.015, s * 0.015, s * 0.3), [0, s * 0.19, s * 0.32]],
        [new THREE.BoxGeometry(s * 0.015, s * 0.015, s * 0.3), [0, -s * 0.19, s * 0.32]],
      ]),
      glowMat(u.swatch, 0.75),
    );
    ship.add(plated, ribs);
    st.add(ship);
    // welders at work: a few sparks where the plating stops
    const N = 28;
    const sparkPos = new Float32Array(N * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: '#ffd9a0', size: s * 0.05, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ship.add(sparks);
    const rand = rng('sparks');
    const torch = new THREE.Mesh(new THREE.SphereGeometry(s * 0.04, 10, 8), glowMat('#cfe8ff'));
    torch.position.set(s * 0.18, s * 0.05, s * 0.13);
    ship.add(torch);
    p.body.parent.add(st);
    p.tick.push((t) => {
      st.rotation.y = 0.5 + t * 0.1;
      const on = Math.sin(t * 19) + Math.sin(t * 6.1) > 0.2;
      torch.visible = on;
      sparks.visible = on;
      if (on) {
        for (let i = 0; i < N; i++) {
          const k = rand();
          sparkPos.set([s * 0.18 + (rand() - 0.5) * s * 0.25 * k, s * 0.05 - k * s * 0.22, s * 0.13 + (rand() - 0.5) * s * 0.25 * k], i * 3);
        }
        sparkGeo.attributes.position.needsUpdate = true;
      }
    });
    // what's been built here
    tileRing(
      p,
      featuredProjects.slice(0, 4).map((pr) => [pr.title, pr.subtitle]),
      u.swatch,
      { radius: s * 1.75, tilt: 0.22, speed: 0.09 },
    );
  },

  // The Résumé: a floating page, lit
  resume(p, { u, T }) {
    const s = u.size;
    p.body.visible = false;
    const st = new THREE.Group();
    const page = paint(
      (g, w, h) => {
        g.fillStyle = '#f7f5fb';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#2a2540';
        g.font = '700 26px ui-sans-serif, system-ui, sans-serif';
        g.fillText('Tilak Patel', 24, 46);
        g.fillStyle = '#7f6fd1';
        g.fillRect(24, 60, w - 48, 3);
        const rand = rng('resume');
        let y = 92;
        for (let b = 0; b < 5; b++) {
          g.fillStyle = '#3d3657';
          g.fillRect(24, y, 90 + rand() * 60, 9);
          y += 20;
          for (let l = 0; l < 3 + Math.floor(rand() * 2); l++) {
            g.fillStyle = '#b9b3cc';
            g.fillRect(34, y, (w - 80) * (0.55 + rand() * 0.45), 5);
            y += 12;
          }
          y += 10;
        }
      },
      256,
      340,
    );
    const slab = new THREE.Mesh(new THREE.BoxGeometry(s * 1.0, s * 1.32, s * 0.04), [
      hull(T, '#c7c3d6', { repeat: 1 }),
      hull(T, '#c7c3d6', { repeat: 1 }),
      hull(T, '#c7c3d6', { repeat: 1 }),
      hull(T, '#c7c3d6', { repeat: 1 }),
      new THREE.MeshStandardMaterial({ map: page, emissive: '#ffffff', emissiveMap: page, emissiveIntensity: 0.35, roughness: 0.6 }),
      hull(T, '#c7c3d6', { repeat: 1 }),
    ]);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(s * 0.95, s * 0.012, 6, 64), glowMat(u.palette.glow, 0.8));
    halo.rotation.x = Math.PI / 2.4;
    st.add(slab, halo);
    p.body.parent.add(st);
    p.tick.push((t) => {
      slab.rotation.y = Math.sin(t * 0.4) * 0.7;
      slab.position.y = Math.sin(t * 1.1) * s * 0.06;
      halo.rotation.z = t * 0.5;
    });
  },

  // Contact: a relay dish on a mast, sending
  contact(p, { u, T }) {
    const s = u.size;
    p.body.visible = false;
    const st = new THREE.Group();
    st.rotation.set(0.2, 0, -0.1);
    const dishProfile = Array.from({ length: 12 }, (_, i) => {
      const x = (i / 11) * s * 0.75;
      return new THREE.Vector2(x, (x * x) / (s * 1.4));
    });
    const dish = new THREE.Mesh(new THREE.LatheGeometry(dishProfile, 40), new THREE.MeshStandardMaterial({ color: '#e6e8ee', metalness: 0.3, roughness: 0.45, side: THREE.DoubleSide }));
    dish.rotation.x = -0.9;
    dish.position.y = s * 0.45;
    const mast = new THREE.Mesh(
      parts([
        [new THREE.CylinderGeometry(s * 0.06, s * 0.1, s * 0.9, 12)],
        [new THREE.BoxGeometry(s * 0.5, s * 0.12, s * 0.5), [0, -s * 0.45, 0]],
        [new THREE.CylinderGeometry(s * 0.012, s * 0.012, s * 0.42, 6), [0, s * 0.72, s * 0.2], [0.9, 0, 0]],
      ]),
      hull(T, '#b8bdc8', { repeat: 1 }),
    );
    const feed = new THREE.Mesh(new THREE.SphereGeometry(s * 0.05, 10, 8), glowMat(u.palette.glow));
    feed.position.set(0, s * 0.87, s * 0.37);
    // the message going out: a ring that grows and fades
    const wave = new THREE.Mesh(new THREE.TorusGeometry(s * 0.3, s * 0.01, 6, 48), glowMat(u.palette.glow, 0.8));
    wave.position.copy(feed.position);
    wave.rotation.x = -0.9 + Math.PI / 2;
    st.add(dish, mast, feed, wave);
    p.body.parent.add(st);
    p.tick.push((t) => {
      const k = (t * 0.6) % 1;
      wave.scale.setScalar(0.4 + k * 2.2);
      wave.material.opacity = 0.8 * (1 - k);
      wave.position.set(0, s * 0.87 + k * s * 0.5, s * 0.37 + k * s * 0.4);
      st.rotation.y = t * 0.2;
    });
  },

  // The Terminal: a dark monolith with a prompt on its face
  terminal(p, { u, T }) {
    const s = u.size;
    p.body.visible = false;
    const st = new THREE.Group();
    const screen = (cursor) =>
      paint(
        (g, w, h) => {
          g.fillStyle = '#05080a';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#7dff9a';
          g.font = '600 18px ui-monospace, Menlo, monospace';
          const lines = ['$ whoami', 'tilak', '$ ls ~/universe', 'experience  projects', 'resume  contact', '$ ' + (cursor ? '█' : '')];
          lines.forEach((l, i) => g.fillText(l, 16, 34 + i * 26));
          g.fillStyle = 'rgba(125,255,154,0.06)';
          for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
        },
        256,
        200,
      );
    const on = screen(true);
    const off = screen(false);
    const face = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: on, emissiveIntensity: 1.1, roughness: 0.3 });
    const body = hull(T, '#3a404a', { repeat: 1, which: 'hull', metal: 0.5 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(s * 1.15, s * 0.92, s * 0.12), [body, body, body, body, face, body]);
    const stand = new THREE.Mesh(
      parts([
        [new THREE.BoxGeometry(s * 0.12, s * 0.5, s * 0.08), [0, -s * 0.66, 0]],
        [new THREE.BoxGeometry(s * 0.6, s * 0.06, s * 0.3), [0, -s * 0.92, 0]],
        [new THREE.CylinderGeometry(s * 0.01, s * 0.01, s * 0.4, 6), [s * 0.45, s * 0.66, 0]],
      ]),
      body,
    );
    st.add(slab, stand);
    p.body.parent.add(st);
    p.tick.push((t) => {
      face.emissiveMap = Math.floor(t * 1.6) % 2 ? off : on;
      st.rotation.y = Math.sin(t * 0.3) * 0.8;
    });
  },
};

export function buildPlanet(u, T = {}) {
  const core = u.kind === 'core';
  const seg = [64, 40];
  const group = new THREE.Group();
  const spinner = new THREE.Group(); // what turns about the planet's axis
  group.add(spinner);
  const body = new THREE.Mesh(new THREE.SphereGeometry(u.size, seg[0], seg[1]), new THREE.MeshStandardMaterial({ color: u.palette.base, roughness: 1 }));
  spinner.add(body);
  // a planet has air round it in its colour; a station's sign does that job
  const air = core ? null : halo(u.size, u.rim ?? u.swatch, seg);
  if (air) group.add(air);
  const p = { group, body, orbits: [], tick: [], focus: [], slot: null, onSelect: null };
  BUILDERS[u.id]?.(p, { u, T });
  if (!core && p.body.material?.isMeshStandardMaterial) airGlow(p.body.material, u.rim ?? u.swatch, { night: p.night });
  // a station's big sign, over it
  const sign = u.sign ? bigSign(u) : null;
  if (sign) {
    group.add(sign);
    p.tick.push(facing(sign));
  }
  const spin = core ? 0 : 0.05 + rng(`${u.id}-spin`)() * 0.05;
  const turn0 = body.rotation.y;
  let selected = false;
  let t0 = 0;

  return {
    id: u.id,
    radius: u.size,
    group,
    sign,
    // the sign brightens and grows a little under the pointer
    setSignHover(on) {
      if (!sign) return;
      sign.scale.setScalar(on ? 1.08 : 1);
      sign.material.color.setScalar(on ? 1.35 : 1);
    },
    update(t, camera) {
      t0 = t;
      body.rotation.y = turn0 + t * spin;
      for (const o of p.orbits) o.set(t);
      for (const fn of p.tick) fn(t, camera);
    },
    // `dim`: somewhere else is picked, so this station's sign steps back
    setState({ hover, selected: sel, dim = false }) {
      const k = hover ? RIM.hover : sel ? RIM.selected : RIM.idle;
      if (air) air.material.uniforms.uStrength.value = k;
      const glow = body.material?.userData?.air;
      if (glow) glow.uRimStrength.value = k * 0.8;
      if (sel && !selected) p.onSelect?.(t0);
      if (sel !== selected) for (const fn of p.focus) fn(sel);
      selected = sel;
      if (sign) sign.material.opacity = dim && !hover ? 0.28 : 1;
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

// The sun in the middle of the map: its surface, and a glow round it
export function buildSun(T = {}) {
  const group = new THREE.Group();
  group.position.set(...SUN.at);
  const surface = new THREE.Mesh(new THREE.SphereGeometry(SUN.r, 64, 40), new THREE.MeshBasicMaterial({ map: T.sun ?? null, color: T.sun ? '#ffffff' : '#ffb347', toneMapped: false }));
  const glow = paint(
    (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(255,214,140,0.9)');
      grad.addColorStop(0.22, 'rgba(255,170,70,0.45)');
      grad.addColorStop(0.5, 'rgba(255,120,40,0.12)');
      grad.addColorStop(1, 'rgba(255,100,30,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    },
    256,
    256,
  );
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  corona.scale.setScalar(SUN.r * 5.5);
  // and a wide, faint one, the light spilling out into space
  const spill = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.32 }));
  spill.scale.setScalar(SUN.r * 13);
  group.add(spill, surface, corona);
  return {
    group,
    update(t) {
      surface.rotation.y = t * 0.03;
      corona.material.rotation = t * 0.02;
      corona.scale.setScalar(SUN.r * (5.5 + Math.sin(t * 0.7) * 0.15)); // it breathes
    },
  };
}

// One model, or null if it doesn't load.
export function loadModel(url) {
  return new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(url)
    .then((g) => g.scene)
    .catch(() => null);
}

const MODELS = {
  music: '/models/universe/music.glb',
  transformers: '/models/universe/transformers.glb',
  marvel: '/models/universe/marvel.glb',
  breakingbad: '/models/universe/breakingbad.glb',
  rickmorty: '/games/meshy/saucer.glb', // the classic cruiser, as on the C-137 page
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
