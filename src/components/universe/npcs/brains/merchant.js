// A merchant (Saul, Lando): flies to the nearest station and parks just off
// it; when you come by, says hello and offers you a part (the scene picks
// which, from the hangar's: an `offer` event), once; leaves when you've
// gone, and runs from any fight that comes near it. It remembers being
// shot at: shoot it once and next time it has nothing for you, says so
// (`grudge`) and goes.
import { NPC, add, apart, nearest, sub, unit } from './common';

export default function merchant(npc, me, world) {
  const m = me.mind;
  m.shotBefore ??= me.memory?.shot ?? 0;
  if (nearest(world.hunters, me.pos).d < NPC.wary) return { leave: true };
  if (m.shotBefore > 0 && !m.offered && world.you && apart(world.you, me.pos) < NPC.offer) {
    m.offered = true;
    return { leave: true, say: 'grudge' };
  }
  // (and it wants nothing to do with a pilot the ordinary ships fear: standing.js's world.feared)
  if (world.feared && !m.offered && world.you && apart(world.you, me.pos) < NPC.offer) {
    m.offered = true;
    return { leave: true, say: 'shunned' };
  }
  if (!m.park) {
    const { it: st, d } = nearest(world.stations, me.pos);
    // just off the station, on the side it came from (or where it is, with
    // none near enough: out in deep space it would drive off and never be met)
    m.park = st && d - st.r < NPC.station ? add(st.at, unit(sub(me.pos, st.at)), st.r + NPC.park) : { ...me.pos };
  }
  const you = world.you;
  if (!m.parked && apart(me.pos, m.park) < 1) m.parked = true;
  if (!m.parked) return { to: m.park };
  if (!m.offered && you && apart(you, me.pos) < NPC.offer) {
    m.offered = true;
    return { to: m.park, say: 'hello', event: { type: 'offer' } };
  }
  if (m.offered && you && apart(you, me.pos) > NPC.done) return { leave: true };
  return { to: m.park };
}
merchant.lines = ['offer', 'grudge', 'shunned']; // (the lines a crew must have for one, beyond everyone's)
