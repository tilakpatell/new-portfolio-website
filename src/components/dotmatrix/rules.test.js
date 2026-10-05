import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import {
  BLOCKS,
  BLOCK_LO,
  CARTRIDGES,
  CLOUD,
  COINS,
  GAMEBOY,
  H,
  HEART_EVERY,
  HERO,
  MAP,
  PEN,
  PIPES,
  SIGNS,
  SNAKE,
  START,
  TALK_R,
  TOWER,
  VILLAGERS,
  W,
  WALKERS,
  ZOOM,
  alongLoop,
  bites,
  blocked,
  cameraMove,
  column,
  floorAt,
  islanderStep,
  legend,
  moveHero,
  nearAction,
  newFolk,
  newGame,
  newHero,
  newPlant,
  pipeTop,
  pitchFor,
  plantOut,
  progress,
  snakeAt,
  step,
  stepPlant,
  stepVillager,
  talk,
  tileAt,
  walkerAt,
  warp,
  zoomTo,
} from './rules';

const DT = 1 / 60;
const idle = { x: 0, z: 0, jump: false, jumped: false };
// run the hero for `s` seconds with the same input (a jump pressed on the first frame only)
function run(h, input, s) {
  const out = [];
  for (let i = 0; i < Math.round(s / DT); i++) out.push(...moveHero(h, { ...input, jumped: input.jumped && i === 0 }, DT));
  return out;
}
function play(g, input, s) {
  const out = [];
  for (let i = 0; i < Math.round(s / DT); i++) out.push(...step(g, { ...input, jumped: input.jumped && i === 0 }, DT));
  return out;
}
const at = (x, y, z, face = 0) => newHero({ x, y, z, face });

