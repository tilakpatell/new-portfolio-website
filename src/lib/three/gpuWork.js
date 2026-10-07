// Work for the graphics chip, handed over a little at a time so no frame
// waits on it: pictures sent a few megabytes at a time, shaders compiled a
// few milliseconds at a time, and a fence after each batch, so the next one
// is only sent once the chip has caught up with the last. Readiness (a
// shader's link) is only asked after a fence has signalled, when asking no
// longer waits on a queue. Nothing here throws or rejects: a context lost, or
// a renderer disposed, midway just ends the work early.
//
// Every function takes `frame` (what to wait for between polls), so tests can
// drive it without a browser.

import { revealAll, texturesUnder, uploadTexture } from './renderer';

// The next animation frame (or about one, where there are none).
export const nextFrame = () =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 16);
  });

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// (a renderer that can't say counts as gone)
const lost = (renderer) => {
  try {
    return renderer.getContext().isContextLost();
  } catch {
    return true;
  }
};

const materialsOf = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);

// Resolves once the graphics chip has done everything sent to it so far:
// WebGL2's fenceSync, asked about once a frame (asking never waits). Without
// WebGL2, two frames. Also resolves if the context goes, anything throws, or
// `cap` milliseconds pass.
export async function fence(renderer, { frame = nextFrame, cap = 5000 } = {}) {
  let gl;
  let sync = null;
  try {
    gl = renderer.getContext();
    if (typeof gl.fenceSync !== 'function') {
      await frame();
      await frame();
      return;
    }
    sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE ?? 0x9117, 0);
    if (!sync) return;
    gl.flush();
    const t0 = now();
    const signalled = gl.SIGNALED ?? 0x9119;
    const status = gl.SYNC_STATUS ?? 0x9114;
    for (;;) {
      await frame();
      if (gl.isContextLost() || now() - t0 > cap) return;
      if (gl.getSyncParameter(sync, status) === signalled) return;
    }
  } catch {
    // gone with its context: nothing left to wait for
  } finally {
    try {
      if (sync) gl.deleteSync(sync);
    } catch {
      // (the context took it)
    }
  }
}

// Whether a picture has nothing (more) to send before its first draw: it's up
// already, it has no picture yet, or it's one three.js sends every frame it
// changes (a video, what a render target draws into). Only the first upload
// counts: a canvas redrawn every frame is up once it's been sent once.
export function uploaded(renderer, texture) {
  if (!texture || texture.isRenderTargetTexture || texture.isVideoTexture || texture.version === 0) return true;
  const image = texture.image;
  if (!image || (Array.isArray(image) && !image.length)) return true;
  try {
    return !!renderer.properties.get(texture).__webglInit;
  } catch {
    return true; // a renderer that can't say can't be sent to either
  }
}

// About how many bytes a picture takes on the graphics chip: its mips' data
// when it's compressed, else four bytes a pixel.
export function textureBytes(texture) {
  if (texture.isCompressedTexture && texture.mipmaps?.length) {
    let sum = 0;
    for (const mip of texture.mipmaps) sum += mip?.data?.byteLength ?? 0;
    return sum;
  }
  const images = Array.isArray(texture.image) ? texture.image : [texture.image];
  let sum = 0;
  for (const img of images) if (img) sum += (img.width || 0) * (img.height || 0) * (img.depth || 1) * 4;
  return sum;
}

// The pictures not yet up, sent smallest first, a fence whenever what's been
// sent since the last reaches `sliceMB`. Resolves with how many were sent.
export async function uploadSlices(renderer, textures, { sliceMB = 24, onStep, frame = nextFrame, alive = () => true } = {}) {
  const todo = [...new Set(textures)].filter((t) => !uploaded(renderer, t));
  const sized = todo.map((t) => [t, textureBytes(t)]).sort((a, b) => a[1] - b[1]);
  const slice = sliceMB * 1024 * 1024;
  let bytes = 0;
  let sent = 0;
  for (const [t, size] of sized) {
    if (!alive() || lost(renderer)) break;
    uploadTexture(renderer, t);
    sent += 1;
    bytes += size;
    onStep?.(sent, sized.length);
    if (bytes >= slice) {
      bytes = 0;
      await fence(renderer, { frame });
    }
  }
  if (bytes > 0 && alive()) await fence(renderer, { frame });
  return sent;
}

// Every object under `roots` that draws (hidden ones too), one for each kind
// of shader it needs: the same materials drawn the same way share one, while
// skinning, instancing, batching, morphs or vertex colours each make another.
const ids = new WeakMap();
let nextId = 1;
const idOf = (m) => {
  if (!ids.has(m)) ids.set(m, nextId++);
  return ids.get(m);
};
export function drawables(roots) {
  const seen = new Set();
  const found = [];
  for (const root of roots) {
    root?.traverse?.((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
      const mats = materialsOf(o);
      if (!mats.length) return;
      const g = o.geometry;
      const morph = !!(g?.morphAttributes && Object.values(g.morphAttributes).some((a) => a?.length));
      const key = [mats.map(idOf).join(','), !!o.isSkinnedMesh, !!o.isInstancedMesh, !!o.isBatchedMesh, morph, !!g?.attributes?.color].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      found.push(o);
    });
  }
  return found;
}

