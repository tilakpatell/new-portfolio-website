// What a duel looks like aboard: the lightsabers (a hilt in the fist, a
// white-hot core in a coloured glow, red for Vader’s, blue for Obi-Wan’s,
// green for Luke’s on the second station, humming with a soft flicker),
// the ribbon a swung blade leaves for a moment, the sparks and flash where
// two blades meet or a blade turns a bolt, the Emperor’s lightning
// (branching blue-white arcs from his hands to whoever he burns, drawn
// anew a few times a second so it crawls), the ripple a Force push sends
// through the air and the faint one at a gripped throat. The colours are
// light over white, so the bloom takes them; on a tier with no bloom the
// glows are still drawn round each blade and arc, so nothing goes flat.
//
// Everything is made here at the start and pooled (four draws at most
// however hard the fight: the hilts, the cores, the trails, and every glow,
// arc, spark, flash and ripple as one set of sprites), and its shaders can
// be compiled before the first stroke (`warm`), so nothing is allocated or
// compiled mid-duel. No light is added to the scene, since a new light
// rebuilds every lit shader: `lamps()` hands back what the blades, the
// lightning and the last clash would light, in the stream’s lamp form, for
// whoever owns the lamps to light them.
//
// A blade follows the hand it is attached to: up out of the fist along the
// hand’s own `axis` (+y unless given), or along a way it is aimed (`aim`),
// which `swing` works out from the rules’ fighter: up and forward at rest,
// across the body behind a guard, round through a stroke so its blow lands
// as the rules’ does. Call the handle’s update once a frame, or leave it to
// the sabers’ update, which steps every blade not stepped since.
//
//   SEG: 7 floats an arc’s segment takes: its two ends, and its weight (1 the main arc, less a branch)
//   POOLS → { high, mid, low }: how many blades, trail samples, sparks, flashes and ripples a tier keeps,
//     and how finely its lightning is cut (ultra takes high’s)
//   bladeHues(colour) → { core: [r, g, b], glow: [r, g, b], light: 0xrrggbb }
//     colour: 'red' | 'green' | 'blue', or a number as the cast gives it (0xff2a1f)
//   hum(t, seed) → about 1   a blade’s brightness t seconds on: a soft flicker, out of step between seeds
//   swing(fighter, ahead = 0, out?) → { x, y, z }   pure: the way a rules fighter’s blade points
//     (rules/saber.js), its stroke carried on `ahead` seconds past the last step
//   trailLevel(age, speed) → 0…1   how bright a trail is `age` seconds behind a tip moving at `speed` m/s
//   arcPath(from, to, rand, { depth, branches, jag }, out, at = 0) → segments written
//     pure: a seeded lightning arc from `from` to `to` cut into 2^depth pieces, wandering up to `jag`
//     of its length, with `branches` fainter forks off its bends, written into the Float32Array `out`
//     from segment `at` and never past its end
//   createSabers(scene, { tier }) → sabers
//     sabers.blade(id, colour) → handle   the same handle for the same id; a full pool lends out the
//       blade longest kept, put away first
//       handle.attach(hand, axis?)   hand: an Object3D (null lets go, and the blade isn’t drawn)
//       handle.aim(dir | null)   a world way for the blade, until aim(null) gives it back to the hand
//       handle.on(lit)   ignites it, or puts it away;  handle.update(dt);  handle.release()
//       handle.along(k, out) → out   the point k of the way from the emitter to the lit tip
//     sabers.clash(at, kind = 'block')   kind: resolveClash’s 'block' | 'parry' | 'break' | 'hit'
//     sabers.deflect(at, dir)   a bolt turned by a blade, thrown back along `dir`
//     sabers.lightning(from, to, on = true)   from: a hand’s point or the hands’; call each frame it burns
//     sabers.push(at, dir)   sabers.choke(throat, on = true)
//     sabers.update(dt)   once a frame;  sabers.lamps() → [{ x, y, z, color, intensity, distance }] lit now
//     sabers.warm(renderer, camera, target?) → Promise   compiles every shader the sabers use
//     sabers.live() → { blades, trails, sparks, flashes, arcs, ripples }   how many are showing
//     sabers.meshes;  sabers.dispose()

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../../../../lib/seeded';
import { precompile } from '../../../../lib/three/renderer';
import { STROKES } from '../rules/saber';
import { createSlots } from './fx';

export const SEG = 7;
const MOST = 6; // the finest an arc is ever cut: 64 pieces
const HANDS = 2; // the Emperor throws it from both
const GRAVITY = 9.8;

// metres: the blade’s length and the radii of its core and two glows; s: how long it takes to light and to go out
const BLADE = { length: 0.95, core: 0.013, inner: 0.045, outer: 0.15, on: 0.16, off: 0.22 };
const HILT = { emitter: 0.17 }; // how far up the hilt from the fist the blade leaves it
const NAMED = { red: 0xff2a1f, green: 0x46ff3c, blue: 0x3f8cff }; // the cast’s red and blue, and Luke’s green
const GLOW = 2.6; // the glow’s brightest channel, as light
const CORE = 4.2; // the core’s, every channel near it: white-hot
// life: s a trail lasts; slow…fast: m/s of the tip between no trail and a full one; jump: metres between
// two frames that are a blade put somewhere new, not swung
const TRAIL = { life: 0.14, slow: 3, fast: 12, jump: 2, bright: 0.9 };
// rate: times a second it is drawn anew; reach: metres its end wanders over the body it burns
const ARC = { rate: 8, jag: 0.22, reach: 0.25, fade: 0.15, core: [2.2, 2.7, 4.2], glow: [0.32, 0.45, 1.5], r: 0.012, halo: 0.07, light: 0xa4bcff };
const HOT = [4, 3.2, 2.2]; // a spark as it leaves the blades
const COOL = [1.4, 0.35, 0.06]; // and as it dies
const FLASH = [4, 3.7, 3.3];
const BOLT_FLASH = [3.2, 0.9, 0.5];
// sparks thrown, the flash’s size in metres, and the light it gives
const CLASHES = {
  block: { sparks: 14, flash: 0.3, lamp: 22 },
  parry: { sparks: 26, flash: 0.45, lamp: 36 }, // timing beats strength, and rings brightest
  break: { sparks: 32, flash: 0.5, lamp: 40 },
  hit: { sparks: 6, flash: 0.16, lamp: 10 },
};
const GLARE = { life: 0.14, colour: 0xfff0dc, distance: 6 };
// a push: rings sent along it; a choke: one at the throat every `every` s, tightening
const RIPPLE = { colour: [0.2, 0.24, 0.32], push: { rings: 3, gap: 0.07, life: 0.5, speed: 6, from: 0.25, to: 1.4, band: 0.22 }, choke: { every: 0.35, life: 0.6, from: 0.17, to: 0.07, band: 0.35 } };
const LAMP = { blade: 7, bladeReach: 4.5, arc: 40, arcReach: 10 };