describe('Dot Matrix: the island', () => {
  it('is a rectangle of tiles every letter of which means something', () => {
    for (const row of MAP) expect(row).toHaveLength(W);
    expect(H).toBe(MAP.length);
    for (const row of MAP) for (const c of row) expect(legend(c), c).toBe(legend(c)); // (and no unknown letters:)
    const known = new Set([...'~,."=:!%TYoO#HGPBsLM']);
    for (const row of MAP) for (const c of row) expect(known.has(c), c).toBe(true);
  });

  it('has a lighthouse on the islet and a windmill on the plateau, which nobody stands on', () => {
    const find = (c) => MAP.flatMap((row, iz) => [...row].map((ch, ix) => (ch === c ? [ix, iz] : null)).filter(Boolean));
    const [light] = find('L');
    const [mill] = find('M');
    expect(find('L')).toHaveLength(1);
    expect(find('M')).toHaveLength(1);
    expect(legend('L')).toMatchObject({ kind: 'lighthouse', ground: 0 });
    expect(legend('M')).toMatchObject({ kind: 'mill', ground: 3 });
    expect(legend('L').top).toBeGreaterThan(4);
    expect(legend('M').top).toBeGreaterThan(6);
    // out on the islet, on sand; up on the plateau, on its top
    expect(light[0]).toBeGreaterThan(43);
    expect(light[1]).toBeLessThan(5);
    expect(tileAt(mill[0] + 0.5, mill[1] + 0.5).ground).toBe(3);
    // solid: walked into, not onto
    expect(blocked(light[0] + 0.5, light[1] + 0.5, 0, HERO.step)).toBe(true);
    expect(blocked(mill[0] + 0.5, mill[1] + 0.5, 3, HERO.step)).toBe(true);
    // the islet's cartridge still has room to be stood by
    const islet = CARTRIDGES.find((c) => c.id === 'awesome-copilot');
    expect(blocked(islet.at[0], islet.at[2], 0, 0.02)).toBe(false);
  });

  it('is sea all the way round its edge', () => {
    for (let x = 0; x < W; x++) expect(tileAt(x + 0.5, 0.5).kind).toBe('sea');
    for (let x = 0; x < W; x++) expect(tileAt(x + 0.5, H - 0.5).kind).toBe('sea');
    for (let z = 0; z < H; z++) expect(tileAt(0.5, z + 0.5).kind).toBe('sea');
  });

  it('has one cartridge for every project but the Game Boy emulator, which is the Game Boy', () => {
    const ids = CARTRIDGES.map((c) => c.id).sort();
    expect(ids).toEqual(projects.map((p) => p.id).filter((id) => id !== 'gameboy-emulator').sort());
    expect(MAP.join('').split('G')).toHaveLength(1 + (GAMEBOY.x1 - GAMEBOY.x0) * (GAMEBOY.z1 - GAMEBOY.z0));
  });

  it('puts every cartridge, coin and sign where it can be stood by', () => {
    for (const c of CARTRIDGES) {
      const [x, y, z] = c.at;
      expect(floorAt(x, z, y + 0.01), c.id).toBeCloseTo(y);
    }
    for (const c of COINS) expect(floorAt(c.x, c.z, c.y), c.id).toBeGreaterThan(-0.5);
    for (const s of SIGNS) expect(MAP[s.iz][s.ix], s.id).toBe('s');
  });

  it('marks every pipe on the map, but the one on the cloud', () => {
    for (const p of PIPES) {
      if (p.base > 0) expect(p.id).toBe('sky');
      else expect(MAP[p.iz][p.ix], p.id).toBe('P');
    }
    expect(MAP.join('').split('P')).toHaveLength(PIPES.length); // (the cloud's isn't a letter)
  });

  it('builds the tower as a stair: each piece one up from the last', () => {
    for (let i = 1; i < TOWER.length; i++) {
      const [ax, az, a] = TOWER[i - 1];
      const [bx, bz, b] = TOWER[i];
      expect(Math.abs(ax - bx) + Math.abs(az - bz)).toBe(1);
      expect(b - a).toBe(1);
    }
    for (const [ix, iz, top] of TOWER) expect(floorAt(ix + 0.5, iz + 0.5)).toBe(top);
  });

  it('hangs the "?" blocks and the cloud as spans over the ground', () => {
    const [, block] = column(BLOCKS[0].ix, BLOCKS[0].iz);
    expect(block).toEqual([BLOCK_LO, BLOCK_LO + 1, BLOCKS[0].id]);
    expect(floorAt(CLOUD.x0 + 0.5, CLOUD.z0 + 0.5)).toBe(CLOUD.top);
    expect(floorAt(CLOUD.x0 + 0.5, CLOUD.z0 + 0.5, 3)).toBeLessThan(0);
  });

  it('walks its walkers on flat open ground only', () => {
    for (const w of WALKERS) {
      for (let k = 0; k <= 40; k++) {
        const p = walkerAt(w, ((k / 40) * Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1])) / w.speed);
        const t = tileAt(p.x, p.z);
        expect(['grass', 'long', 'path', 'sand'], `${w.id} ${t.c}`).toContain(t.kind);
        expect(t.top, w.id).toBe(0);
      }
    }
  });

  it('keeps the snake inside its pen', () => {
    for (let s = 0; s < 20; s += 0.25) {
      const p = alongLoop(s);
      expect(tileAt(p.x, p.z).kind).toBe('grass');
      expect(p.x).toBeGreaterThan(34);
      expect(p.x).toBeLessThan(42);
    }
    expect(snakeAt(3)).toHaveLength(SNAKE.length);
  });
});

describe('Dot Matrix: the camera', () => {
  it('zooms between its limits, and looks down less the closer it is', () => {
    expect(ZOOM.min).toBeLessThan(ZOOM.start);
    expect(ZOOM.start).toBeLessThan(ZOOM.max);
    expect(zoomTo(ZOOM.start, 1)).toBe(ZOOM.start);
    expect(zoomTo(ZOOM.start, 1.1)).toBeCloseTo(ZOOM.start * 1.1);
    expect(zoomTo(ZOOM.start, 100)).toBe(ZOOM.max);
    expect(zoomTo(ZOOM.start, 0.001)).toBe(ZOOM.min);
    expect(pitchFor(ZOOM.min)).toBeLessThan(pitchFor(ZOOM.start));
    expect(pitchFor(ZOOM.start)).toBeLessThan(pitchFor(ZOOM.max));
    expect(pitchFor(ZOOM.start)).toBeCloseTo(0.68, 2); // what it always was, at the start
    for (const d of [ZOOM.min, ZOOM.start, ZOOM.max]) {
      expect(pitchFor(d)).toBeGreaterThan(0.45);
      expect(pitchFor(d)).toBeLessThan(0.9);
    }
  });
});

