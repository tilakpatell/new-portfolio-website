// The fleet parked at a planet, in the scene: garrisonRules.js's mind (it
// sees you, hails you, scrambles at you and fires on you, or covers you)
// played out with the scene's own pieces. Its waves go out through the
// hunters, tagged as this system's (`garrison:<id>`) and homed on the hangar
// they came out of, and only they are called back; its turbolasers are drawn
// in the scene's bolt pool in the side's colour (battles.js's TURBO), though
// the mind flies its own bolts and says what they hit; its lines go to the
// page as `{ type: 'event', id: 'garrison', sub, side, sys, secs }`
// (garrisonLines.js has them said). And what you do to it: a shot of yours
// on one of its fighters or its hulls provokes it, a pack of its side beaten
// near it calls it out, and a pack of its side sent after you here has its
// hangar to fall back on. The design:
// docs/superpowers/specs/2026-10-08-garrison-defence-design.md.
//
// createGarrisonDefence({ hunters, wingmen, bolts, emit, hurt, pop, shake,
//   escort: () => kinds, small, rand }) → {
//   update(dt, live, { world, effects, sys, battle, safe, solids }) → busy,
//   onHunters(e) (a hunters' event), onHit(hit) (a hunters.hit or damage
//   answer: one of your shots), hull(from, to) → { at } | null (your shot
//   against the posts' hulls), homeFor(faction) → { x, y, z } | null,
//   enter(sys), reset('enter' | 'jump' | 'down' | 'respawn'), busy, info,
//   dispose() }
// safeNow({ clock, safeUntil, flown, jump }) → whether the scene's state holds it
// live: your ship ({ x, y, z, … }), or null (jumping, crashed, frozen).
// safe: safeNow's answer; the mind is held where it is, its grace with it,
// so nothing hails, scrambles or fires, and its grace still runs out after
// (8 s on top of the safe time, out of a jump as after a respawn). pop(hit):
// a hunter its guns downed, gone up; shake(k): the camera shaken, at least k.

import * as THREE from 'three';
import { TURBO } from './battles';
import { GARRISON, SIDE_FACTION, createGarrison } from './garrisonRules';

const NONE = Object.freeze([]);

// where a shot from `a` to `b` first meets the sphere at `c` of radius `r`,
// as a share of the way (0 from inside it); null if it misses
function meets(a, b, c, r) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const fx = a.x - c.x;
  const fy = a.y - c.y;
  const fz = a.z - c.z;
  const dd = dx * dx + dy * dy + dz * dz;
  if (dd < 1e-12) return fx * fx + fy * fy + fz * fz <= r * r ? 0 : null;
  const t = -(fx * dx + fy * dy + fz * dz) / dd; // (nearest the centre)
  const px = fx + dx * t;
  const py = fy + dy * t;
  const pz = fz + dz * t;
  const gap = r * r - (px * px + py * py + pz * pz);
  if (gap < 0) return null;
  const half = Math.sqrt(gap / dd);
  if (t + half < 0 || t - half > 1) return null;
  return Math.max(0, t - half);
}

// the scene's state (its clock, safeUntil, flown and jump) holds the mind:
// back from a crash or out of a jump a moment, not flown yet, or in a jump's
// tunnel or on its way out of it. The new system's mind is reset and entered
// in the tunnel, and its grace is kept there for when you're out, however
// long the jump; turning onto the course and spooling up are still flown in
// the system you're leaving, so they don't hold it.
export const safeNow = ({ clock, safeUntil, flown, jump }) => clock < safeUntil || !flown || jump?.phase === 'tunnel' || jump?.phase === 'exit';

