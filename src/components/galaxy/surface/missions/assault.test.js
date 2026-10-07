import { describe, expect, it } from 'vitest';
import { createSolids } from '../walker';
import { RULES, SOLDIERS, battleView, canDeploy, chooseSide, coverFrom, deploy, endBattle, forwardOf, hitSoldier, leaderOf, newBattle, objectiveFor, stepBattle, youDown } from './assault';

// a small map: the attackers come from the west, two posts to take, then a last one
const MAP = {
  id: 'assault',
  system: 'test',
  kind: 'assault',
  name: 'A test battle',
  start: [-120, 0],
  yaw: 0,
  stars: [300, 480],
  sides: {
    attack: { id: 'empire', name: 'The Empire', short: 'Empire', colour: '#9fd0ff', kinds: [['snowtrooper', 1]] },
    defend: { id: 'rebels', name: 'The Rebellion', short: 'Rebellion', colour: '#ff8a5a', kinds: [['hothtrooper', 1]] },
  },
  posts: [
    { id: 'line', name: 'The line', at: [-120, 0], r: 20, fixed: 'attack' },
    { id: 'a', name: 'Post A', at: [0, 30], r: 16 },
    { id: 'b', name: 'Post B', at: [0, -30], r: 16 },
    { id: 'c', name: 'Post C', at: [120, 0], r: 16 },
    { id: 'base', name: 'The base', at: [220, 0], r: 20, fixed: 'defend' },
  ],
  phases: [
    { name: 'The front', posts: ['a', 'b'], tickets: 60 },
    { name: 'The last stand', posts: ['c'], tickets: 50 },
  ],
  tickets: { attack: 60, defend: 90 },
  ends: { won: 'Won', lost: 'Lost', why: { tickets: 'Out of reinforcements.', posts: 'The last post fell.' } },
};
const env = { solids: createSolids(), reach: 600 };
const run = (b, secs, you = null, dt = 0.1) => {
  const out = [];
  for (let t = 0; t < secs - 1e-9; t += dt) out.push(...stepBattle(b, dt, you, env));
  return out;
};
const post = (b, id) => b.posts.find((p) => p.id === id);
const up = (b, side) => b.soldiers.filter((s) => s.side === side && s.up);

describe('the battle, laid out', () => {
  it('starts at the choose card with the posts the defenders’ and nobody up', () => {
    const b = newBattle(MAP, { n: 6, seed: 3 });
    expect(b.phase).toBe('choose');
    expect(b.soldiers).toHaveLength(12);
    expect(b.soldiers.every((s) => !s.up)).toBe(true);
    for (const id of ['a', 'b', 'c']) expect(post(b, id).owner).toBe('defend');
    expect(post(b, 'line').owner).toBe('attack');
    expect(post(b, 'base').owner).toBe('defend');
    expect(b.tickets).toEqual({ attack: 60, defend: 90 });
    expect(SOLDIERS.high).toBeGreaterThan(SOLDIERS.mid);
    expect(SOLDIERS.mid).toBeGreaterThan(SOLDIERS.low);
  });

  it('chosen, it runs: the defenders inside the live posts, the attackers at their line', () => {
    const b = newBattle(MAP, { n: 6, seed: 3 });
    chooseSide(b, 'attack');
    expect(b.phase).toBe('run');
    expect(b.you.side).toBe('attack');
    expect(up(b, 'attack')).toHaveLength(6);
    expect(up(b, 'defend')).toHaveLength(6);
    for (const s of up(b, 'defend')) expect(['a', 'b'].some((id) => Math.hypot(s.x - post(b, id).at[0], s.z - post(b, id).at[1]) <= post(b, id).r)).toBe(true);
    for (const s of up(b, 'attack')) expect(Math.hypot(s.x + 120, s.z)).toBeLessThanOrEqual(20);
    // (no ticket spent on the first wave)
    expect(b.tickets).toEqual({ attack: 60, defend: 90 });
    // (a kind each, from the side's list)
    for (const s of b.soldiers) expect(s.kind).toBe(s.side === 'attack' ? 'snowtrooper' : 'hothtrooper');
  });

  it('spends nothing and moves nobody before a side is chosen', () => {
    const b = newBattle(MAP, { n: 4, seed: 1 });
    run(b, 5);
    expect(b.t).toBe(0);
    expect(b.soldiers.every((s) => !s.up)).toBe(true);
  });
});

