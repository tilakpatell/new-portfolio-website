// A rival (Evil Morty): another pilot's shape. It circles you and shoots,
// for a while; hurt to half (or once the duel's gone on long enough), it
// calls it a draw and goes. It's on the guns while it fights.
import { NPC, add, apart, forwardOf, rightOf, velocityOf } from './common';

export default function rival(npc, me, world, dt) {
  const m = me.mind;
  const you = world.you;
  if (!you) return { leave: true };
  m.side ??= me.n % 2 ? 1 : -1;
  m.a = (m.a ?? 0) + dt * 0.45 * m.side;
  if (me.hp <= me.hpMax / 2 || me.clock > NPC.duel) return { leave: true, event: { type: 'draw' } };
  // round you, a little ahead more often than not (where you can see it)
  const f = forwardOf(you);
  const r = rightOf(you);
  const c = Math.cos(m.a);
  const s = Math.sin(m.a);
  const spot = add(add(add(you, r, c * NPC.orbit), f, (s + 0.4) * NPC.orbit), { x: 0, y: Math.sin(m.a * 1.7) * 2, z: 0 });
  // (a word as it comes in: a rival wants you to know who it is)
  const hello = apart(me.pos, you) < NPC.orbit * 1.6 ? 'hello' : null;
  return { to: spot, match: velocityOf(you), fire: 'you', say: hello };
}
