// An informant (Mike, Squanchy): flies up alongside you, says hello and
// tells you what the director has coming next (a `tip` event with
// world.next, which the scene voices), flies along a moment, and goes.
import { NPC, add, apart, rightOf, velocityOf } from './common';

export default function informant(npc, me, world) {
  const m = me.mind;
  const you = world.you;
  if (!you) return { leave: true };
  // off your right wing, a little above
  const spot = add(add(you, rightOf(you), NPC.alongside), { x: 0, y: 0.6, z: 0 });
  const match = velocityOf(you);
  if (!m.told) {
    if (apart(me.pos, spot) > 2.5) return { to: spot, match, speed: Math.max(npc.stats.speed, (you.speed ?? 0) + NPC.overtake) };
    m.told = true;
    m.at = me.clock;
    return { to: spot, match, say: 'hello', event: { type: 'tip', next: world.next ?? null } };
  }
  if (me.clock - m.at > NPC.tell) return { leave: true };
  return { to: spot, match };
}
informant.tells = true; // (it has word of what's coming: the scene asks the director while one's about)
