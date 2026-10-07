import { describe, expect, it } from 'vitest';
import { byName } from './blocks';
import { makeChunk } from './chunk';
import { FACING, addChunk, breakBlock, drain, dropHeld, newGame, placeBlock, tick } from './game';
import { FACE } from './mesher';

const idle = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, yaw: 0, pitch: 0 };
const B = (n) => byName.get(n).id;

// a flat world: stone to 63, round the origin, the player standing on it
function flat() {
  const g = newGame({ seed: 1 });
  g.world.chunks.clear();
  for (let cx = -1; cx <= 1; cx++)
    for (let cz = -1; cz <= 1; cz++) {
      const c = makeChunk(cx, cz);
      for (let y = 0; y <= 63; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) c.ids[(y * 16 + z) * 16 + x] = B('stone');
      addChunk(g, c);
    }
  // (at rest a body still falls 0.0784 a tick into the floor: that is what keeps it on the ground)
  Object.assign(g.player, { x: 0.5, y: 64, z: 0.5, vx: 0, vy: -0.0784, vz: 0, fallFrom: 64, onGround: true });
  g.prev = { x: 0.5, y: 64, z: 0.5 };
  return g;
}
// the yaw and pitch from the eye to a cell's middle
const aim = (g, x, y, z) => {
  const e = { x: g.player.x, y: g.player.y + 1.62, z: g.player.z };
  const dx = x + 0.5 - e.x;
  const dy = y + 0.5 - e.y;
  const dz = z + 0.5 - e.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
};
const hold = (g, n, input) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(...tick(g, input));
  return out;
};

describe('digging', () => {
  it('aims the cursor from the eye every tick', () => {
    const g = flat();
    g.world.set(0, 64, 2, B('dirt'));
    tick(g, { ...idle, ...aim(g, 0, 64, 2) });
    expect(g.cursor).toMatchObject({ x: 0, y: 64, z: 2 });
    tick(g, { ...idle, pitch: Math.PI / 2 });
    expect(g.cursor).toBeNull();
  });

  it('dirt by hand goes after 15 ticks of holding, and drops itself', () => {
    const g = flat();
    g.world.set(0, 64, 2, B('dirt'));
    const look = { ...idle, ...aim(g, 0, 64, 2), attack: true };
    hold(g, 14, look);
    expect(g.world.get(0, 64, 2)).toBe(B('dirt'));
    expect(g.breaking.progress).toBeGreaterThan(0.9);
    const events = hold(g, 1, look);
    expect(g.world.get(0, 64, 2)).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'break', id: B('dirt'), x: 0, y: 64, z: 2 }));
    expect(g.drops).toHaveLength(1);
    expect(g.drops[0]).toMatchObject({ item: 'dirt', count: 1 });
    // the break is logged as an edit, so it saves
    expect(g.world.chunkAt(0, 0).edits.size).toBe(1);
  });

  it('releasing the button resets the crack', () => {
    const g = flat();
    g.world.set(0, 64, 2, B('dirt'));
    const look = { ...idle, ...aim(g, 0, 64, 2) };
    hold(g, 10, { ...look, attack: true });
    hold(g, 1, look);
    expect(g.breaking).toBeNull();
    hold(g, 10, { ...look, attack: true });
    expect(g.world.get(0, 64, 2)).toBe(B('dirt'));
  });

  it('stone by hand drops nothing; with a pickaxe it drops cobblestone and wears the pickaxe', () => {
    const g = flat();
    g.world.set(0, 64, 2, B('stone'));
    hold(g, 151, { ...idle, ...aim(g, 0, 64, 2), attack: true });
    expect(g.world.get(0, 64, 2)).toBe(0);
    expect(g.drops).toHaveLength(0);
    g.world.set(0, 64, 2, B('stone'));
    g.inventory.slots[0] = { item: 'wooden_pickaxe', count: 1, damage: 0 };
    hold(g, 30, { ...idle, ...aim(g, 0, 64, 2), attack: true });
    expect(g.drops.map((d) => d.item)).toEqual(['cobblestone']);
    expect(g.inventory.slots[0].damage).toBe(1);
  });

  it('breaking damages the tool and a tool at 0 is gone', () => {
    const g = flat();
    g.world.set(0, 64, 2, B('dirt'));
    g.inventory.slots[0] = { item: 'wooden_shovel', count: 1, damage: 58 };
    const events = hold(g, 10, { ...idle, ...aim(g, 0, 64, 2), attack: true });
    expect(g.world.get(0, 64, 2)).toBe(0);
    expect(g.inventory.slots[0]).toBeNull();
    expect(events.some((e) => e.type === 'tool_break')).toBe(true);
  });

  it('bedrock never breaks', () => {
    const g = flat();
    g.world.set(0, 64, 2, B('bedrock'));
    hold(g, 400, { ...idle, ...aim(g, 0, 64, 2), attack: true });
    expect(g.world.get(0, 64, 2)).toBe(B('bedrock'));
  });
});

