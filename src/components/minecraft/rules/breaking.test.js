import { describe, expect, it } from 'vitest';
import { byName } from './blocks';
import { breakTicks, breakTime, canHarvest } from './breaking';

const b = (n) => byName.get(n);
const ground = { onGround: true, inWater: false };

describe('how long a block takes to break', () => {
  it('dirt by hand is 0.75 s', () => {
    expect(breakTime(b('dirt'), null, ground)).toBe(0.75);
  });

  it('stone by hand is 7.5 s, and with a wooden pickaxe the game’s 1.15 s (1.125 rounded up to whole ticks)', () => {
    expect(breakTime(b('stone'), null, ground)).toBe(7.5);
    expect(breakTime(b('stone'), 'wooden_pickaxe', ground)).toBe(1.15);
    expect(breakTicks(b('stone'), 'wooden_pickaxe', ground)).toBe(23);
  });

  it('obsidian with a diamond pickaxe is the game’s 9.4 s', () => {
    expect(breakTime(b('obsidian'), 'diamond_pickaxe', ground)).toBe(9.4);
  });

  it('a log with an axe is faster, and the wrong tool is a hand', () => {
    expect(breakTime(b('oak_log'), null, ground)).toBe(3);
    expect(breakTime(b('oak_log'), 'stone_axe', ground)).toBe(0.75);
    expect(breakTime(b('oak_log'), 'stone_pickaxe', ground)).toBe(3);
  });

  it('a pickaxe below the tier still speeds the block but drops nothing', () => {
    expect(breakTime(b('diamond_ore'), 'stone_pickaxe', ground)).toBe(3.75);
    expect(canHarvest(b('diamond_ore'), 'stone_pickaxe')).toBe(false);
    expect(canHarvest(b('diamond_ore'), 'iron_pickaxe')).toBe(true);
    expect(canHarvest(b('dirt'), null)).toBe(true);
  });

  it('is five times as long in water or off the ground', () => {
    expect(breakTime(b('dirt'), null, { onGround: false, inWater: false })).toBe(3.75);
    expect(breakTime(b('dirt'), null, { onGround: true, inWater: true })).toBe(3.75);
  });

  it('is nothing for a flower, and never for bedrock or water', () => {
    expect(breakTime(b('poppy'), null, ground)).toBe(0);
    expect(breakTime(b('bedrock'), 'diamond_pickaxe', ground)).toBe(Infinity);
    expect(breakTime(b('water'), null, ground)).toBe(Infinity);
  });

  it('shears take leaves at once and wool fast', () => {
    expect(breakTime(b('oak_leaves'), null, ground)).toBe(0.3);
    expect(breakTime(b('oak_leaves'), 'shears', ground)).toBe(0); // (more than a whole break a tick: at once, as the game does)
    expect(breakTime(b('white_wool'), 'shears', ground)).toBe(0.25);
  });
});
