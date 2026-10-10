import { describe, expect, it } from 'vitest';
import { DIRECTOR, createDirector, scaleOf } from './battleDirector';

// a plan of the classic chain: the flagship's two shield generators, its
// bridge, its reactor, each stage open no sooner than its gate
const chain = (o = {}) => ({
  id: 'c0.gcw.yavin.3',
  kind: 'assault',
  length: 600,
  attacker: 0,
  defender: 1,
  ai: { tAi: [540, 800] },
  stages: [
    { id: 'shield', type: 'group', need: 2, opensAt: 0, shields: true, objectives: [{ id: 'gen-port', type: 'destroy', kind: 'shieldgen', hp: 140 }, { id: 'gen-star', type: 'destroy', kind: 'shieldgen', hp: 140 }] },
    { id: 'bridge', type: 'destroy', opensAt: 150, objectives: [{ id: 'bridge', type: 'destroy', kind: 'bridge', hp: 300 }] },
    { id: 'reactor', type: 'destroy', opensAt: 300, why: 'flagship', objectives: [{ id: 'reactor', type: 'destroy', kind: 'reactor', hp: 420 }] },
  ],
  runners: null,
  side: [],
  losses: [],
  ...o,
});
const none = () => 0;
const tally = (o) => (k) => o[k] ?? 0;
const hpOf = (st, id) => st.objectives.find((o) => o.id === id).hp;
const KEY = /^[a-z0-9][a-z0-9:._-]{0,47}$/;