describe('dropped items', () => {
  it('a dropped item is picked up and stacks', () => {
    const g = flat();
    g.inventory.slots[0] = { item: 'dirt', count: 5, damage: 0 };
    g.drops.push({ item: 'dirt', count: 1, damage: 0, x: 0.5, y: 64.2, z: 1.2, vx: 0, vy: 0, vz: 0, age: 0 });
    const events = hold(g, 12, idle);
    expect(g.drops).toHaveLength(0);
    expect(g.inventory.slots[0].count).toBe(6);
    expect(events.some((e) => e.type === 'pickup')).toBe(true);
  });

  it('waits 10 ticks before it can be picked up, and is gone at 6000', () => {
    const g = flat();
    g.drops.push({ item: 'dirt', count: 1, damage: 0, x: 0.5, y: 64.2, z: 0.5, vx: 0, vy: 0, vz: 0, age: 0 });
    hold(g, 9, idle);
    expect(g.drops).toHaveLength(1);
    const far = { item: 'stone', count: 1, damage: 0, x: 8.5, y: 64, z: 8.5, vx: 0, vy: 0, vz: 0, age: 5998 };
    g.drops.push(far);
    hold(g, 3, idle);
    expect(g.drops.includes(far)).toBe(false);
  });

  it('two drops of the same thing side by side merge', () => {
    const g = flat();
    g.drops.push({ item: 'dirt', count: 2, damage: 0, x: 6.5, y: 64, z: 6.5, vx: 0, vy: 0, vz: 0, age: 0 }, { item: 'dirt', count: 3, damage: 0, x: 6.7, y: 64, z: 6.5, vx: 0, vy: 0, vz: 0, age: 0 });
    hold(g, 2, idle);
    expect(g.drops).toHaveLength(1);
    expect(g.drops[0].count).toBe(5);
  });

  it('falls to the ground', () => {
    const g = flat();
    g.drops.push({ item: 'dirt', count: 1, damage: 0, x: 6.5, y: 70, z: 6.5, vx: 0, vy: 0, vz: 0, age: 0 });
    hold(g, 60, idle);
    expect(g.drops[0].y).toBeCloseTo(64, 5);
  });
});

