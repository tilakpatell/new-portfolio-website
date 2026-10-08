// The secret world's 3D, for lib/three/useScene: the gateway (./gateway.js)
// and the Dhurandhar universe (./universe.js), one camera between them, and
// bloom over both. At the gateway you look round the courtyard (drag, and
// scroll or pinch to come closer) and step through the portal (click it, or
// the page's button). The camera flies into the swirl, the light whites
// out, and you come out over the island, circling it. Click an exhibit (or
// use the page's arrows) and the camera flies to its case; the page shows
// its plaque in full.
//
// The list itself hangs beside the island too (./document.js): point at a
// line and it lights up, click it and the camera flies to its exhibit (or a
// line that's a link opens it).
//
// ctx: { el, exhibits, doc, tribute, photos, onEvent, reduced, onLost, onSlow }. The scene tells
// the page: 'mode' { mode: 'gate' | 'warp' | 'universe' }, 'focus' { index }
// (-1 for none, 'doc' for the list), 'hover' { index, line? } (-1 for
// none; `line` the list's line under the pointer). The page calls enter(),
// leave(), focus(i), readList().

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clamp01, createRenderer, easeInOut } from '../../lib/three/renderer';
import { build as buildGateway } from './gateway';
import { build as buildUniverse } from './universe';

const WARP = 2.3; // seconds, into the portal
const BLOOM = 0.32; // the glow's strength, only over what's brighter than white
const ARRIVE = 1.6; // seconds of the field of view settling after it
const VIEWS = {
  gate: { target: new THREE.Vector3(0, 3.6, 0), yaw: 0, pitch: 0.1, dist: 22, yawMax: 1.05, pitchMin: 0.0, pitchMax: 0.55, distMin: 8, distMax: 36 },
  universe: { target: new THREE.Vector3(0, 2.2, 0), yaw: 0.6, pitch: 0.34, dist: 46, yawMax: Infinity, pitchMin: 0.04, pitchMax: 1.25, distMin: 6, distMax: 95 },
};
const angleTo = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));

