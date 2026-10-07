import { describe, expect, it } from 'vitest';
import { byName } from './blocks';
import { makeChunk } from './chunk';
import { FURNACE_FUEL, SMELTING, makeFurnace, stepFurnace } from './furnace';
import { addChunk, breakBlock, newGame, placeBlock, respawn, tick } from './game';
import { click, close, makeChest, makeFurnaceScreen } from './gui';
import { FACE } from './mesher';
import { pack, restore } from './save';

const idle = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, yaw: 0, pitch: 0 };
const B = (n) => byName.get(n).id;

// a flat world: stone to 63, the player standing on it at the origin
function flat(r = 1) {
  const g = newGame({ seed: 1 });
  g.world.chunks.clear();
  for (let cx = -r; cx <= r; cx++)
    for (let cz = -r; cz <= r; cz++) {
      const c = makeChunk(cx, cz);
      for (let y = 0; y <= 63; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) c.ids[(y * 16 + z) * 16 + x] = B('stone');
      addChunk(g, c);
    }
  Object.assign(g.player, { x: 0.5, y: 64, z: 0.5, vx: 0, vy: -0.0784, vz: 0, fallFrom: 64, onGround: true });
  g.prev = { x: 0.5, y: 64, z: 0.5 };
  return g;
}
const aim = (g, x, y, z) => {
  const e = { x: g.player.x, y: g.player.y + 1.62, z: g.player.z };
  const dx = x + 0.5 - e.x;
  const dy = y + 0.5 - e.y;
  const dz = z + 0.5 - e.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
};
const run = (g, n, input = idle) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(...tick(g, input));
  return out;
};
const st = (item, count = 1) => ({ item, count, damage: 0 });

describe('the furnace', () => {
  it('cooks an item in 200 ticks; coal burns 1600, planks and logs 300, a stick 100', () => {
    expect(FURNACE_FUEL.coal).toBe(1600);
    expect(FURNACE_FUEL.oak_planks).toBe(300);
    expect(FURNACE_FUEL.oak_log).toBe(300);
    expect(FURNACE_FUEL.stick).toBe(100);
    expect(FURNACE_FUEL.lava).toBeUndefined(); // (a lava bucket, once there are buckets)
    expect(SMELTING.iron_ore).toBe('iron_ingot');
    expect(SMELTING.oak_log).toBe('charcoal');
  });

  it('a furnace with coal smelts 8 iron', () => {
    const f = makeFurnace();
    f.slots = [st('iron_ore', 9), st('coal'), null];
    for (let i = 0; i < 199; i++) stepFurnace(f);
    expect(f.slots[2]).toBeNull();
    stepFurnace(f);
    expect(f.slots[2]).toEqual(st('iron_ingot'));
    for (let i = 0; i < 1400; i++) stepFurnace(f);
    expect(f.slots[2]).toEqual(st('iron_ingot', 8));
    expect(f.slots[1]).toBeNull();
    stepFurnace(f);
    expect(f.burn).toBe(0);
    // the ninth stays raw: its progress falls back two a tick
    for (let i = 0; i < 400; i++) stepFurnace(f);
    expect(f.slots[0]).toEqual(st('iron_ore'));
    expect(f.cook).toBe(0);
  });

  it('won’t light without something to cook, or with a full output', () => {
    const f = makeFurnace();
    f.slots = [null, st('coal'), null];
    stepFurnace(f);
    expect(f.burn).toBe(0);
    expect(f.slots[1]).toEqual(st('coal'));
    f.slots = [st('iron_ore'), st('coal'), st('iron_ingot', 64)];
    stepFurnace(f);
    expect(f.burn).toBe(0);
    f.slots = [st('dirt'), st('coal'), null];
    stepFurnace(f);
    expect(f.burn).toBe(0);
  });

  it('opens on use, glows while it burns, and goes out', () => {
    const g = flat();
    g.world.set(0, 64, -2, B('furnace'));
    const events = run(g, 1, { ...idle, ...aim(g, 0, 64, -2), use: true });
    expect(events).toContainEqual(expect.objectContaining({ type: 'open', what: 'furnace', x: 0, y: 64, z: -2 }));
    const f = g.furnaces['0,64,-2'];
    f.slots = [st('sand'), st('oak_planks'), null];
    run(g, 2);
    expect(g.world.get(0, 64, -2)).toBe(B('lit_furnace'));
    expect(g.world.getState(0, 64, -2)).toBe(0);
    run(g, 200);
    expect(f.slots[2]).toEqual(st('glass'));
    // the planks burn 300 ticks, then it goes out
    run(g, 100);
    expect(g.world.get(0, 64, -2)).toBe(B('furnace'));
  });

  it('broken, it spills what it holds', () => {
    const g = flat();
    g.world.set(0, 64, -2, B('furnace'));
    run(g, 1, { ...idle, ...aim(g, 0, 64, -2), use: true });
    g.furnaces['0,64,-2'].slots = [st('iron_ore', 3), st('coal', 2), st('iron_ingot')];
    g.inventory.slots[0] = st('wooden_pickaxe');
    breakBlock(g, 0, 64, -2);
    expect(g.furnaces['0,64,-2']).toBeUndefined();
    expect(g.drops.map((d) => `${d.item}×${d.count}`).sort()).toEqual(['coal×2', 'furnace×1', 'iron_ingot×1', 'iron_ore×3']);
  });

  it('the screen: fuel and ore go where they belong on a shift-click; the output only gives', () => {
    const g = flat();
    const f = makeFurnace();
    const s = makeFurnaceScreen(f);
    g.inventory.slots[0] = st('iron_ore', 5);
    g.inventory.slots[1] = st('coal', 3);
    g.inventory.slots[2] = st('dirt', 4);
    click(s, g.inventory, { area: 'inv', index: 0, shift: true });
    click(s, g.inventory, { area: 'inv', index: 1, shift: true });
    expect(f.slots[0]).toEqual(st('iron_ore', 5));
    expect(f.slots[1]).toEqual(st('coal', 3));
    // dirt neither cooks nor burns: hotbar to the rest
    click(s, g.inventory, { area: 'inv', index: 2, shift: true });
    expect(g.inventory.slots[9]).toEqual(st('dirt', 4));
    // nothing goes into the output
    click(s, g.inventory, { area: 'inv', index: 9 });
    click(s, g.inventory, { area: 'furnace', index: 2 });
    expect(f.slots[2]).toBeNull();
    expect(s.cursor).toEqual(st('dirt', 4));
    close(s, g.inventory);
    f.slots[2] = st('iron_ingot', 2);
    click(s, g.inventory, { area: 'furnace', index: 2 });
    expect(s.cursor).toEqual(st('iron_ingot', 2));
    expect(f.slots[2]).toBeNull();
  });
});

