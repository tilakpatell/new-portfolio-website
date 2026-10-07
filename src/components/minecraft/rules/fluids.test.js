import { describe, expect, it } from 'vitest';
import { byName } from './blocks';
import { makeChunk } from './chunk';
import { addChunk, newGame, setBlock, tick } from './game';
import { FLOW, liquidHeight } from './fluids';

const idle = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, yaw: 0, pitch: 0 };
const B = (n) => byName.get(n).id;

// a flat world, stone to 63, the player well out of the way
function flat() {
  const g = newGame({ seed: 1 });
  g.world.chunks.clear();
  for (let cx = -2; cx <= 2; cx++)
    for (let cz = -2; cz <= 2; cz++) {
      const c = makeChunk(cx, cz);
      for (let y = 0; y <= 63; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) c.ids[(y * 16 + z) * 16 + x] = B('stone');
      addChunk(g, c);
    }
  Object.assign(g.player, { x: 30.5, y: 64, z: 30.5, vx: 0, vy: -0.0784, vz: 0, fallFrom: 64 });
  return g;
}
const run = (g, n) => {
  for (let i = 0; i < n; i++) tick(g, idle);
};
const level = (g, x, y, z) => g.world.getState(x, y, z);

describe('flowing water and lava', () => {
  it('flows as the game’s does: water every 5 ticks to 7 out, lava every 30 to 3', () => {
    expect(FLOW.water).toEqual({ delay: 5, reach: 7 });
    expect(FLOW.lava).toEqual({ delay: 30, reach: 3 });
  });

  it('a source on flat ground reaches 7 blocks out in about 35 ticks, and no further', () => {
    const g = flat();
    setBlock(g, 0, 64, 0, B('water'), 0);
    run(g, 30);
    expect(g.world.get(7, 64, 0)).toBe(0);
    run(g, 12);
    expect(g.world.get(7, 64, 0)).toBe(B('water'));
    expect(level(g, 7, 64, 0)).toBe(7);
    expect(level(g, 3, 64, 0)).toBe(3);
    run(g, 40);
    expect(g.world.get(8, 64, 0)).toBe(0);
    // diagonally it's the steps that count: (3, 4) is 7 away
    expect(level(g, 3, 64, 4)).toBe(7);
  });

  it('water falls before it spreads', () => {
    const g = flat();
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) setBlock(g, x, 70, z, B('stone'));
    setBlock(g, 4, 71, 0, B('water'), 0);
    // the source sits on the edge of a ledge: it falls straight off it to the floor
    setBlock(g, 4, 70, 0, 0);
    run(g, 60);
    expect(g.world.get(4, 64, 0)).toBe(B('water'));
    expect(g.world.get(4, 67, 0)).toBe(B('water'));
    // and spreads out from where it lands, not from the top
    expect(g.world.get(5, 64, 0)).toBe(B('water'));
    expect(g.world.get(5, 71, 0)).toBe(0);
  });

  it('drains away when its source goes', () => {
    const g = flat();
    setBlock(g, 0, 64, 0, B('water'), 0);
    run(g, 50);
    setBlock(g, 0, 64, 0, 0);
    run(g, 80);
    expect(g.world.get(3, 64, 0)).toBe(0);
  });

  it('two sources make a third', () => {
    const g = flat();
    setBlock(g, 0, 64, 0, B('water'), 0);
    setBlock(g, 2, 64, 0, B('water'), 0);
    run(g, 20);
    expect(level(g, 1, 64, 0)).toBe(0);
    expect(g.world.get(1, 64, 0)).toBe(B('water'));
  });

  it('lava flows 3 out, slowly', () => {
    const g = flat();
    setBlock(g, 0, 64, 0, B('lava'), 0);
    run(g, 40);
    expect(g.world.get(2, 64, 0)).toBe(0);
    run(g, 100);
    expect(g.world.get(3, 64, 0)).toBe(B('lava'));
    expect(g.world.get(4, 64, 0)).toBe(0);
  });

  it('water flowing onto a lava source makes obsidian; onto flowing lava, cobblestone', () => {
    const g = flat();
    setBlock(g, 0, 64, 0, B('lava'), 0);
    setBlock(g, 2, 64, 0, B('water'), 0);
    run(g, 20);
    expect(g.world.get(0, 64, 0)).toBe(B('obsidian'));
    const h = flat();
    setBlock(h, 0, 64, 0, B('lava'), 0);
    run(h, 40); // lava out to 1
    setBlock(h, 3, 64, 0, B('water'), 0);
    run(h, 20);
    expect(h.world.get(1, 64, 0)).toBe(B('cobblestone'));
  });

  it('a liquid’s surface stands lower the further it has flowed', () => {
    expect(liquidHeight(0)).toBe(14);
    expect(liquidHeight(7)).toBe(2);
    expect(liquidHeight(8)).toBe(16); // falling: full
  });
});
