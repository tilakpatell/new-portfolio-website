import { describe, expect, it } from 'vitest';
import { furnish } from './furnish';
import { newGame } from './game';
import { SEATS, THIGH, seatOf, seatedAt } from './seats';

describe('a seat', () => {
  it('has its sitter drawn with the knees at its front edge and the thighs on its top', () => {
    const chair = { kind: 'chair', x: 2, y: 1, z: 3, yaw: Math.PI / 2, w: 0.6, d: 0.6, h: 1 };
    const at = seatedAt(chair);
    // (yaw π/2 faces +x)
    expect(at.x).toBeCloseTo(2 + SEATS.chair.front);
    expect(at.z).toBeCloseTo(3);
    expect(at.y).toBeCloseTo(1 + SEATS.chair.top - THIGH);
    expect(at.yaw).toBe(Math.PI / 2);
  });

  it('is found for whoever sits in it, the throne’s and the conference room’s chairs', () => {
    const g = newGame({ station: 'ds2', side: 'imperial', mode: 'roam', seed: 5 });
    const throne = furnish(g.layout.rooms.get('throne'), g.layout.station).props.find((p) => p.kind === 'throne');
    expect(seatOf(g, { room: 'throne', x: throne.x + 0.1, z: throne.z })).toEqual(seatedAt(throne));
    expect(seatOf(g, { room: 'throne', x: throne.x + 3, z: throne.z })).toBeNull();
    const ds1 = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 5 });
    const chair = furnish(ds1.layout.rooms.get('conference'), ds1.layout.station).props.find((p) => p.kind === 'chair');
    expect(seatOf(ds1, { room: 'conference', x: chair.x, z: chair.z })).toEqual(seatedAt(chair));
  });

  it('is sat in anywhere along a bench', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 5 });
    const room = [...g.layout.rooms.values()].find((r) => furnish(r, g.layout.station).props.some((p) => p.kind === 'bench'));
    const bench = furnish(room, g.layout.station).props.find((p) => p.kind === 'bench');
    const side = bench.w / 2 - 0.3;
    const at = seatOf(g, { room: room.id, x: bench.x + Math.cos(bench.yaw) * side, z: bench.z + Math.sin(bench.yaw) * side });
    const mid = seatedAt(bench);
    expect(Math.hypot(at.x - mid.x, at.z - mid.z)).toBeCloseTo(side);
  });
});
