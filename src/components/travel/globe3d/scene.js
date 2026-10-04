// The travel globe in WebGL: the same dotted halftone as the 2D Globe.jsx
// (land as dots from the Fibonacci lattice, visited countries lit in the
// accent, routes from home), with real depth. The dots lie on the sphere and
// foreshorten toward the rim, the far side shows faintly through the near
// one, the atmosphere is a tint of the accent at the rim, and the routes are
// lifted arcs that tuck behind the sphere. It behaves like the 2D globe: drag
// with inertia, idle spin, fly-to, zoom (buttons, keys, wheel and pinch), hover
// and tap on places and countries, and the same pin and tooltip.
//
// A scene module for lib/three/useScene: create(canvas, ctx) returns
// { resize, render, setColors, update, dispose, zoom, reset }.

import * as THREE from 'three';
import { HOME, PLACES } from '../../../data/places';
import { capturePointer } from '../../../lib/pointer';
import { clamp01, color, createRenderer, disposeTree, easeInOut, easeOut } from '../../../lib/three/renderer';
import { ARC_STEPS, RAD, countryName, countryOf, globeData } from './data';
import * as S from './shaders';

const MIN_SCALE = 1;
const MAX_SCALE = 2.6;
const LAT_MIN = -60;
const LAT_MAX = 70;
const START = { lon: -38, lat: 24, scale: 1 };
const FOV = 20; // a long lens: depth without a fisheye
const FILL = 0.84; // the sphere's share of the canvas at scale 1, as in 2D
const DOT = 0.0068; // a land dot's radius, in globe radii (perspective adds the rest)
const MAX_ARCS = 32; // room in the shader's per-arc uniforms
const HALO_WIDTH = 0.17; // how far the atmosphere reaches past the rim
const LIGHT = new THREE.Vector3(-0.55, 0.65, 0.55).normalize(); // key light, upper left

