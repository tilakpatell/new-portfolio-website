// The shared stage for the Experience diagrams in 3D: a small isometric
// model on the panel, in the page's own colours, lit from the upper left like
// the SVGs, with soft contact shadows. Each diagram builds itself once when
// it first comes into view and then holds still (no frames drawn); the
// pointer tilts it a few degrees, so it reads as an object, not a picture.
// Labels are real text laid over the canvas, in the mono the SVGs use.

import * as THREE from 'three';
import { clamp01, color, createRenderer, disposeTree, easeOut } from '../../../lib/three/renderer';
import { mix } from '../../../lib/three/theme';

const AZ = -24; // camera yaw, degrees (looking from the front left)
const EL = 33; // camera pitch
const TILT = { yaw: 5, pitch: 3 }; // most the pointer can turn it

export { easeOut, clamp01 };

// The palette every diagram shares, from lib/three/theme colours.
function palette(c) {
  const neutral = mix(c.surface2, c.text, c.dark ? 0.2 : 0.16);
  return {
    accent: c.accent,
    neutral,
    neutralDeep: mix(c.surface2, c.text, c.dark ? 0.32 : 0.34),
    text: c.text,
    muted: c.muted,
    plate: mix(c.bgDeep, c.text, c.dark ? 0.05 : 0.035),
    surface2: c.surface2,
    line: c.borderStrong,
    shadow: c.dark ? 0.5 : 0.16,
    dark: c.dark,
  };
}

