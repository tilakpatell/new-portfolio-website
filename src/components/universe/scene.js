// The universe map in WebGL: the planets on a tilted disc among the stars,
// a faint orbit for each, and a camera that flies between them (flight.js
// does the numbers; this only copies them onto the camera). The planets'
// names are DOM buttons that React renders once; the scene moves them in the
// frames it draws, so nothing re-renders per frame.
//
// A scene module for lib/three/useScene: create(canvas, ctx) returns
// { resize, render, update, lowerQuality, hover, dive, dispose }.
// Props: selected (an id or null), labels (a ref to { id: element }),
// frozen (the page is leaving: stop drawing), onPick(id).

import * as THREE from 'three';
import { capturePointer } from '../../lib/pointer';
import { clamp01, createRenderer, disposeTree } from '../../lib/three/renderer';
import { DIVE_MS, FOV, cover, cameraFrom, focusPose, overviewPose, poseAt, startFlight, worldPos } from './flight';
import { ORDER, POSITIONS } from './layout';
import { buildPlanet, loadModels } from './planets';
import { byId } from './universes';

const STARS = 2600;
const STARS_LOW = 900;
const TURN = 0.0042; // radians of map per px dragged
const DRAG = 6; // px a press may move and still be a click
const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // key light, upper left

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
    // a shell round the map, thicker below the disc than above it
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

