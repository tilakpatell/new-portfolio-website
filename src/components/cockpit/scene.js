// The cockpit in WebGL: you in the pilot's seat of one of the vehicles
// (./vehicles), looking about, then the launch. Two passes a frame with one
// eye: the world outside (space, the street, the desert) and then, over it
// with its own depth, the cockpit and its crew, so the frame of the glass is
// always in front of whatever is out there. Bloom on a desktop's graphics
// chip; phones and software WebGL draw without it, at a lower resolution.
//
// run(canvas, opts) → { pick(id), go(), skip(), look…, stop() }
//   opts: { vehicle, veil, reduced, onBoarded(id), onPeak, onDone, onFail,
//           onLine(line), onPhase(name) }
// Throws if WebGL can't start; onFail if it's lost or a vehicle won't build.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRenderer, disposeTree } from '../../lib/three/renderer';
import { gpu } from '../../lib/gpu';
import { flashAt, phaseAt, plan as planOf, skipTo, smooth, throttleAt } from './timeline';
import { freeKit } from './kit';
import { cockpitSound } from './sounds';

const BUILD = {
  falcon: () => import('./vehicles/falcon'),
  xwing: () => import('./vehicles/xwing'),
  cruiser: () => import('./vehicles/cruiser'),
  rv: () => import('./vehicles/rv'),
};
export const preloadVehicle = (id) => BUILD[id]?.().then((m) => m.prefetch?.()).catch(() => {});

const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
const DEG = Math.PI / 180;