const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const clampLat = (v) => Math.max(LAT_MIN, Math.min(LAT_MAX, v));
const clampScale = (s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

export function create(canvas, ctx) {
  const data = globeData();
  const { reduced } = ctx;
  const memory = ctx.memory ?? {};
  let props = ctx;

  const gl = createRenderer(canvas, { ratio: 2, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
  const globe = new THREE.Group(); // turned so the view's lon/lat faces the camera
  scene.add(globe);

  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', ctx.label ?? 'Globe');
  canvas.style.cursor = 'grab';

  // Theme colours, shared by every material's uniforms
  const col = {
    text: new THREE.Color(),
    accent: new THREE.Color(),
    surface: new THREE.Color(),
    surface2: new THREE.Color(),
    border: new THREE.Color(),
  };
  const tone = { land: 0.3, far: 0.12, halo: 0.11, rim: 0.07, line: 0.3 };

  // ── The sphere and its atmosphere ──
  const bodyMat = new THREE.ShaderMaterial({
    vertexShader: S.bodyVert,
    fragmentShader: S.bodyFrag,
    uniforms: {
      uSurface: { value: col.surface },
      uSurface2: { value: col.surface2 },
      uAccent: { value: col.accent },
      uBorder: { value: col.border },
      uLight: { value: LIGHT },
      uRim: { value: tone.rim },
      uLine: { value: 0.4 },
    },
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), bodyMat);
  scene.add(body);

  // a card at the sphere's middle plane; the sphere's depth hides its centre
  const haloMat = new THREE.ShaderMaterial({
    vertexShader: S.haloVert,
    fragmentShader: S.haloFrag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uAccent: { value: col.accent },
      uHalo: { value: tone.halo },
      uWidth: { value: HALO_WIDTH },
      uExtent: { value: 1 + HALO_WIDTH + 0.02 },
    },
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), haloMat);
  halo.renderOrder = 1;
  scene.add(halo);

  // ── Land: one instanced quad per lattice point ──
  const n = data.count;
  const countryAttr = new Float32Array(n);
  const visitedAttr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    countryAttr[i] = data.owner[i];
    visitedAttr[i] = data.placeOf[data.owner[i]] >= 0 ? 1 : 0;
  }
  const quad = () => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  };
  const dotGeo = quad();
  dotGeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(data.xyz, 3));
  dotGeo.setAttribute('aCountry', new THREE.InstancedBufferAttribute(countryAttr, 1));
  dotGeo.setAttribute('aVisited', new THREE.InstancedBufferAttribute(visitedAttr, 1));
  dotGeo.instanceCount = n;
  const dotU = {
    uSize: { value: DOT },
    uHover: { value: -1 },
    uSel: { value: -1 },
    uPrevSel: { value: -1 },
    uSelT: { value: 1 },
    uDim: { value: 0 },
    uLand: { value: tone.land },
    uLight: { value: LIGHT },
    uText: { value: col.text },
    uAccent: { value: col.accent },
  };
  const dotMat = (side, opacity) =>
    new THREE.ShaderMaterial({
      vertexShader: S.dotsVert,
      fragmentShader: S.dotsFrag,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide, // the far side's discs face away from us
      uniforms: { ...dotU, uSide: { value: side }, uOpacity: { value: opacity } },
    });
  const farDots = new THREE.Mesh(dotGeo, dotMat(-1, tone.far));
  const nearDots = new THREE.Mesh(dotGeo, dotMat(1, 1));
  farDots.renderOrder = 2;
  nearDots.renderOrder = 3;
  for (const m of [farDots, nearDots]) {
    m.frustumCulled = false;
    globe.add(m);
  }

  // ── Routes: every arc in one ribbon ──
  const arcIndex = data.arcs.map((pts, i) => (pts ? i : -1)).filter((i) => i >= 0 && i < MAX_ARCS);
  const per = ARC_STEPS + 1;
  const vCount = arcIndex.length * per * 2;
  const aPosA = new Float32Array(vCount * 3);
  const aPrevA = new Float32Array(vCount * 3);
  const aNextA = new Float32Array(vCount * 3);
  const aSideA = new Float32Array(vCount);
  const aTA = new Float32Array(vCount);
  const aArcA = new Float32Array(vCount);
  const idx = [];
  arcIndex.forEach((arcI, j) => {
    const pts = data.arcs[arcI];
    for (let k = 0; k < per; k++) {
      const kp = Math.max(0, k - 1);
      const kn = Math.min(per - 1, k + 1);
      for (let s = 0; s < 2; s++) {
        const v = (j * per + k) * 2 + s;
        for (let c = 0; c < 3; c++) {
          aPosA[v * 3 + c] = pts[k * 3 + c];
          aPrevA[v * 3 + c] = pts[kp * 3 + c];
          aNextA[v * 3 + c] = pts[kn * 3 + c];
        }
        aSideA[v] = s ? 1 : -1;
        aTA[v] = k / ARC_STEPS;
        aArcA[v] = arcI;
      }
      if (k < per - 1) {
        const b = (j * per + k) * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
  });
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.BufferAttribute(aPosA, 3));
  arcGeo.setAttribute('aPrev', new THREE.BufferAttribute(aPrevA, 3));
  arcGeo.setAttribute('aNext', new THREE.BufferAttribute(aNextA, 3));
  arcGeo.setAttribute('aSide', new THREE.BufferAttribute(aSideA, 1));
  arcGeo.setAttribute('aT', new THREE.BufferAttribute(aTA, 1));
  arcGeo.setAttribute('aArc', new THREE.BufferAttribute(aArcA, 1));
  arcGeo.setIndex(idx);
  const arcU = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uArcs: { value: new Float32Array(MAX_ARCS * 4) }, // progress, alpha, width, head
    uAccent: { value: col.accent },
    uTail: { value: 0.09 },
  };
  const arcMat = (opacity, hidden) =>
    new THREE.ShaderMaterial({
      vertexShader: S.arcsVert,
      fragmentShader: S.arcsFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide, // the ribbon's winding follows the arc's direction on screen
      // the hidden pass draws only where the sphere is in front of the arc
      depthFunc: hidden ? THREE.GreaterDepth : THREE.LessEqualDepth,
      defines: { MAX_ARCS },
      uniforms: { ...arcU, uOpacity: { value: opacity } },
    });
  const arcsBehind = new THREE.Mesh(arcGeo, arcMat(0.14, true));
  const arcs = new THREE.Mesh(arcGeo, arcMat(1, false));
  arcsBehind.renderOrder = 4;
  arcs.renderOrder = 5;
  for (const m of [arcsBehind, arcs]) {
    m.frustumCulled = false;
    globe.add(m);
  }

  // ── The comets' heads ──
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new THREE.BufferAttribute(new Float32Array(MAX_ARCS * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const sparkSize = new THREE.BufferAttribute(new Float32Array(MAX_ARCS), 1).setUsage(THREE.DynamicDrawUsage);
  const sparkAlpha = new THREE.BufferAttribute(new Float32Array(MAX_ARCS), 1).setUsage(THREE.DynamicDrawUsage);
  sparkGeo.setAttribute('position', sparkPos);
  sparkGeo.setAttribute('aSize', sparkSize);
  sparkGeo.setAttribute('aAlpha', sparkAlpha);
  const sparkU = { uDpr: { value: 1 }, uAccent: { value: col.accent } };
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.ShaderMaterial({ vertexShader: S.sparkVert, fragmentShader: S.sparkFrag, transparent: true, depthWrite: false, uniforms: sparkU }),
  );
  sparks.renderOrder = 6;
  sparks.frustumCulled = false;
  globe.add(sparks);

  // ── Pulse rings: home, and the chosen place ──
  const homeIndex = PLACES.indexOf(HOME);
  const ringGeo = quad();
  const ringPos = new THREE.InstancedBufferAttribute(new Float32Array(6), 3);
  const ringOn = new THREE.InstancedBufferAttribute(new Float32Array(2), 1);
  ringGeo.setAttribute('aPos', ringPos);
  ringGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(2), 1));
  ringGeo.setAttribute('aOn', ringOn);
  ringGeo.instanceCount = 2;
  ringPos.array.set(data.markers[homeIndex], 0);
  ringOn.array[0] = reduced ? 0 : 1;
  const ringU = { uRadius: { value: 0.06 }, uTime: { value: 0 }, uAccent: { value: col.accent } };
  const rings = new THREE.Mesh(
    ringGeo,
    new THREE.ShaderMaterial({ vertexShader: S.ringVert, fragmentShader: S.ringFrag, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, uniforms: ringU }),
  );
  rings.renderOrder = 7;
  rings.frustumCulled = false;
  globe.add(rings);

  // ── Markers ──
  const markerGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array(PLACES.length * 3);
  data.markers.forEach((m, i) => mPos.set([m[0] * 1.004, m[1] * 1.004, m[2] * 1.004], i * 3));
  markerGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  markerGeo.setAttribute('aIdx', new THREE.BufferAttribute(new Float32Array(PLACES.map((_, i) => i)), 1));
  markerGeo.setAttribute('aHome', new THREE.BufferAttribute(new Float32Array(PLACES.map((p) => (p.home ? 1 : 0))), 1));
  const markerU = {
    uDpr: { value: 1 },
    uSel: { value: -1 },
    uPrevSel: { value: -1 },
    uSelT: { value: 1 },
    uHover: { value: -1 },
    uSurface: { value: col.surface },
    uAccent: { value: col.accent },
  };
  const markers = new THREE.Points(
    markerGeo,
    new THREE.ShaderMaterial({ vertexShader: S.markerVert, fragmentShader: S.markerFrag, transparent: true, depthTest: false, depthWrite: false, uniforms: markerU }),
  );
  markers.renderOrder = 8;
  markers.frustumCulled = false;
  globe.add(markers);

  // ── Colours ──
  const setColors = (c) => {
    color(c.text, col.text);
    color(c.accent, col.accent);
    color(c.surface, col.surface);
    color(c.surface2, col.surface2);
    color(c.borderStrong, col.border);
    tone.land = c.dark ? 0.32 : 0.26;
    tone.far = c.dark ? 0.13 : 0.1;
    tone.halo = c.dark ? 0.11 : 0.08;
    tone.rim = c.dark ? 0.07 : 0.06; // mixed in linear light, so a little goes a long way
    tone.line = c.dark ? 0.22 : 0.4;
    dotU.uLand.value = tone.land;
    farDots.material.uniforms.uOpacity.value = tone.far;
    haloMat.uniforms.uHalo.value = tone.halo;
    bodyMat.uniforms.uRim.value = tone.rim;
    bodyMat.uniforms.uLine.value = tone.line;
  };
  setColors(ctx.colors);

  // ── View: the camera dollies in to zoom; the globe turns to lon/lat ──
  const view = memory.view ? { ...memory.view } : { ...START };
  const size = { w: 1, h: 1 };
  let dist = 5; // camera distance, in globe radii
  const euler = new THREE.Euler();
  const qInv = new THREE.Quaternion();
  const layout = () => {
    const aspect = size.w / size.h;
    if (camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    // the sphere's angular radius that makes it FILL × scale of the short side
    const tan = FILL * view.scale * Math.tan((FOV * RAD) / 2) * Math.min(1, aspect);
    dist = Math.sqrt(1 + 1 / (tan * tan));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    // the silhouette's radius on the plane through the centre
    halo.scale.setScalar((dist / Math.sqrt(dist * dist - 1)) * haloMat.uniforms.uExtent.value);
    globe.quaternion.setFromEuler(euler.set(view.lat * RAD, -view.lon * RAD, 0, 'XYZ'));
    globe.updateMatrixWorld();
    qInv.copy(globe.quaternion).invert();
  };
  // pixels per radian of turn at the middle of the disc, so a drag keeps
  // the point under the finger roughly under it
  const pxPerRad = () => size.h / 2 / Math.tan((FOV * RAD) / 2) / (dist - 1);

  // a globe point (unit-ish vector) -> canvas pixels, and how squarely its
  // surface faces the camera (> 0 is the near side)
  const v3 = new THREE.Vector3();
  const scr = { x: 0, y: 0, facing: 0 };
  const project = (x, y, z) => {
    v3.set(x, y, z).applyQuaternion(globe.quaternion);
    const len = v3.length() || 1;
    const nz = v3.z / len;
    scr.facing = (dist * nz - 1) / Math.sqrt(1 + dist * dist - 2 * dist * nz);
    v3.project(camera);
    scr.x = ((v3.x + 1) / 2) * size.w;
    scr.y = ((1 - v3.y) / 2) * size.h;
    return scr;
  };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const unit = new THREE.Sphere(new THREE.Vector3(), 1);
  const hitP = new THREE.Vector3();
  // canvas pixels -> unit vector on the globe, or null off the sphere
  const pickVector = (px, py) => {
    ndc.set((px / size.w) * 2 - 1, -(py / size.h) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectSphere(unit, hitP)) return null;
    return hitP.applyQuaternion(qInv).normalize();
  };
  const nearestLand = (v) => {
    let best = -1;
    let bestDot = Math.cos(1.6 * RAD);
    const { xyz } = data;
    for (let i = 0; i < n; i++) {
      const d = xyz[i * 3] * v.x + xyz[i * 3 + 1] * v.y + xyz[i * 3 + 2] * v.z;
      if (d > bestDot) {
        bestDot = d;
        best = i;
      }
    }
    return best < 0 ? -1 : data.owner[best];
  };
  // A marker within reach of the pointer wins over the land under it, so the
  // Caribbean and Malta stay easy to hit.
  const nearestMarker = (px, py) => {
    let best = -1;
    let bestD = 14 * 14;
    data.markers.forEach((m, i) => {
      const p = project(m[0], m[1], m[2]);
      if (p.facing <= 0.05) return;
      const d = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };
  const placeAt = (px, py) => {
    const m = nearestMarker(px, py);
    if (m >= 0) return { place: m, country: countryOf(m) };
    const v = pickVector(px, py);
    if (!v) return null;
    const country = nearestLand(v);
    return { place: country >= 0 ? data.placeOf[country] : -1, country };
  };

  // ── State ──
  const state = {
    dragging: null, // { id, x, y, lon, lat, moved, t, lastX, lastY }
    pinch: null, // { d0, s0 }
    velocity: { lon: 0, lat: 0 },
    fly: null, // { from, to, start, dur, ease, dip }
    zoomTo: null, // wheel zoom eases toward this
    idleSince: performance.now(),
    introStart: null,
    hoverCountry: -1,
    hoverPlace: -1,
    hoverPoint: null,
    tipUntil: 0,
    selected: -1,
    prevSel: -1,
    selT: 1,
    dim: 0,
  };
  const pointers = new Map();
  const arcVals = arcU.uArcs.value;
  const alphaNow = new Float32Array(MAX_ARCS).fill(0.55);
  const widthNow = new Float32Array(MAX_ARCS).fill(1.2);
  let scrolledAt = -1e9;
  let tipTimer = 0;

  const targetScale = () => (state.fly ? state.fly.to.scale : (state.zoomTo ?? view.scale));

  // A motivated move: ease-in-out to reposition (with a slight pull back on a
  // long flight, so it reads as travel), ease-out to settle a small nudge.
  const flyTo = (lon, lat, scale, ease = 'inOut') => {
    const from = { ...view };
    const to = { lon: from.lon + wrap180(lon - from.lon), lat: clampLat(lat), scale: clampScale(scale) };
    state.zoomTo = null;
    state.velocity.lon = 0;
    state.velocity.lat = 0;
    if (reduced) {
      Object.assign(view, to);
      state.fly = null;
      ctx.invalidate();
      return;
    }
    const far = Math.hypot(to.lon - from.lon, to.lat - from.lat);
    const zoom = Math.abs(Math.log(to.scale / from.scale));
    const dur = ease === 'inOut' ? Math.min(1500, 520 + far * 6 + zoom * 260) : Math.min(900, 420 + far * 5 + zoom * 320);
    // start: null starts the clock on the first frame drawn, so a fly asked
    // for before the globe is on screen still plays when it gets there
    state.fly = { from, to, start: null, dur, ease, dip: ease === 'inOut' ? Math.min(0.08, far / 1400) : 0 };
    ctx.invalidate();
  };

  const select = (id) => {
    const i = PLACES.findIndex((p) => p.id === id);
    if (i !== state.selected) {
      state.prevSel = state.selected;
      state.selected = i;
      state.selT = reduced ? 1 : 0;
      if (i >= 0 && !PLACES[i].home) ringPos.array.set(data.markers[i], 3);
      ringOn.array[1] = !reduced && i >= 0 && !PLACES[i].home ? 1 : 0;
      ringPos.needsUpdate = true;
      ringOn.needsUpdate = true;
    }
    state.idleSince = performance.now();
    if (i >= 0) {
      const [lon, lat] = PLACES[i].at;
      flyTo(lon, lat - 6, Math.max(targetScale(), 1.35));
    } else if (!(state.fly && state.fly.to.scale <= 1) && targetScale() > 1) {
      // let go of the place: back out, unless a reset is already doing that
      const to = state.fly ? state.fly.to : view;
      flyTo(to.lon, to.lat, 1, 'out');
    }
    ctx.invalidate();
  };
  const zoomBy = (factor) => {
    state.idleSince = performance.now();
    const to = state.fly ? state.fly.to : view;
    flyTo(to.lon, to.lat, targetScale() * factor, state.fly ? state.fly.ease : 'out');
  };
  const nudge = (dLon, dLat) => {
    state.idleSince = performance.now();
    const to = state.fly ? state.fly.to : view;
    flyTo(to.lon + dLon, to.lat + dLat, to.scale, 'out');
  };

  // a place chosen before the globe was made (a ?place= link) is flown to
  // once it's on screen
  let lastSelected = ctx.selected ?? null;
  if (lastSelected) select(lastSelected);

  // ── Per frame ──
  const step = (dt, now) => {
    const v = state.velocity;
    if (state.fly) {
      const f = state.fly;
      if (f.start == null) f.start = now;
      const t = Math.min(1, (now - f.start) / f.dur);
      const e = f.ease === 'inOut' ? easeInOut(t) : easeOut(t);
      view.lon = f.from.lon + (f.to.lon - f.from.lon) * e;
      view.lat = f.from.lat + (f.to.lat - f.from.lat) * e;
      view.scale = (f.from.scale + (f.to.scale - f.from.scale) * e) * (1 - f.dip * Math.sin(Math.PI * t));
      if (t >= 1) state.fly = null;
    } else if (!state.dragging && !state.pinch && Math.abs(v.lon) + Math.abs(v.lat) > 0.002) {
      view.lon += v.lon * dt;
      view.lat = clampLat(view.lat + v.lat * dt);
      const decay = Math.pow(0.94, dt / 16);
      v.lon *= decay;
      v.lat *= decay;
    } else if (!reduced && !state.dragging && !state.pinch && state.selected < 0 && now - state.idleSince > 2500 && now - scrolledAt > 220) {
      // idle spin, about 6° a second; it holds while the page is scrolling
      view.lon += 0.006 * dt;
      if (view.lon > 180) view.lon -= 360;
    }
    if (state.zoomTo != null) {
      view.scale += (state.zoomTo - view.scale) * (reduced ? 1 : 1 - Math.exp(-dt / 90));
      if (Math.abs(state.zoomTo - view.scale) < 0.0005) {
        view.scale = state.zoomTo;
        state.zoomTo = null;
      }
    }
  };

  const approach = (cur, target, dt, tau) => (reduced ? target : cur + (target - cur) * (1 - Math.exp(-dt / tau)));
  const pinEl = () => props.pin?.current;
  const tipEl = () => props.tip?.current;

  const render = (ms, now) => {
    if (gl.lost) return false;
    const dt = Math.min(64, ms || 16);
    if (state.introStart == null) state.introStart = reduced || memory.introDone ? -1e9 : now;
    step(dt, now);
    layout();

    // selection and hover, eased
    let moving = false;
    const ease = (cur, target, tau) => {
      const next = approach(cur, target, dt, tau);
      if (Math.abs(target - next) < 0.002) return target;
      moving = true;
      return next;
    };
    state.selT = ease(state.selT, 1, 160);
    state.dim = ease(state.dim, state.selected >= 0 ? 1 : 0, 180);
    dotU.uHover.value = state.hoverCountry;
    dotU.uSel.value = countryOf(state.selected);
    dotU.uPrevSel.value = countryOf(state.prevSel);
    dotU.uSelT.value = state.selT;
    dotU.uDim.value = state.dim;
    markerU.uSel.value = state.selected;
    markerU.uPrevSel.value = state.prevSel;
    markerU.uSelT.value = state.selT;
    markerU.uHover.value = state.hoverPlace;

    // routes: draw in with a stagger, then a comet keeps flying each one
    const intro = clamp01((now - state.introStart) / 1800);
    if (intro >= 1) memory.introDone = true;
    let drawing = false;
    const sel = state.selected;
    for (let j = 0; j < arcIndex.length; j++) {
      const i = arcIndex[j];
      const local = easeOut(clamp01(intro * 1.6 - i * 0.04));
      if (local < 1) drawing = true;
      arcVals[i * 4] = local;
      const isSel = sel === i;
      alphaNow[i] = ease(alphaNow[i], isSel ? 1 : sel >= 0 ? 0.18 : state.hoverPlace === i ? 0.85 : 0.55, 160);
      widthNow[i] = ease(widthNow[i], isSel ? 2 : 1.2, 160);
      let head = -1;
      if (!reduced && local >= 1 && (sel < 0 || isSel)) head = (now / 3200 + i * 0.137) % 1;
      arcVals[i * 4 + 1] = alphaNow[i];
      arcVals[i * 4 + 2] = widthNow[i];
      arcVals[i * 4 + 3] = head;
      if (head >= 0) {
        const pts = data.arcs[i];
        const f = head * ARC_STEPS;
        const k = Math.min(ARC_STEPS - 1, Math.floor(f));
        const u = f - k;
        const a = k * 3;
        sparkPos.array[i * 3] = pts[a] + (pts[a + 3] - pts[a]) * u;
        sparkPos.array[i * 3 + 1] = pts[a + 1] + (pts[a + 4] - pts[a + 1]) * u;
        sparkPos.array[i * 3 + 2] = pts[a + 2] + (pts[a + 5] - pts[a + 2]) * u;
        // the head fades in leaving home and out on arrival
        sparkAlpha.array[i] = Math.min(1, head / 0.06, (1 - head) / 0.1);
        sparkSize.array[i] = isSel ? 5.4 : 4.2;
      } else sparkAlpha.array[i] = 0;
    }
    sparkPos.needsUpdate = true;
    sparkAlpha.needsUpdate = true;
    sparkSize.needsUpdate = true;

    const dpr = renderer.getPixelRatio();
    sparkU.uDpr.value = dpr;
    markerU.uDpr.value = dpr;
    ringU.uTime.value = now / 2400;
    // the ripple keeps about the same size on screen as the globe zooms
    ringU.uRadius.value = 0.062 / Math.pow(view.scale, 0.7);

    renderer.render(scene, camera);
    gl.watch(now);

    // the chosen place's label follows its marker
    const pin = pinEl();
    if (pin) {
      if (sel >= 0) {
        const m = data.markers[sel];
        const p = project(m[0], m[1], m[2]);
        pin.style.opacity = p.facing > 0.1 ? '1' : '0';
        pin.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      } else pin.style.opacity = '0';
    }
    const tip = tipEl();
    if (tip) tip.style.opacity = state.hoverPoint && (state.hoverCountry >= 0 || state.hoverPlace >= 0 || now < state.tipUntil) ? '1' : '0';

    const spinning = Math.abs(state.velocity.lon) + Math.abs(state.velocity.lat) > 0.002;
    return !!(state.dragging || state.pinch || state.fly || state.zoomTo != null || spinning || moving || drawing || !reduced);
  };

  // ── Pointer, wheel and keyboard ──
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const setTip = (text, px, py) => {
    const tip = tipEl();
    if (!tip) return;
    tip.textContent = text;
    tip.style.transform = `translate(${px}px, ${py}px)`;
  };
  const describe = (hit) => {
    if (!hit) return null;
    if (hit.place >= 0) return PLACES[hit.place].name;
    if (hit.country >= 0) return `${countryName(hit.country)}: not yet`;
    return null;
  };
  const setHover = (hit) => {
    const country = hit?.country ?? -1;
    const place = hit?.place ?? -1;
    if (country === state.hoverCountry && place === state.hoverPlace) return;
    const placeChanged = place !== state.hoverPlace;
    state.hoverCountry = country;
    state.hoverPlace = place;
    if (placeChanged) props.onHover?.(place >= 0 ? PLACES[place].id : null);
    ctx.invalidate();
  };
  const startDrag = (id, px, py, moved = 0) => {
    state.dragging = { id, x: px, y: py, lon: view.lon, lat: view.lat, moved, t: performance.now(), lastX: px, lastY: py };
  };
  const pinchDistance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
  };

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const [px, py] = local(e);
    pointers.set(e.pointerId, [px, py]);
    capturePointer(e, canvas);
    state.fly = null;
    state.zoomTo = null;
    state.velocity.lon = 0;
    state.velocity.lat = 0;
    state.idleSince = performance.now();
    if (pointers.size === 2) {
      // a second finger: pinch to zoom, and this is no longer a tap
      state.dragging = null;
      state.pinch = { d0: pinchDistance(), s0: view.scale };
    } else if (pointers.size === 1) startDrag(e.pointerId, px, py);
    ctx.invalidate();
  };
  const onMove = (e) => {
    const [px, py] = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [px, py]);
    if (state.pinch && pointers.size >= 2) {
      view.scale = clampScale(state.pinch.s0 * (pinchDistance() / state.pinch.d0));
      state.idleSince = performance.now();
      ctx.invalidate();
      return;
    }
    const d = state.dragging;
    if (d && d.id === e.pointerId) {
      const R = pxPerRad();
      const dx = px - d.x;
      const dy = py - d.y;
      d.moved = Math.max(d.moved, Math.hypot(dx, dy));
      view.lon = d.lon - (dx / R) * (180 / Math.PI) * 0.9;
      view.lat = clampLat(d.lat + (dy / R) * (180 / Math.PI) * 0.9);
      const now = performance.now();
      const dt = Math.max(1, now - d.t);
      state.velocity.lon = ((-(px - d.lastX) / R) * (180 / Math.PI) * 0.9) / dt;
      state.velocity.lat = (((py - d.lastY) / R) * (180 / Math.PI) * 0.9) / dt;
      d.t = now;
      d.lastX = px;
      d.lastY = py;
      state.idleSince = now;
      canvas.style.cursor = 'grabbing';
      ctx.invalidate();
      return;
    }
    if (e.pointerType !== 'mouse' || pointers.size) return;
    const hit = placeAt(px, py);
    state.hoverPoint = hit ? [px, py] : null;
    canvas.style.cursor = hit && hit.place >= 0 ? 'pointer' : 'grab';
    setHover(hit);
    const text = describe(hit);
    if (text) setTip(text, px, py);
    ctx.invalidate();
  };
  // The browser took over (a touch scroll): end the gesture, never treat it as a tap.
  const onCancel = (e) => {
    pointers.delete(e.pointerId);
    if (state.pinch && pointers.size < 2) state.pinch = null;
    if (state.dragging?.id === e.pointerId) state.dragging = null;
    state.velocity.lon = 0;
    state.velocity.lat = 0;
    canvas.style.cursor = 'grab';
    ctx.invalidate();
  };
  const onUp = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    if (state.pinch) {
      if (pointers.size < 2) {
        state.pinch = null;
        // the finger still down carries on spinning, but it can't be a tap
        const [rest] = pointers.entries();
        if (rest) startDrag(rest[0], rest[1][0], rest[1][1], 99);
      }
      ctx.invalidate();
      return;
    }
    const d = state.dragging;
    if (!d || d.id !== e.pointerId) return;
    state.dragging = null;
    canvas.style.cursor = 'grab';
    state.idleSince = performance.now();
    if (performance.now() - d.t > 80) {
      state.velocity.lon = 0; // released after holding still
      state.velocity.lat = 0;
    }
    if (d.moved < 6) {
      state.velocity.lon = 0;
      state.velocity.lat = 0;
      const [px, py] = local(e);
      const hit = placeAt(px, py);
      if (hit && hit.place >= 0) props.onSelect?.(PLACES[hit.place].id);
      else if (hit && hit.country >= 0) {
        setTip(`${countryName(hit.country)}: not yet`, px, py);
        state.hoverPoint = [px, py];
        state.tipUntil = performance.now() + 1600;
        clearTimeout(tipTimer);
        tipTimer = setTimeout(() => ctx.invalidate(), 1650);
      } else props.onSelect?.(null);
    }
    ctx.invalidate();
  };
  const onLeave = (e) => {
    if (e.pointerType !== 'mouse') return;
    state.hoverPoint = null;
    setHover(null);
    ctx.invalidate();
  };
  // The wheel zooms only when it's clearly meant for the globe (a trackpad
  // pinch or ctrl/⌘ + wheel, or the globe has keyboard focus), so scrolling
  // the page over it still scrolls the page.
  const onWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey || keyboardFocused())) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dy = Math.max(-60, Math.min(60, e.deltaY * unit));
    state.fly = null;
    state.velocity.lon = 0;
    state.velocity.lat = 0;
    state.idleSince = performance.now();
    state.zoomTo = clampScale((state.zoomTo ?? view.scale) * Math.exp(-dy * 0.005));
    ctx.invalidate();
  };
  const onKey = (e) => {
    const deg = e.shiftKey ? 30 : 10;
    const moves = {
      ArrowLeft: () => nudge(-deg, 0),
      ArrowRight: () => nudge(deg, 0),
      ArrowUp: () => nudge(0, deg),
      ArrowDown: () => nudge(0, -deg),
      '+': () => zoomBy(1.35),
      '=': () => zoomBy(1.35),
      '-': () => zoomBy(1 / 1.35),
      Escape: () => props.onSelect?.(null),
    };
    const fn = moves[e.key];
    if (!fn) return;
    e.preventDefault();
    state.idleSince = performance.now();
    fn();
  };
  const keyboardFocused = () => {
    try {
      return canvas.matches(':focus-visible');
    } catch {
      return false; // an older browser without :focus-visible
    }
  };
  const onScroll = () => {
    scrolledAt = performance.now();
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  window.addEventListener('scroll', onScroll, { passive: true });

  return {
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      gl.setSize(size.w, size.h);
      arcU.uRes.value.set(size.w, size.h);
      layout();
    },
    render,
    setColors,
    update(next) {
      props = next;
      if (next.label && canvas.getAttribute('aria-label') !== next.label) canvas.setAttribute('aria-label', next.label);
      const id = next.selected ?? null;
      if (id !== lastSelected) {
        lastSelected = id;
        select(id);
      }
    },
    zoom(dir) {
      zoomBy(dir > 0 ? 1.35 : 1 / 1.35);
    },
    reset() {
      state.idleSince = performance.now();
      flyTo(START.lon, START.lat, START.scale);
    },
    dispose() {
      // remembered for the next scene, should this one be let go and remade
      memory.view = state.fly ? { ...state.fly.to } : { ...view };
      clearTimeout(tipTimer);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
      const pin = pinEl();
      if (pin) pin.style.opacity = '0';
      const tip = tipEl();
      if (tip) tip.style.opacity = '0';
      disposeTree(scene);
      gl.dispose();
    },
  };
}
