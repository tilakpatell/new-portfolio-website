// The universe map in WebGL: the planets on a tilted disc among the stars,
// a faint orbit for each, and the planets' names as DOM buttons that React
// renders once and the scene moves as it draws (nothing re-renders per
// frame).
//
// Two ways to get round it:
// - With no ship picked, the camera flies between the planets (flight.js
//   does the numbers), a drag turns the map and a click picks a planet.
// - With a ship (Rick's cruiser, Luke's X-wing or the Falcon), you fly it:
//   W A S D or the arrows, R and C to climb and dive, Space to boost, F to
//   fire, or drag on the map like a stick (with buttons to climb and dive).
//   The camera rides behind it. Fly close to a planet and you're at it (the
//   panel shows its card); pick one from its name or by clicking it and the
//   ship flies itself there. M shows the whole map. ship.js has the physics.
//   Out past the home system is deep space (deep.js, deepspace.js), vast,
//   with wonders to fly to on the pulse drive. You're not alone: traffic
//   (traffic.js), hunters after you (hunters.js: the Empire, the Federation,
//   the Council of Ricks), with shields that take their hits and come back,
//   and now and then the director (director.js) sets something going
//   (setpieces.js: a Star Destroyer jumping in, portals, a comet; a convoy,
//   someone in distress).
//
// A scene module for lib/three/useScene: create(canvas, ctx) returns
// { resize, render, update, setVisible, lowerQuality, hover, dive, escape,
//   whole, boost, climb, fire, dispose }.
// Props: selected (an id or null), ship (a crew id or null), labels (a ref
// to { id: element }), stick (a ref to the steering ring), alt (a ref to the
// height gauge), shield (a ref to the shields bar), frozen (the page
// is leaving: stop drawing), onPick(id), onOpen(id) (a station's sign was
// clicked: go to its page), onEvent(event), onLand(), onCrash(id) (the ship
// went into a planet or a station too fast and the impact has played: true
// if the page goes on into its page, so the ship doesn't come back).

import * as THREE from 'three';
import { capturePointer } from '../../lib/pointer';
import { audioContext } from '../../lib/audio';
import { clamp01, createRenderer, disposeTree } from '../../lib/three/renderer';
import { device } from '../../lib/device';
import { DIVE_MS, FOV, cover, cameraFrom, focusPose, overviewPose, poseAt, startFlight, worldPos } from './flight';
import { MAP_RADIUS, ORDER, POSITIONS, SUN } from './layout';
import { buildPlanet, loadModel, loadModels, loadTextures } from './planets';
import { buildSun } from './sun';
import { createPost, spaceEnvironment } from './post';
import { SHIP, SOLIDS, autopilot, forward, headingTo, isPlace, orbiting, parkAt, spawn, step } from './ship';
import { createHunters } from './hunters';
import { createFleet } from './glbFleet';
import { createDirector } from './director';
import { createSetPieces } from './setpieces';
import { DEEP, WONDERS, openness, reachOf } from './deep';
import { createCrash } from './crash';
import { createTraffic } from './traffic';
import { createBelt, createDust } from './belt';
import { createTrail } from './trail';
import { BUILT, ENGINES, SHIP_MODELS, buildShip } from './shipModels';
import { shipEngine } from './sounds';
import { byId } from './universes';

const STARS = 1800; // the near ones, over the Milky Way's own
const STARS_LOW = 700;
const STREAKS = 220;
const BOLTS = 10; // shots in flight at once
const BOLT_COLOR = { falcon: '#ff4a3d', xwing: '#ff3b30', cruiser: '#9df06b' };
// each ship's exhaust (trail.js): its colour, its white-hot core, how wide
// and how long it is, and the cruiser's portal-plasma ripple
const PLUME = {
  cruiser: { color: '#4dff3a', core: '#e6ffd2', width: 0.036, life: 0.42, length: 0.32, wobble: 1.3, sparks: 40 },
  falcon: { color: '#5cbcff', core: '#eef8ff', width: 0.034, life: 0.45, length: 0.36, wobble: 0 },
  xwing: { color: '#ff6a36', core: '#fff0dc', width: 0.017, life: 0.38, length: 0.3, wobble: 0 },
};
const IDLE = 40000; // ms sitting still before the crew get bored
// a crash, in seconds from the moment it hits: on into the planet, the
// impact, on through into its page (a planet or a station, not the sun),
// or else the ship back again, and the end of its coming back
const CRASH = { impact: 0.32, through: 1.6, back: 2.7, done: 3.3 };
const TURN = 0.0042; // radians of map per px dragged
const DRAG = 6; // px a press may move and still be a click
const STICK = 70; // px of drag for full throttle or a full turn
const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // key light, upper left

