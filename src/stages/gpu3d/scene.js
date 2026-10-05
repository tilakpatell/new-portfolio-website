// The GPU checkpoint-restart demo as hardware: four GPU modules on a
// baseboard, joined by a ring interconnect, and a storage block that holds the
// checkpoint image. Packets run the ring while it trains; every rank streams
// its state into storage at a checkpoint; GPU 2 stalls and turns red on a
// fault; and the state streams back out on a restart. GpuStage.jsx drives it
// with its own PHASES; its SVG stays underneath as the fallback. Labels are
// real text laid over the canvas, in the mono the SVG uses.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, color, createRenderer, disposeTree, precompile } from '../../lib/three/renderer';
import { mix, parseColor } from '../../lib/three/theme';

// ── the plan, in world units (about 40 SVG px each; z runs toward the viewer) ──
const FLOOR = -0.08; // the baseboard's underside; its top is y = 0
const LIFT = 0.2; // boards stand on posts this high, so packets can run beneath them
const PCB_T = 0.08;
const BOARD = { w: 3.0, d: 1.7 };
const SINK = { w: 2.4, d: 1.0, z: -0.24, fins: 13, finT: 0.05, finH: 0.56, baseH: 0.06 };
const SINK_TOP = LIFT + PCB_T + SINK.baseH + SINK.finH;
const RING = { cx: -3.25, hx: 2.25, hz: 2.3, r: 0.6, w: 0.24, h: 0.05 };
const GPU_AT = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]; // GPU 0 back left, then round the ring as the SVG goes
const STORE = { x: 4.95, w: 3.7, h: 1.15, d: 2.2 };
const BASE_PAD = 0.35;

const RING_PACKETS = 8;
const RING_LOOP = 3.6; // seconds for a packet to go once round
const STREAM_PACKETS = 5;
const STREAM_TRIP = 1.15; // seconds from a GPU to storage
const SEGMENTS = 8; // the load meter on each board
const BAYS = 8; // drive bays on the storage front
const FILL_S = 2; // seconds to write the image, as the SVG's bar grows
const HOLD_S = 0.6; // on a restart, GPU 2 stays red until its state arrives

const AZ = -12; // camera yaw, degrees (from the front left)
const EL = 38; // camera pitch
const TILT = { yaw: 4, pitch: 2.5 };
const INSET = { top: 0.13, right: 0.03, bottom: 0.05, left: 0.03 };

// The stage window is a dark surface inside the page (.dark-scope), so its
// colours are read inside it, not from <html>.
const TOKENS = {
  accent: '--accent',
  text: '--text',
  muted: '--muted',
  bgDeep: '--bg-deep',
  surface: '--surface',
  surface2: '--surface-2',
  border: '--border',
  borderStrong: '--border-strong',
};
function readScoped(el, fallback) {
  const probe = document.createElement('i');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  el.appendChild(probe);
  const out = {};
  for (const [key, token] of Object.entries(TOKENS)) {
    probe.style.color = `var(${token})`;
    out[key] = parseColor(getComputedStyle(probe).color) ?? fallback[key];
  }
  probe.remove();
  return out;
}

function palette(c, fault) {
  return {
    accent: c.accent,
    fault,
    base: mix(c.surface, c.text, 0.06),
    track: mix(c.surface2, c.text, 0.1),
    pcb: mix(c.bgDeep, c.text, 0.05),
    post: mix(c.surface2, c.text, 0.2),
    sink: mix(c.surface2, c.text, 0.34),
    ledOff: mix(c.surface, c.text, 0.12),
    store: mix(c.surface2, c.text, 0.16),
    bay: mix(c.bgDeep, c.text, 0.03),
    stall: mix(c.surface2, c.text, 0.32),
  };
}

// a rounded rectangle centred on 0, drawn into a Shape or Path
function roundRect(path, hw, hh, r) {
  path.moveTo(-hw + r, -hh);
  path.lineTo(hw - r, -hh);
  path.quadraticCurveTo(hw, -hh, hw, -hh + r);
  path.lineTo(hw, hh - r);
  path.quadraticCurveTo(hw, hh, hw - r, hh);
  path.lineTo(-hw + r, hh);
  path.quadraticCurveTo(-hw, hh, -hw, hh - r);
  path.lineTo(-hw, -hh + r);
  path.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return path;
}

