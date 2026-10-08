import { describe, expect, it } from 'vitest';
import { createImpacts } from '../impact';
import { wireImpacts } from './impacts';

// a thud, a dust and a shake that only remember
const fakes = () => {
  const said = { thuds: [], bursts: [], shakes: [], updates: [], disposed: 0 };
  return {
    said,
    thud: (o) => said.thuds.push(o),
    dust: { burst: (...a) => said.bursts.push(a), update: (dt) => said.updates.push(dt), dispose: () => said.disposed++ },
    shake: (k) => said.shakes.push(k),
  };
};
const rules = () => createImpacts({ now: () => 0, random: () => 0.5 });

describe('wireImpacts', () => {
  it('answers a full hit with a thud, six puffs and a shake', () => {
    const f = fakes();
    const listener = { position: [0, 0, 0], forward: [0, 0, -1] };
    const w = wireImpacts({ rules: rules(), thud: f.thud, dust: f.dust, shake: f.shake, listener: () => listener });
    w.onHit(120, [1, 2, 3]);
    expect(f.said.thuds).toHaveLength(1);
    expect(f.said.thuds[0]).toMatchObject({ gain: 1, pitch: 1, at: [1, 2, 3], listener });
    expect(f.said.bursts).toHaveLength(1);
    expect(f.said.bursts[0][0]).toEqual([1, 2, 3]);
    expect(f.said.bursts[0][1]).toBe(6);
    expect(f.said.shakes).toEqual([0.15]);
  });

  it('does nothing for a hit under the threshold', () => {
    const f = fakes();
    const w = wireImpacts({ rules: rules(), thud: f.thud, dust: f.dust, shake: f.shake });
    w.onHit(10, [0, 0, 0]);
    expect(f.said.thuds).toHaveLength(0);
    expect(f.said.bursts).toHaveLength(0);
    expect(f.said.shakes).toHaveLength(0);
  });

  it('turns the place into the world’s with toWorld, for the sound and the dust', () => {
    const f = fakes();
    const w = wireImpacts({ rules: rules(), thud: f.thud, dust: f.dust, toWorld: (at) => at.map((a) => a * 10) });
    w.onHit(120, [1, 0, 0]);
    expect(f.said.thuds[0].at).toEqual([10, 0, 0]);
    expect(f.said.bursts[0][0]).toEqual([10, 0, 0]);
  });

  it('rises the dust along the up it is told, where it is told one', () => {
    const f = fakes();
    const w = wireImpacts({ rules: rules(), thud: f.thud, dust: f.dust, up: (at) => at });
    w.onHit(120, [0, 5, 0]);
    expect(f.said.bursts[0][2]).toEqual([0, 5, 0]);
  });

  it('keys the throttle on what was hit', () => {
    const f = fakes();
    const w = wireImpacts({ rules: rules(), thud: f.thud });
    w.onHit(120, [0, 0, 0], 'barrel');
    w.onHit(120, [1, 0, 0], 'barrel');
    w.onHit(120, [1, 0, 0], 'crate');
    expect(f.said.thuds).toHaveLength(2);
  });

  it('works with nothing to show it: a thud alone', () => {
    const f = fakes();
    const w = wireImpacts({ rules: rules(), thud: f.thud });
    expect(() => w.onHit(120, [0, 0, 0])).not.toThrow();
    expect(() => w.update(0.1)).not.toThrow();
    expect(f.said.thuds).toHaveLength(1);
  });

  it('runs the dust a frame, and lets it go at the end', () => {
    const f = fakes();
    const w = wireImpacts({ rules: rules(), thud: f.thud, dust: f.dust });
    w.update(0.016);
    expect(f.said.updates).toEqual([0.016]);
    w.dispose();
    expect(f.said.disposed).toBe(1);
    w.onHit(120, [0, 0, 0]);
    expect(f.said.thuds).toHaveLength(0);
  });
});
