import { describe, expect, it } from 'vitest';
import { FIT, biggest, fitSystem, outward, shiftFor } from './fit';

const len = (p) => Math.hypot(...p);
const sys = (over = {}) => ({
  id: 'test',
  body: { look: 'hoth', r: 36 },
  moons: [{ look: 'moon-ice', r: 3, orbit: 84, speed: 0.01, tilt: 0, phase: 0 }],
  pieces: [
    { type: 'fleet', side: 'empire', ships: [{ kind: 'executor', at: [-40, 58, -150], size: 110 }, { kind: 'destroyer', at: [24, 66, -132], size: 30 }] },
    { type: 'cannon', from: [-10, 35.5, 12], every: 9 },
  ],
  ...over,
});

describe('biggest', () => {
  it('is the longest ship or station a system’s pieces build', () => {
    expect(biggest(sys())).toBe(110);
    expect(biggest(sys({ pieces: [{ type: 'deathstar', at: [170, 26, 150], r: 34 }] }))).toBe(68);
    expect(biggest(sys({ pieces: [{ type: 'superlaser', from: [-260, 120, -320], at: [8, 22, 22] }] }))).toBe(FIT.superlaser);
    expect(biggest(sys({ pieces: [{ type: 'battle', at: [0, 0, 0], sides: { a: [{ kind: 'moncal', size: 26 }], b: [{ kind: 'lucrehulk', size: 60 }] } }] }))).toBe(60);
    expect(biggest(sys({ pieces: [] }))).toBe(0);
  });
});

describe('outward', () => {
  it('scales what’s inside the old radius and shifts what’s outside it, so it stays as far off the surface', () => {
    expect(outward(18, 36, 3)).toBeCloseTo(54);
    expect(outward(36, 36, 3)).toBeCloseTo(108);
    expect(outward(100, 36, 3)).toBeCloseTo(172);
  });
  it('never moves anything when the world isn’t grown', () => {
    expect(outward(100, 36, 1)).toBe(100);
  });
});

describe('shiftFor', () => {
  it('is the surface’s own move for a ship straight out along the way out', () => {
    expect(shiftFor([[0, 100, 0]], [0, 1, 0], 36, 3)).toBeCloseTo(72);
  });
  it('is more for a ship off to the side, so it’s as far off the grown surface as it was', () => {
    const q = [80, 40, 0];
    const m = shiftFor([[0, 100, 0], q], [0, 1, 0], 36, 3);
    expect(m).toBeGreaterThan(72);
    expect(Math.hypot(q[0], q[1] + m, q[2]) - 108).toBeGreaterThanOrEqual(Math.hypot(...q) - 36 - 1e-9);
  });
});

describe('fitSystem', () => {
  it('grows a world till it’s at least FIT.ratio times as wide as the longest ship near it is long', () => {
    const s = fitSystem(sys());
    expect(s.body.r).toBeCloseTo(110 * FIT.ratio);
    expect(s.body.r * 2).toBeGreaterThanOrEqual(2 * FIT.ratio * 110 - 1e-9);
  });
  it('leaves a world that’s already big enough as it is (the same object)', () => {
    const small = sys({ pieces: [{ type: 'fleet', side: 'empire', ships: [{ kind: 'destroyer', at: [70, 40, -80], size: 30 }] }], body: { look: 'tatooine', r: 40 } });
    expect(fitSystem(small)).toBe(small);
  });
  it('keeps the ships their size, and a fleet in formation, moved out as one', () => {
    const before = sys();
    const s = fitSystem(before);
    const [a, b] = s.pieces[0].ships;
    expect(a.size).toBe(110);
    expect(b.size).toBe(30);
    const gap = (p, q) => len([p.at[0] - q.at[0], p.at[1] - q.at[1], p.at[2] - q.at[2]]);
    expect(gap(a, b)).toBeCloseTo(gap(before.pieces[0].ships[0], before.pieces[0].ships[1]));
    // and everything that was off the planet still is, as far off it as before (or further)
    for (const ship of s.pieces[0].ships) expect(len(ship.at) - ship.size * 0.5).toBeGreaterThan(s.body.r);
  });
  it('moves a battle out as one, every ship in it as far off the surface as it was', () => {
    const before = sys({ pieces: [{ type: 'battle', at: [70, 30, -60], radius: 130, sides: { a: [{ kind: 'executor', at: [40, 50, -150], size: 110 }], b: [{ kind: 'moncal', at: [-30, -12, 110], size: 26 }] } }] });
    const s = fitSystem(before);
    for (const [side, list] of Object.entries(s.pieces[0].sides))
      list.forEach((o, i) => {
        const was = before.pieces[0].sides[side][i];
        const at = o.at.map((v, j) => v + s.pieces[0].at[j]);
        const old = was.at.map((v, j) => v + before.pieces[0].at[j]);
        expect(Math.hypot(...at) - s.body.r).toBeGreaterThanOrEqual(Math.hypot(...old) - before.body.r - 1e-9);
      });
  });
  it('keeps what stood on the surface on the surface', () => {
    const before = sys();
    const s = fitSystem(before);
    expect(len(s.pieces[1].from)).toBeGreaterThan(s.body.r);
    expect(len(s.pieces[1].from) - s.body.r).toBeCloseTo(len(before.pieces[1].from) - before.body.r);
  });
  it('grows the moons with the planet, and their orbits out with it', () => {
    const s = fitSystem(sys());
    const k = s.body.r / 36;
    expect(s.moons[0].r).toBeCloseTo(3 * k);
    expect(s.moons[0].orbit).toBeCloseTo(outward(84, 36, k));
    expect(s.moons[0].orbit - s.moons[0].r).toBeGreaterThan(s.body.r);
  });
  it('moves a ring’s edges, a shield and a chase round the planet out with it', () => {
    const s = fitSystem(
      sys({
        pieces: [
          { type: 'fleet', side: 'x', ships: [{ kind: 'destroyer', at: [0, 80, 0], size: 90 }] },
          { type: 'rocks', kind: 'ring', at: [0, 0, 0], inner: 54, outer: 88, thickness: 5 },
          { type: 'shield', r: 40 },
          { type: 'chase', runner: { kind: 'corvette', size: 3 }, hunter: { kind: 'destroyer', size: 30 }, radius: 95, height: 22 },
        ],
      }),
    );
    const k = s.body.r / 36;
    expect(s.pieces[1].inner).toBeCloseTo(outward(54, 36, k));
    expect(s.pieces[1].outer).toBeCloseTo(outward(88, 36, k));
    expect(s.pieces[2].r).toBeCloseTo(outward(40, 36, k));
    expect(s.pieces[3].radius).toBeCloseTo(outward(95, 36, k));
  });
  it('keeps a gas giant’s look from the planet, without pushing it past what the camera sees', () => {
    const s = fitSystem(sys({ parent: { look: 'endor-giant', r: 260, at: [-1350, 240, -1650] } }));
    expect(len(s.parent.at)).toBeLessThanOrEqual(FIT.farthest + 1e-6);
    expect(s.parent.r / len(s.parent.at)).toBeCloseTo(260 / len([-1350, 240, -1650]));
    expect(s.parent.r).toBeGreaterThan(s.body.r);
  });
});
