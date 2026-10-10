import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createNpcs } from './npcs';
import { NPCS } from './npcs/index';

// a fleet as glbFleet.js is one, its models only groups
const fakeFleet = () => ({
  want: vi.fn(),
  loaded: () => false,
  make: (kind) => ({ kind, group: new THREE.Group(), size: new THREE.Vector3(1, 1, 1), fit: 1, update() {}, dispose: vi.fn() }),
});
// the characters drawn here (a wingman or a bounty hunter is someone else's to draw)
const drawn = Object.values(NPCS).filter((c) => c.brain !== 'wingman' && c.brain !== 'bounty');
const enemy = drawn.find((c) => c.role === 'enemy');
const friend = drawn.find((c) => c.role !== 'enemy');

describe('the characters, as bodies for ship contact', () => {
  it('answers an enemy as a foe and anyone else as a friend, each where it is', () => {
    const npcs = createNpcs(new THREE.Group(), { fleet: fakeFleet(), rand: () => 0.5 });
    const a = npcs.add(enemy, { x: 0, y: 0, z: -10 });
    const b = npcs.add(friend, { x: 5, y: 0, z: -10 });
    const bodies = npcs.bodies;
    expect(bodies.find((o) => o.id === a)).toMatchObject({ key: `n:${a}`, kind: enemy.ship, side: 'foe', size: enemy.size ?? 0.4, at: { x: 0, y: 0, z: -10 } });
    expect(bodies.find((o) => o.id === b)).toMatchObject({ key: `n:${b}`, side: 'friend' });
    npcs.dispose();
  });

  it('takes a ram on a foe as a shot’s hit on it, and none on a friend', () => {
    const npcs = createNpcs(new THREE.Group(), { fleet: fakeFleet(), rand: () => 0.5 });
    const a = npcs.add(enemy, { x: 0, y: 0, z: -10 });
    npcs.add(friend, { x: 5, y: 0, z: -10 });
    const foe = npcs.bodies.find((o) => o.id === a);
    const hp = npcs.targets.find((t) => t.id === a).hp;
    const r = foe.hit(1);
    expect(r).toMatchObject({ id: a, kind: enemy.ship, down: hp <= 1 });
    expect(r.at).toBeInstanceOf(THREE.Vector3);
    expect(npcs.bodies.find((o) => o.side === 'friend').hit(4)).toBeNull();
    npcs.dispose();
  });
});