// a battle with no soldiers at all, so the posts answer only to `you`
const empty = (side = 'attack') => {
  const b = newBattle(MAP, { n: 0, seed: 1 });
  chooseSide(b, side);
  return b;
};

describe('a command post', () => {
  it('is neutralised by one soldier alone in 1 / 0.08 s, and taken in as long again', () => {
    const b = empty('attack');
    b.you.up = true;
    const you = { x: 0, z: 30 }; // inside post A
    const T = 1 / RULES.capture;
    run(b, T - 0.3, you);
    expect(post(b, 'a').owner).toBe('defend');
    expect(post(b, 'a').meter).toBeLessThan(0.05);
    const ev = run(b, 0.6, you);
    expect(post(b, 'a').owner).toBeNull();
    expect(ev.some((e) => e.type === 'neutral' && e.post === 'a' && e.by === 'attack')).toBe(true);
    const ev2 = run(b, T + 0.3, you);
    expect(post(b, 'a').owner).toBe('attack');
    expect(ev2.some((e) => e.type === 'capture' && e.post === 'a' && e.side === 'attack' && e.you === true)).toBe(true);
    expect(b.you.captures).toBe(1);
  });

  it('flips no faster than four soldiers’ worth, however many stand in it', () => {
    const b = newBattle(MAP, { n: 8, seed: 2 });
    chooseSide(b, 'defend');
    // every attacker put inside post B, every defender far away and still
    for (const s of b.soldiers) {
      if (s.side === 'attack') Object.assign(s, { x: 0, z: -30 });
      else Object.assign(s, { x: 220, z: 0 });
      s.frozen = true;
    }
    run(b, 1);
    expect(post(b, 'b').meter).toBeCloseTo(1 - RULES.capture * RULES.advantage, 1);
  });

  it('holds while the numbers are even', () => {
    const b = newBattle(MAP, { n: 2, seed: 2 });
    chooseSide(b, 'attack');
    for (const s of b.soldiers) {
      Object.assign(s, { x: 0, z: 30, frozen: true, unarmed: true });
    }
    run(b, 5);
    expect(post(b, 'a').owner).toBe('defend');
    expect(post(b, 'a').meter).toBe(1);
  });

  it('recovers for its owner once the attackers are gone', () => {
    const b = empty('attack');
    b.you.up = true;
    run(b, 6, { x: 0, z: 30 });
    expect(post(b, 'a').meter).toBeLessThan(0.6);
    // a defender alone in it now
    b.soldiers.push({ id: 99, side: 'defend', kind: 'hothtrooper', x: 0, z: 30, yaw: 0, hp: 100, up: true, down: 0, post: 'a', cool: 1, wait: 0, frozen: true });
    run(b, 20, null);
    expect(post(b, 'a').meter).toBe(1);
  });
});

