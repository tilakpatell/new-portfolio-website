// A battle's fighters flown with tactics (battleAi.js flies them; this is
// what the galaxy's battles ask for with createBattle's `tactics`, and the
// universe map's wars don't). Pure (no three.js), tested in Node through
// battle.js.
//
// Left to themselves the fighters picked a new target every half second,
// so a dogfight was a swarm that never finished a pass; interceptors mobbed
// the bombers (a bomber counted as eight times nearer than it was), so the
// side with fewer bombers never got one through; and once the other side's
// fighters were down, the rest circled the middle and shot at nothing. So:
// - a fighter weighs what it could go after (utility.js's pick: the nearer
//   the better, the one it's on a little better still) and keeps what it
//   chose a while: TACTICS.commit seconds at least, while it's there;
// - a bomber chooses at the start of a run and keeps it till its torpedo's
//   away or the target's gone; a defender's goes for one of the attacker's
//   ships, the same one, not a fresh point on a fresh ship every half
//   second;
// - an interceptor counts a bomber as nearer than it is (TACTICS.bombers,
//   on the distance squared: not the old 0.12), and any fighter takes one
//   of three tokens a bomber has to go after it (squad.js's): a fourth
//   looks elsewhere (bombers flying into a line had six or seven on them);
// - with no enemy fighter near, a fighter strafes: the other side's
//   batteries (an AI's bolt takes one of a battery's hp, so a run down a
//   hull can silence it), the objectives of the stage, or the hull itself.
//
// createTactics(k) → { think(f, dt), drop(f) }: think chooses what a fighter
// goes after (when it's time to), drop lets go of a fighter's tokens when
// it's down. `k` is the battle's inner context (battle.js's createBattle).

import { pick } from '../../lib/ai/utility';
import { createTokens } from '../../lib/ai/squad';
import { BATTLE, dist2 } from './battleKit';

export const TACTICS = {
  think: 0.5, // seconds between a fighter weighing up what to go after
  commit: 2.5, // and the least it keeps what it chose, while that's there (a dogfighter)
  momentum: 0.4, // how much more what it's on already counts
  bombers: 0.35, // an interceptor counts a bomber this much nearer, on the distance squared
  intercepts: 3, // interceptors at most after one bomber
  friend: 0.5, // one after a friend, this much nearer
  runners: 0.3, // and a runner for the jump
  reach: 35, // how far off a target counts for half as much
  strafe: 80, // with no enemy fighter this near, a fighter strafes
  batteries: 4, // (the nearest this many of the other side's batteries, to choose among)
  flight: 3, // fighters to a flight, each flight of one kind
  release: 26, // how far off a ship's hull a bomber looses its torpedo (outside point-defence's 25)
};

const near = (d2) => 1 / (1 + d2 / (TACTICS.reach * TACTICS.reach));
const idOf = (t, you) => (t === you ? 'you' : (t?.id ?? t?.num ?? t?.key ?? null));

