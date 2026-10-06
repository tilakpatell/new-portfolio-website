// An inspector (Imperial customs, Federation customs, Hank in his SUV):
// the law pulling you over. It comes in ahead of you, off your wing, and
// tells you to cut your engines (its hello). Hold still (under NPC.hold)
// for NPC.scan seconds and it scans you: clean (your heat under
// NPC.wanted, and no old grudge) and it says so and goes; wanted, and it
// says so, calls its faction in (a `busted` event: the scene sends the
// pack) and fights you itself. Fly off (further than NPC.ignore for a
// moment), or keep it waiting past NPC.patience, and it's the same, with a
// word about running. Shoot it and it's the same again (its hit line says
// it). Once it's fighting it's on the guns, and it breaks off hurt or after
// a while. It remembers: a grudge from last time (you shot it, or it had to
// call its friends) and you're wanted on sight.
import { NPC, add, apart, forwardOf, rightOf, velocityOf } from './common';

const spotBy = (you) => add(add(add(you, forwardOf(you), 10), rightOf(you), 5), { x: 0, y: 0.8, z: 0 });

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
  const spot = spotBy(you);
  const match = velocityOf(you);
  if (!m.told) {
    if (apart(me.pos, spot) > 3) return { to: spot, match, speed: Math.max(npc.stats.speed, (you.speed ?? 0) + 8) };
    m.told = true;
    m.at = me.clock;
    m.held = 0;
    m.away = 0;
    return { to: spot, match, say: 'hello' };
  }
  // watching you: still, and it scans; off, and it comes after you
  m.held = Math.abs(you.speed ?? 0) < NPC.hold ? m.held + dt : 0;
  m.away = apart(me.pos, you) > NPC.ignore || Math.abs(you.speed ?? 0) > NPC.run ? m.away + dt : 0;
  if (m.held >= NPC.scan) {
    // (and a pilot the law already wants, standing.js's world.wanted, on every scan)
    const wanted = Boolean(world.wanted) || (world.heat ?? 0) >= NPC.wanted || (mem.grudge ?? 0) > 0 || (mem.shot ?? 0) > 0;
    if (wanted) return turn('busted');
    return { leave: true, say: 'clean' };
  }
  if (m.away > 2.5 || me.clock - m.at > NPC.patience) return turn('run');
  return { to: spot, match };
}
inspector.lines = ['clean', 'busted', 'run']; // (the lines a crew must have for one, beyond everyone's)
