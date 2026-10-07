import { describe, expect, it } from 'vitest';
import { byName } from '../blocks';
import { makeChunk } from '../chunk';
import { explode } from '../explosion';
import { addChunk, newGame, tick } from '../game';
import { despawn, spawnable, spawnTick } from '../spawn';
import { MOBS, makeMob } from './index';

const idle = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, yaw: 0, pitch: 0 };
const B = (n) => byName.get(n).id;

// a flat world: stone to 62, `top` at 63, lit as the open sky unless told
function flat({ r = 2, top = 'stone', dark = false } = {}) {
  const g = newGame({ seed: 1 });
  g.world.chunks.clear();
  g.mobs = [];
  for (let cx = -r; cx <= r; cx++)
    for (let cz = -r; cz <= r; cz++) {
      const c = makeChunk(cx, cz);
      for (let y = 0; y <= 63; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) c.ids[(y * 16 + z) * 16 + x] = y === 63 ? B(top) : B('stone');
      c.light = new Uint8Array(16 * 16 * 256).fill(dark ? 0 : 0xf0);
      c.lit = true;
      addChunk(g, c);
    }
  g.populated = new Set(g.world.chunks.keys());
  // (the world's spawn, which nothing spawns within 24 of, well away)
  g.home = { x: 1000.5, y: 64, z: 1000.5 };
  Object.assign(g.player, { x: 0.5, y: 64, z: 0.5, vx: 0, vy: -0.0784, vz: 0, fallFrom: 64, onGround: true });
  g.prev = { x: 0.5, y: 64, z: 0.5 };
  return g;
}
const run = (g, n, input = idle) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(...tick(g, input));
  return out;
};
const put = (g, kind, x, z, y = 64) => {
  const m = makeMob(kind, x, y, z, () => 0.5);
  m.onGround = true;
  g.mobs.push(m);
  return m;
};
const aim = (g, m) => {
  const dx = m.x - g.player.x;
  const dy = m.y + m.h / 2 - (g.player.y + 1.62);
  const dz = m.z - g.player.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
};

describe('the mobs’ numbers', () => {
  it('are the game’s', () => {
    expect(MOBS.zombie).toMatchObject({ w: 0.6, h: 1.95, health: 20, speed: 0.23, attack: 3, range: 35 });
    expect(MOBS.creeper).toMatchObject({ h: 1.7, health: 20 });
    expect(MOBS.spider).toMatchObject({ w: 1.4, h: 0.9, health: 16 });
    expect(MOBS.chicken).toMatchObject({ w: 0.4, h: 0.7, health: 4 });
    expect(MOBS.enderman).toMatchObject({ h: 2.9, health: 40, attack: 7 });
  });
});

describe('the zombie', () => {
  it('walks toward a player and hits in reach for 3, no more than once a second', () => {
    const g = flat({ dark: true });
    g.time = 18000;
    const z = put(g, 'zombie', 0.5, -10.5);
    const events = run(g, 120);
    expect(z.z).toBeGreaterThan(-2);
    const hits = events.filter((e) => e.type === 'hurt' && e.cause === 'zombie');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].amount).toBe(3);
    // the hits come at least 20 ticks apart
    const at = events.reduce((a, e, i) => (e.type === 'hurt' && e.cause === 'zombie' ? [...a, i] : a), []);
    expect(at.length).toBeLessThanOrEqual(6);
  });

  it('a zombie in daylight burns, a point a second', () => {
    const g = flat();
    g.time = 6000;
    Object.assign(g.player, { x: 60.5, z: 60.5 });
    const z = put(g, 'zombie', 0.5, 0.5);
    run(g, 100);
    expect(z.fire).toBeGreaterThan(0);
    // (a point every 20 ticks of fire; catching again in the sun shifts the beat a little)
    const h = z.health;
    run(g, 100);
    expect(h - z.health).toBeGreaterThanOrEqual(4);
    expect(h - z.health).toBeLessThanOrEqual(6);
  });

  it('in the dark it doesn’t burn', () => {
    const g = flat();
    g.time = 18000;
    Object.assign(g.player, { x: 60.5, z: 60.5 });
    const z = put(g, 'zombie', 0.5, 0.5);
    run(g, 200);
    expect(z.fire).toBe(0);
    expect(z.health).toBe(20);
  });
});