export function createTactics(k) {
  const { b, rand } = k;
  const tokens = createTokens({ pools: { intercept: TACTICS.intercepts }, timeout: Infinity });
  const alive = (t) => Boolean(t) && (t === b.you ? k.youIn() : t.alive !== false);

  // a point on one of the other side's capital ships, there while the ship is
  const hullPoint = (cap) => {
    const sp = cap.spheres[Math.floor(rand() * cap.spheres.length)];
    return {
      id: `hull:${cap.id}`,
      pos: sp.c,
      r: sp.r,
      cap,
      get alive() {
        return cap.alive && cap.dying <= 0;
      },
    };
  };
  const foes = (team) => b.capitals.filter((c) => c.team !== team && c.alive && c.dying <= 0);
  // the objectives a side's after now: the stage's (open), or the objective ship's of the phase
  const objectivesFor = (team) => {
    if (team !== k.attacker) return [];
    if (b.objectives) return b.objectives.filter((o) => o.alive && !o.zone && !o.hidden && o.phase === b.phase && (!b.isOpen || b.isOpen(o)));
    const ship = k.objOf();
    return ship?.alive ? ship.subs.filter((s) => s.alive && !s.hidden && s.phase === b.phase) : [];
  };

  // a run down the other side's hulls: its nearest batteries, the objectives of the stage, or the hull itself
  const strafeOptions = (f, opts) => {
    const best = [];
    for (const cap of foes(f.team))
      for (const tu of cap.turrets) {
        if (!tu.alive) continue;
        const d = dist2(tu.at, f.pos);
        if (best.length < TACTICS.batteries || d < best[best.length - 1][0]) {
          best.push([d, tu]);
          best.sort((p, q) => p[0] - q[0]);
          if (best.length > TACTICS.batteries) best.pop();
        }
      }
    for (const [d, tu] of best) opts.push({ id: tu.num, weight: near(d) * 0.6, t: tu });
    for (const o of objectivesFor(f.team)) opts.push({ id: o.num, weight: near(dist2(o.pos, f.pos)) * 0.8, t: o });
    if (!opts.length) {
      let ship = null;
      let sd = Infinity;
      for (const cap of foes(f.team)) {
        const d = dist2(cap.pos, f.pos);
        if (d < sd) (sd = d), (ship = cap);
      }
      if (ship) opts.push({ id: `hull:${ship.id}`, weight: near(sd) * 0.5, t: hullPoint(ship) });
    }
  };

  // what a dogfighter (or an interceptor) goes after
  const chooseFighter = (f) => {
    const opts = [];
    let closest = Infinity;
    for (const o of b.fighters) {
      if (!o.alive || o.team === f.team) continue;
      let d = dist2(o.pos, f.pos);
      if (d < closest) closest = d;
      if (o.role === 'bomber') {
        // (three after one bomber's enough, whatever they fly: a fourth looks elsewhere)
        if (!tokens.held('intercept', f.id, o.id) && tokens.count('intercept', o.id) >= TACTICS.intercepts) continue;
        if (f.role === 'interceptor') d *= TACTICS.bombers;
      } else if (o.target && o.target !== b.you && o.target.team === f.team) d *= TACTICS.friend;
      opts.push({ id: o.id, weight: near(d), t: o });
    }
    for (const r of b.runners) if (r.alive && r.team !== f.team) opts.push({ id: r.id, weight: near(dist2(r.pos, f.pos) * TACTICS.runners), t: r });
    if (closest > TACTICS.strafe * TACTICS.strafe) strafeOptions(f, opts);
    // you: a couple always on you while you're near (Battlefront's fights come to the player), more if you're the nearest
    if (k.youIn() && b.you.team !== f.team) {
      const d = dist2(b.you.pos, f.pos);
      const on = f.target === b.you;
      if (!on && b.you.on < 2 && d < 70 * 70) return b.you;
      if (on || b.you.on < BATTLE.onYou) opts.push({ id: 'you', weight: near(d * 0.35), t: b.you });
    }
    const got = pick(opts, null, { current: idOf(f.target, b.you), momentum: TACTICS.momentum });
    return got ? opts.find((o) => o.id === got.id).t : null;
  };

  // what a bomber's run is at
  const chooseBomber = (f) => {
    // a runner of the other side's, half the runs there's one (the nearest)
    let run = null;
    let rd = Infinity;
    for (const r of b.runners) {
      if (!r.alive || r.team === f.team) continue;
      const d = dist2(r.pos, f.pos);
      if (d < rd) (rd = d), (run = r);
    }
    if (run && rand() < 0.5) return run;
    // the objectives of the stage (the nearest), for the attacker
    let obj = null;
    let od = Infinity;
    for (const o of objectivesFor(f.team)) {
      const d = dist2(o.pos, f.pos);
      if (d < od) (od = d), (obj = o);
    }
    if (obj) return obj;
    // one of the other side's ships, kept to till it's gone
    const caps = foes(f.team).filter((c) => c.tracked);
    return caps.length ? hullPoint(caps[Math.floor(rand() * caps.length)]) : null;
  };

  const claim = (f, t) => {
    if (f.token != null) tokens.release('intercept', f.id, f.token);
    f.token = null;
    if (t && t.role === 'bomber' && t !== b.you && tokens.claim('intercept', f.id, { target: t.id })) f.token = t.id;
  };

  return {
    // the kind of each of a side's `n` fighters: its kinds shared out among
    // flights of three by their weights (the largest remainders), a flight of
    // bombers at least where there are two flights or more, in a seeded
    // order. (A fighter at a time drawn by weight, a side could go without
    // bombers at all, and its fight never reached the other side's ships.)
    kinds(team, n) {
      const list = b.teams[team].side.fighters;
      const flights = Math.ceil(n / TACTICS.flight);
      if (!flights || !list.length) return [];
      const total = list.reduce((sum, o) => sum + o.weight, 0);
      const share = list.map((o, i) => ({ i, exact: (o.weight / total) * flights, n: Math.floor((o.weight / total) * flights) }));
      let left = flights - share.reduce((sum, o) => sum + o.n, 0);
      for (const o of [...share].sort((p, q) => q.exact - q.n - (p.exact - p.n) || p.i - q.i)) if (left-- > 0) o.n += 1;
      const bomber = list.findIndex((o) => o.role === 'bomber');
      if (bomber >= 0 && flights >= 2 && !share.some((o) => list[o.i].role === 'bomber' && o.n > 0)) {
        share.reduce((p, q) => (q.n > p.n ? q : p)).n -= 1;
        share[bomber].n += 1;
      }
      const order = share.flatMap((o) => Array.from({ length: o.n }, () => list[o.i]));
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      return Array.from({ length: n }, (_, i) => order[Math.floor(i / TACTICS.flight)]);
    },
    // what `f` goes after: weighed again when it's time, kept a while once chosen
    think(f, dt) {
      f.retarget -= dt;
      const there = alive(f.target);
      if (there && f.retarget > 0) return;
      f.retarget = TACTICS.think;
      let t;
      if (f.role === 'bomber') {
        // (its run's target, till the torpedo's away or it's gone)
        if (there && !f.rethink) return;
        f.rethink = false;
        t = chooseBomber(f);
      } else {
        if (there && b.clock - (f.chose ?? -Infinity) < TACTICS.commit) return;
        t = chooseFighter(f);
      }
      if (t === f.target) return;
      const was = f.target;
      claim(f, t);
      f.target = t;
      f.chose = b.clock;
      if (was === b.you) b.you.on = Math.max(0, b.you.on - 1);
      if (t === b.you) b.you.on += 1;
    },
    // a fighter down: its token let go
    drop(f) {
      claim(f, null);
      f.rethink = false;
      f.chose = -Infinity;
    },
  };
}
