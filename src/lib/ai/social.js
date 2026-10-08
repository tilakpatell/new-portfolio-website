// People with each other (the spec's "social.js"): what a crowd does that
// no one of them does alone. Two or three who want company meet a step
// apart, face one another and take turns, the speaker talking and the rest
// looking at the speaker, for seeded turns, then part and don't start again
// for a while. A group walks together: a leader on its route (the world's),
// the rest beside and behind it, each steered to its slot by steer.js's
// seek and kept apart by its separate, the leader waiting for one left
// behind. A walker ahead of you steps aside (a danger slot along your
// heading in its context steering) instead of walking through you, and one
// you walk into is shoved. One who knows you, or has a line, turns its
// head when you come within range, waves the first time, and watches you
// go; it waves again only once you've been well away. Pure, no three.js:
// the world plays what comes back (social's modes are body.js's, near
// enough: talk is its `talk`, the rest move or look).
//
//   createSocial({ rand }) → { step(people, t, dt, { you }) → [entry…], talking(id) }
//   people: [{ id, x, z, yaw?, company? (0…1, needs.js's level: 0.5 and up
//     seeks a conversation), busy? (using a place, scripted, fleeing: left
//     out of conversations, groups and making way; it may still greet),
//     knows? (knows you), line? (has a line), group?, leader? }]
//   you: { x, z, yaw, speed } the player (yaw: 0 along +z, toward +x; speed m/s)
//   entry: { who, mode, look?, with?, to?, wave?, shove? }, at most one each,
//     in people's order; none: the person's own brain as before
//     'walk'    go to `to` (meeting someone, or keeping a place in a group;
//               a group's leader with `to` where it stands: waiting)
//     'talk'    its turn: talk, looking at `look` (an id), standing at `to`
//     'listen'  looking at the speaker (`look`, an id), standing at `to`
//               (a step from the rest: a world settles it there, facing them)
//     'makeway' step to `to`, looking at you; `shove`: you walked into it
//     'greet'   whatever it was doing, its head on you (`look`, a point);
//               `wave`: the first time this approach (a walker's or a
//               maker of way's entry carries look and wave the same way)
//   with: whom it's with (an id); look: an id or a point { x, z }

import { seeded } from '../seeded';
import { clear, createContext, danger, interest, resolve, seek, separate } from './steer';

const WANT = 0.5; // company this pressing seeks a conversation
const MEET = 10; // metres: two this near go to talk
const APART = 1.3; // metres between two talking: a step apart
const ARRIVE = 0.2; // metres from its spot: there
const CLOSE = [3, 0.5]; // or, after this many seconds meeting, this near: near enough to start
const MEET_FOR = 12; // seconds: not met by then, it's off
const TURN = [1.6, 4.2]; // seconds a turn
const TURNS = [3, 7]; // turns a conversation (a three has one more)
const REST = [25, 60]; // seconds after one before another
const PAIR_EVERY = 0.5; // seconds between looks for a partner
const TRY = 0.5; // chance one who wants company looks this time (so a crowd's don't all start at once)
const THIRD = 0.45; // chance a third near enough joins
const JOIN = 5; // metres from a pair's middle a third may come from
const DRIFT = 4; // metres from the middle mid-talk: they've parted
// a group's places beside and behind its leader: [to its left, ahead]
const SLOTS = [
  [1.1, -0.2],
  [-1.1, -0.2],
  [0, -1.4],
  [1.1, -1.6],
  [-1.1, -1.6],
  [0, -2.8],
];
const SPACING = 0.9; // metres a group keeps between its members
const LAG = 5; // metres from its place: the leader waits for it
const WAY = { ahead: 3, wide: 0.9, clear: 1.3, moving: 0.5, shove: 0.6, shoveWide: 0.5 };
const GREET = { near: 6, rearm: 9 };

const span = (rand, [lo, hi]) => lo + (hi - lo) * rand();
const apart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ahead = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
const leftOf = (yaw) => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });

// where each of a conversation stands: a step apart, two facing, three in a ring
function spotsFor(members) {
  const n = members.length;
  const c = { x: 0, z: 0 };
  for (const p of members) {
    c.x += p.x / n;
    c.z += p.z / n;
  }
  const spots = {};
  if (n === 2) {
    const [a, b] = members;
    const d = apart(a, b);
    const u = d > 1e-6 ? { x: (b.x - a.x) / d, z: (b.z - a.z) / d } : { x: 1, z: 0 };
    spots[a.id] = { x: c.x - (u.x * APART) / 2, z: c.z - (u.z * APART) / 2 };
    spots[b.id] = { x: c.x + (u.x * APART) / 2, z: c.z + (u.z * APART) / 2 };
  } else {
    // round the middle in the order they stand, evenly
    const r = APART / Math.sqrt(3);
    const by = members.map((p) => ({ p, a: Math.atan2(p.x - c.x, p.z - c.z) })).sort((x, y) => x.a - y.a);
    by.forEach(({ p }, k) => {
      const a = by[0].a + (k * 2 * Math.PI) / n;
      spots[p.id] = { x: c.x + r * Math.sin(a), z: c.z + r * Math.cos(a) };
    });
  }
  return { center: c, spots };
}

