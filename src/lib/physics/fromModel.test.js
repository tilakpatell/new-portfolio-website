import { describe, expect, it } from 'vitest';
import { bodiesFromNodes } from './fromModel';

const node = (name, extra = {}) => ({ name, position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], children: [], ...extra });
const one = (nodes, opts) => {
  const out = bodiesFromNodes(nodes, opts);
  expect(out).toHaveLength(1);
  return out[0];
};
const close = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe('bodies from a model’s node names', () => {
  it('makes no body from a node without physical in its name', () => {
    expect(bodiesFromNodes([node('crate'), node('tree', { children: [node('cuboid')] })])).toEqual([]);
  });

  it('picks the type from the name: dynamic, kinematic, else fixed', () => {
    expect(one([node('crate_physical_dynamic', { children: [node('cuboid')] })]).desc.type).toBe('dynamic');
    expect(one([node('door_Physical_Kinematic', { children: [node('cuboid')] })]).desc.type).toBe('kinematicPositionBased');
    expect(one([node('wall_physical', { children: [node('cuboid')] })]).desc.type).toBe('fixed');
  });

  it('a cuboid’s half-extents are half its scale, at its place', () => {
    const q = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
    const b = one([node('crate_physical_dynamic', { position: [1, 2, 3], children: [node('cuboid.001', { position: [0, 0.5, 0], quaternion: q, scale: [2, 1, 4] })] })]);
    expect(b.name).toBe('crate_physical_dynamic');
    close(b.desc.position, [1, 2, 3]);
    expect(b.desc.colliders).toHaveLength(1);
    const c = b.desc.colliders[0];
    expect(c.shape).toBe('cuboid');
    close(c.args, [1, 0.5, 2]);
    close(c.position, [0, 0.5, 0]);
    close(c.rotation, q);
  });

  it('a ball’s radius is half its height', () => {
    const c = one([node('rock_physical', { children: [node('ball', { scale: [3, 3, 3] })] })]).desc.colliders[0];
    expect(c.shape).toBe('ball');
    close(c.args, [1.5]);
  });

  it('a ball scaled more one way than another throws, naming the node', () => {
    expect(() => bodiesFromNodes([node('rock_physical', { children: [node('ball', { scale: [1, 2, 1] })] })])).toThrow('rock_physical: a ball needs one scale');
  });

  it('a cylinder is half its height and half its width', () => {
    const c = one([node('barrel_physical_dynamic', { children: [node('cylinder', { scale: [0.8, 1.2, 0.8] })] })]).desc.colliders[0];
    expect(c.shape).toBe('cylinder');
    close(c.args, [0.6, 0.4]);
  });

  it('a capsule’s half height leaves out its caps', () => {
    const c = one([node('post_physical', { children: [node('capsule', { scale: [0.5, 2, 0.5] })] })]).desc.colliders[0];
    expect(c.shape).toBe('capsule');
    close(c.args, [0.75, 0.25]);
  });

  it('a hull and a trimesh take their points, scaled', () => {
    const points = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
    const b = one([
      node('rock_physical_dynamic', { children: [node('hull', { scale: [2, 2, 2], points })] }),
    ]);
    expect(b.desc.colliders[0].shape).toBe('hull');
    expect(Array.from(b.desc.colliders[0].args[0])).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2]);
    const t = one([node('ground_physical', { children: [node('trimesh', { scale: [1, 3, 1], points, indices })] })]).desc.colliders[0];
    expect(t.shape).toBe('trimesh');
    expect(Array.from(t.args[0])).toEqual([0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 1]);
    expect(Array.from(t.args[1])).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('a body with no collider child is one cuboid round its own box', () => {
    const b = one([node('barrel_physical_dynamic', { box: { min: [-0.4, 0, -0.4], max: [0.4, 1.2, 0.4] } })]);
    const c = b.desc.colliders[0];
    expect(c.shape).toBe('cuboid');
    close(c.args, [0.4, 0.6, 0.4]);
    close(c.position, [0, 0.6, 0]);
  });

  it('a body with no collider child and no box is left out', () => {
    expect(bodiesFromNodes([node('ghost_physical')])).toEqual([]);
  });

  it('a dynamic body sleeps and weighs the kind’s default, or its own', () => {
    const light = one([node('crate_physical_dynamic', { children: [node('cuboid')] })]).desc;
    expect(light.sleeping).toBe(true);
    expect(light.mass).toBe(0.1);
    expect(one([node('crate_physical_dynamic', { children: [node('cuboid')] })], { mass: 2 }).desc.mass).toBe(2);
    const heavy = one([node('crate_physical_dynamic', { userData: { mass: 3, friction: 0.7, restitution: 0.4 }, children: [node('cuboid')] })]).desc;
    expect(heavy.mass).toBe(3);
    expect(heavy.friction).toBe(0.7);
    expect(heavy.restitution).toBe(0.4);
  });

  it('a fixed body has no mass and isn’t put to sleep', () => {
    const d = one([node('wall_physical', { children: [node('cuboid')] })]).desc;
    expect(d.mass).toBeUndefined();
    expect(d.sleeping).toBeUndefined();
    expect('friction' in d).toBe(false);
  });

  it('a physical node nested in another is its own body, placed through its parents', () => {
    const turn = [0, Math.SQRT1_2, 0, Math.SQRT1_2]; // a quarter turn about y
    const inner = node('lid_physical_dynamic', { position: [1, 0, 0], children: [node('cuboid')] });
    const outer = node('chest_physical', { position: [0, 1, 0], quaternion: turn, children: [node('cuboid'), inner] });
    const out = bodiesFromNodes([node('group', { position: [10, 0, 0], children: [outer] })]);
    expect(out.map((b) => b.name)).toEqual(['chest_physical', 'lid_physical_dynamic']);
    close(out[0].desc.position, [10, 1, 0]);
    expect(out[0].desc.colliders).toHaveLength(1);
    // (+x turned a quarter about y is −z)
    close(out[1].desc.position, [10, 1, -1]);
    close(out[1].desc.rotation, turn);
  });

  it('a body’s own scale scales its colliders', () => {
    const c = one([node('crate_physical', { scale: [2, 2, 2], children: [node('cuboid', { position: [0, 1, 0] })] })]).desc.colliders[0];
    close(c.args, [1, 1, 1]);
    close(c.position, [0, 2, 0]);
  });
});

describe('what it makes, in the world', () => {
  it('every shape is a body the world takes, and a dynamic one stays asleep', async () => {
    const { createPhysics } = await import('./world');
    const physics = await createPhysics({ gravity: -9.81 });
    const points = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const made = bodiesFromNodes([
      node('crate_physical_dynamic', { position: [0, 1, 0], children: [node('cuboid')] }),
      node('rock_physical_dynamic', { position: [3, 1, 0], children: [node('ball'), node('hull', { points })] }),
      node('post_physical', { position: [6, 1, 0], children: [node('cylinder'), node('capsule', { scale: [0.5, 2, 0.5] })] }),
      node('ground_physical', { children: [node('trimesh', { points, indices: new Uint32Array([0, 1, 2]) })] }),
    ]);
    const bodies = made.map(({ desc }) => physics.add(desc));
    physics.step(1 / 60);
    expect(bodies).toHaveLength(4);
    expect(bodies[0].sleeping).toBe(true);
    physics.dispose();
  });
});
