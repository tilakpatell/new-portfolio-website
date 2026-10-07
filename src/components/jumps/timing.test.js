import { describe, expect, it } from 'vitest';
import { T } from '../hyperspace3d/timeline';
import { STAGED, blueSkyAt, portalAt, stagedAt } from './timing';

const s = (ms) => ms / 1000;
const VIEWS = [
  { W: 1920, H: 1080, aspect: 1920 / 1080 },
  { W: 390, H: 844, aspect: 390 / 844 },
  { W: 3440, H: 1440, aspect: 3440 / 1440 },
];

describe('the portal', () => {
  it('opens ahead, small, and is winding open before the drift ends', () => {
    for (const view of VIEWS) {
      const first = portalAt(0, view);
      expect(first.grow).toBeGreaterThan(0);
      expect(first.grow).toBeLessThan(0.3);
      expect(first.open).toBe(0);
      expect(first.inside).toBe(0);
      const mid = portalAt(s(T.drift) / 2, view);
      expect(mid.open).toBeGreaterThan(0.3);
      expect(portalAt(s(T.drift), view).open).toBeCloseTo(1, 5);
    }
  });

  it('has covered every corner by the flash, goo and all, on any screen', () => {
    for (const view of VIEWS) {
      const { grow, open } = portalAt(s(T.jump), view);
      // the far corner, in screen heights, against the oval's half axes (0.82 wide, 1 tall) with its lumps at their worst
      const corner = Math.hypot(view.aspect / 2 / (grow * open * 0.82), 0.5 / (grow * open));
      expect(corner).toBeLessThan(0.85);
    }
  });

  it('grows on the way in, never shrinking before the flash', () => {
    const view = VIEWS[0];
    let last = 0;
    for (let ms = 0; ms <= T.jump; ms += 25) {
      const { grow } = portalAt(s(ms), view);
      expect(grow).toBeGreaterThanOrEqual(last);
      last = grow;
    }
  });

  it('is the vortex between the flash and the way out, then closes to nothing by the end', () => {
    for (const view of VIEWS) {
      expect(portalAt(s(T.flash + 50), view).inside).toBe(1);
      expect(portalAt(s(T.tunnel - 10), view).inside).toBe(1);
      const out = portalAt(s(T.end), view);
      expect(out.grow).toBe(0);
      expect(out.open).toBe(0);
      // and it shrinks all the way out, never growing back
      let last = Infinity;
      for (let ms = T.tunnel; ms <= T.end; ms += 25) {
        const { grow } = portalAt(s(ms), view);
        expect(grow).toBeLessThanOrEqual(last);
        last = grow;
      }
    }
  });
});

describe('the cook', () => {
  it('starts with the desert heat and no crystal', () => {
    const first = blueSkyAt(0);
    expect(first.haze).toBe(0);
    expect(first.front).toBe(0);
    expect(first.shatter).toBe(0);
    expect(blueSkyAt(s(T.drift)).haze).toBeCloseTo(1, 5);
    expect(blueSkyAt(s(T.drift)).front).toBeLessThan(0.3);
  });

  it('has every shard grown by the flash', () => {
    // a shard is born at most at 0.85 + 0.3 (the shader's), and needs (front - born) * 3 past the farthest point of its cell (about 1)
    const { front } = blueSkyAt(s(T.jump));
    expect((front - 1.15) * 3).toBeGreaterThanOrEqual(1);
    expect(blueSkyAt(s(T.flash + 50)).front).toBe(front);
    expect(blueSkyAt(s(T.tunnel - 10)).front).toBe(front);
  });

  it('grows in steadily, then eases in on the crystal, then shatters all the way out', () => {
    let last = 0;
    for (let ms = 0; ms <= T.jump; ms += 25) {
      const { front } = blueSkyAt(s(ms));
      expect(front).toBeGreaterThanOrEqual(last);
      last = front;
    }
    expect(blueSkyAt(s(T.tunnel)).zoom).toBeLessThan(1);
    expect(blueSkyAt(s(T.tunnel)).shatter).toBe(0);
    let shatter = 0;
    for (let ms = T.tunnel; ms <= T.end; ms += 25) {
      const now = blueSkyAt(s(ms)).shatter;
      expect(now).toBeGreaterThanOrEqual(shatter);
      shatter = now;
    }
    expect(shatter).toBe(1);
    expect(blueSkyAt(s(T.end)).glint).toBe(0);
  });
});

describe('the portal, staged over a 3D jump', () => {
  it('keeps the screen clear while the ship flies into the gate', () => {
    for (const view of VIEWS)
      for (let t = 0; t < STAGED.clear; t += 0.05) {
        const u = stagedAt(t, view);
        expect(u.grow).toBe(0);
        expect(u.dark).toBe(0);
      }
  });

  it('wipes the goo in from the middle and has every corner covered by the flash', () => {
    for (const view of VIEWS) {
      let last = 0;
      for (let ms = STAGED.clear * 1000; ms <= T.jump; ms += 20) {
        const { grow } = stagedAt(s(ms), view);
        expect(grow).toBeGreaterThanOrEqual(last);
        last = grow;
      }
      const { grow, open } = stagedAt(s(T.jump), view);
      const corner = Math.hypot(view.aspect / 2 / (grow * open * 0.82), 0.5 / (grow * open));
      expect(corner).toBeLessThan(0.85);
    }
  });

  it('is the vortex through the tunnel, then a hole opens out to the arrival, clear by the end', () => {
    for (const view of VIEWS) {
      const mid = stagedAt(s((T.flash + T.tunnel) / 2), view);
      expect(mid.inside).toBe(1);
      expect(mid.reveal).toBe(0);
      let last = 0;
      for (let ms = T.tunnel; ms <= T.end; ms += 20) {
        const { reveal } = stagedAt(s(ms), view);
        expect(reveal).toBeGreaterThanOrEqual(last);
        last = reveal;
      }
      const end = stagedAt(s(T.end), view);
      expect(end.reveal).toBeGreaterThanOrEqual(1);
      // the lip (the oval's rim) is out past every corner
      const corner = Math.hypot(view.aspect / 2 / (end.grow * 0.82), 0.5 / end.grow);
      expect(corner).toBeLessThan(end.reveal * 0.9);
    }
  });
});
