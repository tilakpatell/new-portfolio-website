// A galaxy battle's shared course: what every pilot in it sees of its
// objectives, its runners, its losses and its end, worked out from nothing
// but the battle's seed, the clock they all share (seconds since it began)
// and the tally of what the pilots have done (universe/tally.js's totals).
// Pure, and nothing's kept from one call to the next, so a pilot who drops
// in nine minutes into a battle sees the battle one who's been there from
// the start does: the state worked out cold is the state stepped to.
//
// The dogfight each pilot flies in (battle.js) is the spectacle and their
// part in it. The AI's part in how the battle comes out is this: a pressure
// curve. The attacker's AI wears the defender's objectives down at a pace
// seeded for the battle (tAi: the seconds it would take alone, before the
// final push at DIRECTOR.push steepens it), in the plan's order
// (battlePlan.js), one objective at a time, as a fleet's fire would be
// focused. What the pilots do changes it:
// - an attacker's shots on an objective take its hp (the objective's id is
//   its key, each shot already divided by how many attacker pilots there
//   are: scale), but only once its stage is open, the stage before it down
//   and its gate (opensAt) passed. However many pilots there are, a battle
//   isn't over before its last gate.
// - a defender's intercepts (an attacker's bomber down) shore up the
//   objective the AI's on (`g:<id>`, DIRECTOR.credit hp each). Only the one
//   under attack is shored up, so it can only ever raise one still standing.
// - the runners an evacuation or a blockade decides (`runners`): each
//   launched at its own second of the battle, worn down along its way by a
//   seeded share of the AI's fire (the first few, out before the attacker's
//   net has closed, never finished by it alone), spared some of it by its
//   escorts' kills near it (`c:<i>`) and hurt by the pilots against it
//   (`r:<i>`).
// - a bomber wave (type 'wave' among the plan's `side`): its hits on the
//   defender counted when it gets there, less the bombers the AI brought
//   down and those the defender's pilots did (its id's key).
// - an ace (type 'ace'): in the fight from its time, its hull shared by the
//   pilots who shoot at it (`ace:<team>`); the defender's down is worth
//   DIRECTOR.ace hp to the attacker's AI.
// - the capital ships lost along the way (`losses`): gone at their times.
// The attacker wins when the chain's done; the runners' side when enough are
// out, the other side when too many are down, whichever comes first; the
// defender when the clock runs out.
//
// createDirector({ plan, seed }) → { plan, tAi, keys(), scale(team, value),
//   state(t, value) → { t, stage, open, opensIn, shield, target, stages:
//   [{ id, opensAt, open, done }], objectives: [{ id, stage, kind, type, hp,
//   hpMax, down }], runners: [{ i, launchAt, endAt, k, hp, hpMax, launched,
//   out, down }] | null, waves: [{ id, at, arriveAt, n, left, launched,
//   arrived }], aces: [{ id, team, hp, hpMax, launched, down }], losses:
//   [{ team, index, at, dead }], winner, why, endsAt } }
// `value(key)` is the tally's total for a key; `target` is the objective the
// AI's on (where a defender's intercepts go); scaleOf(n) is what each of n
// pilots' damage is divided by.

import { seededRand } from './battleKit';
import { keysOf, progressOf } from './battleObjectives';

export const DIRECTOR = {
  length: 600, // seconds of fighting
  push: 480, // the final push: the AI's pressure steeper from here
  boost: 1.5, // and how much steeper
  tAi: [540, 800], // the seconds of pressure the AI alone needs for the chain, seeded in this range
  credit: 8, // hp an intercept shores up the objective under attack by
  wave: 9, // hp each bomber of a wave that gets through takes off
  ace: 40, // hp the defender's ace down is worth to the attacker's AI
  step: 0.5, // each pilot on a side past the first adds this to what its damage is divided by
  most: 5, // (up to this many of them)
  cover: 0.12, // of the AI's fire on a runner, each kill near it by its escorts takes this much off
};

// the AI's pressure's clock: a second a second, then steeper from the final push
const g = (t) => (t <= DIRECTOR.push ? t : DIRECTOR.push + DIRECTOR.boost * (t - DIRECTOR.push));
const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
// how much of the AI's fire a runner has taken, by how far along its way it
// is: little as it sets out and at the end, most through the fight between
const worn = (k) => {
  const x = clamp01((k - 0.1) / 0.8);
  return x * x * (3 - 2 * x);
};
// the earliest second in [lo, hi] that `yes` holds at, given it holds at hi and from then on
const earliest = (lo, hi, yes) => {
  for (let i = 0; i < 40 && hi - lo > 0.005; i++) {
    const m = (lo + hi) / 2;
    if (yes(m)) hi = m;
    else lo = m;
  }
  return hi;
};
const needOf = (s) => s.need ?? s.objectives.length;