export const POOLS = Object.freeze({
  high: Object.freeze({ blades: 4, trail: 16, sparks: 160, flashes: 8, ripples: 16, depth: 5, branches: 5 }),
  mid: Object.freeze({ blades: 4, trail: 12, sparks: 96, flashes: 6, ripples: 12, depth: 4, branches: 4 }),
  low: Object.freeze({ blades: 4, trail: 8, sparks: 48, flashes: 4, ripples: 8, depth: 3, branches: 2 }),
});

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const reach = (k) => k * (2 - k); // a blade shoots out and slows as it reaches full length

export function bladeHues(colour) {
  const hex = typeof colour === 'number' ? colour : (NAMED[colour] ?? NAMED.blue);
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const most = Math.max(...c) || 1;
  const n = c.map((v) => v / most);
  // the glow saturated (the colour as light), the core near white with a tint of it
  return { core: n.map((v) => CORE * (0.68 + 0.32 * v)), glow: n.map((v) => GLOW * v ** 2.2), light: hex };
}

export function hum(t, seed = 0) {
  return 1 + 0.035 * Math.sin(t * 41 + seed * 1.7) + 0.025 * Math.sin(t * 67.3 + seed * 3.1) + 0.015 * Math.sin(t * 113.9 + seed * 5.3);
}

// ── where a fighter’s blade points: [right, up, forward] in its own frame ──

const REST = [0.3, 0.55, 0.78];
const GUARDED = [-0.78, 0.45, 0.42]; // across the body, point high to the left
const REELING = [0.6, -0.25, 0.75]; // knocked out wide and low
// a stroke winds up to `wind` (by WIND of the way to its blow), cuts through `blow` as the rules’ blow
// lands, follows through to `follow` (by FOLLOW of the time after) and comes back to rest by its end
const SWINGS = {
  light: { wind: [0.55, 0.8, -0.25], blow: [-0.1, -0.05, 1], follow: [-0.7, -0.45, 0.55] },
  heavy: { wind: [0.05, 0.75, -0.65], blow: [0, -0.1, 1], follow: [0.15, -0.8, 0.55] },
};
const WIND = 0.75;
const FOLLOW = 0.45;

function between(a, b, e, out) {
  out[0] = a[0] + (b[0] - a[0]) * e;
  out[1] = a[1] + (b[1] - a[1]) * e;
  out[2] = a[2] + (b[2] - a[2]) * e;
  return out;
}

const _way = [0, 0, 0];

export function swing(f, ahead = 0, out = { x: 0, y: 0, z: 0 }) {
  let way = REST;
  const s = f.stroke;
  if (s && STROKES[s.kind]) {
    const k = STROKES[s.kind];
    const sw = SWINGS[s.kind];
    const t = clamp(s.t + Math.max(0, ahead), 0, k.s);
    const wound = k.at * WIND;
    const followed = k.at + (k.s - k.at) * FOLLOW;
    if (t < wound) way = between(REST, sw.wind, smooth(0, wound, t), _way);
    else if (t < k.at) way = between(sw.wind, sw.blow, smooth(wound, k.at, t), _way);
    else if (t < followed) way = between(sw.blow, sw.follow, smooth(k.at, followed, t), _way);
    else way = between(sw.follow, REST, smooth(followed, k.s, t), _way);
  } else if (f.guard) way = GUARDED;
  else if (f.stagger > 0) way = REELING;
  const [r, u, fw] = way;
  const yaw = f.yaw || 0;
  // yaw 0 looks along −z and turning towards +x is positive: right is (cos, 0, sin), forward (sin, 0, −cos)
  const x = r * Math.cos(yaw) + fw * Math.sin(yaw);
  const z = r * Math.sin(yaw) - fw * Math.cos(yaw);
  const l = Math.hypot(x, u, z) || 1;
  out.x = x / l;
  out.y = u / l;
  out.z = z / l;
  return out;
}

export function trailLevel(age, speed) {
  if (!(age >= 0 && age < TRAIL.life)) return 0;
  const k = 1 - age / TRAIL.life;
  return smooth(TRAIL.slow, TRAIL.fast, speed) * k * k;
}

// ── lightning ──

const _main = new Float64Array((2 ** MOST + 1) * 3);
const _fork = new Float64Array((2 ** MOST + 1) * 3);

