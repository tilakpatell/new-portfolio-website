// Named characters with their own heads: Saul parked at a station with a
// deal, Mike alongside you with word of what's coming, Evil Morty circling
// you for a duel he means to call a draw. Each is a registry row
// (npcs/index.js: who, whose side, which ship, which brain, who they fear
// and who they hunt, and their stats) and a brain (npcs/brains/: a small
// state machine on plain numbers). This runs them all the same way, each
// frame, and says what each wants (where it flies, what it fires at, what
// it says); npcs.js draws them and the scene voices them. Pure (no
// three.js), so it's tested in Node; the design is
// docs/superpowers/specs/2026-10-06-universe-sides-design.md, part 4.
//
// A brain: (npc, me, world, dt, rand) → intent, where `me` is the one
// flying ({ n, id, npc, pos, vel, hp, hpMax, clock, leaving, mind: its own
// notes }) and the intent { to?: point it flies to, match?: a velocity it
// flies along with (yours, alongside), speed?, fire?: 'you' | a hunter's id,
// say?: a line's key, event?: { type, … }, leave?: true, delegate?: { via:
// 'wing', kind } | { via: 'hunt', faction } (the wing or the hunt flies it:
// wingRules.js, hunterRules.js) }.
//
// Relations, the same for every brain: one that `fears` a faction leaves
// when one of them comes near it; one that `hunts` a faction goes after one
// near you and shoots at that instead of doing what it was doing.
//
// createBrains({ rand, firstId }) → { add(npc, at) → id | null, remove(id),
//   update(dt, world) → { events }, hit(id, damage) → { id, kind, at, down } | null,
//   live, targets }
// world: { you: { x, y, z, heading, speed } | null, hunters: [{ id, at,
//   faction }], stations: [{ id, at, r }], solids: [{ at: [x, y, z], r }],
//   next: the director's next event ({ id, in }) }
// Events: { type: 'say', n, id, key } ('seen', 'hello', 'hit', 'leaving'),
// { type: 'delegate', n, via, kind | faction }, { type: 'offer', n },
// { type: 'tip', n, next }, { type: 'shot', n, from, to, at, hit, damage },
// { type: 'fled', n, faction }, { type: 'draw', n }, { type: 'downed', n },
// { type: 'gone', n }. `n` is the one's number (its id on the guns).

import { clearOf, turnToward } from './hunterRules';
import { NPC, add, apart, nearest, sub, unit } from './npcs/brains/common';
import wingman from './npcs/brains/wingman';
import bounty from './npcs/brains/bounty';
import merchant from './npcs/brains/merchant';
import informant from './npcs/brains/informant';
import rival from './npcs/brains/rival';

export { NPC };
export const BRAINS = { wingman, bounty, merchant, informant, rival };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const between = (rand, [a, b]) => a + rand() * (b - a);

