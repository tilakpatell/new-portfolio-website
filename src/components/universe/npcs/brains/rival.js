// A rival (Evil Morty): another pilot's shape. It circles you and shoots,
// for a while; hurt to half (or once the duel's gone on long enough), it
// calls it a draw and goes. It's on the guns while it fights. It knows you
// only as it perceives you (npcRules.js): lose it behind a moon and it
// circles its guess of you, saying so (`search`), and says so again when
// it has you back (`found`); its guess gone, it looks about where it last
// had you for NPC.search seconds, then calls it a draw.
import { NPC, add, apart, forwardOf, rightOf, velocityOf } from './common';

export default function rival(npc, me, world, dt) {
  const m = me.mind;
  const you = world.you;
  m.side ??= me.n % 2 ? 1 : -1;
  m.a = (m.a ?? 0) + dt * 0.45 * m.side;
  if (me.hp <= me.hpMax / 2 || me.clock > NPC.duel) return { leave: true, event: { type: 'draw' } };
  if (!you) {
    m.lostFor = (m.lostFor ?? 0) + dt;
    if (m.lostFor > NPC.search || !me.last) return { leave: true, event: { type: 'draw' } };
    return { to: add(me.last, { x: Math.cos(m.a) * NPC.orbit, y: 0, z: Math.sin(m.a) * NPC.orbit }), speed: npc.stats.speed * 0.8, say: 'search' };
  }
  m.lostFor = 0;
  let say = null;
  if (you.guessed) {
    if (!m.searching) {
      m.searching = true;
      say = 'search';
    }
  } else if (m.searching) {
    m.searching = false;
    say = 'found';
  }
  // round you, a little ahead more often than not (where you can see it)
  const f = forwardOf(you);
  const r = rightOf(you);
  const c = Math.cos(m.a);
  const s = Math.sin(m.a);
  const spot = add(add(add(you, r, c * NPC.orbit), f, (s + 0.4) * NPC.orbit), { x: 0, y: Math.sin(m.a * 1.7) * 2, z: 0 });
  // (a word as it comes in: a rival wants you to know who it is)
  if (apart(me.pos, you) < NPC.orbit * 1.6) say ??= 'hello';
  return { to: spot, match: velocityOf(you), fire: 'you', say };
}
rival.lines = ['search', 'found']; // (the lines a crew must have for one, beyond everyone's)
