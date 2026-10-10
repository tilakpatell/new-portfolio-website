// hurtbox.js as it was on the closed #781 branch; its engine tests ran
// against that branch's character.js and queries.js, which lane P1 brings
// back. Until then the colliders are met through a stand-in body that
// records what is attached (the pose maths is the same either way).
import { describe, expect, it } from 'vitest';
import { REGIONS, capsuleBetween, createHurtboxes } from './hurtbox';

const near = (a, b, tol = 1e-4) => a.every((v, i) => Math.abs(v - b[i]) < tol);

function standIn(at = [0, 1, 0]) {
  const attached = [];
  const collider = (desc) => ({
    desc,
    pose: null,
    half: null,
    setTranslationWrtParent(t) {
      this.pose = { ...t };
    },
    setRotationWrtParent() {},
    setHalfHeight(h) {
      this.half = h;
    },
  });
  const body = {
    removed: false,
    attach(desc) {
      const c = collider(desc);
      attached.push(c);
      return c;
    },
    detach(c) {
      attached.splice(attached.indexOf(c), 1);
    },
  };
  return { attached, body, position: (out) => Object.assign(out, at), quaternion: (out) => Object.assign(out, [0, 0, 0, 1]) };
}

describe('capsuleBetween', () => {
  it('puts the capsule’s centre at the midpoint and its axis along the segment', () => {
    const c = capsuleBetween([0, 1, 0], [0, 2, 0], [5, 0, 0], [0, 0, 0, 1]);
    expect(near(c.translation, [-5, 1.5, 0])).toBe(true);
    expect(near(c.rotation, [0, 0, 0, 1])).toBe(true);
    expect(c.halfHeight).toBeCloseTo(0.5, 6);
  });

  it('turns the capsule onto a segment along x', () => {
    const c = capsuleBetween([0, 1, 0], [2, 1, 0], [0, 0, 0], [0, 0, 0, 1]);
    expect(near(c.translation, [1, 1, 0])).toBe(true);
    const [x, y, z, w] = c.rotation;
    const axis = [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)]; // the rotated y axis
    expect(Math.abs(axis[0])).toBeCloseTo(1, 5);
    expect(c.halfHeight).toBeCloseTo(1, 6);
  });

  it('a yawed body undoes its yaw in the wrt-parent translation', () => {
    const s = Math.SQRT1_2;
    const c = capsuleBetween([5, 1, 0], [5, 2, 0], [5, 0, -3], [0, s, 0, s]);
    expect(near(c.translation, [-3, 1.5, 0], 1e-5)).toBe(true);
  });

  it('a zero-length segment is a ball-sized capsule, never NaN', () => {
    const c = capsuleBetween([1, 1, 1], [1, 1, 1], [0, 0, 0], [0, 0, 0, 1]);
    expect(c.halfHeight).toBe(0);
    expect(c.rotation.every(Number.isFinite)).toBe(true);
  });
});

describe('createHurtboxes', () => {
  it('makes one sensor capsule a region, tagged by its name, and removes them', () => {
    const ch = standIn();
    const h = createHurtboxes(null, ch);
    expect(h.regions).toEqual(Object.keys(REGIONS));
    expect(ch.attached).toHaveLength(10);
    for (const c of ch.attached) expect(c.desc).toMatchObject({ shape: 'capsule', group: 'hurtbox', sensor: true });
    expect(ch.attached.map((c) => c.desc.tag)).toEqual(Object.keys(REGIONS));
    h.remove();
    expect(ch.attached).toHaveLength(0);
  });

  it('sets a region’s capsule from its two world ends, relative to the body', () => {
    const ch = standIn([0, 1, 0]);
    const h = createHurtboxes(null, ch);
    h.set('head', [0, 1.6, 0], [0, 1.8, 0]);
    const head = ch.attached.find((c) => c.desc.tag === 'head');
    expect(head.pose.y).toBeCloseTo(0.7, 6);
    expect(head.half).toBeCloseTo(0.1, 6);
    expect(() => h.set('tail', [0, 0, 0], [0, 1, 0])).not.toThrow();
  });

  it('single: true makes one capsule tagged whole', () => {
    const ch = standIn();
    const h = createHurtboxes(null, ch, { single: true, tall: 1.8 });
    expect(h.regions).toEqual(['whole']);
    expect(ch.attached).toHaveLength(1);
  });
});