describe('Dot Matrix: walking and jumping', () => {
  it('starts on the dock, facing the island', () => {
    const h = newHero();
    expect(tileAt(h.x, h.z).kind).toBe('dock');
    expect(floorAt(h.x, h.z)).toBe(0);
    expect(h.ground).toBe(true);
    expect(START.face).toBeCloseTo(Math.PI);
  });

  it('turns the stick into the camera’s directions', () => {
    const n = cameraMove(0, 1, 0);
    expect(n.x).toBeCloseTo(0);
    expect(n.z).toBeCloseTo(-1);
    const e = cameraMove(0, 0, 1);
    expect(e.x).toBeCloseTo(1);
    const turned = cameraMove(Math.PI / 2, 1, 0); // camera to the east: forward is west
    expect(turned.x).toBeCloseTo(-1);
    const diag = cameraMove(0, 1, 1);
    expect(Math.hypot(diag.x, diag.z)).toBeCloseTo(1);
  });

  it('walks, and stops flush against a wall', () => {
    const h = at(20.5, 0, 22.5); // in front of the house at 19..21, 23..24, a tile south of the road
    run(h, { x: 0, z: 1 }, 1.5);
    expect(h.z).toBeLessThan(23 - HERO.r + 0.01);
    expect(h.z).toBeGreaterThan(23 - HERO.r - 0.02);
    expect(h.y).toBe(0);
  });

  it('jumps about one and a third tiles, enough for one level and not two', () => {
    const h = at(28, 0, 30);
    let top = 0;
    moveHero(h, { x: 0, z: 0, jump: true, jumped: true }, DT);
    for (let i = 0; i < 90; i++) {
      moveHero(h, { x: 0, z: 0, jump: true }, DT);
      top = Math.max(top, h.y);
    }
    expect(top).toBeGreaterThan(1.3);
    expect(top).toBeLessThan(1.6);
    expect(h.ground).toBe(true);
    expect(h.y).toBe(0);
  });

  it('hops lower when the button is let go early', () => {
    const h = at(28, 0, 30);
    moveHero(h, { x: 0, z: 0, jump: true, jumped: true }, DT);
    let top = 0;
    for (let i = 0; i < 90; i++) {
      moveHero(h, idle, DT);
      top = Math.max(top, h.y);
    }
    expect(top).toBeLessThan(0.9);
  });

  it('climbs the plateau a jump at a time', () => {
    // from the long grass below its south edge, up to the first level
    const h = at(9.5, 0, 15.5);
    run(h, { x: 0, z: -1, jump: true, jumped: true }, 0.8);
    expect(h.y).toBe(1);
    expect(tileAt(h.x, h.z).c).toBe(':');
    // walking can't do it
    const w = at(9.5, 0, 15.5);
    run(w, { x: 0, z: -1 }, 1);
    expect(w.y).toBe(0);
  });

  it('can’t jump straight up two levels', () => {
    // the wall of the pen is 1.6 high
    const h = at(36.5, 0, 22.5);
    run(h, { x: 0, z: -1, jump: true, jumped: true }, 1);
    expect(h.z).toBeGreaterThan(22);
    expect(h.y).toBe(0);
  });

  it('bumps a "?" block from underneath, and can’t go through it', () => {
    const b = BLOCKS[0];
    const h = at(b.ix + 0.5, 0, b.iz + 0.5);
    const ev = run(h, { x: 0, z: 0, jump: true, jumped: true }, 1);
    expect(ev.find((e) => e.type === 'bump')?.block).toBe(b.id);
    expect(h.y).toBe(0);
  });

  it('comes back to dry land after falling in the sea', () => {
    const g = newGame();
    g.hero = at(28, 0, 37.2);
    play(g, idle, 0.5); // a moment to know where's safe
    let splashed = false;
    for (let i = 0; i < 120 && !splashed; i++) splashed = step(g, { x: 0, z: 1, jump: false, jumped: false }, DT).some((e) => e.type === 'splash');
    expect(splashed).toBe(true);
    expect(tileAt(g.hero.x, g.hero.z).kind).toBe('dock');
    expect(g.hero.y).toBe(0);
    expect(g.hearts).toBe(HERO.hearts); // the sea doesn't hurt
  });

  // jump from (x, z) towards (dx, dz), holding the stick for each of a few
  // lengths of time: does any of them land on a tile of this kind?
  const reaches = (x, y, z, dx, dz, kind) =>
    [0.15, 0.25, 0.35, 0.5, 0.7].some((hold) => {
      const h = at(x, y, z);
      moveHero(h, { x: dx, z: dz, jump: true, jumped: true }, DT);
      for (let i = 0; i < 80; i++) moveHero(h, i * DT < hold ? { x: dx, z: dz, jump: true } : { ...idle, jump: true }, DT);
      return h.ground && tileAt(h.x, h.z).kind === kind;
    });

  it('crosses the stepping stones to the islet, a jump at a time', () => {
    const d = Math.SQRT1_2;
    expect(reaches(36.6, 0, 7.5, 1, 0, 'stone')).toBe(true); // off the coast
    expect(reaches(38.5, 0.3, 7.5, 2 / Math.hypot(2, 1), -1 / Math.hypot(2, 1), 'stone')).toBe(true);
    expect(reaches(42.5, 0.3, 5.5, d, -d, 'sand')).toBe(true); // onto the islet
  });
});

