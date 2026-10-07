import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMBAT, CREW, TINTS, TROOP_KINDS, fileOf, tintOf, weighPoses } from './crew';

const at = (path) => new URL(`../../../../public${path}`, import.meta.url);

describe('the surfaces’ crew', () => {
  it('has a model in the site for each of them', () => {
    for (const [kind, c] of Object.entries(CREW)) expect(existsSync(at(fileOf(c))), `${kind}: ${fileOf(c)}`).toBe(true);
  });

  it('has Luke and Leia, rigged on the same skeleton as Han, and Chewie, whose model is the cockpits’', () => {
    expect(fileOf(CREW.han)).toBe('/models/galaxy/crew/han.glb');
    expect(CREW.luke).toEqual({ url: '/models/galaxy/crew/luke.glb', tall: 1.72 });
    expect(CREW.leia).toEqual({ url: '/models/galaxy/crew/leia.glb', tall: 1.5 });
    expect(CREW.chewie).toMatchObject({ url: '/models/cockpit/chewie.glb', tall: 2.28 });
  });

  it('has the galaxy’s soldiers, rigged, at a soldier’s height', () => {
    for (const kind of TROOP_KINDS) {
      expect(fileOf(CREW[kind]), kind).toBe(`/models/galaxy/troops/${kind}.glb`);
      expect(CREW[kind].tall, kind).toBeGreaterThan(1.7);
      expect(CREW[kind].tall, kind).toBeLessThan(2);
      expect(CREW[kind].still, kind).toBeFalsy();
    }
  });

  it('makes any Wookiee from Chewie, in a few shades, Chewbacca himself as he was made', () => {
    expect(fileOf(CREW.wookiee)).toBe('/models/cockpit/chewie.glb');
    expect(CREW.wookiee.tints).toBe(true);
    expect(tintOf(0)).toBe('#ffffff');
    expect(new Set([0, 1, 2, 3].map(tintOf)).size).toBe(TINTS.length);
    expect(tintOf(TINTS.length + 1)).toBe(tintOf(1));
    expect(tintOf(-1)).toBe(tintOf(TINTS.length - 1));
  });

  it('has the fight’s clips in the site', () => {
    for (const n of COMBAT) expect(existsSync(at(`/models/galaxy/troops/clip-${n}.glb`)), n).toBe(true);
  });
});

describe('the fight’s poses', () => {
  const run = (st, secs, dt = 1 / 60) => {
    let k = 1;
    for (let t = 0; t < secs; t += dt) k = weighPoses(st, dt);
    return k;
  };

  it('kneels in a moment, the walk given up for it, and gets up again', () => {
    const st = { name: 'kneel', w: {}, hit: -1 };
    expect(run(st, 0.6)).toBeLessThan(0.02);
    expect(st.w.kneel).toBeGreaterThan(0.98);
    st.name = null;
    expect(run(st, 0.8)).toBeGreaterThan(0.98);
    expect(st.w.kneel).toBeLessThan(0.02);
  });

  it('flinches and is over it in under half a second', () => {
    const st = { name: null, w: {}, hit: 0 };
    let most = 0;
    for (let t = 0; t < 0.6; t += 1 / 60) {
      weighPoses(st, 1 / 60);
      most = Math.max(most, st.w.hit);
    }
    expect(most).toBeGreaterThan(0.5);
    expect(st.w.hit).toBe(0);
    expect(st.hit).toBe(-1);
  });

  it('goes down faster than it kneels, every weight between nought and one', () => {
    const a = { name: 'die', w: {}, hit: -1 };
    const b = { name: 'kneel', w: {}, hit: -1 };
    weighPoses(a, 0.1);
    weighPoses(b, 0.1);
    expect(a.w.die).toBeGreaterThan(b.w.kneel);
    const c = { name: 'kneel', w: { taunt: 0.6 }, hit: 0.1 };
    for (let i = 0; i < 30; i++) {
      const left = weighPoses(c, 1 / 60);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(1);
      for (const w of Object.values(c.w)) expect(w >= 0 && w <= 1).toBe(true);
    }
  });
});
