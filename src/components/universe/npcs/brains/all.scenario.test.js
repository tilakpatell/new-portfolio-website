// What every brain promises, whatever you do: over SEEDS meetings each, with
// you flown by a script drawn from the seed (a speed, a turn, a stop, a
// boost, hunters about or not), no number ever goes NaN or infinite; it
// turns and speeds up no faster than its ship's stats allow; the same seed
// gives the same meeting to the last bit; and it never hangs about
// forever: each brain ends (or parks, the merchant's ending) in its time.
import { describe, expect, it } from 'vitest';
import { BRAINS } from '../../npcRules';
import { NPC } from './common';
import { DT, foe, meet, seeded, you } from './harness';

const SEEDS = 200;
const SECONDS = 8;
const STATS = { speed: 22, accel: 18, turn: 2.6, hp: 16, fire: [0.5, 0.9], damage: 6 };

// you, as the seed has it: a speed, a turn, perhaps a stop or a boost at a moment, perhaps hunters
function script(seed) {
  const r = seeded(seed * 7919 + 1);
  const speed = r() * 12;
  const turn = (r() - 0.5) * 1.5;
  const change = r() * SECONDS;
  const then = r() < 0.5 ? 0 : NPC.run * 1.5;
  const hunters = r() < 0.3 ? [{ id: 1, at: { x: 40 * (r() - 0.5), y: 0, z: 40 * (r() - 0.5) }, faction: 'pirates', vel: { x: 0, y: 0, z: 0 } }] : [];
  const at = { x: 60 * (r() - 0.5), y: 4 * (r() - 0.5), z: 60 * (r() - 0.5) };
  return {
    at,
    ship: you({ speed }),
    steer: (s, t) => ({ ...s, heading: s.heading + turn * DT, speed: t < change ? speed : then }),
    world: () => ({ hunters, stations: [{ at: { x: 0, y: 0, z: -70 }, r: 10 }], next: 'hunters', heat: r() * 3 }),
  };
}

const finite = (o) => Object.values(o).every((v) => (typeof v === 'number' ? Number.isFinite(v) : v && typeof v === 'object' ? finite(v) : true));
const angle = (a, b) => {
  const la = Math.hypot(a.x, a.y, a.z);
  const lb = Math.hypot(b.x, b.y, b.z);
  return Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb))));
};

describe.each(Object.keys(BRAINS))('every %s, over many meetings', (brain) => {
  it(`never goes NaN, and turns and speeds up within its stats (${SEEDS} seeds)`, () => {
    const bad = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      let prev = null;
      meet({
        brain,
        npc: foe(brain, { stats: STATS }),
        seed,
        seconds: SECONDS,
        ...script(seed),
        each: (m, s, out, t) => {
          for (const e of out.events) if (!finite(e)) bad.push(`seed ${seed} t ${t.toFixed(2)}: ${JSON.stringify(e)}`);
          if (!m) return;
          if (!finite(m.pos) || !finite(m.vel)) bad.push(`seed ${seed} t ${t.toFixed(2)}: at ${JSON.stringify(m.pos)}`);
          const v = { ...m.vel };
          if (prev && !m.delegated) {
            const s0 = Math.hypot(prev.x, prev.y, prev.z);
            const s1 = Math.hypot(v.x, v.y, v.z);
            if (s1 - s0 > STATS.accel * DT + 1e-9 || s0 - s1 > STATS.accel * DT * 1.5 + 1e-9) bad.push(`seed ${seed} t ${t.toFixed(2)}: speed ${s0.toFixed(3)} to ${s1.toFixed(3)}`);
            if (s0 >= 0.5 && s1 > 1e-6 && angle(prev, v) > STATS.turn * DT + 1e-6) bad.push(`seed ${seed} t ${t.toFixed(2)}: turned ${angle(prev, v).toFixed(4)} rad in a frame`);
          }
          prev = v;
        },
      });
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('flies the same meeting from the same seed, to the last bit', () => {
    for (const seed of [3, 17, 101]) {
      const a = meet({ brain, npc: foe(brain, { stats: STATS }), seed, seconds: SECONDS, ...script(seed) });
      const b = meet({ brain, npc: foe(brain, { stats: STATS }), seed, seconds: SECONDS, ...script(seed) });
      expect(b.trace).toEqual(a.trace);
      expect(b.events).toEqual(a.events);
    }
  });
});

// how each brain's meeting ends (its header): the ones handed over end at once; the merchant
// parks and waits for you (its ending); the nemesis keeps its modes moving
const ENDS = { bounty: 'delegated', wingman: 'delegated', merchant: 'parked' };

describe('no brain hangs about for ever', () => {
  it.each(Object.keys(BRAINS))('a %s with you sat still ends its meeting, or parks, inside two minutes', (brain) => {
    let ended = null;
    meet({
      brain,
      npc: foe(brain, { stats: STATS }),
      at: { x: 0, y: 0, z: -20 },
      seconds: 120,
      world: () => ({ stations: [{ at: { x: 0, y: 0, z: -70 }, r: 10 }], next: 'hunters' }),
      each: (m, s, out, t) => {
        if (ended) return;
        if (!m || m.leaving) ended = 'gone';
        else if (m.delegated) ended = 'delegated';
        else if (m.mind.parked) ended = 'parked';
        if (ended) ended = `${ended} at ${t.toFixed(0)} s`;
      },
    });
    expect(ended, brain).toMatch(new RegExp(`^${ENDS[brain] ?? 'gone'} `));
  });

  it('a nemesis never holds one move for over a minute', () => {
    for (const seed of [1, 2, 3]) {
      let mode = null;
      let since = 0;
      let longest = 0;
      meet({
        brain: 'nemesis',
        seed,
        ...script(seed),
        seconds: NPC.nemesis + 5,
        each: (m, s, out, t) => {
          if (!m || m.leaving) return;
          if (m.mind.mode !== mode) {
            mode = m.mind.mode;
            since = t;
          }
          longest = Math.max(longest, t - since);
        },
      });
      expect(longest).toBeLessThan(60);
    }
  });
});