// (numbered well clear of the hunters' and the skirmishes': the lock follows a number)
export function createBrains({ rand = Math.random, firstId = 900001, brains = BRAINS } = {}) {
  const live = [];
  const targets = [];
  const later = []; // what happened between frames (a hit), told on the next
  let nextId = firstId;
  const dir = [0, 0, 1];
  const wantDir = [0, 0, 1];

  const take = (me) => {
    const i = live.indexOf(me);
    if (i >= 0) live.splice(i, 1);
  };
  const say = (events, me, key) => {
    if (me.said.has(key)) return;
    me.said.add(key);
    events.push({ type: 'say', n: me.n, id: me.npc.id, key });
  };
  const leave = (events, me) => {
    if (me.leaving) return;
    me.leaving = true;
    me.left = me.clock;
    say(events, me, 'leaving');
  };

  return {
    live,

    // a character comes in at `at`: its number, or null for one without a brain
    add(npc, at) {
      if (!brains[npc?.brain]) return null;
      const n = nextId++;
      const hp = npc.stats?.hp ?? 4;
      live.push({ n, id: n, npc, pos: { ...at }, vel: { x: 0, y: 0, z: 0 }, hp, hpMax: hp, clock: 0, cool: 1 + rand(), far: 0, leaving: false, left: 0, delegated: false, said: new Set(), mind: {} });
      return n;
    },
    remove(n) {
      const me = live.find((o) => o.n === n);
      if (me) take(me);
    },

    update(dt, world) {
      const events = later.splice(0);
      const you = world.you ?? null;
      for (const me of [...live]) {
        const { npc } = me;
        const st = npc.stats ?? {};
        me.clock += dt;
        let intent;
        if (me.delegated) continue; // (the wing or the hunt has it now)
        // who it fears, near it: it's off
        if (!me.leaving) {
          const { it: dread } = nearest(world.hunters, me.pos, (h) => npc.relations?.fears?.includes(h.faction));
          if (dread && apart(dread.at, me.pos) < NPC.fear) {
            events.push({ type: 'fled', n: me.n, faction: dread.faction });
            leave(events, me);
          }
        }
        if (me.leaving) {
          // away from you, climbing, a little quicker than it came
          const from = you ?? { x: me.pos.x, y: me.pos.y, z: me.pos.z + 1 };
          const out = unit(add(sub(me.pos, from), { x: 0, y: 0.3, z: 0 }));
          intent = { to: add(me.pos, out, 50), speed: (st.speed ?? 16) * 1.3 };
          if ((you && apart(me.pos, you) > NPC.leaveFar) || me.clock - me.left > NPC.leaveFor) {
            take(me);
            events.push({ type: 'gone', n: me.n });
            continue;
          }
        } else if (brains[npc.brain].delegates) {
          // (the wing or the hunt flies this one, relations and all: handed over at once)
          intent = brains[npc.brain](npc, me, world, dt, rand) ?? {};
        } else {
          // one it hunts, near you: after it
          const { it: quarry } = you ? nearest(world.hunters, you, (h) => npc.relations?.hunts?.includes(h.faction)) : { it: null };
          if (quarry && apart(quarry.at, you) < NPC.huntFrom) intent = { to: add(quarry.at, unit(sub(me.pos, quarry.at)), 6), fire: quarry.id };
          else intent = brains[npc.brain](npc, me, world, dt, rand) ?? {};
        }
        if (intent.delegate) {
          me.delegated = true;
          events.push({ type: 'delegate', n: me.n, ...intent.delegate });
          continue;
        }
        // (the greeting first, then the news: a tip or an offer after hello)
        if (intent.say) say(events, me, intent.say);
        if (intent.event) events.push({ ...intent.event, n: me.n });
        if (intent.leave) {
          leave(events, me);
          intent = { to: null };
        }

        // flying: its nose comes round at its own rate, and it speeds up or
        // slows to what it wants (to stop, at a place; along with you, beside you)
        const match = intent.match ?? { x: 0, y: 0, z: 0 };
        let wx = match.x;
        let wy = match.y;
        let wz = match.z;
        if (intent.to) {
          const d = sub(intent.to, me.pos);
          const l = Math.hypot(d.x, d.y, d.z);
          const go = Math.min(intent.speed ?? st.speed ?? 16, l * 1.5);
          if (l > 1e-4) {
            wx += (d.x / l) * go;
            wy += (d.y / l) * go;
            wz += (d.z / l) * go;
          }
        }
        const want = Math.hypot(wx, wy, wz);
        const s0 = Math.hypot(me.vel.x, me.vel.y, me.vel.z);
        if (s0 > 1e-4) {
          dir[0] = me.vel.x / s0;
          dir[1] = me.vel.y / s0;
          dir[2] = me.vel.z / s0;
        }
        if (want > 1e-4) {
          wantDir[0] = wx / want;
          wantDir[1] = wy / want;
          wantDir[2] = wz / want;
          // (from a standstill it can point any way it likes)
          if (s0 < 0.5) [dir[0], dir[1], dir[2]] = wantDir;
          else turnToward(dir, wantDir, (st.turn ?? 2.4) * dt);
        }
        const s1 = s0 + clamp(want - s0, -(st.accel ?? 14) * dt * 1.5, (st.accel ?? 14) * dt);
        me.vel.x = dir[0] * s1;
        me.vel.y = dir[1] * s1;
        me.vel.z = dir[2] * s1;
        me.pos.x += me.vel.x * dt;
        me.pos.y += me.vel.y * dt;
        me.pos.z += me.vel.z * dt;
        if (world.solids?.length) clearOf(me.pos, world.solids, 0.5);

        // firing: at you or at a hunter, in range (most shots miss: a cloud, not a wall)
        me.cool -= dt;
        if (intent.fire != null && !me.leaving && me.cool <= 0) {
          const tgt = intent.fire === 'you' ? you : world.hunters?.find((h) => h.id === intent.fire)?.at;
          const d = tgt ? apart(tgt, me.pos) : Infinity;
          if (d < NPC.range) {
            me.cool = between(rand, st.fire ?? [0.8, 1.4]);
            const chance = clamp(0.5 * (1 - d / NPC.range) + 0.1, 0.05, 0.45);
            events.push({ type: 'shot', n: me.n, from: { ...me.pos }, to: { x: tgt.x, y: tgt.y, z: tgt.z }, at: intent.fire, hit: rand() < chance, damage: intent.fire === 'you' ? (st.damage ?? 6) : 1 });
          }
        }

        // seen you; and let go of, once you're far away for long enough
        if (you) {
          const d = apart(me.pos, you);
          if (d < NPC.seen) say(events, me, 'seen');
          me.far = d > NPC.far ? me.far + dt : 0;
        } else me.far += dt;
        if (me.far > NPC.forget) {
          take(me);
          events.push({ type: 'gone', n: me.n });
        }
      }
      return { events };
    },

    // a hit on one by its number: what became of it (only an enemy's on the
    // guns, but anyone can be hit by a stray shot)
    hit(n, damage = 1) {
      const me = live.find((o) => o.n === n);
      if (!me || me.delegated) return null;
      me.hp -= damage;
      const out = { id: me.n, kind: me.npc.ship, at: { ...me.pos }, size: me.npc.size ?? 0.4, down: me.hp <= 0 };
      if (out.down) {
        take(me);
        later.push({ type: 'downed', n: me.n });
      } else if (!me.said.has('hit')) {
        me.said.add('hit');
        later.push({ type: 'say', n: me.n, id: me.npc.id, key: 'hit' });
      }
      return out;
    },

    // the ones the guns may lock on to: an enemy still in the fight
    get targets() {
      targets.length = 0;
      for (const me of live) {
        if (me.npc.role !== 'enemy' || me.leaving || me.delegated) continue;
        me.target ??= { id: me.n, at: me.pos, vel: me.vel, size: me.npc.size ?? 0.4, kind: me.npc.ship, hp: me.hp, hpMax: me.hpMax, faction: me.npc.id, threat: 1 };
        me.target.hp = me.hp;
        targets.push(me.target);
      }
      return targets;
    },
  };
}