// inset: room to keep clear around the model for labels and the legend, as
// fractions of the canvas { top, right, bottom, left }
export function createStage(canvas, ctx, { bounds, duration = 1.4, tilt = TILT, az = AZ, el = EL, pad = 0.04, inset = {}, legend } = {}) {
  const ins = { top: 0.06, right: 0.05, bottom: 0.06, left: 0.05, ...inset };
  const gl = createRenderer(canvas, { ratio: 2, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const root = new THREE.Group(); // tilted by the pointer
  scene.add(root);

  // light: a key from the upper left that casts the shadows, and a soft fill
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.6);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);

  // bounds: { min: [x, y, z], max: [x, y, z] } of the model, in world units
  const center = new THREE.Vector3(...bounds.min).add(new THREE.Vector3(...bounds.max)).multiplyScalar(0.5);
  const extent = new THREE.Vector3(...bounds.max).sub(new THREE.Vector3(...bounds.min));
  const radius = extent.length() / 2;
  key.position.copy(center).add(new THREE.Vector3(-radius * 0.9, radius * 2.2, radius * 1.4));
  key.target.position.copy(center);
  const sc = key.shadow.camera;
  sc.left = -radius * 1.4;
  sc.right = radius * 1.4;
  sc.top = radius * 1.4;
  sc.bottom = -radius * 1.4;
  sc.near = 0.1;
  sc.far = radius * 6;
  sc.updateProjectionMatrix();

  // a floor that only shows the shadows
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.16 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(extent.x * 3 + 4, extent.z * 3 + 4), shadowMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, bounds.min[1] - 0.001, center.z);
  floor.receiveShadow = true;
  scene.add(floor);

  // materials the diagrams share, re-coloured on a theme change
  const mats = {
    accent: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 }),
    neutral: new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }),
    neutralDeep: new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }),
    plate: new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }),
    text: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 }),
    line: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7 }),
    lineAccent: new THREE.LineBasicMaterial(),
    lineStrong: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6 }), // text colour, like the SVGs' edges
    dash: new THREE.LineDashedMaterial({ dashSize: 0.09, gapSize: 0.07, transparent: true, opacity: 0.85 }),
    dashAccent: new THREE.LineDashedMaterial({ dashSize: 0.1, gapSize: 0.07 }),
    dashStrong: new THREE.LineDashedMaterial({ dashSize: 0.1, gapSize: 0.07 }), // muted, like the SVGs' connectors
  };
  let pal = palette(ctx.colors);
  const recolor = () => {
    color(pal.accent, mats.accent.color);
    color(pal.neutral, mats.neutral.color);
    color(pal.neutralDeep, mats.neutralDeep.color);
    color(pal.plate, mats.plate.color);
    color(pal.text, mats.text.color);
    color(pal.line, mats.line.color);
    color(pal.accent, mats.lineAccent.color);
    color(pal.text, mats.lineStrong.color);
    color(pal.line, mats.dash.color);
    color(pal.accent, mats.dashAccent.color);
    color(pal.muted, mats.dashStrong.color);
    shadowMat.opacity = pal.shadow;
    hemi.intensity = pal.dark ? 1.25 : 1.7;
    key.intensity = pal.dark ? 2.6 : 2.1;
  };
  recolor();

  // ── labels: real text over the canvas ──
  const overlay = document.createElement('div');
  overlay.className = 'm3d-labels';
  ctx.el.appendChild(overlay);
  const labels = [];
  const label = (text, pos, { anchor = 'start', accent = false, strong = false } = {}) => {
    const span = document.createElement('span');
    span.textContent = text;
    span.dataset.anchor = anchor;
    if (accent) span.dataset.accent = '';
    if (strong) span.dataset.strong = '';
    overlay.appendChild(span);
    const item = { span, pos: new THREE.Vector3(...pos), opacity: 1 };
    labels.push(item);
    return item;
  };
  if (legend) {
    const lg = document.createElement('div');
    lg.className = 'm3d-legend';
    for (const [kind, text] of legend) {
      const s = document.createElement('span');
      s.dataset.kind = kind;
      s.textContent = text;
      lg.appendChild(s);
    }
    overlay.appendChild(lg);
  }

  // ── camera: isometric, fitted to the model's box ──
  const size = { w: 1, h: 1 };
  const corners = [];
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) corners.push(new THREE.Vector3(x, y, z));
  const aim = (yaw, pitch) => {
    const a = THREE.MathUtils.degToRad(az + yaw);
    const e = THREE.MathUtils.degToRad(el + pitch);
    const d = radius * 6;
    camera.position.set(center.x + Math.sin(a) * Math.cos(e) * d, center.y + Math.sin(e) * d, center.z + Math.cos(a) * Math.cos(e) * d);
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    camera.updateMatrixWorld();
  };
  const fit = () => {
    aim(0, 0);
    const inv = camera.matrixWorldInverse;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    const v = new THREE.Vector3();
    for (const c of corners) {
      v.copy(c).applyMatrix4(inv);
      x0 = Math.min(x0, v.x);
      x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    // the model's box must fit the canvas minus the insets
    const aspect = size.w / size.h;
    const fw = 1 - ins.left - ins.right;
    const fh = 1 - ins.top - ins.bottom;
    const h = Math.max((y1 - y0) / fh, (x1 - x0) / (fw * aspect)) * (1 + pad * 2);
    const w = h * aspect;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    camera.left = cx - (ins.left + fw / 2) * w;
    camera.right = camera.left + w;
    camera.bottom = cy - (ins.bottom + fh / 2) * h;
    camera.top = camera.bottom + h;
    camera.near = 0.1;
    camera.far = radius * 12;
    camera.updateProjectionMatrix();
  };

  const project = () => {
    const v = new THREE.Vector3();
    for (const l of labels) {
      v.copy(l.pos);
      root.localToWorld(v);
      v.project(camera);
      const x = ((v.x + 1) / 2) * size.w;
      const y = ((1 - v.y) / 2) * size.h;
      l.span.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      l.span.style.opacity = String(l.opacity);
    }
  };

  // ── the pointer tilts it, a little ──
  const tiltNow = { yaw: 0, pitch: 0 };
  const tiltTo = { yaw: 0, pitch: 0 };
  const onMove = (e) => {
    if (ctx.reduced) return;
    const r = ctx.el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    tiltTo.yaw = nx * tilt.yaw;
    tiltTo.pitch = -ny * tilt.pitch;
    ctx.invalidate();
  };
  const onLeave = () => {
    tiltTo.yaw = 0;
    tiltTo.pitch = 0;
    ctx.invalidate();
  };
  const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? true;
  if (fine) {
    ctx.el.addEventListener('pointermove', onMove);
    ctx.el.addEventListener('pointerleave', onLeave);
  }

  // ── the entrance clock: starts the first time it's on screen ──
  let t = ctx.reduced ? duration : 0;
  let started = !!ctx.reduced;
  let step = () => {};

  return {
    THREE,
    scene,
    root,
    mats,
    label,
    get palette() {
      return pal;
    },
    // the diagram's per-frame pose for entrance time t (seconds)
    onStep(fn) {
      step = fn;
    },
    // the scene-module API that useScene drives
    view(extra = {}) {
      return {
        resize(w, h) {
          size.w = Math.max(1, w);
          size.h = Math.max(1, h);
          gl.setSize(size.w, size.h);
          fit();
          project();
        },
        setVisible(on) {
          if (on && !started) {
            started = true;
            ctx.invalidate();
          }
        },
        setColors(c) {
          pal = palette(c);
          recolor();
          extra.setColors?.(pal);
        },
        render(ms, now) {
          if (gl.lost) return false;
          if (started && t < duration) t = Math.min(duration, t + ms / 1000);
          step(started ? t : 0);
          // ease the tilt toward the pointer
          const k = 1 - Math.exp(-ms / 110);
          tiltNow.yaw += (tiltTo.yaw - tiltNow.yaw) * k;
          tiltNow.pitch += (tiltTo.pitch - tiltNow.pitch) * k;
          if (Math.abs(tiltTo.yaw - tiltNow.yaw) < 0.01) tiltNow.yaw = tiltTo.yaw;
          if (Math.abs(tiltTo.pitch - tiltNow.pitch) < 0.01) tiltNow.pitch = tiltTo.pitch;
          aim(tiltNow.yaw, tiltNow.pitch);
          renderer.render(scene, camera);
          project();
          gl.watch(now);
          const tilting = tiltNow.yaw !== tiltTo.yaw || tiltNow.pitch !== tiltTo.pitch;
          return (started && t < duration) || tilting;
        },
        dispose() {
          ctx.el.removeEventListener('pointermove', onMove);
          ctx.el.removeEventListener('pointerleave', onLeave);
          overlay.remove();
          disposeTree(scene);
          gl.dispose();
        },
      };
    },
  };
}

// A box with its bottom on y = 0, so scaling y grows it from the floor.
export function floorBox(THREE, w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

// The edges of a box as dashed lines (an empty slot, a stale record).
export function dashedBox(THREE, w, h, d, material) {
  const edges = new THREE.EdgesGeometry(floorBox(THREE, w, h, d));
  const lines = new THREE.LineSegments(edges, material);
  lines.computeLineDistances();
  return lines;
}

// t in [0, 1] for something that starts at `at` and takes `len` seconds.
export const phase = (t, at, len) => easeOut(clamp01((t - at) / len));
