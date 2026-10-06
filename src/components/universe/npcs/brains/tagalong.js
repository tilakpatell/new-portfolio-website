// A tagalong (Jerry): a friend who follows you about. It comes up off your
// left wing, says hello, and flies along with you, with a word every
// NPC.chatter seconds (chat1, chat2, chat3, then quiet). When hunters
// come near you it panics and runs for a spot NPC.hide away from them,
// hides there until they've been gone a few seconds, and comes back with
// a word about it (a second panic has its own line). After NPC.tag
// seconds it's had enough and goes home. It never fires.
import { NPC, add, apart, forwardOf, nearest, rightOf, sub, unit, velocityOf } from './common';

export default function tagalong(npc, me, world, dt) {
  const m = me.mind;
  const you = world.you;
  if (!you) return { leave: true };
  if (me.clock > NPC.tag) return { leave: true };
  const { it: threat, d: near } = nearest(world.hunters, you);
  if (threat && near < NPC.fear) {
    // off, away from them
    if (!m.hiding) {
      m.hiding = true;
      m.panics = (m.panics ?? 0) + 1;
    }
    m.calm = 0;
    m.hide = add(you, unit(sub(you, threat.at)), NPC.hide);
    return { to: m.hide, speed: npc.stats.speed * 1.4, say: m.panics > 1 ? 'panic2' : 'panic' };
  }
  if (m.hiding) {
    m.calm = (m.calm ?? 0) + dt;
    if (m.calm < 3) return { to: m.hide };
    m.hiding = false;
    m.back = true;
  }
  // off your left wing, a little behind and below
  const spot = add(add(add(you, rightOf(you), -NPC.alongside), forwardOf(you), -2), { x: 0, y: -0.5, z: 0 });
  const match = velocityOf(you);
  const speed = Math.max(npc.stats.speed, (you.speed ?? 0) + 6);
  let say = null;
  if (!m.hello) {
    if (apart(me.pos, spot) > 3) return { to: spot, match, speed };
    m.hello = true;
    m.chatAt = me.clock + NPC.chatter;
    say = 'hello';
  } else if (m.back) {
    m.back = false;
    say = 'back';
  } else if (me.clock > m.chatAt) {
    m.chatAt = me.clock + NPC.chatter;
    m.chat = (m.chat ?? 0) + 1;
    if (m.chat <= 3) say = `chat${m.chat}`;
  }
  return { to: spot, match, speed, say };
}
tagalong.lines = ['panic', 'panic2', 'back', 'chat1', 'chat2', 'chat3']; // (the lines a crew must have for one, beyond everyone's)
