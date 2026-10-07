// A group that acts as one. Days Gone's squads: formed by proximity,
// merging and splitting as members move; a confidence per member, the
// ratio of what its side looks worth to the enemy (a confident ally counts
// for more, a panicked one counts for the enemy, so nerve and panic both
// spread; kills add and losses subtract, and fade over minutes), binned
// panicked, worried, neutral, confident, heroic; and a frontline, the
// direction from the squad's centre to the enemy's, a line it never
// crosses, a neutral buffer, and lanes one per member so nobody blocks a
// friend's fire. Posture by confidence: form up, hold, retreat in halves
// (the nearest move first, the rest cover), press (the furthest move
// first), and flankers off the lane ends that always leave the rear open.
// Halo's morale rides on it: a leader down drops everyone a bin. And
// DOOM's attack tokens: a shared pool per kind and target; claim before
// attacking, release after, a better-placed one may steal; one scalar is
// the difficulty of every pool at once; and the rule the callers follow,
// that nobody without a token idles. Pure.
//
//   createSquads({ reach }) → { update(members) → squads, of(id) }
//     members: [{ id, at, side, alive, leader? }]; a squad: { id, side, members: [ids], centre }
//   confidence(squad, members, enemies, { value, kills, losses }) → { ratio, level }
//   morale(level, event: { type: 'leaderDown' }) → level
//   frontline(squad, members, enemies, { buffer, minWidth }) → { dir, centre, line, width, lanes }
//   posture(level) → 'form' | 'hold' | 'retreat' | 'press'
//   advance(squad, members, front) / withdraw(…) → { move: [ids], cover: [ids] }
//   flankers(squad, members, front, enemies) → [{ id, at }]
//   createTokens({ pools, scale, timeout }) → { claim, release, held, steal, audit, count, clear }

import { add, apart, scale as scaleVec, sub, unit } from './vec';

export const LEVELS = ['panicked', 'worried', 'neutral', 'confident', 'heroic'];
const BINS = [0.4, 0.75, 1.5, 2.5]; // ratios under which each level ends
const levelOf = (ratio) => LEVELS[BINS.findIndex((b) => ratio < b) === -1 ? 4 : BINS.findIndex((b) => ratio < b)];
const CONFIDENCE = { panicked: 0, worried: 0.7, neutral: 1, confident: 1.2, heroic: 1.4 }; // what a member of each nerve is worth to its side

const centreOf = (list) => {
  if (!list.length) return { x: 0, y: 0, z: 0 };
  let c = { x: 0, y: 0, z: 0 };
  for (const m of list) c = add(c, m.at);
  return scaleVec(c, 1 / list.length);
};

export function createSquads({ reach = 30 } = {}) {
  let next = 1;
  let squads = [];
  const byMember = new Map();
  return {
    get squads() {
      return squads;
    },
    update(members) {
      const live = members.filter((m) => m.alive !== false);
      // union-find by side and reach: any member within reach of any member
      const parent = new Map(live.map((m) => [m.id, m.id]));
      const find = (id) => {
        while (parent.get(id) !== id) id = parent.get(id);
        return id;
      };
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          if (live[i].side !== live[j].side) continue;
          if (apart(live[i].at, live[j].at) > reach) continue;
          parent.set(find(live[i].id), find(live[j].id));
        }
      const groups = new Map();
      for (const m of live) {
        const root = find(m.id);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(m);
      }
      // keep a squad's id where most of its members were in it before
      const fresh = [];
      for (const group of groups.values()) {
        const votes = new Map();
        for (const m of group) {
          const old = byMember.get(m.id);
          if (old != null) votes.set(old, (votes.get(old) ?? 0) + 1);
        }
        let id = null;
        let most = 0;
        for (const [k, v] of votes) if (v > most && !fresh.some((s) => s.id === k)) {
          most = v;
          id = k;
        }
        fresh.push({ id: id ?? next++, side: group[0].side, members: group.map((m) => m.id), centre: centreOf(group) });
      }
      squads = fresh;
      byMember.clear();
      for (const s of squads) for (const id of s.members) byMember.set(id, s.id);
      return squads;
    },
    of(id) {
      const sid = byMember.get(id);
      return squads.find((s) => s.id === sid) ?? null;
    },
  };
}

export function confidence(squad, members, enemies, { value = () => 1, kills = 0, losses = 0 } = {}) {
  const foes = enemies.filter((e) => e.alive !== false);
  if (!foes.length) return { ratio: 1, level: 'neutral' };
  const mine = members.filter((m) => squad.members.includes(m.id) && m.alive !== false);
  let own = kills;
  let theirs = losses;
  for (const m of mine) {
    const v = value(m);
    const lvl = m.level ?? 'neutral';
    if (lvl === 'panicked') theirs += v;
    else own += v * CONFIDENCE[lvl];
  }
  for (const e of foes) {
    const v = value(e);
    const lvl = e.level ?? 'neutral';
    if (lvl === 'panicked') own += v;
    else theirs += v * CONFIDENCE[lvl];
  }
  const ratio = theirs <= 0 ? Infinity : own / theirs;
  return { ratio, level: levelOf(ratio) };
}

export function morale(level, event) {
  const i = LEVELS.indexOf(level);
  if (event?.type === 'leaderDown') return LEVELS[Math.max(0, i - 1)];
  if (event?.type === 'rally') return LEVELS[Math.min(4, i + 1)];
  return level;
}