describe('Dot Matrix: every cartridge can be reached', () => {
  // a jump from (x, y, z) towards (dx, dz), holding the stick a while: the
  // heights it can land at
  const landings = (x, y, z, dx, dz) =>
    [0.1, 0.2, 0.3, 0.45, 0.7].map((hold) => {
      const h = at(x, y, z);
      moveHero(h, { x: dx, z: dz, jump: true, jumped: true }, DT);
      for (let i = 0; i < 90; i++) moveHero(h, i * DT < hold ? { x: dx, z: dz, jump: true } : { ...idle, jump: true }, DT);
      return h.ground ? Math.round(h.y * 100) / 100 : null;
    });

  it('up the plateau, level by level', () => {
    expect(landings(9.5, 0, 15.5, 0, -1)).toContain(1);
    expect(landings(10.5, 1, 13.5, 0, -1)).toContain(2);
    expect(landings(10.5, 2, 11.5, 0, -1)).toContain(3);
  });

  it('round Block Drop tower, a piece at a time', () => {
    const [x0, z0] = [TOWER[0][0] + 0.5, TOWER[0][1] + 1.5];
    expect(landings(x0, 0, z0, 0, -1)).toContain(1);
    for (let i = 1; i < TOWER.length; i++) {
      const [ax, az, a] = TOWER[i - 1];
      const [bx, bz, b] = TOWER[i];
      expect(landings(ax + 0.5, a, az + 0.5, bx - ax, bz - az), `piece ${i}`).toContain(b);
    }
  });

  it('onto the roof, from the boulder beside the house', () => {
    expect(landings(17.5, 0, 24.5, 1, 0)).toContain(1); // onto the boulder
    expect(landings(18.5, 1, 24.5, 1, 0)).toContain(2); // onto the roof
    expect(landings(17.5, 0, 23.5, 1, 0)).not.toContain(2); // (not from the ground)
  });

  it('onto the pipes', () => {
    const mid = PIPES.find((p) => p.id === 'mid');
    expect(landings(mid.ix - 0.5, 0, mid.iz - 0.5, 0, 1)).toContain(0); // (the ground round it, at least)
    expect(landings(mid.ix - 1 + 0.5, 0, mid.iz - 0.5, Math.SQRT1_2, Math.SQRT1_2)).toContain(pipeTop(mid));
  });
});