describe('the soldiers', () => {
  it('reach their post across an empty field', () => {
    const b = newBattle(MAP, { n: 1, seed: 4 });
    chooseSide(b, 'defend');
    const a = up(b, 'attack')[0];
    // (the defender sent off the field, so nothing stops the attacker)
    for (const s of up(b, 'defend')) Object.assign(s, { x: 500, z: 0, frozen: true, unarmed: true });
    const d = Math.hypot(a.x, a.z - 30); // to post A, or B (the same distance)
    run(b, d / RULES.walk + 8);
    const inA = Math.hypot(a.x - 0, a.z - 30) <= 16;
    const inB = Math.hypot(a.x - 0, a.z + 30) <= 16;
    expect(inA || inB).toBe(true);
  });

  it('steer round what’s solid', () => {
    const solids = createSolids();
    for (let z = -12; z <= 12; z += 2) solids.box(-60, z, 1, 1); // a wall across the way, with a way round
    const b = newBattle({ ...MAP, phases: [{ name: 'One', posts: ['a'], tickets: 60 }] }, { n: 1, seed: 5 });
    chooseSide(b, 'defend');
    for (const s of up(b, 'defend')) Object.assign(s, { x: 500, z: 0, frozen: true, unarmed: true });
    const a = up(b, 'attack')[0];
    Object.assign(a, { x: -120, z: 0 });
    for (let t = 0; t < 70; t += 0.1) {
      stepBattle(b, 0.1, null, { solids, reach: 600 });
      for (const s of solids.all) expect(Math.abs(a.x - s.x) < 1.3 && Math.abs(a.z - s.z) < 1.3, `through the wall at ${t.toFixed(1)}s`).toBe(false);
    }
    expect(Math.hypot(a.x, a.z - 30)).toBeLessThanOrEqual(16);
  });

  it('go down after three of your shots, and you’re credited', () => {
    const b = newBattle(MAP, { n: 2, seed: 6 });
    chooseSide(b, 'attack');
    const d = up(b, 'defend')[0];
    expect(hitSoldier(b, d.id)).toBeNull();
    expect(d.hp).toBe(RULES.hp - RULES.yours);
    expect(hitSoldier(b, d.id)).toBeNull();
    const ev = hitSoldier(b, d.id);
    expect(ev).toMatchObject({ type: 'down', id: d.id, by: 'you' });
    expect(d.up).toBe(false);
    expect(b.you.kills).toBe(1);
    expect(hitSoldier(b, d.id)).toBeNull(); // (already down: nothing more)
    expect(b.you.kills).toBe(1);
  });

  it('come back at a post of theirs after a while, with the next wave, for a ticket, and stay down without one', () => {
    const b = newBattle(MAP, { n: 1, seed: 7 });
    chooseSide(b, 'attack');
    const d = up(b, 'defend')[0];
    for (let i = 0; i < 4; i++) hitSoldier(b, d.id);
    const before = b.tickets.defend;
    run(b, RULES.respawn - 0.5);
    expect(d.up).toBe(false);
    const ev = run(b, RULES.waveDefend + 1);
    expect(d.up).toBe(true);
    expect(ev.some((e) => e.type === 'spawn' && e.id === d.id)).toBe(true);
    expect(b.tickets.defend).toBe(before - 1);
    expect(['a', 'b', 'base'].some((id) => Math.hypot(d.x - post(b, id).at[0], d.z - post(b, id).at[1]) <= post(b, id).r)).toBe(true);
    b.tickets.defend = 0;
    for (let i = 0; i < 4; i++) hitSoldier(b, d.id);
    run(b, RULES.respawn + RULES.waveDefend + 2);
    expect(d.up).toBe(false);
  });

  it('come back in waves, together, and the attackers on a staging line short of their objective', () => {
    const b = newBattle(MAP, { n: 8, seed: 17 });
    chooseSide(b, 'attack');
    for (const s of b.soldiers) Object.assign(s, { frozen: true, unarmed: true });
    const attackers = up(b, 'attack');
    // four of them down at once
    run(b, 0.3);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) hitSoldier(b, attackers[i].id);
    const spawns = [];
    for (let t = 0; t < RULES.respawn + RULES.wave + 1; t += 0.1) for (const e of stepBattle(b, 0.1, null, env)) if (e.type === 'spawn') spawns.push(+b.t.toFixed(1));
    expect(spawns).toHaveLength(4);
    expect(new Set(spawns).size).toBe(1); // (one wave)
    // on the staging line: RULES.forward short of post A or B (at x = 0), not back at the line (x = −120)
    for (const s of attackers.slice(0, 4)) {
      expect(s.x).toBeGreaterThan(-120 + 20);
      const toA = Math.hypot(s.x, s.z - 30);
      const toB = Math.hypot(s.x, s.z + 30);
      expect(Math.min(toA, toB)).toBeLessThan(RULES.forward + 12);
    }
  });

  it('comes back inside the post itself when the objective is nearer than the staging line', () => {
    const b = newBattle(MAP, { n: 1, seed: 18 });
    chooseSide(b, 'attack');
    expect(forwardOf(b, post(b, 'line'), [-100, 0])).toEqual(expect.any(Array));
    const near = forwardOf(b, post(b, 'line'), [-100, 0]);
    expect(Math.hypot(near[0] + 120, near[1])).toBeLessThanOrEqual(20);
    const far = forwardOf(b, post(b, 'line'), [0, 0]);
    expect(far[0]).toBeCloseTo(-120 + (120 - RULES.forward), 0);
  });

  it('shoot at an enemy in range, and at most three of them at you', () => {
    const b = newBattle(MAP, { n: 6, seed: 8 });
    chooseSide(b, 'attack');
    b.you.up = true;
    for (const s of b.soldiers) Object.assign(s, { frozen: true });
    // every defender within range of you, every attacker far away
    for (const s of up(b, 'defend')) Object.assign(s, { x: 20, z: 30 });
    for (const s of up(b, 'attack')) Object.assign(s, { x: -400, z: 0 });
    const ev = run(b, 3, { x: 0, z: 30 });
    const atYou = ev.filter((e) => e.type === 'shot' && e.atYou);
    expect(atYou.length).toBeGreaterThan(0);
    const shooters = new Set(atYou.map((e) => e.id));
    expect(shooters.size).toBeLessThanOrEqual(RULES.atYouMax);
    for (const e of atYou) expect(e.side).toBe('defend');
  });

  it('shoot each other: a hit does damage, and a kill is told', () => {
    const b = newBattle(MAP, { n: 4, seed: 9 });
    chooseSide(b, 'attack');
    for (const s of b.soldiers) Object.assign(s, { frozen: true, x: s.side === 'attack' ? -10 : 10, z: 30 });
    const ev = run(b, 30);
    const shots = ev.filter((e) => e.type === 'shot' && !e.atYou);
    expect(shots.length).toBeGreaterThan(10);
    expect(shots.some((e) => e.hit)).toBe(true);
    expect(ev.some((e) => e.type === 'down' && e.by !== 'you')).toBe(true);
    expect(ev.some((e) => e.type === 'kill')).toBe(true);
  });
});

