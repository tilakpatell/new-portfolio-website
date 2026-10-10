import { beforeAll, describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { GROUPS, filterOf } from './groups';
import { createBudget } from './budget';
import { createQueries } from './queries';

let q;
let wall;
let figure;

// a floor, a figure (a kinematic capsule) at x 3, a thin wall at x 1.5
// between the origin and it, and a sensor zone round the origin
async function scene(budget) {
  const p = await createPhysics();
  p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [20, 0.5, 20] }] });
  const fig = p.add({ type: 'kinematicPositionBased', position: [3, 1, 0], group: 'character', colliders: [{ shape: 'capsule', args: [0.6, 0.4] }] });
  const w = p.add({ type: 'fixed', position: [1.5, 1, 0], group: 'object', colliders: [{ shape: 'cuboid', args: [0.1, 2, 2] }] });
  const zone = p.world.createRigidBody(p.RAPIER.RigidBodyDesc.fixed().setTranslation(0.7, 1, 0));
  p.world.createCollider(p.RAPIER.ColliderDesc.ball(1).setSensor(true).setCollisionGroups(GROUPS.zone), zone);
  p.step(1 / 60);
  return { p, q: createQueries(p, { budget }), wall: w, figure: fig };
}

beforeAll(async () => {
  ({ q, wall, figure } = await scene());
});

describe('createQueries', () => {
  it('a ray before any step returns null, not a throw', async () => {
    const p = await createPhysics();
    p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [20, 0.5, 20] }] });
    const fresh = createQueries(p);
    expect(fresh.ray([0, 5, 0], [0, -1, 0], 100)).toBeNull();
    p.dispose();
  });

  it('a ray from the origin along +x stops at the wall before the figure', () => {
    const h = q.ray([0, 1, 0], [1, 0, 0], 100);
    expect(h.dist).toBeCloseTo(1.4, 3);
    expect(h.at[0]).toBeCloseTo(1.4, 3);
    expect(h.normal).toEqual([-1, 0, 0]);
    expect(h.body).toBe(wall);
    expect(h.tag).toBeNull();
  });

  it('a ray that excludes the wall’s body reaches the figure', () => {
    const h = q.ray([0, 1, 0], [1, 0, 0], 100, { exclude: wall });
    expect(h.body).toBe(figure);
    expect(h.dist).toBeCloseTo(2.6, 2);
  });

  it('a ray with the sight filter ignores a sensor zone in the way', () => {
    const h = q.ray([0, 1, 0], [1, 0, 0], 100, { groups: filterOf('floor', 'object', 'character') });
    expect(h.body).toBe(wall);
    // (asked for zones, the ray starts inside this one: a hit at 0, on a body the world didn't add)
    expect(q.ray([0, 1, 0], [1, 0, 0], 100, { groups: filterOf('zone') })).toMatchObject({ dist: 0, body: null });
  });

  it('a capsule sweep from x −2 to x 4 reports toi 0.5 onto the wall', () => {
    const h = q.sweep({ shape: 'capsule', args: [0.6, 0.4] }, [-2, 1, 0], [4, 1, 0]);
    expect(h.toi).toBeCloseTo(0.5, 3);
    expect(h.body).toBe(wall);
    expect(h.at[0]).toBeCloseTo(1.4, 3);
    expect(h.normal[0]).toBe(-1);
  });

  it('a sweep with no motion still reports a resting overlap at toi 0', () => {
    const h = q.sweep({ shape: 'capsule', args: [0.6, 0.4] }, [1.2, 1, 0], [1.2, 1, 0], { groups: filterOf('object') });
    expect(h.toi).toBe(0);
    expect(h.body).toBe(wall);
    expect(q.sweep({ shape: 'capsule', args: [0.6, 0.4] }, [-5, 1, 0], [-5, 1, 0], { groups: filterOf('object') })).toBeNull();
  });

  it('omit passes over the bodies in the set, for a ray and a sweep', () => {
    const omit = new Set([wall]);
    expect(q.ray([0, 1, 0], [1, 0, 0], 100, { omit }).body).toBe(figure);
    expect(q.sweep({ shape: 'capsule', args: [0.6, 0.4] }, [-2, 1, 0], [4, 1, 0], { omit }).body).toBe(figure);
    expect(q.ray([0, 1, 0], [1, 0, 0], 100, { omit: new Set() }).body).toBe(wall);
  });

  it('an overlap of a ball r 1 at the figure finds it and not the wall', () => {
    const found = q.overlap({ shape: 'ball', args: [1] }, [3, 1, 0], { groups: filterOf('object', 'character') });
    expect(found.map((f) => f.body)).toEqual([figure]);
  });

  it('floorAt(10, 10) is y 0 with the normal up', () => {
    const f = q.floorAt(10, 10);
    expect(f.y).toBeCloseTo(0, 3);
    expect(f.normal).toEqual([0, 1, 0]);
    expect(q.floorAt(10, 10, { from: 3, down: 2 })).toBeNull(); // (out of reach)
  });

  it('the 25th ray in a frame is refused and the 1st after frame() is a hit again', async () => {
    const s = await scene(createBudget({ rays: 24 }));
    for (let i = 0; i < 24; i++) expect(s.q.ray([0, 1, 0], [1, 0, 0], 100)).not.toBeUndefined();
    expect(s.q.ray([0, 1, 0], [1, 0, 0], 100)).toBeUndefined();
    expect(s.q.stats().rays.refused).toBe(1);
    s.q.frame();
    expect(s.q.ray([0, 1, 0], [1, 0, 0], 100).body).toBe(s.wall);
    expect(s.q.overlap({ shape: 'ball', args: [1] }, [3, 1, 0])).not.toEqual([]);
    s.p.dispose();
  });

  it('project([10, 5, 10]) onto the floor is y 0, never budgeted', () => {
    const before = q.stats().rays.used;
    const r = q.project([10, 5, 10]);
    expect(r.at).toEqual([10, 0, 10]);
    expect(r.inside).toBe(false);
    expect(q.stats().rays.used).toBe(before);
  });
});