describe('the chest', () => {
  it('a chest holds 27 and saves', () => {
    const g = flat();
    g.world.set(0, 64, -2, B('chest'));
    const events = run(g, 1, { ...idle, ...aim(g, 0, 64, -2), use: true });
    expect(events).toContainEqual(expect.objectContaining({ type: 'open', what: 'chest', x: 0, y: 64, z: -2 }));
    const slots = g.chests['0,64,-2'];
    expect(slots).toHaveLength(27);
    const s = makeChest(slots);
    g.inventory.slots[0] = st('cobblestone', 64);
    g.inventory.slots[1] = st('diamond', 3);
    click(s, g.inventory, { area: 'inv', index: 0, shift: true });
    click(s, g.inventory, { area: 'inv', index: 1 });
    click(s, g.inventory, { area: 'chest', index: 26 });
    expect(slots[0]).toEqual(st('cobblestone', 64));
    expect(slots[26]).toEqual(st('diamond', 3));
    expect(g.inventory.slots[0]).toBeNull();
    // through a save and back
    const h = newGame({ save: restore(JSON.parse(JSON.stringify(pack(g)))) });
    expect(h.chests['0,64,-2'][26]).toEqual(st('diamond', 3));
    // shift-click takes it back out
    click(s, g.inventory, { area: 'chest', index: 26, shift: true });
    expect(g.inventory.slots.some((x) => x?.item === 'diamond' && x.count === 3)).toBe(true);
  });

  it('broken, it spills what it holds', () => {
    const g = flat();
    g.world.set(0, 64, -2, B('chest'));
    run(g, 1, { ...idle, ...aim(g, 0, 64, -2), use: true });
    g.chests['0,64,-2'][5] = st('bread', 4);
    breakBlock(g, 0, 64, -2);
    expect(g.chests['0,64,-2']).toBeUndefined();
    expect(g.drops.map((d) => d.item).sort()).toEqual(['bread', 'chest']);
  });
});

