// Finding the sharpest drawing this machine can keep up with, before the
// world is shown.
//
// While the veil is up the world is drawn a number of times at each of a few
// pixel ratios, each frame timed on the graphics chip (with the disjoint timer
// query extension, where there is one) or, without it, by drawing and then
// reading a single pixel back, which waits for the chip to finish. The
// sharpest ratio whose typical (median) frame fits the budget is the answer;
// if none do, the softest. The answer is kept per graphics chip and world, so
// a later visit can start from it.

const STORE = 'tp-calibration';

// the middle of a list of numbers (so one stray frame doesn't decide)
const median = (values) => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// samples: [{ ratio, ms }]. The largest ratio whose median ms fits the budget,
// else the smallest ratio measured; null when there is nothing measured.
export function pickRatio(samples, budget) {
  const by = new Map();
  for (const { ratio, ms } of samples) {
    if (!by.has(ratio)) by.set(ratio, []);
    by.get(ratio).push(ms);
  }
  let best = null;
  let smallest = null;
  for (const [ratio, list] of by) {
    if (smallest === null || ratio < smallest) smallest = ratio;
    if (median(list) <= budget && (best === null || ratio > best)) best = ratio;
  }
  return best ?? smallest;
}

// Times work on the graphics chip. begin() and end() wrap the draw; poll()
// hands back the oldest finished frame's milliseconds, or null if none is
// ready yet (it never waits). A frame the chip flagged as disturbed (disjoint)
// is thrown away. Null where the extension isn't there.
export function gpuTimer(gl) {
  const ext = gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');
  if (!ext) return null;
  const pending = [];
  let open = null;
  return {
    begin() {
      if (open) return;
      open = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, open);
    },
    end() {
      if (!open) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(open);
      open = null;
    },
    poll() {
      const q = pending[0];
      if (!q || !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return null;
      pending.shift();
      const disturbed = gl.getParameter(ext.GPU_DISJOINT_EXT);
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      gl.deleteQuery(q);
      return disturbed ? null : ns / 1e6;
    },
  };
}

// What a remembered ratio is keyed by: the graphics chip's own name (when the
// browser tells it) and the world.
export function gpuKey(gl, world) {
  let name = 'unknown';
  try {
    const info = gl?.getExtension?.('WEBGL_debug_renderer_info');
    const got = info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
    if (got) name = String(got);
  } catch {
    // keep 'unknown'
  }
  return `${name}|${world}`;
}

const readAll = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export function recall(key) {
  const v = readAll()[key];
  return typeof v === 'number' && v > 0 ? v : null;
}

export function remember(key, ratio) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...readAll(), [key]: ratio }));
  } catch {
    // storage blocked or full: it just isn't remembered
  }
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

// Draws `frames` frames at each of `ratios` and resolves the ratio to keep
// (never rejects: on any trouble, or if `alive()` says the world has gone, it
// resolves the ratio the renderer had). `draw()` renders one frame; `setRatio`
// changes the drawing's ratio where the caller owns that (else the renderer's
// own setPixelRatio is used). The original ratio is put back afterwards, and
// `frame()` (a promise per frame, the browser's by default) lets the page breathe.
export async function calibrate({ renderer, draw, ratios, budget = 12, frames = 24, frame = nextFrame, alive = () => true, setRatio } = {}) {
  let original = 1;
  try {
    original = renderer.getPixelRatio();
  } catch {
    // keep 1
  }
  const set = (v) => (setRatio ? setRatio(v) : renderer.setPixelRatio(v));
  try {
    const gl = renderer.getContext?.();
    const timer = gpuTimer(gl);
    const samples = [];
    for (const ratio of ratios) {
      if (!alive()) return original;
      set(ratio);
      let got = 0;
      for (let i = 0; i < frames; i++) {
        if (!alive()) return original;
        if (timer) {
          timer.begin();
          draw();
          timer.end();
          const ms = timer.poll();
          if (ms !== null) {
            samples.push({ ratio, ms });
            got += 1;
          }
        } else {
          const t0 = performance.now();
          draw();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
          samples.push({ ratio, ms: performance.now() - t0 });
        }
        await frame();
      }
      // timer results arrive a frame or two late: collect what is left
      if (timer) {
        for (let tries = 0; tries < 8 && got < frames; tries++) {
          let ms;
          while ((ms = timer.poll()) !== null) {
            samples.push({ ratio, ms });
            got += 1;
          }
          if (!alive()) return original;
          await frame();
        }
      }
    }
    return pickRatio(samples, budget) ?? original;
  } catch {
    return original;
  } finally {
    try {
      set(original);
    } catch {
      // a lost context: nothing to put back
    }
  }
}
