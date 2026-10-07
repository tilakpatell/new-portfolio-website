import { describe, expect, it } from 'vitest';
import { BLOCKS, byName } from './blocks';
import { HOTBAR, SLOTS, count, give, held, makeInventory, move, quickMove, split, take } from './inventory';
import { ITEMS, ITEM_TEXTURES, stackOf } from './items';

describe('the items', () => {
  it('every ITEMS block refers to a block in the registry, and every block a player can hold is an item', () => {
    for (const it of Object.values(ITEMS)) if (it.kind === 'block') expect(BLOCKS[it.block]?.name, it.name).toBe(it.name);
    for (const b of BLOCKS.slice(1)) if (!['water', 'lava', 'wheat', 'farmland'].includes(b.name)) expect(ITEMS[b.name]?.kind, b.name).toBe('block');
    expect(ITEMS.water).toBeUndefined();
  });

  it('every drop is an item', () => {
    for (const b of BLOCKS.slice(1)) for (const tool of [null, { type: b.tool, tier: 3 }]) for (const d of b.drops(7, tool, () => 0)) expect(ITEMS[d.item], `${b.name} drops ${d.item}`).toBeTruthy();
  });

  it('has the five tiers of tools with the game’s speeds and wear', () => {
    const t = (n) => ITEMS[n].tool;
    expect(t('wooden_pickaxe')).toEqual({ type: 'pickaxe', tier: 0, speed: 2, durability: 59 });
    expect(t('stone_axe')).toEqual({ type: 'axe', tier: 1, speed: 4, durability: 131 });
    expect(t('iron_shovel')).toEqual({ type: 'shovel', tier: 2, speed: 6, durability: 250 });
    expect(t('golden_sword')).toEqual({ type: 'sword', tier: 0, speed: 12, durability: 32 });
    expect(t('diamond_pickaxe')).toEqual({ type: 'pickaxe', tier: 3, speed: 8, durability: 1561 });
    expect(ITEMS.diamond_pickaxe.stack).toBe(1);
  });

  it('stacks as the game does: 64, eggs and snowballs 16, tools 1', () => {
    expect(stackOf('cobblestone')).toBe(64);
    expect(stackOf('egg')).toBe(16);
    expect(stackOf('snowball')).toBe(16);
    expect(stackOf('iron_sword')).toBe(1);
    expect(stackOf('stick')).toBe(64);
  });

  it('feeds as the game does', () => {
    expect(ITEMS.bread.food).toEqual({ hunger: 5, saturation: 6 });
    expect(ITEMS.cooked_beef.food).toEqual({ hunger: 8, saturation: 12.8 });
    expect(ITEMS.apple.food).toEqual({ hunger: 4, saturation: 2.4 });
  });

  it('lists the item tiles the atlas needs, once each, sorted', () => {
    expect(new Set(ITEM_TEXTURES).size).toBe(ITEM_TEXTURES.length);
    expect([...ITEM_TEXTURES].sort()).toEqual(ITEM_TEXTURES);
    expect(ITEM_TEXTURES).toEqual(expect.arrayContaining(['stick', 'wooden_pickaxe', 'diamond', 'oak_door', 'sugar_cane']));
    for (const it of Object.values(ITEMS)) if (it.texture) expect(ITEM_TEXTURES, it.name).toContain(it.texture);
  });
});