// The ring the packets ride: through each board's centre, clockwise from GPU 0.
function ringCurve() {
  const { cx, hx, hz, r } = RING;
  const P = (x, z) => new THREE.Vector3(cx + x, 0, z);
  const corners = GPU_AT.map(([sx, sz]) => [sx * hx, sz * hz]);
  const path = new THREE.CurvePath();
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i];
    const [x1, z1] = corners[(i + 1) % 4];
    const [x2, z2] = corners[(i + 2) % 4];
    const d1 = new THREE.Vector2(x1 - x0, z1 - z0).normalize();
    const d2 = new THREE.Vector2(x2 - x1, z2 - z1).normalize();
    const b = P(x1 - d1.x * r, z1 - d1.y * r);
    path.add(new THREE.LineCurve3(P(x0 + d1.x * r, z0 + d1.y * r), b));
    path.add(new THREE.QuadraticBezierCurve3(b, P(x1, z1), P(x1 + d2.x * r, z1 + d2.y * r)));
  }
  return path;
}

// A heat sink: a base plate and a row of thin fins, as one geometry.
function sinkGeometry() {
  const parts = [];
  const base = new THREE.BoxGeometry(SINK.w, SINK.baseH, SINK.d);
  base.translate(0, SINK.baseH / 2, 0);
  parts.push(base);
  const pitch = (SINK.w - SINK.finT) / (SINK.fins - 1);
  for (let i = 0; i < SINK.fins; i++) {
    const fin = new THREE.BoxGeometry(SINK.finT, SINK.finH, SINK.d);
    fin.translate(-SINK.w / 2 + SINK.finT / 2 + i * pitch, SINK.baseH + SINK.finH / 2, 0);
    parts.push(fin);
  }
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

function postGeometry() {
  const parts = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.CylinderGeometry(0.05, 0.05, LIFT, 10);
      post.translate(sx * (BOARD.w / 2 - 0.2), LIFT / 2, sz * (BOARD.d / 2 - 0.2));
      parts.push(post);
    }
  }
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

// Exponential ease toward a target. Returns whether it is still moving.
function approach(e, target, dt, tau, snap) {
  if (snap || tau <= 0) {
    e.v = target;
    return false;
  }
  e.v += (target - e.v) * (1 - Math.exp(-dt / tau));
  if (Math.abs(target - e.v) < 0.002) e.v = target;
  return e.v !== target;
}

