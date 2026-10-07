// A trickster (Hondo Ohnaka): a pirate with a toll to collect, as a script
// (lib/ai/tree: a sequence the brain resumes where it was each frame). It
// comes alongside and names its price (its hello: hold still and pay up).
// Hold still (under NPC.hold) for NPC.scan seconds and it looks you over,
// finds nothing worth the taking, and, being a pirate of honour, pays you
// back with word of what's coming (a `tip` event with world.next, the
// informant's: the scene voices it by what comes) and goes. Fly off, keep
// it waiting past NPC.toll, or shoot it, and it's angry: it calls its
// friends in (a `busted` event: the scene sends the pack of its faction)
// and fights you itself, breaking off hurt or after a while. It knows you
// as it perceives you (npcRules.js): lose it, and it goes.
import { DONE, RUNNING, sequence, tick } from '../../../../lib/ai/tree';
import { NPC, add, apart, forwardOf, rightOf, velocityOf } from './common';

const spotBy = (you) => add(add(add(you, forwardOf(you), 8), rightOf(you), -5), { x: 0, y: 0.6, z: 0 });

const SCRIPT = sequence(
  (bb) => {
    const { npc, me, you } = bb.ctx;
    const spot = spotBy(you);
    if (apart(me.pos, spot) > 3) {
      bb.out = { to: spot, match: velocityOf(you), speed: Math.max(npc.stats.speed, (you.speed ?? 0) + 8) };
      return RUNNING;
    }
    return DONE;
  },
  (bb) => {
    const { me, you, world } = bb.ctx;
    bb.at = me.clock;
    bb.held = 0;
    bb.away = 0;
    // (a friend of pirates, standing.js's world.friend, flies free, and gets the word anyway)
    bb.out = world.friend ? { leave: true, say: 'friend', event: { type: 'tip', next: world.next ?? null } } : { to: spotBy(you), match: velocityOf(you), say: 'hello' };
    return DONE;
  },
  (bb, dt) => {
    const { me, you, world, turn } = bb.ctx;
    // (the frame the greeting was said, that's the intent: the watch starts next frame; a wave-through ends the script)
    if (bb.out) return bb.out.leave ? DONE : RUNNING;
    bb.held = Math.abs(you.speed ?? 0) < NPC.hold ? bb.held + dt : 0;
    bb.away = apart(me.pos, you) > NPC.ignore || Math.abs(you.speed ?? 0) > NPC.run ? bb.away + dt : 0;
    if (bb.held >= NPC.scan) {
      bb.out = { leave: true, say: 'paid', event: { type: 'tip', next: world.next ?? null } };
      return DONE;
    }
    if (bb.away > 2.5 || me.clock - bb.at > NPC.toll) {
      bb.out = turn('angry');
      return DONE;
    }
    bb.out = { to: spotBy(you), match: velocityOf(you) };
    return RUNNING;
  },
);

export default function trickster(npc, me, world, dt) {
  const m = me.mind;
  const you = world.you;
  if (!you) return { leave: true };
  const turn = (why) => {
    m.hostile = true;
    m.hostileAt = me.clock;
    if (me.memory) me.memory.grudge = (me.memory.grudge ?? 0) + 1;
    return { hostile: true, fire: 'you', say: why, event: { type: 'busted', faction: npc.faction, size: 3, why: why ?? 'shot' }, to: spotBy(you), match: velocityOf(you) };
  };
  if (m.hostile) {
    if (me.clock - m.hostileAt > NPC.duel || me.hp <= me.hpMax * 0.3) return { leave: true };
    m.a = (m.a ?? 0) + dt * 0.5;
    const spot = add(add(add(you, rightOf(you), Math.cos(m.a) * NPC.orbit), forwardOf(you), (Math.sin(m.a) + 0.4) * NPC.orbit), { x: 0, y: Math.sin(m.a * 1.7) * 2, z: 0 });
    return { to: spot, match: velocityOf(you), fire: 'you' };
  }
  if ((me.hurt ?? 0) > 0) return turn(null);
  if (m.done) return { to: spotBy(you), match: velocityOf(you) };
  m.ctx = { npc, me, you, world, turn };
  m.out = null;
  if (tick(SCRIPT, m, dt) !== RUNNING) m.done = true;
  return m.out ?? { to: spotBy(you), match: velocityOf(you) };
}
trickster.tells = true; // (it has word of what's coming: the scene asks the director while one's about)
trickster.lines = ['paid', 'angry', 'friend']; // (the lines a crew must have for one, beyond everyone's; and a tip's, the informant's way)
