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
// What a character knows of you is what it has perceived (lib/ai/perception:
// npcs/index.js's `senses` a row): it's sent to you by the director, so it
// knows where you are when it comes; after that it sees you while nothing
// solid is between you, keeps the truth a couple of seconds after a planet
// hides you (intuition), then holds a guess that drifts the way you were
// going and fades over its memory span, and forgets you. A brain is given
// `world.you` as its character believes it (`me.you`: the truth while it can
// see you, the guess while it can't, null once it has forgotten you; and
// `me.last`, the last it had), and `world.hunters` the same way, so one
// behind a moon fires at where it thinks you are, and misses. A shot of
// yours is heard (`world.stims`: the scene's) from further than it sees.
//
// A brain: (npc, me, world, dt, rand) → intent, where `me` is the one
// flying ({ n, id, npc, pos, vel, hp, hpMax, clock, leaving, sees: whether
// it has you in sight, mind: its own notes }) and the intent { to?: point it flies to, match?: a velocity it
// flies along with (yours, alongside), speed?, fire?: 'you' | a hunter's id,
// fireRate?: of its usual time between shots (a nemesis in a fury: less),
// say?: a line's key, event?: { type, … }, leave?: true, delegate?: { via:
// 'wing', kind } | { via: 'hunt', faction } (the wing or the hunt flies it:
// wingRules.js, hunterRules.js) }.
//
// A shot at you is a throw of the dice (a cloud of fire, not a wall), and
// the dice are yours to load: turning hard, pitching hard or boosting
// takes up to NPC.dodge of a shot's chance away (`dodge`), so flying
// straight and level under fire is what gets you hit.
//
// Relations, the same for every brain: one that `fears` a faction leaves
// when one of them comes near it; one that `hunts` a faction goes after one
// near you and shoots at that instead of doing what it was doing.
//
// Memory: every character remembers you between meetings (`memory`, kept
// by whoever made the brains, for the visit: by character id, { met: how
// many times it's come, shot: how often you've hit it, grudge: how often
// it's had cause (it had to run from you, or call for help), downed: how
// often you've shot it down }). A brain reads `me.memory` and does with it
// what it will: a nemesis comes back tougher and brings friends, a
// merchant you shot has nothing for you, an inspector who had to call for
// help finds you wanted on sight.
//
// A brain may turn hostile (`intent.hostile`): a neutral who's had enough
// of you is on the guns from then on, like an enemy. `me.hurt` is what
// you've hit it for this meeting.
//
// createBrains({ rand, firstId, memory }) → { add(npc, at) → id | null, remove(id),
//   update(dt, world) → { events }, hit(id, damage) → { id, kind, at, down } | null,
//   live, targets }
// world: { you: { x, y, z, heading, speed } | null, hunters: [{ id, at,
//   vel?, faction }], stations: [{ id, at, r }], solids: [{ at: [x, y, z], r }],
//   stims: [{ type, at, radius, from: 'you', loudness }] (your shots, heard),
//   next: the director's next event ({ id, in }), heat: the trouble you've
//   made lately (scene.js's), shield: your shields, 0…100, wanted / feared /
//   friend: your standing (standing.js: the law's inspectors find a wanted
//   pilot on every scan, the merchants shun a feared one, Hondo waves a
//   friend of pirates through) }
// Events: { type: 'say', n, id, key } ('seen', 'hello', 'hit', 'leaving', and each brain's own),
// { type: 'delegate', n, via, kind | faction }, { type: 'offer', n },
// { type: 'tip', n, next }, { type: 'shot', n, from, to, at, hit, damage },
// { type: 'fled', n, faction }, { type: 'draw', n }, { type: 'downed', n },
// { type: 'busted', n, faction, size?, why } (an inspector or a trickster
// calling its faction in on you), { type: 'calls', n, faction } (a nemesis
// bringing friends), { type: 'retreat', n }, { type: 'gone', n }. `n` is
// the one's number (its id on the guns).

import { clearOf, turnToward, blocked } from './hunterRules';
import { belief, createSenses, sense } from '../../lib/ai/perception';
import { SENSES } from './npcs/index';
import { NPC, add, apart, nearest, sub, unit, velocityOf } from './npcs/brains/common';
import wingman from './npcs/brains/wingman';
import bounty from './npcs/brains/bounty';
import merchant from './npcs/brains/merchant';
import informant from './npcs/brains/informant';
import rival from './npcs/brains/rival';
import inspector from './npcs/brains/inspector';
import nemesis from './npcs/brains/nemesis';
import tagalong from './npcs/brains/tagalong';
import trickster from './npcs/brains/trickster';