export async function create(canvas, ctx) {
  const gl = createRenderer(canvas, { alpha: false, ratio: 2, toneMapping: THREE.ACESFilmicToneMapping, exposure: 0.88, onLost: ctx.onLost, onSlow: ctx.onSlow, guard: { invalidate: ctx.invalidate } });
  const { renderer } = gl;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let onEvent = ctx.onEvent ?? (() => {});
  const tell = (e) => onEvent(e);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();
  const still = new THREE.TextureLoader().load('/dickansh/stills/dhurandhar-06.webp');
  still.colorSpace = THREE.SRGBColorSpace;

  const gate = buildGateway({ renderer, still });
  const uni = buildUniverse({ renderer, exhibits: ctx.exhibits ?? [], doc: ctx.doc, tribute: ctx.tribute });
  if (ctx.photos) uni.setPhotos(ctx.photos);
  gate.scene.environment = env;
  gate.scene.environmentIntensity = 0.45;
  uni.scene.environment = env;
  uni.scene.environmentIntensity = 0.7;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  const composer = new EffectComposer(renderer);
  const pass = new RenderPass(gate.scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM, 0.4, 1.4);
  composer.addPass(pass);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const size = { w: 1, h: 1, ratio: gl.ratio };

  // the camera: an orbit round a target, every part eased toward its goal
  let mode = 'gate';
  let view = VIEWS.gate;
  const cam = { yaw: 0.55, pitch: 0.32, dist: 48, target: view.target.clone() };
  const goal = { yaw: view.yaw, pitch: view.pitch, dist: view.dist, target: view.target.clone() };
  let warp = null; // { t, from, fov }
  let arrive = 0;
  let focused = -1;
  let idle = 0;
  const setView = (v, from) => {
    view = v;
    Object.assign(cam, from);
    cam.target = from.target.clone();
    Object.assign(goal, { yaw: v.yaw, pitch: v.pitch, dist: v.dist, target: v.target.clone() });
  };
  const place = () => {
    const cp = Math.cos(cam.pitch);
    camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(cam.target);
  };

  const focus = (i) => {
    if (mode !== 'universe') return;
    focused = i;
    // its lines picked out on the list, Word's highlighter yellow
    uni.markExhibit(typeof i === 'number' ? i : -1);
    if (i === -1) {
      goal.target.copy(VIEWS.universe.target);
      goal.dist = VIEWS.universe.dist;
      goal.pitch = VIEWS.universe.pitch;
    } else {
      const p = i === 'doc' ? uni.docPose() : i === 'friends' ? uni.friendsPose() : uni.exhibitPose(i);
      const off = p.camera.clone().sub(p.target);
      goal.target.copy(p.target);
      goal.dist = off.length();
      goal.pitch = Math.asin(off.y / goal.dist);
      goal.yaw = angleTo(cam.yaw, Math.atan2(off.x, off.z));
    }
    tell({ type: 'focus', index: i });
  };

  const enter = () => {
    if (mode !== 'gate') return;
    mode = 'warp';
    warp = { t: 0, from: camera.position.clone(), look: cam.target.clone() };
    tell({ type: 'mode', mode });
  };
  const arriveInUniverse = () => {
    mode = 'universe';
    warp = null;
    arrive = ARRIVE;
    pass.scene = uni.scene;
    setView(VIEWS.universe, { yaw: 1.4, pitch: 0.75, dist: 150, target: VIEWS.universe.target });
    focused = -1;
    hover = -1;
    tell({ type: 'mode', mode });
    tell({ type: 'focus', index: -1 });
  };
  const leave = () => {
    if (mode !== 'universe') return;
    mode = 'gate';
    focused = -1;
    arrive = 0;
    hover = -1;
    uni.setHover(-1);
    uni.setLineHover(-1);
    el.style.cursor = '';
    pass.scene = gate.scene;
    gate.setPower(0);
    camera.fov = 50;
    camera.updateProjectionMatrix();
    setView(VIEWS.gate, { yaw: 0, pitch: 0.05, dist: 3, target: VIEWS.gate.target });
    tell({ type: 'mode', mode });
    tell({ type: 'focus', index: -1 });
  };

  // pointer: drag to look, click to pick, wheel or pinch to come closer
  const el = ctx.el;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointers = new Map();
  let down = null;
  let pinch = 0;
  let hover = -1;
  // what's under the pointer: at the gate, the portal (0) or nothing (-1);
  // in the universe { index: an exhibit's, or -1, line: the list's line, or null }
  const pick = (e) => {
    const box = el.getBoundingClientRect();
    ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (mode === 'gate') return ray.intersectObject(gate.portal, false).length ? 0 : -1;
    if (mode !== 'universe') return { index: -1, line: null };
    const hit = ray.intersectObjects([...uni.pickables, ...uni.pages, ...uni.friends()], true)[0];
    if (!hit) return { index: -1, line: null };
    if (hit.object.userData.friend) return { index: -1, line: null, friend: true };
    if (hit.object.userData.exhibit !== undefined) return { index: hit.object.userData.exhibit, line: null };
    return { index: -1, line: uni.lineAt(hit) };
  };
  const same = (a, b) => (typeof a === 'number' ? a === b : a?.index === b?.index && a?.line?.i === b?.line?.i && Boolean(a?.friend) === Boolean(b?.friend));
  const onDown = (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) down = { x: e.clientX, y: e.clientY, moved: 0 };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
    el.setPointerCapture?.(e.pointerId);
    idle = 0;
  };
  const onMove = (e) => {
    const prev = pointers.get(e.pointerId);
    if (prev && pointers.size === 1 && down) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      down.moved += Math.abs(dx) + Math.abs(dy);
      goal.yaw -= dx * 0.0055;
      goal.pitch += dy * 0.004;
      idle = 0;
    } else if (prev && pointers.size === 2) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) goal.dist *= pinch / d;
      pinch = d;
      if (down) down.moved = 99;
      return;
    }
    if (prev) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pointers.size && e.pointerType === 'mouse') {
      const h = pick(e);
      if (!same(h, hover)) {
        hover = h;
        if (mode === 'gate') {
          el.style.cursor = h >= 0 ? 'pointer' : '';
          tell({ type: 'hover', index: h >= 0 ? 0 : -1 });
        } else {
          el.style.cursor = h.index >= 0 || h.line || h.friend ? 'pointer' : '';
          uni.setHover(h.index);
          uni.setLineHover(h.line?.i ?? -1);
          tell({ type: 'hover', index: h.index, line: h.line, friend: Boolean(h.friend) });
        }
      }
    }
  };
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (down && pointers.size === 0) {
      if (down.moved < 8) {
        const h = pick(e);
        if (mode === 'gate' && h === 0) enter();
        else if (mode === 'universe') {
          // a line of the list: its link, or its exhibit
          if (h.line?.link) window.open(h.line.link, '_blank', 'noopener,noreferrer');
          else if (h.line) focus(h.line.x);
          else if (h.friend) focus('friends');
          else focus(h.index >= 0 ? h.index : focused === 'doc' ? 'doc' : -1);
        }
      }
      down = null;
    }
  };
  const onWheel = (e) => {
    e.preventDefault();
    goal.dist *= 1 + Math.max(-0.3, Math.min(0.3, e.deltaY * 0.0012));
    idle = 0;
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  let lowered = false;
  let frames = 0;
  // the universe's shaders and textures go up to the chip while you're still at the gate
  let disposed = false;
  uni.ready.then(() => !disposed && renderer.compileAsync?.(uni.scene, camera)).catch(() => {});

  const api = {
    ready: gate.ready,
    enter,
    leave,
    focus,
    readList: () => focus('doc'),
    friends: () => focus('friends'),
    // the camera straight to where it's easing to (for the QA scripts' screenshots)
    snap() {
      Object.assign(cam, { yaw: goal.yaw, pitch: goal.pitch, dist: goal.dist });
      cam.target.copy(goal.target);
      arrive = 0;
      camera.fov = 50;
      camera.updateProjectionMatrix();
    },
    get mode() {
      return mode;
    },
    get focused() {
      return focused;
    },
    // frames drawn so far (for the QA scripts: wait on frames, not the clock)
    get frames() {
      return frames;
    },
    resize(w, h) {
      size.w = w;
      size.h = h;
      gl.setSize(w, h);
      composer.setPixelRatio(gl.ratio);
      composer.setSize(w, h);
      bloom.resolution.set(w * 0.5, h * 0.5);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    update(props) {
      if (props?.onEvent) onEvent = props.onEvent;
      if (props?.photos) uni.setPhotos(props.photos);
    },
    lowerQuality() {
      if (lowered) return;
      lowered = true;
      bloom.enabled = false;
      for (const s of [gate.scene, uni.scene]) s.traverse((o) => o.isLight && (o.castShadow = false));
    },
    render(ms, now) {
      const dt = Math.min(0.05, ms / 1000);
      const wall = Math.min(0.25, ms / 1000); // the crossing keeps to the clock, however slow the frames
      const t = now / 1000;
      if (gl.ratio !== size.ratio) {
        size.ratio = gl.ratio;
        composer.setPixelRatio(gl.ratio);
        composer.setSize(size.w, size.h);
      }
      idle += dt;
      if (mode === 'gate' || mode === 'warp') gate.update(dt, t);
      else uni.update(dt, t);

      // the limits, then the ease toward the goal
      goal.pitch = Math.max(view.pitchMin, Math.min(view.pitchMax, goal.pitch));
      goal.dist = Math.max(view.distMin, Math.min(view.distMax, goal.dist));
      if (Number.isFinite(view.yawMax)) goal.yaw = Math.max(-view.yawMax, Math.min(view.yawMax, goal.yaw));
      if (mode === 'universe' && focused === -1 && idle > 4 && !ctx.reduced) goal.yaw += dt * 0.06;
      const k = 1 - Math.exp(-dt * (focused !== -1 ? 2.6 : 3.2));
      cam.yaw += (goal.yaw - cam.yaw) * k;
      cam.pitch += (goal.pitch - cam.pitch) * k;
      cam.dist += (goal.dist - cam.dist) * k;
      cam.target.lerp(goal.target, k);

      if (mode === 'warp' && warp) {
        warp.t += wall * (ctx.reduced ? 2 : 1);
        const u = clamp01(warp.t / WARP);
        const e = easeInOut(u);
        const into = gate.portalCenter.clone().setZ(-2.5);
        camera.position.lerpVectors(warp.from, into, e);
        camera.lookAt(warp.look.clone().lerp(gate.portalCenter.clone().setZ(-6), e));
        camera.fov = 50 + (ctx.reduced ? 0 : e * 55);
        camera.updateProjectionMatrix();
        gate.setPower(e);
        bloom.strength = BLOOM + e * e * 1.6;
        if (u >= 1) arriveInUniverse();
      } else {
        place();
        if (arrive > 0) {
          arrive = Math.max(0, arrive - wall);
          const u = 1 - arrive / ARRIVE;
          camera.fov = 105 - easeInOut(u) * 55;
          camera.updateProjectionMatrix();
          bloom.strength = BLOOM + (1 - u) * 1.6;
        } else bloom.strength = BLOOM;
      }
      composer.render(dt);
      frames += 1;
      gl.watch(now);
      return true;
    },
    dispose() {
      disposed = true;
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.style.cursor = '';
      gate.dispose();
      uni.dispose();
      still.dispose();
      env.dispose();
      pmrem.dispose();
      composer.dispose?.();
      bloom.dispose?.();
      gl.dispose();
    },
  };
  if (import.meta.env.DEV && typeof window !== 'undefined') window.__dickansh = api;
  // a scene made again (the graphics chip lost and back) starts at the gate: the page hears so
  queueMicrotask(() => {
    if (disposed) return;
    tell({ type: 'mode', mode });
    tell({ type: 'focus', index: -1 });
  });
  return api;
}