describe('Dot Matrix: the game', () => {
  it('picks up coins and cartridges by walking into them', () => {
    const g = newGame();
    const c = COINS[2];
    g.hero = at(c.x, 0, c.z + 1);
    const ev = play(g, { x: 0, z: -1 }, 0.4);
    expect(ev.some((e) => e.type === 'coin' && e.id === c.id)).toBe(true);
    const cart = CARTRIDGES.find((x) => x.id === 'unix-shell');
    g.hero = at(cart.at[0] - 1, 0, cart.at[2]);
    const ev2 = play(g, { x: 1, z: 0 }, 0.4);
    expect(ev2.some((e) => e.type === 'cart' && e.id === 'unix-shell')).toBe(true);
    expect(progress(g).found).toBe(1);
  });

  it('keeps the cartridges you found last time', () => {
    const g = newGame({ found: ['devspace', 'no-such-thing'] });
    expect([...g.found]).toEqual(['devspace']);
    expect(progress(g)).toMatchObject({ found: 1, of: 8, done: false });
  });

  it('gives a coin, or a heart, from each "?" block, once', () => {
    const g = newGame();
    const b = BLOCKS.find((x) => x.heart);
    g.hearts = 1;
    g.hero = at(b.ix + 0.5, 0, b.iz + 0.5);
    const ev = play(g, { x: 0, z: 0, jump: true, jumped: true }, 1);
    expect(ev.find((e) => e.type === 'block')).toMatchObject({ gives: 'heart' });
    expect(g.hearts).toBe(2);
    const again = play(g, { x: 0, z: 0, jump: true, jumped: true }, 1);
    expect(again.some((e) => e.type === 'block')).toBe(false);
  });

  it('flattens a walker landed on, and hurts you if you walk into one', () => {
    const w = WALKERS[0];
    const g = newGame();
    const p = walkerAt(w, 0);
    g.hero = at(p.x, 0.8, p.z);
    g.hero.ground = false;
    g.hero.vy = -2;
    const ev = step(g, idle, DT);
    expect(ev.some((e) => e.type === 'stomp' && e.id === w.id)).toBe(true);
    expect(g.hero.vy).toBeGreaterThan(5);
    // a fresh game, walking into it
    const g2 = newGame();
    const q = walkerAt(w, 0);
    g2.hero = at(q.x, 0, q.z);
    const ev2 = step(g2, idle, DT);
    expect(ev2.some((e) => e.type === 'hurt')).toBe(true);
    expect(g2.hearts).toBe(HERO.hearts - 1);
    // and it doesn't hurt twice in a row
    step(g2, idle, DT);
    expect(g2.hearts).toBe(HERO.hearts - 1);
  });

  it('sends you back to the dock with full hearts when they run out', () => {
    const g = newGame({ found: ['devspace'] });
    g.hearts = 1;
    const p = walkerAt(WALKERS[0], 0);
    g.hero = at(p.x, 0, p.z);
    const ev = step(g, idle, DT);
    expect(ev.some((e) => e.type === 'over')).toBe(true);
    const back = play(g, idle, 2.2);
    expect(back.some((e) => e.type === 'ashore')).toBe(true);
    expect(g.hearts).toBe(HERO.hearts);
    expect(tileAt(g.hero.x, g.hero.z).kind).toBe('dock');
    expect(g.found.has('devspace')).toBe(true);
  });

  it('bites with the snake, but leaves the middle of the loop alone', () => {
    const g = newGame();
    const head = snakeAt(0)[0];
    g.hero = at(head.x, 0, head.z);
    expect(step(g, idle, DT).some((e) => e.type === 'hurt')).toBe(true);
    const g2 = newGame();
    const cart = CARTRIDGES.find((x) => x.id === 'unix-shell');
    g2.hero = at(cart.at[0], 0, cart.at[2]);
    expect(play(g2, idle, 8).some((e) => e.type === 'hurt')).toBe(false);
  });
});

