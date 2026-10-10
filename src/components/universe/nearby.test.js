import { describe, expect, it } from 'vitest';
import { NEAR, createLazy, focalPx, standIn, wanted } from './nearby';

describe('wanted: a place near enough that what it shows should load', () => {
  const r = 50;
  const f = focalPx(720, 50);

  it('wants a place close by, whichever way the camera is looking', () => {
    expect(wanted({ dist: r * (NEAR.reach - 0.1), r, inView: false, focal: f })).toBe(true);
    expect(wanted({ dist: r * (NEAR.reach + 0.1), r, inView: false, focal: f })).toBe(false);
  });

  it('wants one in view once its disc is big enough on screen for its models to show', () => {
    const at = (r * f) / NEAR.px; // where its radius is NEAR.px pixels
    expect(wanted({ dist: at * 0.95, r, inView: true, focal: f })).toBe(true);
    expect(wanted({ dist: at * 1.05, r, inView: true, focal: f })).toBe(false);
  });

  it('leaves the fandoms’ planets alone from the home system’s overview (a few pixels across, models a pixel or two)', () => {
    // the nearest of them seen from the home system's edge: about 2,000 out, r 52
    expect(wanted({ dist: 2000, r: 52, inView: true, focal: f })).toBe(false);
  });

  it('works out the lens’s focal length in pixels from the frame’s height and the field of view', () => {
    expect(focalPx(720, 90)).toBeCloseTo(360, 6);
    expect(focalPx(720, 50)).toBeGreaterThan(700);
  });
});

describe('createLazy: a module fetched once, when it’s first wanted', () => {
  it('loads once however often it’s wanted, and says when it’s there', async () => {
    let calls = 0;
    const lazy = createLazy(async () => {
      calls++;
      return { n: 7 };
    });
    expect(lazy.value).toBe(null);
    const [a, b] = await Promise.all([lazy.want(), lazy.want()]);
    expect(calls).toBe(1);
    expect(a).toEqual({ n: 7 });
    expect(b).toBe(a);
    expect(lazy.value).toBe(a);
  });

  it('tries again after a failed fetch (a dropped connection)', async () => {
    let calls = 0;
    const lazy = createLazy(async () => {
      if (calls++ === 0) throw new Error('offline');
      return 'here';
    });
    expect(await lazy.want()).toBe(null);
    expect(await lazy.want()).toBe('here');
  });

  it('hands what arrives after it’s been let go to `drop`, never to the page', async () => {
    const dropped = [];
    let release;
    const lazy = createLazy(() => new Promise((res) => (release = res)), (v) => dropped.push(v));
    const p = lazy.want();
    lazy.dispose();
    release('late');
    expect(await p).toBe(null);
    expect(lazy.value).toBe(null);
    expect(dropped).toEqual(['late']);
  });
});

describe('standIn: what answers for a lazy object until it’s here', () => {
  const real = () => ({
    phase: 'walk',
    n: 2,
    add(k) {
      return this.n + k;
    },
  });

  it('answers as idle until it’s here: the properties it’s told, null for the rest, and methods that do nothing', () => {
    const lazy = createLazy(async () => real());
    const s = standIn(lazy, { props: { phase: null, list: [] }, methods: { begin: () => false } });
    expect(s.phase).toBe(null);
    expect(s.list).toEqual([]);
    expect(s.add(1)).toBe(null);
    expect(s.begin()).toBe(false);
  });

  it('is the real one once it’s come, its methods called on it', async () => {
    const lazy = createLazy(async () => real());
    const s = standIn(lazy, { props: { phase: null } });
    await lazy.want();
    expect(s.phase).toBe('walk');
    expect(s.add(1)).toBe(3);
  });

  it('knows a property from a method by what it’s told, not by guessing', () => {
    const s = standIn(createLazy(async () => real()), { props: { phase: null } });
    expect(typeof s.phase).not.toBe('function');
    expect(typeof s.whatever).toBe('function');
  });
});
