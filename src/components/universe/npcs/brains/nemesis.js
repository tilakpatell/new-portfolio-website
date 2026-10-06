// A nemesis (Vader, Tammy, Tuco): an enemy who comes for you in person and
// flies the fight itself. It circles you close and fast, firing; every few
// seconds it dives through a point just behind and above you (a pass) and
// swings out again; get it in front of your nose for a moment and it jinks
// off to one side, and comes back round the other. It has a word for
// everything: coming in, you hitting it (the engine's hit line), half its
// hull gone, your shields failing, breaking off. Hurt to NPC.retreat of its
// hull (or after NPC.nemesis seconds) it breaks off and goes, and it
// remembers: each time it comes back it's tougher (its hull up a quarter a
// meeting, to double), it greets you as an old enemy, and once it has a
// grudge (it had to run, or you shot it down) it brings friends (a `calls`
// event: the scene sends a small pack of its faction).
import { NPC, add, apart, forwardOf, rightOf, sub, unit, velocityOf } from './common';

export default function nemesis(npc, me, world, dt, rand) {
  const m = me.mind;
  const you = world.you;
  if (!you) return { leave: true };
  const mem = me.memory ?? { met: 1, grudge: 0 };
  if (!m.set) {
    m.set = true;
    const k = 1 + 0.25 * Math.min(4, (mem.met ?? 1) - 1);
    me.hpMax = Math.round(me.hpMax * k);
    me.hp = me.hpMax;
    m.side = me.n % 2 ? 1 : -1;
    m.a = 0;
    m.mode = 'orbit';
    m.inFront = 0;
    m.passAt = NPC.pass;
  }
  if (me.hp <= me.hpMax * NPC.retreat || me.clock > NPC.nemesis) {
    mem.grudge = (mem.grudge ?? 0) + 1;
    return { leave: true, say: 'retreat', event: { type: 'retreat' } };
  }
  const d = apart(me.pos, you);
  let say = null;
  let event = null;
  if (d < NPC.seen && !m.greeted) {
    m.greeted = true;
    say = (mem.met ?? 1) > 1 ? 'again' : 'hello';
    if ((mem.grudge ?? 0) > 0 && !m.called) {
      m.called = true;
      event = { type: 'calls', faction: npc.faction };
    }
  }
  if (me.hp <= me.hpMax / 2 && !m.half) {
    m.half = true;
    say ??= 'half';
  }
  if ((world.shield ?? 100) < 35 && !m.weak) {
    m.weak = true;
    say ??= 'weak';
  }
  const f = forwardOf(you);
  const r = rightOf(you);
  const match = velocityOf(you);
  // in front of your nose too long: it jinks off to one side, and comes back round the other
  const toMe = unit(sub(me.pos, you));
  const front = toMe.x * f.x + toMe.z * f.z;
  m.inFront = front > 0.8 && d < 28 ? m.inFront + dt : 0;
  if (m.mode !== 'jink' && m.inFront > NPC.jink) {
    m.mode = 'jink';
    m.until = me.clock + 2.2;
    m.jinkTo = add(add(add(you, r, m.side * 24), f, -6), { x: 0, y: (rand() - 0.5) * 8, z: 0 });
    m.side = -m.side;
    m.inFront = 0;
    say ??= 'evade';
  }
  if (m.mode === 'jink') {
    if (me.clock > m.until) m.mode = 'orbit';
    return { to: m.jinkTo, speed: npc.stats.speed * 1.15, say, event };
  }
  // a pass: through a point just behind and above you, then round again
  if (m.mode === 'orbit' && me.clock > m.passAt) {
    m.mode = 'pass';
    m.until = me.clock + 2.6;
    m.passAt = me.clock + NPC.pass + rand() * 3;
  }
  if (m.mode === 'pass') {
    const spot = add(add(you, f, -4), { x: 0, y: 1.5, z: 0 });
    if (me.clock > m.until || apart(me.pos, spot) < 2) m.mode = 'orbit';
    return { to: spot, match, fire: 'you', speed: npc.stats.speed * 1.1, say, event };
  }
  // round you, close and quick, a little ahead more often than not
  m.a += dt * 0.6 * m.side;
  const c = Math.cos(m.a);
  const s = Math.sin(m.a);
  const spot = add(add(add(you, r, c * NPC.orbit * 0.8), f, (s + 0.5) * NPC.orbit * 0.8), { x: 0, y: Math.sin(m.a * 1.3) * 2.5, z: 0 });
  return { to: spot, match, fire: 'you', say, event };
}
nemesis.lines = ['again', 'half', 'weak', 'evade', 'retreat']; // (the lines a crew must have for one, beyond everyone's)