export function run(canvas, opts) {
  const { veil, reduced = false } = opts;
  const cb = opts;
  let failed = false;
  let stopped = false;
  const fail = (why) => {
    if (failed || stopped) return;
    failed = true;
    if (import.meta.env.DEV) console.error('[cockpit]', why);
    teardown();
    cb.onFail?.(why);
  };

  // phones and software WebGL: no bloom, and a lower ceiling on sharpness
  const info = gpu();
  // (in development, window.__tpRich draws the desktop's way in software WebGL, for screenshots)
  const rich = (info.ok || (import.meta.env.DEV && !!window.__tpRich)) && !coarse();
  const gl = createRenderer(canvas, { alpha: false, antialias: !rich, ratio: rich ? 2 : 1.5, toneMapping: THREE.ACESFilmicToneMapping, exposure: 1, onLost: () => fail('context lost'), onSlow: () => lower() });
  const { renderer } = gl;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const roomEnv = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();

  const inside = new THREE.Scene();
  const outside = new THREE.Scene();
  inside.environment = roomEnv;
  inside.environmentIntensity = 0.35;

  // one eye for both passes: the rig sits at the seat, the head turns
  const rig = new THREE.Object3D();
  const head = new THREE.Object3D();
  head.rotation.order = 'YXZ';
  rig.add(head);
  inside.add(rig);
  const camIn = new THREE.PerspectiveCamera(60, 1, 0.02, 40);
  head.add(camIn);
  const camOut = new THREE.PerspectiveCamera(60, 1, 0.3, 6000);

  let composer = null;
  let bloom = null;
  const passOut = new RenderPass(outside, camOut);
  const passIn = new RenderPass(inside, camIn);
  passIn.clear = false;
  passIn.clearDepth = true;
  if (rich) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(passOut);
    composer.addPass(passIn);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.42, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  function lower() {
    // still slow at the lowest sharpness: drop the bloom
    if (!composer) return;
    composer.dispose();
    composer = null;
  }

  // ── the vehicle ──
  let v = null; // the built vehicle
  let vid = null;
  let building = null;
  const size = { w: 1, h: 1 };
  const view = new THREE.Vector2();

  const fit = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    size.w = w;
    size.h = h;
    gl.setSize(w, h);
    composer?.setPixelRatio(gl.ratio);
    composer?.setSize(w, h);
    if (bloom) bloom.resolution.set(Math.round(w / 2), Math.round(h / 2));
    renderer.getDrawingBufferSize(view);
    v?.resize?.(view.x, view.y, gl.ratio);
    lens();
  };
  // A horizontal field of view the cockpit is framed for, kept within sane
  // vertical limits: a wide window's view gets taller, a phone's narrower
  // (look about to see the rest).
  let fovKick = 0;
  const lens = () => {
    const a = size.w / size.h;
    const hf = (v?.hfov ?? 86) * DEG;
    let vf = 2 * Math.atan(Math.tan(hf / 2) / a) / DEG;
    vf = Math.min(v?.vmax ?? 94, Math.max(v?.vmin ?? 52, vf));
    vf *= 1 + fovKick;
    for (const c of [camIn, camOut]) {
      c.fov = vf;
      c.aspect = a;
      c.updateProjectionMatrix();
    }
  };
  window.addEventListener('resize', fit);

  // ── looking about ──
  const look = { yaw: 0, pitch: 0, ty: 0, tp: 0, rest: [0, 0], range: [1, 0.4], hover: true };
  const clampLook = () => {
    look.ty = Math.max(look.rest[0] - look.range[0], Math.min(look.rest[0] + look.range[0], look.ty));
    look.tp = Math.max(look.rest[1] - look.range[1], Math.min(look.rest[1] + look.range[1], look.tp));
  };

  // ── the launch ──
  const L = { at: 0, t: 0, on: false, peaked: false, done: false, plan: planOf('falcon') };
  let sound = null;

  // ── the frame ──
  let raf = 0;
  let last = 0;
  let clock = 0;
  let fade = 1; // the black between vehicles: 1 covers, 0 clear
  let fadeTo = 1;
  let firstDrawn = false;
  const flashColor = new THREE.Color();
  const shake = new THREE.Vector2();

  const draw = () => {
    if (composer) composer.render();
    else {
      renderer.clear();
      renderer.render(outside, camOut);
      renderer.clearDepth();
      renderer.render(inside, camIn);
    }
  };

  const frame = (now) => {
    raf = 0;
    if (failed || stopped || gl.lost) return;
    if (document.hidden) return;
    // the launch keeps real time (its sounds are scheduled in it), however
    // slowly the frames come; everything else steps at most 50 ms a frame
    const real = last ? Math.min(250, now - last) : 16;
    const dt = Math.min(0.05, real / 1000);
    last = now;
    clock += dt;
    gl.watch(now);

    let throttle = 0;
    let ph = null;
    if (L.on) {
      if (!L.hold) L.t += real;
      ph = phaseAt(L.plan, L.t);
      throttle = throttleAt(L.plan, L.t);
      if (!L.peaked && L.t >= L.plan.peak) {
        L.peaked = true;
        cb.onPeak?.();
      }
    }

    if (v) {
      // the head: where you're looking, eased; drawn back ahead as you go
      const ahead = L.on ? smooth(Math.min(1, L.t / (L.plan.spool * 0.9 + 1))) : 0;
      const ty = look.ty + (look.rest[0] - look.ty) * ahead;
      const tp = look.tp + (look.rest[1] - look.tp) * ahead;
      const k = 1 - Math.exp(-dt * (L.on ? 7 : 4.5));
      look.yaw += (ty - look.yaw) * k;
      look.pitch += (tp - look.pitch) * k;
      // a little life when sitting still, a shudder when going
      const idle = reduced ? 0 : 1;
      const rumble = reduced ? 0 : (v.rumble ?? 1) * (ph?.name === 'spool' ? 0.0025 * ph.k : 0) + (L.on ? 0.009 * throttle * throttle : 0);
      shake.set(Math.sin(clock * 37.1) * 0.6 + Math.sin(clock * 23.7) * 0.4, Math.sin(clock * 41.3) * 0.5 + Math.sin(clock * 29.9) * 0.5).multiplyScalar(rumble);
      head.rotation.set(look.pitch + Math.sin(clock * 0.7) * 0.004 * idle + shake.y, look.yaw + Math.sin(clock * 0.43) * 0.006 * idle + shake.x, shake.x * 0.4);
      head.position.y = Math.sin(clock * 1.1) * 0.003 * idle;
      fovKick = reduced ? 0 : 0.16 * Math.pow(throttle, 2) - (ph?.name === 'spool' ? 0.02 * ph.k : 0);
      lens();

      v.update(dt, clock, { launching: L.on, t: L.t, phase: ph, throttle, plan: L.plan, look });
      sound?.set({ throttle, t: L.t, launching: L.on });

      // both eyes the same
      rig.updateMatrixWorld(true);
      camIn.getWorldPosition(camOut.position);
      camIn.getWorldQuaternion(camOut.quaternion);
      camOut.updateMatrixWorld(true);
      draw();
      if (!firstDrawn) {
        firstDrawn = true;
        cb.onFirstFrame?.();
      }
    } else {
      renderer.clear();
    }

    // the black between vehicles, the flash, and the way out
    fade += (fadeTo - fade) * (1 - Math.exp(-dt * 9));
    let flash = 0;
    if (L.on) {
      flash = flashAt(L.plan, L.t);
      if (ph?.name === 'out' || ph?.name === 'done') canvas.style.opacity = String(1 - smooth(ph.k * 1.25));
    }
    if (veil) {
      if (flash > fade && v) {
        flashColor.set(v.flash ?? '#eaf3ff');
        veil.style.background = `#${flashColor.getHexString()}`;
        veil.style.opacity = String(L.peaked ? flash : flash * 0.96);
      } else {
        veil.style.background = '#000';
        veil.style.opacity = String(fade < 0.002 ? 0 : fade);
      }
    }

    if (L.on && L.t >= L.plan.end) {
      if (!L.done) {
        L.done = true;
        cb.onDone?.();
      }
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf && !stopped && !failed) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const onVis = () => (document.hidden ? sound?.pause?.() : (sound?.resume?.(), kick()));
  document.addEventListener('visibilitychange', onVis);

  // ── building a vehicle ──
  const dropVehicle = () => {
    if (!v) return;
    sound?.stop();
    sound = null;
    inside.remove(v.inside);
    outside.remove(v.outside);
    v.dispose?.();
    disposeTree(v.inside);
    disposeTree(v.outside);
    if (inside.environment !== roomEnv) {
      inside.environment?.dispose?.();
      inside.environment = roomEnv;
    }
    freeKit();
    v = null;
  };

  async function pick(id) {
    if (L.on || !BUILD[id]) return;
    if (id === vid && (v || building)) return;
    vid = id;
    const mine = (building = {});
    fadeTo = 1;
    kick();
    // let the black come down before the old one goes
    if (v) await new Promise((r) => setTimeout(r, reduced ? 0 : 220));
    if (building !== mine || stopped) return;
    dropVehicle();
    try {
      const mod = await BUILD[id]();
      if (building !== mine || stopped) return;
      const built = await mod.build({ renderer, pmrem, rich, reduced, coarse: coarse(), say: (line) => cb.onLine?.(line) });
      if (building !== mine || stopped) {
        built.dispose?.();
        disposeTree(built.inside);
        disposeTree(built.outside);
        return;
      }
      v = built;
      building = null;
      inside.add(v.inside);
      outside.add(v.outside);
      if (v.environment) {
        inside.environment = v.environment;
        inside.environmentIntensity = v.envIntensity ?? 0.35;
      } else inside.environmentIntensity = v.envIntensity ?? 0.35;
      renderer.toneMapping = v.toneMapping ?? THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = v.exposure ?? 1;
      if (bloom) {
        bloom.strength = v.bloom?.[0] ?? 0.55;
        bloom.radius = v.bloom?.[1] ?? 0.42;
        bloom.threshold = v.bloom?.[2] ?? 0.82;
      }
      rig.position.set(...v.eye);
      look.rest = [...(v.rest ?? [0, 0])];
      look.range = [...(v.range ?? [1, 0.4])];
      look.yaw = look.ty = look.rest[0];
      look.pitch = look.tp = look.rest[1];
      L.plan = planOf(id);
      fit();
      // compile everything now, behind the black, so the first look doesn't stall
      renderer.compile(outside, camOut);
      renderer.compile(inside, camIn);
      sound = cockpitSound(id);
      fadeTo = 0;
      cb.onBoarded?.(id);
      kick();
    } catch (err) {
      if (building === mine) fail(err);
    }
  }

  fit();
  pick(opts.vehicle);

  // ── inputs from the overlay ──
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = (nx, ny) => {
    if (!v?.triggers?.length) return false;
    ndc.set(nx, -ny);
    ray.setFromCamera(ndc, camIn);
    return ray.intersectObjects(v.triggers, true).length > 0;
  };

  function go() {
    if (L.on || !v) return false;
    L.on = true;
    L.t = reduced ? skipTo(L.plan, 0) : 0;
    v.launch?.();
    sound?.launch?.(L.plan, L.t);
    cb.onPhase?.('launch');
    kick();
    return true;
  }

  function teardown() {
    cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('resize', fit);
    document.removeEventListener('visibilitychange', onVis);
    dropVehicle();
    roomEnv.dispose();
    pmrem.dispose();
    composer?.dispose();
    gl.dispose();
  }

  return {
    pick,
    go,
    // on to just before the flash
    skip() {
      if (!L.on) {
        if (!go()) return;
      }
      const to = skipTo(L.plan, L.t);
      if (to > L.t) {
        sound?.skip?.(L.plan, to);
        L.t = to;
      }
    },
    get launching() {
      return L.on;
    },
    // (development: jump to a moment of the launch, for screenshots)
    seek(ms) {
      if (!import.meta.env.DEV) return;
      if (!L.on) go();
      L.t = ms;
      L.hold = true;
    },
    // a mouse over the cockpit: where it points, -1…1 each way
    point(nx, ny) {
      look.ty = look.rest[0] - nx * look.range[0] * 0.9;
      look.tp = look.rest[1] - ny * look.range[1] * 0.9;
      clampLook();
      return hit(nx, ny);
    },
    // a finger dragging: by how much (pixels)
    drag(dx, dy) {
      const k = 2.4 / Math.max(size.w, size.h);
      look.ty += dx * k;
      look.tp += dy * k;
      clampLook();
    },
    // the arrow keys
    nudge(dx, dy) {
      look.ty -= dx * 0.18;
      look.tp -= dy * 0.12;
      clampLook();
    },
    centre() {
      look.ty = look.rest[0];
      look.tp = look.rest[1];
    },
    // a click or tap: launches if it was on the vehicle's lever (or wheel)
    press(nx, ny) {
      return hit(nx, ny) ? go() : false;
    },
    stop() {
      if (stopped) return L.done;
      stopped = true;
      teardown();
      return L.done;
    },
  };
}
