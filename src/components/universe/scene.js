// The universe map in WebGL: the planets on a tilted disc among the stars,
// a faint orbit for each, and the planets' names as DOM buttons that React
// renders once and the scene moves as it draws (nothing re-renders per
// frame).
//
// Two ways to get round it:
// - With no ship picked, the camera flies between the planets (flight.js
//   does the numbers), a drag turns the map and a click picks a planet.
// - With a ship (Rick's cruiser, Luke's X-wing or the Falcon), you fly it:
//   W A S D or the arrows, Space to boost, or drag on the map like a stick.
//   The camera rides behind it. Fly close to a planet and you're at it (the
//   panel shows its card); pick one from its name or by clicking it and the
//   ship flies itself there. M shows the whole map. ship.js has the physics.
//
// A scene module for lib/three/useScene: create(canvas, ctx) returns
// { resize, render, update, setVisible, lowerQuality, hover, dive, escape,
//   whole, boost, dispose }.
// Props: selected (an id or null), ship (a crew id or null), labels (a ref
// to { id: element }), stick (a ref to the steering ring), frozen (the page
// is leaving: stop drawing), onPick(id), onOpen(id) (a station's sign was
// clicked: go to its page), onEvent(event), onLand().

import * as THREE from 'three';
import { capturePointer } from '../../lib/pointer';
import { audioContext } from '../../lib/audio';
import { clamp01, createRenderer, disposeTree } from '../../lib/three/renderer';
import { DIVE_MS, FOV, cover, cameraFrom, focusPose, overviewPose, poseAt, startFlight, worldPos } from './flight';
import { ORDER, POSITIONS } from './layout';
import { buildPlanet, buildSun, loadModel, loadModels, loadTextures } from './planets';
import { SHIP, autopilot, forward, orbiting, parkAt, spawn, step } from './ship';
import { buildShip } from './shipModels';
import { shipEngine } from './sounds';
import { byId } from './universes';

const STARS = 2600;
const STARS_LOW = 900;
const STREAKS = 220;
const TURN = 0.0042; // radians of map per px dragged
const DRAG = 6; // px a press may move and still be a click
const STICK = 70; // px of drag for full throttle or a full turn
const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // key light, upper left

const KEYS = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', ' ': 'boost', shift: 'boost' };
const ARROWS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ']);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const STAR_VERT = `
attribute float aSize;
attribute vec3 aColor;
uniform float uDpr;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uDpr * (260.0 / -mv.z), 1.0, 6.0 * uDpr);
  vColor = aColor;
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
  const tints = [
    [1, 1, 1],
    [0.78, 0.86, 1],
    [1, 0.9, 0.78],
  ];
  for (let i = 0; i < STARS; i++) {
    // a shell round the map, flatter than a sphere
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = 90 + rand() * 120;
    const s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * r, u * r * 0.8, Math.sin(a) * s * r], i * 3);
    const b = 0.25 + rand() ** 3 * 0.75;
    const t = tints[rand() < 0.75 ? 0 : rand() < 0.5 ? 1 : 2];
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
    size[i] = 0.7 + rand() ** 4 * 2.2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: { uDpr: { value: 1 } },
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
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#9fb0d0', transparent: true, opacity: 0.1, depthWrite: false }));
}