export const scaleOf = (n) => 1 + DIRECTOR.step * Math.min(DIRECTOR.most, Math.max(0, Math.floor(n) - 1));

export function createDirector({ plan, seed }) {
  const rand = seededRand(`dir-${seed}`);
  const [lo, hi] = plan.ai?.tAi ?? DIRECTOR.tAi;
  const tAi = lo + rand() * (hi - lo);
  const length = plan.length ?? DIRECTOR.length;
  const attacker = plan.attacker ?? 0;
  const defender = plan.defender ?? 1 - attacker;
  const stages = plan.stages ?? [];
  // the hp the AI has to get through alone: each stage's first `need` (it takes them in order)
  const H = stages.reduce((sum, s) => sum + s.objectives.slice(0, needOf(s)).reduce((a, o) => a + o.hp, 0), 0);
  const waves = (plan.side ?? []).filter((o) => o.type === 'wave').map((w) => ({ ...w, arriveAt: w.at + (w.travel ?? 30), aiKills: Math.floor(w.n * (0.15 + rand() * 0.3)) }));
  const aces = (plan.side ?? []).filter((o) => o.type === 'ace');
  const R = plan.runners ?? null;
  const luck = R ? Array.from({ length: R.count }, () => R.luck[0] + rand() * (R.luck[1] - R.luck[0])) : [];

  // the AI's pressure by `t`: its curve, and what's come of the waves and the
  // aces since. (The curve's for the chain less what the AI's own waves will
  // strike if nobody stops them, so the AI alone, waves and all, still takes
  // tAi, and every bomber of a wave a defender brings down is a real loss to it.)
  const W = waves.reduce((sum, w) => sum + DIRECTOR.wave * Math.max(0, w.n - w.aiKills), 0);
  const base = (t) => (Math.max(H / 2, H - W) * g(t)) / tAi;
  const bonus = (t, v) => {
    let b = 0;
    for (const w of waves) if (t >= w.arriveAt) b += DIRECTOR.wave * Math.max(0, w.n - w.aiKills - v(w.id));
    for (const a of aces) if (a.team === defender && t >= a.at && v(`ace:${a.team}`) >= a.hp) b += DIRECTOR.ace;
    return b;
  };
  // what the pilots have done to an objective, in its hp (battleObjectives.js:
  // shots by its id, or for a zone the seconds the attackers held it net of
  // the defenders')
  const pilotOf = (o, v) => progressOf(o, v);

  // the chain at `t`: the AI's pressure taken through it in order, each
  // stage's share no more than what's built up since its gate
  const flow = (t, v) => {
    const B = bonus(t, v);
    let budget = base(t) + B;
    const outStages = [];
    const outObjs = [];
    let stage = stages.length;
    let target = null;
    let shield = false;
    let blocked = false;
    stages.forEach((s, si) => {
      const need = needOf(s);
      const open = !blocked && t >= s.opensAt;
      const ms = s.objectives.map((o) => {
        const rem = Math.max(0, o.hp + DIRECTOR.credit * v(`g:${o.id}`) - (open ? pilotOf(o, v) : 0));
        return { o, rem, ai: 0, down: open && rem <= 0 };
      });
      let done = false;
      if (!blocked) {
        let downs = ms.filter((m) => m.down).length;
        const cap = open ? Math.max(0, base(t) - base(s.opensAt) + B) : 0;
        const avail = Math.min(budget, cap);
        let used = 0;
        for (const m of ms) {
          if (downs >= need) break;
          if (m.down) continue;
          const take = Math.min(m.rem, avail - used);
          m.ai = take;
          used += take;
          if (take < m.rem) break;
          m.down = true;
          downs += 1;
        }
        done = downs >= need;
        if (done) budget -= used;
        else {
          blocked = true;
          stage = si;
          target = (ms.find((m) => !m.down && m.ai > 0) ?? ms.find((m) => !m.down))?.o.id ?? null;
        }
      }
      if (!done && s.shields) shield = true;
      outStages.push({ id: s.id, opensAt: s.opensAt, open, done });
      for (const m of ms) outObjs.push({ id: m.o.id, stage: si, kind: m.o.kind, type: m.o.type, hp: Math.max(0, Math.min(m.o.hp, m.rem - m.ai)), hpMax: m.o.hp, down: m.down });
    });
    return { stages: outStages, objectives: outObjs, stage, target, shield, done: stage >= stages.length };
  };

  // the runners at `t`: each one's state, and whether they've decided it (and when)
  const runnersAt = (t, v) => {
    if (!R) return null;
    const list = [];
    const events = [];
    for (let i = 0; i < R.count; i++) {
      const L = R.startAt + i * R.every;
      const E = L + R.duration;
      // (the first `safe` of them out before the net's closed: worn, never finished, by the AI alone)
      const h = R.hp * (i < (R.safe ?? 0) ? Math.min(0.9, 0.45 * luck[i]) : luck[i]);
      const m = Math.max(0.15, 1 - DIRECTOR.cover * v(`c:${i}`));
      const shot = v(`r:${i}`);
      const hpAt = (tt) => R.hp - h * m * worn((tt - L) / R.duration) - shot;
      const launched = t >= L;
      const end = Math.min(t, E);
      const down = launched && hpAt(end) <= 0;
      const out = launched && !down && t >= E;
      list.push({ i, launchAt: L, endAt: E, k: clamp01((t - L) / R.duration), hp: launched ? Math.max(0, Math.min(R.hp, hpAt(end))) : R.hp, hpMax: R.hp, launched, out, down });
      if (out) events.push({ at: E, out: true });
      if (down) events.push({ at: hpAt(L) <= 0 ? L : earliest(L, end, (tt) => hpAt(tt) <= 0), out: false });
    }
    events.sort((a, b) => a.at - b.at || (a.out ? -1 : 1));
    let outs = 0;
    let downs = 0;
    let decided = null;
    for (const e of events) {
      if (e.out) outs += 1;
      else downs += 1;
      if (outs >= R.need) decided = { winner: R.team, why: 'runners', at: e.at };
      else if (downs > R.count - R.need) decided = { winner: 1 - R.team, why: 'runners', at: e.at };
      if (decided) break;
    }
    return { list, decided };
  };

  return {
    plan,
    tAi,
    // every tally key the battle's plan reads
    keys() {
      const out = ['here:a', 'here:d'];
      for (const s of stages) for (const o of s.objectives) out.push(...keysOf(o), `g:${o.id}`);
      if (R) for (let i = 0; i < R.count; i++) out.push(`r:${i}`, `c:${i}`);
      for (const o of [...waves, ...aces]) out.push(...keysOf(o));
      return [...new Set(out)];
    },
    // what each pilot's damage on `team`'s side is divided by: as many more as there are of them
    scale: (team, value) => scaleOf(value(team === attacker ? 'here:a' : 'here:d')),
    state(t, value = () => 0) {
      const v = (k) => {
        const x = +value(k);
        return x > 0 && Number.isFinite(x) ? x : 0;
      };
      // (past the clock it's as it was at the clock: the lull changes nothing)
      const T = Math.min(length, Math.max(0, +t || 0));
      const c = flow(T, v);
      const r = runnersAt(T, v);
      const ends = [];
      if (c.done) ends.push({ winner: attacker, why: stages.at(-1)?.why ?? 'objectives', at: earliest(0, T, (x) => flow(x, v).done) });
      if (r?.decided) ends.push(r.decided);
      ends.sort((a, b) => a.at - b.at);
      const end = ends[0] ?? (T >= length ? { winner: defender, why: 'clock', at: length } : null);
      const st = c.stages[c.stage];
      return {
        t: T,
        stage: c.stage,
        open: st ? st.open : true,
        opensIn: st && !st.open ? Math.max(0, st.opensAt - T) : 0,
        shield: c.shield,
        target: c.target,
        stages: c.stages,
        objectives: c.objectives,
        runners: r?.list ?? null,
        waves: waves.map((w) => ({ id: w.id, at: w.at, arriveAt: w.arriveAt, n: w.n, left: Math.max(0, w.n - w.aiKills - v(w.id)), launched: T >= w.at, arrived: T >= w.arriveAt })),
        aces: aces.map((a) => {
          const hp = Math.max(0, a.hp - v(`ace:${a.team}`));
          return { id: a.id, team: a.team, hp, hpMax: a.hp, launched: T >= a.at, down: hp <= 0 };
        }),
        losses: (plan.losses ?? []).map((l) => ({ ...l, dead: T >= l.at })),
        winner: end?.winner ?? null,
        why: end?.why ?? null,
        endsAt: end?.at ?? null,
      };
    },
  };
}