describe('Dot Matrix: the plants', () => {
  it('come up and go down on a cycle', () => {
    const p = newPlant();
    const seen = new Set();
    for (let i = 0; i < 600; i++) seen.add(stepPlant(p, DT, false).state);
    expect([...seen].sort()).toEqual(['down', 'rise', 'sink', 'up']);
  });

  it('stay down while you stand on their pipe', () => {
    const p = newPlant();
    for (let i = 0; i < 600; i++) stepPlant(p, DT, true);
    expect(plantOut(p)).toBe(0);
  });

  it('bite something jumping by, not something walking past underneath', () => {
    const top = 1.25;
    expect(bites(1, 0.9, top, top)).toBe(true); // on the next pipe
    expect(bites(1, 0.9, 0, top)).toBe(false); // on the ground beside it
    expect(bites(1, 1.4, top, top)).toBe(false); // out of reach
    expect(bites(0.2, 0.5, top, top)).toBe(false); // barely out
  });

  it('guard the garden’s middle pipe, which you can only stand on between bites', () => {
    const mid = PIPES.find((p) => p.id === 'mid');
    const g = newGame();
    g.hero = at(mid.ix + 0.5, pipeTop(mid), mid.iz + 0.5);
    const ev = play(g, idle, 6);
    expect(ev.some((e) => e.type === 'hurt')).toBe(true);
    // standing on a plant's own pipe, next to it, is safe
    const w = PIPES.find((p) => p.id === 'w');
    const g2 = newGame();
    g2.hero = at(w.ix + 0.5, pipeTop(w), w.iz + 0.5);
    expect(play(g2, idle, 10).some((e) => e.type === 'hurt')).toBe(false);
  });
});

describe('Dot Matrix: the B button', () => {
  it('plays the Game Boy from in front of it', () => {
    const g = newGame();
    g.hero = at(25, 0, 15);
    expect(nearAction(g)).toEqual({ kind: 'gameboy', id: 'gameboy' });
  });

  it('reads a sign beside it', () => {
    const g = newGame();
    const s = SIGNS.find((x) => x.id === 'dock');
    g.hero = at(s.ix + 1.5, 0, s.iz + 0.5);
    expect(nearAction(g)).toEqual({ kind: 'sign', id: 'dock' });
  });

  it('goes down the road’s pipe to the cloud, and back', () => {
    const road = PIPES.find((p) => p.id === 'road');
    const g = newGame();
    g.hero = at(road.ix + 0.5, pipeTop(road), road.iz + 0.5);
    expect(nearAction(g)).toEqual({ kind: 'pipe', id: 'road' });
    expect(warp(g, 'road')).toBe(true);
    expect(g.hero.y).toBeCloseTo(CLOUD.top + 1.25);
    // off the pipe onto the cloud, and the cloud holds you up
    play(g, { x: 1, z: 0 }, 0.6);
    expect(g.hero.y).toBeCloseTo(CLOUD.top);
    expect(g.hero.ground).toBe(true);
    // back up on its pipe and home
    g.hero = at(2.5, pipeTop(PIPES.find((p) => p.id === 'sky')), 31.5);
    expect(nearAction(g)?.id).toBe('sky');
    warp(g, 'sky');
    expect(Math.floor(g.hero.x)).toBe(road.ix);
    expect(g.hero.y).toBeCloseTo(pipeTop(road));
  });

  it('does nothing in the middle of nowhere', () => {
    const g = newGame();
    g.hero = at(28, 0, 30);
    expect(nearAction(g)).toBeNull();
  });
});

