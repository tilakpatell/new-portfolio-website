import { describe, expect, it } from 'vitest';
import { APP_ID, RATES, ROOM, flightLimiter, readBuilt, readGone, readHi, readHit, readPose, readShot, writeHi, writePose, writeShot } from './flightProtocol';
import { NET_CELL } from '../../../lib/net/cells';

const ship = { x: 1200.123, y: 310.456, z: -800.789, pitch: 0.25, yaw: 7, roll: -0.5, speed: 300.004, flags: 2 };

describe('the flight’s wire', () => {
  it('names the room by planet, and its rates are the spec’s six', () => {
    expect(ROOM('hoth')).toBe('fly-v1:hoth');
    expect(APP_ID).toBe('tilakpatel-portfolio-flight');
    expect(RATES).toEqual({ pose: [20, 30], shot: [10, 12], hit: [10, 12], built: [1, 3], gone: [1, 3], hi: [1, 4] });
    const l = flightLimiter();
    let n = 0;
    for (let i = 0; i < 10; i++) n += l.allow('built', 0) ? 1 : 0;
    expect(n).toBe(3);
    expect(l.allow('ally', 0)).toBe(false); // (nothing the flight doesn't say)
  });

  it('a pose round-trips, rounded and wrapped, with the tag of its cell', () => {
    const out = writePose(ship);
    expect(out).toEqual([1200.12, 310.46, -800.79, 0.25, Math.round((7 - 2 * Math.PI) * 100) / 100, -0.5, 300, 2]);
    expect(readPose(out, 'hoth/0,-1')).toEqual({ x: 1200.12, y: 310.46, z: -800.79, pitch: 0.25, yaw: out[4], roll: -0.5, speed: 300, flags: 2 });
  });

  it('a pose with a number that isn’t one, or too short, or no tag, is nothing', () => {
    const out = writePose(ship);
    for (let i = 0; i < 7; i++) {
      const bad = [...out];
      bad[i] = i % 2 ? NaN : 'x';
      expect(readPose(bad, 'hoth/0,-1')).toBeNull();
    }
    expect(readPose([...out.slice(0, 7), Infinity], 'hoth/0,-1')).toBeNull();
    expect(readPose(out.slice(0, 7), 'hoth/0,-1')).toBeNull();
    expect(readPose(out, null)).toBeNull();
    expect(readPose(out, 'hoth')).toBeNull();
    expect(readPose({ 0: 1 }, 'hoth/0,0')).toBeNull();
  });

  it('a pose with NaN or Infinity in any slot, or tagged for another planet, is nothing', () => {
    const out = writePose(ship);
    for (let i = 0; i < 8; i++)
      for (const bad of [NaN, Infinity, -Infinity]) {
        const p = [...out];
        p[i] = bad;
        expect(readPose(p, 'hoth/0,-1', 'hoth')).toBeNull();
      }
    expect(readPose(out, 'hoth/0,-1', 'hoth')).not.toBeNull();
    expect(readPose(out, 'endor/0,-1', 'hoth')).toBeNull();
  });

  it('a pose’s speed is clamped, and its flags a byte', () => {
    expect(readPose([0, 0, 0, 0, 0, 0, 9000, 2], 'hoth/0,0').speed).toBe(400);
    expect(readPose([0, 0, 0, 0, 0, 0, -50, 2], 'hoth/0,0').speed).toBe(0);
    expect(readPose([0, 0, 0, 0, 0, 0, 0, 9999], 'hoth/0,0').flags).toBe(255);
  });

  it('a pose far from the cell its tag names is a tag lie, and dropped', () => {
    expect(readPose([5000, 0, 5000, 0, 0, 0, 100, 0], 'hoth/0,0')).toBeNull(); // (5 km out)
    expect(readPose([5000, 0, 5000, 0, 0, 0, 100, 0], 'hoth/2,2')).not.toBeNull();
    // (a pilot just over the edge, before their tag's caught up, is let be)
    expect(readPose([NET_CELL + 100, 0, 10, 0, 0, 0, 300, 0], 'hoth/0,0')).not.toBeNull();
  });

  it('a hello is a cleaned name and a ship kind, or a pilot and none', () => {
    expect(readHi(writeHi({ name: 'Han', kind: 'xwing' }))).toEqual({ name: 'Han', kind: 'xwing' });
    expect(readHi({ n: 7, k: '<script>' })).toEqual({ name: 'Pilot', kind: null });
    expect(readHi(null)).toBeNull();
    expect(readHi([1])).toBeNull();
  });

  it('a shot round-trips, and one too fast or far from its pilot is nothing', () => {
    const out = writeShot({ x: 1, y: 2, z: 3 }, [400, 0, 0.0001]);
    expect(readShot(out)).toEqual({ p: [1, 2, 3], v: [400, 0, 0] });
    expect(readShot([1, 2, 3, 400, NaN, 0])).toBeNull();
    expect(readShot([1, 2, 3, 9000, 0, 0])).toBeNull();
    expect(readShot([1, 2, 3])).toBeNull();
    const from = { x: 0, y: 0, z: 0, speed: 300 };
    expect(readShot([50, 0, 0, 400, 0, 0], from)).not.toBeNull();
    expect(readShot([500, 0, 0, 400, 0, 0], from)).toBeNull();
  });

  it('a hit is clamped to 30, and nothing at all is no hit', () => {
    expect(readHit({ d: 10 })).toBe(10);
    expect(readHit({ d: 999 })).toBe(30);
    expect(readHit({ d: 0 })).toBeNull();
    expect(readHit({ d: 'x' })).toBeNull();
    expect(readHit(null)).toBeNull();
  });

  it('a built or a gone names a uuid (and a built its cell), else it’s nothing', () => {
    const id = '0b6f3a52-9a4e-4b8e-8f1c-2d7a9e5c1b34';
    expect(readBuilt({ id, cell: 'hoth/0,-1' })).toEqual({ id, cell: 'hoth/0,-1' });
    expect(readBuilt({ id: 'turret-1', cell: 'hoth/0,0' })).toBeNull();
    expect(readBuilt({ id, cell: 'nowhere' })).toBeNull();
    expect(readBuilt(null)).toBeNull();
    expect(readGone({ id: id.toUpperCase() })).toEqual({ id });
    expect(readGone({ id: 'x' })).toBeNull();
    expect(readGone(undefined)).toBeNull();
  });
});
