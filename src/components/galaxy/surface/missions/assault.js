// A galactic assault, as plain numbers (missions/index.js has the maps:
// Hoth's and Geonosis's): two armies on a world, the command posts between
// them, and you one soldier among them. The attackers come for the posts
// of the phase; hold a post with more soldiers than the enemy and its
// meter moves your way, to neutral and then to yours; take every post of
// the phase and the next begins, until the last falls. A soldier down
// comes back at a post of theirs after a while, for a ticket; a side with
// no tickets and nobody standing has lost. Pure and seeded, so it's
// tested; the drawing is assaultScene.js and the surface scene runs it.
//
// Design: docs/superpowers/specs/2026-10-06-galactic-assault-design.md

import { pushOut, turnToward } from '../walker';
import { rng } from '../noise';
import { starsFor } from './chase';

export const RULES = {
  capture: 0.08, // a post's meter, a second, for each soldier of advantage
  advantage: 4, // soldiers of advantage that count, at most
  respawn: 6, // seconds down before a soldier comes back
  range: 48, // metres: a soldier fires at an enemy this near
  every: 1.1, // seconds between a soldier's shots (give or take)
  accuracy: [0.55, 0.15], // a shot's chance to hit another soldier, point blank and at the edge of range
  damage: 26, // of a soldier's hp, a hit between soldiers
  yours: 34, // of a soldier's hp, a hit of yours
  atYou: 7, // of your health, a bolt of theirs that passes through you
  hp: 100,
  walk: 3, // m/s
  engaged: 0.65, // of the walk, while firing
  turn: 4, // rad/s
  step: 0.1, // the longest step the rules take at once
  atYouMax: 3, // enemies firing at you at once, at most
  spacing: 1.4, // metres between soldiers
  retarget: 2, // seconds between a soldier's looks at where it should be
};
// soldiers a side, by the device's tier (lib/device)
export const SOLDIERS = { high: 14, mid: 9, low: 6 };

