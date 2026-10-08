import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calibrate, gpuKey, gpuTimer, pickRatio, recall, remember } from './calibrate';

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
};

describe('pickRatio', () => {
  const at = (ratio, ...ms) => ms.map((m) => ({ ratio, ms: m }));
  it('takes the largest ratio whose median fits the budget', () => {
    const samples = [...at(2, 20, 21, 22), ...at(1.5, 10, 11, 30), ...at(1, 5, 6, 7)];
    expect(pickRatio(samples, 12)).toBe(1.5);
  });
  it('is not moved by one outlier', () => {
    const samples = [...at(2, 4, 5, 90, 5, 4), ...at(1, 2, 2, 2)];
    expect(pickRatio(samples, 12)).toBe(2);
  });
  it('falls back to the smallest when none fit', () => {
    expect(pickRatio([...at(2, 40), ...at(1, 30), ...at(1.5, 35)], 12)).toBe(1);
  });
  it('gives null for no samples', () => {
    expect(pickRatio([], 12)).toBeNull();
  });
});

describe('the store', () => {
  let original;
  beforeEach(() => {
    original = globalThis.localStorage;
    globalThis.localStorage = memoryStorage();
  });
  afterEach(() => {
    globalThis.localStorage = original;
  });
  it('remembers a ratio per key in one object', () => {
    remember('a', 1.5);
    remember('b', 1);
    expect(recall('a')).toBe(1.5);
    expect(recall('b')).toBe(1);
    expect(Object.keys(JSON.parse(localStorage.getItem('tp-calibration'))).sort()).toEqual(['a', 'b']);
  });
  it('recalls null for an unknown key or garbage', () => {
    expect(recall('x')).toBeNull();
    localStorage.setItem('tp-calibration', '{nope');
    expect(recall('x')).toBeNull();
    remember('x', 2);
    expect(recall('x')).toBe(2);
  });
  it('never throws when storage does', () => {
    globalThis.localStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(() => remember('a', 1)).not.toThrow();
    expect(recall('a')).toBeNull();
  });
});

// a gl whose timer queries answer from a script
const fakeGl = ({ ext = true, debug = true } = {}) => {
  const timer = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
  const queries = [];
  const gl = {
    QUERY_RESULT_AVAILABLE: 10,
    QUERY_RESULT: 11,
    disjoint: false,
    queries,
    getExtension: (name) => {
      if (name === 'EXT_disjoint_timer_query_webgl2') return ext ? timer : null;
      if (name === 'WEBGL_debug_renderer_info') return debug ? { UNMASKED_RENDERER_WEBGL: 99 } : null;
      return null;
    },
    getParameter: (p) => (p === 99 ? 'Fake GPU' : p === timer.GPU_DISJOINT_EXT ? gl.disjoint : null),
    createQuery: () => {
      const q = { ready: false, ns: 0 };
      queries.push(q);
      return q;
    },
    beginQuery: vi.fn(),
    endQuery: vi.fn(),
    getQueryParameter: (q, p) => (p === gl.QUERY_RESULT_AVAILABLE ? q.ready : q.ns),
    deleteQuery: vi.fn(),
  };
  return gl;
};

describe('gpuTimer', () => {
  it('is null without the extension', () => {
    expect(gpuTimer(fakeGl({ ext: false }))).toBeNull();
    expect(gpuTimer(null)).toBeNull();
  });
  it('polls null until the result is available, then milliseconds', () => {
    const gl = fakeGl();
    const t = gpuTimer(gl);
    t.begin();
    t.end();
    expect(t.poll()).toBeNull();
    gl.queries[0].ready = true;
    gl.queries[0].ns = 5e6;
    expect(t.poll()).toBe(5);
    expect(gl.deleteQuery).toHaveBeenCalledWith(gl.queries[0]);
    expect(t.poll()).toBeNull();
  });
  it('discards a disjoint result', () => {
    const gl = fakeGl();
    const t = gpuTimer(gl);
    t.begin();
    t.end();
    gl.queries[0].ready = true;
    gl.queries[0].ns = 5e6;
    gl.disjoint = true;
    expect(t.poll()).toBeNull();
    expect(gl.deleteQuery).toHaveBeenCalled();
  });
  it('hands back the tag of the frame a result is for', () => {
    const gl = fakeGl();
    const t = gpuTimer(gl);
    t.begin('a');
    t.end();
    t.begin('b');
    t.end();
    gl.queries[0].ready = gl.queries[1].ready = true;
    t.poll();
    expect(t.tag).toBe('a');
    t.poll();
    expect(t.tag).toBe('b');
    t.poll();
    expect(t.tag).toBeUndefined();
  });
  it('dispose deletes every query not yet read', () => {
    const gl = fakeGl();
    const t = gpuTimer(gl);
    t.begin();
    t.end();
    t.begin();
    t.dispose();
    expect(gl.deleteQuery).toHaveBeenCalledTimes(2);
    expect(t.pending).toBe(0);
  });
  it('answers in order across several frames', () => {
    const gl = fakeGl();
    const t = gpuTimer(gl);
    for (let i = 0; i < 2; i++) {
      t.begin();
      t.end();
      gl.queries[i].ns = (i + 1) * 1e6;
    }
    gl.queries[0].ready = gl.queries[1].ready = true;
    expect([t.poll(), t.poll(), t.poll()]).toEqual([1, 2, null]);
  });
});