// two unit ways square to the unit way d, and to each other, into u and v
function across(d, u, v) {
  // u = d × whichever of x and y lies least along d
  if (Math.abs(d[0]) < 0.9) {
    u[0] = 0;
    u[1] = d[2];
    u[2] = -d[1];
  } else {
    u[0] = -d[2];
    u[1] = 0;
    u[2] = d[0];
  }
  const lu = Math.hypot(u[0], u[1], u[2]) || 1;
  for (let i = 0; i < 3; i++) u[i] /= lu;
  v[0] = d[1] * u[2] - d[2] * u[1];
  v[1] = d[2] * u[0] - d[0] * u[2];
  v[2] = d[0] * u[1] - d[1] * u[0];
}

const _d = [0, 0, 0];
const _u = [0, 0, 0];
const _w = [0, 0, 0];
const _md = [0, 0, 0]; // the main arc’s line, kept while its forks are bent
const _mu = [0, 0, 0];
const _mw = [0, 0, 0];

// Cut the line from a to b into 2^depth pieces, each bend pushed off it
// square to the line by up to `jag` of the piece it splits, coarse bends
// first: so it never strays more than twice `jag` of its length.
function bend(pts, ax, ay, az, bx, by, bz, depth, jag, rand) {
  const n = 2 ** depth;
  pts[0] = ax;
  pts[1] = ay;
  pts[2] = az;
  pts[n * 3] = bx;
  pts[n * 3 + 1] = by;
  pts[n * 3 + 2] = bz;
  const length = Math.hypot(bx - ax, by - ay, bz - az);
  _d[0] = (bx - ax) / (length || 1);
  _d[1] = (by - ay) / (length || 1);
  _d[2] = (bz - az) / (length || 1);
  across(_d, _u, _w);
  for (let step = n; step > 1; step >>= 1) {
    const half = step >> 1;
    const most = (jag * length * step) / n;
    for (let i = 0; i < n; i += step) {
      const m = (i + half) * 3;
      const off = most * rand();
      const turn = rand() * Math.PI * 2;
      const cu = Math.cos(turn) * off;
      const cv = Math.sin(turn) * off;
      for (let k = 0; k < 3; k++) pts[m + k] = (pts[i * 3 + k] + pts[(i + step) * 3 + k]) / 2 + _u[k] * cu + _w[k] * cv;
    }
  }
  return n;
}

function put(out, s, pts, i, w) {
  const j = s * SEG;
  for (let k = 0; k < 6; k++) out[j + k] = pts[i * 3 + k];
  out[j + 6] = w;
}

export function arcPath(from, to, rand, { depth = 4, branches = 3, jag = 0.2 } = {}, out, at = 0) {
  const cap = Math.floor(out.length / SEG);
  const d = clamp(Math.round(depth), 1, MOST);
  const n = bend(_main, from.x, from.y, from.z, to.x, to.y, to.z, d, jag, rand);
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  let written = 0;
  for (let i = 0; i < n; i++) {
    if (at + written >= cap) return written;
    put(out, at + written++, _main, i, 1);
  }
  // each fork leaves from a bend (never an end), on towards the target and out to one side
  for (let k = 0; k < 3; k++) {
    _md[k] = _d[k];
    _mu[k] = _u[k];
    _mw[k] = _w[k];
  }
  const fd = Math.max(1, d - 2);
  for (let b = 0; b < branches; b++) {
    const i = (1 + Math.floor(rand() * (n - 1))) * 3;
    const turn = rand() * Math.PI * 2;
    const side = 0.6 + 0.6 * rand();
    const long = length * (0.18 + 0.22 * rand());
    const c = Math.cos(turn) * side;
    const sn = Math.sin(turn) * side;
    const ex = _md[0] + _mu[0] * c + _mw[0] * sn;
    const ey = _md[1] + _mu[1] * c + _mw[1] * sn;
    const ez = _md[2] + _mu[2] * c + _mw[2] * sn;
    const l = (Math.hypot(ex, ey, ez) || 1) / long;
    const m = bend(_fork, _main[i], _main[i + 1], _main[i + 2], _main[i] + ex / l, _main[i + 1] + ey / l, _main[i + 2] + ez / l, fd, jag * 1.4, rand);
    for (let k = 0; k < m; k++) {
      if (at + written >= cap) return written;
      put(out, at + written++, _fork, k, 0.5);
    }
  }
  return written;
}

// ── the shaders ──

// A sprite: a quad facing the eye, drawn out along a way (a blade, an
// arc’s piece) by as much of it as is seen across the view, so a blade
// pointed at you is a round glow. A soft glow, or with a band (aSize.z) a
// thin bright ring at its edge, as a ripple in the air catches the light.
const SPRITE_VERT = /* glsl */ `
attribute vec3 aAt;
attribute vec3 aDir;
attribute vec3 aSize;
attribute vec3 aColour;
varying vec2 vP;
varying float vCore;
varying float vHalf;
varying float vBand;
varying vec3 vColour;
void main() {
  vec4 c = viewMatrix * vec4(aAt, 1.0);
  vec2 axis = (viewMatrix * vec4(aDir, 0.0)).xy;
  float seen = length(axis);
  axis = seen > 1e-4 ? axis / seen : vec2(1.0, 0.0);
  vec2 side = vec2(-axis.y, axis.x);
  float core = aSize.x * seen;
  vec2 p = vec2(position.x * (core + aSize.y), position.y * aSize.y);
  c.xy += axis * p.x + side * p.y;
  gl_Position = projectionMatrix * c;
  vP = p;
  vCore = core;
  vHalf = aSize.y;
  vBand = aSize.z;
  vColour = aColour;
}`;
const SPRITE_FRAG = /* glsl */ `
varying vec2 vP;
varying float vCore;
varying float vHalf;
varying float vBand;
varying vec3 vColour;
void main() {
  vec2 q = vec2(max(abs(vP.x) - vCore, 0.0), vP.y);
  float r = length(q) / vHalf;
  if (r >= 1.0) discard;
  float glow = exp(-r * r * 5.0) * (1.0 - r);
  float w = max(vBand, 1e-3);
  float x = (r - 1.0 + w) / (0.5 * w);
  float ring = exp(-x * x);
  gl_FragColor = vec4(vColour * mix(glow, ring, step(1e-4, vBand)), 1.0);
  #include <colorspace_fragment>
}`;