const KEYS = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', ' ': 'boost', shift: 'boost', r: 'climb', pageup: 'climb', c: 'dive', pagedown: 'dive' };
const ARROWS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ']);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const STAR_VERT = `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uDpr;
uniform float uTime;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uDpr * (700.0 / -mv.z), 1.0, 6.0 * uDpr);
  // a slow twinkle, each star on its own beat
  float tw = 0.72 + 0.28 * sin(uTime * (0.6 + fract(aPhase * 7.3) * 1.8) + aPhase * 6.2832);
  vColor = aColor * tw;
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d);
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}`;

function starfield(rand) {
  const pos = new Float32Array(STARS * 3);
  const size = new Float32Array(STARS);
  const col = new Float32Array(STARS * 3);
  const phase = new Float32Array(STARS);
  const tints = [
    [1, 1, 1],
    [0.78, 0.86, 1],
    [1, 0.9, 0.78],
  ];
  for (let i = 0; i < STARS; i++) {
    // a shell round the map, flatter than a sphere
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = 320 + rand() * 70; // behind everything, however far out the camera is
    const s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * r, u * r * 0.8, Math.sin(a) * s * r], i * 3);
    const b = 0.25 + rand() ** 3 * 0.75;
    const t = tints[rand() < 0.75 ? 0 : rand() < 0.5 ? 1 : 2];
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
    size[i] = 0.7 + rand() ** 4 * 2.2;
    phase[i] = rand();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: { uDpr: { value: 1 }, uTime: { value: 0 } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  return points;
}

// one faint circle per planet round the map's middle, all in one draw
function orbits() {
  const SEG = 160;
  const pts = [];
  for (const id of ORDER) {
    const [x, y, z] = POSITIONS[id];
    const R = Math.hypot(x, z);
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const b = ((i + 1) / SEG) * Math.PI * 2;
      pts.push(Math.cos(a) * R, y, Math.sin(a) * R, Math.cos(b) * R, y, Math.sin(b) * R);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#9fb0d0', transparent: true, opacity: 0.05, depthWrite: false }));
}

// Stars streaming past when the ship boosts: thin streaks of light round
// the camera's line of sight (none down the middle, where the ship is),
// riding with the camera, rushing at it out of the distance. Each is a
// sliver that turns its face to the lens, brightest at its head and fading
// to nothing down its tail, faint far off and gone before it reaches you;
// longer, brighter and more of them the harder it boosts, white with a
// touch of the ship's own colour (portal green, hyperspace blue, the
// X-wing's orange). It all moves on the GPU: one draw, no per-frame upload.
const STREAK_VERT = `
attribute vec4 aStreak; // angle round the line of sight, distance out from it, where along the run, a random
attribute vec2 aCorner; // across (−1, 1), along (0 the tail, 1 the head)
uniform float uTravel;
uniform float uLen;
uniform float uAmount;
varying float vHead;
varying float vSide;
varying float vFade;
void main() {
  float run = fract(aStreak.z + uTravel * (0.8 + 0.4 * aStreak.w) / 17.6); // 0 far ahead … 1 at the camera
  float z = -17.0 + run * 17.6;
  float len = uLen * (0.55 + 0.9 * aStreak.w);
  vec2 dir = vec2(cos(aStreak.x), sin(aStreak.x));
  vec3 p = vec3(dir * aStreak.y * vec2(1.0, 0.72), z - len * (1.0 - aCorner.y));
  // a little wider the closer it is, and the heavier ones a little wider still
  p.xy += vec2(-dir.y, dir.x) * aCorner.x * (0.003 + 0.0035 * aStreak.w * aStreak.w);
  vHead = aCorner.y;
  vSide = aCorner.x;
  // in from the dark ahead, out before the lens; only some show at a low boost
  float shown = smoothstep(aStreak.w * 0.75, aStreak.w * 0.75 + 0.2, uAmount);
  vFade = smoothstep(0.0, 0.25, run) * (1.0 - smoothstep(0.8, 0.97, run)) * shown;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const STREAK_FRAG = `
uniform vec3 uColor;
uniform float uAmount;
varying float vHead;
varying float vSide;
varying float vFade;
void main() {
  float across = clamp(1.0 - abs(vSide), 0.0, 1.0);
  float head = vHead * vHead;
  gl_FragColor = vec4(uColor * head * across * vFade * (0.3 + 0.4 * uAmount), 1.0);
}`;
function streaks(rand) {
  const info = new Float32Array(STREAKS * 4 * 4);
  const corner = new Float32Array(STREAKS * 4 * 2);
  const index = [];
  for (let i = 0; i < STREAKS; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.6 + rand() ** 0.8 * 2.3;
    const along = rand();
    const weight = rand();
    for (let c = 0; c < 4; c++) {
      info.set([a, r, along, weight], (i * 4 + c) * 4);
      corner.set([c % 2 ? 1 : -1, c < 2 ? 0 : 1], (i * 4 + c) * 2);
    }
    const o = i * 4;
    index.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 4 * 3), 3));
  g.setAttribute('aStreak', new THREE.BufferAttribute(info, 4));
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  g.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    vertexShader: STREAK_VERT,
    fragmentShader: STREAK_FRAG,
    uniforms: { uTravel: { value: 0 }, uLen: { value: 1 }, uAmount: { value: 0 }, uColor: { value: new THREE.Color('#dfe9ff') } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const lines = new THREE.Mesh(g, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  lines.renderOrder = 2;
  const tint = new THREE.Color();
  return {
    lines,
    // white, with a touch of the ship's colour (brighter than white at the
    // head, so the nearest catch the bloom)
    setTint(color) {
      tint.set(color);
      mat.uniforms.uColor.value.set('#ffffff').lerp(tint, 0.35).multiplyScalar(1.5);
    },
    update(dt, speed, amount) {
      lines.visible = amount > 0.01;
      if (!lines.visible) return;
      const u = mat.uniforms;
      u.uAmount.value = amount;
      u.uTravel.value += speed * dt * 2.2;
      u.uLen.value = (0.4 + speed * 0.13) * (0.4 + 0.8 * amount);
    },
  };
}

// The moment a boost lights: a ring of the engines' light bursting out
// behind the ship, square to its line of flight, rippling (the cruiser's
// swirls, like a portal's edge), gone in half a second.
const BURST_FRAG = `
uniform vec3 uColor;
uniform float uAge;
uniform float uSwirl;
varying vec2 vUv;
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float r = length(c);
  float a = atan(c.y, c.x);
  float grow = 1.0 - (1.0 - uAge) * (1.0 - uAge);
  float front = 0.25 + 0.7 * grow;
  float wobble = uSwirl * 0.03 * sin(a * 7.0 + r * 18.0 - uAge * 14.0);
  float d = (r - front + wobble) / (0.03 + 0.05 * uAge);
  float band = exp(-d * d);
  // a flash at the nozzles (the cruiser's turning, like a portal opening)
  float spiral = mix(1.0, 0.5 + 0.5 * sin(a * 3.0 + r * 16.0 - uAge * 12.0), uSwirl);
  float inner = exp(-r * r * 14.0) * (1.0 - grow) * 0.5 * spiral;
  float fade = (1.0 - uAge) * (1.0 - uAge);
  // white-hot along the crest of the ring, the engines' colour either side
  vec3 col = uColor * (band + inner) + vec3(1.6) * band * band * band * band;
  gl_FragColor = vec4(col * fade * step(r, 1.0), 1.0);
}`;
function boostBurst() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: BURST_FRAG,
    uniforms: { uColor: { value: new THREE.Color() }, uAge: { value: 0 }, uSwirl: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.visible = false;
  mesh.frustumCulled = false;
  let age = 1;
  const LIFE = 0.55;
  return {
    mesh,
    // on the ship (its pivot, so it pitches and banks with it), at the
    // middle of its engines (in the pivot's units, nose toward −z)
    fire(pivot, at, color, swirl) {
      age = 0;
      pivot.add(mesh);
      mesh.position.copy(at);
      mat.uniforms.uColor.value.set(color).multiplyScalar(2.6);
      mat.uniforms.uSwirl.value = swirl;
      mesh.visible = true;
    },
    // it drifts back from the engines a little as it grows
    update(dt) {
      if (!mesh.visible) return false;
      age += dt / LIFE;
      if (age >= 1) return (this.clear(), false);
      mat.uniforms.uAge.value = age;
      mesh.scale.setScalar(0.18 + age * 0.5);
      mesh.position.z += dt * 0.5;
      return true;
    },
    // off the ship (before it's changed or thrown away, which would take this with it)
    clear() {
      mesh.visible = false;
      mesh.removeFromParent();
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

export async function create(canvas, ctx) {
  const { reduced } = ctx;
  let props = ctx;
  let disposed = false;

  const gl = createRenderer(canvas, { ratio: 2, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.08, 2600); // (out to the far side of deep space)
  scene.add(camera); // it carries the streaks
  const map = new THREE.Group(); // turned (yaw) by a drag, or to keep the camera behind the ship
  scene.add(map);

  // the names under the planets are the way in by keyboard and screen reader
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cursor = 'grab';

  // light: a key from the upper left, a cool fill from below right, a little ambient
  const key = new THREE.DirectionalLight('#fff8f0', 2.35);
  key.position.copy(LIGHT).multiplyScalar(50);
  const fill = new THREE.DirectionalLight('#8ea2ff', 0.45);
  fill.position.set(0.7, -0.4, -0.3).multiplyScalar(50);
  scene.add(key, fill, new THREE.AmbientLight('#b8c4ff', 0.4));

  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const stars = starfield(rand);
  map.add(stars);
  const rings = orbits();
  map.add(rings);
  // the asteroid belt, and dust round the camera to feel the speed by (belt.js)
  const belt = createBelt({ small: (window.matchMedia?.('(pointer: coarse)').matches ?? false) || Math.min(window.innerWidth, window.innerHeight) < 600 });
  map.add(belt.group);
  const dust = createDust({ small: Math.min(window.innerWidth, window.innerHeight) < 600 });
  map.add(dust.points);
  const camLocal = new THREE.Vector3();
  let dustAmount = 0;
  // the ship's exhaust, a plume from each engine (trail.js), and a ring of
  // light that runs out round a place as you arrive
  let plumes = []; // { trail, at: where its engine is, inside the ship's pivot }
  const nozzle = new THREE.Vector3();
  const setPlumes = (kind, engines) => {
    burst.clear();
    for (const pl of plumes) {
      map.remove(pl.trail.mesh);
      pl.trail.dispose();
    }
    plumes = [];
    if (!kind) return;
    const look = PLUME[kind] ?? PLUME.falcon;
    streak.setTint(look.color);
    plumes = engines.map((at) => {
      const trail = createTrail(look);
      trail.setColors(look.color, look.core);
      map.add(trail.mesh);
      return { trail, at: new THREE.Vector3(...at) };
    });
  };
  const updatePlumes = (dt, t, amount, stretch = 1) => {
    const m = state.model;
    if (!m) return;
    m.group.updateMatrixWorld(true);
    for (const pl of plumes) {
      map.worldToLocal(m.pivot.localToWorld(nozzle.copy(pl.at)));
      pl.trail.update(dt, t, nozzle, amount, camLocal, stretch);
    }
  };
  // a boost lighting: the burst at the engines, a flare of the bloom and a
  // kick of the camera's lens (not with reduced motion)
  const burst = boostBurst();
  const ignite = () => {
    const m = state.model;
    if (reduced || !m || !plumes.length) return;
    const mid = new THREE.Vector3();
    for (const pl of plumes) mid.add(pl.at);
    mid.divideScalar(plumes.length);
    mid.z += 0.02;
    const look = PLUME[state.kind] ?? PLUME.falcon;
    burst.fire(m.pivot, mid, look.color, state.kind === 'cruiser' ? 1 : 0);
    state.flare = Math.max(state.flare, 1.5);
    state.kick = 1;
  };
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 128), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  pulse.rotation.x = -Math.PI / 2;
  pulse.visible = false;
  map.add(pulse);
  let pulseAt = null; // { id, age }
  const streak = streaks(rand);
  camera.add(streak.lines);

  // shots: a few glowing bolts, reused
  const boltGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.28, 6).rotateX(Math.PI / 2);
  const boltMat = new THREE.MeshBasicMaterial({ color: '#ff4a3d', toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const bolts = Array.from({ length: BOLTS }, () => {
    const m = new THREE.Mesh(boltGeo, boltMat);
    m.visible = false;
    m.rotation.order = 'YXZ';
    m.userData = { life: 0, v: [0, 0, 0] };
    map.add(m);
    return m;
  });

  // the planets' maps first (half size on a phone or anything below a
  // desktop, lib/device), so nothing pops in; a weak device starts with the
  // nearer stars thinned out
  const tier = device().tier;
  const small = tier !== 'high' || Math.min(window.innerWidth, window.innerHeight) < 600;
  if (tier === 'low') stars.geometry.setDrawRange(0, STARS_LOW);
  const T = await loadTextures({ small });

  // what metal reflects, and the passes after the scene (post.js)
  const env = spaceEnvironment(renderer, T.sky);
  scene.environment = env.texture;
  const post = createPost(renderer, scene, camera, { small });

  // the sky: the Milky Way, all the way round, turning with the map and
  // riding with the camera (so it's always as far off). It's always seen
  // magnified, so it does without mipmaps (and their memory)
  let sky = null;
  if (T.sky) {
    T.sky.generateMipmaps = false;
    T.sky.minFilter = THREE.LinearFilter;
    T.sky.anisotropy = 1;
    sky = new THREE.Mesh(new THREE.SphereGeometry(400, 64, 32), new THREE.MeshBasicMaterial({ map: T.sky, side: THREE.BackSide, depthWrite: false, toneMapped: false }));
    sky.renderOrder = -10;
    map.add(sky);
  }

  // the sun in the middle, warming the stations round it
  const sun = buildSun(T);
  map.add(sun.group);
  const sunLight = new THREE.PointLight('#ffd6a8', 78, 50, 1.4);
  map.add(sunLight);

  const planets = ORDER.map((id) => {
    const p = buildPlanet(byId(id), T);
    p.group.position.set(...POSITIONS[id]);
    map.add(p.group);
    return p;
  });
  const planetOf = Object.fromEntries(planets.map((p) => [p.id, p]));
  const crashFx = createCrash(map);
  // everyone else out here (none with reduced motion), and the pops when a shot hits one
  const fleet = createFleet(); // the ships that are models, shared
  const traffic = reduced ? null : createTraffic(map, { small, fleet });
  const pops = createCrash(map);
  // who comes after you, what the director sets going, and its set pieces
  // (none of it with reduced motion)
  const hunters = reduced ? null : createHunters(map, { small, fleet });
  const director = createDirector();
  const pieces = createSetPieces(map, { small, fleet });
  const later = []; // { at, run }: what the director set going, a moment on

  // the models arrive after the map is up
  loadModels((id, model, spot) => {
    if (disposed) {
      disposeTree(model);
      return;
    }
    if (!planetOf[id]?.mount(model, spot)) disposeTree(model);
    ctx.invalidate();
  });

  const size = { w: 1, h: 1 };
  const state = {
    yaw: 0,
    vel: 0, // radians per ms, after a flick
    sel: props.selected ?? null,
    hover: null,
    drag: null,
    flight: null,
    dive: null,
    low: false,
    rect: cover({ w: 1, h: 1 }),
    overview: null,
    pose: null,
    tLow: 0, // where the orbits stopped when quality went down
    yawTo: null, // where the map is turning to bring the picked place round to the front
    // flying
    kind: null, // the ship picked
    ship: null, // ship.js's numbers
    model: null,
    view: 'chase', // or 'map'
    auto: null, // { id, park } while it flies itself somewhere
    at: null, // the universe it's at
    keys: {},
    stick: null, // { id, x, y, dx, dy, on }
    boostBtn: false,
    climbBtn: 0, // the phone's climb (1) or dive (−1) button, held
    boosting: false,
    boosts: 0,
    streak: 0,
    flown: false, // has anyone touched the controls yet
    shown: true,
    lastInput: performance.now(),
    idleSaid: false,
    side: 1, // which wing the X-wing fires from next
    lastShot: 0,
    crash: null, // { age, id, … } while a crash plays out (startCrash)
    shake: 0,
    kick: 0, // the lens's kick as a boost lights, 1 fading to 0
    clock: 0, // seconds of frames
    shield: 100, // the ship's shields: hunters' lasers take them down, and they come back
    hitAt: -1e9,
    hurt: 0, // the red flash of a hit, 1 fading to 0
    lowSaid: false,
    heat: 0, // trouble made lately (ships shot down): the director sends more hunters
    saw: new Set(), // the wonders out in deep space you've come up on
    deepSaid: false,
    flare: 1,
  };
  const t0 = performance.now();
  let engine = null;

  // The open part of the canvas: the panel covers the right side on a
  // desktop and the bottom on a phone, the nav the top.
  const panelEl = () => ctx.el.closest('.universe-page')?.querySelector('.universe-panel');
  const measure = () => {
    const box = ctx.el.getBoundingClientRect();
    const panel = panelEl()?.getBoundingClientRect();
    const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    let side = 0;
    let sheet = 0;
    if (panel && panel.width > 0) {
      if (panel.width < box.width * 0.75) side = Math.max(0, box.right - panel.left);
      else sheet = Math.max(0, box.bottom - panel.top);
    }
    state.rect = cover({ w: size.w, h: size.h, panel: side, sheet, top: Math.max(0, nav - box.top) });
    state.overview = overviewPose(size, state.rect);
    camera.aspect = size.w / size.h;
    camera.setViewOffset(size.w, size.h, -state.rect.sx, -state.rect.sy, size.w, size.h);
    camera.updateProjectionMatrix();
  };
  // the panel changes height on a phone (the sheet) without the canvas resizing
  const panelRO = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => size.w > 1 && (measure(), ctx.invalidate())) : null;
  const watchPanel = () => {
    panelRO?.disconnect();
    const el = panelEl();
    if (el) panelRO?.observe(el);
  };
  watchPanel();

  // Where the camera rides with a ship: behind and a little above it, looking
  // past it the way it points, further back the faster it goes.
  const rotate = (x, z) => {
    const c = Math.cos(state.yaw);
    const s = Math.sin(state.yaw);
    return [x * c + z * s, -x * s + z * c];
  };
  const chasePose = () => {
    const s = state.ship;
    const [wx, wz] = rotate(s.x, s.z);
    const [fx, fz] = forward(s.heading);
    const [dx, dz] = rotate(fx, fz);
    const look = 0.4;
    // climbing, it drops a little below the ship's line (so you see it rise
    // against the sky); diving, it rises above (so you see what's coming)
    const nose = s.pitch || 0;
    return {
      target: [wx + dx * look, s.y + 0.06 + (s.vy || 0) * 0.05, wz + dz * look],
      dist: 1.7 + Math.abs(s.speed) * 0.045 + state.streak * 0.7,
      pitch: 0.21 - nose * 0.45,
    };
  };

  const flying = () => Boolean(state.ship);
  // the whole map; out in deep space, pulled back far enough to take in the
  // ship as well (and the wonders round it)
  const mapPose = () => {
    const s = state.ship;
    const r = s ? Math.hypot(s.x, s.z) : 0;
    if (!state.overview || r < DEEP.system) return state.overview;
    return { ...state.overview, dist: state.overview.dist * Math.min(9, (r + 90) / MAP_RADIUS) };
  };
  // the turn of the map that brings a place round to the front, nearest the
  // camera, with nothing between (the rest of the ring to its sides); a
  // station comes round a little past the front, so the sun in the middle
  // sits off to the left of it rather than right behind
  const frontYaw = (id) => {
    const [x, , z] = POSITIONS[id];
    const a = Math.atan2(z, x) - Math.PI / 2 + (byId(id).kind === 'core' ? 0.62 : 0);
    return state.yaw + Math.atan2(Math.sin(a - state.yaw), Math.cos(a - state.yaw));
  };

  const goal = () => {
    if (flying()) return state.view === 'map' ? mapPose() : state.crash && !state.crash.back ? crashPose() : chasePose();
    return state.sel ? focusPose(state.sel, state.yaw, size, state.rect) : state.overview;
  };

  const apply = (pose) => {
    const { position, target } = cameraFrom(pose);
    camera.position.set(...position);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateMatrixWorld();
  };

  // ── Where each planet is on screen: for the names and for picking ──
  const screen = planets.map((p) => ({ id: p.id, x: 0, y: 0, r: 0, z: -1 }));
  // the stations' signs on screen, as boxes: { id, x0, y0, x1, y1, z }
  const signs = planets.filter((p) => p.sign).map((p) => ({ id: p.id, p, x0: 0, y0: 0, x1: 0, y1: 0, z: -1 }));
  const corner = new THREE.Vector3();
  const shown = new Map(); // what each name element was last given
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  let tanHalf = Math.tan((FOV * Math.PI) / 360); // follows the lens (it widens boosting)

  const locate = () => {
    planets.forEach((p, i) => {
      const s = screen[i];
      p.group.getWorldPosition(v);
      const z = -w.copy(v).applyMatrix4(camera.matrixWorldInverse).z;
      v.project(camera);
      s.x = ((v.x + 1) / 2) * size.w;
      s.y = ((1 - v.y) / 2) * size.h;
      s.z = z;
      s.r = z > 0 ? (p.radius / (z * tanHalf)) * (size.h / 2) : 0;
    });
    for (const g of signs) {
      const m = g.p.sign;
      const [sw, sh] = m.userData.size;
      g.x0 = g.y0 = Infinity;
      g.x1 = g.y1 = -Infinity;
      m.getWorldPosition(w);
      g.z = -w.applyMatrix4(camera.matrixWorldInverse).z;
      for (const [cx, cy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        corner.set((cx * sw) / 2, (cy * sh) / 2, 0);
        m.localToWorld(corner).project(camera);
        const px = ((corner.x + 1) / 2) * size.w;
        const py = ((1 - corner.y) / 2) * size.h;
        g.x0 = Math.min(g.x0, px);
        g.x1 = Math.max(g.x1, px);
        g.y0 = Math.min(g.y0, py);
        g.y1 = Math.max(g.y1, py);
      }
    }
  };

  const placeLabels = () => {
    const els = props.labels?.current;
    if (!els) return;
    for (const s of screen) {
      const el = els[s.id];
      if (!el) continue;
      const off = s.z <= 0.3 || s.x < -60 || s.x > size.w + 60 || s.y < -60 || s.y > size.h + 60;
      // tucked behind a nearer planet, or a station's sign
      const ly = s.y + s.r + 10;
      const behind =
        screen.some((o) => o !== s && o.z > 0 && o.z < s.z && Math.hypot(o.x - s.x, o.y - s.y) < o.r * 0.9) ||
        signs.some((g) => g.id !== s.id && g.z > 0 && g.z < s.z && s.x > g.x0 && s.x < g.x1 && ly > g.y0 && ly < g.y1);
      const tf = off ? '' : `translate3d(${s.x.toFixed(1)}px, ${(s.y + s.r + 4).toFixed(1)}px, 0)`;
      const was = shown.get(el);
      const flag = `${off ? 'off' : ''}${behind ? 'behind' : ''}`;
      if (was && was.tf === tf && was.flag === flag) continue;
      shown.set(el, { tf, flag });
      if (tf) el.style.transform = tf;
      el.toggleAttribute('data-off', off);
      el.toggleAttribute('data-behind', behind && !off);
    }
  };

  // the nearest sign under the point, if any
  const pickSign = (px, py) => {
    let best = null;
    for (const g of signs) if (g.z > 0.3 && px >= g.x0 && px <= g.x1 && py >= g.y0 && py <= g.y1 && (!best || g.z < best.z)) best = g;
    return best?.id ?? null;
  };
  let signHover = null;
  const setSignHover = (id) => {
    if (id === signHover) return;
    if (signHover) planetOf[signHover].setSignHover(false);
    signHover = id;
    if (id) planetOf[id].setSignHover(true);
    ctx.invalidate();
  };

  const pick = (px, py) => {
    let best = null;
    for (const s of screen) {
      if (s.z <= 0) continue;
      if (Math.hypot(px - s.x, py - s.y) <= Math.max(s.r * 1.3, 18) && (!best || s.z < best.z)) best = s;
    }
    return best?.id ?? null;
  };

  const paintStates = () => {
    for (const p of planets) p.setState({ hover: state.hover === p.id, selected: state.sel === p.id, dim: Boolean(state.sel) && state.sel !== p.id });
    const els = props.labels?.current;
    if (els) for (const [id, el] of Object.entries(els)) el?.toggleAttribute('data-hover', state.hover === id);
  };

  const setHover = (id) => {
    if (id === state.hover) return;
    state.hover = id;
    paintStates();
    ctx.invalidate();
  };

  const emit = (e) => props.onEvent?.(e);

  // the camera eases from wherever it is to wherever it's going next
  const retarget = (dur) => {
    state.flight = reduced || !state.pose ? null : startFlight(state.pose, performance.now(), dur);
  };

  const select = (id) => {
    if (id === state.sel) return;
    state.sel = id;
    if (flying()) {
      // the ship takes you there (or, with reduced motion, is simply there)
      if (id && id !== state.at) {
        state.view = 'chase';
        if (reduced) {
          state.ship = { ...state.ship, ...parkAt(id, [state.ship.x, state.ship.z]), speed: 0, vy: 0, pitch: 0 };
          state.yaw = -state.ship.heading;
        } else {
          state.auto = { id, park: parkAt(id, [state.ship.x, state.ship.z]) };
          retarget(700);
        }
      } else if (!id) state.auto = null;
    } else {
      state.yawTo = id ? frontYaw(id) : null;
      state.vel = 0;
      if (reduced && id) state.yaw = state.yawTo;
      retarget();
    }
    paintStates();
    ctx.invalidate();
  };

  // ── The ship ──
  const heard = () => {
    // the first key or press: sound may start now
    if (!state.kind) return;
    audioContext();
    if (!engine) engine = shipEngine(state.kind);
  };

  const setShip = (kind) => {
    if (kind === state.kind) return;
    engine?.stop();
    engine = null;
    if (state.model) {
      map.remove(state.model.group);
      state.model.dispose();
      disposeTree(state.model.group);
      state.model = null;
    }
    const was = state.kind;
    state.kind = kind;
    traffic?.setCrew(kind);
    hunters?.clear();
    setPlumes(kind, ENGINES[kind] ?? []);
    state.auto = null;
    state.flown = false;
    if (kind) boltMat.color.set(BOLT_COLOR[kind] ?? '#ff4a3d').multiplyScalar(4); // hot enough to bloom
    if (!kind) {
      state.ship = null;
      state.at = null;
      state.yaw = 0;
      retarget();
      return;
    }
    state.model = buildShip(kind, T);
    map.add(state.model.group);
    if (SHIP_MODELS[kind]) {
      loadModel(SHIP_MODELS[kind]).then((m) => {
        if (!m) return;
        if (disposed || state.kind !== kind || !state.model?.mount(m)) disposeTree(m);
        ctx.invalidate();
      });
    } else if (kind === 'cruiser') {
      // the C-137 page's cruiser, crew aboard; its ink drawn to our scale (it's 2.7 across there)
      const model = state.model;
      import('../rickmorty/cruiser3d')
        .then((m) => m.buildCruiser({ ink: BUILT / 2.7 }))
        .then((c) => {
          if (!c) return;
          if (disposed || state.model !== model || !model.mount(c.group, { update: c.update, dispose: c.dispose, ownGlow: true })) {
            c.dispose();
            disposeTree(c.group);
            return;
          }
          // its exhaust leaves from its own exhaust cans
          if (c.engines?.length) {
            model.group.updateMatrixWorld(true);
            setPlumes('cruiser', c.engines.map((g) => model.pivot.worldToLocal(g.getWorldPosition(new THREE.Vector3())).toArray()));
          }
          ctx.invalidate();
        })
        .catch(() => {});
    }
    if (!state.ship) {
      state.ship = spawn(state.sel);
      state.at = state.sel && orbiting(state.ship, null) === state.sel ? state.sel : null;
      state.yaw = -state.ship.heading;
    }
    state.view = 'chase';
    if (!was) retarget(state.pose ? 1600 : 0);
    if (state.pose && engine === null && navigator.userActivation?.hasBeenActive) heard();
  };

  const takeover = () => {
    state.lastInput = performance.now();
    if (!state.flown) {
      state.flown = true;
      emit({ type: 'launch' });
    }
    if (state.auto) state.auto = null; // the pilot has the stick now
    if (state.view === 'map') {
      state.view = 'chase';
      retarget(700);
    }
  };

  const steering = () => {
    const k = state.keys;
    let throttle = (k.up ? 1 : 0) - (k.down ? 1 : 0);
    let turn = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const climb = clamp((k.climb ? 1 : 0) - (k.dive ? 1 : 0) + state.climbBtn, -1, 1);
    const st = state.stick;
    if (st?.on) {
      throttle = clamp(throttle - st.dy / STICK, -1, 1);
      turn = clamp(turn + st.dx / STICK, -1, 1);
    }
    return { throttle, turn, climb, boost: Boolean(k.boost || state.boostBtn) };
  };

  // a shot from the nose (the X-wing's from each wingtip in turn)
  const fire = () => {
    const s = state.ship;
    const now = performance.now();
    if (!s || props.frozen || state.crash || now - state.lastShot < 220) return;
    state.lastShot = now;
    state.lastInput = now;
    const b = bolts.find((m) => !m.visible) ?? bolts[0];
    const [fx, fz] = forward(s.heading);
    const side = state.kind === 'xwing' ? (state.side = -state.side) * 0.12 : 0;
    // along the nose, up or down as it points
    const up = Math.sin(s.pitch || 0);
    const level = Math.cos(s.pitch || 0);
    b.position.set(s.x + fx * 0.16 * level - fz * side, s.y + 0.16 * up, s.z + fz * 0.16 * level + fx * side);
    b.rotation.set(s.pitch || 0, s.heading, 0);
    const v = 18 + Math.max(0, s.speed);
    b.userData = { life: 1.1, v: [fx * v * level, v * up + (s.vy || 0) * 0.5, fz * v * level] };
    b.visible = true;
    emit({ type: 'fire' });
    ctx.invalidate();
  };
  const popDir = new THREE.Vector3();
  const shotFrom = new THREE.Vector3();
  const moveBolts = (dt) => {
    let any = false;
    for (const b of bolts) {
      if (!b.visible) continue;
      const d = b.userData;
      d.life -= dt;
      if (d.life <= 0) {
        b.visible = false;
        continue;
      }
      any = true;
      shotFrom.copy(b.position);
      b.position.x += d.v[0] * dt;
      b.position.y += d.v[1] * dt;
      b.position.z += d.v[2] * dt;
      // into someone: a pop (the big ships just take it)
      // a hunter: down, or (the tougher ones) a hit that sparks off it
      const hh = hunters?.hit(shotFrom, b.position);
      if (hh) {
        b.visible = false;
        pops.hit({ point: hh.at, normal: popDir.set(-d.v[0], 3, -d.v[2]).normalize(), radius: hh.down ? hh.size * 1.8 : 0.2 });
        if (hh.down) {
          emit({ type: 'kill', kind: hh.kind });
          state.heat += 1;
        }
        continue;
      }
      const h = traffic?.hit(shotFrom, b.position);
      if (h) {
        b.visible = false;
        pops.hit({ point: h.at, normal: popDir.set(-d.v[0], 3, -d.v[2]).normalize(), radius: h.glance ? 0.25 : h.size * 1.6 });
        if (!h.glance) {
          emit({ type: 'kill', kind: h.kind });
          state.heat += h.civil ? 1.5 : 1;
        }
      }
    }
    return any;
  };

  // the height gauge: where the ship is between the floor and the ceiling,
  // shown while you fly it (brighter while it climbs or dives)
  let altOn = false;
  const placeAlt = () => {
    const el = props.alt?.current;
    if (!el) return;
    const on = flying() && state.view === 'chase' && !state.crash && !state.dive && !props.frozen;
    if (on !== altOn) {
      altOn = on;
      el.toggleAttribute('data-on', on);
    }
    if (!on) return;
    const s = state.ship;
    el.style.setProperty('--alt', clamp(s.y / SHIP.ceiling, -1, 1).toFixed(3));
    el.toggleAttribute('data-moving', Math.abs(s.vy || 0) > 0.4);
  };

  const placeStick = () => {
    const el = props.stick?.current;
    if (!el) return;
    const st = state.stick;
    if (!st?.on) {
      el.removeAttribute('data-on');
      return;
    }
    el.setAttribute('data-on', '');
    el.style.transform = `translate3d(${st.x}px, ${st.y}px, 0)`;
    const k = Math.min(1, Math.hypot(st.dx, st.dy) / STICK);
    const a = Math.atan2(st.dy, st.dx);
    el.style.setProperty('--kx', `${(Math.cos(a) * k * 28).toFixed(1)}px`);
    el.style.setProperty('--ky', `${(Math.sin(a) * k * 28).toFixed(1)}px`);
  };

  // ── A crash: into something too fast ──
  const startCrash = (e) => {
    const s = state.ship;
    const solid = SOLIDS.find((o) => o.id === e.id);
    const center = new THREE.Vector3(...solid.at);
    const from = new THREE.Vector3(s.x, s.y, s.z);
    const normal = from.clone().sub(center).normalize();
    state.crash = {
      age: 0, // seconds of frames since the hit (a hidden tab pauses it)
      id: e.id,
      sun: e.id === 'sun',
      from,
      into: normal.clone().negate(),
      normal,
      radius: solid.r,
      point: center.clone().addScaledVector(normal, solid.r), // where it goes in
      fwd: forward(s.heading),
      speed: e.speed,
      spin: [3 + Math.random() * 5, 2 + Math.random() * 4],
      impact: false,
      asked: false, // has the page been told (props.onCrash)
      through: false, // and gone on into the place's page
      back: false,
    };
    state.auto = null;
    state.boosting = false;
    burst.clear();
    engine?.set({ speed: 0, boost: false, on: false });
    retarget(650); // the camera pulls back to watch it
  };
  // ── Shot down: the hunters' lasers took the last of the shields ──
  const startDestroyed = () => {
    const s = state.ship;
    const from = new THREE.Vector3(s.x, s.y, s.z);
    state.crash = {
      age: 0,
      id: 'shot',
      shot: true,
      sun: false,
      from,
      into: new THREE.Vector3(), // it tumbles where it is
      normal: new THREE.Vector3(0, 1, 0),
      radius: 0.35,
      point: from.clone(),
      fwd: forward(s.heading),
      speed: s.speed,
      spin: [6 + Math.random() * 6, 4 + Math.random() * 5],
      impact: false,
      asked: false,
      through: false,
      back: false,
    };
    state.auto = null;
    state.boosting = false;
    burst.clear();
    hunters?.clear();
    engine?.set({ speed: 0, boost: false, on: false });
    emit({ type: 'destroyed' });
    retarget(650);
  };

  // a laser into the shields: down they go (shot down at nothing left)
  const hurt = (damage) => {
    if (state.crash || !state.ship) return;
    state.shield = Math.max(0, state.shield - damage);
    state.hitAt = state.clock;
    state.hurt = 1;
    if (!reduced) state.shake = Math.max(state.shake, 0.3);
    emit({ type: 'laser' });
    if (state.shield < 35 && !state.lowSaid) {
      state.lowSaid = true;
      emit({ type: 'shields' });
    }
    if (state.shield <= 0) startDestroyed();
  };

  const FAMILY = { cruiser: 'rickmorty', xwing: 'starwars', falcon: 'starwars' };
  // what the hunters report
  const onHunters = (e) => {
    if (e.type === 'hunted') {
      if (!e.prey) emit({ type: 'hunted', faction: e.faction, ace: e.kinds.includes('tieadvanced') });
    } else if (e.type === 'laser') hurt(e.damage);
    else if (e.type === 'escaped' || e.type === 'cleared') {
      emit(e.rescued ? { type: 'event', id: 'rescued' } : e);
      // the Star Destroyer's fighters gone: it jumps away
      if (pieces.destroyerHere && !hunters.active) {
        pieces.leave();
        emit({ type: 'event', id: 'leave' });
      }
    }
  };

  // what the director sets going
  const happen = (id, ship) => {
    const family = FAMILY[state.kind];
    if (id === 'hunt') hunters.pack(family === 'starwars' ? 'empire' : 'federation', ship);
    else if (id === 'council') pieces.portals(hunters.pack('council', ship));
    else if (id === 'destroyer') {
      const d = pieces.destroyer(ship);
      if (!d) return;
      emit({ type: 'event', id: 'destroyer' });
      // its fighters launch a moment after it's here
      later.push({ at: state.clock + 2.4, run: () => state.ship && !state.crash && hunters.pack('empire', state.ship, { from: d.hangar, size: 3, ace: Math.random() < 0.35 }) });
    } else if (id === 'distress') {
      const prey = traffic?.distress(ship);
      if (!prey) return;
      hunters.pack(family === 'starwars' ? 'empire' : 'bugs', ship, { prey, size: 2, ace: false });
      emit({ type: 'event', id: 'distress' });
    } else if (id === 'convoy') traffic?.convoy(ship);
    else if (id === 'comet') {
      pieces.comet(ship);
      later.push({ at: state.clock + 5, run: () => emit({ type: 'event', id: 'comet' }) });
    }
  };

  // the shields bar: shown while there's trouble about or they're down at all
  let shieldOn = false;
  const placeShield = () => {
    const el = props.shield?.current;
    if (!el) return;
    const on = flying() && state.view === 'chase' && !state.crash && !state.dive && !props.frozen && Boolean(hunters?.active || state.shield < 99.5);
    if (on !== shieldOn) {
      shieldOn = on;
      el.toggleAttribute('data-on', on);
    }
    if (!on) return;
    el.style.setProperty('--shield', (state.shield / 100).toFixed(3));
    el.toggleAttribute('data-low', state.shield < 35);
  };

  // everything that goes on round you while you fly: the hunters, the
  // director and its set pieces, your shields, the wonders you come up on
  const adventure = (dt, t) => {
    state.clock += dt;
    const live = flying() && !state.crash && !state.dive && !props.frozen ? state.ship : null;
    if (hunters) for (const e of hunters.update(dt, t, live)) onHunters(e);
    let busy = pieces.update(dt, t, camera);
    if (live) {
      // shields come back once you've been out of trouble a while
      if (state.clock - state.hitAt > 5 && state.shield < 100) state.shield = Math.min(100, state.shield + dt * 12);
      if (state.shield > 70) state.lowSaid = false;
      state.heat = Math.max(0, state.heat - dt / 45);
      if (hunters) {
        const id = director.update(dt, { family: FAMILY[state.kind] ?? null, heat: state.heat, busy: hunters.active || pieces.destroyerHere || state.view !== 'chase' });
        if (id) happen(id, live);
      }
      for (const l of [...later]) {
        if (state.clock < l.at) continue;
        later.splice(later.indexOf(l), 1);
        l.run();
      }
      // out into deep space, and coming up on its wonders
      if (!state.deepSaid && openness(live.x, live.z) > 0.6) {
        state.deepSaid = true;
        emit({ type: 'event', id: 'deep' });
      }
      for (const w of WONDERS) {
        if (state.saw.has(w.id) || Math.hypot(live.x - w.at[0], live.y - w.at[1], live.z - w.at[2]) > reachOf(w) * 1.6 + 60) continue;
        state.saw.add(w.id);
        emit({ type: 'wonder', id: w.id });
      }
    } else later.length = 0;
    if (state.hurt > 0) {
      state.hurt = Math.max(0, state.hurt - dt * 2.2);
      busy = true;
    }
    post.hit(state.hurt);
    placeShield();
    return busy || Boolean(hunters?.count) || later.length > 0;
  };

  // the camera during a crash: back and up from the impact, so you see the
  // ship go in and the shockwave run out over the planet
  const crashPose = () => {
    const c = state.crash;
    const [wx, wz] = rotate(c.point.x, c.point.z);
    return { target: [wx, c.point.y, wz], dist: c.radius * 2.4 + 2.6, pitch: 0.42 };
  };
  const crashing = (dt) => {
    const c = state.crash;
    c.age += dt;
    const age = c.age;
    const m = state.model;
    updatePlumes(dt, (performance.now() - t0) / 1000, 0); // the engines are out
    if (age < CRASH.impact) {
      // on into it, tumbling, a little way under the surface
      const k = age / CRASH.impact;
      const depth = k * k * (SHIP.radius + 0.25);
      m.group.position.copy(c.from).addScaledVector(c.into, depth);
      m.group.position.x += c.fwd[0] * k * 0.1;
      m.group.position.z += c.fwd[1] * k * 0.1;
      m.pivot.rotation.x += dt * c.spin[0];
      m.pivot.rotation.z += dt * c.spin[1];
    } else if (!c.impact) {
      c.impact = true;
      m.group.visible = false;
      crashFx.hit({ point: c.point, normal: c.normal, body: planetOf[c.id]?.surface ?? null, radius: c.radius, sun: c.sun });
      state.shake = reduced ? 0 : 1;
      state.flare = reduced ? 1 : c.sun ? 2.6 : 2;
      if (!c.shot) emit({ type: 'crash', id: c.id }); // (shot down said so as it began)
    }
    if (age >= CRASH.through && !c.asked && !c.sun && !c.shot && isPlace(c.id)) {
      // the shockwave running out over the surface: the page takes it from
      // here, if it's going on into the place's page
      c.asked = true;
      c.through = Boolean(props.onCrash?.(c.id));
    }
    if (c.through) return true; // the camera holds on the crater till the page goes
    if (age >= CRASH.back && !c.back) {
      // back again: parked off the planet on the side it hit (well clear of the sun)
      c.back = true;
      let at;
      if (c.shot) {
        // shot down: back at the nearest place, shields up again
        const near = ORDER.reduce((a, b) => (Math.hypot(...POSITIONS[a].map((v, i) => v - c.from.getComponent(i))) <= Math.hypot(...POSITIONS[b].map((v, i) => v - c.from.getComponent(i))) ? a : b));
        at = parkAt(near, [c.from.x, c.from.z]);
      } else if (c.sun || !isPlace(c.id)) {
        // the sun, or a wonder out in deep space: back out the way it went in, facing away
        const solid = SOLIDS.find((o) => o.id === c.id) ?? { at: SUN.at, r: SUN.r };
        const out = c.from.clone().sub(new THREE.Vector3(...solid.at));
        if (c.sun) out.y = 0;
        out.normalize();
        const r = solid.r + 5;
        at = { x: solid.at[0] + out.x * r, y: c.sun ? SHIP.height : solid.at[1] + out.y * r, z: solid.at[2] + out.z * r, heading: headingTo(out.x, out.z) };
      } else at = parkAt(c.id, [c.from.x, c.from.z]);
      state.ship = { ...state.ship, x: at.x, y: at.y, z: at.z, heading: at.heading, speed: 0, vy: 0, pitch: 0, bank: 0, edge: false };
      state.shield = 100;
      state.lowSaid = false;
      m.group.visible = true;
      m.pivot.rotation.set(0, 0, 0);
      crashFx.arrive({ point: new THREE.Vector3(at.x, state.ship.y, at.z), kind: state.kind, heading: at.heading });
      emit({ type: 'respawn' });
      retarget(900);
    }
    if (c.back) {
      // coming out of the portal, or out of hyperspace (long, then snapping to size)
      const k = clamp01((age - CRASH.back) / (CRASH.done - CRASH.back));
      const s = state.ship;
      m.group.position.set(s.x, s.y, s.z);
      m.group.rotation.y = s.heading;
      const grow = 1 - (1 - k) ** 3;
      if (state.view === 'chase') state.yaw += wrap(-s.heading - state.yaw) * clamp01(dt * 4.5);
      m.group.scale.set(grow, grow, state.kind === 'cruiser' ? grow : grow * (1 + (1 - k) * 5));
    }
    if (age >= CRASH.done) {
      state.crash = null;
      m.group.scale.setScalar(1);
      m.group.visible = true;
      state.lastInput = performance.now();
    }
    return true;
  };

  const fly = (dt, t) => {
    if (state.crash) return crashing(dt);
    let input;
    if (state.auto) {
      const a = autopilot(state.ship, state.auto.id, state.auto.park);
      input = a.input;
      if (a.done) state.auto = null;
    } else input = steering();
    const { ship, events } = step(state.ship, input, dt);
    state.ship = ship;
    for (const e of events) {
      if (e.type !== 'crash') emit(e);
      else if (!state.crash) startCrash(e);
    }
    if (state.crash) return true;

    // a burst of speed
    const boosting = input.boost && input.throttle > 0 && ship.speed > SHIP.cruise * 0.7;
    if (boosting && !state.boosting) {
      emit({ type: 'boost', first: state.boosts++ === 0 });
      ignite();
    }
    state.boosting = boosting;
    const want = !reduced && ship.speed > SHIP.cruise + 0.2 ? clamp01((ship.speed - SHIP.cruise) / (SHIP.boost - SHIP.cruise)) : 0;
    state.streak += (want - state.streak) * clamp01(dt * 4);

    // at a universe: arriving, and leaving
    const target = state.auto?.id;
    const now = orbiting(ship, state.at);
    if (now !== state.at && (!target || now === target || now === null)) {
      const left = state.at;
      state.at = now;
      if (now) {
        if (state.sel !== now) {
          state.sel = now;
          props.onPick?.(now);
        }
        emit({ type: 'arrive', id: now });
        pulseAt = { id: now, age: 0 };
      } else if (left && state.sel === left && !target) {
        state.sel = null;
        props.onPick?.(null);
      }
      paintStates();
    }

    // the camera swings round behind the ship (not in the map view)
    if (state.view === 'chase') state.yaw += wrap(-ship.heading - state.yaw) * clamp01(dt * (reduced ? 12 : 4.5));

    const m = state.model;
    m.update(t);
    m.group.position.set(ship.x, ship.y + (reduced ? 0 : Math.sin(t * 2.1) * 0.012), ship.z);
    m.group.rotation.y = ship.heading;
    m.pivot.rotation.z = -ship.bank;
    m.pivot.rotation.x = (ship.pitch || 0) + (reduced ? 0 : clamp(-input.throttle * 0.06, -0.08, 0.08));
    m.setThrottle(clamp01(Math.abs(ship.speed) / SHIP.cruise) * (0.7 + state.streak * 0.3));
    updatePlumes(dt, t, clamp01((ship.speed - 0.5) / SHIP.cruise) * (0.7 + 0.3 * state.streak), 1 + state.streak * 1.3);
    engine?.set({ speed: ship.speed, boost: state.streak > 0.3, on: state.shown && !props.frozen && !document.hidden });
    // sitting still a good while: the crew notice
    if (!state.idleSaid && !state.auto && Math.abs(ship.speed) < 0.05 && state.shown && !document.hidden && performance.now() - state.lastInput > IDLE) {
      state.idleSaid = true;
      emit({ type: 'idle' });
    }
    return Boolean(state.auto || input.throttle || input.turn || input.climb || Math.abs(ship.speed) > 0.01 || Math.abs(ship.vy) > 0.01 || Math.abs(ship.pitch) > 0.002 || state.streak > 0.01 || Math.abs(wrap(-ship.heading - state.yaw)) > 0.002);
  };

  // ── Frames ──
  const still = () => reduced || state.low;
  let last = 0;

  function render(ms, now) {
    gl.watch(now);
    const dt = ms / 1000;
    const t = reduced ? 0 : state.low ? state.tLow : (now - t0) / 1000;
    if (!state.pose) {
      // first frame: straight onto a universe from a link (or behind the
      // ship parked there); the overview drifts in from a little further out
      if (!flying() && state.sel) {
        state.yaw = frontYaw(state.sel);
        state.yawTo = null;
        map.rotation.y = state.yaw;
        map.updateMatrixWorld();
      }
      const to = goal();
      if (state.sel || reduced) state.pose = to;
      else {
        state.pose = { target: [...(state.overview?.target ?? to.target)], dist: (state.overview?.dist ?? to.dist) * 1.35, pitch: (state.overview?.pitch ?? to.pitch) + 0.12 };
        state.flight = startFlight(state.pose, now, 1800);
      }
    }
    if (!flying() && !state.drag && state.yawTo !== null && !reduced) {
      // swing round with the camera's flight
      const left = state.yawTo - state.yaw;
      state.yaw += left * clamp01((ms / 1000) * 2.6);
      if (Math.abs(left) < 0.002) {
        state.yaw = state.yawTo;
        state.yawTo = null;
      }
    }
    if (!flying() && !state.drag && state.vel && !reduced) {
      state.yaw += state.vel * ms;
      state.vel *= 0.0035 ** (ms / 1000);
      if (Math.abs(state.vel) < 2e-6) state.vel = 0;
    }
    let moving = false;
    if (flying() && !state.dive && !props.frozen) moving = fly(dt, t);
    placeAlt();
    map.rotation.y = state.yaw;
    map.updateMatrixWorld();

    let pose;
    if (state.dive) {
      const d = state.dive;
      const k = clamp01((now - d.start) / DIVE_MS);
      const e = k * k * k;
      const to = worldPos(d.id, state.yaw);
      const end = byId(d.id).size * 1.05;
      pose = {
        target: d.from.target.map((x, i) => x + (to[i] - x) * Math.min(1, e * 1.5)),
        dist: Math.exp(Math.log(d.from.dist) + (Math.log(end) - Math.log(d.from.dist)) * e),
        pitch: d.from.pitch,
      };
      // the ship goes in first
      if (state.model) {
        const [px, py, pz] = POSITIONS[d.id];
        const g = state.model.group.position;
        g.set(g.x + (px - g.x) * e * 0.25, g.y + (py - g.y) * e * 0.25, g.z + (pz - g.z) * e * 0.25);
      }
    } else {
      const r = poseAt(state.flight, goal(), now);
      pose = r.pose;
      if (r.done) state.flight = null;
    }
    state.pose = pose;
    apply(pose);
    // boosting, the lens widens (so the speed shows at the edges), with a
    // kick as a boost lights
    const fov = FOV + (reduced || !flying() || state.view !== 'chase' ? 0 : 8 * state.streak ** 1.4 + 4 * state.kick * (1 - state.kick * 0.5));
    if (Math.abs(camera.fov - fov) > 0.005) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      tanHalf = Math.tan((fov * Math.PI) / 360);
    }
    if (state.kick > 0) state.kick = Math.max(0, state.kick - dt * 1.8);
    // a crash shakes the camera a moment (not with reduced motion), and the
    // glare flares
    if (state.shake > 0) {
      const k = state.shake * state.shake * 0.09;
      camera.position.x += Math.sin(now * 0.047) * k + Math.sin(now * 0.091) * k * 0.5;
      camera.position.y += Math.sin(now * 0.061 + 1) * k;
      camera.updateMatrixWorld();
      state.shake = Math.max(0, state.shake - dt * 1.4);
    }
    if (state.flare > 1) {
      state.flare = 1 + (state.flare - 1) * Math.exp(-dt * 2.5);
      if (state.flare < 1.01) state.flare = 1;
      post.flare(state.flare);
    }
    if (pulseAt) {
      // the arrival ring: from the planet's edge out past its moons, fading
      pulseAt.age += dt;
      const k = clamp01(pulseAt.age / 1.3);
      const u = byId(pulseAt.id);
      const [px, py, pz] = POSITIONS[pulseAt.id];
      pulse.visible = k < 1;
      pulse.position.set(px, py, pz);
      pulse.scale.setScalar(u.size * (1.05 + k * 1.6));
      pulse.material.color.set(u.swatch).multiplyScalar(2.6 * (1 - k) ** 2);
      if (k >= 1) pulseAt = null;
    }
    const crashBusy = crashFx.update(dt, camera);
    const popBusy = pops.update(dt, camera);
    const fxBusy = crashBusy || popBusy;
    if (traffic) {
      for (const e of traffic.update(dt, t, flying() && !state.crash && !state.dive ? state.ship : null)) {
        if (e.event === 'convoy') emit({ type: 'event', id: 'convoy' });
        else if (!e.event) emit(e); // (someone in distress said so as they came)
      }
    }
    const adventuring = adventure(dt, t);

    streak.update(dt, state.ship ? Math.abs(state.ship.speed) : 0, state.streak);
    const bursting = burst.update(dt);
    if (!reduced && flying() && state.view === 'chase' && state.streak > 0.001 && state.model) {
      // out from the ship, where it is on the canvas
      state.model.group.getWorldPosition(v).project(camera);
      post.rush(state.streak, (v.x + 1) / 2, (v.y + 1) / 2);
    } else post.rush(0);
    // the orbits fade while you fly down among them (edge-on they'd be stripes)
    const ringsWant = flying() && state.view === 'chase' ? 0.012 : 0.05;
    rings.material.opacity += (ringsWant - rings.material.opacity) * clamp01(dt * 3);
    const shooting = moveBolts(dt);
    sun.update(t, camera);
    stars.material.uniforms.uTime.value = t;
    for (const p of planets) p.update(t, camera);
    locate();
    placeLabels();
    // the sky and the far stars stay round the camera, wherever it flies;
    // the dust rides with it too, and shows while you fly (more, the faster)
    map.updateMatrixWorld();
    map.worldToLocal(camLocal.copy(camera.position));
    if (sky) sky.position.copy(camLocal);
    stars.position.copy(camLocal);
    const dustWant = !reduced && flying() && state.view === 'chase' ? 0.35 + 0.65 * clamp01(Math.abs(state.ship.speed) / SHIP.cruise) : 0;
    dustAmount += (dustWant - dustAmount) * clamp01(dt * 3);
    dust.update(camLocal, dustAmount, gl.ratio);
    belt.update(t);
    renderer.info.reset(); // counted over the whole frame, post passes and all
    post.render(size.w, size.h);
    last = now;

    if (state.dive) return now - state.dive.start < DIVE_MS; // then the page takes over
    if (state.crash?.through) return true; // the crater glows on while the page washes out
    if (props.frozen) return false;
    return !still() || moving || shooting || fxBusy || bursting || adventuring || state.kick > 0 || pulseAt || traffic?.count > 0 || state.flare > 1 || Boolean(state.flight || state.drag || state.vel || state.stick?.on || state.yawTo !== null);
  }

  // ── Keys, while flying ──
  const onKeyDown = (e) => {
    if (!flying() || props.frozen || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target;
    if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    const key = e.key.toLowerCase();
    // on a button or link, the arrows, Space and Enter are its own
    const onControl = el instanceof HTMLElement && el !== document.body && el.closest('button, a, [role="button"], [tabindex]:not([tabindex="-1"])');
    if (key === 'm') {
      heard();
      state.view = state.view === 'map' ? 'chase' : 'map';
      retarget(900);
      ctx.invalidate();
      return;
    }
    if (key === 'f') {
      e.preventDefault();
      heard();
      fire();
      return;
    }
    if ((key === 'e' || (key === 'enter' && !onControl)) && state.at) {
      e.preventDefault();
      props.onLand?.();
      return;
    }
    const k = KEYS[key];
    if (!k || (onControl && ARROWS.has(key))) return;
    e.preventDefault();
    heard();
    if (k !== 'boost') takeover();
    state.keys[k] = true;
    ctx.invalidate();
  };
  const onKeyUp = (e) => {
    const k = KEYS[e.key.toLowerCase()];
    if (k) state.keys[k] = false;
  };
  const onBlur = () => {
    state.keys = {};
    state.boostBtn = false;
    state.climbBtn = 0;
  };
  const onHidden = () => engine?.set({ speed: 0, on: !document.hidden && state.shown });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onHidden);

  // ── Pointer: a click picks a planet; a drag turns the map, or steers ──
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (state.drag || state.dive || props.frozen) return;
    const [x, y] = local(e);
    capturePointer(e, canvas);
    heard();
    state.vel = 0;
    state.drag = { id: e.pointerId, x, y, yaw: state.yaw, moved: 0, lastX: x, lastT: performance.now() };
    ctx.invalidate();
  };
  const onMove = (e) => {
    const [x, y] = local(e);
    const d = state.drag;
    if (d && d.id === e.pointerId) {
      d.moved = Math.max(d.moved, Math.hypot(x - d.x, y - d.y));
      if (d.moved < DRAG) return;
      if (flying()) {
        // a stick wherever the press began
        if (!state.stick) takeover();
        state.stick = { id: e.pointerId, x: d.x, y: d.y, dx: x - d.x, dy: y - d.y, on: true };
        placeStick();
      } else {
        const now = performance.now();
        state.yawTo = null;
        state.yaw = d.yaw + (x - d.x) * TURN;
        state.vel = ((x - d.lastX) * TURN) / Math.max(1, now - d.lastT);
        d.lastX = x;
        d.lastT = now;
      }
      canvas.style.cursor = 'grabbing';
      ctx.invalidate();
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const sign = pickSign(x, y);
    const id = sign ? null : pick(x, y);
    canvas.style.cursor = sign || id ? 'pointer' : 'grab';
    setSignHover(sign);
    setHover(id);
  };
  const endDrag = () => {
    state.drag = null;
    state.stick = null;
    placeStick();
    canvas.style.cursor = 'grab';
  };
  const onUp = (e) => {
    const d = state.drag;
    if (!d || d.id !== e.pointerId) return;
    endDrag();
    if (d.moved < DRAG) {
      state.vel = 0;
      const [x, y] = local(e);
      const sign = pickSign(x, y);
      if (sign) {
        props.onOpen?.(sign);
        return;
      }
      const id = pick(x, y);
      if (id) props.onPick?.(id);
    } else if (performance.now() - d.lastT > 80) state.vel = 0; // let go after holding still
    ctx.invalidate();
  };
  const onCancel = (e) => {
    if (state.drag?.id !== e.pointerId) return;
    endDrag();
    state.vel = 0;
    ctx.invalidate();
  };
  const onLeave = (e) => {
    if (e.pointerType !== 'mouse' || state.drag) return;
    setHover(null);
    setSignHover(null);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);

  setShip(props.ship ?? null);
  paintStates();

  // in development, renderer counts and the ship, for checking from a browser
  if (import.meta.env.DEV) {
    window.__universeDebug = { THREE, post, scene, renderer, camera, traffic, hunters, director, pieces, state };
    window.__universe = () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      ratio: gl.ratio,
      ship: state.ship && { ...state.ship },
      at: state.at,
      auto: state.auto?.id ?? null,
      view: state.view,
      crash: state.crash && { id: state.crash.id, age: state.crash.age },
      shield: +state.shield.toFixed(1),
      heat: +state.heat.toFixed(2),
      hunters: hunters?.packs ?? [],
      signs: signs.map(({ id, x0, y0, x1, y1, z }) => ({ id, x0, y0, x1, y1, z })),
      last,
    });
  }

  return {
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      gl.setSize(size.w, size.h);
      stars.material.uniforms.uDpr.value = gl.ratio;
      measure();
      watchPanel();
    },
    render,
    update(next) {
      props = next;
      setShip(next.ship ?? null);
      select(next.selected ?? null);
      if (next.frozen) {
        endDrag();
        state.keys = {};
        engine?.set({ speed: 0, on: false });
      }
    },
    setVisible(on) {
      state.shown = on;
      if (!on) engine?.set({ speed: 0, on: false });
    },
    lowerQuality() {
      state.tLow = (performance.now() - t0) / 1000;
      state.low = true;
      stars.geometry.setDrawRange(0, STARS_LOW);
      post.off();
      ctx.invalidate();
    },
    // a name under the pointer lights its planet too
    hover: setHover,
    // the phone's fire button
    fire() {
      heard();
      fire();
    },
    // the phone's boost button
    boost(on) {
      heard();
      state.boostBtn = on;
      if (on) takeover();
      ctx.invalidate();
    },
    // the phone's climb and dive buttons: 1 held to climb, −1 to dive, 0 let go
    climb(way) {
      heard();
      state.climbBtn = way;
      if (way) takeover();
      ctx.invalidate();
    },
    // Escape: back from the map view, or stop flying itself. False when
    // there was nothing to undo.
    escape() {
      if (state.view === 'map' && flying()) {
        state.view = 'chase';
        retarget(900);
        ctx.invalidate();
        return true;
      }
      if (state.auto) {
        state.auto = null;
        return true;
      }
      return false;
    },
    // the whole map: the view pulls out while you keep the ship (false
    // without one; the page clears the selection instead)
    whole() {
      if (!flying()) return false;
      state.view = 'map';
      state.auto = null;
      retarget(900);
      ctx.invalidate();
      return true;
    },
    // fly into a planet; the page fades to it and goes after `ms`
    dive(id) {
      if (reduced || !planetOf[id] || !state.pose) return 0;
      state.dive = { id, start: performance.now(), from: { ...state.pose, target: [...state.pose.target] } };
      state.flight = null;
      engine?.set({ speed: SHIP.boost, boost: true });
      ctx.invalidate();
      return DIVE_MS;
    },
    dispose() {
      disposed = true;
      engine?.stop();
      state.model?.dispose();
      panelRO?.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onHidden);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      const st = props.stick?.current;
      if (st) st.removeAttribute('data-on');
      if (import.meta.env.DEV) delete window.__universe, delete window.__universeDebug;
      crashFx.dispose();
      pops.dispose();
      hunters?.dispose();
      pieces.dispose();
      fleet.dispose();
      burst.clear();
      burst.dispose();
      traffic?.dispose();
      disposeTree(scene);
      post.dispose();
      env.dispose();
      gl.dispose();
    },
  };
}