describe('Dot Matrix: the villagers', () => {
  const faraway = { x: 0, y: 0, z: 0 };

  it('walk on flat open ground, clear of the pen, the walkers and the snake', () => {
    expect(VILLAGERS.length).toBeGreaterThanOrEqual(4);
    for (const v of VILLAGERS) {
      expect(v.lines.length).toBeGreaterThanOrEqual(2);
      expect(typeof v.done).toBe('string');
      for (let k = 0; k <= 20; k++) {
        const x = v.from[0] + ((v.to[0] - v.from[0]) * k) / 20;
        const z = v.from[1] + ((v.to[1] - v.from[1]) * k) / 20;
        const t = tileAt(x, z);
        expect(['grass', 'long', 'path', 'sand'], `${v.id} at ${x},${z}`).toContain(t.kind);
        expect(t.ground).toBe(0);
        expect(blocked(x, z, 0, 0.02), `${v.id} at ${x},${z}`).toBe(false);
        expect(x > PEN.x0 && x < PEN.x1 + 1 && z > PEN.z0 && z < PEN.z1 + 1, `${v.id} in the pen`).toBe(false);
        for (const w of WALKERS) {
          const d = Math.min(...[0, 0.25, 0.5, 0.75, 1].map((f) => Math.hypot(w.from[0] + (w.to[0] - w.from[0]) * f - x, w.from[1] + (w.to[1] - w.from[1]) * f - z)));
          expect(d, `${v.id} crosses ${w.id}`).toBeGreaterThan(0.9);
        }
      }
    }
  });

  it('walk there and back, and wait a while at each end', () => {
    const v = VILLAGERS[0];
    const f = newFolk()[v.id];
    const xs = [];
    let atEnd = 0;
    for (let i = 0; i < 40 / DT; i++) {
      stepVillager(v, f, DT, faraway);
      xs.push(f.x);
      if (Math.abs(f.x - v.to[0]) < 1e-6 && Math.abs(f.z - v.to[1]) < 1e-6) atEnd++;
    }
    expect(Math.min(...xs)).toBeCloseTo(Math.min(v.from[0], v.to[0]), 5);
    expect(Math.max(...xs)).toBeCloseTo(Math.max(v.from[0], v.to[0]), 5);
    expect(atEnd * DT).toBeGreaterThanOrEqual(v.dwell * 0.9);
    expect(f.stopped).toBe(false);
  });

  it('stop and turn to face you when you come up to them, then walk on', () => {
    const v = VILLAGERS[0];
    const f = newFolk()[v.id];
    for (let i = 0; i < 2 / DT; i++) stepVillager(v, f, DT, faraway);
    const was = { x: f.x, z: f.z };
    const hero = { x: f.x + 0.9, y: 0, z: f.z + 0.4 };
    for (let i = 0; i < 1 / DT; i++) stepVillager(v, f, DT, hero);
    expect(f.stopped).toBe(true);
    expect(f.x).toBe(was.x);
    expect(f.z).toBe(was.z);
    expect(f.face).toBeCloseTo(Math.atan2(hero.x - f.x, hero.z - f.z), 1);
    for (let i = 0; i < 1 / DT; i++) stepVillager(v, f, DT, faraway);
    expect(f.stopped).toBe(false);
    expect(f.x === was.x && f.z === was.z).toBe(false);
  });

  it('are talked to with B, ahead of a sign but behind the Game Boy', () => {
    const kid = VILLAGERS.find((v) => v.id === 'kid');
    const g = newGame();
    const f = g.folk.kid;
    const sign = SIGNS.find((s) => s.id === 'square');
    // the kid beside the square's sign: the kid comes first
    Object.assign(f, { x: sign.ix + 0.5, z: sign.iz + 1.5, stopped: true });
    g.hero = at(sign.ix + 0.5, 0, sign.iz + 1.3);
    expect(nearAction(g)).toEqual({ kind: 'talk', id: 'kid' });
    // in front of the Game Boy, the Game Boy comes first
    Object.assign(f, { x: 25, z: 15.2 });
    g.hero = at(25, 0, 15);
    expect(nearAction(g)).toEqual({ kind: 'gameboy', id: 'gameboy' });
    // out of reach, nothing
    Object.assign(f, { x: kid.from[0], z: kid.from[1] });
    g.hero = at(kid.from[0] + TALK_R + 1, 0, kid.from[1]);
    expect(nearAction(g)).toBeNull();
  });

  it('have something new to say each time, round again, and a last word once the set is complete', () => {
    const v = VILLAGERS[0];
    const g = newGame();
    const heard = v.lines.map(() => talk(g, v.id));
    expect(heard.map((h) => h.text)).toEqual(v.lines);
    expect(heard[0].name).toBe(v.name);
    expect(talk(g, v.id).text).toBe(v.lines[0]);
    const done = newGame({ found: CARTRIDGES.map((c) => c.id) });
    expect(talk(done, v.id).text).toBe(v.done);
    expect(talk(g, 'nobody')).toBeNull();
  });

  it('stand still and keep facing you while you talk, every step of the game', () => {
    const v = VILLAGERS[0];
    const g = newGame();
    const f = g.folk[v.id];
    g.hero = at(f.x + 0.8, 0, f.z);
    play(g, idle, 1);
    expect(f.stopped).toBe(true);
    expect(nearAction(g)).toEqual({ kind: 'talk', id: v.id });
  });
});

