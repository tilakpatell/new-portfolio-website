import { describe, expect, test } from 'vitest';
import { LANDABLE, siteOf } from '../sites';
import { heightFor, standable } from '../sites/validity';
import { E, SITE, kit } from './fixtures/site';
import { bendBeat, frontBetween, holderSide, padTurf, strengthOf, turfAt, turfsOf } from './turf';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const kitFor = (site) => {
  const h = heightFor(site);
  return { standable: (p) => standable(site, p), height: h, rand: () => 0.5 };
};

describe('turf', () => {
  test('a quiet world has the pad turf only, the owner’s, at full strength of its hold', () => {
    const t = turfsOf(SITE, E, kit);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ id: 'pad', holder: 'owner', r: 90 });
    expect(strengthOf(t[0], E)).toBeCloseTo(0.7);
    expect(t[0].posts).toHaveLength(3);
    expect(t[0].beats).toHaveLength(2);
    expect(holderSide(t[0], E)).toBe('empire');
  });
  test('the pad turf stands where the garrison stood: posts 26 m out, beats 34 and 48 m', () => {
    const p = padTurf(SITE, E, kit);
    for (const q of p.posts) expect(dist(q, SITE.land.at)).toBeCloseTo(26, 0);
    expect(dist(p.beats[0][0], SITE.land.at)).toBeCloseTo(34, 0);
    expect(dist(p.beats[1][0], SITE.land.at)).toBeCloseTo(48, 0);
  });
  test('a front adds the other side’s far turf 220 to 300 m out, its beats bent to the front', () => {
    const F = { ...E, front: true };
    const t = turfsOf(SITE, F, kit);
    const far = t.find((x) => x.id === 'far');
    expect(far).toMatchObject({ holder: 'other', r: 110 });
    const d = dist(far.at, SITE.land.at);
    expect(d).toBeGreaterThanOrEqual(220);
    expect(d).toBeLessThanOrEqual(300);
    expect(strengthOf(far, F)).toBeCloseTo(0.3);
    expect(holderSide(far, F)).toBe('rebel');
    expect(frontBetween(t[0], far)).not.toBeNull();
    expect(far.beats[0].some((p) => p[0] === far.front.at[0] && p[1] === far.front.at[1])).toBe(true);
    expect(far.posts).toHaveLength(3);
    // (its posts on the near edge, facing the pad)
    for (const p of far.posts) expect(dist(p, SITE.land.at)).toBeLessThan(d);
    // (never in the sea to the west)
    expect(far.at[0]).toBeGreaterThan(-350);
  });
  test('a Hutt world has mercenaries and no far turf even on a front', () => {
    const H = { ...E, owner: 'hutt', front: true };
    const t = turfsOf(SITE, H, kit);
    expect(t).toHaveLength(1);
    expect(holderSide(t[0], H)).toBe('hutt');
  });
  test('no far turf where there is no dry ground for it', () => {
    const wet = { ...kit, standable: ([x, z]) => dist([x, z], [0, 0]) < 120 };
    expect(turfsOf(SITE, { ...E, attack: true }, wet)).toHaveLength(1);
  });
  test('an authored turf is kept, its side’s, at strength 1', () => {
    const own = { id: 'palace', at: [200, 0], r: 40, holder: 'hutt', posts: [[190, 0]], beats: [] };
    const t = turfsOf({ ...SITE, turf: [own] }, E, kit);
    const p = t.find((x) => x.id === 'palace');
    expect(p).toBeTruthy();
    expect(strengthOf(p, E)).toBe(1);
    expect(holderSide(p, E)).toBe('hutt');
  });
  test('frontBetween is null between friends', () => {
    const a = { id: 'a', at: [0, 0], r: 50, side: 'rebel', war: 'gcw' };
    const b = { id: 'b', at: [200, 0], r: 50, side: 'rebel', war: 'gcw' };
    expect(frontBetween(a, b)).toBeNull();
    const f = frontBetween(a, { ...b, side: 'empire' });
    expect(f.at).toEqual([100, 0]);
    expect(f.dir[0]).toBeCloseTo(1);
  });
  test('turfAt picks the nearest centre where discs overlap, null in no man’s land', () => {
    const turfs = [{ id: 'a', at: [0, 0], r: 100 }, { id: 'b', at: [150, 0], r: 100 }];
    expect(turfAt(turfs, 70, 0).id).toBe('a');
    expect(turfAt(turfs, 80, 0).id).toBe('b');
    expect(turfAt(turfs, 0, 300)).toBeNull();
  });
  test('bendBeat puts one point of a beat on the front', () => {
    const beat = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const bent = bendBeat(beat, { at: [50, 0], dir: [1, 0] });
    expect(bent).toHaveLength(4);
    expect(bent).toContainEqual([50, 0]);
    expect(beat).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
  test('far turf is standable on every landable site in every war state', () => {
    for (const id of LANDABLE) {
      const site = siteOf(id);
      if (site.noGround) continue;
      const k = kitFor(site);
      for (const owner of ['rebel', 'empire', 'hutt'])
        for (const turf of turfsOf(site, { owner, control: 0.5, front: true, attack: false, war: 'gcw' }, k)) {
          for (const p of turf.posts) expect(standable(site, p), `${id} ${owner} ${turf.id} post ${p}`).toBe(true);
          for (const b of turf.beats) for (const p of b) expect(standable(site, p), `${id} ${owner} ${turf.id} beat ${p}`).toBe(true);
        }
    }
  });
});

describe('beats a patrol can walk', () => {
  test('no leg of a beat, its way back round included, crosses water', () => {
    const strip = ([x, z]) => kit.standable([x, z]) && !(x > 10 && x < 20 && z > 5); // (a creek across the pad's beats)
    const k = { ...kit, standable: strip };
    for (const effects of [E, { ...E, front: true }]) {
      const t = turfsOf(SITE, effects, k);
      for (const turf of t)
        for (const b of turf.beats) {
          expect(b.length).toBeGreaterThanOrEqual(2);
          for (let i = 0; i < b.length; i++) {
            const a = b[i];
            const c = b[(i + 1) % b.length];
            const n = Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 4);
            for (let j = 0; j <= n; j++) expect(strip([a[0] + ((c[0] - a[0]) * j) / n, a[1] + ((c[1] - a[1]) * j) / n]), `${turf.id} leg ${i}`).toBe(true);
          }
        }
    }
  });
});