// A stand-in root for renderer.compile: its walk visits just `list`, and it
// shows no lights of its own (the lights are the scene's).
export const batchRoot = (list) => ({
  traverse(fn) {
    list.forEach(fn);
  },
  traverseVisible() {},
});

// The shaders under `roots` compiled in batches, each about `sliceMs` of the
// page's time (the next batch's size is set from how long the last one's
// objects took), against `scene`'s lights, with a fence after each. Then
// each program is asked once a frame whether it has linked, until all have,
// the context has gone or `cap` has passed. Resolves with the materials.
export async function compileSlices(renderer, roots, camera, scene, { sliceMs = 8, onStep, frame = nextFrame, cap = 20000, alive = () => true } = {}) {
  const list = drawables(roots);
  const materials = new Set();
  const t0 = now();
  let size = 1;
  let done = 0;
  while (done < list.length) {
    if (!alive() || lost(renderer) || now() - t0 > cap) return materials;
    const batch = list.slice(done, done + size);
    const start = now();
    try {
      for (const m of renderer.compile(batchRoot(batch), camera, scene)) materials.add(m);
    } catch {
      return materials; // the renderer has gone
    }
    const each = (now() - start) / batch.length;
    done += batch.length;
    onStep?.(done, list.length);
    // (no more than double, so one quick batch can't promise a huge one)
    size = Math.max(1, Math.min(size * 2, Math.floor(sliceMs / Math.max(each, 0.01))));
    await fence(renderer, { frame });
  }
  const pending = [...materials];
  while (pending.length) {
    if (!alive() || lost(renderer) || now() - t0 > cap) break;
    try {
      for (let i = pending.length - 1; i >= 0; i--) {
        // (a material whose program has gone counts as done)
        const program = renderer.properties.get(pending[i]).currentProgram;
        if (!program || program.isReady()) pending.splice(i, 1);
      }
    } catch {
      break;
    }
    if (pending.length) await frame();
  }
  return materials;
}

// Everything under `roots` drawn once into one pixel, nothing hidden or
// culled, so the first real frame has nothing left to create; then put back
// as it was, and fenced.
export async function warmDraw(renderer, render, roots, { frame = nextFrame } = {}) {
  const undo = revealAll(...roots);
  const box = {
    copy(v) {
      Object.assign(this, { x: v.x, y: v.y, z: v.z, w: v.w });
      return this;
    },
  };
  let scissorWas = null;
  try {
    renderer.getScissor(box);
    scissorWas = renderer.getScissorTest();
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);
    render();
  } catch {
    // a renderer gone midway: the first frame does it instead
  } finally {
    try {
      if (scissorWas !== null) {
        renderer.setScissor(box.x, box.y, box.z, box.w);
        renderer.setScissorTest(scissorWas);
      }
    } catch {
      // (gone with its renderer)
    }
    undo();
  }
  await fence(renderer, { frame });
}

// A world's whole warm-up: its pictures sent, its shaders compiled and a
// first draw, with `onProgress(fraction, step)` along the way. Stops at the
// next slice once `alive()` says the world has been left.
const WEIGHTS = { pictures: 0.35, shaders: 0.45, draw: 0.2 };
export async function prepareScene({ renderer, roots, scene, camera, render, onProgress, alive = () => true, frame = nextFrame }) {
  const list = (Array.isArray(roots) ? roots : [roots]).filter(Boolean);
  const report = (f, step) => {
    try {
      onProgress?.(f, step);
    } catch {
      // a page's progress bar isn't the warm-up's business
    }
  };
  const going = () => alive() && !lost(renderer);
  report(0, 'pictures');
  const textures = new Set();
  for (const root of list) for (const t of texturesUnder(root)) textures.add(t);
  await uploadSlices(renderer, [...textures], { frame, alive: going, onStep: (i, n) => report((WEIGHTS.pictures * i) / n, 'pictures') });
  if (!going()) return;
  report(WEIGHTS.pictures, 'shaders');
  await compileSlices(renderer, list, camera, scene, {
    frame,
    alive: going,
    onStep: (i, n) => report(WEIGHTS.pictures + (WEIGHTS.shaders * i) / n, 'shaders'),
  });
  if (!going()) return;
  report(WEIGHTS.pictures + WEIGHTS.shaders, 'first draw');
  const draw = render ?? (() => renderer.render(scene, camera));
  await warmDraw(renderer, draw, list, { frame });
  if (alive()) report(1, 'first draw');
}