export { NPC };
export const BRAINS = { wingman, bounty, merchant, informant, rival, inspector, nemesis, tagalong, trickster };
// the brains that have word of what's coming (the scene asks the director while one's about)
export const tells = (brain) => Boolean(BRAINS[brain]?.tells);
// a fresh memory of a character (createBrains keeps one per character id in `memory`)
export const remember = (memory, id) => (memory[id] ??= { met: 0, shot: 0, grudge: 0, downed: 0 });

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const between = (rand, [a, b]) => a + rand() * (b - a);
// how much of a shot at you is dodged, 0…NPC.dodge: turning, pitching, boosting
export const dodge = (you) => (you ? clamp(Math.abs(you.rate ?? 0) / 2.2 + Math.abs(you.tipRate ?? 0) / 2.2 + (Math.abs(you.speed ?? 0) > 15 ? 0.3 : 0), 0, NPC.dodge) : 0);
// you, as a character that can't see you believes you to be: at its guess,
// going the way it last saw you go (heading 0 is −z, as ship.js has it)
const guessed = (b) => ({ x: b.at.x, y: b.at.y, z: b.at.z, heading: Math.atan2(-b.vel.x, -b.vel.z), speed: Math.hypot(b.vel.x, b.vel.z), rate: 0, tipRate: 0, guessed: true });
const GUESS_CHANCE = 0.3; // of a shot's chance, at a guess
// (numbered well clear of the hunters' and the skirmishes': the lock follows a number)
export function createBrains({ rand = Math.random, firstId = 900001, brains = BRAINS, memory = {} } = {}) {
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
      const mem = remember(memory, npc.id);
      mem.met += 1;
      live.push({ n, id: n, npc, pos: { ...at }, vel: { x: 0, y: 0, z: 0 }, hp, hpMax: hp, clock: 0, cool: 1 + rand(), far: 0, leaving: false, left: 0, delegated: false, hostile: false, hurt: 0, memory: mem, said: new Set(), mind: {}, senses: createSenses(npc.senses ?? SENSES), beliefs: {}, dir: null, met: false, sees: false, you: null, last: null, hunters: [] });
      return n;
    },
    remove(n) {
      const me = live.find((o) => o.n === n);
      if (me) take(me);
    },

    update(dt, world) {
      const events = later.splice(0);
      const you = world.you ?? null;
      const solids = world.solids ?? [];
      const seesThrough = (a, b) => !blocked(a, b, solids);
      const targets = [];
      if (you) targets.push({ id: 'you', at: you, vel: velocityOf(you), hostile: true });
      for (const h of world.hunters ?? []) targets.push({ id: `h:${h.id}`, at: h.at, vel: h.vel ?? null, kind: 'hunter', faction: h.faction, hostile: true });
      for (const me of [...live]) {
        const { npc } = me;
        const st = npc.stats ?? {};
        me.clock += dt;
        me.mind.clock = me.clock;
        let intent;
        if (me.delegated) continue; // (the wing or the hunt has it now)
        // what it knows: sent to you, it knows where you are when it comes;
        // after that, what it perceives (and keeps, and loses)
        if (!me.met && you) {
          me.met = true;
          me.beliefs.you = { id: 'you', at: { ...you }, vel: velocityOf(you), seenAt: me.clock, heardAt: -Infinity, confidence: 1, visible: true, timer: 1, kind: null, hostile: true };
        }
        const s0v = Math.hypot(me.vel.x, me.vel.y, me.vel.z);
        me.dir = s0v > 0.5 ? unit(me.vel) : null;
        sense(me.senses, me, { targets, stims: world.stims }, dt, { seesThrough });
        // (a hunter that's gone from the map, shot down or flown off, is gone from its mind too: everyone saw that)
        for (const id of Object.keys(me.beliefs)) if (id !== 'you' && !targets.some((t) => t.id === id)) delete me.beliefs[id];
        const b = belief(me, 'you');
        me.sees = Boolean(b?.visible);
        // (the truth while it sees you, and for a moment after: intuition; a guess from then on)
        me.you = b ? (b.visible || me.now - b.seenAt <= me.senses.intuition ? you : guessed(b)) : null;
        if (me.you) me.last = me.you;
        me.hunters.length = 0;
        for (const hb of Object.values(me.beliefs)) if (hb.kind === 'hunter') me.hunters.push({ id: Number(hb.id.slice(2)), at: hb.at, faction: hb.faction, seen: hb.visible });
        const view = { ...world, you: me.you, hunters: me.hunters };
        // who it fears, near it: it's off
        if (!me.leaving) {
          const { it: dread } = nearest(me.hunters, me.pos, (h) => npc.relations?.fears?.includes(h.faction));
          if (dread && apart(dread.at, me.pos) < NPC.fear) {
            events.push({ type: 'fled', n: me.n, faction: dread.faction });
            leave(events, me);
          }
        }
        if (me.leaving) {
          // away from you (as far as it knows), climbing, a little quicker than it came
          const from = me.last ?? you ?? { x: me.pos.x, y: me.pos.y, z: me.pos.z + 1 };
          const out = unit(add(sub(me.pos, from), { x: 0, y: 0.3, z: 0 }));
          intent = { to: add(me.pos, out, 50), speed: (st.speed ?? 16) * 1.3 };
          if ((you && apart(me.pos, you) > NPC.leaveFar) || me.clock - me.left > NPC.leaveFor) {
            take(me);
            events.push({ type: 'gone', n: me.n });
            continue;
          }
        } else if (brains[npc.brain].delegates) {
          // (the wing or the hunt flies this one, relations and all: handed over at once)
          intent = brains[npc.brain](npc, me, view, dt, rand) ?? {};
        } else {
          // one it hunts, near you: after it
          const { it: quarry } = me.you ? nearest(me.hunters, me.you, (h) => npc.relations?.hunts?.includes(h.faction)) : { it: null };
          if (quarry && apart(quarry.at, me.you) < NPC.huntFrom) intent = { to: add(quarry.at, unit(sub(me.pos, quarry.at)), 6), fire: quarry.id };
          else intent = brains[npc.brain](npc, me, view, dt, rand) ?? {};
        }
        if (intent.delegate) {
          me.delegated = true;
          events.push({ type: 'delegate', n: me.n, ...intent.delegate });
          continue;
        }
        if (intent.hostile) me.hostile = true;
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
        if (solids.length) clearOf(me.pos, solids, 0.5);

        // firing: at you or at a hunter, as it believes them to be, in range
        // (most shots miss: a cloud, not a wall; at a guess, hardly any land)
        me.cool -= dt;
        if (intent.fire != null && !me.leaving && me.cool <= 0) {
          const hb = intent.fire === 'you' ? null : me.hunters.find((h) => h.id === intent.fire);
          const tgt = intent.fire === 'you' ? me.you : hb?.at;
          const guess = intent.fire === 'you' ? Boolean(me.you?.guessed) : Boolean(hb && !hb.seen);
          const d = tgt ? apart(tgt, me.pos) : Infinity;
          if (d < NPC.range) {
            me.cool = between(rand, st.fire ?? [0.8, 1.4]) * (intent.fireRate ?? 1);
            const chance = clamp(0.5 * (1 - d / NPC.range) + 0.1, 0.05, 0.45) * (intent.fire === 'you' ? 1 - dodge(you) : 1) * (guess ? GUESS_CHANCE : 1);
            events.push({ type: 'shot', n: me.n, from: { ...me.pos }, to: { x: tgt.x, y: tgt.y, z: tgt.z }, at: intent.fire, hit: rand() < chance, damage: intent.fire === 'you' ? (st.damage ?? 6) : 1 });
          }
        }

        // seen you (in sight, and near); and let go of, once you're far away for long enough
        if (you) {
          const d = apart(me.pos, you);
          if (d < NPC.seen && me.sees) say(events, me, 'seen');
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
      me.hurt += damage;
      me.memory.shot += 1;
      const out = { id: me.n, kind: me.npc.ship, at: { ...me.pos }, size: me.npc.size ?? 0.4, down: me.hp <= 0 };
      if (out.down) {
        me.memory.downed += 1;
        take(me);
        later.push({ type: 'downed', n: me.n });
      } else if (!me.said.has('hit')) {
        me.said.add('hit');
        later.push({ type: 'say', n: me.n, id: me.npc.id, key: 'hit' });
      }
      return out;
    },

    // the ones the guns may lock on to: an enemy still in the fight (or a
    // neutral that's turned hostile)
    get targets() {
      targets.length = 0;
      for (const me of live) {
        if ((me.npc.role !== 'enemy' && !me.hostile) || me.leaving || me.delegated) continue;
        me.target ??= { id: me.n, at: me.pos, vel: me.vel, size: me.npc.size ?? 0.4, kind: me.npc.ship, hp: me.hp, hpMax: me.hpMax, faction: me.npc.id, threat: 1 };
        me.target.hp = me.hp;
        me.target.hpMax = me.hpMax; // (a nemesis comes back tougher)
        targets.push(me.target);
      }
      return targets;
    },
  };
}
