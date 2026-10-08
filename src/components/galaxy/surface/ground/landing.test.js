import { describe, expect, test } from 'vitest';
import { SIGHT, covertFor, landingFor } from './landing';

const SITE = { id: 'test', land: { at: [0, 0], yaw: 0.4 } };
const posts = [[20, 0], [-20, 0]];
const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 100;
const dist = (p) => Math.hypot(p[0] - SITE.land.at[0], p[1] - SITE.land.at[1]);

describe('landing', () => {
  test('your side’s, the Hutts’ and an unsworn world land at the pad', () => {
    for (const e of [{ owner: 'rebel', side: 'rebel' }, { owner: 'hutt', side: 'rebel' }, { owner: 'empire', side: null }])
      expect(landingFor(SITE, { ...e, war: 'gcw' }, { standable: () => true, seesThrough: () => true, posts })).toMatchObject({ at: SITE.land.at, yaw: 0.4, covert: false, line: null });
  });
  test('the other side’s world lands covert, 150 to 220 m out, out of the posts’ sight', () => {
    const l = landingFor(SITE, { owner: 'empire', side: 'rebel', war: 'gcw' }, { standable: () => true, seesThrough: far, posts });
    expect(l.covert).toBe(true);
    expect(dist(l.at)).toBeGreaterThanOrEqual(150);
    expect(dist(l.at)).toBeLessThanOrEqual(220);
    expect(l.line).toMatch(/Imperial-held/);
    for (const p of posts) expect(far({ x: p[0], z: p[1] }, { x: l.at[0], z: l.at[1] })).toBe(false);
  });
  test('an Imperial on a Rebel world, and the Separatists’ worlds, say whose', () => {
    expect(landingFor(SITE, { owner: 'rebel', side: 'empire', war: 'gcw' }, { standable: () => true, seesThrough: far, posts }).line).toMatch(/^Rebel-held/);
    expect(landingFor(SITE, { owner: 'separatists', side: 'republic', war: 'clone' }, { standable: () => true, seesThrough: far, posts }).line).toMatch(/^Separatist-held/);
  });
  test('site.covert wins when authored', () => {
    const l = landingFor({ ...SITE, covert: { at: [170, 30], yaw: 1 } }, { owner: 'empire', side: 'rebel', war: 'gcw' }, { standable: () => true, seesThrough: far, posts });
    expect(l).toMatchObject({ at: [170, 30], yaw: 1, covert: true });
  });
  test('a world with no ground under it (Cloud City) always lands on the pad', () => {
    expect(landingFor({ ...SITE, noGround: true }, { owner: 'empire', side: 'rebel', war: 'gcw' }, { standable: () => true, seesThrough: far, posts })).toMatchObject({ at: SITE.land.at, covert: false });
  });
  test('nowhere standable falls back to the pad with no line', () => {
    const l = landingFor(SITE, { owner: 'empire', side: 'rebel', war: 'gcw' }, { standable: () => false, seesThrough: far, posts });
    expect(l).toMatchObject({ at: SITE.land.at, covert: false, line: null });
  });
  test('a post sees no further than SIGHT, and a slope too steep for the ship is passed over', () => {
    const at = covertFor(SITE, { standable: () => true, seesThrough: () => true, posts: [[20, 0]] });
    expect(at).not.toBeNull();
    expect(Math.hypot(at[0] - 20, at[1])).toBeGreaterThanOrEqual(SIGHT);
    const steep = (x) => (x < 0 ? x * 0.6 : 0); // (the far side a cliff)
    const flat = covertFor(SITE, { standable: () => true, seesThrough: far, posts: [[20, 0]], height: (x) => steep(x) });
    expect(flat[0]).toBeGreaterThanOrEqual(0);
  });
  test('never past the edge of the world you can walk to', () => {
    const at = covertFor({ ...SITE, land: { at: [300, 0] }, reach: 400 }, { standable: () => true, seesThrough: far, posts: [[260, 0]] });
    expect(Math.hypot(at[0], at[1])).toBeLessThanOrEqual(380);
  });
  test('covertFor takes the spot furthest from the nearest post, and null when every spot is seen', () => {
    const at = covertFor(SITE, { standable: () => true, seesThrough: far, posts: [[20, 0]] });
    expect(at[0]).toBeLessThan(-140); // (the far side of the ring from the one post)
    const ring = Array.from({ length: 24 }, (_, i) => [Math.cos((i / 24) * Math.PI * 2) * 185, Math.sin((i / 24) * Math.PI * 2) * 185]);
    expect(covertFor(SITE, { standable: () => true, seesThrough: () => true, posts: ring })).toBeNull();
    expect(covertFor(SITE, { standable: (p) => p[1] > 0, seesThrough: far, posts })[1]).toBeGreaterThan(0);
  });
});
