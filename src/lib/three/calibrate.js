// How sharp a world can afford to be on this machine, found once while its
// loading screen is up rather than felt for frame by frame while it's played.
//
// lib/three/pace softens the picture when frames come late and sharpens it
// again when they don't: on a laptop that see-saws (and on the runtime each
// step was a canvas resize, which itself stalls). Here the world is drawn a
// dozen times at each of the pace's steps, sharpest first, each frame timed
// on the graphics chip (EXT_disjoint_timer_query_webgl2; without it, by
// waiting on a one-pixel read), and the sharpest step whose typical frame
// fits the budget is the one it starts at; the pace takes it as its ceiling
// and only ever steps down from it. The answer is kept for this graphics
// chip, this world and this screen (`tp-calibration`), so the next visit
// starts there with a short check instead of the whole walk down.
//
// pickLevel(samples: [{ level, ms }], budget) → level   (pure)
// gpuTimer(gl) → { measure(fn) → Promise<ms | null>, dispose() } | null
// calibrate({ renderer, draw, setLevel, levels, budget, frames, frame, alive, start }) → Promise<level>
// recall(key) → level | null; remember(key, level); calibrationKey(renderer, id, w, h) → string

import { nextFrame } from './gpuWork';

export const BUDGET = 12; // ms of the graphics chip's time a frame, under a 60 Hz beat with room to spare
const KEY = 'tp-calibration';

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : Infinity;
};

// The sharpest level whose frames' median fits the budget; the softest
// level measured when none does.
export function pickLevel(samples, budget = BUDGET) {
  const by = new Map();
  for (const { level, ms } of samples) {
    if (!Number.isFinite(ms)) continue;
    if (!by.has(level)) by.set(level, []);
    by.get(level).push(ms);
  }
  const levels = [...by.keys()].sort((a, b) => a - b);
  for (const l of levels) if (median(by.get(l)) <= budget) return l;
  return levels.length ? levels[levels.length - 1] : 0;
}

// Frames timed on the graphics chip. A query's answer comes a few frames
// later; it's asked for once a frame, never waited on.
export function gpuTimer(gl, { frame = nextFrame, cap = 30 } = {}) {
  const ext = gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');
  if (!ext || typeof gl.createQuery !== 'function') return null;
  return {
    async measure(fn) {
      const q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      try {
        fn();
      } finally {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
      }
      for (let i = 0; i < cap; i++) {
        await frame();
        if (gl.isContextLost()) break;
        if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue;
        const ok = !gl.getParameter(ext.GPU_DISJOINT_EXT);
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
        gl.deleteQuery(q);
        return ok ? ns / 1e6 : null;
      }
      gl.deleteQuery(q);
      return null;
    },
    dispose() {},
  };
}

// (without a timer: the draw and a one-pixel read, which waits for the chip
// to finish it; only ever while the loading screen is up)
const px = new Uint8Array(4);
const waited = (gl, fn) => {
  const t0 = performance.now();
  fn();
  try {
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  } catch {
    // (a lost context: the time's still something)
  }
  return performance.now() - t0;
};

export async function calibrate({ renderer, draw, setLevel, levels = [0, 1, 2, 3, 4], budget = BUDGET, frames = 12, frame = nextFrame, alive = () => true, start = 0 }) {
  let gl = null;
  try {
    gl = renderer.getContext();
  } catch {
    return levels[0];
  }
  const timer = gpuTimer(gl, { frame });
  const samples = [];
  for (const level of levels.filter((l) => l >= start)) {
    if (!alive()) break;
    setLevel(level);
    // (a couple first: the new size's buffers made, whatever's left sent)
    for (let i = 0; i < 2; i++) {
      draw();
      await frame();
    }
    const times = [];
    for (let i = 0; i < frames && alive(); i++) {
      const ms = timer ? await timer.measure(draw) : waited(gl, draw);
      if (ms != null) times.push(ms);
      if (!timer) await frame();
    }
    for (const ms of times) samples.push({ level, ms });
    if (times.length && median(times) <= budget) break; // (sharpest that fits: the softer ones needn't be tried)
  }
  return pickLevel(samples, budget);
}

export const calibrationKey = (renderer, id, w, h) => {
  let chip = '';
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    chip = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
  } catch {
    chip = '';
  }
  // (the screen in steps of 256 px, and its pixel ratio: what the frame's cost follows)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return `${chip}|${id}|${Math.round(w / 256)}x${Math.round(h / 256)}@${dpr}`;
};

const read = () => {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
};
export const recall = (key) => {
  const v = read()[key];
  return Number.isInteger(v) ? v : null;
};
export const remember = (key, level) => {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ ...read(), [key]: level }));
  } catch {
    // (storage unavailable: it's measured again next time)
  }
};