describe('the squads', () => {
  it('are RULES.squad to a squad, each with a flank of its own, and a leader who is the first of it standing', () => {
    const b = newBattle(MAP, { n: 8, seed: 10 });
    const attackers = b.soldiers.filter((s) => s.side === 'attack');
    expect(attackers.map((s) => s.squad)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    expect(attackers[0].flank).not.toBe(attackers[4].flank);
    chooseSide(b, 'attack');
    expect(leaderOf(b, attackers[3])).toBe(attackers[0]);
    attackers[0].up = false;
    expect(leaderOf(b, attackers[3])).toBe(attackers[1]);
    for (const s of attackers) s.up = false;
    expect(leaderOf(b, attackers[3])).toBeNull();
  });

  it('go where their leader goes', () => {
    const b = newBattle(MAP, { n: 8, seed: 11 });
    chooseSide(b, 'attack');
    for (const s of up(b, 'defend')) Object.assign(s, { x: 500, z: 0, frozen: true, unarmed: true });
    run(b, RULES.retarget * 3);
    for (const s of up(b, 'attack')) expect(s.post, `soldier ${s.id}`).toBe(leaderOf(b, s).post);
  });

  it('come at a post from their own side: a flanking squad’s spots sit round from a straight one’s', () => {
    const b = newBattle({ ...MAP, phases: [{ name: 'One', posts: ['c'], tickets: 60 }] }, { n: 8, seed: 12 });
    chooseSide(b, 'attack');
    for (const s of up(b, 'defend')) Object.assign(s, { x: 500, z: 0, frozen: true, unarmed: true });
    for (const s of up(b, 'attack')) Object.assign(s, { x: 0, z: 0 });
    run(b, 0.2);
    const c = post(b, 'c');
    const bearing = (s) => Math.atan2(s.spot[1] - c.at[1], s.spot[0] - c.at[0]);
    const straight = up(b, 'attack').filter((s) => s.flank === 0);
    const flanking = up(b, 'attack').filter((s) => s.flank !== 0);
    expect(straight.length).toBeGreaterThan(0);
    expect(flanking.length).toBeGreaterThan(0);
    // (from (0, 0) the post is due +x, so the near side is bearing π; the flank is turned off it)
    for (const s of straight) expect(Math.abs(Math.atan2(Math.sin(bearing(s) - Math.PI), Math.cos(bearing(s) - Math.PI)))).toBeLessThan(0.5);
    for (const s of flanking) expect(Math.abs(Math.atan2(Math.sin(bearing(s) - Math.PI), Math.cos(bearing(s) - Math.PI)))).toBeGreaterThan(0.3);
  });
});

describe('fire, nerve and cover', () => {
  it('suppresses whoever a bolt is fired at, and the nerve comes back', () => {
    const b = newBattle(MAP, { n: 1, seed: 13 });
    chooseSide(b, 'attack');
    for (const s of b.soldiers) Object.assign(s, { frozen: true, x: s.side === 'attack' ? -10 : 10, z: 30 });
    const d = up(b, 'defend')[0];
    run(b, 4);
    expect(d.suppress).toBeGreaterThan(0);
    for (const s of b.soldiers) s.unarmed = true;
    run(b, 1 / RULES.suppressFade + 1);
    expect(d.suppress).toBe(0);
  });

  it('shoots worse with its head down', () => {
    const shots = (suppress) => {
      const b = newBattle(MAP, { n: 1, seed: 14 });
      chooseSide(b, 'attack');
      for (const s of b.soldiers) Object.assign(s, { frozen: true, x: s.side === 'attack' ? -5 : 5, z: 30 });
      const a = up(b, 'attack')[0];
      const d = up(b, 'defend')[0];
      d.unarmed = true;
      let hits = 0;
      let fired = 0;
      for (let t = 0; t < 200; t += 0.1) {
        a.suppress = suppress;
        d.hp = RULES.hp;
        for (const e of stepBattle(b, 0.1, null, env))
          if (e.type === 'shot') {
            fired++;
            if (e.hit) hits++;
          }
      }
      return hits / fired;
    };
    expect(shots(1)).toBeLessThan(shots(0) * 0.75);
  });

  it('finds cover on the far side of the nearest rock from the shooter, and nothing too small or too big', () => {
    const solids = createSolids();
    solids.circle(10, 0, 1); // a rock, between them and off to the side
    solids.circle(-3, 0, 0.2); // a stone: no cover
    solids.box(0, 20, 30, 30); // a hall: too big to get round
    const me = { x: 0, z: 0 };
    const c = coverFrom(solids, me, 40, 0);
    expect(c).toBeTruthy();
    // (behind the rock, on the side away from the shooter at +x: so at x < 10)
    expect(c[0]).toBeCloseTo(10 - 1.9, 5);
    expect(c[1]).toBeCloseTo(0, 5);
    expect(coverFrom(createSolids(), me, 40, 0)).toBeNull();
  });

  it('takes cover under fire, and a bolt finds it there less often', () => {
    const solids = createSolids();
    solids.circle(14, 30, 1.2); // a rock by the defender, between it and the attackers
    const b = newBattle(MAP, { n: 1, seed: 15 });
    chooseSide(b, 'attack');
    const a = up(b, 'attack')[0];
    const d = up(b, 'defend')[0];
    Object.assign(a, { frozen: true, x: 30, z: 30 });
    Object.assign(d, { x: 10, z: 30, spot: [10, 30], post: 'a', wait: 99, unarmed: true });
    let took = null;
    for (let t = 0; t < 30 && !took; t += 0.1) {
      stepBattle(b, 0.1, null, { solids, reach: 600 });
      d.hp = RULES.hp;
      if (d.inCover) took = t;
    }
    expect(took).not.toBeNull();
    // (behind the rock: on the far side from the attacker at +x)
    expect(d.x).toBeLessThan(14);
    // (its cover point is a step out from the rock, and it stops a pace short of that)
    expect(Math.hypot(d.x - 14, d.z - 30)).toBeLessThan(1.2 + 0.9 + 1.6);
    // and hits land at half the rate on a soldier in cover
    const rate = (inCover) => {
      let hits = 0;
      let fired = 0;
      for (let t = 0; t < 150; t += 0.1) {
        d.inCover = inCover;
        d.cover = inCover ? [d.x, d.z] : null;
        d.coverAt = b.t;
        d.hp = RULES.hp;
        for (const e of stepBattle(b, 0.1, null, { solids, reach: 600 }))
          if (e.type === 'shot') {
            fired++;
            if (e.hit) hits++;
          }
      }
      return hits / fired;
    };
    a.suppress = 0;
    const open = rate(false);
    a.suppress = 0;
    const covered = rate(true);
    expect(covered).toBeLessThan(open * 0.75);
  });

  it('moves at a crouch with its head down', () => {
    const b = newBattle(MAP, { n: 1, seed: 16 });
    chooseSide(b, 'defend');
    for (const s of up(b, 'defend')) Object.assign(s, { x: 500, z: 0, frozen: true, unarmed: true });
    const a = up(b, 'attack')[0];
    a.target = null;
    const walk = (suppress) => {
      Object.assign(a, { x: -120, z: 0, suppress, cover: null });
      run(b, 2);
      return Math.hypot(a.x + 120, a.z);
    };
    const upright = walk(0);
    const crouched = walk(1);
    expect(crouched).toBeLessThan(upright * 0.7);
  });
});

describe('the phases, the tickets and the end', () => {
  it('moves on when the attackers hold every post of the phase, topping their tickets up', () => {
    const b = empty('attack');
    b.tickets.attack = 20;
    post(b, 'a').owner = 'attack';
    post(b, 'b').owner = null;
    post(b, 'b').meter = 0.99;
    post(b, 'b').taking = 'attack';
    b.you.up = true;
    const ev = run(b, 0.5, { x: 0, z: -30 });
    expect(post(b, 'b').owner).toBe('attack');
    expect(ev.some((e) => e.type === 'phase' && e.phase === 1 && e.name === 'The last stand')).toBe(true);
    expect(b.phaseIndex).toBe(1);
    expect(b.tickets.attack).toBe(50);
    // the last phase's post is live now, the first phase's are not
    const v = battleView(b);
    expect(v.posts.find((p) => p.id === 'c').live).toBe(true);
    expect(v.posts.find((p) => p.id === 'a').live).toBe(false);
  });

  it('is won by the attackers when the last phase falls', () => {
    const b = empty('attack');
    b.phaseIndex = 1;
    post(b, 'c').owner = null;
    post(b, 'c').meter = 0.99;
    post(b, 'c').taking = 'attack';
    b.you.up = true;
    const ev = run(b, 0.5, { x: 120, z: 0 });
    expect(b.result).toMatchObject({ won: true, why: 'posts' });
    expect(ev.some((e) => e.type === 'end' && e.won === true)).toBe(true);
    expect(b.result.stars).toBe(3);
    // (and it holds there)
    run(b, 5, { x: 120, z: 0 });
    expect(b.t).toBeLessThan(2);
  });

  it('is lost by a side with no tickets and nobody up, unless you’re up on it', () => {
    const b = newBattle(MAP, { n: 2, seed: 10 });
    chooseSide(b, 'attack');
    b.tickets.attack = 0;
    b.you.up = true;
    for (const s of up(b, 'attack')) {
      s.up = false;
      s.down = 0;
    }
    run(b, RULES.respawn + 1, { x: -120, z: 0 });
    expect(b.result).toBeNull();
    youDown(b);
    const ev = run(b, 0.2, null);
    expect(b.result).toMatchObject({ won: false, why: 'tickets' });
    expect(ev.some((e) => e.type === 'end' && e.won === false)).toBe(true);
  });

  it('is won by the defenders when the attackers run dry', () => {
    const b = newBattle(MAP, { n: 2, seed: 11 });
    chooseSide(b, 'defend');
    b.tickets.attack = 0;
    for (const s of up(b, 'attack')) {
      s.up = false;
      s.down = 0;
    }
    run(b, RULES.respawn + 1, null);
    expect(b.result).toMatchObject({ won: true, why: 'tickets' });
  });

  it('takes a long frame in short steps', () => {
    const b = empty('attack');
    b.you.up = true;
    stepBattle(b, 1, { x: 0, z: 30 }, env);
    expect(post(b, 'a').meter).toBeCloseTo(1 - RULES.capture, 5);
    expect(b.t).toBeCloseTo(1, 5);
  });

  it('ends by hand, for the dev hooks', () => {
    const b = empty('defend');
    endBattle(b, false, 'posts');
    expect(b.result).toMatchObject({ won: false, why: 'posts' });
    expect(battleView(b).phase).toBe('end');
  });
});

describe('you', () => {
  it('can deploy at a post your side holds, for a ticket, and nowhere else', () => {
    const b = newBattle(MAP, { n: 0, seed: 12 });
    chooseSide(b, 'attack');
    expect(canDeploy(b, post(b, 'a'))).toBe(false);
    expect(deploy(b, 'a')).toBeNull();
    expect(b.tickets.attack).toBe(60);
    const at = deploy(b, 'line');
    expect(at).toBeTruthy();
    expect(Math.hypot(at.x + 120, at.z)).toBeLessThanOrEqual(20);
    expect(typeof at.yaw).toBe('number');
    expect(b.you.up).toBe(true);
    expect(b.tickets.attack).toBe(59);
    // a contested post of yours: not while the enemy's in it
    post(b, 'a').owner = 'attack';
    post(b, 'a').inside = { attack: 0, defend: 2 };
    expect(canDeploy(b, post(b, 'a'))).toBe(false);
    post(b, 'a').inside = { attack: 0, defend: 0 };
    expect(canDeploy(b, post(b, 'a'))).toBe(true);
  });

  it('are pointed at your side’s objective', () => {
    const b = empty('attack');
    expect(objectiveFor(b, 'attack', -120, 0)).toEqual([0, 30]);
    expect(objectiveFor(b, 'defend', 0, 30)).toEqual([0, 30]);
    post(b, 'a').owner = 'attack';
    expect(objectiveFor(b, 'attack', -120, 0)).toEqual([0, -30]);
  });

  it('see the battle as the HUD does: every post lettered, a key that changes with it', () => {
    const b = empty('attack');
    const v = battleView(b);
    expect(v.phase).toBe('run');
    expect(v.phaseName).toBe('The front');
    expect(v.phaseCount).toBe(2);
    expect(v.posts.map((p) => p.letter)).toEqual(['', 'A', 'B', 'C', '']);
    expect(v.tickets).toEqual({ attack: 60, defend: 90 });
    expect(v.you).toMatchObject({ side: 'attack', up: false, kills: 0, captures: 0, in: null });
    const k = v.key;
    post(b, 'a').owner = null;
    expect(battleView(b).key).not.toBe(k);
    b.you.up = true;
    run(b, 0.1, { x: 0, z: 30 });
    expect(battleView(b).you.in).toBe('a');
    expect(battleView(b).you.state).toBe('taking');
  });
});

describe('a whole battle, with nobody playing', () => {
  const sim = (tickets, n, seed) => {
    const b = newBattle({ ...MAP, tickets }, { n, seed });
    chooseSide(b, 'attack');
    for (let t = 0; t < 900 && !b.result; t += 0.1) stepBattle(b, 0.1, null, env);
    return b;
  };
  it('is won by the attackers with the reinforcements on their side', () => {
    const b = sim({ attack: 400, defend: 12 }, 6, 21);
    expect(b.result?.won).toBe(true);
  });
  it('is won by the defenders when the attackers run out', () => {
    const b = sim({ attack: 8, defend: 400 }, 6, 22);
    expect(b.result?.won).toBe(false);
  });
});
