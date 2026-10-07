// A battle's runners for the jump (battle.js fights the battle; this flies
// its runners): ships making for a point beyond the fight, gone after by
// the other side's fighters and by you. Some are the set pieces' own (Hoth's
// transports: addRunner); some decide the battle (an evacuation's or a
// blockade's, `runners` { team, kind, size, hp, count, need, speed, every,
// from, to, spread }: one launched every `every` seconds from about `from`
// for about `to`; `need` of them out wins it for their side, all of them
// down with fewer out loses it). Pure (no three.js), tested in Node through
// battle.js.
//
// createRunners(k, runners) → { launch(dt), fly(dt, out), judge(out, from) },
// and gives the battle addRunner({ team, kind, size, hp, from, to, speed }).
// `k` is the battle's inner context (battle.js's createBattle makes it):
// { b, rand, newId(), finish(winner, why, out) }.

import { NAMES } from './wars';
import { copy, len, set, v3 } from './battleKit';

const tmp = v3();

export function createRunners(k, runners) {
  const { b, rand } = k;
  const run = runners ? { ...runners, launched: 0, out: 0, wait: 0 } : null;

  b.addRunner = ({ team, kind, size, hp, from, to, speed }) => {
    const r = { id: k.newId(), team, kind, size, hp, hpMax: hp, role: 'runner', pos: v3(from.x, from.y, from.z), prev: v3(from.x, from.y, from.z), seen: v3(from.x, from.y, from.z), vel: v3(), fwd: v3(0, 0, 1), to: v3(to.x, to.y, to.z), speed, alive: true, escaped: false, hitBy: 0, chased: -1 };
    r.tgt = { id: r.id, at: r.seen, vel: r.vel, size, kind, name: NAMES[kind] ?? kind, hp, hpMax: hp, threat: 0 };
    b.runners.push(r);
    return r;
  };

  return {
    // the battle's own, one every `every` seconds
    launch(dt) {
      if (!run || b.over || run.launched >= run.count) return;
      run.wait -= dt;
      if (run.wait > 0) return;
      run.wait = run.every;
      const sp = run.spread ?? 6;
      const jitter = (p) => ({ x: p[0] + (rand() - 0.5) * sp, y: p[1] + (rand() - 0.5) * sp * 0.4, z: p[2] + (rand() - 0.5) * sp });
      b.addRunner({ team: run.team, kind: run.kind, size: run.size, hp: run.hp, from: jitter(run.from), to: jitter(run.to), speed: run.speed });
      run.launched += 1;
    },
    // each straight for its jump point, and gone when it's there
    fly(dt, out) {
      for (const r of b.runners) {
        if (!r.alive) continue;
        copy(r.prev, r.pos);
        set(tmp, r.to.x - r.pos.x, r.to.y - r.pos.y, r.to.z - r.pos.z);
        const d = len(tmp);
        const step = r.speed * dt;
        if (d <= step) {
          copy(r.pos, r.to);
          r.alive = false;
          r.escaped = true;
          out.push({ type: 'escaped', id: r.id, team: r.team, kind: r.kind, at: copy(v3(), r.pos) });
          continue;
        }
        set(r.fwd, tmp.x / d, tmp.y / d, tmp.z / d);
        set(r.vel, r.fwd.x * r.speed, r.fwd.y * r.speed, r.fwd.z * r.speed);
        r.pos.x += r.vel.x * dt;
        r.pos.y += r.vel.y * dt;
        r.pos.z += r.vel.z * dt;
      }
    },
    // the battle's own decide it: enough of them out, or all of them down (events from `from` on: this step's)
    judge(out, from) {
      if (!run || b.over) return;
      for (let i = from; i < out.length; i++) if (out[i].type === 'escaped' && out[i].team === run.team) run.out += 1;
      if (run.out >= run.need) k.finish(run.team, 'runners', out);
      else if (run.launched >= run.count && !b.runners.some((r) => r.alive && r.team === run.team)) k.finish(1 - run.team, 'runners', out);
    },
  };
}