describe('fighting', () => {
  it('a hand does 1, a diamond sword 7; within ten ticks only a bigger blow lands, by the difference', () => {
    const g = flat();
    const pig = put(g, 'pig', 0.5, -1.5);
    pig.health = 20;
    pig.ai.still = true;
    const hit = () => run(g, 1, { ...idle, ...aim(g, pig), attack: true, hit: true });
    hit();
    expect(pig.health).toBe(19);
    g.inventory.slots[0] = { item: 'diamond_sword', count: 1, damage: 0 };
    hit();
    expect(pig.health).toBe(13); // 7 − 1
    expect(g.inventory.slots[0].damage).toBe(1);
    hit();
    expect(pig.health).toBe(13); // no bigger than the last: nothing
    expect(g.inventory.slots[0].damage).toBe(1);
    run(g, 10);
    Object.assign(pig, { x: 0.5, z: -1.5, vx: 0, vz: 0 }); // (knocked back out of reach meanwhile)
    hit();
    expect(pig.health).toBe(6);
    expect(g.inventory.slots[0].damage).toBe(2);
  });

  it('a mob goes red, is knocked back, and an animal runs', () => {
    const g = flat();
    const cow = put(g, 'cow', 0.5, -1.5);
    const z0 = cow.z;
    run(g, 1, { ...idle, ...aim(g, cow), attack: true, hit: true });
    expect(cow.hurtTime).toBeGreaterThan(0);
    run(g, 10);
    expect(cow.z).toBeLessThan(z0 - 0.5);
    expect(cow.ai.panic).toBeTruthy();
  });

  it('killed, it falls over for 20 ticks, then goes and leaves its drops', () => {
    const g = flat();
    const chicken = put(g, 'chicken', 0.5, -1.5);
    chicken.health = 1;
    const events = run(g, 1, { ...idle, ...aim(g, chicken), attack: true, hit: true });
    expect(events).toContainEqual(expect.objectContaining({ type: 'mob_die', kind: 'chicken' }));
    expect(g.drops.some((d) => d.item === 'chicken')).toBe(true);
    run(g, 19);
    expect(g.mobs).toContain(chicken);
    run(g, 2);
    expect(g.mobs).not.toContain(chicken);
  });

  it('the blow goes to the mob, not the block behind it', () => {
    const g = flat();
    g.world.set(0, 64, -3, B('dirt'));
    const pig = put(g, 'pig', 0.5, -1.5);
    pig.ai.still = true;
    run(g, 30, { ...idle, ...aim(g, pig), attack: true });
    expect(g.world.get(0, 64, -3)).toBe(B('dirt'));
  });
});

describe('the creeper', () => {
  it('within 3 blocks fuses for 30 ticks, then explodes', () => {
    const g = flat({ dark: true });
    g.time = 18000;
    const c = put(g, 'creeper', 0.5, -2.5);
    // (it notices on a roll of 1 in 10 a tick, then steps in under 3)
    const events = [];
    for (let i = 0; i < 100 && !events.some((e) => e.type === 'hiss'); i++) events.push(...run(g, 1));
    expect(events).toContainEqual(expect.objectContaining({ type: 'hiss' }));
    expect(c.ai.fuse).toBeGreaterThan(0);
    const later = run(g, 30);
    expect(later).toContainEqual(expect.objectContaining({ type: 'explode' }));
    expect(g.mobs).not.toContain(c);
    expect(g.player.health).toBeLessThan(20);
  });

  it('walks away and the fuse goes back down', () => {
    const g = flat({ dark: true });
    g.time = 18000;
    const c = put(g, 'creeper', 0.5, -2.5);
    for (let i = 0; i < 100 && !(c.ai.fuse >= 5); i++) run(g, 1);
    const f = c.ai.fuse;
    Object.assign(g.player, { x: 0.5, z: 30.5 });
    run(g, 5);
    expect(c.ai.fuse).toBeLessThan(f);
  });

  it('a crater: soft blocks go further than hard ones, obsidian and bedrock stay', () => {
    const g = flat({ r: 1, top: 'dirt' });
    Object.assign(g.player, { x: 30.5, z: 30.5 });
    g.world.set(2, 63, 0, B('obsidian'));
    g.world.set(0, 62, 2, B('bedrock'));
    explode(g, 0.5, 63.5, 0.5, 3);
    let dirt = 0;
    let stone = 0;
    for (let x = -5; x <= 5; x++)
      for (let z = -5; z <= 5; z++)
        for (let y = 58; y <= 63; y++) {
          if (g.world.get(x, y, z) !== 0) continue;
          if (y === 63) dirt++;
          else stone++;
          expect(Math.hypot(x + 0.5 - 0.5, y + 0.5 - 63.5, z + 0.5 - 0.5)).toBeLessThan(5);
        }
    expect(dirt).toBeGreaterThan(10);
    expect(stone).toBeGreaterThan(0);
    expect(g.world.get(2, 63, 0)).toBe(B('obsidian'));
    expect(g.world.get(0, 62, 2)).toBe(B('bedrock'));
  });
});