describe('building', () => {
  it('places the held block against the face under the cursor, and uses one', () => {
    const g = flat();
    g.inventory.slots[0] = { item: 'dirt', count: 3, damage: 0 };
    expect(placeBlock(g, { x: 0, y: 63, z: 3, face: FACE.top, t: 3 })).toBe(true);
    expect(g.world.get(0, 64, 3)).toBe(B('dirt'));
    expect(g.inventory.slots[0].count).toBe(2);
    expect(drain(g)).toContainEqual(expect.objectContaining({ type: 'place', id: B('dirt') }));
  });

  it('places by the use button on the cursor’s block', () => {
    const g = flat();
    g.inventory.slots[0] = { item: 'dirt', count: 3, damage: 0 };
    g.world.set(0, 64, 2, B('stone'));
    tick(g, { ...idle, ...aim(g, 0, 64, 2), use: true });
    expect(g.world.get(0, 65, 2) || g.world.get(0, 64, 1)).toBe(B('dirt'));
  });

  it('placing inside the player is refused', () => {
    const g = flat();
    g.inventory.slots[0] = { item: 'dirt', count: 3, damage: 0 };
    expect(placeBlock(g, { x: 0, y: 63, z: 0, face: FACE.top, t: 1.6 })).toBe(false);
    expect(g.world.get(0, 64, 0)).toBe(0);
    expect(g.inventory.slots[0].count).toBe(3);
    // a flower is no body to stand in
    g.inventory.slots[0] = { item: 'poppy', count: 1, damage: 0 };
    g.world.set(0, 63, 0, B('grass_block'));
    expect(placeBlock(g, { x: 0, y: 63, z: 0, face: FACE.top, t: 1.7 })).toBe(true);
  });

  it('placing at 4.6 blocks is refused', () => {
    const g = flat();
    g.inventory.slots[0] = { item: 'dirt', count: 3, damage: 0 };
    expect(placeBlock(g, { x: 0, y: 63, z: 4, face: FACE.top, t: 4.6 })).toBe(false);
  });

  it('places nothing with an empty hand or a tool, and plants only where they grow', () => {
    const g = flat();
    expect(placeBlock(g, { x: 0, y: 63, z: 3, face: FACE.top, t: 3 })).toBe(false);
    g.inventory.slots[0] = { item: 'stone_axe', count: 1, damage: 0 };
    expect(placeBlock(g, { x: 0, y: 63, z: 3, face: FACE.top, t: 3 })).toBe(false);
    g.inventory.slots[0] = { item: 'oak_sapling', count: 1, damage: 0 };
    expect(placeBlock(g, { x: 0, y: 63, z: 3, face: FACE.top, t: 3 })).toBe(false);
    g.world.set(0, 63, 3, B('dirt'));
    expect(placeBlock(g, { x: 0, y: 63, z: 3, face: FACE.top, t: 3 })).toBe(true);
  });

  it('a placed block replaces tall grass rather than sitting on it', () => {
    const g = flat();
    g.world.set(0, 64, 3, B('short_grass'));
    g.inventory.slots[0] = { item: 'dirt', count: 1, damage: 0 };
    expect(placeBlock(g, { x: 0, y: 64, z: 3, face: FACE.top, t: 3 })).toBe(true);
    expect(g.world.get(0, 64, 3)).toBe(B('dirt'));
    expect(g.world.get(0, 65, 3)).toBe(0);
  });

  it('a torch put on tall grass stands on the block under it', () => {
    const g = flat();
    g.world.set(0, 64, 3, B('short_grass'));
    g.inventory.slots[0] = { item: 'torch', count: 1, damage: 0 };
    expect(placeBlock(g, { x: 0, y: 64, z: 3, face: FACE.north, t: 3 })).toBe(true);
    expect(g.world.get(0, 64, 3)).toBe(B('torch'));
    expect(g.world.getState(0, 64, 3)).toBe(FACE.top);
  });

  it('a torch hangs from the side of a block, and not from under one', () => {
    const g = flat();
    g.world.set(0, 65, 3, B('stone'));
    g.inventory.slots[0] = { item: 'torch', count: 2, damage: 0 };
    expect(placeBlock(g, { x: 0, y: 65, z: 3, face: FACE.north, t: 3 })).toBe(true);
    expect(g.world.getState(0, 65, 2)).toBe(FACE.north);
    expect(placeBlock(g, { x: 0, y: 65, z: 3, face: FACE.bottom, t: 3 })).toBe(false);
  });

  it('logs take the axis of the face they’re put against', () => {
    const g = flat();
    g.inventory.slots[0] = { item: 'oak_log', count: 3, damage: 0 };
    placeBlock(g, { x: 0, y: 63, z: 3, face: FACE.top, t: 3 });
    expect(g.world.getState(0, 64, 3)).toBe(0);
    placeBlock(g, { x: 0, y: 64, z: 3, face: FACE.east, t: 3 });
    expect(g.world.getState(1, 64, 3)).toBe(1);
    placeBlock(g, { x: 0, y: 64, z: 3, face: FACE.north, t: 3 });
    expect(g.world.getState(0, 64, 2)).toBe(2);
  });

  it('a furnace faces the player who puts it down', () => {
    const g = flat();
    g.inventory.slots[0] = { item: 'furnace', count: 1, damage: 0 };
    g.player.yaw = Math.PI; // looking south (+z): it faces back north at them
    placeBlock(g, { x: 0, y: 63, z: 3, face: FACE.top, t: 3 });
    expect(g.world.getState(0, 64, 3)).toBe(FACING.north);
    g.inventory.slots[0] = { item: 'furnace', count: 1, damage: 0 };
    g.player.yaw = Math.PI / 2; // looking west: it faces east
    placeBlock(g, { x: -3, y: 63, z: 0, face: FACE.top, t: 3 });
    expect(g.world.getState(-3, 64, 0)).toBe(FACING.east);
  });
});

describe('using and dropping', () => {
  it('using a crafting table opens it rather than building on it; sneaking builds', () => {
    const g = flat();
    g.world.set(0, 64, 2, B('crafting_table'));
    g.inventory.slots[0] = { item: 'dirt', count: 3, damage: 0 };
    const events = tick(g, { ...idle, ...aim(g, 0, 64, 2), use: true });
    expect(events).toContainEqual({ type: 'open', what: 'table', x: 0, y: 64, z: 2 });
    expect(g.inventory.slots[0].count).toBe(3);
    tick(g, { ...idle, ...aim(g, 0, 64, 2), use: true, sneak: true });
    expect(g.inventory.slots[0].count).toBe(2);
  });

  it('Q drops one of what’s held, thrown the way the player looks; with all, the stack', () => {
    const g = flat();
    g.inventory.slots[0] = { item: 'dirt', count: 3, damage: 0 };
    g.player.yaw = 0;
    dropHeld(g);
    expect(g.inventory.slots[0].count).toBe(2);
    expect(g.drops).toHaveLength(1);
    expect(g.drops[0]).toMatchObject({ item: 'dirt', count: 1 });
    expect(g.drops[0].vz).toBeLessThan(0);
    dropHeld(g, true);
    expect(g.inventory.slots[0]).toBeNull();
    expect(g.drops[1].count).toBe(2);
    // and the player can't take it straight back
    hold(g, 20, idle);
    expect(g.drops.reduce((n, d) => n + d.count, 0)).toBe(3);
  });
});