export function create(canvas, ctx) {
  const { reduced } = ctx;
  let props = ctx;
  let disposed = false;

  const gl = createRenderer(canvas, { ratio: 2, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 600);
  const map = new THREE.Group(); // turned by the drag (yaw); the camera never turns round it
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

  const planets = ORDER.map((id) => {
    const p = buildPlanet(byId(id));
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
  };
  const t0 = performance.now();

  // The open part of the canvas: the panel covers the right side on a
  // desktop and the bottom on a phone, the nav the top.
  const measure = () => {
    const box = ctx.el.getBoundingClientRect();
    const panel = ctx.el.closest('.universe-page')?.querySelector('.universe-panel')?.getBoundingClientRect();
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

  const goal = () => (state.sel ? focusPose(state.sel, state.yaw, size, state.rect) : state.overview);

  const apply = (pose) => {
    const { position, target } = cameraFrom(pose);
    camera.position.set(...position);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateMatrixWorld();
  };

  // ── Where each planet is on screen: for the names and for picking ──
  const screen = planets.map((p) => ({ id: p.id, x: 0, y: 0, r: 0, z: -1 }));
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
  };

  const placeLabels = () => {
    const els = props.labels?.current;
    if (!els) return;
    for (const s of screen) {
      const el = els[s.id];
      if (!el) continue;
      const off = s.z <= 0 || s.x < -60 || s.x > size.w + 60 || s.y < -60 || s.y > size.h + 60;
      // tucked behind a nearer planet
      const behind = screen.some((o) => o !== s && o.z > 0 && o.z < s.z && Math.hypot(o.x - s.x, o.y - s.y) < o.r * 0.9);
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

  const pick = (px, py) => {
    let best = null;
    for (const s of screen) {
      if (s.z <= 0) continue;
      if (Math.hypot(px - s.x, py - s.y) <= Math.max(s.r * 1.3, 18) && (!best || s.z < best.z)) best = s;
    }
    return best?.id ?? null;
  };

  const paintStates = () => {
    for (const p of planets) p.setState({ hover: state.hover === p.id, selected: state.sel === p.id });
    const els = props.labels?.current;
    if (els) for (const [id, el] of Object.entries(els)) el?.toggleAttribute('data-hover', state.hover === id);
  };

  const setHover = (id) => {
    if (id === state.hover) return;
    state.hover = id;
    paintStates();
    ctx.invalidate();
  };

  const select = (id, now = performance.now()) => {
    if (id === state.sel) return;
    state.sel = id;
    // from wherever the camera is now, even mid-flight; reduced motion cuts
    state.flight = reduced || !state.pose ? null : startFlight(state.pose, now);
    paintStates();
    ctx.invalidate();
  };

  // ── Frames ──
  const still = () => reduced || state.low;
  let last = 0;

  function render(ms, now) {
    gl.watch(now);
    const t = reduced ? 0 : state.low ? state.tLow : (now - t0) / 1000;
    if (!state.pose) {
      // first frame: straight onto a universe from a link; the overview
      // drifts in from a little further out
      const to = goal();
      if (state.sel || reduced) state.pose = to;
      else {
        state.pose = { target: [...to.target], dist: to.dist * 1.35, pitch: to.pitch + 0.12 };
        state.flight = startFlight(state.pose, now, 1800);
      }
    }
    if (!state.drag && state.vel && !reduced) {
      state.yaw += state.vel * ms;
      state.vel *= 0.0035 ** (ms / 1000);
      if (Math.abs(state.vel) < 2e-6) state.vel = 0;
    }
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
    } else {
      const r = poseAt(state.flight, goal(), now);
      pose = r.pose;
      if (r.done) state.flight = null;
    }
    state.pose = pose;
    apply(pose);

    for (const p of planets) p.update(t, camera);
    locate();
    placeLabels();
    renderer.render(scene, camera);
    last = now;

    if (state.dive) return now - state.dive.start < DIVE_MS; // then the page takes over
    if (props.frozen) return false;
    const moving = Boolean(state.flight || state.drag || state.vel);
    return !still() || moving;
  }

  // ── Pointer: drag turns the map, a click picks a planet ──
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (state.drag || state.dive) return;
    const [x, y] = local(e);
    capturePointer(e, canvas);
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
      const now = performance.now();
      state.yaw = d.yaw + (x - d.x) * TURN;
      state.vel = ((x - d.lastX) * TURN) / Math.max(1, now - d.lastT);
      d.lastX = x;
      d.lastT = now;
      canvas.style.cursor = 'grabbing';
      ctx.invalidate();
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const id = pick(x, y);
    canvas.style.cursor = id ? 'pointer' : 'grab';
    setHover(id);
  };
  const onUp = (e) => {
    const d = state.drag;
    if (!d || d.id !== e.pointerId) return;
    state.drag = null;
    canvas.style.cursor = 'grab';
    if (d.moved < DRAG) {
      state.vel = 0;
      const [x, y] = local(e);
      const id = pick(x, y);
      if (id) props.onPick?.(id);
    } else if (performance.now() - d.lastT > 80) state.vel = 0; // let go after holding still
    ctx.invalidate();
  };
  const onCancel = (e) => {
    if (state.drag?.id !== e.pointerId) return;
    state.drag = null;
    state.vel = 0;
    canvas.style.cursor = 'grab';
    ctx.invalidate();
  };
  const onLeave = (e) => {
    if (e.pointerType === 'mouse' && !state.drag) setHover(null);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);

  paintStates();

  // in development, renderer counts for checking the budget from a browser
  if (import.meta.env.DEV) {
    window.__universe = () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      ratio: gl.ratio,
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
    },
    render,
    update(next) {
      props = next;
      select(next.selected ?? null);
      if (next.frozen && !state.dive) state.drag = null;
    },
    lowerQuality() {
      state.tLow = (performance.now() - t0) / 1000;
      state.low = true;
      stars.geometry.setDrawRange(0, STARS_LOW);
      ctx.invalidate();
    },
    // a name under the pointer lights its planet too
    hover: setHover,
    // fly into a planet; the page fades to it and goes after `ms`
    dive(id) {
      if (reduced || !planetOf[id] || !state.pose) return 0;
      state.dive = { id, start: performance.now(), from: { ...state.pose, target: [...state.pose.target] } };
      state.flight = null;
      ctx.invalidate();
      return DIVE_MS;
    },
    dispose() {
      disposed = true;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      if (import.meta.env.DEV) delete window.__universe;
      disposeTree(scene);
      gl.dispose();
    },
  };
}