describe('hunger', () => {
  it('starts full: 20 hunger, 5 saturation', () => {
    const g = newGame({ seed: 1 });
    expect(g.player).toMatchObject({ hunger: 20, saturation: 5, exhaustion: 0 });
  });

  it('sprinting 40 m costs 1 hunger', () => {
    const g = flat(4);
    g.player.saturation = 0;
    const start = g.player.z;
    // run north along the floor until 40 m are behind
    let n = 0;
    while (start - g.player.z < 40 && n++ < 400) tick(g, { ...idle, forward: 1, sprint: true });
    expect(start - g.player.z).toBeGreaterThanOrEqual(40);
    expect(g.player.hunger).toBe(19);
  });

  it('saturation goes first', () => {
    const g = flat(4);
    g.player.saturation = 2;
    let n = 0;
    while (0.5 - g.player.z < 41 && n++ < 400) tick(g, { ...idle, forward: 1, sprint: true });
    expect(g.player.hunger).toBe(20);
    expect(g.player.saturation).toBe(1);
  });

  it('a jump costs 0.05, a sprinting jump 0.2', () => {
    const g = flat();
    g.player.exhaustion = 0;
    tick(g, { ...idle, jump: true });
    expect(g.player.exhaustion).toBeCloseTo(0.05);
  });

  it('health regenerates at hunger 18', () => {
    const g = flat();
    Object.assign(g.player, { health: 10, hunger: 18, saturation: 0 });
    run(g, 79);
    expect(g.player.health).toBe(10);
    run(g, 1);
    expect(g.player.health).toBe(11);
    // healing tires: 6 exhaustion a heart, a point of hunger the next tick
    expect(g.player.exhaustion).toBeCloseTo(6);
    run(g, 1);
    expect(g.player).toMatchObject({ hunger: 17, exhaustion: expect.closeTo(2) });
    const h = flat();
    Object.assign(h.player, { health: 10, hunger: 17, saturation: 0 });
    run(h, 200);
    expect(h.player.health).toBe(10);
  });

  it('full and saturated, it heals fast: a heart every 10 ticks', () => {
    const g = flat();
    Object.assign(g.player, { health: 10, hunger: 20, saturation: 5 });
    run(g, 10);
    expect(g.player.health).toBeCloseTo(10 + 5 / 6);
  });

  it('starving hurts every 80 ticks, down to 1', () => {
    const g = flat();
    Object.assign(g.player, { health: 3, hunger: 0, saturation: 0 });
    const events = run(g, 80);
    expect(g.player.health).toBe(2);
    expect(events).toContainEqual(expect.objectContaining({ type: 'hurt', cause: 'starve' }));
    run(g, 400);
    expect(g.player.health).toBe(1);
  });

  it('eating bread: use held 32 ticks, 5 hunger and 6 saturation', () => {
    const g = flat();
    Object.assign(g.player, { hunger: 10, saturation: 0 });
    g.inventory.slots[0] = st('bread', 2);
    const down = { ...idle, pitch: -Math.PI / 2, use: true, using: true };
    run(g, 1, down);
    run(g, 30, { ...down, use: false });
    expect(g.player.hunger).toBe(10);
    const events = run(g, 1, { ...down, use: false });
    expect(g.player.hunger).toBe(15);
    expect(g.player.saturation).toBe(6);
    expect(g.inventory.slots[0]).toEqual(st('bread', 1));
    expect(events).toContainEqual(expect.objectContaining({ type: 'eat', item: 'bread' }));
    // let go early and nothing is eaten
    run(g, 10, down);
    run(g, 40);
    expect(g.inventory.slots[0]).toEqual(st('bread', 1));
  });

  it('full, the player won’t eat', () => {
    const g = flat();
    g.inventory.slots[0] = st('bread', 2);
    run(g, 40, { ...idle, pitch: -Math.PI / 2, use: true, using: true });
    expect(g.inventory.slots[0]).toEqual(st('bread', 2));
  });

  it('keeps hunger, saturation and exhaustion through a save', () => {
    const g = flat();
    Object.assign(g.player, { hunger: 13, saturation: 2.5, exhaustion: 1.5 });
    const h = newGame({ save: restore(JSON.parse(JSON.stringify(pack(g)))) });
    expect(h.player).toMatchObject({ hunger: 13, saturation: 2.5, exhaustion: 1.5 });
  });
});

describe('death', () => {
  it('death drops the inventory and respawns at the bed', () => {
    const g = flat();
    // a bed, slept in
    g.inventory.slots[0] = st('red_bed');
    g.player.yaw = Math.PI;
    expect(placeBlock(g, { x: 0, y: 63, z: 2, face: FACE.top, t: 2 })).toBe(true);
    g.time = 14000;
    run(g, 1, { ...idle, ...aim(g, 0, 64, 2), use: true });
    const bedSpawn = { ...g.spawn };
    // walk off, with things
    Object.assign(g.player, { x: 6.5, z: 6.5 });
    g.inventory.slots[0] = st('cobblestone', 20);
    g.inventory.slots[7] = st('iron_pickaxe');
    g.inventory.slots[30] = st('bread', 3);
    g.player.health = 0;
    const events = run(g, 1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'died' }));
    expect(g.dead).toBe(true);
    expect(g.inventory.slots.every((s) => s === null)).toBe(true);
    expect(g.drops.map((d) => d.item).sort()).toEqual(['bread', 'cobblestone', 'iron_pickaxe']);
    // dead, the hands and feet don't work
    run(g, 5, { ...idle, forward: 1 });
    expect(g.player.x).toBe(6.5);
    respawn(g);
    expect(g.dead).toBe(false);
    expect(g.player).toMatchObject({ x: bedSpawn.x, y: bedSpawn.y, z: bedSpawn.z, health: 20, hunger: 20, saturation: 5, air: 300 });
  });

  it('with the bed gone, the world’s spawn, and a word why', () => {
    const g = flat();
    g.inventory.slots[0] = st('red_bed');
    g.player.yaw = Math.PI;
    placeBlock(g, { x: 0, y: 63, z: 2, face: FACE.top, t: 2 });
    g.time = 14000;
    run(g, 1, { ...idle, ...aim(g, 0, 64, 2), use: true });
    breakBlock(g, 0, 64, 2);
    g.player.health = 0;
    run(g, 1);
    const events = respawn(g);
    expect(events).toContainEqual(expect.objectContaining({ type: 'no_bed' }));
    expect(g.player).toMatchObject({ x: g.home.x, z: g.home.z });
  });
});