describe('the shared battle director', () => {
  it('is the same battle for the same seed: the AI’s pace seeded inside its range', () => {
    const a = createDirector({ plan: chain(), seed: 'c0.gcw.yavin.3' });
    const b = createDirector({ plan: chain(), seed: 'c0.gcw.yavin.3' });
    expect(a.tAi).toBe(b.tAi);
    expect(a.tAi).toBeGreaterThanOrEqual(540);
    expect(a.tAi).toBeLessThanOrEqual(800);
    const paces = new Set(Array.from({ length: 20 }, (_, i) => createDirector({ plan: chain(), seed: `s${i}` }).tAi));
    expect(paces.size).toBeGreaterThan(15);
  });

  it('lets the AI alone take the chain in order, the shield first', () => {
    const d = createDirector({ plan: chain(), seed: 'order' });
    const early = d.state(60, none);
    expect(early.stage).toBe(0);
    expect(hpOf(early, 'gen-port')).toBeLessThan(140);
    expect(hpOf(early, 'bridge')).toBe(300);
    expect(early.shield).toBe(true);
    // (one generator at a time: the AI's fire focused, the first down before the second's touched)
    expect(hpOf(early, 'gen-star')).toBe(140);
    const later = d.state(400, none);
    expect(later.stage).toBeGreaterThanOrEqual(1);
    expect(later.shield).toBe(false);
  });

  it('is path independent: the state worked out cold at any second is the one stepped to from the start', () => {
    const v = tally({ 'gen-port': 60, bridge: 120, 'g:gen-star': 3, 'here:a': 2 });
    const stepped = createDirector({ plan: chain(), seed: 'path' });
    const seen = [];
    for (let t = 0; t <= 600; t += 1) seen[t] = JSON.stringify(stepped.state(t, v));
    for (const t of [0, 1, 149, 150, 299, 300, 451, 540, 599, 600]) expect(JSON.stringify(createDirector({ plan: chain(), seed: 'path' }).state(t, v)), `t ${t}`).toBe(seen[t]);
  });

  it('is monotone in time: an objective never comes back, and the battle only moves on', () => {
    for (const seed of ['m1', 'm2', 'm3']) {
      const d = createDirector({ plan: chain(), seed });
      const v = tally({ 'gen-port': 30, 'g:bridge': 2 });
      let last = d.state(0, v);
      for (let t = 1; t <= 600; t += 1) {
        const st = d.state(t, v);
        expect(st.stage).toBeGreaterThanOrEqual(last.stage);
        st.objectives.forEach((o, i) => {
          expect(o.hp, `${seed} ${o.id} at ${t}`).toBeLessThanOrEqual(last.objectives[i].hp + 1e-9);
          if (last.objectives[i].down) expect(o.down).toBe(true);
        });
        if (last.winner !== null) expect(st.winner).toBe(last.winner);
        last = st;
      }
    }
  });

  it('is monotone in each tally value: the pilots’ damage only takes, a defender’s intercepts only shore up', () => {
    const d = createDirector({ plan: chain(), seed: 'tally' });
    for (const t of [100, 250, 420]) {
      const base = d.state(t, none);
      const hit = d.state(t, tally({ 'gen-port': 50, bridge: 80 }));
      const held = d.state(t, tally({ [`g:${base.target}`]: 4 }));
      base.objectives.forEach((o, i) => {
        expect(hit.objectives[i].hp, `${o.id} at ${t}`).toBeLessThanOrEqual(o.hp + 1e-9);
        expect(held.objectives[i].hp, `${o.id} at ${t}`).toBeGreaterThanOrEqual(o.hp - 1e-9);
      });
    }
  });

  it('opens a stage no sooner than its gate, however much the pilots have done', () => {
    const d = createDirector({ plan: chain(), seed: 'gate' });
    const all = tally({ 'gen-port': 1e4, 'gen-star': 1e4, bridge: 1e4, reactor: 1e4 });
    const at = (t) => d.state(t, all);
    expect(at(10).stage).toBe(1);
    expect(at(10).stages[1].open).toBe(false);
    expect(at(10).opensIn).toBeCloseTo(140, 6);
    expect(at(150).stages[1].open).toBe(true);
    expect(at(299).winner).toBeNull();
    expect(at(300)).toMatchObject({ winner: 0, why: 'flagship' });
    expect(at(320).endsAt).toBeCloseTo(300, 1);
  });

  it('never brings back an objective that’s down when a defender shores up the one under attack', () => {
    const d = createDirector({ plan: chain(), seed: 'shore' });
    const st = d.state(200, tally({ 'gen-port': 140 }));
    const target = st.target;
    expect(st.objectives.find((o) => o.id === target).down).toBe(false);
    const down = st.objectives.filter((o) => o.down).map((o) => o.id);
    const after = d.state(200, tally({ 'gen-port': 140, [`g:${target}`]: 30 }));
    for (const id of down) expect(after.objectives.find((o) => o.id === id).down, id).toBe(true);
    expect(hpOf(after, target)).toBeGreaterThan(hpOf(st, target));
  });

  it('scales the pilots’ damage by how many are in it, on each side', () => {
    expect(scaleOf(0)).toBe(1);
    expect(scaleOf(1)).toBe(1);
    expect(scaleOf(2)).toBe(1 + DIRECTOR.step);
    expect(scaleOf(6)).toBe(1 + DIRECTOR.step * DIRECTOR.most);
    expect(scaleOf(40)).toBe(scaleOf(6));
    const d = createDirector({ plan: chain(), seed: 'scale' });
    expect(d.scale(0, tally({ 'here:a': 3, 'here:d': 1 }))).toBe(scaleOf(3));
    expect(d.scale(1, tally({ 'here:a': 3, 'here:d': 1 }))).toBe(1);
  });

  it('ends at the clock for the defender, if nothing’s decided it before', () => {
    let held = null;
    for (let i = 0; i < 40 && !held; i++) {
      const d = createDirector({ plan: chain(), seed: `clock${i}` });
      if (d.state(600, none).winner === 1) held = d;
    }
    expect(held).toBeTruthy();
    expect(held.state(599.9, none).winner).toBeNull();
    expect(held.state(600, none)).toMatchObject({ winner: 1, why: 'clock', endsAt: 600 });
  });

  it('counts a bomber wave’s hits on arrival, less each one intercepted', () => {
    const plan = chain({ side: [{ id: 'w0', type: 'wave', team: 0, at: 180, n: 6, travel: 30 }] });
    const d = createDirector({ plan, seed: 'wave' });
    const before = d.state(209, none);
    expect(before.waves[0]).toMatchObject({ launched: true, arrived: false });
    const hit = d.state(210, none);
    const stopped = d.state(210, tally({ w0: 3 }));
    expect(hit.waves[0].arrived).toBe(true);
    const lost = (st) => st.objectives.reduce((s, o) => s + (o.hpMax - o.hp), 0);
    expect(lost(hit)).toBeGreaterThan(lost(before));
    expect(lost(stopped)).toBeLessThan(lost(hit));
    expect(stopped.waves[0].left).toBeLessThan(hit.waves[0].left);
  });

  it('flies an ace from its time, with its hull the pilots’ to share, and its fall worth something to the other side', () => {
    const plan = chain({ side: [{ id: 'ace-1', type: 'ace', team: 1, at: 240, hp: 48 }] });
    const d = createDirector({ plan, seed: 'ace' });
    expect(d.state(200, none).aces[0]).toMatchObject({ launched: false, hp: 48, down: false });
    expect(d.state(260, tally({ 'ace:1': 20 })).aces[0]).toMatchObject({ launched: true, hp: 28 });
    const lost = (st) => st.objectives.reduce((s, o) => s + (o.hpMax - o.hp), 0);
    const up = d.state(300, tally({ 'ace:1': 10 }));
    const down = d.state(300, tally({ 'ace:1': 48 }));
    expect(down.aces[0].down).toBe(true);
    expect(lost(down)).toBeGreaterThan(lost(up));
  });

  it('loses its capital ships when their time comes', () => {
    const d = createDirector({ plan: chain({ losses: [{ team: 1, index: 2, at: 250 }] }), seed: 'loss' });
    expect(d.state(249, none).losses[0].dead).toBe(false);
    expect(d.state(250, none).losses[0].dead).toBe(true);
  });

  it('names every tally key it reads, each one the tally takes, well under a battle’s eighty', () => {
    const plan = chain({ side: [{ id: 'w0', type: 'wave', team: 0, at: 180, n: 6, travel: 30 }, { id: 'ace-1', type: 'ace', team: 1, at: 240, hp: 48 }], runners: { team: 1, count: 8, need: 6, startAt: 30, every: 60, duration: 70, hp: 34, luck: [0.5, 1.5], safe: 2 } });
    const keys = createDirector({ plan, seed: 'keys' }).keys();
    expect(keys).toContain('here:a');
    expect(keys).toContain('g:bridge');
    expect(keys).toContain('r:7');
    expect(keys).toContain('ace:1');
    for (const k of keys) expect(k).toMatch(KEY);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeLessThanOrEqual(80);
  });
});

