import { describe, expect, it } from 'vitest';
import { seeded } from '../../../lib/seeded';
import { byName } from './blocks';
import { key, makeChunk, packEdits } from './chunk';
import { addChunk, dropChunk, dropFar, newGame } from './game';
import { give } from './inventory';
import { SAVE, SAVE_VERSION, pack, restore } from './save';

const B = (n) => byName.get(n).id;

describe('the save', () => {
  it('is tp-mc, version 1', () => {
    expect(SAVE).toBe('tp-mc');
    expect(SAVE_VERSION).toBe(1);
  });

  it('a save round-trips the inventory, the player and 100 edits', () => {
    const g = newGame({ seed: 'pumpkin' });
    const c = makeChunk(0, 0);
    addChunk(g, c);
    const rand = seeded(5);
    for (let i = 0; i < 100; i++) g.world.set(Math.floor(rand() * 16), 64 + Math.floor(rand() * 10), Math.floor(rand() * 16), B('cobblestone'));
    give(g.inventory, 'oak_planks', 12);
    give(g.inventory, 'wooden_pickaxe', 1);
    g.inventory.slots[1].damage = 7;
    g.inventory.selected = 1;
    Object.assign(g.player, { x: 3.5, y: 70, z: -2.25, yaw: 1, pitch: -0.5, health: 17 });
    g.time = 9000;
    const saved = JSON.parse(JSON.stringify(pack(g)));
    expect(saved.v).toBe(1);
    const r = restore(saved);
    const h = newGame({ save: r });
    expect(h.seed).toBe(g.seed);
    expect(h.time).toBe(9000);
    expect(h.player).toMatchObject({ x: 3.5, y: 70, z: -2.25, yaw: 1, pitch: -0.5, health: 17 });
    expect(h.inventory.slots).toEqual(g.inventory.slots);
    expect(h.inventory.selected).toBe(1);
    const d = makeChunk(0, 0);
    addChunk(h, d);
    expect(d.ids).toEqual(c.ids);
    expect(packEdits(d)).toEqual(packEdits(c));
  });

  it('an edit in an unloaded chunk is applied when the chunk arrives', () => {
    const g = newGame({ seed: 1 });
    const c = makeChunk(40, 40);
    addChunk(g, c);
    g.world.set(40 * 16 + 3, 70, 40 * 16 + 4, B('glass'));
    dropChunk(g, key(40, 40));
    expect(g.world.chunkAt(40, 40)).toBeNull();
    expect(g.edits[key(40, 40)]).toBeTruthy();
    const again = makeChunk(40, 40);
    addChunk(g, again);
    expect(g.world.get(40 * 16 + 3, 70, 40 * 16 + 4)).toBe(B('glass'));
    // and it stays saved, with the chunk's own edits
    expect(pack(g).edits[key(40, 40)]).toEqual(packEdits(again));
  });

  it('a chunk let go of when the player walks away keeps its edits', () => {
    const g = newGame({ seed: 1 });
    g.renderDistance = 2;
    g.player.x = 8;
    g.player.z = 8;
    addChunk(g, makeChunk(9, 0));
    g.world.set(9 * 16, 80, 0, B('dirt'));
    expect(dropFar(g)).toEqual([key(9, 0)]);
    expect(pack(g).edits[key(9, 0)]).toBeTruthy();
  });

  it('a save from a newer version is refused with a fresh game', () => {
    expect(restore({ v: 2, seed: 5 })).toBeNull();
    expect(restore(null)).toBeNull();
    expect(restore({ v: 1 })).toBeNull(); // (no seed: nothing to come back to)
    const g = newGame({ seed: 3, save: restore({ v: 2, seed: 5 }) });
    expect(g.seed).toBe(3);
  });

  it('a seed alone (Phase 1’s save) still comes back', () => {
    const r = restore({ seed: 77 });
    expect(newGame({ save: r }).seed).toBe(77);
  });
});
