// The cockpit in WebGL: you in the pilot's seat of one of the vehicles
// (./vehicles), looking about, then the launch. Two passes a frame with one
// eye: the world outside (space, the street, the desert) and then, over it
// with its own depth, the cockpit and its crew, so the frame of the glass is
// always in front of whatever is out there. Bloom on a desktop's graphics
// chip; phones and software WebGL draw without it, at a lower resolution.
//
// A vehicle can turn your head itself during the launch (the RV looks out at
// its wings): its aim(t, plan) is a [yaw, pitch] added to wherever you're
// looking. Not with reduced motion.
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
import { createRenderer, disposeTree, precompile, precompilePasses } from '../../lib/three/renderer';
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

  // phones and software WebGL: no bloom; everyone at most 1.5 pixels to the
  // pixel (the picture fills the screen, and the desktop's carries MSAA and bloom)
  const info = gpu();
  // (in development, window.__tpRich draws the desktop's way in software WebGL, for screenshots)
  const rich = (info.ok || (import.meta.env.DEV && !!window.__tpRich)) && !coarse();
  const gl = createRenderer(canvas, { alpha: false, antialias: !rich, ratio: 1.5, toneMapping: THREE.ACESFilmicToneMapping, exposure: 1, onLost: () => fail('context lost'), onSlow: () => lower() });
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
  // (`glance`: a vehicle's look over at its crew a moment after you sit
  // down, which shows the view moves; any look of your own ends it)
  const look = { yaw: 0, pitch: 0, ty: 0, tp: 0, rest: [0, 0], range: [1, 0.4], glance: 0, sat: 0, own: false };
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
  let warming = null; // a vehicle whose shaders are still linking (pick): not drawn yet
  const flashColor = new THREE.Color();
  const shake = new THREE.Vector2();

  // (development: window.__tpStats counts a whole frame's draws, both passes
  // and the bloom's, for info() below)
  const stats = import.meta.env.DEV && typeof window !== 'undefined' && !!window.__tpStats ? { calls: 0, triangles: 0, ms: 0 } : null;
  if (stats) renderer.info.autoReset = false;
  const draw = () => {
    if (composer) composer.render();
    else {
      renderer.clear();
      renderer.render(outside, camOut);
      renderer.clearDepth();
      renderer.render(inside, camIn);
    }
  };

  // Everything a vehicle has, drawn once: what's hidden too (the RV's wings,
  // what its launch cuts to) and what's behind you, so their textures and
  // meshes are on the graphics chip before the moment they're first seen
  // (three.js sends each the first time it's drawn, and that frame waits).
  // Lights stay as they were: a hidden one shown would link shaders of its own.
  const warm = () => {
    const undo = [];
    const set = (o, key, to) => {
      if (o[key] === to) return;
      undo.push([o, key, o[key]]);
      o[key] = to;
    };
    const show = (o, hidden) => {
      const was = hidden || !o.visible;
      if (o.isLight) {
        if (was) set(o, 'visible', false);
        return;
      }
      set(o, 'visible', true);
      if (o.isMesh || o.isPoints || o.isLine || o.isSprite) set(o, 'frustumCulled', false);
      for (const child of o.children) show(child, was);
    };
    show(inside, false);
    show(outside, false);
    try {
      draw();
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[cockpit] warm-up failed', err);
    } finally {
      for (let i = undo.length - 1; i >= 0; i--) undo[i][0][undo[i][1]] = undo[i][2];
    }
  };
  let late = false; // something arrived after the vehicle was drawn (`added`, below)

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

    if (v && v !== warming) {
      // the head: where you're looking, eased; drawn back ahead as you go
      const ahead = L.on ? smooth(Math.min(1, L.t / (L.plan.spool * 0.9 + 1))) : 0;
      const since = clock - look.sat;
      const glance = look.own || L.on ? 0 : look.glance * (smooth((since - 1.4) / 1.1) - smooth((since - 3.6) / 1.2));
      const aim = L.on && !reduced ? v.aim?.(L.t, L.plan) : null;
      const ty = look.ty + glance + (look.rest[0] - look.ty) * ahead + (aim?.[0] ?? 0);
      const tp = look.tp + (look.rest[1] - look.tp) * ahead + (aim?.[1] ?? 0);
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
      // (not during a launch: better a model that pops in than a held frame)
      if (late && !L.on) {
        late = false;
        warm();
      }
      if (stats) {
        renderer.info.reset();
        const t0 = performance.now();
        draw();
        stats.ms = performance.now() - t0;
        stats.calls = renderer.info.render.calls;
        stats.triangles = renderer.info.render.triangles;
      } else draw();
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
    if (!raf) raf = requestAnimationFrame(frame); // (one chain, even if the frame kicked)
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

  // A part of a vehicle that arrives after the vehicle is on screen (a model
  // still downloading when the rest was ready). Sat in the cockpit, it's
  // drawn once on the next frame with everything else (`warm`). During a
  // launch a frame can't be held for it: its pictures go to the graphics
  // chip now and its shaders link in the background, which is most of what
  // its first frame would have waited for.
  function added(root, where) {
    if (stopped || failed) return;
    if (!L.on) {
      late = true;
      kick();
      return;
    }
    const scene = where === 'inside' ? inside : outside;
    let o = root;
    while (o && o !== scene) o = o.parent;
    if (!o) return;
    root.traverse((m) => {
      for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : [])
        for (const v of Object.values(mat))
          if (v?.isTexture && v.image)
            try {
              renderer.initTexture(v);
            } catch {
              /* it will go up on its first frame instead */
            }
    });
    precompile(renderer, root, where === 'inside' ? camIn : camOut, scene, composer ? composer.readBuffer : null);
  }

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
      const built = await mod.build({ renderer, pmrem, rich, reduced, coarse: coarse(), say: (line) => cb.onLine?.(line), added });
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
      look.glance = v.glance ?? 0;
      look.sat = clock;
      L.plan = planOf(id);
      fit();
      // compile everything now, behind the black, so the first look doesn't
      // stall: the GPU links in the background while the frames hold off
      // drawing it (lib/three/renderer's precompile)
      warming = built;
      const into = composer ? composer.readBuffer : null;
      await Promise.all([precompile(renderer, outside, camOut, outside, into), precompile(renderer, inside, camIn, inside, into), composer ? precompilePasses(renderer, composer, camIn) : null]);
      if (warming === built) warming = null;
      if (stopped || v !== built) return;
      // still behind the black: draw it all once, then black again
      late = false;
      warm();
      renderer.setRenderTarget(null);
      renderer.clear();
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
    // (development: what the renderer holds and what the last frame drew;
    // a count that grows during a launch is something made or linked late)
    info() {
      if (!import.meta.env.DEV) return null;
      return { t: L.t, programs: renderer.info.programs?.length ?? 0, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, ...stats };
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
      look.own = true;
      look.ty = look.rest[0] - nx * look.range[0] * 0.9;
      look.tp = look.rest[1] - ny * look.range[1] * 0.9;
      clampLook();
      return hit(nx, ny);
    },
    // a finger dragging: by how much (pixels)
    drag(dx, dy) {
      look.own = true;
      const k = 2.4 / Math.max(size.w, size.h);
      look.ty += dx * k;
      look.tp += dy * k;
      clampLook();
    },
    // the arrow keys
    nudge(dx, dy) {
      look.own = true;
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