describe('the director’s runners', () => {
  const runners = { team: 1, count: 8, need: 6, startAt: 30, every: 60, duration: 70, hp: 34, luck: [0.5, 1.5], safe: 2 };
  const plan = (o = {}) => chain({ runners: { ...runners, ...o }, ai: { tAi: [5000, 5001] } });

  it('launches each at its own second of the battle, whenever you came', () => {
    const d = createDirector({ plan: plan(), seed: 'launch' });
    const st = d.state(300, none);
    expect(st.runners.filter((r) => r.launched)).toHaveLength(Math.floor((300 - 30) / 60) + 1);
    expect(st.runners[0]).toMatchObject({ launchAt: 30, endAt: 100 });
    expect(st.runners[2].k).toBe(1);
    expect(st.runners[4].k).toBeCloseTo((300 - 270) / 70, 6);
  });

  it('shoots one down that the pilots have, and covers one its escorts have', () => {
    const d = createDirector({ plan: plan(), seed: 'fates' });
    expect(d.state(60, tally({ 'r:0': 34 })).runners[0].down).toBe(true);
    const bare = d.state(400, none).runners[5];
    const covered = d.state(400, tally({ 'c:5': 4 })).runners[5];
    expect(covered.hp).toBeGreaterThanOrEqual(bare.hp);
  });

  it('decides the battle: enough out wins it for their side, too many down loses it', () => {
    const out = createDirector({ plan: plan({ luck: [0, 0.01] }), seed: 'out' }).state(600, none);
    expect(out).toMatchObject({ winner: 1, why: 'runners' });
    expect(out.endsAt).toBeCloseTo(30 + 5 * 60 + 70, 6);
    const shot = createDirector({ plan: plan(), seed: 'shot' }).state(600, tally({ 'r:0': 99, 'r:1': 99, 'r:2': 99 }));
    expect(shot).toMatchObject({ winner: 0, why: 'runners' });
  });
});
