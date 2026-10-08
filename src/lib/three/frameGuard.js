// No frame waits for a shader or a picture: whatever isn't ready on the
// graphics chip yet is left out of the frame and readied behind it, and
// drawn a few frames later. The same rule Minecraft keeps for its chunks
// (a bounded amount sent each frame, nothing drawn before it's ready),
// kept for every draw.
//
// three.js compiles a material's shader and sends its pictures the first
// time it's drawn, and that frame waits for both: a hunter pack arriving, a
// planet's close-up maps or a model streaming in mid-walk each stopped a
// world for a fraction of a second to over a second
// (docs/research/2026-10-07-frame-hitches.md). The guard wraps the
// renderer's own renderBufferDirect (three draws through the instance, so
// every draw passes here): a material that has never been compiled, or that
// uses a picture never sent, isn't drawn this frame. After the frame, the
// waiting ones are readied under a budget (`compileMs` of main-thread time
// and `uploadMB` of pictures a frame): the world's own `adopt` hooks first
// (its house look, so the shader compiled is the one it will draw with),
// the pictures sent, the shader compiled; then a fence, and once the chip
// says the shader has linked, it draws from then on and isn't looked at
// again.
//
// Only the frame itself is held back: a Scene drawn to the canvas, or to a
// buffer the canvas's size (a composer's), with no override material. Left
// alone: the shadow pass (no scene: its depth shaders are small and
// shared), anything drawn outside a Scene (a post pass's quad: leaving it
// out would leave its picture undrawn), the drawings a world makes for
// itself (a floor bake, an environment map, a reflection: into buffers of
// their own size, or with one material over everything, and what's left out
// of those is wrong for good, not for a frame), and a material once it's
// ready, whatever three does to it after (a transparent, double-sided one
// is marked changed twice a frame).
//
// guard(renderer, { uploadMB, compileMs, frame, invalidate }) → { enabled,
//   invalidate, adopt(scene, fn) → undo, pending(), dispose() }, one per renderer (asked again, the same).
// In development, a frame in which three still compiled a shader mid-draw
// says so in the console, so what's still slipping through can be found.

import { fence, knownLinked, markLinked, nextFrame, textureBytes, uploaded } from './gpuWork';

const guards = new WeakMap();
const READY = 1;
const QUEUED = 2;
const MB = 1048576;
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const later = typeof queueMicrotask === 'function' ? queueMicrotask : (fn) => Promise.resolve().then(fn);

// (renderer.compile walks this, against the scene's own lights)
const batchRoot = (list) => ({
  traverse(fn) {
    for (const o of list) fn(o);
  },
  traverseVisible() {},
});

const inScene = (object, scene) => {
  let o = object;
  while (o.parent) o = o.parent;
  return o === scene;
};

