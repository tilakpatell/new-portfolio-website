// An inspector (Imperial customs, Federation customs, Hank in his SUV):
// the law pulling you over, as a script (lib/ai/tree: a sequence the brain
// resumes where it was each frame). It comes in ahead of you, off your
// wing, and tells you to cut your engines (its hello). Hold still (under
// NPC.hold) for NPC.scan seconds and it scans you: clean (your heat under
// NPC.wanted, and no old grudge) and it says so and goes; wanted, and it
// says so, calls its faction in (a `busted` event: the scene sends the
// pack) and fights you itself. Fly off (further than NPC.ignore for a
// moment), or keep it waiting past NPC.patience, and it's the same, with a
// word about running. Shoot it and it's the same again (its hit line says
// it). Once it's fighting it's on the guns, and it breaks off hurt or after
// a while. It remembers: a grudge from last time (you shot it, or it had to
// call its friends) and you're wanted on sight. It knows you as it
// perceives you (npcRules.js): lose it, and it goes.
import { DONE, RUNNING, sequence, tick } from '../../../../lib/ai/tree';
import { NPC, add, apart, forwardOf, rightOf, velocityOf } from './common';

const spotBy = (you) => add(add(add(you, forwardOf(you), 10), rightOf(you), 5), { x: 0, y: 0.8, z: 0 });

// the script: come alongside, say so, then watch you until you've been
// scanned or you've run; each leaf writes what it wants into bb.out
const SCRIPT = sequence(
  (bb) => {
    const { npc, me, you } = bb.ctx;
    const spot = spotBy(you);
    if (apart(me.pos, spot) > 3) {
      bb.out = { to: spot, match: velocityOf(you), speed: Math.max(npc.stats.speed, (you.speed ?? 0) + NPC.headOff) };
      return RUNNING;
    }
    return DONE;
  },
  (bb) => {
    const { me, you } = bb.ctx;
    bb.at = me.clock;
    bb.held = 0;
    bb.away = 0;
    bb.out = { to: spotBy(you), match: velocityOf(you), say: 'hello' };
    return DONE;
  },
  (bb, dt) => {
    const { me, you, world, turn } = bb.ctx;
    // (the frame the greeting was said, that's the intent: the watch starts next frame; a wave-through ends the script)
    if (bb.out) return bb.out.leave ? DONE : RUNNING;
    bb.held = Math.abs(you.speed ?? 0) < NPC.hold ? bb.held + dt : 0;
    bb.away = apart(me.pos, you) > NPC.ignore || Math.abs(you.speed ?? 0) > NPC.run ? bb.away + dt : 0;
    if (bb.held >= NPC.scan) {
      // (and a pilot the law already wants, standing.js's world.wanted, on every scan)
      const mem = me.memory ?? {};
      const wanted = Boolean(world.wanted) || (world.heat ?? 0) >= NPC.wanted || (mem.grudge ?? 0) > 0 || (mem.shot ?? 0) > 0;
      bb.out = wanted ? turn('busted') : { leave: true, say: 'clean' };
      return DONE;
    }
    if (bb.away > 2.5 || me.clock - bb.at > NPC.patience) {
      bb.out = turn('run');
      return DONE;
    }
    bb.out = { to: spotBy(you), match: velocityOf(you) };
    return RUNNING;
  },
);

export default function inspector(npc, me, world, dt) {
  const m = me.mind;
  const you = world.you;
  if (!you) return { leave: true };
  const mem = me.memory ?? {};
  const turn = (why) => {
    m.hostile = true;
    m.hostileAt = me.clock;
    mem.grudge = (mem.grudge ?? 0) + 1;
    return { hostile: true, fire: 'you', say: why, event: { type: 'busted', faction: npc.faction, why: why ?? 'shot' }, to: spotBy(you), match: velocityOf(you) };
  };
  if (m.hostile) {
    if (me.clock - m.hostileAt > NPC.duel || me.hp <= me.hpMax * 0.3) return { leave: true };
    // round you, firing, the rival's way
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
inspector.lines = ['clean', 'busted', 'run']; // (the lines a crew must have for one, beyond everyone's)
