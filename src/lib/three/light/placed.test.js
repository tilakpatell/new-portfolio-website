import { describe, expect, it } from 'vitest';
import { POINT_FALLBACK, POINT_POOL, cellOf, cellsNear, createPlacedLights, lightsFor, lumensToCandela, screenArea } from './placed';

describe('lumensToCandela', () => {
  it('a 1,000 lm sphere is 79.6 cd; a 1,000 lm 60° cone 1,188 cd', () => {
    expect(lumensToCandela(1000, 'point')).toBeCloseTo(79.6, 1);
    expect(lumensToCandela(1000, 'spot', Math.PI / 3)).toBeCloseTo(1188, 0);
  });
});

describe('cells', () => {
  it('bins by 128 m, negatives below zero', () => {
    expect(cellOf([10, 5, 300])).toBe('0,2');
    expect(cellOf([-1, 0, -129])).toBe('-1,-2');
    expect(cellsNear([10, 0, 10])).toHaveLength(9);
    expect(cellsNear([10, 0, 10])).toContain('-1,1');
  });
});

// 300 lamps on a 30 × 10 grid, 4 m apart, round a camera at the origin
const grid = () => {
  const cells = {};
  for (let ix = 0; ix < 30; ix++) {
    for (let iz = 0; iz < 10; iz++) {
      const pos = [(ix - 15) * 40, 2, (iz - 5) * 40];
      (cells[cellOf(pos)] ??= []).push({ kind: 'point', pos, range: 8, candela: 80, color: [1, 1, 1] });
    }
  }
  return { cells };
};
const camera = { position: [0, 2, 0], fov: 60 };

describe('lightsFor', () => {
  it('keeps the near ones first, culls the far and fades the band', () => {
    const json = grid();
    const all = Object.keys(json.cells);
    const picked = lightsFor(json, all, camera, { max: 1024 });
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThan(300);
    for (let i = 1; i < picked.length; i++) expect(picked[i].area).toBeLessThanOrEqual(picked[i - 1].area);
    // the nearest is the one the camera stands by
    const first = json.cells[picked[0].cell][picked[0].i];
    expect(Math.hypot(first.pos[0], first.pos[2])).toBeLessThan(1);
    expect(picked[0].weight).toBe(1);
    // the band between the cull and the fade area is faded, nothing under the cull is kept
    const band = picked.filter((p) => p.weight < 1);
    expect(band.length).toBeGreaterThan(0);
    for (const p of band) expect(p.area).toBeLessThan(0.01);
    for (const p of picked) expect(p.area).toBeGreaterThan(0.005);
    // a light out of reach of the cull: 8 m of reach at 400 m
    expect(screenArea({ pos: [400, 2, 0], range: 8 }, camera)).toBeLessThan(0.005);
  });
  it('takes at most max, the best', () => {
    const json = grid();
    const ten = lightsFor(json, Object.keys(json.cells), camera, { max: 10 });
    expect(ten).toHaveLength(10);
    expect(ten[9].area).toBeGreaterThanOrEqual(lightsFor(json, Object.keys(json.cells), camera, { max: 11 })[10].area);
  });
});

const sceneStub = () => {
  const kids = [];
  return { kids, add: (o) => kids.push(o) };
};

describe('createPlacedLights', () => {
  it('the pool never grows: 2,000 lights asked, 1,024 lit, the scene’s children the same', async () => {
    const scene = sceneStub();
    const renderer = { isWebGPURenderer: true, backend: { isWebGPUBackend: true }, lighting: 'base' };
    const placed = await createPlacedLights(scene, renderer);
    expect(placed.clustered).toBe(true);
    expect(renderer.lighting.maxLights).toBe(POINT_POOL);
    const group = scene.kids[0];
    const n = group.children.length;
    const many = Array.from({ length: 2000 }, (_, i) => ({ kind: 'point', pos: [i, 0, 0], candela: 10, range: 5 }));
    expect(placed.set(many)).toBe(POINT_POOL);
    expect(group.children.length).toBe(n);
    expect(placed.set(many.slice(0, 3))).toBe(3);
    expect(placed.pools.points[3].intensity).toBe(0);
    expect(group.children.length).toBe(n);
    placed.dispose();
    expect(renderer.lighting).toBe('base');
  });
  it('spots go to their own pool, cone and penumbra from the record', async () => {
    const placed = await createPlacedLights(sceneStub(), { isWebGPURenderer: true, backend: { isWebGPUBackend: true } }, { points: 4 });
    placed.set([{ kind: 'spot', pos: [0, 5, 0], dir: [0, -1, 0], cone: [Math.PI / 6, Math.PI / 3], candela: 1188, range: 20, color: [1, 0.9, 0.8] }]);
    const s = placed.pools.spots[0];
    expect(s.angle).toBeCloseTo(Math.PI / 6);
    expect(s.penumbra).toBeCloseTo(0.5);
    expect(s.intensity).toBe(1188);
    expect(s.target.position.y).toBe(4);
    expect(placed.pools.spots).toHaveLength(16);
  });
  it('on the node renderer over WebGL 2 the points are the fallback pool, unclustered', async () => {
    const renderer = { isWebGPURenderer: true, backend: { isWebGLBackend: true }, lighting: 'base' };
    const placed = await createPlacedLights(sceneStub(), renderer);
    expect(placed.clustered).toBe(false);
    expect(placed.pools.points).toHaveLength(POINT_FALLBACK);
    expect(renderer.lighting).toBe('base');
  });
  it('update(camera) fills the pools from the cells round the camera', async () => {
    const placed = await createPlacedLights(sceneStub(), null, { points: 8, spots: 0, source: grid() });
    expect(placed.update(camera)).toBe(8);
  });
});