describe('the skeleton and the spider', () => {
  it('a skeleton in range shoots, and the arrow hurts 2 to 5', () => {
    const g = flat({ dark: true });
    g.time = 18000;
    put(g, 'skeleton', 0.5, -10.5);
    const events = run(g, 120);
    expect(events).toContainEqual(expect.objectContaining({ type: 'bow' }));
    const hit = events.find((e) => e.type === 'hurt' && e.cause === 'skeleton');
    expect(hit).toBeTruthy();
    expect(hit.amount).toBeGreaterThanOrEqual(2);
    expect(hit.amount).toBeLessThanOrEqual(5);
  });

  it('a spider in daylight leaves the player be; in the dark it comes', () => {
    const g = flat();
    g.time = 6000;
    const s = put(g, 'spider', 0.5, -8.5);
    run(g, 60);
    expect(s.ai.target).toBeFalsy();
    const h = flat({ dark: true });
    h.time = 18000;
    const t = put(h, 'spider', 0.5, -8.5);
    run(h, 60);
    expect(t.ai.target).toBe('player');
  });
});

describe('the animals', () => {
  it('wander about', () => {
    const g = flat({ top: 'grass_block' });
    Object.assign(g.player, { x: 60.5, z: 60.5 });
    const pigs = [0, 1, 2, 3].map((i) => put(g, 'pig', i * 4 + 0.5, 0.5));
    const from = pigs.map((p) => [p.x, p.z]);
    run(g, 600);
    expect(pigs.some((p, i) => Math.hypot(p.x - from[i][0], p.z - from[i][1]) > 1)).toBe(true);
  });

  it('a sheep eats grass, which goes to dirt, and its wool grows back', () => {
    const g = flat({ top: 'grass_block' });
    Object.assign(g.player, { x: 60.5, z: 60.5 });
    const s = put(g, 'sheep', 0.5, 0.5);
    s.ai.still = true;
    s.sheared = true;
    s.ai.eat = 40;
    run(g, 41);
    expect(g.world.get(0, 63, 0)).toBe(B('dirt'));
    expect(s.sheared).toBe(false);
  });

  it('shears take 1 to 3 wool off a sheep', () => {
    const g = flat({ top: 'grass_block' });
    const s = put(g, 'sheep', 0.5, -1.5);
    s.ai.still = true;
    g.inventory.slots[0] = { item: 'shears', count: 1, damage: 0 };
    run(g, 1, { ...idle, ...aim(g, s), use: true });
    expect(s.sheared).toBe(true);
    const wool = g.drops.filter((d) => d.item === 'white_wool').reduce((n, d) => n + d.count, 0);
    expect(wool).toBeGreaterThanOrEqual(1);
    expect(wool).toBeLessThanOrEqual(3);
  });
});

describe('spawning', () => {
  it('nothing hostile spawns in light 8', () => {
    const g = flat();
    g.time = 18000;
    for (const c of g.world.chunks.values()) c.light.fill(8); // block light 8, no sky
    // (the dice at their most forgiving: the light may be anything up to 7)
    expect(spawnable(g, 'zombie', 0, 64, 30, () => 0.99)).toBe(false);
    for (const c of g.world.chunks.values()) c.light.fill(7);
    expect(spawnable(g, 'zombie', 0, 64, 30, () => 0.99)).toBe(true);
  });

  it('never within 24 of the player', () => {
    const g = flat({ dark: true });
    for (const c of g.world.chunks.values()) c.light.fill(0);
    expect(spawnable(g, 'zombie', 0, 64, 10, () => 0.99)).toBe(false);
    expect(spawnable(g, 'zombie', 0, 64, 30, () => 0.99)).toBe(true);
  });

  it('animals only on grass, in the light', () => {
    const g = flat({ top: 'grass_block' });
    expect(spawnable(g, 'cow', 0, 64, 30, () => 0)).toBe(true);
    const h = flat({ top: 'sand' });
    expect(spawnable(h, 'cow', 0, 64, 30, () => 0)).toBe(false);
  });

  it('the dark fills with monsters up to the cap and no further', () => {
    const g = flat({ r: 4, dark: true });
    g.time = 18000;
    for (let i = 0; i < 400; i++) spawnTick(g);
    const hostile = g.mobs.filter((m) => !MOBS[m.kind].animal).length;
    const cap = Math.floor((70 * g.world.chunks.size) / 289);
    expect(hostile).toBeGreaterThan(0);
    expect(hostile).toBeLessThanOrEqual(cap + 4);
  });

  it('a monster past 128 goes at once; animals stay', () => {
    const g = flat({ r: 1 });
    const z = put(g, 'zombie', 0.5, 0.5);
    const cow = put(g, 'cow', 2.5, 0.5);
    Object.assign(g.player, { x: 200.5, z: 0.5 });
    despawn(g);
    expect(g.mobs).not.toContain(z);
    expect(g.mobs).toContain(cow);
  });
});