export function create(canvas, ctx) {
  const reduced = !!ctx.reduced;
  const gl = createRenderer(canvas, { ratio: 2, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const root = new THREE.Group();
  scene.add(root);

  // ── light: a key from the upper left that casts the shadows, and a soft fill ──
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.3);
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(-7, 14, 9);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  const sc = key.shadow.camera;
  sc.left = -10;
  sc.right = 10;
  sc.top = 8;
  sc.bottom = -8;
  sc.near = 1;
  sc.far = 40;
  scene.add(hemi, key, key.target);

  // ── materials, re-coloured on a theme change ──
  const matte = (roughness = 0.82) => new THREE.MeshStandardMaterial({ roughness, metalness: 0 });
  const mats = {
    base: matte(0.95),
    track: matte(0.9),
    post: matte(0.7),
    store: matte(0.85),
    bay: matte(0.95),
    // the packets glow a little, but stay matte
    ring: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, transparent: true, emissiveIntensity: 0.5 }),
    stream: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, transparent: true, emissiveIntensity: 0.55 }),
    trace: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    trim: matte(0.6),
  };
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.5 });

  let c = readScoped(ctx.el, ctx.colors);
  let fault = parseColor(ctx.fault) ?? [255, 107, 107];
  let pal = palette(c, fault);
  // the colours that per-frame states blend between
  const col = {
    accent: new THREE.Color(),
    fault: new THREE.Color(),
    pcb: new THREE.Color(),
    sink: new THREE.Color(),
    ledOff: new THREE.Color(),
    stall: new THREE.Color(),
    black: new THREE.Color(0, 0, 0),
  };

  // ── the baseboard, the ring and the floor that only shows shadows ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), shadowMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR - 0.002;
  floor.receiveShadow = true;
  scene.add(floor);

  const baseW = 2 * (RING.hx + BOARD.w / 2 + BASE_PAD);
  const baseD = 2 * (RING.hz + BOARD.d / 2 + BASE_PAD);
  const base = new THREE.Mesh(new RoundedBoxGeometry(baseW, -FLOOR, baseD, 2, 0.03), mats.base);
  base.position.set(RING.cx, FLOOR / 2, 0);
  base.receiveShadow = true;
  root.add(base);

  const outer = roundRect(new THREE.Shape(), RING.hx + RING.w / 2, RING.hz + RING.w / 2, RING.r + RING.w / 2);
  outer.holes.push(roundRect(new THREE.Path(), RING.hx - RING.w / 2, RING.hz - RING.w / 2, RING.r - RING.w / 2));
  const trackGeo = new THREE.ExtrudeGeometry(outer, { depth: RING.h, bevelEnabled: false, curveSegments: 12 });
  trackGeo.rotateX(-Math.PI / 2);
  const track = new THREE.Mesh(trackGeo, mats.track);
  track.position.x = RING.cx;
  track.receiveShadow = true;
  root.add(track);
  const ring = ringCurve();

  // ── the four GPU modules ──
  const pcbGeo = new THREE.BoxGeometry(BOARD.w, PCB_T, BOARD.d);
  pcbGeo.translate(0, LIFT + PCB_T / 2, 0);
  const sinkGeo = sinkGeometry();
  const postGeo = postGeometry();
  const segGeo = new THREE.BoxGeometry(0.22, 0.035, 0.15);
  const ledGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.035, 16);
  const segX = (k) => -0.95 + k * ((1.15 + 0.95) / (SEGMENTS - 1));
  const FRONT_Z = SINK.z + SINK.d / 2 + (BOARD.d / 2 - (SINK.z + SINK.d / 2)) / 2; // middle of the strip in front of the fins
  const gpus = GPU_AT.map(([sx, sz]) => {
    const g = new THREE.Group();
    g.position.set(RING.cx + sx * RING.hx, 0, sz * RING.hz);
    const pcbMat = matte(0.85);
    const sinkMat = matte(0.75);
    const pcb = new THREE.Mesh(pcbGeo, pcbMat);
    const sink = new THREE.Mesh(sinkGeo, sinkMat);
    sink.position.set(0, LIFT + PCB_T, SINK.z);
    const posts = new THREE.Mesh(postGeo, mats.post);
    for (const m of [pcb, sink, posts]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    g.add(pcb, sink, posts);
    const segs = [];
    for (let k = 0; k < SEGMENTS; k++) {
      const seg = new THREE.Mesh(segGeo, matte(0.6));
      seg.position.set(segX(k), LIFT + PCB_T + 0.0175, FRONT_Z);
      g.add(seg);
      segs.push(seg);
    }
    const led = new THREE.Mesh(ledGeo, matte(0.5));
    led.position.set(-1.27, LIFT + PCB_T + 0.0175, FRONT_Z);
    g.add(led);
    root.add(g);
    return { g, pcbMat, sinkMat, segs, led, meter: { v: 0 } };
  });

  // ── ring packets ──
  const ringGeo = new RoundedBoxGeometry(0.34, 0.1, 0.17, 2, 0.04);
  const ringPackets = new THREE.InstancedMesh(ringGeo, mats.ring, RING_PACKETS);
  ringPackets.frustumCulled = false;
  root.add(ringPackets);

  // ── storage: a drive enclosure with a bay per slice of the image ──
  const storeGroup = new THREE.Group();
  storeGroup.position.set(STORE.x, FLOOR, 0);
  const body = new THREE.Mesh(new RoundedBoxGeometry(STORE.w, STORE.h, STORE.d, 2, 0.05), mats.store);
  body.position.y = STORE.h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  storeGroup.add(body);
  const bayGeo = new THREE.BoxGeometry(0.3, 0.62, 0.03);
  const bayLedGeo = new THREE.BoxGeometry(0.2, 0.05, 0.035);
  const bayX = (k) => -STORE.w / 2 + 0.42 + k * ((STORE.w - 0.84) / (BAYS - 1));
  const bayLeds = [];
  for (let k = 0; k < BAYS; k++) {
    const bay = new THREE.Mesh(bayGeo, mats.bay);
    bay.position.set(bayX(k), 0.2 + 0.31 + 0.12, STORE.d / 2 + 0.01);
    const ledM = new THREE.Mesh(bayLedGeo, matte(0.55));
    ledM.position.set(bayX(k), 0.2, STORE.d / 2 + 0.012);
    storeGroup.add(bay, ledM);
    bayLeds.push(ledM);
  }
  // a strip along the top front edge that lights while the image is written or read
  const trim = new THREE.Mesh(new THREE.BoxGeometry(STORE.w - 0.4, 0.025, 0.05), mats.trim);
  trim.position.set(0, STORE.h + 0.0125, STORE.d / 2 - 0.14);
  storeGroup.add(trim);
  root.add(storeGroup);

  // ── streams: every rank to the store (a checkpoint) and back (a restart) ──
  const landZ = [-0.66, -0.22, 0.22, 0.66]; // back ranks land at the back of the lid
  const curves = gpus.map(({ g }, i) => {
    const far = GPU_AT[i][0] < 0; // the left column arcs over the right one
    const start = new THREE.Vector3(g.position.x + 0.5, SINK_TOP + 0.05, g.position.z + SINK.z);
    const end = new THREE.Vector3(STORE.x - STORE.w / 2 + 0.55, FLOOR + STORE.h + 0.02, landZ[i]);
    const lift = far ? 1.55 : 1.05;
    const dx = end.x - start.x;
    return new THREE.CubicBezierCurve3(start, start.clone().add(new THREE.Vector3(dx * 0.22, lift, 0)), end.clone().add(new THREE.Vector3(-dx * 0.18, lift * 0.85, 0)), end);
  });
  const traces = curves.map((curve) => {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.012, 5, false), mats.trace);
    tube.renderOrder = 1;
    root.add(tube);
    return tube;
  });
  const streamGeo = new RoundedBoxGeometry(0.2, 0.08, 0.11, 2, 0.03);
  const streamPackets = new THREE.InstancedMesh(streamGeo, mats.stream, curves.length * STREAM_PACKETS);
  streamPackets.frustumCulled = false;
  root.add(streamPackets);

  const recolor = () => {
    color(pal.accent, col.accent);
    color(pal.fault, col.fault);
    color(pal.pcb, col.pcb);
    color(pal.sink, col.sink);
    color(pal.ledOff, col.ledOff);
    color(pal.stall, col.stall);
    color(pal.base, mats.base.color);
    color(pal.track, mats.track.color);
    color(pal.post, mats.post.color);
    color(pal.store, mats.store.color);
    color(pal.bay, mats.bay.color);
    mats.ring.emissive.copy(col.accent);
    mats.stream.color.copy(col.accent);
    mats.stream.emissive.copy(col.accent);
    mats.trace.color.copy(col.accent);
  };
  recolor();

  // ── labels: real text over the canvas ──
  const overlay = document.createElement('div');
  overlay.className = 'gpu3d-labels';
  ctx.el.appendChild(overlay);
  const labels = [];
  // each label is a name (in the text colour) and a note beside or under it
  const label = (pos, { anchor = 'start', v = 'above', kind = 'tag', name = '', note = '' } = {}) => {
    const el = document.createElement('span');
    el.dataset.anchor = anchor;
    el.dataset.v = v;
    el.dataset.kind = kind;
    const b = document.createElement('b');
    b.textContent = name;
    const i = document.createElement('i');
    i.textContent = note;
    el.append(b, i);
    overlay.appendChild(el);
    const item = { el, b, i, pos: new THREE.Vector3(...pos), opacity: 1, shown: '' };
    labels.push(item);
    return item;
  };
  // the back row is named above its boards and the front row below, so the
  // middle of the ring stays clear for the fault
  const gpuLabels = gpus.map(({ g }, i) => {
    const back = GPU_AT[i][1] < 0;
    const x = g.position.x - BOARD.w / 2;
    const pos = back ? [x, SINK_TOP + 0.3, g.position.z - BOARD.d / 2] : [x, LIFT, g.position.z + BOARD.d / 2 + 0.12];
    return label(pos, { v: back ? 'above' : 'below', name: `GPU ${i}`, note: `rank ${i}` });
  });
  const storeLabel = label([STORE.x, FLOOR, STORE.d / 2 + 0.12], { anchor: 'middle', v: 'below', kind: 'stack', name: 'checkpoint image', note: 'none yet' });
  const stalled = label([RING.cx, LIFT, -0.35], { anchor: 'middle', v: 'mid', kind: 'fault', name: 'ncclAllReduce stalled' });

  // ── camera: orthographic, fitted to the model's box and the stage frame ──
  const size = { w: 1, h: 1 };
  // the points the frame must hold: both boxes, and the arcs at their highest
  const corners = [];
  const box = (x0, x1, y0, y1, z0, z1) => {
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) corners.push(new THREE.Vector3(x, y, z));
  };
  box(RING.cx - baseW / 2, RING.cx + baseW / 2, FLOOR, SINK_TOP, -baseD / 2, baseD / 2);
  box(STORE.x - STORE.w / 2, STORE.x + STORE.w / 2, FLOOR, FLOOR + STORE.h, -STORE.d / 2, STORE.d / 2);
  for (const curve of curves) for (let k = 1; k < 8; k++) corners.push(curve.getPoint(k / 8));
  const center = new THREE.Box3().setFromPoints(corners).getCenter(new THREE.Vector3());
  const radius = new THREE.Box3().setFromPoints(corners).getSize(new THREE.Vector3()).length() / 2;
  const aim = (yaw, pitch) => {
    const a = THREE.MathUtils.degToRad(AZ + yaw);
    const e = THREE.MathUtils.degToRad(EL + pitch);
    const d = radius * 4;
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
    for (const p of corners) {
      v.copy(p).applyMatrix4(inv);
      x0 = Math.min(x0, v.x);
      x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    const aspect = size.w / size.h;
    const fw = 1 - INSET.left - INSET.right;
    const fh = 1 - INSET.top - INSET.bottom;
    const h = Math.max((y1 - y0) / fh, (x1 - x0) / (fw * aspect));
    const w = h * aspect;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    camera.left = cx - (INSET.left + fw / 2) * w;
    camera.right = camera.left + w;
    camera.bottom = cy - (INSET.bottom + fh / 2) * h;
    camera.top = camera.bottom + h;
    camera.near = 0.1;
    camera.far = radius * 10;
    camera.updateProjectionMatrix();
  };
  const project = () => {
    const v = new THREE.Vector3();
    for (const l of labels) {
      v.copy(l.pos).project(camera);
      const x = ((v.x + 1) / 2) * size.w;
      const y = ((1 - v.y) / 2) * size.h;
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      const o = l.opacity.toFixed(3);
      if (o !== l.shown) {
        l.el.style.opacity = o;
        l.shown = o;
      }
    }
  };

  // ── the pointer tilts it, a little ──
  const tiltNow = { yaw: { v: 0 }, pitch: { v: 0 } };
  const tiltTo = { yaw: 0, pitch: 0 };
  const onMove = (e) => {
    const r = ctx.el.getBoundingClientRect();
    tiltTo.yaw = (((e.clientX - r.left) / r.width) * 2 - 1) * TILT.yaw;
    tiltTo.pitch = -(((e.clientY - r.top) / r.height) * 2 - 1) * TILT.pitch;
    ctx.invalidate();
  };
  const onLeave = () => {
    tiltTo.yaw = 0;
    tiltTo.pitch = 0;
    ctx.invalidate();
  };
  const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? true;
  const tilts = fine && !reduced;
  if (tilts) {
    ctx.el.addEventListener('pointermove', onMove);
    ctx.el.addEventListener('pointerleave', onLeave);
  }

  // ── the state the page drives, and the eased values that follow it ──
  let props = { phase: ctx.phase, running: ctx.running, levels: ctx.levels ?? [], saved: ctx.saved };
  let age = 0; // seconds in this phase
  let ringT = 0; // how far the ring has turned
  let streamT = 0; // how far the streams have run
  let fill = props.saved == null ? 0 : 1; // the image written, 0-1
  let first = true;
  const st = {
    speed: { v: 0 },
    show: { v: 0 },
    stall: { v: 0 },
    flow: { v: 0 },
    flowSpeed: { v: 0 },
    down: { v: 0 },
    active: { v: 0 },
  };

  // the page re-renders every step while training, so only touch what changed
  const setText = (node, text) => {
    if (node.textContent !== text) node.textContent = text;
  };
  const writeLabels = () => {
    const down = props.phase === 'fault';
    gpuLabels.forEach((l, i) => {
      const lost = down && i === 2;
      setText(l.i, lost ? 'LOST' : `rank ${i}`);
      l.el.toggleAttribute('data-lost', lost);
    });
    setText(storeLabel.i, props.saved == null ? 'none yet' : `step ${props.saved.toLocaleString('en-US')} · 4 ranks`);
  };
  writeLabels();

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0);
  const tmp = new THREE.Color();

  const pose = () => {
    // ring packets ride the track, under the boards and out the other side
    for (let k = 0; k < RING_PACKETS; k++) {
      const u = (((ringT / RING_LOOP + k / RING_PACKETS) % 1) + 1) % 1;
      ring.getPointAt(u, pos);
      ring.getTangentAt(u, tan);
      pos.y = RING.h + 0.05;
      q.setFromUnitVectors(X, tan.normalize());
      scl.setScalar(1);
      m4.compose(pos, q, scl);
      ringPackets.setMatrixAt(k, m4);
    }
    ringPackets.instanceMatrix.needsUpdate = true;

    // stream packets rise out of each board and settle into the store (or the
    // other way on a restart), shrinking in at either end
    const back = props.phase === 'restore';
    curves.forEach((curve, i) => {
      for (let k = 0; k < STREAM_PACKETS; k++) {
        let u = (((streamT / STREAM_TRIP + k / STREAM_PACKETS + i * 0.13) % 1) + 1) % 1;
        if (back) u = 1 - u;
        curve.getPointAt(u, pos);
        curve.getTangentAt(u, tan);
        if (back) tan.negate();
        q.setFromUnitVectors(X, tan.normalize());
        scl.setScalar(Math.max(0.001, clamp01(Math.min(u, 1 - u) * 9)));
        m4.compose(pos, q, scl);
        streamPackets.setMatrixAt(i * STREAM_PACKETS + k, m4);
      }
    });
    streamPackets.instanceMatrix.needsUpdate = true;
  };

  const paint = () => {
    // ring packets: lit while training, greyed and dim when the collective stalls
    const show = st.show.v;
    ringPackets.visible = show > 0.001;
    mats.ring.opacity = show;
    mats.ring.color.lerpColors(col.accent, col.stall, st.stall.v * 0.7);
    mats.ring.emissiveIntensity = 0.5 * (1 - st.stall.v * 0.85);

    const flow = st.flow.v;
    streamPackets.visible = flow > 0.001;
    mats.stream.opacity = flow;
    mats.trace.opacity = flow * 0.32;
    for (const t of traces) t.visible = flow > 0.001;

    // the boards: load meters in the accent, GPU 2 red while it is down
    gpus.forEach((gpu, i) => {
      const down = i === 2 ? st.down.v : 0;
      gpu.pcbMat.color.lerpColors(col.pcb, col.fault, down * 0.4);
      gpu.sinkMat.color.lerpColors(col.sink, col.fault, down * 0.55);
      gpu.g.position.y = -0.05 * down;
      const level = gpu.meter.v * SEGMENTS;
      gpu.segs.forEach((seg, k) => {
        const lit = clamp01(level - k);
        seg.material.color.lerpColors(col.ledOff, col.accent, lit);
        seg.material.emissive.lerpColors(col.black, col.accent, lit * 0.45);
      });
      gpu.led.material.color.lerpColors(col.accent, col.fault, down);
      gpu.led.material.emissive.copy(tmp.lerpColors(col.accent, col.fault, down)).multiplyScalar(0.5);
    });

    // the store: bays light as the image is written; the trim while it is busy
    const filled = 1 - (1 - fill) ** 3;
    bayLeds.forEach((led, k) => {
      const lit = clamp01(filled * BAYS - k);
      led.material.color.lerpColors(col.ledOff, col.accent, lit);
      led.material.emissive.lerpColors(col.black, col.accent, lit * 0.45);
    });
    mats.trim.color.lerpColors(col.ledOff, col.accent, st.active.v);
    mats.trim.emissive.lerpColors(col.black, col.accent, st.active.v * 0.5);

    stalled.opacity = st.stall.v;
  };

  return {
    // its shaders, linked in the background: useScene holds the first frame for this
    ready: precompile(renderer, scene, camera),
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      gl.setSize(size.w, size.h);
      fit();
      project();
    },
    setColors() {
      c = readScoped(ctx.el, c);
      pal = palette(c, fault);
      recolor();
    },
    update(next) {
      if (!next) return;
      if (next.phase !== props.phase) age = 0;
      if (next.saved != null && next.saved !== props.saved) fill = reduced ? 1 : 0;
      if (next.saved == null) fill = 0;
      if (next.fault && next.fault !== ctx.fault) {
        fault = parseColor(next.fault) ?? fault;
        pal = palette(c, fault);
        recolor();
      }
      props = { phase: next.phase, running: next.running, levels: next.levels ?? [], saved: next.saved };
      writeLabels();
    },
    render(ms, now) {
      if (gl.lost) return false;
      const dt = Math.min(ms, 50) / 1000;
      const snap = first || reduced;
      first = false;
      age += dt;
      const { phase, running } = props;
      const training = phase === 'train';
      const flowing = phase === 'ckpt' || phase === 'restore';
      const holding = !reduced && phase === 'restore' && age < HOLD_S && st.down.v > 0;

      let busy = false;
      busy = approach(st.speed, !reduced && running && training ? 1 : 0, dt, 0.22, snap) || busy;
      busy = approach(st.show, training || phase === 'fault' ? 1 : 0, dt, 0.2, snap) || busy;
      busy = approach(st.stall, phase === 'fault' ? 1 : 0, dt, 0.25, snap) || busy;
      busy = approach(st.flow, flowing ? 1 : 0, dt, 0.2, snap) || busy;
      busy = approach(st.flowSpeed, !reduced && running && flowing ? 1 : 0, dt, 0.2, snap) || busy;
      busy = approach(st.down, phase === 'fault' || holding ? 1 : 0, dt, phase === 'fault' ? 0.18 : 0.35, snap) || busy;
      busy = approach(st.active, flowing ? 1 : 0, dt, 0.2, snap) || busy;
      gpus.forEach((gpu, i) => {
        busy = approach(gpu.meter, props.levels[i] ?? 0, dt, 0.22, snap) || busy;
      });
      if (holding) busy = true;
      if (props.saved != null && fill < 1) {
        fill = Math.min(1, fill + dt / FILL_S);
        busy = true;
      }
      ringT += dt * st.speed.v;
      streamT += dt * st.flowSpeed.v;
      if (st.speed.v > 0 || st.flowSpeed.v > 0) busy = true;

      // ease the tilt toward the pointer
      const yawing = approach(tiltNow.yaw, tiltTo.yaw, dt, 0.11, !tilts);
      const pitching = approach(tiltNow.pitch, tiltTo.pitch, dt, 0.11, !tilts);
      aim(tiltNow.yaw.v, tiltNow.pitch.v);

      pose();
      paint();
      renderer.render(scene, camera);
      project();
      gl.watch(now);
      return busy || yawing || pitching;
    },
    dispose() {
      ctx.el.removeEventListener('pointermove', onMove);
      ctx.el.removeEventListener('pointerleave', onLeave);
      overlay.remove();
      disposeTree(scene);
      gl.dispose();
    },
  };
}