const other = (side) => (side === 'attack' ? 'defend' : 'attack');
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const inPost = (p, x, z) => dist(p.at[0], p.at[1], x, z) <= p.r;
const livePosts = (b) => b.mission.phases[b.phaseIndex].posts.map((id) => b.posts.find((p) => p.id === id));
const isLive = (b, id) => b.mission.phases[b.phaseIndex].posts.includes(id);
const nearest = (list, x, z) => {
  let best = null;
  let bestD = Infinity;
  for (const p of list) {
    const d = dist(p.at[0], p.at[1], x, z);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
};
// one of a side's kinds, by weight ([[kind, weight], …])
const pickKind = (kinds, r) => {
  const total = kinds.reduce((n, [, w]) => n + w, 0);
  let k = r() * total;
  for (const [kind, w] of kinds) if ((k -= w) < 0) return kind;
  return kinds[kinds.length - 1][0];
};

// A battle laid out: the posts the defenders' (the fixed ones each side's
// own), the soldiers made but not yet on the field, at the choose card.
export function newBattle(mission, { n = SOLDIERS.high, seed = 1 } = {}) {
  const r = rng(seed);
  const kr = rng(7); // (the kinds the same whatever the seed, so a battle again wears the same figures)
  const posts = mission.posts.map((p) => ({ id: p.id, name: p.name, at: p.at, r: p.r, fixed: p.fixed ?? null, owner: p.fixed ?? 'defend', meter: 1, taking: null, inside: { attack: 0, defend: 0 }, youIn: false }));
  const soldiers = [];
  for (const side of ['attack', 'defend'])
    for (let i = 0; i < n; i++) soldiers.push({ id: soldiers.length, side, kind: pickKind(mission.sides[side].kinds, kr), x: 0, z: 0, yaw: 0, hp: RULES.hp, up: false, down: 0, post: null, spot: null, cool: 1 + r() * 2, wait: 0, target: null, move: 0, detour: 0 });
  return { mission, r, t: 0, phase: 'choose', phaseIndex: 0, result: null, posts, soldiers, tickets: { ...mission.tickets }, you: { side: null, up: false, x: 0, z: 0, kills: 0, captures: 0, deaths: 0, in: null, state: null }, feed: [] };
}

const feed = (b, kind, text) => {
  b.feed.push({ t: b.t, kind, text });
  if (b.feed.length > 5) b.feed.shift();
};
const sideName = (b, side) => b.mission.sides[side].short;

// where a soldier of a side comes onto the field: the attackers at their
// post nearest the front (the live posts they don't hold), the defenders
// at a live post of theirs that isn't being fought over, or each side's
// fixed post failing those
function spawnPost(b, side) {
  const own = b.posts.filter((p) => p.owner === side);
  if (side === 'attack') {
    const front = livePosts(b).filter((p) => p.owner !== 'attack');
    if (!front.length) return own.find((p) => p.fixed === side) ?? own[0];
    let best = own[0];
    let bestD = Infinity;
    for (const p of own) {
      const d = Math.min(...front.map((f) => dist(p.at[0], p.at[1], f.at[0], f.at[1])));
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }
  const quiet = livePosts(b).filter((p) => p.owner === 'defend' && p.inside.attack === 0);
  if (quiet.length) return quiet[Math.floor(b.r() * quiet.length)];
  return own.find((p) => p.fixed === side) ?? own[0];
}
// a spot inside a post, well in from its edge
const spotIn = (b, p, k = 0.7) => {
  const a = b.r() * Math.PI * 2;
  const d = Math.sqrt(b.r()) * p.r * k;
  return [p.at[0] + Math.cos(a) * d, p.at[1] + Math.sin(a) * d];
};
function place(b, s, p) {
  [s.x, s.z] = spotIn(b, p);
  const o = objectiveFor(b, s.side, s.x, s.z);
  s.yaw = o ? Math.atan2(o[0] - s.x, o[1] - s.z) : 0;
  s.up = true;
  s.hp = RULES.hp;
  s.down = 0;
  s.post = null;
  s.spot = null;
  s.target = null;
  s.cool = 0.8 + b.r() * 1.5;
}

// Where a side is wanted: the attackers at the nearest live post that isn't
// theirs; the defenders at the nearest live post that's lost, going, or
// has attackers in it, else the nearest of theirs.
export function objectiveFor(b, side, x, z) {
  const live = livePosts(b);
  let list;
  if (side === 'attack') list = live.filter((p) => p.owner !== 'attack');
  else {
    list = live.filter((p) => p.owner !== 'defend' || p.inside.attack > 0);
    if (!list.length) list = live;
  }
  const p = nearest(list.length ? list : live, x, z);
  return p ? [p.at[0], p.at[1]] : null;
}

// A side picked: the battle's on, the defenders inside the live posts, the
// attackers at theirs, nobody costing a ticket.
export function chooseSide(b, side) {
  b.you.side = side;
  b.phase = 'run';
  const live = livePosts(b);
  let i = 0;
  for (const s of b.soldiers) {
    if (s.side === 'defend') place(b, s, live[i++ % live.length]);
    else place(b, s, spawnPost(b, 'attack'));
  }
}

// a soldier's next post: spread across the side's objectives, each one
// scoring its distance and 25 m a soldier already sent there
function pickPost(b, s) {
  const live = livePosts(b);
  let list = s.side === 'attack' ? live.filter((p) => p.owner !== 'attack') : live;
  if (!list.length) list = live;
  const sent = {};
  for (const o of b.soldiers) if (o !== s && o.up && o.side === s.side && o.post) sent[o.post] = (sent[o.post] ?? 0) + 1;
  let best = null;
  let bestScore = Infinity;
  for (const p of list) {
    let score = dist(p.at[0], p.at[1], s.x, s.z) + 25 * (sent[p.id] ?? 0);
    if (s.side === 'attack' && p.owner === null && p.taking === 'attack') score -= 30;
    if (s.side === 'defend') {
      if (p.owner !== 'defend') score -= 60;
      if (p.inside.attack > 0) score -= 40;
    }
    if (score < bestScore) {
      best = p;
      bestScore = score;
    }
  }
  if (best && best.id !== s.post) {
    s.post = best.id;
    s.spot = spotIn(b, best, 0.75);
  }
  s.wait = RULES.retarget * (0.8 + 0.4 * b.r());
}

function hurt(b, s, damage, by, out) {
  if (!s.up) return null;
  s.hp -= damage;
  if (s.hp > 0) return null;
  s.up = false;
  s.down = 0;
  s.target = null;
  const ev = { type: 'down', id: s.id, by: by === 'you' ? 'you' : by.id };
  out.push(ev);
  out.push({ type: 'kill', victim: s.id, side: s.side, by: ev.by });
  if (by === 'you') {
    b.you.kills += 1;
    feed(b, 'kill', `You brought one of ${sideName(b, s.side) === 'Empire' ? 'the Empire’s' : `the ${sideName(b, s.side)}’s`} down`);
  }
  return ev;
}

// One of your bolts lands on a soldier: down at the last of its hp (the
// `down` event), yours to count.
export function hitSoldier(b, id, damage = RULES.yours, by = 'you') {
  const s = b.soldiers.find((o) => o.id === id);
  if (!s || !s.up) return null;
  return hurt(b, s, damage, by, []);
}

export function endBattle(b, won, why) {
  if (b.result) return;
  b.result = { won, why, t: b.t, stars: won ? starsFor(b.mission, b.t) : 0, kills: b.you.kills, captures: b.you.captures, side: b.you.side };
  b.phase = 'end';
}

function step(b, h, you, env, out) {
  b.t += h;
  // (you count on the field only while the scene says where you are)
  const youOn = Boolean(you) && b.you.up;
  if (youOn) {
    b.you.x = you.x;
    b.you.z = you.z;
  }
  // ── the posts: who's in each, and the meters ──
  for (const p of b.posts) {
    p.inside.attack = 0;
    p.inside.defend = 0;
    for (const s of b.soldiers) if (s.up && inPost(p, s.x, s.z)) p.inside[s.side] += 1;
    p.youIn = youOn && inPost(p, b.you.x, b.you.z);
    if (p.youIn) p.inside[b.you.side] += 1;
    if (p.fixed || !isLive(b, p.id)) continue;
    const A = p.inside.attack;
    const D = p.inside.defend;
    if (p.owner) {
      const opp = other(p.owner);
      const adv = p.inside[opp] - p.inside[p.owner];
      if (adv > 0) {
        p.meter -= RULES.capture * Math.min(adv, RULES.advantage) * h;
        if (p.meter <= 0) {
          p.meter = 0;
          p.owner = null;
          p.taking = opp;
          out.push({ type: 'neutral', post: p.id, by: opp });
          feed(b, 'neutral', `${p.name}: contested`);
        }
      } else if (adv < 0 && p.meter < 1) p.meter = Math.min(1, p.meter + RULES.capture * Math.min(-adv, RULES.advantage) * h);
    } else if (A !== D) {
      const side = A > D ? 'attack' : 'defend';
      if (p.taking !== side) {
        p.taking = side;
        p.meter = 0;
      }
      p.meter += RULES.capture * Math.min(Math.abs(A - D), RULES.advantage) * h;
      if (p.meter >= 1) {
        p.meter = 1;
        p.owner = side;
        p.taking = null;
        const yours = p.youIn && b.you.side === side;
        if (yours) b.you.captures += 1;
        out.push({ type: 'capture', post: p.id, side, you: yours });
        feed(b, 'capture', `${sideName(b, side) === 'Empire' ? 'The Empire' : `The ${sideName(b, side)}`} took ${p.name.replace(/^The /, 'the ')}`);
      }
    }
  }
  // ── the phase: every post of it the attackers', and the next begins ──
  if (livePosts(b).every((p) => p.owner === 'attack')) {
    if (b.phaseIndex >= b.mission.phases.length - 1) {
      out.push({ type: 'end', won: b.you.side === 'attack', why: 'posts' });
      endBattle(b, b.you.side === 'attack', 'posts');
      return;
    }
    b.phaseIndex += 1;
    const ph = b.mission.phases[b.phaseIndex];
    b.tickets.attack = Math.max(b.tickets.attack, ph.tickets ?? 0);
    for (const s of b.soldiers) s.wait = 0;
    out.push({ type: 'phase', phase: b.phaseIndex, name: ph.name });
    feed(b, 'phase', ph.name);
  }
  // ── who may fire at you: the nearest few ──
  const atYou = youOn ? b.soldiers.filter((s) => s.up && s.side !== b.you.side && dist(s.x, s.z, b.you.x, b.you.z) <= RULES.range).sort((p, q) => dist(p.x, p.z, b.you.x, b.you.z) - dist(q.x, q.z, b.you.x, b.you.z)).slice(0, RULES.atYouMax) : [];
  // ── the soldiers ──
  for (const s of b.soldiers) {
    if (!s.up) {
      s.down += h;
      if (s.down >= RULES.respawn && b.tickets[s.side] > 0) {
        b.tickets[s.side] -= 1;
        place(b, s, spawnPost(b, s.side));
        out.push({ type: 'spawn', id: s.id });
      }
      continue;
    }
    // where it's going
    s.wait -= h;
    if (!s.frozen && (s.wait <= 0 || !s.post || !isLive(b, s.post))) pickPost(b, s);
    // the enemy it fires at: you, if it's one of the few allowed, else the nearest soldier in range
    let target = null;
    if (atYou.includes(s)) target = { you: true, x: b.you.x, z: b.you.z };
    else {
      let bestD = RULES.range;
      for (const o of b.soldiers) {
        if (!o.up || o.side === s.side) continue;
        const d = dist(s.x, s.z, o.x, o.z);
        if (d < bestD) {
          bestD = d;
          target = o;
        }
      }
    }
    s.target = target ? (target.you ? 'you' : target.id) : null;
    // on toward its spot, turned to its target if it has one
    if (!s.frozen && s.spot) {
      const d = dist(s.x, s.z, s.spot[0], s.spot[1]);
      const want = target ? Math.atan2(target.x - s.x, target.z - s.z) : Math.atan2(s.spot[0] - s.x, s.spot[1] - s.z);
      s.yaw = turnToward(s.yaw, want, RULES.turn * h);
      let nx = s.x;
      let nz = s.z;
      if (d > 1.2) {
        const speed = RULES.walk * (target ? RULES.engaged : 1) * h;
        const ux = (s.spot[0] - s.x) / d;
        const uz = (s.spot[1] - s.z) / d;
        nx += ux * speed;
        nz += uz * speed;
        s.move = target ? 0.65 : 1;
        // round what's solid: pushed out of it, and while something's in
        // the way, along its face (the way the pushes point, turned a
        // quarter: a side picked once and kept, swapped if it's got nowhere
        // in a while), each solid settled in turn so a seam between two
        // doesn't catch
        let px = 0;
        let pz = 0;
        const settle = () => {
          for (const sol of env.solids.near(nx, nz, 2)) {
            const push = pushOut(sol, nx, nz, 0.45);
            if (!push) continue;
            nx += push[0];
            nz += push[1];
            px += push[0];
            pz += push[1];
          }
        };
        settle();
        const pl = Math.hypot(px, pz);
        if (pl > 1e-6) {
          if (!s.detour) s.detour = b.r() < 0.5 ? 1 : -1;
          s.stuck = (s.stuck ?? 0) + h;
          if (s.stuck > 8) {
            s.detour = -s.detour;
            s.stuck = 0;
          }
          nx += (-pz / pl) * speed * s.detour;
          nz += (px / pl) * speed * s.detour;
          settle();
        } else {
          s.detour = 0;
          s.stuck = 0;
        }
      } else {
        s.move = 0;
        if (b.r() < h / 8) s.spot = spotIn(b, b.posts.find((p) => p.id === s.post), 0.75);
      }
      // not into each other
      for (const o of b.soldiers) {
        if (o === s || !o.up) continue;
        const dd = dist(nx, nz, o.x, o.z);
        if (dd < RULES.spacing && dd > 1e-6) {
          const k = (RULES.spacing - dd) / dd * 0.5;
          nx += (nx - o.x) * k;
          nz += (nz - o.z) * k;
        }
      }
      const rr = Math.hypot(nx, nz);
      if (env.reach && rr > env.reach) {
        nx *= env.reach / rr;
        nz *= env.reach / rr;
      }
      s.x = nx;
      s.z = nz;
    }
    // a shot
    s.cool -= h;
    if (target && s.cool <= 0 && !s.unarmed) {
      s.cool = RULES.every * (0.7 + 0.6 * b.r());
      const d = dist(s.x, s.z, target.x, target.z);
      if (target.you) out.push({ type: 'shot', id: s.id, side: s.side, from: [s.x, s.z], to: [target.x, target.z], atYou: true, hit: null });
      else {
        const [a0, a1] = RULES.accuracy;
        const hit = b.r() < a0 + (a1 - a0) * Math.min(1, d / RULES.range);
        out.push({ type: 'shot', id: s.id, side: s.side, from: [s.x, s.z], to: [target.x, target.z], atYou: false, hit, target: target.id });
        if (hit) hurt(b, target, RULES.damage, s, out);
      }
    }
  }
  // ── a side out of soldiers and tickets has lost ──
  for (const side of ['attack', 'defend']) {
    if (b.tickets[side] > 0) continue;
    if (b.soldiers.some((s) => s.side === side && s.up)) continue;
    if (b.you.side === side && b.you.up) continue;
    const won = b.you.side !== side;
    out.push({ type: 'end', won, why: 'tickets' });
    endBattle(b, won, 'tickets');
    return;
  }
}

// The battle moved on by dt seconds (in steps of RULES.step at most), with
// you at `you` ({ x, z }, or null); returns what happened.
export function stepBattle(b, dt, you = null, env = { solids: { near: () => [] }, reach: 0 }) {
  const out = [];
  if (b.phase !== 'run' || b.result) return out;
  const n = Math.max(1, Math.ceil(dt / RULES.step - 1e-9));
  for (let i = 0; i < n && !b.result; i++) step(b, dt / n, you, env, out);
  return out;
}

// Whether you may come onto the field at a post: your side's, and no enemy in it
export const canDeploy = (b, p) => Boolean(p && b.you.side && (p.fixed === b.you.side || (p.owner === b.you.side && p.inside[other(b.you.side)] === 0)));

// You, onto the field at a post of yours, for a ticket: where you stand and
// which way you face (toward your side's objective), or null
export function deploy(b, postId) {
  const p = b.posts.find((o) => o.id === postId);
  if (!canDeploy(b, p) || b.tickets[b.you.side] <= 0) return null;
  b.tickets[b.you.side] -= 1;
  const [x, z] = spotIn(b, p, 0.6);
  const o = objectiveFor(b, b.you.side, x, z);
  const yaw = o ? Math.atan2(o[0] - x, o[1] - z) : 0;
  Object.assign(b.you, { up: true, x, z });
  return { x, z, yaw };
}

export function youDown(b) {
  if (!b.you.up) return;
  b.you.up = false;
  b.you.deaths += 1;
}

// how a post stands for you, when you're in it
function youState(b, p) {
  const me = b.you.side;
  const opp = other(me);
  if (p.owner === me) return p.inside[opp] > 0 ? (p.meter < 1 ? 'losing' : 'contested') : 'holding';
  if (p.owner === null) return p.taking === me ? 'taking' : p.taking ? 'losing' : 'contested';
  return p.inside[me] > p.inside[opp] ? 'taking' : 'contested';
}

// The battle as the HUD draws it. `key` changes when something the page
// draws changes (not with the meters: those come through the feed).
export function battleView(b) {
  let letter = 0;
  const inPostNow = b.you.up ? b.posts.find((p) => p.youIn) : null;
  const you = { side: b.you.side, up: b.you.up, kills: b.you.kills, captures: b.you.captures, deaths: b.you.deaths, in: inPostNow?.id ?? null, state: inPostNow ? youState(b, inPostNow) : null, meter: inPostNow?.meter ?? 0 };
  const posts = b.posts.map((p) => ({ id: p.id, name: p.name, letter: p.fixed ? '' : String.fromCharCode(65 + letter++), owner: p.owner, meter: p.meter, taking: p.taking, inside: { ...p.inside }, live: isLive(b, p.id), fixed: p.fixed, can: canDeploy(b, p) }));
  const ph = b.mission.phases[b.phaseIndex];
  return {
    phase: b.result ? 'end' : b.phase,
    t: b.t,
    phaseIndex: b.phaseIndex,
    phaseCount: b.mission.phases.length,
    phaseName: ph.name,
    posts,
    tickets: { ...b.tickets },
    you,
    feed: b.feed.slice(),
    result: b.result,
    key: [b.result ? 'end' : b.phase, b.phaseIndex, posts.map((p) => `${p.owner?.[0] ?? '-'}${p.taking?.[0] ?? ''}${p.can ? '+' : ''}`).join(''), b.tickets.attack, b.tickets.defend, you.up ? 1 : 0, you.in ?? '', you.state ?? '', b.feed.length, you.kills, b.result ? 1 : 0].join('|'),
  };
}
