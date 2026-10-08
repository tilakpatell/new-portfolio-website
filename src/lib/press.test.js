import { describe, expect, it } from 'vitest';
import { createCooldownPress, createPress, pressGroups } from './press';

describe('createPress', () => {
  it('answers a press on the ground once', () => {
    const p = createPress();
    p.press();
    p.ground(true, 0.05);
    expect(p.take()).toBe(true);
    expect(p.take()).toBe(false);
  });

  it('forgives a press just after leaving the ground (coyote time)', () => {
    const p = createPress();
    p.ground(true, 0);
    p.press();
    p.ground(false, 0.08);
    expect(p.take()).toBe(true);
  });

  it('refuses a press made once the coyote time is over', () => {
    const p = createPress();
    p.ground(true, 0);
    p.ground(false, 0.15);
    p.press();
    expect(p.take()).toBe(false);
  });

  it('keeps a press made just before landing (the buffer)', () => {
    const p = createPress();
    p.press();
    p.ground(false, 0.1);
    p.ground(true, 0);
    expect(p.take()).toBe(true);
  });

  it('lets a press go once the buffer is over', () => {
    const p = createPress();
    p.press();
    expect(p.pending).toBe(true);
    p.ground(false, 0.2);
    expect(p.pending).toBe(false);
    p.ground(true, 0);
    expect(p.take()).toBe(false);
  });

  it('forgets a press across a long frame (a tab come back)', () => {
    const p = createPress();
    p.press();
    p.ground(true, 0.5);
    expect(p.take()).toBe(false);
  });

  it('takes no jump from the coyote time twice', () => {
    const p = createPress();
    p.ground(true, 0);
    p.press();
    p.ground(false, 0.02);
    expect(p.take()).toBe(true);
    p.press();
    p.ground(false, 0.02);
    expect(p.take()).toBe(false);
  });

  it('never answers without ever touching the ground, and resets', () => {
    const p = createPress();
    p.press();
    p.ground(false, 0.01);
    expect(p.take()).toBe(false);
    p.press();
    p.reset();
    p.ground(true, 0);
    expect(p.take()).toBe(false);
  });
});

describe('createCooldownPress', () => {
  it('holds a press made in the cooldown and fires it as the cooldown ends', () => {
    const p = createCooldownPress();
    p.press();
    p.ready(false, 0.05);
    expect(p.take()).toBe(false);
    p.ready(true, 0);
    expect(p.take()).toBe(true);
    expect(p.take()).toBe(false);
  });

  it('lets it go if the cooldown outlasts the buffer', () => {
    const p = createCooldownPress();
    p.press();
    p.ready(false, 0.2);
    p.ready(true, 0);
    expect(p.take()).toBe(false);
  });
});

describe('pressGroups', () => {
  it('puts the buffer and the coyote time on the panel, read and written live', () => {
    const p = createPress();
    const [group, ...rest] = pressGroups(p);
    expect(rest).toHaveLength(0);
    expect(group.name).toBe('press');
    expect(group.items.map((it) => [it.key, it.min, it.max])).toEqual([
      ['buffer', 0, 0.3],
      ['coyote', 0, 0.3],
    ]);
    const coyote = group.items[1];
    expect(coyote.get()).toBe(0.1);
    coyote.set(0.2);
    expect(p.values().coyote).toBe(0.2);
    // a cooldown press has no coyote time to show
    expect(pressGroups(createCooldownPress())[0].items.map((it) => it.key)).toEqual(['buffer']);
  });
});
