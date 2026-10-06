import { describe, expect, it } from 'vitest';
import { HUNT, leaveHunt, newHunt, stepHunt } from './locos';
import { COP, HIDES } from './mortytown';

const DT = 1 / 30;
const hideOf = (l) => HIDES.find((h) => h.id === l.hide);

// Rick walks the waypoints at `speed`, the hunt stepped as he goes; every
// event comes back
function walk(hunt, rick, points, speed = 3) {
  const events = [];
  for (const [tx, tz] of points) {
    for (let guard = 0; guard < 5000; guard++) {
      const dx = tx - rick.x;
      const dz = tz - rick.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) break;
      const k = Math.min(1, (speed * DT) / d);
      rick.x += dx * k;
      rick.z += dz * k;
      rick.face = Math.atan2(-dz, dx);
      events.push(...stepHunt(hunt, rick, DT));
    }
  }
  return events;
}
// stand still a while
const wait = (hunt, rick, s) => {
  const events = [];
  for (let t = 0; t < s; t += DT) events.push(...stepHunt(hunt, rick, DT));
  return events;
};

describe('the Mortytown Locos', () => {
  it('hides three Locos, each at a hide of its own, the same for the same seed', () => {
    const h = newHunt(1);
    expect(h).toEqual(newHunt(1));
    expect(h.locos.map((l) => l.id).sort()).toEqual(['loco-a', 'loco-b', 'loco-c']);
    expect(new Set(h.locos.map((l) => l.hide)).size).toBe(HUNT.count);
    for (const l of h.locos) {
      expect(l.state).toBe('hiding');
      expect(l).toMatchObject({ x: hideOf(l).x, z: hideOf(l).z });
    }
    expect(h.state).toBe('on');
    // another seed, another three alleys, now and then
    const sets = new Set([1, 2, 3, 4, 5].map((seed) => newHunt(seed).locos.map((l) => l.hide).sort().join()));
    expect(sets.size).toBeGreaterThan(1);
  });
  it('finds a Loco only up close and in sight', () => {
    const h = newHunt(1);
    const l = h.locos[0];
    const at = hideOf(l);
    // far off: nothing
    expect(stepHunt(h, { x: 0, z: 0, face: 0 }, DT)).toEqual([]);
    // close, but through a wall (from inside the block beside the alley)
    expect(stepHunt(h, { x: at.x - 2.3, z: at.z, face: 0 }, DT).filter((e) => e.type === 'found')).toEqual([]);
    // up the alley from him, in plain sight
    const ev = stepHunt(h, { x: at.x, z: at.z + (at.z > 0 ? -HUNT.find + 0.2 : HUNT.find - 0.2), face: 0 }, DT);
    expect(ev).toEqual([{ type: 'found', id: l.id }]);
    expect(l.state).toBe('following');
  });
  it('follows Rick at walking pace, and is walked to Cop Morty; three and it’s won, once', () => {
    const h = newHunt(3);
    const rick = { x: 0, z: 0, face: 0 };
    const all = [];
    for (const l of h.locos) {
      const at = hideOf(l);
      const up = at.z > 0 ? -1 : 1;
      all.push(...walk(h, rick, [[at.x, 0], [at.x, at.z + up * 2]]));
      expect(l.state, l.id).toBe('following');
      all.push(...walk(h, rick, [[at.x, 0], [COP.x - 2, 0], [COP.x - 1, COP.z - 1]]));
      // he keeps up with a walk
      expect(Math.hypot(l.x - rick.x, l.z - rick.z), l.id).toBeLessThan(HUNT.deliver + 2);
      all.push(...wait(h, rick, 2));
      expect(l.state, l.id).toBe('delivered');
    }
    expect(all.filter((e) => e.type === 'found').length).toBe(3);
    expect(all.filter((e) => e.type === 'delivered').length).toBe(3);
    expect(all.filter((e) => e.type === 'won')).toEqual([{ type: 'won' }]);
    expect(h.state).toBe('won');
    expect(wait(h, rick, 1)).toEqual([]);
    // the delivered stand by Cop Morty, apart
    const d = h.locos;
    for (const l of d) expect(Math.hypot(l.x - COP.x, l.z - COP.z)).toBeLessThan(4);
    for (let i = 0; i < d.length; i++) for (let j = 0; j < i; j++) expect(Math.hypot(d[i].x - d[j].x, d[i].z - d[j].z)).toBeGreaterThan(0.6);
  });
  it('loses a Loco Rick runs away from, back to his alley', () => {
    const h = newHunt(1);
    const l = h.locos[0];
    const at = hideOf(l);
    const rick = { x: at.x, z: 0, face: 0 };
    walk(h, rick, [[at.x, at.z + (at.z > 0 ? -2 : 2)]]);
    expect(l.state).toBe('following');
    const ev = walk(h, rick, [[at.x, 0], [at.x + (at.x < 0 ? 40 : -40), 0]], 8);
    expect(ev.filter((e) => e.type === 'lost')).toEqual([{ type: 'lost', id: l.id }]);
    expect(l).toMatchObject({ state: 'hiding', x: at.x, z: at.z });
  });
  it('sends the followers back to their alleys when Rick leaves, and keeps the delivered', () => {
    const h = newHunt(2);
    const [a, b] = h.locos;
    a.state = 'following';
    b.state = 'delivered';
    expect(leaveHunt(h)).toEqual([a.id]);
    expect(a).toMatchObject({ state: 'hiding', x: hideOf(a).x, z: hideOf(a).z });
    expect(b.state).toBe('delivered');
  });
  it('counts a delivery once, however long he stands there', () => {
    const h = newHunt(1);
    const l = h.locos[0];
    l.state = 'following';
    l.x = COP.x - 1;
    l.z = COP.z - 1;
    const rick = { x: COP.x - 1.5, z: COP.z - 2, face: 0 };
    const ev = wait(h, rick, 3);
    expect(ev.filter((e) => e.type === 'delivered')).toEqual([{ type: 'delivered', id: l.id }]);
  });
});
