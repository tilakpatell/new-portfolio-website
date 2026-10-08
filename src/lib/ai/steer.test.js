import { describe, expect, it } from 'vitest';
import { avoid, clear, createContext, follow, resolve, seek, separate } from './steer';

const P = (x, z) => ({ x, y: 0, z });
const angle = (d) => Math.atan2(d.x, d.z);
const deg = (r) => (r * 180) / Math.PI;

describe('context steering', () => {
  it('seek alone goes straight at the target', () => {
    const ctx = createContext();
    seek(ctx, P(0, 0), P(0, 20));
    const { dir, strength } = resolve(ctx);
    expect(Math.abs(deg(angle(dir)))).toBeLessThan(2);
    expect(strength).toBeGreaterThan(0.9);
    clear(ctx);
    expect(resolve(ctx, { blend: 0 }).strength).toBe(0);
  });

  it('an obstacle in the way sends it round, never through', () => {
    const ctx = createContext();
    const rock = { at: P(0, 8), r: 2 };
    let at = P(0, 0);
    let headed = null;
    for (let i = 0; i < 100; i++) {
      clear(ctx);
      seek(ctx, at, P(0, 20));
      avoid(ctx, at, null, rock, 0.5);
      const { dir, strength } = resolve(ctx, { blend: 0 });
      if (headed == null) headed = Math.abs(deg(angle(dir)));
      if (strength === 0) break;
      at = P(at.x + dir.x * 0.3, at.z + dir.z * 0.3);
      expect(Math.hypot(at.x - rock.at.x, at.z - rock.at.z)).toBeGreaterThan(rock.r);
    }
    expect(headed).toBeGreaterThan(20);
    expect(at.z).toBeGreaterThan(12);
  });

  it('two targets: the clear one wins', () => {
    const ctx = createContext();
    seek(ctx, P(0, 0), P(0, 6), 1); // the nearer, behind a rock
    seek(ctx, P(0, 0), P(10, 0), 0.6); // the further, clear
    avoid(ctx, P(0, 0), null, { at: P(0, 3), r: 1.2 }, 0.5);
    const { dir } = resolve(ctx, { blend: 0 });
    expect(dir.x).toBeGreaterThan(0.8);
  });

  it('separation keeps a pair apart', () => {
    const ctx = createContext();
    seek(ctx, P(0, 0), P(0, 20));
    separate(ctx, P(0, 0), [P(0.3, 1)], 3);
    const { dir } = resolve(ctx, { blend: 0 });
    expect(Math.abs(deg(angle(dir)))).toBeGreaterThan(15);
  });

  it('blend damps a flip', () => {
    const ctx = createContext();
    seek(ctx, P(0, 0), P(0, 20));
    resolve(ctx, { blend: 0.5 });
    clear(ctx);
    seek(ctx, P(0, 0), P(0, -20));
    const { dir } = resolve(ctx, { blend: 0.5 });
    // not yet all the way round: the old interest still pulls (or it's a dead tie, no strength)
    expect(Math.abs(deg(angle(dir)))).toBeLessThan(180);
  });

  it('follow steers along a path, a little ahead', () => {
    const ctx = createContext();
    follow(ctx, P(0, 0), [P(0, 0), P(0, 5), P(5, 5)], 4);
    const { dir } = resolve(ctx, { blend: 0 });
    expect(dir.z).toBeGreaterThan(0.8);
    const c2 = createContext();
    follow(c2, P(0, 5), [P(0, 0), P(0, 5), P(5, 5)], 4);
    expect(resolve(c2, { blend: 0 }).dir.x).toBeGreaterThan(0.8);
    follow(c2, P(0, 0), [], 4);
  });
});
