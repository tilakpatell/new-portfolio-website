import { describe, expect, it } from 'vitest';
import { seeded } from '../seeded';
import { REACTIONS, createReactions } from './react';

const you = { x: 4, y: 0, z: 1 };

describe('the default table', () => {
  it('has a row for every event the spec names', () => {
    for (const e of ['greet', 'say', 'hit', 'down', 'gunfire', 'win', 'fire', 'caught', 'alert']) expect(REACTIONS[e]).toBeTruthy();
  });

  it('greet waves on the upper layer, looking at you', () => {
    const r = createReactions(REACTIONS, { rand: () => 0 });
    expect(r.on('greet', { t: 0, target: you })).toEqual({ clip: 'wave', layer: 'upper', hold: false, look: you });
  });

  it('say talks on the upper layer for the line’s length, looking at whom it says it to', () => {
    const r = createReactions(REACTIONS, { rand: () => 0 });
    expect(r.on('say', { t: 0, target: you, hold: 2.5 })).toEqual({ clip: 'talk', layer: 'upper', hold: 2.5, look: you });
    // every line gets its talk, one straight after another
    expect(r.on('say', { t: 0.1, target: you, hold: 1 })).not.toBeNull();
  });

  it('hit picks the chest or the head by where', () => {
    const r = createReactions(REACTIONS, { rand: () => 0 });
    expect(r.on('hit', { t: 0 }).clip).toBe('hit.chest');
    expect(r.on('hit', { t: 5, where: 'head' }).clip).toBe('hit.head');
  });

  it('hit while moving plays on the upper layer', () => {
    const r = createReactions(REACTIONS, { rand: () => 0 });
    expect(r.on('hit', { t: 0, moving: false }).layer).toBe('full');
    expect(r.on('hit', { t: 5, moving: true }).layer).toBe('upper');
  });

  it('down picks die.fwd for a hit from behind, die.back from ahead, die.blown above force 0.8', () => {
    const r = createReactions(REACTIONS, { rand: () => 0 });
    // dir: the way the hit travels, in the figure's frame (+z ahead)
    const behind = r.on('down', { t: 0, dir: { x: 0, z: 1 }, force: 0.5 });
    expect(behind.clip).toBe('die.fwd');
    expect(behind.layer).toBe('full');
    expect(behind.hold).toBe(true);
    expect(r.on('down', { t: 0, dir: { x: 0.3, z: -1 }, force: 0.5 }).clip).toBe('die.back');
    expect(r.on('down', { t: 0, dir: { x: 0, z: 1 }, force: 0.9 }).clip).toBe('die.blown');
    // a world direction turned into the figure's frame by its yaw: facing +x, a hit travelling +x is from behind
    expect(r.on('down', { t: 0, dir: { x: 1, z: 0 }, yaw: Math.PI / 2, force: 0.2 }).clip).toBe('die.fwd');
    expect(r.on('down', { t: 0, dir: { x: -1, z: 0 }, yaw: Math.PI / 2, force: 0.2 }).clip).toBe('die.back');
  });

  it('down falls back to fall, then die, and is never nothing', () => {
    const only = (names) => createReactions(REACTIONS, { rand: () => 0.99, has: (n) => names.includes(n) });
    expect(only(['fall', 'die']).on('down', { t: 0, dir: { x: 0, z: 1 } }).clip).toBe('fall');
    expect(only(['die']).on('down', { t: 0, dir: { x: 0, z: 1 } }).clip).toBe('die');
    expect(only([]).on('down', { t: 0 }).clip).toBe('die');
    // no direction: a fall
    expect(createReactions(REACTIONS, { rand: () => 0 }).on('down', { t: 0 }).clip).toBe('fall');
  });

  it('win cheers, is happy or taunts, by its seed', () => {
    const got = new Set();
    for (let i = 1; i <= 40; i++) got.add(createReactions(REACTIONS, { rand: seeded(i) }).on('win', { t: 0 })?.clip);
    got.delete(undefined);
    expect([...got].sort()).toEqual(['cheer', 'happy', 'taunt']);
  });

  it('fire shoots on the upper layer and holds the aim after', () => {
    const r = createReactions(REACTIONS, { rand: () => 0 });
    expect(r.on('fire', { t: 0, target: you })).toMatchObject({ clip: 'shoot.pistol', layer: 'upper', look: you, then: 'aim.pistol' });
  });

  it('gunfire is scared, caught is a jab', () => {
    const r = createReactions(REACTIONS, { rand: () => 0 });
    expect(r.on('gunfire', { t: 0, target: you }).clip).toBe('scared');
    expect(r.on('caught', { t: 0, target: you }).clip).toBe('jab');
  });

  it('alert points once the figure has the clip, else a sharp start on hit.head', () => {
    const start = createReactions(REACTIONS, { rand: () => 0 }).on('alert', { t: 0, target: you });
    expect(start.clip).toBe('hit.head');
    expect(start.look).toEqual(you);
    expect(start.cut).toBeGreaterThan(0);
    expect(start.cut).toBeLessThan(0.5);
    const point = createReactions(REACTIONS, { rand: () => 0, has: () => true }).on('alert', { t: 0, target: you });
    expect(point.clip).toBe('point');
    expect(point.cut).toBeUndefined();
  });
});

describe('cooldowns and chances', () => {
  it('a reaction doesn’t repeat inside its cooldown', () => {
    const table = { poke: { cooldown: 3, chance: 1, react: () => ({ clip: 'flinch', layer: 'upper' }) } };
    const r = createReactions(table, { rand: () => 0 });
    expect(r.on('poke', { t: 10 })).not.toBeNull();
    for (const t of [10, 10.5, 11, 12, 12.99]) expect(r.on('poke', { t })).toBeNull();
    expect(r.on('poke', { t: 13 })).not.toBeNull();
    // each event cools on its own
    expect(createReactions(REACTIONS, { rand: () => 0 }).on('greet', { t: 0 })).not.toBeNull();
  });

  it('a roll that misses cools down too, so one asked every frame doesn’t keep rolling', () => {
    const table = { poke: { cooldown: 2, chance: 0.5, react: () => ({ clip: 'flinch' }) } };
    let k = 0;
    const r = createReactions(table, { rand: () => (k++ === 0 ? 0.9 : 0) });
    expect(r.on('poke', { t: 0 })).toBeNull();
    expect(r.on('poke', { t: 1 / 60 })).toBeNull();
    expect(r.on('poke', { t: 2 })).not.toBeNull();
  });

  it('a seeded crowd’s greet chances spread', () => {
    expect(REACTIONS.greet.chance).toBe(0.6);
    let reacted = 0;
    for (let i = 1; i <= 50; i++) {
      const r = createReactions(REACTIONS, { rand: seeded(i * 7919) });
      // asked every frame for a second as you pass: one roll each
      let any = false;
      for (let f = 0; f < 60; f++) if (r.on('greet', { t: f / 60, target: you })) any = true;
      if (any) reacted++;
    }
    expect(reacted).toBeGreaterThanOrEqual(20);
    expect(reacted).toBeLessThanOrEqual(40);
  });

  it('an unknown event, or an empty reaction, is null', () => {
    const r = createReactions({ quiet: { react: () => null } }, { rand: () => 0 });
    expect(r.on('nope', { t: 0 })).toBeNull();
    expect(r.on('quiet', { t: 0 })).toBeNull();
  });
});
