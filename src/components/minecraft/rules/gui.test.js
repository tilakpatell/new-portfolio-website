import { describe, expect, it } from 'vitest';
import { click, close, makeScreen, result } from './gui';
import { makeInventory } from './inventory';

const st = (item, count = 1, damage = 0) => ({ item, count, damage });

describe('the inventory screen', () => {
  it('opens with an empty 2 × 2 grid, or the table’s 3 × 3', () => {
    expect(makeScreen(2)).toEqual({ size: 2, grid: [null, null, null, null], cursor: null });
    expect(makeScreen(3).grid).toHaveLength(9);
  });

  it('a left click picks a stack up, and puts it down in an empty slot', () => {
    const inv = makeInventory();
    const s = makeScreen(2);
    inv.slots[0] = st('dirt', 10);
    click(s, inv, { area: 'inv', index: 0 });
    expect(s.cursor).toEqual(st('dirt', 10));
    expect(inv.slots[0]).toBeNull();
    click(s, inv, { area: 'inv', index: 20 });
    expect(inv.slots[20]).toEqual(st('dirt', 10));
    expect(s.cursor).toBeNull();
  });

  it('a left click merges like stacks and swaps unlike', () => {
    const inv = makeInventory();
    const s = makeScreen(2);
    inv.slots[0] = st('dirt', 60);
    s.cursor = st('dirt', 10);
    click(s, inv, { area: 'inv', index: 0 });
    expect(inv.slots[0].count).toBe(64);
    expect(s.cursor.count).toBe(6);
    inv.slots[1] = st('stone', 3);
    click(s, inv, { area: 'inv', index: 1 });
    expect(inv.slots[1]).toEqual(st('dirt', 6));
    expect(s.cursor).toEqual(st('stone', 3));
  });

  it('a right click takes the larger half, or puts one down', () => {
    const inv = makeInventory();
    const s = makeScreen(2);
    inv.slots[0] = st('dirt', 7);
    click(s, inv, { area: 'inv', index: 0, button: 'right' });
    expect(s.cursor.count).toBe(4);
    expect(inv.slots[0].count).toBe(3);
    click(s, inv, { area: 'grid', index: 0, button: 'right' });
    click(s, inv, { area: 'grid', index: 1, button: 'right' });
    expect(s.grid[0]).toEqual(st('dirt', 1));
    expect(s.grid[1]).toEqual(st('dirt', 1));
    expect(s.cursor.count).toBe(2);
  });

  it('shift-click moves between the hotbar and the rest, and out of the grid', () => {
    const inv = makeInventory();
    const s = makeScreen(2);
    inv.slots[20] = st('torch', 5);
    click(s, inv, { area: 'inv', index: 20, shift: true });
    expect(inv.slots[0]).toEqual(st('torch', 5));
    s.grid[3] = st('stick', 2);
    click(s, inv, { area: 'grid', index: 3, shift: true });
    expect(s.grid[3]).toBeNull();
    expect(inv.slots[1]).toEqual(st('stick', 2));
  });

  it('shows what the grid makes, and taking it uses one of each', () => {
    const inv = makeInventory();
    const s = makeScreen(2);
    s.grid[0] = st('oak_log', 2);
    expect(result(s)).toEqual({ item: 'oak_planks', count: 4 });
    click(s, inv, { area: 'result' });
    expect(s.cursor).toEqual(st('oak_planks', 4));
    expect(s.grid[0]).toEqual(st('oak_log', 1));
    // again: onto the like stack in the cursor
    click(s, inv, { area: 'result' });
    expect(s.cursor).toEqual(st('oak_planks', 8));
    expect(s.grid[0]).toBeNull();
    expect(result(s)).toBeNull();
  });

  it('shift-clicking the result makes as many as it can into the inventory', () => {
    const inv = makeInventory();
    const s = makeScreen(2);
    s.grid[0] = st('oak_planks', 5);
    s.grid[2] = st('oak_planks', 3);
    click(s, inv, { area: 'result', shift: true });
    expect(inv.slots[0]).toEqual(st('stick', 12));
    expect(s.grid[0]).toEqual(st('oak_planks', 2));
    expect(s.grid[2]).toBeNull();
  });

  it('a pickaxe from the table’s grid', () => {
    const inv = makeInventory();
    const s = makeScreen(3);
    s.grid[0] = st('oak_planks');
    s.grid[1] = st('oak_planks');
    s.grid[2] = st('oak_planks');
    s.grid[4] = st('stick');
    s.grid[7] = st('stick');
    expect(result(s)).toEqual({ item: 'wooden_pickaxe', count: 1 });
    click(s, inv, { area: 'result' });
    expect(s.cursor).toEqual(st('wooden_pickaxe'));
    expect(s.grid.every((c) => c === null)).toBe(true);
  });

  it('won’t take the result onto a different stack in the cursor', () => {
    const inv = makeInventory();
    const s = makeScreen(2);
    s.grid[0] = st('oak_log');
    s.cursor = st('dirt', 3);
    click(s, inv, { area: 'result' });
    expect(s.cursor).toEqual(st('dirt', 3));
    expect(s.grid[0]).toEqual(st('oak_log'));
  });

  it('closing gives back the grid and the cursor, and says what won’t fit', () => {
    const inv = makeInventory();
    const s = makeScreen(2);
    s.grid[1] = st('oak_log', 2);
    s.cursor = st('stick', 4);
    expect(close(s, inv)).toEqual([]);
    expect(inv.slots[0]).toEqual(st('oak_log', 2));
    expect(inv.slots[1]).toEqual(st('stick', 4));
    expect(s.cursor).toBeNull();
    for (let i = 0; i < 36; i++) inv.slots[i] = st('stone', 64);
    s.cursor = st('dirt', 2);
    expect(close(s, inv)).toEqual([st('dirt', 2)]);
  });

  it('a tool keeps its wear through the cursor', () => {
    const inv = makeInventory();
    const s = makeScreen(2);
    inv.slots[0] = st('stone_pickaxe', 1, 40);
    click(s, inv, { area: 'inv', index: 0 });
    click(s, inv, { area: 'inv', index: 5 });
    expect(inv.slots[5]).toEqual(st('stone_pickaxe', 1, 40));
  });
});
