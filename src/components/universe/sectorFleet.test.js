import { describe, expect, it } from 'vitest';
import { PATROL, sectorShips, sectorSolids } from './sectorFleet';
import { SECTORS, sectorOf } from './layout';
import { SOLIDS, forward } from './ship';
import { PORTALS } from './portals';
import { wonderById } from './deep';

const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('the Rick and Morty sector’s standing ships', () => {
  it('keeps the Federation’s fleet and the Council’s patrol in the sector, clear of everything solid and of the portals', () => {
    for (let t = 0; t < 600; t += 13) {
      for (const s of sectorShips(t)) {
        expect(sectorOf(...s.at), s.id).toBe('rickmorty');
        const o = SECTORS.rickmorty.origin;
        expect(Math.hypot(s.at[0] - o[0], s.at[2] - o[2]) + s.size, s.id).toBeLessThan(SECTORS.rickmorty.edge - 300);
        for (const solid of SOLIDS) expect(apart(s.at, solid.at), `${s.id} by ${solid.id} at ${t}`).toBeGreaterThan(solid.reach + s.size + 30);
        for (const p of PORTALS) expect(apart(s.at, p.at), `${s.id} by ${p.id}`).toBeGreaterThan(p.r + s.size + 40);
      }
    }
  });

  it('flies the patrol round the Citadel, nose along the way it goes', () => {
    const c = wonderById('citadel').at;
    const dt = 0.5;
    for (let t = 0; t < PATROL.period; t += 20) {
      const a = sectorShips(t).find((s) => s.id === PATROL.id);
      const b = sectorShips(t + dt).find((s) => s.id === PATROL.id);
      expect(Math.hypot(a.at[0] - c[0], a.at[2] - c[2])).toBeCloseTo(PATROL.radius, 6);
      const [fx, fz] = forward(a.heading);
      const mx = b.at[0] - a.at[0];
      const mz = b.at[2] - a.at[2];
      expect((fx * mx + fz * mz) / Math.hypot(mx, mz)).toBeGreaterThan(0.99);
    }
  });

  it('holds the Federation’s wedge together, the lead the biggest', () => {
    const ships = sectorShips(0).filter((s) => s.kind === 'fedbattleship');
    expect(ships).toHaveLength(3);
    expect(ships[0].size).toBe(Math.max(...ships.map((s) => s.size)));
    for (const s of ships.slice(1)) {
      expect(apart(s.at, ships[0].at)).toBeGreaterThan(ships[0].size + s.size);
      expect(apart(s.at, ships[0].at)).toBeLessThan(400);
    }
  });
});

describe('the sector’s standing ships as solids', () => {
  it('is one sphere a ship, at its middle, a little of its length across, so flying into one is a bump or a crash', () => {
    for (const t of [0, 77]) {
      const ships = sectorShips(t);
      const solids = sectorSolids(t);
      expect(solids).toHaveLength(ships.length);
      solids.forEach((o, i) => {
        expect(o).toMatchObject({ id: ships[i].id, at: ships[i].at, ship: true });
        expect(o.r).toBeCloseTo(ships[i].size * 0.16, 6);
        expect(o.reach).toBe(o.r);
      });
    }
  });
});
