// A planned battle's objectives in the sim (battle.js fights the battle,
// battleDirector.js says how it's going, battlePlan.js says what's in it):
// the plan's objectives found on the ship they're on, and each step what
// the director says of them taken in. Pure (no three.js), tested in Node
// through battle.js.
//
// With a director the battle doesn't decide its objectives itself: each
// one's hp is the director's, so every pilot in the system sees the same;
// the stage it's in is the director's, open once the stage before it is
// down and its gate's passed (till then its objectives are shielded); the
// shield over the objective ship stands while a stage that shields it
// does. Your shots on an open stage's objectives count a punch of its hp
// each (told through onMine, for the tally), and the AI's fire on them only
// lights them up: the AI's part in them is the director's pressure curve.
// A subsystem the plan doesn't use is hidden (not there to shoot).
//
// createStages(k, plan, director) → { sync(out), hit(sub, damage, mine, out)
//   → whether it took it }, and gives the battle stageOpen, opensIn and
// shieldUp. `k` is the battle's inner context: { b, objOf(), onMine,
// subDown(sub, mine) }; `director.state()` is the director's state now.

import { BATTLE } from './battleKit';

export function createStages(k, plan, director) {
  const { b } = k;
  const ship = k.objOf();
  const planned = []; // the subsystems the plan has, each with its objective's id (`key`)
  plan.stages.forEach((stage, si) =>
    stage.objectives.forEach((o) => {
      const s = o.on?.sub ? ship?.subs.find((x) => x.id === o.on.sub) : null;
      if (!s) return;
      Object.assign(s, { phase: si + 1, key: o.id, hp: o.hp, hpMax: o.hp, planned: true });
      planned.push(s);
    }),
  );
  for (const s of ship?.subs ?? []) if (!s.planned) s.hidden = true;
  b.stageOpen = true;
  b.opensIn = 0;
  b.shieldUp = plan.stages.some((s) => s.shields);
  // (the objective ship breaks up when the chain ends on it: its reactor)
  const breaks = Boolean(plan.stages.at(-1)?.breaks);

  const objective = (st, s) => st.objectives.find((o) => o.id === s.key);
  return {
    // what the director says now, taken in: each objective's hp, the stage, the shield
    sync(out) {
      const st = director.state();
      for (const s of planned) {
        const o = objective(st, s);
        if (!o) continue;
        s.hp = o.hp;
        if (s.alive && o.down) out.push(k.subDown(s, false));
      }
      if (b.shieldUp && !st.shield) {
        b.shieldUp = false;
        out.push({ type: 'shield', down: true });
      }
      while (b.phase < st.stage + 1) {
        b.phase += 1;
        if (b.phase <= plan.stages.length) out.push({ type: 'phase', phase: b.phase });
      }
      b.stageOpen = st.open;
      b.opensIn = st.opensIn;
      if (breaks && st.stage >= plan.stages.length && ship?.alive && ship.dying <= 0) ship.dying = BATTLE.dying;
    },
    // a shot on one of them: yours counted, if its stage is open (and the
    // director asked straight away whether that was the one that took it)
    hit(s, dmg, mine, out) {
      if (!s.planned || s.phase !== b.phase || !b.stageOpen || !mine) return false;
      if (s.cap?.disabled > 0) dmg *= BATTLE.ionSubs;
      k.onMine?.(s.key, dmg);
      const o = objective(director.state(), s);
      if (o) s.hp = o.hp;
      if (o?.down && s.alive) out.push(k.subDown(s, true));
      return true;
    },
  };
}
