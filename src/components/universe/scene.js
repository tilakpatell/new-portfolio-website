// The universe map in WebGL: the planets on a tilted disc among the stars,
// a faint orbit for each, and the planets' names as DOM buttons that React
// renders once and the scene moves as it draws (nothing re-renders per
// frame).
//
// Two ways to get round it:
// - With no ship picked, the camera flies between the planets (flight.js
//   does the numbers), a drag turns the map and a click picks a planet.
// - With a ship (Rick's cruiser, Luke's X-wing, the Falcon or Walt and
//   Jesse's RV), you fly it, Battlefront's way, free all the way round (it
//   loops, rolls and flies upside down): W and S for the throttle, A and D
//   to roll, the arrows to swing the nose left and right and pull it up and
//   down, Space to boost, F (held) to fire, T (Shift+T back) to switch
//   target, or drag on the map like a stick (a mouse swings the nose, a
//   finger turns it and works the throttle, with buttons to pull the nose up
//   and down). Let go and it rolls itself back upright. How quick each of
//   those is, and more (A and D can turn instead), is the visitor's to set
//   (controls.js, FlightSettings.jsx). The camera rides behind it, rolling
//   with it and swinging round after it, or, with V, you sit in the cockpit
//   (the intro's, cockpit/vehicles, drawn over the world from the pilot's
//   seat; the choice is kept between visits).
//   Fly close to a planet and you're at it (the panel shows its card); pick
//   one from its name or by clicking it and the ship flies itself there. M
//   shows the whole map. ship.js has the physics.
//   Out past the home system is deep space (deep.js, deepspace.js), vast:
//   the fandoms' planets are far out in it, hundreds of units apart, each
//   marked by a beacon (beacons.js) so it reads as somewhere to go, with
//   wonders between them, all reached on the pulse drive (click a wonder
//   and the ship takes you: ship.js's autopilot). You're not alone: traffic
//   (traffic.js), hunters after you (hunters.js: the Empire, the
//   Federation, the Council of Ricks; a pack that drops in ahead of you on
//   the way somewhere interdicts you: the pulse drive is cut to the boost
//   while they're on you, 40 s at most), with shields that take their hits
//   and come back, and now and then the director (director.js) sets
//   something going (setpieces.js: a Star Destroyer jumping in, portals, a
//   comet; a convoy, someone in distress; a supernova, far off). The guns
//   lock on to a hunter ahead (targeting.js) and a HUD over the canvas
//   (UniverseMap.jsx) shows the gun line, the lock, the lead to shoot at
//   and the way to wherever you're going. Fly into a wonder too fast and
//   it's a crash of its own kind: the Citadel takes you on into its world,
//   a star burns you back, a giant takes you down into its clouds. The
//   black hole, the Maw, pulls you in as you come near it, and past its
//   point of no return (maw.js) you watch your ship spiral down it from a
//   way off, then go in after it (infall.js draws the fall), and the page
//   goes on to what's beyond.
//   Gone online (online/), the other visitors flying it are here too
//   (online/pilots.js): their ships and callsigns, and their shots; the guns
//   lock on to anyone who isn't your ally, a hit comes off their shields
//   (they're told, and take it themselves), and theirs off yours.
//
// A scene module for lib/three/useScene: create(canvas, ctx) returns
// { resize, render, update, setVisible, lowerQuality, hover, dive, escape,
//   whole, boost, climb, fire, dispose }.
// Props: selected (an id or null), ship (a crew id or null), controls (the
// visitor's flying settings: controls.js), labels (a ref
// to { id: element }), stick (a ref to the steering ring), alt (a ref to the
// height gauge), shield (a ref to the shields bar), hud (a ref to the
// targeting HUD's box: the reticle, the lock, the lead and the nav bracket
// are its children), net (online/client.js's link to the other pilots, or
// null), tags (a ref to the box their callsigns go in), frozen (the page
// is leaving: stop drawing), onPick(id), onOpen(id) (a station's sign was
// clicked: go to its page), onEvent(event), onLand(), onCrash(id) (the ship
// went into a planet or a station too fast and the impact has played, or
// fell into the black hole and is gone: true if the page goes on into its
// page, or on through to what's beyond the hole, so the ship doesn't come back).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { capturePointer } from '../../lib/pointer';
import { local as remembered } from '../../lib/hooks';
import { plan as cockpitPlan } from '../cockpit/timeline';
import { freeKit } from '../cockpit/kit';
import { audioContext } from '../../lib/audio';
import { clamp01, createRenderer, disposeTree, easeOut, precompile, precompilePasses } from '../../lib/three/renderer';
import { device } from '../../lib/device';
import { DIVE_MS, FOV, cover, cameraFrom, focusPose, overviewPose, poseAt, startFlight, worldPos } from './flight';
import { ORDER, POSITIONS, REACH, SUN } from './layout';
import { buildPlanet, loadModel, loadModels, loadTextures } from './planets';
import { buildSun } from './sun';
import { createPost, spaceEnvironment } from './post';
import { PLANETS, SHIP, SOLIDS, autopilot, forward, headingTo, isPlace, orbiting, parkAt, spawn, step } from './ship';
import { FACTIONS, NAMES, createHunters } from './hunters';
import { GLB, createFleet } from './glbFleet';
import { createDirector } from './director';
import { createSetPieces } from './setpieces';
import { buildDeepSpace } from './deepspace';
import { createTrench } from './trench';
import { createBeacons } from './beacons';
import { SUPERNOVA_SITES, createSupernovae } from './supernova';
import { DEEP, WONDERS, openness, reachOf, wonderById } from './deep';
import { createCrash } from './crash';
import { createInfall } from './infall';
import { DISK_N, MAW, captured, fallAt, parkNear, plungeAt, pullAt, startFall } from './maw';
import { createTraffic } from './traffic';
import { createBelt, createDust } from './belt';
import { createTrail } from './trail';
import { BUILT, ENGINES, SHIP_MODELS, buildShip } from './shipModels';
import { BUILT_KINDS, buildTraffic } from './trafficModels';
import { lockSound, shipEngine, wellSound } from './sounds';
import { AIM, aimAngles, assist, assistAmount, dirTo, edgeOf, intercept, nose, onScreen, track } from './targeting';
import { DEFAULTS as CONTROL_DEFAULTS, STICK, keyAxes, stickInput } from './controls';
import { byId } from './universes';
import { createPilots } from './online/pilots';

const STARS = 1800; // the near ones, over the Milky Way's own
const STARS_LOW = 700;
const STREAKS = 220;
const BOLTS = 16; // shots in flight at once
// seconds between shots with the trigger held (the X-wing's four cannons
// fire in turn, so it's quickest; the RV is a man with a gun out of the window)
const CADENCE = { xwing: 0.12, falcon: 0.16, cruiser: 0.19, rv: 0.2 };
const BOLT_COLOR = { falcon: '#ff4a3d', xwing: '#ff3b30', cruiser: '#9df06b', rv: '#5cc8ff' };
// each ship's exhaust (trail.js): its colour, its white-hot core, how wide
// and how long it is, and the cruiser's portal-plasma ripple
const PLUME = {
  cruiser: { color: '#4dff3a', core: '#e6ffd2', width: 0.036, life: 0.42, length: 0.32, wobble: 1.3, sparks: 40 },
  falcon: { color: '#5cbcff', core: '#eef8ff', width: 0.034, life: 0.45, length: 0.36, wobble: 0 },
  xwing: { color: '#ff6a36', core: '#fff0dc', width: 0.017, life: 0.38, length: 0.3, wobble: 0 },
  rv: { color: '#ff9a3c', core: '#fff0d8', width: 0.02, life: 0.4, length: 0.3, wobble: 0 },
};
const IDLE = 40000; // ms sitting still before the crew get bored
const SAFE = 3; // seconds after coming back when other pilots' shots don't count
// the cockpit view: the intro's cockpits, built on demand; the eye sits a
// little ahead of the ship's middle and above it (map units); the lens is
// the intro's, framed for a wide horizontal view, kept within sane vertical limits
const CABS = {
  falcon: () => import('../cockpit/vehicles/falcon'),
  xwing: () => import('../cockpit/vehicles/xwing'),
  cruiser: () => import('../cockpit/vehicles/cruiser'),
  rv: () => import('../cockpit/vehicles/rv'),
};
const SEAT_KEY = 'tp:universe-seat'; // 'chase' or 'cockpit', remembered
const EYE = { ahead: 0.035, up: 0.045 };
const CAB_HFOV = 88;
const CAB_VFOV = [52, 94];
// a crash, in seconds from the moment it hits: on into the planet, the
// impact, on through into its page (a planet or a station, not the sun),
// or else the ship back again, and the end of its coming back. Into the
// black hole there's no impact: the fall plays out instead, on maw.js's
// timings, and goes on through to what's beyond it (and if the page doesn't
// take it on, back out past its reach)
const CRASH = { impact: 0.32, through: 1.6, back: 2.7, done: 3.3 };
const FALL = { through: MAW.through, back: MAW.through + 0.3, done: MAW.through + 0.9 };
// into a giant it's a dive down into the clouds
const DIVE = { impact: 0.55, through: 1.7, back: 2.8, done: 3.4 };
const INTERDICT = 40; // seconds, at most, that a pack holds the pulse drive down
const STREAK_SPEED = 36; // the streaks' speed tops out here: faster they'd be a wall
const TURN = 0.0042; // radians of map per px dragged
const DRAG = 6; // px a press may move and still be a click
const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // key light, upper left

// (Battlefront's: W and S the throttle, A and D the roll, the arrows the
// nose, as a stick: controls.js's keyAxes)
const KEYS = { w: 'up', s: 'down', a: 'a', d: 'd', arrowleft: 'left', arrowright: 'right', arrowup: 'pitchUp', arrowdown: 'pitchDown', ' ': 'boost', shift: 'boost', f: 'fire' };
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