// A trail: the ribbon between where a blade was and where it is, brightest
// along the tip’s path and fading to nothing at the hilt’s.
const TRAIL_VERT = /* glsl */ `
attribute vec3 aColour;
attribute float aEdge;
varying vec3 vColour;
varying float vEdge;
void main() {
  vColour = aColour;
  vEdge = aEdge;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const TRAIL_FRAG = /* glsl */ `
varying vec3 vColour;
varying float vEdge;
void main() {
  gl_FragColor = vec4(vColour * vEdge * vEdge, 1.0);
  #include <colorspace_fragment>
}`;

// ── the parts ──

// A hilt along +y, the fist round y = 0: a pommel, the black grip, the
// steel body, the flared emitter whose mouth is HILT.emitter up.
function buildHilt() {
  // [top radius, bottom radius, length, middle y, colour]
  const parts = [
    [0.017, 0.017, 0.03, -0.085, 0x8e949c],
    [0.0155, 0.0155, 0.12, -0.01, 0x121315],
    [0.018, 0.018, 0.08, 0.09, 0x9aa0a8],
    [0.022, 0.019, 0.05, HILT.emitter - 0.025, 0xb4bac2],
  ];
  const c = new THREE.Color();
  const geos = parts.map(([top, bottom, long, y, hex]) => {
    const g = new THREE.CylinderGeometry(top, bottom, long, 12).translate(0, y, 0);
    c.setHex(hex);
    const n = g.attributes.position.count;
    const colours = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(colours, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return g;
  });
  const hilt = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return hilt;
}

const quadGeo = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.instanceCount = 0;
  return g;
};
const perInstance = (geo, name, n, size) => {
  const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size);
  a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute(name, a);
  return a;
};
const put3 = (arr, i, x, y, z) => {
  arr[i * 3] = x;
  arr[i * 3 + 1] = y;
  arr[i * 3 + 2] = z;
};

export function createSabers(scene, { tier = 'high' } = {}) {
  const N = POOLS[tier] ?? POOLS.high;
  const rand = seeded(0x5abe7);
  const group = new THREE.Group();
  group.name = 'sabers';

  // ── the hilts and the cores, one instance a blade ──
  const hiltGeo = buildHilt();
  const hiltMat = new THREE.MeshStandardMaterial({ name: 'ds-hilt', vertexColors: true, metalness: 0.85, roughness: 0.32 });
  const hilts = new THREE.InstancedMesh(hiltGeo, hiltMat, N.blades);
  hilts.name = 'saber-hilts';
  // (a unit-long capsule up from its foot, stretched to the lit length)
  const coreGeo = new THREE.CapsuleGeometry(BLADE.core, 1, 3, 8).translate(0, 0.5, 0);
  const coreMat = new THREE.MeshBasicMaterial({ name: 'ds-blade', color: 0xffffff, toneMapped: false });
  const cores = new THREE.InstancedMesh(coreGeo, coreMat, N.blades);
  cores.name = 'saber-cores';
  cores.setColorAt(0, new THREE.Color());
  for (const m of [hilts, cores]) {
    m.count = 0;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  // ── the trails: a ribbon of quads between a blade’s last few places ──
  const quadCap = N.blades * (N.trail - 1);
  const trailGeo = new THREE.BufferGeometry();
  const tPos = new THREE.BufferAttribute(new Float32Array(quadCap * 12), 3).setUsage(THREE.DynamicDrawUsage);
  const tColour = new THREE.BufferAttribute(new Float32Array(quadCap * 12), 3).setUsage(THREE.DynamicDrawUsage);
  const edge = new Float32Array(quadCap * 4);
  const index = [];
  for (let q = 0; q < quadCap; q++) {
    // each quad: the older hilt end, its tip, the newer tip, the newer hilt end
    edge.set([0, 1, 1, 0], q * 4);
    index.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
  }
  trailGeo.setAttribute('position', tPos);
  trailGeo.setAttribute('aColour', tColour);
  trailGeo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  trailGeo.setIndex(index);
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.ShaderMaterial({ name: 'ds-trail', vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  const trails = new THREE.Mesh(trailGeo, trailMat);
  trails.name = 'saber-trails';
  trails.frustumCulled = false;
  trails.renderOrder = 4;

  // ── the sprites: the blades’ glows, the arcs, sparks, flashes and ripples ──
  const arcCap = HANDS * (2 ** N.depth + N.branches * 2 ** Math.max(1, N.depth - 2));
  const spriteCap = N.blades * 2 + arcCap * 2 + N.sparks + N.flashes + N.ripples;
  const spriteGeo = quadGeo();
  const sAt = perInstance(spriteGeo, 'aAt', spriteCap, 3);
  const sDir = perInstance(spriteGeo, 'aDir', spriteCap, 3);
  const sSize = perInstance(spriteGeo, 'aSize', spriteCap, 3);
  const sColour = perInstance(spriteGeo, 'aColour', spriteCap, 3);
  const spriteMat = new THREE.ShaderMaterial({ name: 'ds-saber-glow', vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const sprites = new THREE.Mesh(spriteGeo, spriteMat);
  sprites.name = 'saber-sprites';
  sprites.frustumCulled = false;
  sprites.renderOrder = 5;

  group.add(hilts, cores, trails, sprites);
  scene.add(group);
  const meshes = [hilts, cores, trails, sprites];

  // ── state, in flat arrays and objects made now, so a duel makes no garbage ──
  const records = new Map(); // id → a blade
  const slots = new Array(N.blades).fill(null);
  let born = 0;
  let clock = 0;
  const sparkSlots = createSlots(N.sparks);
  const sparks = { p: new Float32Array(N.sparks * 3), v: new Float32Array(N.sparks * 3), t: new Float32Array(N.sparks), life: new Float32Array(N.sparks) };
  const flashSlots = createSlots(N.flashes);
  const flashes = { p: new Float32Array(N.flashes * 3), t: new Float32Array(N.flashes), life: new Float32Array(N.flashes), size: new Float32Array(N.flashes), colour: new Float32Array(N.flashes * 3) };
  const rippleSlots = createSlots(N.ripples);
  // per ripple: where, its drift, radius from and to, its band, age, life, delay, and whether it keeps to the throat
  const ripples = { p: new Float32Array(N.ripples * 3), v: new Float32Array(N.ripples * 3), from: new Float32Array(N.ripples), to: new Float32Array(N.ripples), band: new Float32Array(N.ripples), t: new Float32Array(N.ripples), life: new Float32Array(N.ripples), delay: new Float32Array(N.ripples), throat: new Uint8Array(N.ripples) };
  const bolt = { on: false, hands: 0, from: new Float64Array(HANDS * 3), to: new Float64Array(3), level: 0, wait: 0, since: 0, n: 0, segs: new Float32Array(arcCap * SEG) };
  const grip = { on: false, at: new THREE.Vector3(), wait: 0 };
  const glare = { at: new THREE.Vector3(), t: 0, life: GLARE.life, peak: 0, colour: GLARE.colour };
  const glareLamp = { x: 0, y: 0, z: 0, color: GLARE.colour, intensity: 0, distance: GLARE.distance };
  const arcLamp = { x: 0, y: 0, z: 0, color: ARC.light, intensity: 0, distance: LAMP.arcReach };
  const lit = [];

  const _v = new THREE.Vector3();
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _m = new THREE.Matrix4();
  const _s = new THREE.Vector3();
  const _c = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);
  const _end = { x: 0, y: 0, z: 0 };
  const _hand = { x: 0, y: 0, z: 0 };

  // ── the blades ──

  function makeBlade(id, colour, slot) {
    const r = {
      id,
      slot,
      colour,
      hue: bladeHues(colour),
      seed: slot * 1.37 + 0.5,
      born: born++,
      hand: null,
      axis: new THREE.Vector3(0, 1, 0),
      aimed: false,
      aim: new THREE.Vector3(),
      lit: false,
      k: 0,
      placed: false,
      ticked: false,
      dead: false,
      grip: new THREE.Vector3(),
      base: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 1, 0),
      lamp: { x: 0, y: 0, z: 0, color: 0, intensity: 0, distance: LAMP.bladeReach },
      // the trail’s samples, a ring: the hilt’s end, the tip, when, and how lit
      trail: { base: new Float32Array(N.trail * 3), tip: new Float32Array(N.trail * 3), t: new Float64Array(N.trail), k: new Float32Array(N.trail), n: 0, head: 0 },
    };
    r.lamp.color = r.hue.light;
    r.handle = {
      attach(hand, axis) {
        if (r.dead) return r.handle;
        r.hand = hand ?? null;
        if (axis) r.axis.set(axis.x, axis.y, axis.z).normalize();
        r.trail.n = 0;
        return r.handle;
      },
      aim(dir) {
        r.aimed = !!dir && Math.hypot(dir.x, dir.y, dir.z) > 1e-9;
        if (r.aimed) r.aim.set(dir.x, dir.y, dir.z).normalize();
        return r.handle;
      },
      on(lit) {
        r.lit = !!lit;
        return r.handle;
      },
      update(dt) {
        if (r.dead) return;
        tick(r, dt);
        r.ticked = true;
      },
      along(k, out) {
        return out.copy(r.dir).multiplyScalar(BLADE.length * reach(r.k) * k).add(r.base);
      },
      release() {
        if (r.dead) return;
        r.dead = true;
        slots[r.slot] = null;
        records.delete(r.id);
      },
    };
    return r;
  }

  // the blade’s place this frame, from its hand, and a sample of it for the trail
  function tick(r, dt) {
    const step = Math.max(0, dt || 0);
    r.k = clamp(r.k + (r.lit ? step / BLADE.on : -step / BLADE.off), 0, 1);
    r.placed = !!r.hand;
    if (!r.placed) {
      r.trail.n = 0;
      return;
    }
    r.hand.getWorldPosition(r.grip);
    if (r.aimed) r.dir.copy(r.aim);
    else r.dir.copy(r.axis).applyQuaternion(r.hand.getWorldQuaternion(_q)).normalize();
    r.base.copy(r.grip).addScaledVector(r.dir, HILT.emitter);
    const tip = _v.copy(r.dir).multiplyScalar(BLADE.length * reach(r.k)).add(r.base);
    const tr = r.trail;
    // a blade put somewhere new (a teleport, a cut in the story) starts its trail afresh
    if (tr.n) {
      const j = ((tr.head + N.trail - 1) % N.trail) * 3;
      if (Math.hypot(tip.x - tr.tip[j], tip.y - tr.tip[j + 1], tip.z - tr.tip[j + 2]) > TRAIL.jump) tr.n = 0;
    }
    // (a paused frame takes the newest sample’s place, so no two share a time)
    if (step === 0 && tr.n) tr.head = (tr.head + N.trail - 1) % N.trail;
    else tr.n = Math.min(N.trail, tr.n + 1);
    const i = tr.head;
    put3(tr.base, i, r.base.x, r.base.y, r.base.z);
    put3(tr.tip, i, tip.x, tip.y, tip.z);
    tr.t[i] = clock + step;
    tr.k[i] = r.k;
    tr.head = (i + 1) % N.trail;
  }

  // ── the effects ──

  function throwSparks(at, n, dir) {
    for (let k = 0; k < n; k++) {
      const i = sparkSlots.take();
      // anywhere, leaning up, or (a turned bolt) mostly back along its new way
      _a.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      if (dir) _a.multiplyScalar(0.6).add(_b.set(dir.x, dir.y, dir.z).normalize());
      else _a.y += 0.5;
      _a.normalize().multiplyScalar(2 + rand() * 4);
      put3(sparks.p, i, at.x, at.y, at.z);
      put3(sparks.v, i, _a.x, _a.y, _a.z);
      sparks.t[i] = 0;
      sparks.life[i] = 0.2 + rand() * 0.4;
    }
  }

  function addFlash(at, size, colour) {
    const i = flashSlots.take();
    put3(flashes.p, i, at.x, at.y, at.z);
    put3(flashes.colour, i, colour[0], colour[1], colour[2]);
    flashes.size[i] = size;
    flashes.t[i] = 0;
    flashes.life[i] = GLARE.life;
  }

  const fading = (t, life) => (t < life ? (1 - Math.max(0, t) / life) ** 2 : 0);

  function lightUp(at, colour, peak) {
    // the brighter of the flash now and the one still fading keeps the lamp
    if (glare.peak * fading(glare.t, glare.life) > peak) return;
    glare.at.set(at.x, at.y, at.z);
    glare.colour = colour;
    glare.t = 0;
    glare.peak = peak;
  }

  function addRipple(at, v, from, to, band, life, delay, throat) {
    const i = rippleSlots.take();
    put3(ripples.p, i, at.x, at.y, at.z);
    put3(ripples.v, i, v.x, v.y, v.z);
    ripples.from[i] = from;
    ripples.to[i] = to;
    ripples.band[i] = band;
    ripples.t[i] = 0;
    ripples.life[i] = life;
    ripples.delay[i] = delay;
    ripples.throat[i] = throat ? 1 : 0;
  }

  // the arcs drawn anew: from each hand to somewhere on the body it burns
  function strike() {
    bolt.n = 0;
    for (let h = 0; h < bolt.hands; h++) {
      _a.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(ARC.reach);
      _end.x = bolt.to[0] + _a.x;
      _end.y = bolt.to[1] + _a.y;
      _end.z = bolt.to[2] + _a.z;
      _hand.x = bolt.from[h * 3];
      _hand.y = bolt.from[h * 3 + 1];
      _hand.z = bolt.from[h * 3 + 2];
      bolt.n += arcPath(_hand, _end, rand, { depth: N.depth, branches: N.branches, jag: ARC.jag }, bolt.segs, bolt.n);
    }
    bolt.wait = 1 / ARC.rate;
    bolt.since = 0;
  }

  const live = (slots, n) => {
    let c = 0;
    for (let i = 0; i < n; i++) if (slots.used(i)) c++;
    return c;
  };

  const sabers = {
    meshes,

    blade(id, colour) {
      const had = records.get(id);
      if (had) {
        if (had.colour !== colour) {
          had.colour = colour;
          had.hue = bladeHues(colour);
          had.lamp.color = had.hue.light;
        }
        return had.handle;
      }
      let slot = slots.indexOf(null);
      if (slot < 0) {
        // the pool is full: the blade longest kept goes, an unlit one before a lit one
        let worst = null;
        for (const r of slots) if (!worst || (r.lit === worst.lit ? r.born < worst.born : !r.lit)) worst = r;
        worst.handle.release();
        slot = worst.slot;
      }
      const r = makeBlade(id, colour, slot);
      slots[slot] = r;
      records.set(id, r);
      return r.handle;
    },

    clash(at, kind = 'block') {
      const c = CLASHES[kind] ?? CLASHES.block;
      throwSparks(at, c.sparks, null);
      addFlash(at, c.flash, FLASH);
      lightUp(at, GLARE.colour, c.lamp);
    },

    deflect(at, dir) {
      throwSparks(at, 8, dir);
      addFlash(at, 0.18, BOLT_FLASH);
      lightUp(at, 0xff6a40, 12);
    },

    lightning(from, to, on = true) {
      const hands = Array.isArray(from) ? from : from ? [from] : [];
      const was = bolt.on ? bolt.hands : 0;
      bolt.on = !!on && hands.length > 0 && !!to;
      if (!bolt.on) return;
      bolt.hands = Math.min(HANDS, hands.length);
      for (let h = 0; h < bolt.hands; h++) put3(bolt.from, h, hands[h].x, hands[h].y, hands[h].z);
      put3(bolt.to, 0, to.x, to.y, to.z);
      // struck at once when it starts or a hand joins or drops, not at the next redraw
      if (was !== bolt.hands) bolt.wait = 0;
    },

    push(at, dir) {
      const p = RIPPLE.push;
      _b.set(dir?.x ?? 0, dir?.y ?? 0, dir?.z ?? 0);
      if (_b.lengthSq() < 1e-12) _b.set(0, 0, -1);
      _b.normalize();
      for (let k = 0; k < p.rings; k++) addRipple(_a.set(at.x, at.y, at.z).addScaledVector(_b, 0.3), _s.copy(_b).multiplyScalar(p.speed), p.from, p.to, p.band, p.life, k * p.gap, false);
    },

    choke(throat, on = true) {
      grip.on = !!on && !!throat;
      if (grip.on) grip.at.set(throat.x, throat.y, throat.z);
    },

    update(dt) {
      const step = Math.max(0, dt || 0);
      for (const r of slots) {
        if (!r) continue;
        if (!r.ticked) tick(r, step);
        r.ticked = false;
      }
      clock += step;
      let ns = 0; // sprites written

      // the blades: hilt, core and two glows each, at the hum’s strength
      let nb = 0;
      let nh = 0;
      for (const r of slots) {
        if (!r?.placed) continue;
        _q.setFromUnitVectors(Y, r.dir);
        hilts.setMatrixAt(nh++, _m.compose(r.grip, _q, _s.setScalar(1)));
        const long = BLADE.length * reach(r.k);
        r.lamp.intensity = 0;
        if (long < 1e-3) continue;
        const h = hum(clock, r.seed);
        cores.setMatrixAt(nb, _m.compose(r.base, _q, _s.set(1, long, 1)));
        cores.setColorAt(nb, _c.setRGB(r.hue.core[0] * h, r.hue.core[1] * h, r.hue.core[2] * h));
        nb++;
        const mid = _a.copy(r.dir).multiplyScalar(long / 2).add(r.base);
        for (const [radius, share] of [
          [BLADE.inner, 0.85],
          [BLADE.outer, 0.3],
        ]) {
          sAt.setXYZ(ns, mid.x, mid.y, mid.z);
          sDir.setXYZ(ns, r.dir.x, r.dir.y, r.dir.z);
          sSize.setXYZ(ns, long / 2, radius * (0.96 + 0.04 * h), 0);
          sColour.setXYZ(ns, r.hue.glow[0] * share * h, r.hue.glow[1] * share * h, r.hue.glow[2] * share * h);
          ns++;
        }
        Object.assign(r.lamp, { x: mid.x, y: mid.y, z: mid.z, intensity: LAMP.blade * r.k * h });
      }
      hilts.count = nh;
      hilts.visible = nh > 0;
      cores.count = nb;
      cores.visible = nb > 0;
      for (const m of [hilts, cores]) m.instanceMatrix.needsUpdate = true;
      if (cores.instanceColor) cores.instanceColor.needsUpdate = true;

      // the trails: a quad between each two samples a fast-moving tip left
      let nq = 0;
      const tp = tPos.array;
      const tc = tColour.array;
      for (const r of slots) {
        if (!r?.placed) continue;
        const tr = r.trail;
        const g = r.hue.glow;
        for (let s = tr.n - 1; s > 0; s--) {
          const i = (tr.head + N.trail - 1 - s) % N.trail; // the older of the two
          const j = (i + 1) % N.trail;
          const gap = tr.t[j] - tr.t[i];
          if (!(gap > 0)) continue;
          const i3 = i * 3;
          const j3 = j * 3;
          const speed = Math.hypot(tr.tip[j3] - tr.tip[i3], tr.tip[j3 + 1] - tr.tip[i3 + 1], tr.tip[j3 + 2] - tr.tip[i3 + 2]) / gap;
          const li = trailLevel(clock - tr.t[i], speed) * tr.k[i] * TRAIL.bright;
          const lj = trailLevel(clock - tr.t[j], speed) * tr.k[j] * TRAIL.bright;
          if (li <= 0 && lj <= 0) continue;
          const o = nq * 12;
          tp.set(tr.base.subarray(i3, i3 + 3), o);
          tp.set(tr.tip.subarray(i3, i3 + 3), o + 3);
          tp.set(tr.tip.subarray(j3, j3 + 3), o + 6);
          tp.set(tr.base.subarray(j3, j3 + 3), o + 9);
          for (let v = 0; v < 4; v++) {
            const l = v === 0 || v === 1 ? li : lj;
            tc[o + v * 3] = g[0] * l;
            tc[o + v * 3 + 1] = g[1] * l;
            tc[o + v * 3 + 2] = g[2] * l;
          }
          nq++;
        }
      }
      trailGeo.setDrawRange(0, nq * 6);
      trails.visible = nq > 0;
      tPos.needsUpdate = true;
      tColour.needsUpdate = true;

      // the lightning: drawn anew a few times a second, crackling brighter each time
      bolt.wait -= step;
      bolt.since += step;
      if (bolt.on && bolt.wait <= 0) strike();
      bolt.level = bolt.on ? 1 : Math.max(0, bolt.level - step / ARC.fade);
      arcLamp.intensity = 0;
      if (bolt.level > 0) {
        const crackle = bolt.level * (0.55 + 0.45 * Math.exp(-bolt.since * 20));
        for (let k = 0; k < bolt.n; k++) {
          const j = k * SEG;
          const s = bolt.segs;
          const w = s[j + 6];
          const half = Math.hypot(s[j + 3] - s[j], s[j + 4] - s[j + 1], s[j + 5] - s[j + 2]) / 2 || 1e-6;
          const mx = (s[j] + s[j + 3]) / 2;
          const my = (s[j + 1] + s[j + 4]) / 2;
          const mz = (s[j + 2] + s[j + 5]) / 2;
          const dx = (s[j + 3] - s[j]) / (2 * half);
          const dy = (s[j + 4] - s[j + 1]) / (2 * half);
          const dz = (s[j + 5] - s[j + 2]) / (2 * half);
          const a = crackle * w;
          for (const [radius, colour] of [
            [ARC.r * (0.5 + 0.5 * w), ARC.core],
            [ARC.halo * (0.5 + 0.5 * w), ARC.glow],
          ]) {
            sAt.setXYZ(ns, mx, my, mz);
            sDir.setXYZ(ns, dx, dy, dz);
            sSize.setXYZ(ns, half, radius, 0);
            sColour.setXYZ(ns, colour[0] * a, colour[1] * a, colour[2] * a);
            ns++;
          }
        }
        Object.assign(arcLamp, { x: (bolt.from[0] + bolt.to[0]) / 2, y: (bolt.from[1] + bolt.to[1]) / 2, z: (bolt.from[2] + bolt.to[2]) / 2, intensity: LAMP.arc * crackle });
      }

      // the sparks: thrown, falling, dragged, streaked along their way and cooling
      for (let i = 0; i < N.sparks; i++) {
        if (!sparkSlots.used(i)) continue;
        sparks.t[i] += step;
        const k = sparks.t[i] / sparks.life[i];
        if (k >= 1) {
          sparkSlots.release(i);
          continue;
        }
        const drag = Math.exp(-1.5 * step);
        const j = i * 3;
        sparks.v[j] *= drag;
        sparks.v[j + 1] = sparks.v[j + 1] * drag - GRAVITY * step;
        sparks.v[j + 2] *= drag;
        for (let a = 0; a < 3; a++) sparks.p[j + a] += sparks.v[j + a] * step;
        const speed = Math.hypot(sparks.v[j], sparks.v[j + 1], sparks.v[j + 2]) || 1;
        sAt.setXYZ(ns, sparks.p[j], sparks.p[j + 1], sparks.p[j + 2]);
        sDir.setXYZ(ns, sparks.v[j] / speed, sparks.v[j + 1] / speed, sparks.v[j + 2] / speed);
        sSize.setXYZ(ns, Math.min(0.08, speed * 0.012), 0.012, 0);
        const fade = 1 - k * k;
        sColour.setXYZ(ns, (HOT[0] + (COOL[0] - HOT[0]) * k) * fade, (HOT[1] + (COOL[1] - HOT[1]) * k) * fade, (HOT[2] + (COOL[2] - HOT[2]) * k) * fade);
        ns++;
      }

      // the flashes: round, gone in a blink
      for (let i = 0; i < N.flashes; i++) {
        if (!flashSlots.used(i)) continue;
        flashes.t[i] += step;
        const k = fading(flashes.t[i], flashes.life[i]);
        if (k <= 0) {
          flashSlots.release(i);
          continue;
        }
        const j = i * 3;
        sAt.setXYZ(ns, flashes.p[j], flashes.p[j + 1], flashes.p[j + 2]);
        sDir.setXYZ(ns, 0, 0, 0);
        sSize.setXYZ(ns, 0, flashes.size[i] * (0.6 + 0.4 * k), 0);
        sColour.setXYZ(ns, flashes.colour[j] * k, flashes.colour[j + 1] * k, flashes.colour[j + 2] * k);
        ns++;
      }

      // the ripples: a push’s rings out along it, swelling and thinning; a grip’s tightening at the throat
      grip.wait -= step;
      if (grip.on && grip.wait <= 0) {
        const c = RIPPLE.choke;
        addRipple(grip.at, _b.set(0, 0, 0), c.from, c.to, c.band, c.life, 0, true);
        grip.wait = c.every;
      }
      for (let i = 0; i < N.ripples; i++) {
        if (!rippleSlots.used(i)) continue;
        ripples.t[i] += step;
        const t = ripples.t[i] - ripples.delay[i];
        const k = t / ripples.life[i];
        if (k >= 1) {
          rippleSlots.release(i);
          continue;
        }
        if (t < 0) continue;
        const j = i * 3;
        if (ripples.throat[i]) put3(ripples.p, i, grip.at.x, grip.at.y, grip.at.z);
        else for (let a = 0; a < 3; a++) ripples.p[j + a] += ripples.v[j + a] * step;
        const e = 1 - (1 - k) ** 2;
        const strength = Math.sin(Math.PI * Math.min(1, k * 1.2)) * (1 - k);
        sAt.setXYZ(ns, ripples.p[j], ripples.p[j + 1], ripples.p[j + 2]);
        sDir.setXYZ(ns, 0, 0, 0);
        sSize.setXYZ(ns, 0, ripples.from[i] + (ripples.to[i] - ripples.from[i]) * e, ripples.band[i]);
        sColour.setXYZ(ns, RIPPLE.colour[0] * strength, RIPPLE.colour[1] * strength, RIPPLE.colour[2] * strength);
        ns++;
      }

      spriteGeo.instanceCount = ns;
      sprites.visible = ns > 0;
      for (const a of [sAt, sDir, sSize, sColour]) a.needsUpdate = true;

      // the clash’s lamp, fading
      glare.t += step;
      const g = glare.peak * fading(glare.t, glare.life);
      if (g === 0) glare.peak = 0;
      Object.assign(glareLamp, { x: glare.at.x, y: glare.at.y, z: glare.at.z, color: glare.colour, intensity: g });
    },

    lamps() {
      lit.length = 0;
      for (const r of slots) if (r?.placed && r.lamp.intensity > 0) lit.push(r.lamp);
      if (arcLamp.intensity > 0) lit.push(arcLamp);
      if (glareLamp.intensity > 0) lit.push(glareLamp);
      return lit;
    },

    // every shader the sabers use made now, not at the first stroke (the
    // pools are hidden while empty; precompile takes hidden ones too)
    warm(renderer, camera, target) {
      return precompile(renderer, group, camera, scene, target);
    },

    live() {
      let blades = 0;
      for (const r of slots) if (r?.placed && r.k > 0) blades++;
      return {
        blades,
        trails: trailGeo.drawRange.count / 6,
        sparks: live(sparkSlots, N.sparks),
        flashes: live(flashSlots, N.flashes),
        arcs: bolt.level > 0 ? bolt.n : 0,
        ripples: live(rippleSlots, N.ripples),
      };
    },

    dispose() {
      group.removeFromParent();
      hilts.dispose();
      cores.dispose();
      for (const g of [hiltGeo, coreGeo, trailGeo, spriteGeo]) g.dispose();
      for (const m of [hiltMat, coreMat, trailMat, spriteMat]) m.dispose();
      records.clear();
      slots.fill(null);
    },
  };
  return sabers;
}
