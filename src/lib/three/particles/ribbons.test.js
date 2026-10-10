import { describe, expect, it } from 'vitest';
import EXHAUST from '../../../data/bf2017/fx/FX_Veh_GR75_Engine_Exhaust_01.json';
import SNOW from '../../../data/bf2017/fx/FX_Snow_FallingSnow_01_Hoth.json';
import { createEffects } from './effects.js';
import { createTrails, MAX_OWNERS, OWNER, stepTrails, trailPoint } from './emitter.js';
import { createSim } from './gpu.js';
import { createRibbonMesh, createShared, createSpriteMesh } from './sprites.js';

const trailEm = EXHAUST.emitters[1];
const owners = (x, y = 0, z = 0) => {
  const a = new Float32Array(MAX_OWNERS * OWNER);
  a.set([x, y, z, 1, 0, 0, 0, 1], 0);
  return a;
};

describe('trails', () => {
  it('the head rides the owner; a point is frozen every RibbonSegmentLength metres', () => {
    const tr = createTrails({ ...trailEm, spawn: { ...trailEm.spawn, rate: 0 } }, 2);
    const active = [0];
    for (let f = 0; f <= 10; f++) stepTrails(tr, 1 / 60, owners(f * 0.5), active);
    expect(tr.pos[trailPoint(tr, 0, 0) * 3]).toBe(5);
    // (2 m segments over 5 m: frozen at 0, 2 and 4)
    const frozen = [1, 2, 3].map((k) => tr.pos[trailPoint(tr, 0, k) * 3]);
    expect(frozen).toEqual([4, 2, 0]);
    expect(tr.age[trailPoint(tr, 0, 3)]).toBeCloseTo(10 / 60, 6);
  });
  it('by the rate when the owner hangs still, and ages out once it stops', () => {
    const tr = createTrails(trailEm, 1);
    for (let f = 0; f < 60; f++) stepTrails(tr, 1 / 60, owners(0), [0]);
    let live = 0;
    for (let k = 0; k < tr.m; k++) if (tr.age[k] < tr.life) live++;
    expect(live).toBeGreaterThanOrEqual(20);
    expect(live).toBeLessThanOrEqual(22);
    for (let f = 0; f < 200; f++) stepTrails(tr, 1 / 60, owners(0), []);
    expect(tr.on[0]).toBe(0);
    expect([...tr.age].every((a) => a >= tr.life)).toBe(true);
  });
});

describe('the ribbon mesh', () => {
  it('a camera-facing strip, as wide as the size curve says, dead points at width 0', async () => {
    const tr = createTrails(trailEm, 1);
    for (let f = 0; f <= 12; f++) stepTrails(tr, 1 / 60, owners(f * 0.5), [0]);
    const rib = await createRibbonMesh(trailEm, tr, { shared: await createShared() });
    rib.update({ position: { x: 3, y: 0, z: 10 } });
    const P = rib.mesh.geometry.attributes.position.array;
    // the newest point: across the trail (x) and the camera line → along y, 1.2 m wide
    expect(Math.abs(P[1] - P[4])).toBeCloseTo(1.2, 3);
    expect(P[0]).toBeCloseTo(6, 3);
    const L = rib.mesh.geometry.attributes.ribbonLife.array;
    expect(L[1]).toBe(1);
    expect(L[(tr.m - 1) * 4 + 1]).toBe(0);
    expect(rib.mesh.geometry.index.count).toBe((tr.m - 1) * 6);
  });
});

describe('mesh emittables', () => {
  it('draws the pool as instances of a mesh with a lit material', async () => {
    const em = { ...SNOW.emitters[0], kind: 'mesh', alignment: 'screen' };
    const sim = await createSim(em, 16, { mode: 'cpu' });
    const mesh = await createSpriteMesh(em, sim, { shared: await createShared() });
    expect(mesh.count).toBe(16);
    expect(mesh.material.isMeshStandardNodeMaterial).toBe(true);
    expect(mesh.geometry.type).toBe('IcosahedronGeometry');
  });
});

describe('a trail that follows its ship', () => {
  it('spawn(name, { parent }): the glow rides the ship and the contrail lies behind it', async () => {
    const { Object3D } = await import('three');
    const ship = new Object3D();
    const kids = [];
    const fx = createEffects({ add: (m) => kids.push(m) }, null, { tier: 'ultra', defs: { [EXHAUST.name]: EXHAUST } });
    fx.spawn(EXHAUST.name, [0, 0, -4], [0, 0, 0, 1], 1, { parent: ship });
    await fx.ready(EXHAUST.name);
    expect(kids.map((m) => m.name)).toEqual(['fx:em_GR75_Engine_Glow_01', 'fx-ribbon:em_GR75_Engine_Trail_01']);
    const cam = { position: { x: 0, y: 5, z: 0 } };
    for (let f = 0; f < 60; f++) {
      ship.position.z = f * 0.5; // 30 m/s along +z
      ship.updateMatrixWorld(true);
      fx.update(1 / 60, cam);
    }
    expect(fx.stats.drawn).toBe(2);
    // the trail's points run back along the path, the newest at the engine
    const P = kids[1].geometry.attributes.position.array;
    expect((P[2] + P[5]) / 2).toBeCloseTo(29.5 - 4, 1);
    expect((P[8] + P[11]) / 2).toBeLessThan(26);
  });
});