// Stars streaming past when the ship boosts: lines round the camera's line
// of sight, riding with the camera.
function streaks(rand) {
  const seg = new Float32Array(STREAKS * 6);
  const at = [];
  for (let i = 0; i < STREAKS; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.5 + rand() * 2.6;
    at.push([Math.cos(a) * r, Math.sin(a) * r * 0.7, -2 - rand() * 14]);
  }
  const g = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(seg, 3).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', attr);
  const mat = new THREE.LineBasicMaterial({ color: '#cfe3ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.LineSegments(g, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  return {
    lines,
    update(dt, speed, amount) {
      lines.visible = amount > 0.01;
      mat.opacity = amount * 0.7;
      if (!lines.visible) return;
      const len = 0.3 + speed * 0.12;
      for (let i = 0; i < STREAKS; i++) {
        const p = at[i];
        p[2] += speed * dt * 2.2;
        if (p[2] > 1) p[2] -= 16;
        seg.set([p[0], p[1], p[2], p[0], p[1], p[2] - len], i * 6);
      }
      attr.needsUpdate = true;
    },
  };
}

export async function create(canvas, ctx) {
  const { reduced } = ctx;
  let props = ctx;
  let disposed = false;

  const gl = createRenderer(canvas, { ratio: 2, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 600);
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
  map.add(orbits());
  const streak = streaks(rand);
  camera.add(streak.lines);

  // the planets' maps first (half size on a phone), so nothing pops in
  const small = (window.matchMedia?.('(pointer: coarse)').matches ?? false) || Math.min(window.innerWidth, window.innerHeight) < 600 || (navigator.deviceMemory ?? 8) <= 4;
  const T = await loadTextures({ small });

  // the sun in the middle, warming the stations round it
  const sun = buildSun(T);
  map.add(sun.group);
  const sunLight = new THREE.PointLight('#ffd6a8', 7, 10, 1.4);
  map.add(sunLight);

  const planets = ORDER.map((id) => {
    const p = buildPlanet(byId(id), T);
    p.group.position.set(...POSITIONS[id]);
    map.add(p.group);
    return p;
  });
  const planetOf = Object.fromEntries(planets.map((p) => [p.id, p]));

  // the models arrive after the map is up
  loadModels((id, model) => {
    if (disposed) {
      disposeTree(model);
      return;
    }
    if (!planetOf[id]?.mount(model)) disposeTree(model);
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
    boosting: false,
    boosts: 0,
    streak: 0,
    flown: false, // has anyone touched the controls yet
    shown: true,
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
    const look = 0.9;
    return {
      target: [wx + dx * look, s.y + 0.1, wz + dz * look],
      dist: 2.7 + Math.abs(s.speed) * 0.2 + state.streak * 0.9,
      pitch: 0.24,
    };
  };

  const flying = () => Boolean(state.ship);
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
    if (flying()) return state.view === 'map' ? state.overview : chasePose();
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
  const tanHalf = Math.tan((FOV * Math.PI) / 360);

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
          state.ship = { ...state.ship, ...parkAt(id, [state.ship.x, state.ship.z]), speed: 0 };
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
      disposeTree(state.model.group);
      state.model = null;
    }
    const was = state.kind;
    state.kind = kind;
    state.auto = null;
    state.flown = false;
    if (!kind) {
      state.ship = null;
      state.at = null;
      state.yaw = 0;
      retarget();
      return;
    }
    state.model = buildShip(kind, T);
    map.add(state.model.group);
    if (kind === 'cruiser') {
      loadModel('/games/meshy/cruiser.glb').then((m) => {
        if (!m) return;
        if (disposed || state.kind !== 'cruiser' || !state.model?.mount(m)) disposeTree(m);
        ctx.invalidate();
      });
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
    const st = state.stick;
    if (st?.on) {
      throttle = clamp(throttle - st.dy / STICK, -1, 1);
      turn = clamp(turn + st.dx / STICK, -1, 1);
    }
    return { throttle, turn, boost: Boolean(k.boost || state.boostBtn) };
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

  const fly = (dt, t) => {
    let input;
    if (state.auto) {
      const a = autopilot(state.ship, state.auto.id, state.auto.park);
      input = a.input;
      if (a.done) state.auto = null;
    } else input = steering();
    const { ship, events } = step(state.ship, input, dt);
    state.ship = ship;
    for (const e of events) emit(e);

    // a burst of speed
    const boosting = input.boost && input.throttle > 0 && ship.speed > SHIP.cruise * 0.7;
    if (boosting && !state.boosting) emit({ type: 'boost', first: state.boosts++ === 0 });
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
      } else if (left && state.sel === left && !target) {
        state.sel = null;
        props.onPick?.(null);
      }
      paintStates();
    }

    // the camera swings round behind the ship (not in the map view)
    if (state.view === 'chase') state.yaw += wrap(-ship.heading - state.yaw) * clamp01(dt * (reduced ? 12 : 4.5));

    const m = state.model;
    m.group.position.set(ship.x, ship.y + (reduced ? 0 : Math.sin(t * 2.1) * 0.012), ship.z);
    m.group.rotation.y = ship.heading;
    m.pivot.rotation.z = -ship.bank;
    m.pivot.rotation.x = reduced ? 0 : clamp(-input.throttle * 0.06, -0.08, 0.08);
    m.setThrottle(clamp01(Math.abs(ship.speed) / SHIP.cruise) * (0.7 + state.streak * 0.3));
    engine?.set({ speed: ship.speed, boost: state.streak > 0.3, on: state.shown && !props.frozen && !document.hidden });
    return Boolean(state.auto || input.throttle || input.turn || Math.abs(ship.speed) > 0.01 || state.streak > 0.01 || Math.abs(wrap(-ship.heading - state.yaw)) > 0.002);
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

    streak.update(dt, state.ship ? Math.abs(state.ship.speed) : 0, state.streak);
    sun.update(t);
    for (const p of planets) p.update(t, camera);
    locate();
    placeLabels();
    renderer.render(scene, camera);
    last = now;

    if (state.dive) return now - state.dive.start < DIVE_MS; // then the page takes over
    if (props.frozen) return false;
    return !still() || moving || Boolean(state.flight || state.drag || state.vel || state.stick?.on || state.yawTo !== null);
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
      ctx.invalidate();
    },
    // a name under the pointer lights its planet too
    hover: setHover,
    // the phone's boost button
    boost(on) {
      heard();
      state.boostBtn = on;
      if (on) takeover();
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
      if (import.meta.env.DEV) delete window.__universe;
      disposeTree(scene);
      gl.dispose();
    },
  };
}
