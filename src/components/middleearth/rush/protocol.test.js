import { describe, expect, it } from 'vitest';
import { PONY } from './levels/pony';
import { cleanCode, makeCode, readEvents, readItem, readLobby, readPose, readState, seat, writeEvents, writeItem, writeLobby, writePose, writeState } from './protocol';
import { grab, newRush, stepRush } from './rules';

describe('room codes', () => {
  it('are four letters, read back however typed', () => {
    const c = makeCode(() => 0.5);
    expect(c).toMatch(/^[A-Z]{4}$/);
    expect(cleanCode(` ${c.toLowerCase()} `)).toBe(c);
    expect(cleanCode('AEIO')).toBe(null); // no vowels in a code
    expect(cleanCode('BCD')).toBe(null);
    expect(cleanCode(null)).toBe(null);
  });
});

describe('the wire', () => {
  it('things go and come back', () => {
    for (const it of [{ k: 'mug', s: 'ale' }, { k: 'bowl', s: 'dirty' }, { k: 'loaf', s: 'burnt' }]) expect(readItem(writeItem(it))).toEqual(it);
    expect(readItem(writeItem(null))).toBe(null);
    expect(readItem([99, 0])).toBe(null);
  });

  it('the lobby goes and comes back, and seats guests', () => {
    const lob = { phase: 'count', seed: 42, slots: ['host', 'abc', null, null] };
    expect(readLobby(writeLobby(lob))).toEqual(lob);
    expect(readLobby([9, 1, [0, 0, 0, 0]])).toBe(null);
    let r = seat(lob.slots, 'def');
    expect(r.slot).toBe(2);
    r = seat(r.slots, 'abc');
    expect(r.slot).toBe(1);
    expect(seat(['a', 'b', 'c', 'd'], 'e').slot).toBe(null);
  });

  it('a pose is kept inside the room and out of the counters', () => {
    const s = newRush(PONY);
    expect(readPose(writePose({ x: 2.5, z: 2.5, face: 1, work: true, vx: 1, vz: 0 }), s)).toMatchObject({ x: 2.5, z: 2.5, face: 1, work: true });
    const p = readPose([5.5, 3.2, 0, 0], s); // just inside the island's edge: put back beside it
    expect(p.z).toBeLessThanOrEqual(3 - 0.3 + 1e-6);
    const deep = readPose([4.5, 3.5, 0, 0], s);
    expect(deep === null || deep.z < 3 || deep.x < 4).toBe(true);
    expect(readPose([500, -3, 0, 0], s)).toBe(null); // in the corner counter: no place to be
    expect(readPose(['x', 1, 0], s)).toBe(null);
  });

  it('a guest’s copy of the round matches the host’s', () => {
    const host = newRush(PONY, { players: 2, seed: 3 });
    // a few things going on
    host.orders.push({ id: 1, dish: 'pint', t: 30, of: 50 });
    const p = host.players[1];
    Object.assign(p, { x: 1.5, z: 1.5, face: Math.PI / 2 });
    grab(host, p); // a carrot
    host.spots['7,0'] = { n: 3, cook: 2, s: 'cooking', prog: 0 };
    host.spots['8,7'].dirty.push('mug');
    host.spots['0,5'].n = 1;
    stepRush(host, 0.5);
    const guest = newRush(PONY, { players: 1 });
    guest.players[0].x = 9.9; // the guest's own place
    const wire = JSON.parse(JSON.stringify(writeState(host)));
    expect(readState(guest, wire, 0)).toBe(true);
    expect(guest.players).toHaveLength(2);
    expect(guest.players[0].x).toBe(9.9);
    expect(guest.players[1].held).toEqual({ k: 'carrot', s: 'raw' });
    expect(guest.spots['7,0']).toMatchObject({ n: 3, s: 'cooking' });
    expect(guest.spots['8,7'].dirty).toEqual(['mug']);
    expect(guest.spots['0,5'].n).toBe(1);
    expect(guest.orders.map((o) => o.dish)).toEqual(host.orders.map((o) => o.dish));
    expect(guest.coins).toBe(host.coins);
    expect(JSON.stringify(wire).length).toBeLessThan(4000);
  });

  it('turns away nonsense', () => {
    const s = newRush(PONY);
    expect(readState(s, null)).toBe(false);
    expect(readState(s, { p: [], sp: [1, 2], od: [] })).toBe(false);
  });

  it('events go and come back', () => {
    const ev = [{ type: 'served', at: [4, 7], p: 1, dish: 'stew', coins: 20, order: 3 }, { type: 'chop', at: [5, 0] }, { type: 'lapsed', dish: 'pint', order: 2 }];
    const back = readEvents(JSON.parse(JSON.stringify(writeEvents(ev))));
    expect(back).toHaveLength(2); // 'chop' makes no sound of its own on the wire
    expect(back[0]).toMatchObject({ type: 'served', at: [4, 7], p: 1, dish: 'stew', coins: 20, order: 3 });
    expect(back[1]).toMatchObject({ type: 'lapsed', dish: 'pint' });
    expect(readEvents([[99], 'x', null])).toEqual([]);
  });
});