describe('the bed', () => {
  const bed = (g) => {
    g.inventory.slots[0] = { item: 'red_bed', count: 1, damage: 0 };
    g.player.yaw = Math.PI; // facing south (+z)
    expect(placeBlock(g, { x: 0, y: 63, z: 2, face: FACE.top, t: 2 })).toBe(true);
  };

  it('goes down as two blocks, the head the way the player faces', () => {
    const g = flat();
    bed(g);
    expect(g.world.get(0, 64, 2)).toBe(B('red_bed'));
    expect(g.world.get(0, 64, 3)).toBe(B('red_bed'));
    expect(g.world.getState(0, 64, 2) & 8).toBe(0);
    expect(g.world.getState(0, 64, 3) & 8).toBe(8);
    expect(g.inventory.slots[0]).toBeNull();
  });

  it('needs room for its head', () => {
    const g = flat();
    g.world.set(0, 64, 3, B('stone'));
    g.inventory.slots[0] = { item: 'red_bed', count: 1, damage: 0 };
    g.player.yaw = Math.PI;
    expect(placeBlock(g, { x: 0, y: 63, z: 2, face: FACE.top, t: 2 })).toBe(false);
  });

  it('breaking either half takes the bed, and drops one', () => {
    const g = flat();
    bed(g);
    breakBlock(g, 0, 64, 3);
    expect(g.world.get(0, 64, 2)).toBe(0);
    expect(g.world.get(0, 64, 3)).toBe(0);
    expect(g.drops.map((d) => d.item)).toEqual(['red_bed']);
  });

  it('sleeping at night sets morning and the spawn', () => {
    const g = flat();
    bed(g);
    g.time = 24000 * 3 + 14000;
    const events = tick(g, { ...idle, ...aim(g, 0, 64, 2), use: true });
    expect(events).toContainEqual(expect.objectContaining({ type: 'sleep' }));
    expect(g.time).toBe(24000 * 4);
    expect(g.spawn).toMatchObject({ x: expect.any(Number), y: 64 });
    expect(Math.abs(g.spawn.x - 0.5) + Math.abs(g.spawn.z - 2.5)).toBeLessThanOrEqual(2);
  });

  it('the bed refuses by day', () => {
    const g = flat();
    bed(g);
    g.time = 6000;
    const spawn = g.spawn;
    const events = tick(g, { ...idle, ...aim(g, 0, 64, 2), use: true });
    expect(events).toContainEqual(expect.objectContaining({ type: 'no_sleep' }));
    expect(g.time).toBe(6001);
    expect(g.spawn).toBe(spawn);
  });
});

describe('falling blocks', () => {
  it('sand with air below falls next tick, and settles', () => {
    const g = flat();
    g.world.set(5, 64, 5, B('stone'));
    g.world.set(5, 65, 5, B('sand'));
    breakBlock(g, 5, 64, 5);
    tick(g, idle);
    expect(g.world.get(5, 65, 5)).toBe(0);
    expect(g.world.get(5, 64, 5)).toBe(B('sand'));
    hold(g, 5, idle);
    expect(g.world.get(5, 64, 5)).toBe(B('sand'));
  });

  it('a column of gravel over a hole falls together', () => {
    const g = flat();
    g.world.set(7, 62, 7, 0);
    for (let y = 64; y <= 66; y++) g.world.set(7, y, 7, B('gravel'));
    breakBlock(g, 7, 63, 7);
    hold(g, 10, idle);
    expect([61, 62, 63, 64, 65, 66].map((y) => g.world.get(7, y, 7))).toEqual([B('stone'), B('gravel'), B('gravel'), B('gravel'), 0, 0]);
  });

  it('sand placed over air falls', () => {
    const g = flat();
    g.world.set(2, 64, 5, B('stone'));
    g.inventory.slots[0] = { item: 'sand', count: 1, damage: 0 };
    // against the stone's east face, out over nothing but the floor below
    g.world.set(3, 63, 5, 0);
    expect(placeBlock(g, { x: 2, y: 64, z: 5, face: FACE.east, t: 3 })).toBe(true);
    hold(g, 4, idle);
    expect(g.world.get(3, 64, 5)).toBe(0);
    expect(g.world.get(3, 63, 5)).toBe(B('sand'));
  });
});
