import { describe, expect, it, vi } from 'vitest';
import { WORLD_MB } from '../worlds/worlds';
import mc, { KEYS, distanceFor, ticksFor } from './module';
import { newGame, wantedChunks } from './rules/game.js';
import { createStream } from './stream.js';

describe('Minecraft, the world module', () => {
  it('the module has id minecraft, glsl, mb 2 matching WORLD_MB', () => {
    expect(mc).toMatchObject({ id: 'minecraft', shading: 'glsl', mb: 2 });
    expect(WORLD_MB['/dot-matrix/minecraft']).toBe(2);
    expect(typeof mc.create).toBe('function');
    expect(mc.label).toMatch(/Minecraft/);
  });

  it('binds the game’s keys', () => {
    expect(KEYS.forward).toEqual(['KeyW', 'ArrowUp']);
    expect(KEYS.jump).toEqual(['Space']);
    expect(KEYS.sneak).toEqual(['ShiftLeft', 'ShiftRight']);
    expect(KEYS.sprint).toEqual(['ControlLeft', 'ControlRight']);
    expect(KEYS.slot1).toEqual(['Digit1']);
    expect(KEYS.slot9).toEqual(['Digit9']);
    expect(KEYS.pause).toEqual(['Escape']);
  });

  it('the tick accumulator runs at most 4 ticks for a 1 s frame', () => {
    expect(ticksFor(1)).toEqual({ ticks: 4, left: 0 });
    expect(ticksFor(0.04)).toEqual({ ticks: 0, left: 0.04 });
    const r = ticksFor(0.12);
    expect(r.ticks).toBe(2);
    expect(r.left).toBeCloseTo(0.02, 10);
  });

  it('the render distance follows the tier and steps down with the quality', () => {
    expect([distanceFor('high', 0), distanceFor('mid', 0), distanceFor('low', 0)]).toEqual([10, 6, 4]);
    expect([1, 2, 3, 4].map((l) => distanceFor('high', l))).toEqual([8, 6, 4, 4]);
    expect(distanceFor('mid', 1)).toBe(6);
  });
});

// a pool that holds every ask until the test answers it; with cancels off, a
// cancel comes too late and the worker's answer arrives anyway
const fakePool = ({ cancels = true } = {}) => {
  const held = new Map(); // key → { msg, resolve }
  const asked = [];
  return {
    asked,
    held,
    request(name, msg) {
      held.get(msg.key)?.resolve(null);
      asked.push(msg);
      return new Promise((resolve) => held.set(msg.key, { msg, resolve }));
    },
    cancel(name, key) {
      if (!cancels) return;
      held.get(key)?.resolve(null);
      held.delete(key);
    },
    close: vi.fn(),
    // answer what's held (all, or those keys), as the worker would
    async answer(keys = [...held.keys()]) {
      for (const k of keys) {
        const h = held.get(k);
        if (!h) continue;
        held.delete(k);
        h.resolve({ type: 'chunk', key: k, cx: h.msg.cx, cz: h.msg.cz, ids: new Uint16Array(4), state: new Uint8Array(4), light: new Uint8Array(4), meshes: new Array(16).fill(null) });
      }
      await new Promise((r) => setTimeout(r, 0));
    },
  };
};
const fakeChunks = () => ({ setMesh: vi.fn(), drop: vi.fn() });
const cheb = (k, cx, cz) => {
  const [x, z] = k.split(',').map(Number);
  return Math.max(Math.abs(x - cx), Math.abs(z - cz));
};

describe('Minecraft, the chunks through the runtime’s grid and pool', () => {
  const game = (seed = 1) => {
    const g = newGame({ seed });
    g.renderDistance = 4;
    Object.assign(g.player, { x: 40, y: 0, z: -20 });
    return g;
  };

  it('asks for the same chunks as wantedChunks, nearest first, eight at a time', async () => {
    const pool = fakePool();
    const s = createStream({ workers: pool, chunks: fakeChunks() });
    const g = game();
    s.begin(g);
    s.load();
    expect(pool.asked.map((m) => m.key)).toEqual(wantedChunks(g).slice(0, 8));
    for (let i = 0; i < 20 && pool.held.size; i++) await pool.answer();
    expect(new Set(pool.asked.map((m) => m.key))).toEqual(new Set(wantedChunks(g)));
    expect(pool.asked).toHaveLength(81);
    expect(new Set(g.world.chunks.keys())).toEqual(new Set(wantedChunks(g)));
    expect(s.wanted()).toEqual(wantedChunks(g));
  });

  it('drops the chunks dropFar would, more than two past the distance, with their edits kept', async () => {
    const pool = fakePool();
    const chunks = fakeChunks();
    const s = createStream({ workers: pool, chunks });
    const g = game();
    s.begin(g);
    s.load();
    for (let i = 0; i < 20 && pool.held.size; i++) await pool.answer();
    g.player.x += 16 * 5;
    const [pcx, pcz] = [Math.floor(g.player.x / 16), Math.floor(g.player.z / 16)];
    const expected = [...g.world.chunks.keys()].filter((k) => cheb(k, pcx, pcz) > 6).sort();
    expect(expected.length).toBeGreaterThan(0);
    g.world.chunks.get(expected[0]).edits.set(5, [1, 0]);
    s.load();
    expect(chunks.drop.mock.calls.map(([x, z]) => `${x},${z}`).sort()).toEqual(expected);
    expect([...g.world.chunks.keys()].some((k) => cheb(k, pcx, pcz) > 6)).toBe(false);
    expect(g.edits[expected[0]]).toBeTruthy();
  });

  it('a late answer for an older seed is not added', async () => {
    const pool = fakePool({ cancels: false });
    const chunks = fakeChunks();
    const s = createStream({ workers: pool, chunks });
    s.begin(game(1));
    s.load();
    const late = [...pool.held.keys()];
    const g2 = game(2);
    g2.player.x += 16 * 100; // (elsewhere, so the new world asks for other keys)
    s.begin(g2);
    await pool.answer(late);
    expect(g2.world.chunks.size).toBe(0);
    expect(chunks.setMesh).not.toHaveBeenCalled();
  });

  it('a late answer for a chunk let go of is not added', async () => {
    const pool = fakePool({ cancels: false });
    const chunks = fakeChunks();
    const s = createStream({ workers: pool, chunks });
    const g = game();
    s.begin(g);
    s.load();
    const first = pool.asked[0];
    g.player.x += 16 * 20;
    s.load(); // (it's let go of: too far now)
    await pool.answer([first.key]);
    expect(g.world.chunks.has(first.key)).toBe(false);
    expect(chunks.setMesh.mock.calls.some(([x, z]) => `${x},${z}` === first.key)).toBe(false);
  });

  it('dispose closes the pool’s minecraft workers', () => {
    const pool = fakePool();
    const s = createStream({ workers: pool, chunks: fakeChunks() });
    s.dispose();
    expect(pool.close).toHaveBeenCalledWith('minecraft');
  });
});