describe('gpuKey', () => {
  it('joins the chip name and the world', () => {
    expect(gpuKey(fakeGl(), 'universe')).toBe('Fake GPU|universe');
    expect(gpuKey(fakeGl({ debug: false }), 'universe')).toBe('unknown|universe');
    expect(gpuKey(null, 'w')).toBe('unknown|w');
  });
});

// a renderer with a gl whose timer is scripted by ratio: each draw's cost is msFor(ratio)
const fakeRenderer = (msFor, { timer = true } = {}) => {
  const gl = fakeGl({ ext: timer });
  let ratio = 2;
  const r = {
    gl,
    getContext: () => gl,
    getPixelRatio: () => ratio,
    setPixelRatio: vi.fn((v) => {
      ratio = v;
    }),
    ratios: [],
  };
  // each begun query is finished at once with the cost of the ratio it was drawn at
  gl.beginQuery = vi.fn(() => {
    const q = gl.queries[gl.queries.length - 1];
    q.ready = true;
    q.ns = msFor(ratio) * 1e6;
  });
  r.readPixels = vi.fn();
  gl.readPixels = r.readPixels;
  return { r, gl, get ratio() { return ratio; } };
};

describe('calibrate', () => {
  it('picks the sharpest ratio that fits and restores the original', async () => {
    const f = fakeRenderer((ratio) => ratio * 7); // 14, 10.5, 7 ms
    const draw = vi.fn();
    const frame = () => Promise.resolve();
    const got = await calibrate({ renderer: f.r, draw, ratios: [2, 1.5, 1], frames: 4, frame });
    expect(got).toBe(1.5);
    expect(draw).toHaveBeenCalledTimes(12);
    expect(f.ratio).toBe(2);
    expect(f.gl.deleteQuery).toHaveBeenCalledTimes(12);
  });
  it('uses a passed setRatio instead of the renderer', async () => {
    const f = fakeRenderer(() => 1);
    const setRatio = vi.fn();
    await calibrate({ renderer: f.r, draw() {}, ratios: [1, 0.5], frames: 2, setRatio, frame: () => Promise.resolve() });
    expect(setRatio).toHaveBeenCalledWith(1);
    expect(setRatio).toHaveBeenCalledWith(0.5);
    expect(setRatio).toHaveBeenLastCalledWith(2);
    expect(f.r.setPixelRatio).not.toHaveBeenCalled();
  });
  it('times by a one-pixel read without the extension', async () => {
    const f = fakeRenderer(() => 1, { timer: false });
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const draw = () => {
      now += f.ratio * 7; // the read waits out the draw
    };
    const got = await calibrate({ renderer: f.r, draw, ratios: [2, 1.5, 1], frames: 3, frame: () => Promise.resolve() });
    clock.mockRestore();
    expect(f.r.readPixels).toHaveBeenCalled();
    expect(got).toBe(1.5);
  });
  it('resolves the current ratio when no longer alive, and never rejects', async () => {
    const f = fakeRenderer(() => 1);
    const draw = vi.fn();
    expect(await calibrate({ renderer: f.r, draw, ratios: [1, 0.5], alive: () => false, frame: () => Promise.resolve() })).toBe(2);
    expect(draw).not.toHaveBeenCalled();
    const boom = () => {
      throw new Error('lost');
    };
    expect(await calibrate({ renderer: f.r, draw: boom, ratios: [1], frames: 2, frame: () => Promise.resolve() })).toBe(2);
    expect(f.ratio).toBe(2);
  });
});