describe('the inventory', () => {
  it('has 36 slots, the first 9 the hotbar', () => {
    const inv = makeInventory();
    expect(SLOTS).toBe(36);
    expect(HOTBAR).toBe(9);
    expect(inv.slots).toHaveLength(36);
    expect(inv.selected).toBe(0);
    expect(held(inv)).toBeNull();
  });

  it('give 70 cobblestone fills a slot to 64 and 6 into the next', () => {
    const inv = makeInventory();
    expect(give(inv, 'cobblestone', 70)).toBe(0);
    expect(inv.slots[0]).toEqual({ item: 'cobblestone', count: 64, damage: 0 });
    expect(inv.slots[1]).toEqual({ item: 'cobblestone', count: 6, damage: 0 });
    expect(count(inv, 'cobblestone')).toBe(70);
  });

  it('give tops up a stack it already has before it takes an empty slot', () => {
    const inv = makeInventory();
    give(inv, 'dirt', 1);
    give(inv, 'stone', 1);
    give(inv, 'dirt', 10);
    expect(inv.slots[0]).toMatchObject({ item: 'dirt', count: 11 });
    expect(inv.slots[2]).toBeNull();
  });

  it('give 17 eggs (stack 16) spills', () => {
    const inv = makeInventory();
    expect(give(inv, 'egg', 17)).toBe(0);
    expect(inv.slots[0].count).toBe(16);
    expect(inv.slots[1].count).toBe(1);
  });

  it('gives back what doesn’t fit in a full inventory', () => {
    const inv = makeInventory();
    for (let i = 0; i < 36; i++) inv.slots[i] = { item: 'stone', count: 64, damage: 0 };
    expect(give(inv, 'dirt', 5)).toBe(5);
    inv.slots[20].count = 60;
    expect(give(inv, 'stone', 10)).toBe(6);
  });

  it('tools don’t stack', () => {
    const inv = makeInventory();
    give(inv, 'wooden_pickaxe', 2);
    expect(inv.slots[0]).toMatchObject({ item: 'wooden_pickaxe', count: 1 });
    expect(inv.slots[1]).toMatchObject({ item: 'wooden_pickaxe', count: 1 });
  });

  it('take removes from a slot and empties it at nothing', () => {
    const inv = makeInventory();
    give(inv, 'dirt', 5);
    expect(take(inv, 0, 2)).toEqual({ item: 'dirt', count: 2, damage: 0 });
    expect(inv.slots[0].count).toBe(3);
    expect(take(inv, 0, 10)).toEqual({ item: 'dirt', count: 3, damage: 0 });
    expect(inv.slots[0]).toBeNull();
    expect(take(inv, 0, 1)).toBeNull();
  });

  it('move merges like stacks and swaps unlike', () => {
    const inv = makeInventory();
    inv.slots[0] = { item: 'dirt', count: 40, damage: 0 };
    inv.slots[1] = { item: 'dirt', count: 40, damage: 0 };
    move(inv, 0, 1);
    expect(inv.slots[1].count).toBe(64);
    expect(inv.slots[0].count).toBe(16);
    inv.slots[2] = { item: 'stone', count: 3, damage: 0 };
    move(inv, 2, 0);
    expect(inv.slots[0]).toMatchObject({ item: 'stone', count: 3 });
    expect(inv.slots[2]).toMatchObject({ item: 'dirt', count: 16 });
    move(inv, 2, 30);
    expect(inv.slots[2]).toBeNull();
    expect(inv.slots[30]).toMatchObject({ item: 'dirt', count: 16 });
  });

  it('split takes the larger half', () => {
    const inv = makeInventory();
    inv.slots[3] = { item: 'dirt', count: 7, damage: 0 };
    expect(split(inv, 3)).toEqual({ item: 'dirt', count: 4, damage: 0 });
    expect(inv.slots[3].count).toBe(3);
    inv.slots[4] = { item: 'dirt', count: 1, damage: 0 };
    expect(split(inv, 4).count).toBe(1);
    expect(inv.slots[4]).toBeNull();
  });

  it('shift-click moves to the hotbar from the rest, and back', () => {
    const inv = makeInventory();
    inv.slots[0] = { item: 'stone', count: 64, damage: 0 };
    inv.slots[1] = { item: 'dirt', count: 60, damage: 0 };
    inv.slots[20] = { item: 'dirt', count: 10, damage: 0 };
    quickMove(inv, 20);
    expect(inv.slots[1].count).toBe(64);
    expect(inv.slots[2]).toMatchObject({ item: 'dirt', count: 6 });
    expect(inv.slots[20]).toBeNull();
    quickMove(inv, 0);
    expect(inv.slots[0]).toBeNull();
    expect(inv.slots[9]).toMatchObject({ item: 'stone', count: 64 });
  });

  it('holds what the selected slot has', () => {
    const inv = makeInventory();
    inv.slots[4] = { item: 'torch', count: 3, damage: 0 };
    inv.selected = 4;
    expect(held(inv).item).toBe('torch');
  });

  it('every item named is real', () => {
    expect(() => give(makeInventory(), 'nonsense', 1)).toThrow();
    expect(byName.has('cobblestone')).toBe(true);
  });
});
