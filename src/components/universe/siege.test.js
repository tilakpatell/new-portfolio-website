import { describe, expect, it } from 'vitest';
import { BLAST_S, CORE, CORE_HP, GEN_HP, GENS, REPAIR_MS, RESPAWN_MS, blastShape, citadelGeometry, createSiege, readSiege, segmentSphere } from './siege';
import { wonderById } from './deep';

const T = 1_000_000_000_000;
const knockOutGens = (s, now = T) => {
  for (let g = 0; g < GENS; g++) for (let i = 0; i < GEN_HP; i++) s.strike(g, 1, false, now);
};

describe('siege', () => {
  it('the shield holds until every generator is down; then only heavy ordnance hurts the core', () => {
    const s = createSiege();
    expect(s.strike(CORE, 8, true, T).type).toBe('shielded');
    expect(s.strike('shield', 1, false, T).type).toBe('shielded');
    for (let i = 0; i < GEN_HP - 1; i++) expect(s.strike(0, 1, false, T).type).toBe('hit');
    expect(s.strike(0, 1, false, T)).toEqual({ type: 'gen', part: 0, left: 3 });
    expect(s.strike(0, 1, false, T)).toBeNull(); // (already down)
    knockOutGens(s);
    expect(s.state(T).shield).toBe(false);
    expect(s.strike(CORE, 1, false, T).type).toBe('deflected');
    let last;
    for (let i = 0; i < CORE_HP / 8; i++) last = s.strike(CORE, 8, true, T);
    expect(last.type).toBe('down');
    expect(s.state(T).down).toBe(true);
    expect(s.strike(1, 1, false, T)).toBeNull();
  });

  it('two pilots hitting at once both count, and agree', () => {
    const a = createSiege();
    const b = createSiege();
    a.strike(0, 5, false, T);
    b.strike(0, 5, false, T);
    a.receive('b', readSiege(b.message(), T), T);
    b.receive('a', readSiege(a.message(), T), T);
    expect(a.state(T).hp[0]).toBeCloseTo(1 - 10 / GEN_HP);
    expect(b.state(T).hp[0]).toBeCloseTo(a.state(T).hp[0]);
    // a share repeated isn't counted twice
    a.receive('b', readSiege(b.message(), T), T);
    expect(a.state(T).hp[0]).toBeCloseTo(1 - 10 / GEN_HP);
  });

  it('someone arriving late learns what was done, and that it went down', () => {
    const a = createSiege();
    knockOutGens(a);
    for (let i = 0; i < CORE_HP / 8; i++) a.strike(CORE, 8, true, T);
    const late = createSiege();
    const ev = late.receive('a', readSiege(a.message(), T + 1000), T + 1000);
    expect(ev.map((e) => e.type)).toContain('down');
    expect(late.state(T + 1000).rebuildIn).toBe(RESPAWN_MS - 1000);
  });

  it('is rebuilt after RESPAWN_MS, and an unfinished siege is repaired', () => {
    const s = createSiege();
    knockOutGens(s);
    for (let i = 0; i < CORE_HP / 8; i++) s.strike(CORE, 8, true, T);
    expect(s.tick(T + RESPAWN_MS - 1)).toBeNull();
    expect(s.tick(T + RESPAWN_MS)).toEqual({ type: 'rebuilt', epoch: 1 });
    expect(s.state(T + RESPAWN_MS).shield).toBe(true);
    s.strike(2, 3, false, T + RESPAWN_MS);
    expect(s.tick(T + RESPAWN_MS + REPAIR_MS).type).toBe('repaired');
    expect(s.state().hp[2]).toBe(1);
  });

  it('an older epoch is ignored, a newer one starts over', () => {
    const a = createSiege();
    const b = createSiege();
    knockOutGens(b);
    for (let i = 0; i < CORE_HP / 8; i++) b.strike(CORE, 8, true, T);
    b.tick(T + RESPAWN_MS); // epoch 1, whole again
    a.strike(1, 4, false, T);
    expect(b.receive('a', readSiege(a.message(), T), T)).toEqual([]);
    expect(b.state().hp[1]).toBe(1);
    a.receive('b', readSiege(b.message(), T + RESPAWN_MS), T + RESPAWN_MS);
    expect(a.epoch).toBe(1);
    expect(a.state().hp[1]).toBe(1);
  });

  it('a pilot who reloads (the same peer id, the saved shares back) and strikes again has every hit counted once', () => {
    const a = createSiege({ id: 'pilotaaaaaaaaaaa' });
    const b = createSiege({ id: 'pilotbbbbbbbbbbb' });
    for (let i = 0; i < 6; i++) a.strike(0, 1, false, T);
    for (let i = 0; i < 4; i++) b.strike(0, 1, false, T);
    b.receive('a1', readSiege(a.message(), T), T);
    a.receive('b1', readSiege(b.message(), T), T);
    // the reload: the page made again, its save back, under the same peer id (a key that lasts)
    const saved = JSON.parse(JSON.stringify(a.save(T)));
    const back = createSiege({ id: 'freshffffffffff1' });
    back.load(saved, T + 1000);
    expect(back.id).toBe('pilotaaaaaaaaaaa');
    back.receive('b1', readSiege(b.message(), T + 1000), T + 1000);
    for (let i = 0; i < 3; i++) back.strike(0, 1, false, T + 1000);
    b.receive('a1', readSiege(back.message(), T + 1000), T + 1000);
    // 13 struck: 6 and 3 by the pilot who reloaded, 4 by the other, each counted once on both screens
    expect(b.state(T + 1000).hp[0]).toBeCloseTo(1 - 13 / GEN_HP);
    expect(back.state(T + 1000).hp[0]).toBeCloseTo(1 - 13 / GEN_HP);
  });

  it('a pilot back after their save has gone (the same peer id, a new siege id) while the siege goes on has every hit counted once', () => {
    const a = createSiege({ id: 'pilotaaaaaaaaaaa' });
    const b = createSiege({ id: 'pilotbbbbbbbbbbb' });
    for (let i = 0; i < 6; i++) a.strike(0, 1, false, T);
    b.receive('a1', readSiege(a.message(), T), T);
    // the other pilot keeps it going, a hit inside every REPAIR_MS
    const M = T + 3 * 60000;
    const L = T + RESPAWN_MS + 1000;
    expect(b.tick(M)).toBeNull();
    for (let i = 0; i < 2; i++) b.strike(0, 1, false, M);
    expect(b.tick(L)).toBeNull();
    for (let i = 0; i < 2; i++) b.strike(0, 1, false, L);
    // back after RESPAWN_MS: the save's too old to take, so a new siege id, under the same peer id
    const back = createSiege({ id: 'freshffffffffff1' });
    back.load(JSON.parse(JSON.stringify(a.save(T))), L);
    expect(back.id).toBe('freshffffffffff1');
    back.receive('b1', readSiege(b.message(), L), L);
    for (let i = 0; i < 3; i++) back.strike(0, 1, false, L);
    b.receive('a1', readSiege(back.message(), L), L);
    back.receive('b1', readSiege(b.message(), L), L);
    // 13 struck: 6 before, 4 by the other pilot, 3 after, each counted once on both screens
    expect(b.state(L).hp[0]).toBeCloseTo(1 - 13 / GEN_HP);
    expect(back.state(L).hp[0]).toBeCloseTo(1 - 13 / GEN_HP);
  });

  it('takes back no save older than RESPAWN_MS, nor one that isn’t one', () => {
    const a = createSiege({ id: 'pilotaaaaaaaaaaa' });
    a.strike(0, 5, false, T);
    const saved = a.save(T);
    const late = createSiege({ id: 'freshffffffffff1' });
    late.load(saved, T + RESPAWN_MS + 1);
    expect(late.id).toBe('freshffffffffff1');
    expect(late.state(T + RESPAWN_MS + 1).hp[0]).toBe(1);
    for (const junk of [null, 'x', { ...saved, at: 'now' }, { ...saved, m: [1] }, { ...saved, i: 'NOT AN ID' }, { ...saved, i: undefined }, { ...saved, at: T + 10 * 60000 }]) {
      const s = createSiege({ id: 'freshffffffffff1' });
      s.load(junk, T);
      expect(s.state(T).hp[0]).toBe(1);
      expect(s.id).toBe('freshffffffffff1');
    }
  });

  it('counts what a peer tells under each siege id it comes to speak for, and takes a word under your own id (another tab of yours) as yours already', () => {
    const a = createSiege({ id: 'pilotaaaaaaaaaaa' });
    a.receive('p', readSiege({ e: 0, i: 'pilot00000000001', m: [3, 0, 0, 0, 0], t: [3, 0, 0, 0, 0] }, T), T);
    a.receive('p', readSiege({ e: 0, i: 'pilot00000000002', m: [4, 0, 0, 0, 0], t: [7, 0, 0, 0, 0] }, T), T);
    expect(a.state(T).hp[0]).toBeCloseTo(1 - 7 / GEN_HP);
    a.receive('q', readSiege({ e: 0, i: 'pilotaaaaaaaaaaa', m: [5, 0, 0, 0, 0], t: [9, 0, 0, 0, 0] }, T), T);
    expect(a.state(T).hp[0]).toBeCloseTo(1 - 9 / GEN_HP); // (its total, not its share again)
  });

  it('tells its id with its word, and reads a pilot’s, turning away one that isn’t one', () => {
    const z = [0, 0, 0, 0, 0];
    expect(createSiege({ id: 'pilotaaaaaaaaaaa' }).message().i).toBe('pilotaaaaaaaaaaa');
    expect('i' in createSiege().message()).toBe(false);
    expect(readSiege({ e: 0, m: z, t: z, i: 'pilot00000000001' }, T).i).toBe('pilot00000000001');
    expect('i' in readSiege({ e: 0, m: z, t: z }, T)).toBe(false);
    expect(readSiege({ e: 0, m: z, t: z, i: '<script>' }, T)).toBeNull();
  });

  it('reads only well-formed messages', () => {
    expect(readSiege(null)).toBeNull();
    expect(readSiege({ e: 0, m: [1], t: [1] })).toBeNull();
    expect(readSiege({ e: 1.5, m: [0, 0, 0, 0, 0], t: [0, 0, 0, 0, 0] })).toBeNull();
    const m = readSiege({ e: 2, m: [99, 0, 0, 0, 0], t: [0, 0, 0, 0, 999], x: T + 10 * 60000, l: T }, T);
    expect(m.m[0]).toBe(GEN_HP);
    expect(m.t[4]).toBe(CORE_HP);
    expect(m.x).toBe(0); // (from the future)
    expect(m.l).toBe(T);
  });

  it('puts the generators outside the shield, and hits spheres from outside only', () => {
    const g = citadelGeometry(wonderById('citadel'));
    for (const p of g.gens) expect(Math.hypot(p[0] - g.center[0], p[1] - g.center[1], p[2] - g.center[2])).toBeGreaterThan(g.shield + g.gen);
    expect(segmentSphere([0, 0, -10], [0, 0, 10], [0, 0, 0], 2)).toBeCloseTo(0.4);
    expect(segmentSphere([0, 0, 0], [0, 0, 10], [0, 0, 0], 2)).toBeNull();
    expect(segmentSphere([5, 0, -10], [5, 0, 10], [0, 0, 0], 2)).toBeNull();
  });

  it('the blast stays the Citadel\u2019s own size: nothing it throws out reaches past three cores', () => {
    const core = 45;
    let peak = 0;
    for (let age = 0; age <= BLAST_S; age += 0.05) {
      const b = blastShape(age, core);
      for (const k of ['flash', 'fire', 'fluid', 'shock']) {
        expect(b[k]).toBeGreaterThanOrEqual(0);
        expect(b[k]).toBeLessThanOrEqual(core * 3);
        peak = Math.max(peak, b[k]);
      }
      expect(b.flashAlpha).toBeGreaterThanOrEqual(0);
      expect(b.flashAlpha).toBeLessThanOrEqual(1);
      expect(b.shockAlpha).toBeGreaterThanOrEqual(0);
      expect(b.shockAlpha).toBeLessThanOrEqual(1);
    }
    expect(peak).toBeGreaterThan(core * 1.5); // (still a blast, not a puff)
    // the shock ring grows outward and fades as it goes; the flash is brightest early, gone by the end
    expect(blastShape(1, core).shock).toBeGreaterThan(blastShape(0.2, core).shock);
    expect(blastShape(BLAST_S, core).shockAlpha).toBe(0);
    expect(blastShape(0.15, core).flashAlpha).toBe(1);
    expect(blastShape(2, core).flashAlpha).toBe(0);
    expect(blastShape(BLAST_S, core).done).toBe(true);
    expect(blastShape(1, core).done).toBe(false);
  });
});