export function guard(renderer, { uploadMB = 8, compileMs = 4, frame = nextFrame, invalidate = null } = {}) {
  if (guards.has(renderer)) return guards.get(renderer);
  const state = new WeakMap(); // material → READY | QUEUED
  const pictures = new WeakMap(); // material → the pictures it holds
  const queue = new Map(); // material → an object it was to be drawn on
  const linking = new Set(); // compiled, waiting to link
  const adopters = new WeakMap(); // scene → its look, put on what's late into it
  let scene = null;
  let camera = null;
  let target = null; // where the scene was drawn (a composer's buffer: other shaders than the canvas's)
  let scheduled = false;
  let gating = false; // the draw in progress is the frame's
  const drawn = { x: 0, y: 0 }; // the canvas's buffer, for telling a frame's buffer from a world's own
  let waiting = false; // a fence in flight
  const dev = Boolean(import.meta.env?.DEV);
  let told = 0;

  const props = (thing) => {
    try {
      return renderer.properties.get(thing);
    } catch {
      return {};
    }
  };
  const picturesOf = (m) => {
    let list = pictures.get(m);
    if (!list) {
      list = [];
      for (const v of Object.values(m)) if (v?.isTexture) list.push(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) list.push(u.value);
      pictures.set(m, list);
    }
    return list;
  };
  const picturesUp = (m) => picturesOf(m).every((t) => uploaded(renderer, t));
  const linked = (m) => {
    const program = props(m).currentProgram;
    if (!program) return false;
    let ok = true;
    try {
      ok = program.isReady();
    } catch {
      ok = true;
    }
    if (ok) markLinked(program);
    return ok;
  };
  const ready = (m) => {
    state.set(m, READY);
    queue.delete(m);
    linking.delete(m);
  };

  const g = {
    enabled: true,
    // asked for a frame once something held back is ready (settable)
    invalidate,
    // fn(object) runs on a thing late into `scene` before its shader is
    // compiled (one per scene, kept no longer than the scene is)
    adopt(scn, fn) {
      adopters.set(scn, fn);
      return () => adopters.get(scn) === fn && adopters.delete(scn);
    },
    pending: () => queue.size + linking.size,
    dispose() {
      renderer.renderBufferDirect = realDraw;
      renderer.render = realRender;
      queue.clear();
      linking.clear();
      guards.delete(renderer);
    },
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    later(pump);
  };

  // linked ones become ready (asked only after a fence: free by then)
  const settleLinks = () => {
    let any = false;
    for (const m of linking) {
      if (!linked(m) || !picturesUp(m)) continue;
      ready(m);
      any = true;
    }
    // (a scene that rests between changes is asked for the frame that shows them)
    if (any) g.invalidate?.();
  };

  function pump() {
    scheduled = false;
    if (waiting || !scene) return;
    settleLinks();
    const t0 = clock();
    const budget = uploadMB * MB;
    let bytes = 0;
    let worked = false;
    for (const [m, object] of queue) {
      if (worked && clock() - t0 > compileMs) break;
      if (!inScene(object, scene)) {
        // (gone from the world meanwhile: looked at afresh if it comes back)
        queue.delete(m);
        state.delete(m);
        continue;
      }
      let full = false;
      for (const t of picturesOf(m)) {
        if (uploaded(renderer, t)) continue;
        const b = textureBytes(t);
        if (bytes > 0 && bytes + b > budget) {
          full = true;
          break;
        }
        try {
          renderer.initTexture(t);
        } catch {
          /* it goes up when it's drawn instead */
        }
        bytes += b;
        worked = true;
      }
      if (full) break;
      try {
        adopters.get(scene)?.(object);
      } catch (err) {
        if (dev) console.warn('[frameGuard] adopt failed', err);
      }
      try {
        compileInto(object);
      } catch (err) {
        // three reports a broken shader on its own, when it's drawn
        if (dev) console.warn('[frameGuard] compile failed', err);
        ready(m);
        continue;
      }
      worked = true;
      queue.delete(m);
      linking.add(m);
    }
    if (!worked && !linking.size) return;
    waiting = true;
    fence(renderer, { frame }).then(() => {
      waiting = false;
      settleLinks();
      if (queue.size) schedule();
    });
  }

  // compiled for where the scene is drawn: three picks a shader's tone
  // mapping and colour space by its target
  const compileInto = (object) => {
    const keep = renderer.getRenderTarget?.() ?? null;
    const swap = keep !== target && renderer.setRenderTarget;
    if (swap) renderer.setRenderTarget(target);
    try {
      renderer.compile(batchRoot([object]), camera, scene);
    } finally {
      if (swap) renderer.setRenderTarget(keep);
    }
  };

  // the canvas, or a buffer its size (where a composer draws the frame)
  const frameTarget = (t) => {
    if (!t) return true;
    const c = renderer.domElement;
    if (c) {
      drawn.x = c.width;
      drawn.y = c.height;
    } else renderer.getDrawingBufferSize?.(drawn);
    return t.width === drawn.x && t.height === drawn.y;
  };

  const realDraw = renderer.renderBufferDirect;
  renderer.renderBufferDirect = function (cam, scn, geometry, material, object, group) {
    if (gating && scn?.isScene && material) {
      const s = state.get(material);
      if (s !== READY) {
        if (s === undefined && knownLinked(props(material).currentProgram) && picturesUp(material)) state.set(material, READY);
        else {
          if (s === undefined) {
            state.set(material, QUEUED);
            queue.set(material, object);
          }
          return undefined;
        }
      }
    }
    if (!dev) return realDraw.call(this, cam, scn, geometry, material, object, group);
    // (development: a shader three made in the middle of this draw, named,
    // so what still slips past the guard can be found where it comes from)
    const had = renderer.info?.programs?.length ?? 0;
    const out = realDraw.call(this, cam, scn, geometry, material, object, group);
    if ((renderer.info?.programs?.length ?? 0) > had && told < 40) {
      told += 1;
      const pass = !gating ? 'off-frame' : scn === null ? 'shadow' : 'frame';
      console.warn(`[frameGuard] shader compiled mid-frame (${pass}): ${material.type}${material.name ? ` "${material.name}"` : ''} on ${object?.type ?? '?'}${object?.name ? ` "${object.name}"` : ''}${object?.parent?.name ? ` in "${object.parent.name}"` : ''}`);
    }
    return out;
  };

  const realRender = renderer.render;
  renderer.render = function (scn, cam) {
    const before = dev ? (renderer.info?.programs?.length ?? 0) : 0;
    const t0 = dev ? clock() : 0;
    const into = scn?.isScene ? (renderer.getRenderTarget?.() ?? null) : null;
    const was = gating;
    gating = g.enabled && Boolean(scn?.isScene) && !scn.overrideMaterial && frameTarget(into);
    let out;
    try {
      out = realRender.call(this, scn, cam);
    } finally {
      gating = was;
    }
    if (scn?.isScene && !scn.overrideMaterial && frameTarget(into)) {
      scene = scn;
      camera = cam;
      target = into;
      if (queue.size || linking.size) schedule();
      if (dev && g.enabled) {
        const made = (renderer.info?.programs?.length ?? 0) - before;
        // (every one counted, for scripts/perf-probe.mjs, however few are said)
        if (made > 0 && typeof window !== 'undefined') window.__tpGuardSlips = (window.__tpGuardSlips ?? 0) + made;
        if (made > 0 && told < 40) {
          told += 1;
          console.warn(`[frameGuard] ${made} shader(s) compiled in a ${Math.round(clock() - t0)} ms frame`);
        }
      }
    }
    return out;
  };

  guards.set(renderer, g);
  return g;
}

// The guard on `renderer`, if it has one.
export const guardOf = (renderer) => guards.get(renderer) ?? null;