export function createGarrisonDefence({ hunters, wingmen = null, bolts, emit, hurt, pop = () => {}, shake = () => {}, escort = () => NONE, small = false, rand = Math.random }) {
  const mind = createGarrison({ rand, small });
  let sys = null;
  let tag = null;
  let effects = null;
  let posts = NONE; // (world.posts(), read once a frame: the world keeps the list and refills it)
  let ship = null; // the ship handed to the last update
  const launched = new Set(); // the factions its waves went out as, for the recall
  // you as the mind sees you: where you are, and your velocity from where you were the frame before
  const you = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  let known = false;
  const fighters = []; // its own waves', from the hunters' targets
  const chasers = []; // and the rest of them after you
  // the planet: what it can't see through (only that: a ship would be blind inside its own hull)
  const planet = { c: { x: 0, y: 0, z: 0 }, r: 0 };
  const seesThrough = (a, b) => meets(a, b, planet.c, planet.r) === null;
  const w = { posts: NONE, you: null, stance: null, tier: null, battle: false, planet: null, seesThrough: null, fighters, chasers };
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const struck = { at: { x: 0, y: 0, z: 0 } };

  // a post of the side a pack flies for: one its garrison launches, or the
  // hunters the director sends for whoever holds the system (warEffects.js's `garrison`)
  const theirs = (p, faction) => SIDE_FACTION[p.side] === faction || (effects?.fleet === p.side && effects.garrison === faction);

  const act = (e) => {
    if (e.type === 'say') emit({ type: 'event', id: 'garrison', sub: e.sub, side: e.post?.side ?? null, sys: sys.id, secs: e.secs });
    else if (e.type === 'scramble') {
      const faction = SIDE_FACTION[e.post.side];
      if (!ship || !faction) return;
      launched.add(faction);
      hunters.pack(faction, ship, { from: e.from, size: e.size, ace: e.ace, tag, home: e.from });
    } else if (e.type === 'volley') {
      bolts.fire(from.copy(e.from), to.copy(e.to), { color: TURBO[e.post.side], speed: GARRISON.bolt.speed, width: 0.12, length: 3.2 });
      if (!e.friendly) emit({ type: 'shot' });
    } else if (e.type === 'hit') {
      hurt(e.damage);
      shake(0.45);
    } else if (e.type === 'cover') {
      const got = hunters.damage(e.id, e.damage);
      if (got?.down) pop(got);
    } else if (e.type === 'escort') {
      const kinds = escort();
      if (wingmen && ship && kinds.length) wingmen.join(kinds[Math.floor(rand() * kinds.length)], ship, 2);
    } else if (e.type === 'recall') {
      for (const f of launched) hunters.leave(f, tag);
      launched.clear();
    }
  };

  const reset = (why) => {
    mind.reset(why);
    launched.clear();
    known = false;
    if (why === 'enter' || why === 'jump') posts = NONE;
  };

  return {
    update(dt, live, { world = null, effects: fx = null, sys: here = null, battle = false, safe = false, solids = NONE } = {}) {
      if (here !== sys) {
        sys = here;
        tag = here ? `garrison:${here.id}` : null;
      }
      effects = fx;
      posts = world?.posts?.() ?? NONE;
      ship = live;
      if (live) {
        const k = known && dt > 0 ? 1 / dt : 0;
        you.vx = (live.x - you.x) * k;
        you.vy = (live.y - you.y) * k;
        you.vz = (live.z - you.z) * k;
        you.x = live.x;
        you.y = live.y;
        you.z = live.z;
        known = true;
      } else known = false;
      if (safe || !sys) return mind.busy;

      let body = null;
      for (const o of solids) {
        if (!o.planet) continue;
        body = o;
        break;
      }
      if (body) {
        planet.c.x = body.at[0];
        planet.c.y = body.at[1];
        planet.c.z = body.at[2];
        planet.r = body.r;
      }
      w.posts = posts;
      w.you = live ? you : null;
      w.stance = fx?.stance ?? null;
      w.tier = fx?.tier ?? null;
      w.battle = battle;
      w.planet = body ? planet : null;
      w.seesThrough = body ? seesThrough : null;
      fighters.length = 0;
      chasers.length = 0;
      for (const o of hunters.targets) {
        if (o.tag === tag) fighters.push(o);
        else if (!o.prey) chasers.push(o);
      }
      for (const e of mind.step(dt, w)) act(e);
      return mind.busy || mind.bolts.length > 0;
    },

    // a hunters' event: a pack of its side, not its own, broken or cut down,
    // calls it out (if you're near: the mind's to say)
    onHunters(e) {
      if (e.tag != null || !((e.type === 'escaped' && e.why === 'broke') || e.type === 'cleared')) return;
      for (const p of posts) {
        if (!theirs(p, e.faction)) continue;
        mind.call();
        return;
      }
    },
    // one of your shots on a hunter: one of its own, hit or downed, provokes it
    onHit(hit) {
      if (tag && hit?.tag === tag) mind.provoke(hit.down ? 'down' : 'hit');
    },
    // your shot from `from` to `to` this frame against its hulls: where it
    // landed on the first it met, which provokes it; null for none
    hull(a, b) {
      let best = Infinity;
      for (const p of posts) {
        for (const s of p.spheres) {
          const k = meets(a, b, s.c, s.r);
          if (k !== null && k < best) best = k;
        }
      }
      if (best === Infinity) return null;
      struck.at.x = a.x + (b.x - a.x) * best;
      struck.at.y = a.y + (b.y - a.y) * best;
      struck.at.z = a.z + (b.z - a.z) * best;
      mind.provoke('hull');
      return struck;
    },
    // where a pack of `faction` falls back to: the hangar of the post of its
    // side nearest you, or null
    homeFor(faction) {
      let best = null;
      let near = Infinity;
      for (const p of posts) {
        if (!theirs(p, faction)) continue;
        const d = known ? (p.hangar.x - you.x) ** 2 + (p.hangar.y - you.y) ** 2 + (p.hangar.z - you.z) ** 2 : 0;
        if (d < near) (near = d), (best = p);
      }
      return best?.hangar ?? null;
    },
    enter(here) {
      sys = here;
      tag = here ? `garrison:${here.id}` : null;
      reset('enter');
    },
    reset,
    get busy() {
      return mind.busy;
    },
    get info() {
      return { ...mind.info, tag, posts: posts.length };
    },
    dispose() {
      reset('enter');
      sys = null;
      tag = null;
      effects = null;
      ship = null;
    },
  };
}
