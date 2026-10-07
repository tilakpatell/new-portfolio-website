import { describe, expect, it } from 'vitest';
import { ECHO_BASE, archesOf, floorsOf, inRoom, inSolid, wallsOf, zoneRooms } from './echoLayout';

const { rooms, spawn, exit, bounds } = ECHO_BASE;
const room = (id) => rooms.find((r) => r.id === id);
const walls = wallsOf(rooms);
const blocked = (x, z, pad = 0.35) => walls.some((w) => inSolid(w, x, z, pad));

describe('Echo Base, inside', () => {
  it('puts you down, and lets you out, inside a room', () => {
    expect(rooms.some((r) => inRoom(r, ...spawn))).toBe(true);
    expect(rooms.some((r) => inRoom(r, ...exit.at))).toBe(true);
    expect(blocked(...spawn)).toBe(false);
  });

  it('joins every room to the rest: from the door you can reach them all', () => {
    const touch = (a, b) => {
      // (two rooms meet where a point just inside one's edge is in the other)
      for (let i = 0; i <= 40; i++)
        for (let j = 0; j <= 40; j++) {
          const x = a.at[0] - a.hw + (2 * a.hw * i) / 40;
          const z = a.at[1] - a.hd + (2 * a.hd * j) / 40;
          if (inRoom(a, x, z) && inRoom(b, x, z, 0.05)) return true;
        }
      return false;
    };
    const seen = new Set([rooms.find((r) => inRoom(r, ...spawn)).id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const a of rooms)
        if (!seen.has(a.id) && rooms.some((b) => seen.has(b.id) && (touch(a, b) || touch(b, a)))) {
          seen.add(a.id);
          grew = true;
        }
    }
    expect([...seen].sort()).toEqual(rooms.map((r) => r.id).sort());
  });

  it('walls you in, but not between the rooms', () => {
    // (the ways through: down the entry, west to the command centre, east
    // to the medical centre, north to the cavern)
    const walk = (from, to) => {
      for (let i = 0; i <= 100; i++) {
        const x = from[0] + ((to[0] - from[0]) * i) / 100;
        const z = from[1] + ((to[1] - from[1]) * i) / 100;
        if (blocked(x, z)) return [x, z];
      }
      return null;
    };
    const mid = room('junction').at;
    expect(walk(spawn, mid)).toBeNull();
    expect(walk(mid, room('command').at)).toBeNull();
    expect(walk(mid, room('medical').at)).toBeNull();
    expect(walk(mid, room('cavern').at)).toBeNull();
    // (and just outside the entry's walls, solid ice)
    const e = room('entry');
    expect(blocked(e.at[0] + e.hw + 0.3, e.at[1])).toBe(true);
    expect(blocked(e.at[0] - e.hw - 0.3, e.at[1])).toBe(true);
    // (the cavern's round wall, beyond its far side)
    const c = room('cavern');
    expect(blocked(c.at[0], c.at[1] - c.hw - 0.3)).toBe(true);
  });

  it('holds its corridors up with arches about every 4 m, and only in corridors', () => {
    const arches = archesOf(rooms);
    expect(arches.length).toBeGreaterThan(8);
    for (const [x, z, along] of arches) {
      const r = rooms.find((q) => q.kind === 'corridor' && inRoom(q, x, z));
      expect(r, `${x}, ${z}`).toBeTruthy();
      expect(along).toBe(r.hd > r.hw ? 'z' : 'x');
    }
    const entry = arches.filter(([x, z]) => inRoom(room('entry'), x, z)).map(([, z]) => z).sort((a, b) => a - b);
    for (let i = 1; i < entry.length; i++) expect(entry[i] - entry[i - 1]).toBeCloseTo(4, 5);
  });

  it('fits inside its bounds, with a floor under every room', () => {
    const [hw, hd, h] = bounds;
    for (const r of rooms) {
      expect(Math.abs(r.at[0]) + r.hw).toBeLessThanOrEqual(hw);
      expect(Math.abs(r.at[1]) + r.hd).toBeLessThanOrEqual(hd);
      expect(r.h).toBeLessThanOrEqual(h);
    }
    expect(floorsOf(rooms)).toHaveLength(rooms.length);
  });

  it('gives the zone its rooms as the camera reads them, the round one marked', () => {
    const z = zoneRooms(rooms);
    const cav = z[rooms.findIndex((r) => r.id === 'cavern')];
    expect(cav[6]).toBe('round');
    for (const [i, r] of rooms.entries()) if (!r.round) expect(z[i]).toHaveLength(6);
  });
});