export function frontline(squad, members, enemies, { buffer = 8, minWidth = 3 } = {}) {
  const mine = members.filter((m) => squad.members.includes(m.id) && m.alive !== false);
  const foes = enemies.filter((e) => e.alive !== false);
  const centre = centreOf(mine);
  const foeCentre = foes.length ? centreOf(foes) : add(centre, { x: 0, y: 0, z: 1 });
  const dir = unit(sub(foeCentre, centre));
  const right = { x: dir.z, y: 0, z: -dir.x };
  // the line: `buffer` short of the nearest enemy along dir
  let nearest = Infinity;
  for (const e of foes) nearest = Math.min(nearest, (e.at.x - centre.x) * dir.x + (e.at.z - centre.z) * dir.z);
  if (!Number.isFinite(nearest)) nearest = buffer * 2;
  const line = add(centre, dir, nearest - buffer);
  // its width: the enemy's spread across it, or the members abreast
  let lo = Infinity;
  let hi = -Infinity;
  for (const e of foes) {
    const s = (e.at.x - centre.x) * right.x + (e.at.z - centre.z) * right.z;
    lo = Math.min(lo, s);
    hi = Math.max(hi, s);
  }
  const spread = foes.length ? hi - lo + minWidth * 2 : 0;
  const width = Math.max(spread, mine.length * minWidth);
  // lanes, one per member, assigned to move the squad least (greedy by offset)
  const n = mine.length;
  const slots = Array.from({ length: n }, (_, i) => (n === 1 ? 0 : -width / 2 + (width * (i + 0.5)) / n));
  const across = mine.map((m) => ({ id: m.id, s: (m.at.x - centre.x) * right.x + (m.at.z - centre.z) * right.z })).sort((a, b) => a.s - b.s);
  const lanes = across.map((m, i) => ({ id: m.id, at: add(line, right, slots[i]), dir }));
  return { dir, right, centre, line, width, lanes, buffer };
}

export const posture = (level) => (level === 'panicked' || level === 'worried' ? 'retreat' : level === 'neutral' ? 'hold' : 'press');

const halves = (squad, members, front, furthestFirst) => {
  const mine = members.filter((m) => squad.members.includes(m.id) && m.alive !== false);
  const along = (m) => (m.at.x - front.centre.x) * front.dir.x + (m.at.z - front.centre.z) * front.dir.z;
  const sorted = [...mine].sort((a, b) => (furthestFirst ? along(a) - along(b) : along(b) - along(a)));
  const k = Math.ceil(sorted.length / 2);
  return { move: sorted.slice(0, k).map((m) => m.id), cover: sorted.slice(k).map((m) => m.id) };
};
export const advance = (squad, members, front) => halves(squad, members, front, true);
export const withdraw = (squad, members, front) => halves(squad, members, front, false);

// the two at the lane ends, each to a point off the enemy's nearer flank,
// level with the enemy's centre: never behind them, so the rear stays open
export function flankers(squad, members, front, enemies) {
  const foes = enemies.filter((e) => e.alive !== false);
  if (!foes.length || front.lanes.length < 2) return [];
  const foeCentre = centreOf(foes);
  const out = [];
  const ends = [front.lanes[0], front.lanes[front.lanes.length - 1]];
  ends.forEach((lane, i) => {
    const side = i === 0 ? -1 : 1;
    out.push({ id: lane.id, at: add(foeCentre, front.right, side * front.width * 0.6) });
  });
  return out;
}

export function createTokens({ pools = {}, scale = 1, timeout = 6 } = {}) {
  const held = new Map(); // `${kind}:${target}` → [{ who, priority, age }]
  const list = (kind, target) => {
    const k = `${kind}:${target}`;
    if (!held.has(k)) held.set(k, []);
    return held.get(k);
  };
  const limit = (kind) => Math.max(0, Math.round((pools[kind] ?? 0) * scale));
  const api = {
    claim(kind, who, { priority = 0, target = 'you' } = {}) {
      const l = list(kind, target);
      const mine = l.find((h) => h.who === who);
      if (mine) {
        mine.priority = priority;
        return true;
      }
      if (l.length >= limit(kind)) return false;
      l.push({ who, priority, age: 0 });
      return true;
    },
    release(kind, who, target = 'you') {
      const l = list(kind, target);
      const i = l.findIndex((h) => h.who === who);
      if (i >= 0) l.splice(i, 1);
    },
    held(kind, who, target = 'you') {
      return list(kind, target).some((h) => h.who === who);
    },
    // a better-placed claimant takes the lowest-priority holder's token
    steal(kind, who, priority, target = 'you') {
      if (api.claim(kind, who, { priority, target })) return true;
      const l = list(kind, target);
      let worst = null;
      for (const h of l) if (!worst || h.priority < worst.priority) worst = h;
      if (!worst || worst.priority >= priority) return false;
      l.splice(l.indexOf(worst), 1);
      l.push({ who, priority, age: 0 });
      return true;
    },
    audit(dt, alive = () => true) {
      for (const l of held.values())
        for (let i = l.length - 1; i >= 0; i--) {
          l[i].age += dt;
          if (!alive(l[i].who) || l[i].age > timeout) l.splice(i, 1);
        }
    },
    count(kind, target = 'you') {
      return list(kind, target).length;
    },
    clear() {
      held.clear();
    },
  };
  return api;
}