export function createSocial({ rand = seeded(1) } = {}) {
  const talks = new Set(); // { ids, center, spots, phase: 'meet' | 'talk', since, speaker, to, until, left }
  const inTalk = new Map(); // id → its conversation
  const restUntil = new Map(); // id → t it may talk again
  const disarmed = new Set(); // ids that have waved this approach
  const ctxs = new Map(); // a follower's steering, kept for its hysteresis
  const scratch = createContext(16);
  const heading = new Map(); // group → { x, z, yaw }: its leader's way, from its steps when it gives none
  let nextPair = 0;

  const end = (talk, t) => {
    talks.delete(talk);
    for (const id of talk.ids) {
      inTalk.delete(id);
      restUntil.set(id, t + span(rand, REST));
    }
  };
  // whom a speaker looks at: the one it answers, else the next one round
  const nextSpeaker = (talk) => {
    const others = talk.ids.filter((id) => id !== talk.speaker);
    const next = others.length === 1 ? others[0] : others[Math.min(others.length - 1, Math.floor(rand() * others.length))];
    talk.to = talk.speaker;
    talk.speaker = next;
  };

  function converse(people, byId, t) {
    for (const talk of [...talks]) {
      const members = talk.ids.map((id) => byId.get(id));
      if (members.some((p) => !p || p.busy)) {
        end(talk, t);
        continue;
      }
      if (talk.phase === 'meet') {
        if (t - talk.since > MEET_FOR) end(talk, t);
        else if (members.every((p) => apart(p, talk.spots[p.id]) <= (t - talk.since > CLOSE[0] ? CLOSE[1] : ARRIVE))) {
          talk.phase = 'talk';
          talk.speaker = talk.ids[Math.min(talk.ids.length - 1, Math.floor(rand() * talk.ids.length))];
          talk.to = talk.ids.find((id) => id !== talk.speaker);
          talk.until = t + span(rand, TURN);
          talk.left = Math.round(span(rand, TURNS)) + (talk.ids.length > 2 ? 1 : 0);
        }
        continue;
      }
      if (members.some((p) => apart(p, talk.center) > DRIFT)) {
        end(talk, t);
        continue;
      }
      if (t >= talk.until) {
        talk.left--;
        if (talk.left <= 0) end(talk, t);
        else {
          nextSpeaker(talk);
          talk.until = t + span(rand, TURN);
        }
      }
    }
    // new ones, now and then: one who wants company and the nearest who does too
    if (t < nextPair) return;
    nextPair = t + PAIR_EVERY;
    const free = people.filter((p) => !p.busy && p.group == null && !inTalk.has(p.id) && (p.company ?? 0) >= WANT && (restUntil.get(p.id) ?? -Infinity) <= t);
    const taken = new Set();
    const nearest = (from, within, not) => {
      let best = null;
      let bd = within;
      for (const q of free) {
        if (taken.has(q.id) || not.includes(q)) continue;
        const d = apart(from, q);
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
      return best;
    };
    for (const a of free) {
      if (taken.has(a.id) || rand() >= TRY) continue;
      const b = nearest(a, MEET, [a]);
      if (!b) continue;
      const members = [a, b];
      if (rand() < THIRD) {
        const c = nearest({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, JOIN, members);
        if (c) members.push(c);
      }
      const talk = { ids: members.map((p) => p.id), phase: 'meet', since: t, ...spotsFor(members) };
      talks.add(talk);
      for (const p of members) {
        taken.add(p.id);
        inTalk.set(p.id, talk);
      }
    }
  }

  function groups(people, out) {
    const by = new Map();
    for (const p of people) if (p.group != null) (by.get(p.group) ?? by.set(p.group, []).get(p.group)).push(p);
    for (const [g, members] of by) {
      const lead = members.find((p) => p.leader) ?? members[0];
      // which way the leader's going: its yaw, else its steps
      const was = heading.get(g);
      let yaw = Number.isFinite(lead.yaw) ? lead.yaw : (was?.yaw ?? 0);
      if (!Number.isFinite(lead.yaw) && was && apart(was, lead) > 0.05) yaw = Math.atan2(lead.x - was.x, lead.z - was.z);
      heading.set(g, { x: lead.x, z: lead.z, yaw });
      const F = ahead(yaw);
      const L = leftOf(yaw);
      let worst = null;
      let k = 0;
      for (const p of members) {
        if (p === lead || p.busy || inTalk.has(p.id)) continue;
        const [l, f] = SLOTS[k % SLOTS.length];
        const back = Math.floor(k / SLOTS.length) * 2.8;
        k++;
        const slot = { x: lead.x + L.x * l + F.x * (f - back), z: lead.z + L.z * l + F.z * (f - back) };
        const d = apart(p, slot);
        let to = slot;
        if (d > ARRIVE) {
          let ctx = ctxs.get(p.id);
          if (!ctx) ctxs.set(p.id, (ctx = createContext(16)));
          clear(ctx);
          seek(ctx, { x: p.x, y: 0, z: p.z }, { x: slot.x, y: 0, z: slot.z }, 1);
          separate(
            ctx,
            { x: p.x, y: 0, z: p.z },
            members.filter((q) => q !== p).map((q) => ({ x: q.x, y: 0, z: q.z })),
            SPACING,
          );
          const r = resolve(ctx, { blend: 0.3 });
          if (r.strength > 0) {
            const step = Math.min(d, 2);
            to = { x: p.x + r.dir.x * step, z: p.z + r.dir.z * step };
          }
        }
        out.set(p.id, { who: p.id, mode: 'walk', to, with: lead.id });
        if (d > LAG && (!worst || d > worst.d)) worst = { id: p.id, d };
      }
      // one left behind: the leader waits where it is
      if (worst && !lead.busy && !inTalk.has(lead.id)) out.set(lead.id, { who: lead.id, mode: 'walk', to: { x: lead.x, z: lead.z }, with: worst.id });
    }
  }

  function makeWay(people, you, out) {
    if (!you || !(Math.abs(you.speed ?? 0) > WAY.moving)) return;
    const F = ahead(you.yaw ?? 0);
    const L = leftOf(you.yaw ?? 0);
    for (const p of people) {
      if (p.busy) continue;
      const rx = p.x - you.x;
      const rz = p.z - you.z;
      const along = rx * F.x + rz * F.z;
      const lat = rx * L.x + rz * L.z;
      if (along <= 0 || along >= WAY.ahead || Math.abs(lat) >= WAY.wide) continue;
      // out to the side it's on: your heading (both ways along it) is danger
      const side = lat >= 0 ? 1 : -1;
      clear(scratch);
      interest(scratch, { x: L.x * side, y: 0, z: L.z * side }, 1, 3);
      danger(scratch, { x: -F.x, y: 0, z: -F.z }, 1, 2);
      danger(scratch, { x: F.x, y: 0, z: F.z }, 0.5, 1);
      scratch.blended = false;
      const { dir, strength } = resolve(scratch, { blend: 0 });
      const d = strength > 0 ? dir : { x: L.x * side, z: L.z * side };
      const step = Math.max(0.4, WAY.clear - Math.abs(lat));
      const e = { who: p.id, mode: 'makeway', to: { x: p.x + d.x * step, z: p.z + d.z * step }, look: { x: you.x, z: you.z } };
      if (along < WAY.shove && Math.abs(lat) < WAY.shoveWide) e.shove = true;
      out.set(p.id, e);
    }
  }

  function greet(people, you, out) {
    if (!you) return;
    for (const p of people) {
      if (!p.knows && !p.line) continue;
      const d = apart(p, you);
      if (d > GREET.rearm) {
        disarmed.delete(p.id);
        continue;
      }
      // a talker keeps talking
      if (inTalk.has(p.id) && talks.has(inTalk.get(p.id)) && inTalk.get(p.id).phase === 'talk') continue;
      const watching = d < GREET.near || disarmed.has(p.id);
      if (!watching) continue;
      const wave = d < GREET.near && !disarmed.has(p.id);
      if (wave) disarmed.add(p.id);
      const look = { x: you.x, z: you.z };
      const e = out.get(p.id);
      if (e) {
        e.look = look;
        if (wave) e.wave = true;
      } else out.set(p.id, { who: p.id, mode: 'greet', look, ...(wave ? { wave: true } : {}) });
    }
  }

  return {
    step(people, t, dt, { you = null } = {}) {
      const list = people ?? [];
      const byId = new Map(list.map((p) => [p.id, p]));
      converse(list, byId, t);
      const out = new Map();
      for (const talk of talks)
        for (const id of talk.ids) {
          const p = byId.get(id);
          const other = talk.ids.find((o) => o !== id);
          // (talking, `to` is its spot: where to settle, if it isn't quite there)
          if (talk.phase === 'talk') out.set(id, id === talk.speaker ? { who: id, mode: 'talk', look: talk.to, with: talk.to, to: { ...talk.spots[id] } } : { who: id, mode: 'listen', look: talk.speaker, with: talk.speaker, to: { ...talk.spots[id] } });
          else if (apart(p, talk.spots[id]) > ARRIVE) {
            const e = { who: id, mode: 'walk', to: { ...talk.spots[id] }, with: other };
            if (apart(p, byId.get(other)) < 3) e.look = other;
            out.set(id, e);
          } else out.set(id, { who: id, mode: 'listen', look: other, with: other });
        }
      groups(list, out);
      makeWay(list, you, out);
      greet(list, you, out);
      const res = [];
      for (const p of list) if (out.has(p.id)) res.push(out.get(p.id));
      return res;
    },
    talking: (id) => inTalk.has(id),
  };
}
