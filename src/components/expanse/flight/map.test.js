import { describe, expect, it } from 'vitest';
import { createMap, MAP_PRIORITY, MAP_FLYING } from './map';
import { MAP_KEEP } from './mapRules';
import { MAP_N, rasterKey } from '../../../lib/land/flight/mapRaster';
import { WORKER } from './groundCore';
import { planetSpecOf } from '../../../lib/land/flight/planetSpec';

const spec = planetSpecOf('hoth');
const raster = (b = 0, h = 0) => ({ biome: new Uint8Array(MAP_N * MAP_N).fill(b), height: new Float32Array(MAP_N * MAP_N).fill(h) });
const flush = () => new Promise((r) => setTimeout(r, 0));

// a 2D context that records what was drawn and the turn in force at each call
function fakeCtx() {
  const calls = [];
  let turn = 0;
  const stack = [];
  const rec = (name) => (...args) => calls.push({ name, args, turn });
  return {
    calls,
    save: () => stack.push(turn),
    restore: () => (turn = stack.pop() ?? 0),
    rotate: (a) => (turn += a),
    setTransform: () => (turn = 0),
    ...Object.fromEntries(['translate', 'beginPath', 'arc', 'clip', 'fill', 'stroke', 'fillRect', 'strokeRect', 'moveTo', 'lineTo', 'closePath', 'setLineDash', 'roundRect', 'strokeText', 'clearRect'].map((n) => [n, rec(n)])),
    drawImage: rec('drawImage'),
    fillText: rec('fillText'),
    measureText: (t) => ({ width: t.length * 6 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: rec('putImageData'),
  };
}
const makeCanvas = () => ({ getContext: () => fakeCtx() });

function fakeWorkers() {
  const jobs = new Map();
  return {
    jobs,
    asked: [],
    cancelled: [],
    request(name, msg) {
      expect(name).toBe(WORKER);
      this.asked.push(msg);
      return new Promise((resolve) => jobs.set(msg.key, { msg, resolve }));
    },
    cancel(name, key) {
      this.cancelled.push(key);
      jobs.get(key)?.resolve(null);
      jobs.delete(key);
    },
    answer(key, data) {
      const j = jobs.get(key);
      jobs.delete(key);
      j.resolve(data === undefined ? { key, ...raster() } : data);
    },
  };
}

describe('the map’s rasters', () => {
  it('asks the worker for the squares in view, nearest first, behind the ground, a few at a time', async () => {
    const workers = fakeWorkers();
    const map = createMap({ spec, workers, makeCanvas });
    map.want([100, 100], 3000);
    expect(workers.asked.length).toBe(MAP_FLYING);
    expect(workers.asked[0]).toMatchObject({ type: 'raster', key: rasterKey(0, 0), priority: MAP_PRIORITY, spec, leaf: { d: 3, ix: 0, iz: 0, size: 2048 } });
    expect(MAP_PRIORITY).toBeGreaterThan(6);
    // (asked again, nothing doubles)
    map.want([100, 100], 3000);
    expect(workers.asked.length).toBe(MAP_FLYING);
    workers.answer(rasterKey(0, 0));
    await flush();
    expect(map.has(rasterKey(0, 0))).toBe(true);
    map.want([100, 100], 3000);
    expect(workers.asked.length).toBe(MAP_FLYING + 1);
  });

  it('cancels what it no longer wants, and refuses an answer that isn’t whole', async () => {
    const workers = fakeWorkers();
    const map = createMap({ spec, workers, makeCanvas });
    map.want([0, 0], 100);
    const first = workers.asked.map((m) => m.key);
    map.want([60000, 60000], 100);
    expect(workers.cancelled).toEqual(expect.arrayContaining(first));
    const k = workers.asked.at(-1).key;
    workers.answer(k, { key: k, biome: new Uint8Array(3), height: new Float32Array(3) });
    await flush();
    expect(map.has(k)).toBe(false);
    // (given up on: never asked again, the square stays unmapped, not a hole in the rest)
    map.want([60000, 60000], 100);
    expect(workers.asked.filter((m) => m.key === k).length).toBe(1);
    const bad = raster(99);
    expect(map.put('map:5:5', bad)).toBe(false);
    const nan = raster();
    nan.height[3] = NaN;
    expect(map.put('map:5:5', nan)).toBe(false);
  });

  it('keeps MAP_KEEP rasters, the oldest going first, so the full map fills in behind the ship', () => {
    const map = createMap({ spec, workers: fakeWorkers(), makeCanvas });
    for (let i = 0; i < MAP_KEEP + 10; i++) map.put(rasterKey(i, 0), raster());
    expect(map.size()).toBe(MAP_KEEP);
    expect(map.has(rasterKey(0, 0))).toBe(false);
    expect(map.has(rasterKey(10, 0))).toBe(true);
    // a late answer for ground left far behind is still kept
    expect(map.put(rasterKey(-400, 9), raster())).toBe(true);
  });

  it('paints a raster once, in the planet’s colours', () => {
    let made = 0;
    const map = createMap({ spec, workers: fakeWorkers(), makeCanvas: () => (made++, makeCanvas()) });
    map.put(rasterKey(0, 0), raster(0, spec.biomes[0].base));
    const ctx = fakeCtx();
    map.drawMini(ctx, { ship: { x: 100, z: 100, yaw: 0 }, size: 240 });
    map.drawMini(ctx, { ship: { x: 120, z: 100, yaw: 0 }, size: 240 });
    expect(made).toBe(1);
    expect(ctx.calls.filter((c) => c.name === 'drawImage').length).toBe(2);
  });
});

describe('the minimap', () => {
  const state = (headingUp) => ({ ship: { x: 1000, z: -500, yaw: 0.8 }, size: 240, headingUp, markers: [{ kind: 'poi', id: 'echo-base', at: [1200, -800], label: 'Echo Base' }] });
  it('north up: the ground unturned, the ship turned to its heading', () => {
    const map = createMap({ spec, workers: fakeWorkers(), makeCanvas });
    map.put(rasterKey(0, -1), raster());
    const ctx = fakeCtx();
    map.drawMini(ctx, state(false));
    expect(ctx.calls.find((c) => c.name === 'drawImage').turn).toBe(0);
  });
  it('heading up: the ground turns, the labels stay upright', () => {
    const map = createMap({ spec, workers: fakeWorkers(), makeCanvas });
    map.put(rasterKey(0, -1), raster());
    const ctx = fakeCtx();
    map.drawMini(ctx, state(true));
    expect(ctx.calls.find((c) => c.name === 'drawImage').turn).toBeCloseTo(0.8, 9);
    const labels = ctx.calls.filter((c) => c.name === 'fillText');
    expect(labels.map((c) => c.args[0])).toEqual(expect.arrayContaining(['Echo Base', 'N']));
    for (const c of labels) expect(c.turn).toBe(0);
  });
  it('gives the cell address under it', () => {
    const map = createMap({ spec, workers: fakeWorkers(), makeCanvas });
    expect(map.drawMini(fakeCtx(), state(false))).toBe('Cell 0,-1');
  });
});

describe('the full map', () => {
  it('draws the squares in view and every marker’s label, and finds the marker under a tap', () => {
    const map = createMap({ spec, workers: fakeWorkers(), makeCanvas });
    map.put(rasterKey(0, -1), raster());
    const ctx = fakeCtx();
    const markers = [
      { kind: 'poi', id: 'echo-base', at: [1200, -800], label: 'Echo Base' },
      { kind: 'pilot', id: 'p', at: [1000, -100], label: 'Rogue 2' },
      { kind: 'built', id: 'b', at: [900, -700], label: 'turret' },
    ];
    const view = { w: 800, h: 600, centre: [1000, -500], scale: 16 };
    map.drawFull(ctx, { ship: { x: 1000, z: -500, yaw: 0 }, markers }, view);
    expect(ctx.calls.some((c) => c.name === 'drawImage')).toBe(true);
    const words = ctx.calls.filter((c) => c.name === 'fillText').map((c) => c.args[0]);
    expect(words).toEqual(expect.arrayContaining(['Echo Base', 'Rogue 2']));
    // Echo Base is 200 m east and 300 m north of the middle: (412.5, 281.25) on an 800 × 600 map
    expect(map.hit(markers, [413, 282], view)?.id).toBe('echo-base');
    expect(map.hit(markers, [20, 20], view)).toBeNull();
  });
});