// one faint circle per station round the sun, all in one draw (the far
// planets don't orbit it: they're worlds of their own out in deep space)
function orbits() {
  const SEG = 160;
  const pts = [];
  for (const id of ORDER) {
    if (byId(id).kind !== 'core') continue;
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

  // (at most 1.5 device pixels to a CSS one: the whole sky, bloom and all,
  // filling a retina screen at 2 is more than most graphics chips draw
  // smoothly while flying, and the names and the HUD are crisp DOM anyway)
  const gl = createRenderer(canvas, { ratio: 1.5, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.08, 3200); // (out to the far side of deep space)
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
  const boltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6).rotateX(Math.PI / 2); // (long: they're quick)
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

  // deep space, out past the home system: its wonders, and the trench run
  // round the Death Star's middle
  const deep = buildDeepSpace({ small });
  map.add(deep.group);
  const trenches = PLANETS.filter((p) => p.trench).map((p) => createTrench({ at: p.at, r: p.r, trench: p.trench }));
  for (const tr of trenches) map.add(tr.group);
  // and a beacon over each far world, so it reads as somewhere to go
  const beacons = createBeacons();
  map.add(beacons.points);
  // the supernovas, when the director sets one off
  const novae = createSupernovae({ small });
  map.add(novae.group);

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
  // shaders made off the main thread before something is first drawn
  // (KHR_parallel_shader_compile), so nothing new stalls a frame: a ship
  // arriving, a loaded model, the cockpit
  // (drawn into the passes' buffer while they're on, so made for it)
  const warm = (root, cam = camera, target = scene) => precompile(renderer, root, cam, target, post.on ? post.composer.readBuffer : undefined);
  fleet.prepare = (o) => warm(o); // (the fleet's models too: none is made before the first frame)
  // who comes after you, what the director sets going, and its set pieces
  // (none of it with reduced motion)
  const hunters = reduced ? null : createHunters(map, { small, fleet });
  const director = createDirector();
  const pieces = createSetPieces(map, { small, fleet });
  const later = []; // { at, run }: what the director set going, a moment on
  // the other pilots, once online (with reduced motion too: they're people)
  const pilots = createPilots(map, { T, colors: BOLT_COLOR });
  let net = null;
  let netOff = null;

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
    blend: null, // flying, the camera's way from one view to the next: { from, start, dur }
    cam: null, // the view the camera had last frame (in the map's own frame: viewOfPose)
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
    seat: remembered.get(SEAT_KEY) === 'cockpit' ? 'cockpit' : 'chase', // where you ride: behind the ship, or in its cockpit
    view: 'chase', // the seat, or 'map' (the whole map, keeping the ship)
    cabK: 0, // how far into the cockpit view the camera is, 0 to 1, eased
    fovBase: FOV, // the lens, eased between the chase's and the cockpit's
    auto: null, // { id, park } while it flies itself somewhere
    at: null, // the universe it's at
    keys: {},
    stick: null, // { id, x, y, dx, dy, on }
    boostBtn: false,
    climbBtn: 0, // the phone's nose-up (1) or nose-down (−1) button, held
    fireBtn: false, // the phone's fire button, held
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
    safeUntil: -1e9, // just back from being shot down or a crash: other pilots' hits don't count
    hurt: 0, // the red flash of a hit, 1 fading to 0
    lowSaid: false,
    heat: 0, // trouble made lately (ships shot down): the director sends more hunters
    saw: new Set(), // the wonders out in deep space you've come up on
    deepSaid: false,
    trench: 0, // seconds down in the Death Star's trench
    trenchAt: -1e9,
    interdicted: false, // hunters have the pulse drive held down
    interdictAt: -1e9,
    flare: 1,
    // the guns (targeting.js)
    lock: null, // { id, out }: the hunter they're locked on to
    lockTarget: null, // and what it is this frame: { id, at, vel, size, kind }
    lead: null, // where to shoot to hit it: { x, y, z, t }
    hot: false, // the nose is near enough the lead that a shot bends onto it
    cycle: 0, // T was pressed: on to the next target (1), or Shift+T, back one (−1)
    hitMark: 0, // the reticle's flash as a shot lands, 1 fading to 0
    bias: [0, 0, 0], // the camera's lean toward the lock, eased (the map's own frame)
    pull: 0, // how hard the Maw has you (maw.js), 0 … 1
    pullSaid: false,
  };
  const t0 = performance.now();
  let engine = null;
  let well = null; // the Maw's hum, while it has you
  let infall = null; // the fall into it, drawn

  // The open part of the canvas: the panel covers the right side on a
  // desktop and the bottom on a phone (or, put away, a corner or a slim
  // bar), the nav the top.
  const panelEl = () => ctx.el.closest('.universe-page')?.querySelector('.universe-panel');
  const measure = () => {
    const box = ctx.el.getBoundingClientRect();
    const panel = panelEl()?.getBoundingClientRect();
    const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    let side = 0;
    let sheet = 0;
    if (panel && panel.width > 0) {
      // put away on a desktop, it's a bar up in the corner: the map has the width
      if (panel.width >= box.width * 0.75) sheet = Math.max(0, box.bottom - panel.top);
      else if (!panelEl().hasAttribute('data-tucked')) side = Math.max(0, box.right - panel.left);
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

  // A point in the map's own frame, in the turned one (the map's turn,
  // `yaw`, is applied to the planets, not the camera)
  const rotate = (x, z) => {
    const c = Math.cos(state.yaw);
    const s = Math.sin(state.yaw);
    return [x * c + z * s, -x * s + z * c];
  };

  // Flying, the camera works in views: { target, quat, dist } in the map's
  // own frame (so the map turning under it doesn't move it), the camera
  // `dist` back from `target` along the way `quat` looks. It rides with the
  // ship's own way round, rolls and all (`camQ`: easing after the ship, so
  // it swings round after it through a turn, a loop or a roll), and goes
  // from one view to the next (behind the ship, the cockpit, the whole map,
  // a crash) by easing the target, the distance and the way it looks
  // together, so it never flips over the top of a loop.
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const yawQ = new THREE.Quaternion();
  const lookM = new THREE.Matrix4();
  const shipQ = new THREE.Quaternion();
  const headQ = new THREE.Quaternion();
  const shipEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const camQ = new THREE.Quaternion();
  let camQOn = false; // (off: it's put straight onto the ship's, next frame)
  const TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.21); // looking down at the ship a little
  const leanQ = new THREE.Quaternion();
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const camF = new THREE.Vector3();
  const camU = new THREE.Vector3();
  const camR = new THREE.Vector3();
  const camP = new THREE.Vector3();
  const orientOf = (s, q) => q.setFromEuler(shipEuler.set(s.pitch || 0, s.heading, -(s.bank || 0), 'YXZ'));

  // a pose (flight.js's, in the turned frame) as a view
  const viewOfPose = (pose) => {
    const { position, target } = cameraFrom(pose);
    const t = new THREE.Vector3(...target);
    const quat = new THREE.Quaternion().setFromRotationMatrix(lookM.lookAt(camP.set(...position), t, Y_AXIS));
    yawQ.setFromAxisAngle(Y_AXIS, -state.yaw);
    return { target: t.applyQuaternion(yawQ), quat: quat.premultiply(yawQ), dist: pose.dist };
  };
  // and a view as near a pose as there is (for the things that start from
  // one: the dive into a planet, landing back on the overview)
  const poseOfView = (v) => {
    yawQ.setFromAxisAngle(Y_AXIS, state.yaw);
    const t = v.target.clone().applyQuaternion(yawQ);
    camF.set(0, 0, -1).applyQuaternion(v.quat).applyQuaternion(yawQ);
    return { target: t.toArray(), dist: v.dist, pitch: Math.asin(clamp(-camF.y, -0.999, 0.999)) };
  };
  const blendView = (a, b, k) => ({
    target: a.target.clone().lerp(b.target, k),
    quat: a.quat.clone().slerp(b.quat, k),
    dist: Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * k),
  });
  const applyView = (v) => {
    yawQ.setFromAxisAngle(Y_AXIS, state.yaw);
    camera.quaternion.copy(v.quat).premultiply(yawQ);
    camera.position.copy(v.target).applyQuaternion(yawQ).addScaledVector(camF.set(0, 0, -1).applyQuaternion(camera.quaternion), -v.dist);
    camera.updateMatrixWorld();
  };

  // The camera's own way round eases after the ship's (quickly in the
  // cockpit, where it's your head; as the settings say behind it). The map
  // turns with the way it looks, as far as it looks along the disc (so the
  // light stays where it was on the screen, and the whole map comes up the
  // way the ship was going)
  const follow = (dt) => {
    const s = state.ship;
    orientOf(s, shipQ);
    if (!camQOn || reduced) camQ.copy(shipQ);
    else camQ.slerp(shipQ, 1 - Math.exp(-dt * (state.view === 'cockpit' ? 20 : 4.5 * controls().camera)));
    camQOn = true;
    if (state.view === 'map' || (state.crash && !state.crash.back)) return;
    camF.set(0, 0, -1).applyQuaternion(camQ);
    const level = camF.x * camF.x + camF.z * camF.z;
    if (level > 1e-6) state.yaw += wrap(-Math.atan2(-camF.x, -camF.z) - state.yaw) * (1 - Math.exp(-dt * 8 * level));
  };

  // Behind the ship and a little above it (above as the ship sees it:
  // upside down, the camera's upside down too), looking past it the way it
  // points, further back the faster it goes; sliding out the way it leans
  // into a turn, so you see where it's going, and leaning a little toward
  // whatever the guns are locked on
  const chaseView = () => {
    const s = state.ship;
    camF.set(0, 0, -1).applyQuaternion(camQ);
    camU.set(0, 1, 0).applyQuaternion(camQ);
    camR.set(1, 0, 0).applyQuaternion(camQ);
    const [bx, by, bz] = state.bias;
    const target = new THREE.Vector3(s.x + bx, s.y + by, s.z + bz)
      .addScaledVector(camF, 0.4)
      .addScaledVector(camU, 0.06)
      .addScaledVector(camR, (s.lean || 0) * 0.45);
    return { target, quat: camQ.clone().multiply(TILT), dist: 1.7 + Math.min(Math.abs(s.speed), 30) * 0.045 + state.streak * 0.7 };
  };

  // From the pilot's seat: the eye a little ahead of the ship's middle and
  // above it, looking along the nose, the horizon tilting a little more with
  // the lean of a turn
  const cockpitView = () => {
    const s = state.ship;
    const quat = camQ.clone().multiply(leanQ.setFromAxisAngle(Z_AXIS, -(s.lean || 0) * 0.85));
    const eye = new THREE.Vector3(0, EYE.up, -EYE.ahead).applyQuaternion(camQ).add(camP.set(s.x, s.y, s.z));
    return { target: eye.addScaledVector(camF.set(0, 0, -1).applyQuaternion(quat), 1), quat, dist: 1 };
  };
  const cabFov = () => {
    const a = size.w / size.h;
    const vf = (2 * Math.atan(Math.tan((CAB_HFOV * Math.PI) / 360) / a) * 180) / Math.PI;
    return clamp(vf, CAB_VFOV[0], CAB_VFOV[1]);
  };

  const flying = () => Boolean(state.ship);
  // the whole map: the home system; out in deep space, the view pulls back
  // over the ship far enough to take in the sun (the way home) and the
  // places round it
  const mapPose = () => {
    const s = state.ship;
    const r = s ? Math.hypot(s.x, s.z) : 0;
    if (!state.overview || r < DEEP.system) return state.overview;
    const [wx, wz] = rotate(s.x * 0.55, s.z * 0.55);
    return { target: [wx, s.y * 0.5, wz], dist: clamp(r * 1.25, 140, 1400), pitch: 0.62 };
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

  // where the camera's going: with no ship, a pose (flight.js); flying, a view
  const goal = () => (state.sel ? focusPose(state.sel, state.yaw, size, state.rect) : state.overview);
  const flightView = () => {
    const whole = state.view === 'map' ? mapPose() : null;
    if (whole) return viewOfPose(whole);
    if (state.crash && !state.crash.back) return viewOfPose(crashPose());
    return state.view === 'cockpit' ? cockpitView() : chaseView();
  };

  const apply = (pose) => {
    const { position, target } = cameraFrom(pose);
    camera.position.set(...position);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateMatrixWorld();
  };

  // ── Where each planet is on screen: for the names and for picking ──
  const screen = planets.map((p) => ({ id: p.id, x: 0, y: 0, r: 0, z: -1 }));
  // and each of deep space's wonders (its reach, as a radius in px), for
  // picking one to fly to
  const wscreen = WONDERS.map((wd) => ({ id: wd.id, x: 0, y: 0, r: 0, z: -1 }));
  const hudPoint = new THREE.Vector3();
  const hudDepth = new THREE.Vector3();
  // a point in the map's space, on the canvas: x, y in px and z its depth in
  // front of the camera (behind it, the projection is mirrored)
  const toScreen = (x, y, z, out) => {
    map.localToWorld(hudPoint.set(x, y, z));
    out.z = -hudDepth.copy(hudPoint).applyMatrix4(camera.matrixWorldInverse).z;
    hudPoint.project(camera);
    out.x = ((hudPoint.x + 1) / 2) * size.w;
    out.y = ((1 - hudPoint.y) / 2) * size.h;
    return out;
  };
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
    if (flying()) {
      WONDERS.forEach((wd, i) => {
        const s = toScreen(wd.at[0], wd.at[1], wd.at[2], wscreen[i]);
        s.r = s.z > 0 ? (reachOf(wd) / (s.z * tanHalf)) * (size.h / 2) : 0;
      });
    }
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
      // (none while the ship falls into the Maw: nothing to pick, and the camera's going in)
      const off = Boolean(state.crash?.swallow) || s.z <= 0.3 || s.x < -60 || s.x > size.w + 60 || s.y < -60 || s.y > size.h + 60;
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
  // a wonder out in deep space under the point (while flying: somewhere to
  // go), the nearest first; a big one close by only round its middle
  const pickWonder = (px, py) => {
    if (!flying()) return null;
    let best = null;
    for (const s of wscreen) if (s.z > 0.3 && Math.hypot(px - s.x, py - s.y) <= Math.max(Math.min(s.r, 160), 24) && (!best || s.z < best.z)) best = s;
    return best?.id ?? null;
  };
  // a hunter under the point, or near it (they're small and quick): a tap
  // locks the guns on to the nearest
  const tapped = { x: 0, y: 0, z: 0 };
  const pickHunter = (px, py) => {
    if (!flying()) return null;
    let best = null;
    for (const c of [...(hunters?.targets ?? []), ...pilots.targets]) {
      toScreen(c.at.x, c.at.y, c.at.z, tapped);
      const d = Math.hypot(px - tapped.x, py - tapped.y);
      if (tapped.z > 0.3 && d <= 48 && (!best || d < best.d)) best = { id: c.id, d };
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
    if (flying()) {
      state.flight = null;
      state.blend = reduced || !state.cam || !dur ? null : { from: state.cam, start: performance.now(), dur };
      return;
    }
    state.flight = reduced || !state.pose ? null : startFlight(state.pose, performance.now(), dur);
  };

  const select = (id) => {
    if (id === state.sel) return;
    state.sel = id;
    if (flying()) {
      // the ship takes you there (or, with reduced motion, is simply there)
      if (id && id !== state.at) {
        state.view = state.seat;
        if (reduced) {
          state.ship = { ...state.ship, ...parkAt(id, [state.ship.x, state.ship.z]), speed: 0, vy: 0, lift: 0, pitch: 0, bank: 0, rate: 0, tipRate: 0, rollRate: 0, lean: 0 };
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

  // fly itself to a wonder out in deep space (a planet is select(), through
  // the page and its URL)
  const navTo = (id) => {
    const s = state.ship;
    if (!s || state.crash || props.frozen) return;
    // (the Maw's own spot is past its point of no return: to the edge of its pull instead)
    const park = id === MAW.id ? parkNear([s.x, s.z]) : parkAt(id, [s.x, s.z]);
    if (!park) return;
    heard();
    state.auto = { id, park };
    state.view = state.seat;
    state.lastInput = performance.now();
    if (!state.flown) {
      state.flown = true;
      emit({ type: 'launch' });
    }
    retarget(700);
    ctx.invalidate();
  };

  // ── The ship ──
  const heard = () => {
    // the first key or press: sound may start now
    if (!state.kind) return;
    audioContext();
    if (!engine) engine = shipEngine(state.kind);
  };

  // ── The cockpit view: the intro's cockpit, from the pilot's seat ──
  // (cockpit/vehicles builds it; its outside world isn't drawn here)
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const cabScene = new THREE.Scene();
  const camIn = new THREE.PerspectiveCamera(60, 1, 0.02, 60);
  cabScene.add(camIn);
  let cab = null; // { kind, built, plan, look } once a cockpit is built
  let cabWanted = null; // the kind on its way
  let roomEnv = null;
  const dropCab = () => {
    post.overlay(null);
    if (!cab) return;
    cabScene.remove(cab.built.inside);
    cab.built.dispose?.();
    disposeTree(cab.built.inside);
    disposeTree(cab.built.outside);
    if (cabScene.environment && cabScene.environment !== roomEnv) cabScene.environment.dispose?.();
    cabScene.environment = null;
    freeKit();
    cab = null;
  };
  const buildCab = async (kind) => {
    if (!kind || !CABS[kind] || cabWanted === kind || cab?.kind === kind) return;
    cabWanted = kind;
    try {
      const mod = await CABS[kind]();
      if (disposed || cabWanted !== kind) return;
      if (!roomEnv) {
        const pm = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        roomEnv = pm.fromScene(room, 0.04).texture;
        pm.dispose();
      }
      const pmrem = new THREE.PMREMGenerator(renderer);
      const built = await mod.build({ renderer, pmrem, rich: tier === 'high' && !coarse, reduced, coarse, say: () => {} });
      pmrem.dispose();
      if (disposed || cabWanted !== kind) {
        built.dispose?.();
        disposeTree(built.inside);
        disposeTree(built.outside);
        return;
      }
      dropCab();
      cabScene.add(built.inside);
      cabScene.environment = built.environment ?? roomEnv;
      cabScene.environmentIntensity = built.envIntensity ?? 0.35;
      camIn.position.set(...built.eye);
      await warm(cabScene, camIn, cabScene); // now, and off the main thread, not on its first frame
      if (disposed || cabWanted !== kind) {
        cabScene.remove(built.inside);
        built.dispose?.();
        disposeTree(built.inside);
        disposeTree(built.outside);
        return;
      }
      cab = { kind, built, plan: cockpitPlan(kind), look: { yaw: 0, pitch: 0 } };
      cabWanted = null;
      ctx.invalidate();
    } catch (err) {
      if (import.meta.env.DEV) console.error('[universe] cockpit', err);
      if (cabWanted === kind) cabWanted = null;
    }
  };
  // where you ride: behind the ship, or in its cockpit (kept between visits)
  const setSeat = (seat) => {
    if (seat === state.seat) return;
    state.seat = seat;
    remembered.set(SEAT_KEY, seat);
    if (flying() && state.view !== 'map') {
      state.view = seat;
      retarget(800);
    }
    if (seat === 'cockpit') buildCab(state.kind);
    ctx.invalidate();
  };
  // the cockpit each frame it's shown: the same lens as the world's, a
  // little head (into the turn, toward the lock), its own life
  const cabFrame = (dt, t) => {
    const s = state.ship;
    const look = cab.look;
    // (rotateY's positive is a look to the left: the way a left turn goes,
    // and the other way from something off to the right)
    let wantYaw = (s.rate || 0) * 0.05;
    if (state.lockTarget) {
      // (where it is as the ship sees it, whichever way up it is)
      const at = state.lockTarget.at;
      camP.set(at.x - s.x, at.y - s.y, at.z - s.z).applyQuaternion(orientOf(s, headQ).invert());
      wantYaw += clamp(Math.atan2(-camP.x, -camP.z) * 0.2, -0.16, 0.16);
    }
    const k = 1 - Math.exp(-dt * 4);
    look.yaw += (wantYaw - look.yaw) * k;
    look.pitch += ((s.tipRate || 0) * -0.012 - look.pitch) * k;
    camIn.projectionMatrix.copy(camera.projectionMatrix);
    camIn.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    camIn.rotation.set(look.pitch + (reduced ? 0 : Math.sin(t * 0.7) * 0.003), look.yaw + (reduced ? 0 : Math.sin(t * 0.43) * 0.004), 0);
    camIn.updateMatrixWorld();
    cab.built.update(dt, t, { launching: false, t: 0, phase: null, throttle: 0, plan: cab.plan, look });
  };

  const setShip = (kind) => {
    if (kind === state.kind) return;
    engine?.stop();
    engine = null;
    well?.stop();
    well = null;
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
    dropCab();
    cabWanted = null;
    if (kind && state.seat === 'cockpit') buildCab(kind);
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
      loadModel(SHIP_MODELS[kind])
        .then((m) => m && warm(m).then(() => m))
        .then((m) => {
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
      camQOn = false;
      state.at = state.sel && orbiting(state.ship, null) === state.sel ? state.sel : null;
      state.yaw = -state.ship.heading;
    }
    state.view = state.seat;
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
      state.view = state.seat;
      retarget(700);
    }
  };

  // the visitor's flying settings (controls.js), as the page last passed them
  const controls = () => props.controls ?? CONTROL_DEFAULTS;
  const steering = () => {
    const c = controls();
    let { throttle, turn, climb, roll } = keyAxes(state.keys, c);
    climb += state.climbBtn;
    const st = state.stick;
    if (st?.on) {
      const d = stickInput(st.dx, st.dy, c, st.pointer);
      throttle += d.throttle;
      turn += d.turn;
      climb += d.climb;
      roll += d.roll;
    }
    return {
      throttle: clamp(throttle, -1, 1),
      turn: clamp(turn, -1, 1),
      climb: clamp(climb, -1, 1),
      roll: clamp(roll, -1, 1),
      boost: Boolean(state.keys.boost || state.boostBtn),
      turnRate: c.turn,
      pitchRate: c.pitch,
      rollRate: c.roll,
      level: c.level,
    };
  };

  // a shot from the nose (the X-wing's from each wingtip in turn): along
  // the nose, bent onto the lead point when the guns are locked on and the
  // nose is near enough to it (targeting.js, as much as the aim-assist
  // setting allows); held, the guns keep firing at the ship's own pace
  const fire = () => {
    const s = state.ship;
    const now = performance.now();
    if (!s || props.frozen || state.crash || now - state.lastShot < (CADENCE[state.kind] ?? 0.18) * 1000) return;
    state.lastShot = now;
    state.lastInput = now;
    const b = bolts.find((m) => !m.visible) ?? bolts[0];
    const [fx, fz] = forward(s.heading);
    const side = state.kind === 'xwing' ? (state.side = -state.side) * 0.12 : 0;
    let dir = nose(s);
    if (state.lead && state.lead.t <= AIM.life) dir = assist(dir, dirTo(s, state.lead), controls().assist);
    const { heading, pitch } = aimAngles(dir);
    b.position.set(s.x + dir[0] * 0.16 - fz * side, s.y + dir[1] * 0.16, s.z + dir[2] * 0.16 + fx * side);
    b.rotation.set(pitch, heading, 0);
    const v = AIM.bolt + Math.max(0, s.speed);
    b.userData = { life: AIM.life, v: [dir[0] * v, dir[1] * v, dir[2] * v] };
    b.visible = true;
    net?.shot(b.position, b.userData.v);
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
        state.hitMark = 1; // the reticle flashes
        if (hh.down) {
          emit({ type: 'kill', kind: hh.kind });
          state.heat += 1;
          if (!reduced) state.shake = Math.max(state.shake, 0.2);
        }
        continue;
      }
      // another pilot: they're told, and it comes off their shields
      const ph = pilots.hit(shotFrom, b.position);
      if (ph) {
        b.visible = false;
        pops.hit({ point: ph.at, normal: popDir.set(-d.v[0], 3, -d.v[2]).normalize(), radius: 0.2 });
        state.hitMark = 1;
        net?.hit(ph.id);
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
    const on = flying() && state.view !== 'map' && !state.crash && !state.dive && !props.frozen;
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
    const k = Math.min(1, (Math.hypot(st.dx, st.dy) * controls().drag) / STICK);
    const a = Math.atan2(st.dy, st.dx);
    el.style.setProperty('--kx', `${(Math.cos(a) * k * 28).toFixed(1)}px`);
    el.style.setProperty('--ky', `${(Math.sin(a) * k * 28).toFixed(1)}px`);
  };

  // ── The HUD: the gun line, the lock, the lead and the way to go ──
  // (DOM in UniverseMap.jsx, moved here as the scene draws, like the names)
  let hud = { root: null };
  const hudEls = () => {
    const root = props.hud?.current ?? null;
    if (root !== hud.root) {
      const q = (c) => root?.querySelector(c) ?? null;
      hud = { root, reticle: q('.universe-reticle'), lock: q('.universe-lock'), lockName: q('.universe-lock-name'), lockDist: q('.universe-lock-dist'), lead: q('.universe-lead'), nav: q('.universe-nav'), navName: q('.universe-nav-name'), navDist: q('.universe-nav-dist'), threats: [...(root?.querySelectorAll('.universe-threat') ?? [])], text: new Map(), on: new Map() };
    }
    return hud;
  };
  const setText = (h, el, s) => {
    if (!el || h.text.get(el) === s) return;
    h.text.set(el, s);
    el.textContent = s;
  };
  const setOn = (h, el, on) => {
    if (!el || h.on.get(el) === on) return;
    h.on.set(el, on);
    el.toggleAttribute('data-on', on);
  };
  const hudAt = { x: 0, y: 0, z: 0 };
  const threatList = [];
  // a bracket at its point when that's in view, else an arrow at the edge of
  // the open area pointing the way (its size `r`, in px, when it has one)
  const placeMark = (el, p, r = 0) => {
    const off = !onScreen(p.x, p.y, p.z, state.rect);
    let x = p.x;
    let y = p.y;
    if (off) {
      const cx = state.rect.x + state.rect.w / 2;
      const cy = state.rect.y + state.rect.h / 2;
      const k = p.z > 0 ? 1 : -1;
      const edge = edgeOf((p.x - cx) * k, (p.y - cy) * k, state.rect);
      x = edge.x;
      y = edge.y;
      el.style.setProperty('--a', `${edge.angle.toFixed(3)}rad`);
    }
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    el.toggleAttribute('data-off', off);
    if (r) el.style.setProperty('--r', `${Math.round(r)}px`);
  };
  const range = (d) => (d < 10 ? d.toFixed(1) : Math.round(d).toString());
  // where you're going: the autopilot's goal, the picked place you're not
  // yet at, or, out in deep space with nowhere picked, the nearest wonder
  // ahead (as a waypoint, fainter)
  const navGoal = (s) => {
    const id = state.auto?.id ?? (state.sel && state.sel !== state.at ? state.sel : null);
    if (id) return { id, way: false };
    if (openness(s.x, s.y, s.z) < 0.25) return null;
    let best = null;
    for (const wd of WONDERS) {
      const d = Math.hypot(s.x - wd.at[0], s.y - wd.at[1], s.z - wd.at[2]);
      if (d > 1300 || d < reachOf(wd) * 1.3) continue;
      const [nx, ny, nz] = nose(s);
      const ahead = ((wd.at[0] - s.x) * nx + (wd.at[1] - s.y) * ny + (wd.at[2] - s.z) * nz) / d;
      if (ahead < 0.45) continue; // within about 63° of the nose
      const score = d * (2 - ahead);
      if (!best || score < best.score) best = { id: wd.id, way: true, score };
    }
    return best;
  };
  const placeHud = () => {
    const h = hudEls();
    if (!h.root) return;
    const s = state.ship;
    const on = flying() && state.view !== 'map' && !state.crash && !state.dive && !props.frozen;
    // the gun line: a little way out along the nose (not while it flies itself)
    const [nx, ny, nz] = on ? nose(s) : [0, 0, 0];
    const retOn = on && !state.auto;
    setOn(h, h.reticle, retOn);
    if (retOn) {
      toScreen(s.x + nx * 6, s.y + ny * 6, s.z + nz * 6, hudAt);
      h.reticle.style.transform = `translate3d(${hudAt.x.toFixed(1)}px, ${hudAt.y.toFixed(1)}px, 0)`;
      h.reticle.toggleAttribute('data-hot', state.hot);
      h.reticle.toggleAttribute('data-hit', state.hitMark > 0);
    }
    // the lock: brackets round the hunter, its name and range; the lead pip
    // where a shot would meet it
    const tgt = on ? state.lockTarget : null;
    setOn(h, h.lock, Boolean(tgt));
    if (tgt) {
      toScreen(tgt.at.x, tgt.at.y, tgt.at.z, hudAt);
      const px = hudAt.z > 0 ? (tgt.size / (hudAt.z * tanHalf)) * (size.h / 2) * 2.6 : 0;
      placeMark(h.lock, hudAt, clamp(px, 30, 140));
      h.lock.toggleAttribute('data-hot', state.hot);
      setText(h, h.lockName, tgt.name ?? NAMES[tgt.kind] ?? tgt.kind);
      setText(h, h.lockDist, range(Math.hypot(tgt.at.x - s.x, tgt.at.y - s.y, tgt.at.z - s.z)));
      // what it has left, for the ones that take a few hits
      const tough = (tgt.hpMax ?? 1) > 1;
      h.lock.toggleAttribute('data-tough', tough);
      if (tough) h.lock.style.setProperty('--hp', (tgt.hp / tgt.hpMax).toFixed(3));
    }
    // the ones coming at you that you can't see: an arrow at the edge each
    // (nearest first), so a fight behind you isn't a surprise
    let n = 0;
    if (on && hunters && h.threats.length) {
      const cands = hunters.targets;
      threatList.length = 0;
      for (const c of cands) if (c.threat && c.id !== tgt?.id) threatList.push(c);
      threatList.sort((a, b) => Math.hypot(a.at.x - s.x, a.at.y - s.y, a.at.z - s.z) - Math.hypot(b.at.x - s.x, b.at.y - s.y, b.at.z - s.z));
      for (const c of threatList) {
        if (n >= h.threats.length) break;
        toScreen(c.at.x, c.at.y, c.at.z, hudAt);
        if (onScreen(hudAt.x, hudAt.y, hudAt.z, state.rect)) continue;
        const el = h.threats[n++];
        setOn(h, el, true);
        placeMark(el, hudAt);
      }
    }
    for (let i = n; i < h.threats.length; i++) setOn(h, h.threats[i], false);
    const lead = tgt && state.lead && state.lead.t <= AIM.life ? state.lead : null;
    let leadOn = false;
    if (lead) {
      toScreen(lead.x, lead.y, lead.z, hudAt);
      leadOn = onScreen(hudAt.x, hudAt.y, hudAt.z, state.rect, 8);
      if (leadOn) {
        h.lead.style.transform = `translate3d(${hudAt.x.toFixed(1)}px, ${hudAt.y.toFixed(1)}px, 0)`;
        h.lead.toggleAttribute('data-hot', state.hot);
      }
    }
    setOn(h, h.lead, leadOn);
    // the way to go
    const goal = on ? navGoal(s) : null;
    setOn(h, h.nav, Boolean(goal));
    if (goal) {
      const place = isPlace(goal.id) ? byId(goal.id) : null;
      const wd = place ? null : wonderById(goal.id);
      const at = place ? POSITIONS[goal.id] : wd.at;
      toScreen(at[0], at[1], at[2], hudAt);
      const reach = place ? REACH[goal.id] : reachOf(wd);
      const px = hudAt.z > 0 ? (reach / (hudAt.z * tanHalf)) * (size.h / 2) * 2.2 : 0;
      placeMark(h.nav, hudAt, clamp(px, 34, 260));
      h.nav.toggleAttribute('data-way', goal.way);
      setText(h, h.navName, place ? place.label : wd.name);
      setText(h, h.navDist, range(Math.hypot(at[0] - s.x, at[1] - s.y, at[2] - s.z)));
    }
  };

  // ── A crash: into something too fast ──
  const startCrash = (e) => {
    const s = state.ship;
    const solid = SOLIDS.find((o) => o.id === e.id);
    const center = new THREE.Vector3(...solid.at);
    const from = new THREE.Vector3(s.x, s.y, s.z);
    const normal = from.clone().sub(center).normalize();
    // into a wonder, it's a crash of its own kind
    const wonder = wonderById(e.id) ?? (e.id.includes('-') ? wonderById(e.id.split('-')[0]) : null);
    // (a wonder with a world of its own, the Citadel, crashes under its own name)
    const kind = !wonder || wonder.id !== e.id ? null : wonder.kind === 'star' ? 'star' : wonder.kind.endsWith('giant') ? 'giant' : wonder.world ? wonder.id : null;
    const swallow = Boolean(e.swallowed);
    state.crash = {
      age: 0, // seconds of frames since the hit (a hidden tab pauses it)
      id: e.id,
      sun: e.id === 'sun' || kind === 'star',
      kind,
      world: wonder?.world ?? null,
      colour: kind === 'giant' ? wonder.colors[0] : null,
      swallow, // into the black hole: the fall, then on through to what's beyond it
      fall: swallow ? startFall([s.x, s.y, s.z], camLocal.toArray()) : null, // (maw.js)
      fell: null, // where the ship is in it (fallAt)
      yaw: 0, // the way the camera looks at it, while it falls (below)
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
    state.interdicted = false;
    burst.clear();
    engine?.set({ speed: 0, boost: false, on: false });
    if (swallow) {
      // pulled well back, to watch it go down (maw.js says from where)
      const [vx, , vz] = state.crash.fall.view;
      state.crash.yaw = -headingTo(-vx, -vz);
      state.view = 'chase'; // (from outside, whichever seat you were in)
      hunters?.clear();
      infall?.dispose();
      infall = createInfall(map, { color: (PLUME[state.kind] ?? PLUME.falcon).color, shadow: MAW.shadow, at: MAW.at });
      infall.start();
      retarget(reduced ? 0 : 1700);
      emit({ type: 'crash', id: e.id, swallowed: true }); // (said as the fall begins: there's no impact to wait for)
    } else retarget(650); // the camera pulls back to watch it
  };
  // ── Shot down: the hunters' lasers (or another pilot's, `by`) took the
  // last of the shields ──
  const startDestroyed = (by = null) => {
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
    if (by) net?.down(by); // everyone hears who got you
    emit({ type: 'destroyed' });
    retarget(650);
  };

  // a laser into the shields: down they go (shot down at nothing left).
  // `by`: the pilot whose shot it was, if it was one
  const hurt = (damage, by = null) => {
    if (state.crash || !state.ship) return;
    if (by && state.clock < state.safeUntil) return;
    state.shield = Math.max(0, state.shield - damage);
    state.hitAt = state.clock;
    state.hurt = 1;
    if (!reduced) state.shake = Math.max(state.shake, 0.3);
    emit({ type: 'laser' });
    if (state.shield < 35 && !state.lowSaid) {
      state.lowSaid = true;
      emit({ type: 'shields' });
    }
    if (state.shield <= 0) startDestroyed(by);
  };

  // what the link to the other pilots reports: their hits on you, and
  // someone going down (a pop where they were; yours, if it was your shot)
  const onNet = (e) => {
    if (e.type === 'hit') hurt(e.damage, e.from);
    else if (e.type === 'downed') {
      const at = pilots.at(e.id);
      if (at) pops.hit({ point: at, normal: new THREE.Vector3(0, 1, 0), radius: 0.55 });
      if (e.by && e.by === net?.selfId) {
        emit({ type: 'kill', kind: 'pilot' });
        if (!reduced) state.shake = Math.max(state.shake, 0.2);
      }
    }
    ctx.invalidate();
  };
  const setNet = (client) => {
    if (client === net) return;
    netOff?.();
    net = client ?? null;
    netOff = net?.on(onNet) ?? null;
  };

  // whose universe each ship flies in (Walt and Jesse's RV: both)
  const FAMILY = { cruiser: 'rickmorty', xwing: 'starwars', falcon: 'starwars', rv: 'both' };
  const either = () => (Math.random() < 0.5 ? 'starwars' : 'rickmorty');
  const TRENCHED = SOLIDS.filter((o) => o.band); // what has a trench to fly down
  // what the hunters report
  const onHunters = (e) => {
    if (e.type === 'hunted') {
      if (!e.prey) emit({ type: 'hunted', faction: e.faction, ace: e.kinds.includes('tieadvanced') });
      // dropped in ahead of you on the way somewhere: they hold the pulse
      // drive down while they're on you (a jolt as it cuts)
      if (e.interdict && !state.interdicted && state.ship) {
        state.interdicted = true;
        state.interdictAt = state.clock;
        if (!reduced) {
          state.flare = Math.max(state.flare, 1.8);
          state.shake = Math.max(state.shake, 0.6);
          state.kick = 1;
        }
        emit({ type: 'interdicted', faction: e.faction });
      }
    } else if (e.type === 'laser') hurt(e.damage);
    else if (e.type === 'shot') emit(e);
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
  // on the way somewhere (out in the open at speed), a pack comes in ahead
  // of you and interdicts you: an ambush
  const travelling = (s) => openness(s.x, s.y, s.z) > 0.5 && Math.abs(s.speed) > 40;
  const happen = (id, ship) => {
    const family = FAMILY[state.kind] === 'both' ? either() : FAMILY[state.kind];
    const ambush = travelling(ship) ? { ahead: true, interdict: true } : {};
    if (id === 'hunt') hunters.pack(family === 'starwars' ? 'empire' : 'federation', ship, ambush);
    else if (id === 'council') pieces.portals(hunters.pack('council', ship, ambush));
    else if (id === 'destroyer') {
      const d = pieces.destroyer(ship);
      if (!d) return;
      emit({ type: 'event', id: 'destroyer' });
      // its fighters launch a moment after it's here
      later.push({ at: state.clock + 2.4, run: () => state.ship && !state.crash && hunters.pack('empire', state.ship, { from: d.hangar, size: 3, ace: Math.random() < 0.35, interdict: ambush.interdict }) });
    } else if (id === 'distress') {
      const prey = traffic?.distress(ship, family);
      if (!prey) return;
      hunters.pack(family === 'starwars' ? 'empire' : 'bugs', ship, { prey, size: 2, ace: false });
      emit({ type: 'event', id: 'distress' });
    } else if (id === 'convoy') traffic?.convoy(ship, family);
    else if (id === 'comet') {
      pieces.comet(ship);
      later.push({ at: state.clock + 5, run: () => emit({ type: 'event', id: 'comet' }) });
    } else if (id === 'supernova') {
      // the nearest site that's still a good way off (so it's a sight, not a blast)
      const sites = SUPERNOVA_SITES.map((at) => ({ at, d: Math.hypot(at[0] - ship.x, at[1] - ship.y, at[2] - ship.z) })).filter((o) => o.d > 220).sort((a, b) => a.d - b.d);
      const site = (sites[Math.floor(Math.random() * Math.min(2, sites.length))] ?? sites[0])?.at;
      if (!site) return;
      novae.explode(site, { color: ['#9fc6ff', '#ffd9a0', '#ffffff'][Math.floor(Math.random() * 3)] });
      later.push({ at: state.clock + 2.2, run: () => emit({ type: 'event', id: 'supernova' }) });
    }
  };

  // the light bending round the black hole: where it is on the canvas and
  // how big its shadow looks there (none behind you, or too far to matter),
  // how far off its near side is (what's nearer, the ship, isn't bent), and
  // its spin's twist, and the shadow's edge (inside it nothing gets out, not
  // even the bloom's glow off the ring). Close in, the bending's held back,
  // or its shadow would fill the screen from a long way off and hide
  // everything round it; falling in after the ship, it's let go, and the
  // shadow takes the screen
  const lensAt = new THREE.Vector3();
  const lensCam = new THREE.Vector3();
  const bend = () => {
    const L = deep.lens?.();
    if (!L || reduced) return post.lens(0, 0, 0);
    map.localToWorld(lensAt.copy(L.at));
    const d = lensAt.distanceTo(camera.position);
    const plunge = state.crash?.swallow ? plungeAt(state.crash.age) : 0;
    if (d < L.r * 1.05) return post.lens(0.5, 0.5, 4, { front: 0, black: 9 }); // in past it: nothing but black
    const front = Math.min(lensAt.clone().applyMatrix4(camera.matrixWorldInverse).z * -1 - L.r * 1.6, 250);
    lensAt.project(camera);
    if (d > 700 || lensAt.z > 1 || Math.abs(lensAt.x) > 1.6 || Math.abs(lensAt.y) > 1.6) return post.lens(0, 0, 0);
    const z = L.r / (d * tanHalf) / 2; // (as a share of the canvas's height)
    const held = z / Math.sqrt(1 + (z / 0.3) ** 2);
    const r = held + (z - held) * plunge;
    // the shadow's edge on the canvas: the sphere's, pushed out by the bending
    const S = Math.tan(Math.asin(Math.min(1, L.r / d))) / tanHalf / 2;
    const edge = (S + Math.sqrt(S * S + 4 * r * r)) / 2;
    // turned the way its disk goes round, as seen from this side of it
    map.worldToLocal(lensCam.copy(camera.position)).sub(L.at);
    const facing = Math.sign(lensCam.dot(new THREE.Vector3(...DISK_N))) || 1;
    const twist = -(0.1 + 0.45 * state.pull + 1.6 * plunge) * facing;
    post.lens((lensAt.x + 1) / 2, (lensAt.y + 1) / 2, r, { front, twist, black: edge });
  };

  // the shields bar: shown while there's trouble about or they're down at all
  let shieldOn = false;
  const placeShield = () => {
    const el = props.shield?.current;
    if (!el) return;
    const on = flying() && state.view !== 'map' && !state.crash && !state.dive && !props.frozen && Boolean(hunters?.active || state.shield < 99.5);
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
        const id = director.update(dt, { family: FAMILY[state.kind] ?? null, heat: state.heat, busy: hunters.active || pieces.destroyerHere || state.view === 'map', travelling: travelling(live) });
        if (id) happen(id, live);
        // the drive comes back once they're off you (or have had their go)
        if (state.interdicted && (!hunters.active || state.clock - state.interdictAt > INTERDICT)) state.interdicted = false;
      }
      for (const l of [...later]) {
        if (state.clock < l.at) continue;
        later.splice(later.indexOf(l), 1);
        l.run();
      }
      // out into deep space, and coming up on its wonders
      if (!state.deepSaid && openness(live.x, live.y, live.z) > 0.6) {
        state.deepSaid = true;
        emit({ type: 'event', id: 'deep' });
      }
      for (const w of WONDERS) {
        if (state.saw.has(w.id) || Math.hypot(live.x - w.at[0], live.y - w.at[1], live.z - w.at[2]) > reachOf(w) * 1.6 + 60) continue;
        state.saw.add(w.id);
        emit({ type: 'wonder', id: w.id });
      }
      // down in the Death Star's trench a moment: the trench run (with Luke
      // or Han, Vader comes down it after you), now and then
      const ds = TRENCHED.find((o) => Math.abs(live.y - o.at[1]) < o.band.half && Math.hypot(live.x - o.at[0], live.y - o.at[1], live.z - o.at[2]) < o.r - 0.4);
      state.trench = ds ? state.trench + dt : 0;
      if (state.trench > 1.2 && state.clock - state.trenchAt > 120) {
        state.trenchAt = state.clock;
        emit({ type: 'event', id: 'trench' });
        if (hunters && FAMILY[state.kind] !== 'rickmorty' && !hunters.active) hunters.pack('empire', live, { size: 3, ace: true });
      }
    } else {
      later.length = 0;
      state.interdicted = false;
    }
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
    if (c.swallow) {
      // well off and nearly level with the disk (maw.js), the whole of the
      // hole in view while the ship goes down it; then in after it: its
      // shadow grows steadily over the screen (as one over the distance)
      // till it's all of it, and on in through it
      const k = plungeAt(c.age);
      const near = MAW.shadow * 2.2;
      const dist = k < 0.8 ? 1 / (1 / MAW.witness + (1 / near - 1 / MAW.witness) * (k / 0.8) ** 1.3) : near + (MAW.shadow * 0.5 - near) * ((k - 0.8) / 0.2);
      const [wx, wz] = rotate(MAW.at[0], MAW.at[2]);
      return { target: [wx, MAW.at[1], wz], dist, pitch: Math.asin(clamp(c.fall.view[1], -0.95, 0.95)) };
    }
    const [wx, wz] = rotate(c.point.x, c.point.z);
    return { target: [wx, c.point.y, wz], dist: c.radius * 2.4 + 2.6, pitch: 0.42 };
  };
  // the fall into the black hole (maw.js): round and down its disk, faster
  // and faster, nose first and drawn out thin (spaghetti, as Rick says),
  // rolling as it goes; then held at the edge of the shadow, shrinking as
  // its light fades, and gone. No impact and nothing thrown out: nothing
  // comes back out of it. The camera pulls back to watch (crashPose)
  const NOSE = new THREE.Vector3(0, 0, -1);
  const along = new THREE.Vector3();
  const swallowing = (dt) => {
    const c = state.crash;
    const m = state.model;
    const s = fallAt(c.fall, reduced ? MAW.horizon : c.age);
    c.fell = s;
    // the camera comes round to where it watches from. The map turns about
    // its middle, far off, so where the camera's flying from turns with it
    // (or the view would swing off into empty space)
    const turn = state.view !== 'map' ? wrap(c.yaw - state.yaw) * clamp01(dt * 1.6) : 0;
    if (Math.abs(turn) > 1e-6) {
      state.yaw += turn;
      const f = state.flight;
      if (f) {
        const [x, y, z] = f.from.target;
        const [cs, sn] = [Math.cos(turn), Math.sin(turn)];
        f.from = { ...f.from, target: [x * cs + z * sn, y, -x * sn + z * cs] };
      }
    }
    if (!s.gone) {
      m.group.position.set(...s.at);
      m.group.quaternion.setFromUnitVectors(NOSE, along.set(...s.dir));
      m.pivot.rotation.z += dt * (1.2 + s.stretch * 9);
      const fade = s.held ? s.glow : 1;
      const thin = (1 - s.stretch * 0.85) * fade;
      m.group.scale.set(thin, thin, (1 + s.stretch * 8) * fade);
    } else if (!c.impact) {
      c.impact = true;
      m.group.visible = false;
      m.group.scale.setScalar(1);
      m.group.quaternion.identity();
      m.pivot.rotation.set(0, 0, 0);
    }
  };
  const crashing = (dt) => {
    const c = state.crash;
    c.age += dt;
    const age = c.age;
    const m = state.model;
    const T = c.swallow ? FALL : c.kind === 'giant' ? DIVE : CRASH;
    updatePlumes(dt, (performance.now() - t0) / 1000, 0); // the engines are out
    if (c.swallow) swallowing(dt);
    else if (age < T.impact) {
      // on into it, tumbling, a little way under the surface (into a giant,
      // down into the clouds)
      const k = age / T.impact;
      const depth = k * k * (c.kind === 'giant' ? SHIP.radius + 2.5 : SHIP.radius + 0.25);
      m.group.position.copy(c.from).addScaledVector(c.into, depth);
      m.group.position.x += c.fwd[0] * k * 0.1;
      m.group.position.z += c.fwd[1] * k * 0.1;
      m.pivot.rotation.x += dt * c.spin[0];
      m.pivot.rotation.z += dt * c.spin[1];
    } else if (!c.impact) {
      c.impact = true;
      m.group.visible = false;
      crashFx.hit({ point: c.point, normal: c.normal, body: planetOf[c.id]?.surface ?? null, radius: c.radius, sun: c.sun, colour: c.colour });
      state.shake = reduced ? 0 : c.kind === 'giant' ? 1.4 : 1;
      state.flare = reduced ? 1 : c.sun ? 2.6 : 2;
      if (!c.shot) emit({ type: 'crash', id: c.id, kind: c.kind ?? undefined }); // (shot down said so as it began)
    }
    if (age >= (c.swallow && reduced ? 0.3 : T.through) && !c.asked && !c.sun && !c.shot && (isPlace(c.id) || c.world || c.swallow)) {
      // the shockwave running out over the surface (or the ship gone into
      // the black hole): the page takes it from here, if it's going on into
      // the place's page (a wonder with a world of its own, the Citadel,
      // takes you into that), or on through to what's beyond the hole
      c.asked = true;
      c.through = Boolean(props.onCrash?.(c.world ?? c.id));
    }
    if (c.through) return true; // the camera holds on the crater till the page goes
    if (age >= T.back && !c.back) {
      // back again: parked off the planet on the side it hit (well clear of the sun)
      c.back = true;
      let at;
      if (c.shot) {
        // shot down: back at the nearest place, shields up again
        const near = ORDER.reduce((a, b) => (Math.hypot(...POSITIONS[a].map((v, i) => v - c.from.getComponent(i))) <= Math.hypot(...POSITIONS[b].map((v, i) => v - c.from.getComponent(i))) ? a : b));
        at = parkAt(near, [c.from.x, c.from.z]);
      } else if (c.sun || !isPlace(c.id)) {
        // the sun (or a star), or a wonder out in deep space: back out the way it went in, facing away
        const solid = SOLIDS.find((o) => o.id === c.id) ?? { at: SUN.at, r: SUN.r };
        const out = c.from.clone().sub(new THREE.Vector3(...solid.at));
        if (c.id === 'sun') out.y = 0;
        out.normalize();
        const r = solid.r + 5;
        at = { x: solid.at[0] + out.x * r, y: c.id === 'sun' ? SHIP.height : solid.at[1] + out.y * r, z: solid.at[2] + out.z * r, heading: headingTo(out.x, out.z) };
      } else at = parkAt(c.id, [c.from.x, c.from.z]);
      state.ship = { ...state.ship, x: at.x, y: at.y, z: at.z, heading: at.heading, speed: 0, vy: 0, lift: 0, pitch: 0, bank: 0, rate: 0, tipRate: 0, rollRate: 0, lean: 0, edge: false };
      camQOn = false; // (the camera's straight on behind it)
      if (c.swallow) {
        // (the page didn't take it on through: back out past the Maw's reach)
        const out = new THREE.Vector3(c.from.x - MAW.at[0], 0, c.from.z - MAW.at[2]).normalize();
        Object.assign(state.ship, { x: MAW.at[0] + out.x * (MAW.reach + 10), y: MAW.at[1], z: MAW.at[2] + out.z * (MAW.reach + 10), heading: headingTo(out.x, out.z) });
        infall?.clear();
        state.view = state.seat;
        m.group.scale.setScalar(1);
        m.group.quaternion.identity();
      }
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
      const k = clamp01((age - T.back) / (T.done - T.back));
      const s = state.ship;
      m.group.position.set(s.x, s.y, s.z);
      m.group.rotation.set(s.pitch || 0, s.heading, -(s.bank || 0), 'YXZ');
      const grow = 1 - (1 - k) ** 3;
      m.group.scale.set(grow, grow, state.kind === 'cruiser' ? grow : grow * (1 + (1 - k) * 5));
    }
    if (age >= T.done) {
      state.crash = null;
      state.safeUntil = state.clock + SAFE;
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
    input.interdicted = state.interdicted;
    if (state.keys.fire || state.fireBtn) fire(); // (the trigger held: at the guns' own pace)
    const { ship: stepped, events } = step(state.ship, input, dt);
    // the Maw's pull (maw.js): drawn in, and carried round with its disk
    const g = pullAt(stepped.x, stepped.y, stepped.z);
    const ship = g ? { ...stepped, x: stepped.x + g.v[0] * dt, y: stepped.y + g.v[1] * dt, z: stepped.z + g.v[2] * dt } : stepped;
    state.ship = ship;
    state.pull = g?.k ?? 0;
    for (const e of events) {
      if (e.type !== 'crash') emit(e);
      else if (!state.crash) startCrash(e);
    }
    if (state.crash) return true;
    if (g) {
      if (!state.pullSaid && g.k > 0.3) {
        state.pullSaid = true;
        emit({ type: 'pulled' });
      }
      // the hum of it, and the ship shaking in its grip
      if (!well && engine) well = wellSound();
      well?.set(g.k);
      if (!reduced) state.shake = Math.max(state.shake, Math.max(0, g.k - 0.2) * 0.55);
      // past the point of no return: the fall
      if (captured(ship.x, ship.y, ship.z)) {
        startCrash({ id: MAW.id, swallowed: true, speed: ship.speed });
        return true;
      }
    } else {
      state.pullSaid = false;
      well?.set(0);
    }

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

    // the guns: what they're locked on to (a tick as they pick one up),
    // where to shoot to hit it, and whether the nose is near enough to it
    // that a shot bends onto it
    const cands = pilots.count ? [...(hunters?.targets ?? []), ...pilots.targets] : (hunters?.targets ?? []);
    const was = state.lock?.id ?? null;
    state.lock = cands.length || state.lock ? track(ship, cands, state.lock, dt, { cycle: state.cycle }) : null;
    state.cycle = 0;
    const tgt = state.lock ? (cands.find((c) => c.id === state.lock.id) ?? null) : null;
    state.lockTarget = tgt;
    if (tgt && tgt.id !== was && state.shown && !document.hidden) lockSound();
    state.lead = tgt ? intercept(ship, AIM.bolt + Math.max(0, ship.speed), tgt.at, tgt.vel) : null;
    // (hot: a shot now would bend all the way onto it)
    state.hot = Boolean(state.lead && state.lead.t <= AIM.life && assistAmount(nose(ship), dirTo(ship, state.lead), controls().assist) >= 1);
    // and the camera leans a little toward the lock (eased, so a lock coming
    // or going doesn't jolt it)
    let bx = 0;
    let by = 0;
    let bz = 0;
    if (tgt && !reduced) {
      const vx = tgt.at.x - ship.x;
      const vy = tgt.at.y - ship.y;
      const vz = tgt.at.z - ship.z;
      const l = Math.hypot(vx, vy, vz) || 1;
      const k = Math.min(0.3, l * 0.08) / l;
      bx = vx * k;
      by = vy * k;
      bz = vz * k;
    }
    const ease = 1 - Math.exp(-dt * 3);
    state.bias[0] += (bx - state.bias[0]) * ease;
    state.bias[1] += (by - state.bias[1]) * ease;
    state.bias[2] += (bz - state.bias[2]) * ease;

    const m = state.model;
    m.update(t);
    m.group.visible = state.cabK < 0.6; // (from inside, the ship is the cockpit)
    m.group.position.set(ship.x, ship.y + (reduced ? 0 : Math.sin(t * 2.1) * 0.012), ship.z);
    // which way round it is, exactly (loops, rolls, upside down); inside
    // that, the lean into a turn and a dip of the nose with the throttle
    m.group.rotation.set(ship.pitch || 0, ship.heading, -(ship.bank || 0), 'YXZ');
    m.pivot.rotation.set(reduced ? 0 : clamp(-input.throttle * 0.06, -0.08, 0.08), 0, -(ship.lean || 0));
    m.setThrottle(clamp01(Math.abs(ship.speed) / SHIP.cruise) * (0.7 + state.streak * 0.3));
    updatePlumes(dt, t, clamp01((ship.speed - 0.5) / SHIP.cruise) * (0.7 + 0.3 * state.streak), 1 + state.streak * 1.3);
    engine?.set({ speed: Math.min(ship.speed, SHIP.boost * 1.2), boost: state.streak > 0.3, on: state.shown && !props.frozen && !document.hidden });
    // sitting still a good while: the crew notice
    if (!state.idleSaid && !state.auto && Math.abs(ship.speed) < 0.05 && state.shown && !document.hidden && performance.now() - state.lastInput > IDLE) {
      state.idleSaid = true;
      emit({ type: 'idle' });
    }
    return Boolean(
      state.auto ||
        g ||
        input.throttle ||
        input.turn ||
        input.climb ||
        input.roll ||
        Math.abs(ship.speed) > 0.01 ||
        Math.abs(ship.vy) > 0.01 ||
        Math.abs(ship.rate || 0) > 0.002 ||
        Math.abs(ship.tipRate || 0) > 0.002 ||
        Math.abs(ship.rollRate || 0) > 0.002 ||
        Math.abs(ship.lean || 0) > 0.002 ||
        state.streak > 0.01 ||
        state.lock ||
        camQ.angleTo(shipQ) > 0.002 ||
        Math.hypot(...state.bias) > 0.001,
    );
  };

  // ── Frames ──
  const still = () => reduced || state.low;
  let last = 0;

  function render(ms, now) {
    gl.watch(now);
    const dt = ms / 1000;
    const t = reduced ? 0 : state.low ? state.tLow : (now - t0) / 1000;
    if (!state.pose && !flying()) {
      // first frame: straight onto a universe from a link; the overview
      // drifts in from a little further out (flying, it's below)
      if (state.sel) {
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
    if (flying() && !state.dive) follow(dt);
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
    } else if (!flying()) {
      const r = poseAt(state.flight, goal(), now);
      pose = r.pose;
      if (r.done) state.flight = null;
    }
    if (pose) {
      state.blend = null;
      state.pose = pose;
      apply(pose);
      state.cam = viewOfPose(pose);
    } else {
      // flying: riding with the ship (first frame: straight in behind it
      // parked at a universe from a link, or in from a little way out over
      // the overview)
      if (!state.cam && !state.sel && !reduced && state.overview) {
        const o = state.overview;
        state.blend = { from: viewOfPose({ target: [...o.target], dist: o.dist * 1.35, pitch: o.pitch + 0.12 }), start: now, dur: 1800 };
      }
      const to = flightView();
      let view = to;
      if (state.blend) {
        const k = clamp01((now - state.blend.start) / state.blend.dur);
        if (k >= 1) state.blend = null;
        else view = blendView(state.blend.from, to, easeOut(k));
      }
      state.cam = view;
      applyView(view);
      state.pose = poseOfView(view);
    }
    // into the cockpit and out of it: the ship fades from view and the
    // cockpit takes its place, and your head turns a little (the cockpit
    // with it); the horizon rolls with the ship, all the way round
    const cabWant = flying() && state.view === 'cockpit' && !state.crash && !state.dive ? 1 : 0;
    const cabWas = state.cabK;
    state.cabK += (cabWant - state.cabK) * (reduced ? 1 : 1 - Math.exp(-dt * 5));
    if (Math.abs(state.cabK - cabWant) < 0.002) state.cabK = cabWant;
    const inCab = flying() && state.cabK > 0.001 && !state.crash;
    if (inCab && cab) {
      camera.rotateY(cab.look.yaw * state.cabK);
      camera.updateMatrixWorld();
    }
    // boosting, the lens widens (so the speed shows at the edges), with a
    // kick as a boost lights; the cockpit's lens is the intro's, wider; and
    // going in after the ship into the Maw, it widens as it goes
    const baseWant = flying() && state.view === 'cockpit' ? cabFov() : FOV;
    state.fovBase += (baseWant - state.fovBase) * (reduced ? 1 : 1 - Math.exp(-dt * 5));
    const plunging = state.crash?.swallow ? plungeAt(state.crash.age) : 0;
    const fov = state.fovBase + (reduced || !flying() || state.view === 'map' ? 0 : 8 * state.streak ** 1.4 + 4 * state.kick * (1 - state.kick * 0.5) + 18 * plunging ** 2);
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
    const fxBusy = crashBusy || popBusy || Boolean(state.crash?.swallow);
    if (traffic) {
      for (const e of traffic.update(dt, t, flying() && !state.crash && !state.dive ? state.ship : null)) {
        if (e.event === 'convoy') emit({ type: 'event', id: 'convoy' });
        else if (!e.event) emit(e); // (someone in distress said so as they came)
      }
    }
    const adventuring = adventure(dt, t);

    // (the streaks' speed tops out at the boost's: at the pulse drive's
    // they'd be a wall; and none in the map view, which isn't the ship's)
    streak.update(dt, state.ship ? Math.min(Math.abs(state.ship.speed), STREAK_SPEED) : 0, state.view === 'map' ? 0 : state.streak);
    const bursting = burst.update(dt);
    // a supernova going: its flash lights the whole sky a moment
    const novaBusy = novae.update(t, dt, camera);
    const nova = novaBusy ? novae.nova() : null;
    if (nova && nova.k > 0.6 && !reduced) state.flare = Math.max(state.flare, 1 + nova.k * 0.6);
    if (!reduced && flying() && state.view === 'cockpit' && state.streak > 0.001) {
      // from the pilot's seat: out from the middle of the view
      post.rush(state.streak * 0.8, (state.rect.x + state.rect.w / 2) / size.w, 1 - (state.rect.y + state.rect.h / 2) / size.h);
    } else if (!reduced && flying() && state.view === 'chase' && state.streak > 0.001 && state.model) {
      // out from the ship, where it is on the canvas
      state.model.group.getWorldPosition(v).project(camera);
      post.rush(state.streak, (v.x + 1) / 2, (v.y + 1) / 2);
    } else post.rush(0);
    // the orbits fade while you fly down among them (edge-on they'd be stripes)
    const ringsWant = flying() && state.view !== 'map' ? 0.012 : 0.05;
    rings.material.opacity += (ringsWant - rings.material.opacity) * clamp01(dt * 3);
    const shooting = moveBolts(dt);
    sun.update(t, camera);
    stars.material.uniforms.uTime.value = t;
    for (const p of planets) p.update(t, camera);
    locate();
    placeLabels();
    if (state.hitMark > 0) state.hitMark = Math.max(0, state.hitMark - dt * 4);
    // the other pilots: where you are, out to them; where they are, drawn
    if (net) {
      const s = flying() ? state.ship : null;
      net.pose(s, { hidden: Boolean(state.crash || state.dive || props.frozen), boost: state.streak > 0.3, safe: state.clock < state.safeUntil, shield: state.shield });
    }
    const piloting = pilots.update(dt, now, net, { project: toScreen, tags: props.tags?.current ?? null, locked: state.lockTarget?.peer ?? null });
    placeHud();
    // the sky and the far stars stay round the camera, wherever it flies;
    // the dust rides with it too, and shows while you fly (more, the faster)
    map.updateMatrixWorld();
    map.worldToLocal(camLocal.copy(camera.position));
    deep.update(t, camera, camLocal);
    beacons.update(camLocal);
    // the fall into the Maw: the ship's trail and glow, and its last light
    if (infall) {
      if (state.crash?.swallow && !state.crash.back) infall.update(dt, state.crash.fell, camLocal, camera);
      else infall.clear();
    }
    for (const tr of trenches) if (camLocal.distanceTo(tr.group.position) < 700) tr.wake();
    bend();
    if (sky) sky.position.copy(camLocal);
    stars.position.copy(camLocal);
    const dustWant = !reduced && flying() && state.view !== 'map' ? 0.35 + 0.65 * clamp01(Math.abs(state.ship.speed) / SHIP.cruise) : 0;
    dustAmount += (dustWant - dustAmount) * clamp01(dt * 3);
    dust.update(camLocal, dustAmount, gl.ratio);
    belt.update(t);
    // the cockpit over the world, once the camera's in the seat
    const showCab = Boolean(cab && cab.kind === state.kind && flying() && state.view === 'cockpit' && state.cabK > 0.6 && !state.crash);
    if (showCab) cabFrame(dt, t);
    post.overlay(showCab ? cabScene : null, camIn);
    renderer.info.reset(); // counted over the whole frame, post passes and all
    post.render(size.w, size.h);
    last = now;

    if (state.dive) return now - state.dive.start < DIVE_MS; // then the page takes over
    if (state.crash?.through) return true; // the crater glows on while the page washes out
    if (props.frozen) return false;
    return !still() || moving || shooting || fxBusy || bursting || novaBusy || adventuring || piloting || net?.peers.size > 0 || state.kick > 0 || state.hitMark > 0 || cabWas !== state.cabK || Math.abs(state.fovBase - baseWant) > 0.01 || pulseAt || traffic?.count > 0 || state.flare > 1 || Boolean(state.flight || state.drag || state.vel || state.stick?.on || state.yawTo !== null || state.blend);
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
      state.view = state.view === 'map' ? state.seat : 'map';
      retarget(900);
      ctx.invalidate();
      return;
    }
    if (key === 'v') {
      // the other seat: the cockpit, or behind the ship
      e.preventDefault();
      heard();
      setSeat(state.seat === 'cockpit' ? 'chase' : 'cockpit');
      return;
    }
    if (key === 'f') {
      // the trigger, held: the guns keep firing at their own pace (fly())
      e.preventDefault();
      heard();
      if (!e.repeat) fire();
      state.keys.fire = true;
      ctx.invalidate();
      return;
    }
    if (key === 't' || key === 'q') {
      // the next target round the nose (Q, or Shift+T, the one before)
      e.preventDefault();
      heard();
      state.cycle = key === 'q' || e.shiftKey ? -1 : 1;
      ctx.invalidate();
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
    state.fireBtn = false;
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
        state.stick = { id: e.pointerId, x: d.x, y: d.y, dx: x - d.x, dy: y - d.y, on: true, pointer: e.pointerType };
        placeStick();
      } else {
        const now = performance.now();
        state.yawTo = null;
        const turn = TURN * controls().drag;
        state.yaw = d.yaw + (x - d.x) * turn;
        state.vel = ((x - d.lastX) * turn) / Math.max(1, now - d.lastT);
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
    canvas.style.cursor = sign || id || (!id && pickWonder(x, y)) ? 'pointer' : 'grab';
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
      else if (flying()) {
        // a hunter: the guns lock on to it (picked by hand, so it holds a good
        // while even off the nose); a wonder: the ship flies itself there
        const hid = pickHunter(x, y);
        if (hid) {
          heard();
          state.lock = { id: hid, out: 0, manual: true };
        } else {
          const wid = pickWonder(x, y);
          if (wid) navTo(wid);
        }
      }
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
  setNet(props.net);
  paintStates();

  // a ship of every kind that may come (the hunters, the traffic, the set
  // pieces' big ships, as built until their models load), out of sight, so
  // their shaders are made with everything else's; and then every shader
  // the map draws with, its passes' too, made before the first frame (the
  // page waits for them, so the first look round doesn't stall)
  const spares = new THREE.Group();
  spares.visible = false;
  if (!reduced) {
    const kinds = new Set([...Object.values(FACTIONS).flatMap((f) => [...f.kinds.map(([k]) => k), f.ace].filter(Boolean)), ...BUILT_KINDS, ...Object.keys(GLB).filter((k) => GLB[k].built)]);
    for (const k of kinds) spares.add(buildTraffic(k).group);
  }
  map.add(spares);
  const ready = Promise.all([warm(scene), post.composer ? precompilePasses(renderer, post.composer, camera) : null]).then(() => {
    // made: out of the scene (so nothing walks them each frame), but kept
    // till the end, so their shaders are kept too
    map.remove(spares);
  });

  // in development, renderer counts and the ship, for checking from a browser
  if (import.meta.env.DEV) {
    window.__universeDebug = { THREE, post, scene, renderer, camera, traffic, hunters, director, pieces, novae, pilots, state };
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
      seat: state.seat,
      cab: cab ? cab.kind : cabWanted ? `loading ${cabWanted}` : null,
      crash: state.crash && { id: state.crash.id, age: state.crash.age },
      shield: +state.shield.toFixed(1),
      heat: +state.heat.toFixed(2),
      hunters: hunters?.packs ?? [],
      lock: state.lock?.id ?? null,
      manual: Boolean(state.lock?.manual),
      controls: controls(),
      pilots: pilots.targets.map((p) => ({ id: p.peer, name: p.name, kind: p.kind, at: p.at.toArray().map((v) => +v.toFixed(2)) })),
      online: net?.snapshot().status ?? null,
      lead: state.lead && { x: +state.lead.x.toFixed(2), y: +state.lead.y.toFixed(2), z: +state.lead.z.toFixed(2), t: +state.lead.t.toFixed(2), hot: state.hot },
      signs: signs.map(({ id, x0, y0, x1, y1, z }) => ({ id, x0, y0, x1, y1, z })),
      last,
    });
  }

  return {
    // every shader made (the page waits for it before the first frame)
    ready,
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
      setNet(next.net);
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
    // the phone's fire button: true pressed (it fires, and keeps firing
    // while held), false let go
    fire(down = true) {
      heard();
      state.fireBtn = down;
      if (down) fire();
      ctx.invalidate();
    },
    // the phone's boost button
    boost(on) {
      heard();
      state.boostBtn = on;
      if (on) takeover();
      ctx.invalidate();
    },
    // the phone's View button: the other seat (the cockpit, or behind the ship)
    seat() {
      heard();
      setSeat(state.seat === 'cockpit' ? 'chase' : 'cockpit');
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
        state.view = state.seat;
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
      well?.stop();
      infall?.dispose();
      dropCab();
      roomEnv?.dispose();
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
      for (const el of props.hud?.current?.children ?? []) el.removeAttribute('data-on');
      if (import.meta.env.DEV) delete window.__universe, delete window.__universeDebug;
      disposeTree(spares);
      crashFx.dispose();
      pops.dispose();
      hunters?.dispose();
      netOff?.();
      pilots.dispose();
      pieces.dispose();
      fleet.dispose();
      deep.dispose();
      for (const tr of trenches) tr.dispose();
      beacons.dispose();
      novae.dispose();
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