describe('Dot Matrix: the coins', () => {
  const coinAt = (c) => at(c.x, c.y - 0.55, c.z);

  it('give a heart back every so many, when one is missing', () => {
    expect(HEART_EVERY).toBeGreaterThan(5);
    const g = newGame();
    g.hearts = 1;
    COINS.slice(0, HEART_EVERY - 1).forEach((c) => g.coins.add(c.id));
    g.hero = coinAt(COINS[HEART_EVERY - 1]);
    const ev = step(g, idle, DT);
    expect(ev.some((e) => e.type === 'coin')).toBe(true);
    expect(ev.some((e) => e.type === 'coinheart')).toBe(true);
    expect(g.hearts).toBe(2);
    // with full hearts, the coin counts but there's nothing to give back
    const g2 = newGame();
    COINS.slice(0, HEART_EVERY - 1).forEach((c) => g2.coins.add(c.id));
    g2.hero = coinAt(COINS[HEART_EVERY - 1]);
    const ev2 = step(g2, idle, DT);
    expect(ev2.some((e) => e.type === 'coinheart')).toBe(false);
    expect(g2.hearts).toBe(HERO.hearts);
  });

  it('say so, once, when the last one is picked up', () => {
    const g = newGame();
    for (const c of COINS.slice(1)) g.coins.add(c.id);
    for (const b of BLOCKS) if (!b.heart) g.coins.add(b.id);
    expect(progress(g).coins).toBe(progress(g).coinsOf - 1);
    g.hero = coinAt(COINS[0]);
    const ev = step(g, idle, DT);
    expect(ev.filter((e) => e.type === 'allcoins')).toHaveLength(1);
    expect(progress(g).coins).toBe(progress(g).coinsOf);
    expect(step(g, idle, DT).some((e) => e.type === 'allcoins')).toBe(false);
  });
});

describe('Dot Matrix: the other islanders', () => {
  it('says where you are for them, on the island, with how fast and how high', () => {
    const g = newGame();
    const st = islanderStep(g.hero);
    expect(st).toMatchObject({ x: g.hero.x, z: g.hero.z, face: g.hero.face, y: 0 });
    expect(st.speed).toBe(0);
    g.hero.moving = 4.6;
    g.hero.y = CLOUD.top;
    expect(islanderStep(g.hero)).toMatchObject({ speed: 4.6, y: CLOUD.top });
    // someone gone down the pipe, or over by the dock, is still within the town's bounds
    for (const s of [islanderStep(at(0.5, 0, 0.5)), islanderStep(at(W - 0.5, 0, H - 0.5))]) {
      expect(Math.abs(s.x)).toBeLessThan(200);
      expect(Math.abs(s.z)).toBeLessThan(200);
    }
  });
});
