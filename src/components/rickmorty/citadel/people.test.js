import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { figuresLoader as loader, flush } from './figures.fixture';
import { createPeople } from './people';

const PLACES = {
  council: [
    { x: -3.6, y: 0.12, z: 0.1, face: -Math.PI / 2 + 0.35 },
    { x: 0, y: 0.12, z: -0.6, face: -Math.PI / 2 },
    { x: 3.6, y: 0.12, z: 0.1, face: -Math.PI / 2 - 0.35 },
  ],
  clerks: [{ x: -7.6, y: 0, z: 2.6, face: Math.PI - 0.7 }],
  workers: [{ x: -6, y: 0, z: -1.4, face: -Math.PI / 2 }],
};
const made = async (opts = {}) => {
  const rooms = { outdoors: new THREE.Group(), factory: new THREE.Group(), council: new THREE.Group() };
  const people = await createPeople({ ...rooms, places: PLACES, tier: 'low', loader: loader(opts) });
  return { people, ...rooms };
};
// the world's state, an ordinary day on the concourse with Rick at (x, z)
const day = (o = {}) => ({ mode: 'walk', where: 'concourse', mood: 'day', rick: { x: 0, z: 30, face: Math.PI / 2, speed: 0, vx: 0, vz: 0 }, mortys: [], cops: null, cues: [], ...o });
// a clock: run(state, s) steps the people s seconds on at 30 frames a second (state may be a function of t)
const clock = (people) => {
  let t = 0;
  const cam = new THREE.Vector3(0, 6, 40);
  return async (state, s) => {
    const end = t + s - 1e-9;
    while (t < end) {
      t += 1 / 30;
      people.update(typeof state === 'function' ? state(t) : state, t, cam);
      // (a library clip asked for this frame is fetched before the next)
      await flush();
    }
    return t;
  };
};
const sum = (f) => ['idle', 'walk', 'run'].reduce((s, n) => s + (f.act[n]?.getEffectiveWeight() ?? 0), 0);

describe('the Citadel’s people on their animators', () => {
  it('sits the Council through base, and a councillor talks with his hands over the sit when it’s his line', async () => {
    const { people } = await made();
    const run = clock(people);
    const hearing = { ...day(), mode: 'inside', room: 'council' };
    await run(hearing, 0.5);
    const [a, b] = people.council;
    expect(a.act.sit.getEffectiveWeight()).toBe(1);
    expect(sum(a)).toBeCloseTo(0, 6);
    await run({ ...hearing, speech: { who: 'councilb', at: 'charge', line: '“Twenty-seven Ricks are dead and their Mortys taken.”' } }, 0.6);
    expect(b.anim.playing('upper')).toBe('talk');
    expect(b.act.sit.getEffectiveWeight()).toBe(1);
    // (and the one who isn't speaking looks at him)
    expect(a.lookAt).not.toBe(null);
    people.dispose();
  });

  it('draws the Cop Ricks’ watch: running on a chase, a sharp start when one sees Rick', async () => {
    const { people } = await made();
    const run = clock(people);
    const cop = { id: 0, x: 0, z: 0, face: 0, mode: 'patrol', look: 0 };
    const red = (t) => ({ ...day({ mood: 'red' }), cops: [{ ...cop, x: t * 5.2, mode: 'chase' }] });
    await run(red, 1);
    const f = people.cops[0];
    expect(f.group.visible).toBe(true);
    expect(f.act.run.getEffectiveWeight() + f.act.walk.getEffectiveWeight()).toBeGreaterThan(0.5);
    await run((t) => ({ ...red(t), cues: [{ type: 'seen', id: 0 }] }), 1 / 30);
    await run(red, 0.15);
    expect(f.anim.playing('upper')).toBe('hit.head');
    people.dispose();
  });

  it('frightens a Day Care Morty as Rick comes at it, and he cheers once he’s penned', async () => {
    const { people } = await made();
    const run = clock(people);
    const m = { id: 0, x: -10, z: 0, face: 0, speed: 3.1, penned: false, scared: false };
    const herd = (t, o = {}) => day({ mortys: [{ ...m, x: -10 + t * 3.1, ...o }] });
    await run((t) => herd(t), 0.3);
    await run((t) => herd(t, { scared: true }), 0.3);
    const f = people.mortys[0];
    expect(f.anim.playing('upper')).toBe('scared');
    await run((t) => ({ ...herd(t, { penned: true }), cues: [{ type: 'penned', id: 0 }] }), 1 / 30);
    await run((t) => herd(t, { penned: true }), 0.2);
    expect(['cheer', 'happy', 'taunt']).toContain(f.anim.playing('upper') ?? f.anim.playing('full'));
    people.dispose();
  });

  it('has Rick strike the emote picked, and take a hit when he’s caught', async () => {
    const { people } = await made();
    const run = clock(people);
    await run(day({ emote: { id: 'wave', at: 0, t: 0 } }), 0.3);
    expect(people.rick.anim.playing('upper')).toBe('wave');
    await run(day(), 0.1);
    await run({ ...day(), cues: [{ type: 'caught', id: 0 }] }, 1 / 30);
    await run(day(), 0.1);
    expect(people.rick.anim.playing('full') ?? people.rick.anim.playing('upper')).toBe('hit.chest');
    people.dispose();
  });

  it('walks the crowd about their day, each figure where its brain has it', async () => {
    const { people } = await made();
    const run = clock(people);
    const before = people.crowd.map((f) => f.group.position.clone());
    await run(day(), 6);
    expect(people.crowd.length).toBeGreaterThan(0);
    for (const [i, f] of people.crowd.entries()) {
      expect(f.group.visible).toBe(true);
      expect(f.group.position.distanceTo(before[i])).toBeGreaterThan(0.3);
    }
    // (gone on red alert)
    await run(day({ mood: 'red' }), 0.1);
    expect(people.crowd.every((f) => !f.group.visible)).toBe(true);
    people.dispose();
  });

  it('leaves out a figure whose model won’t load, and nothing throws for it', async () => {
    const { people } = await made({ fails: ['cop'] });
    expect(people.cops).toEqual([]);
    const run = clock(people);
    await expect(run({ ...day({ mood: 'red' }), cops: [{ id: 0, x: 0, z: 0, face: 0, mode: 'chase', look: 0 }], cues: [{ type: 'seen', id: 0 }, { type: 'caught', id: 0 }] }, 0.2)).resolves.toBeGreaterThan(0);
    people.dispose();
  });
});
