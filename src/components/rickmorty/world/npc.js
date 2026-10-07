// What the people of a place do while Morty's about: the NPC layer the
// dial's destinations (dimensions/stage.js) and the street (visitors.js)
// share. Each figure placed with `ai` gets a brain here; the place steps it
// each frame with the render state, and the brains talk to RmWorld through
// state.emit ('caught', 'bark', 'spotted', 'duel', 'strike', 'done').
//
//   createNpcs({ id, area, solids, words }) → { add(c, spot) → n, step(n, t, dt, state),
//     calm(), hunt(on), fire(shot), list(), npcs, hunting }
//
// id: the area's; area: its box { x0, x1, z0, z1 }, kept to; solids: what's
// in the way ({ x, z, w, d } boxes and { x, z, r } posts); words: { caught,
// spotted }, the place's lines when a hunter catches or sees him.

import { avoid, createContext, resolve, seek, separate } from '../../../lib/ai/steer';
import { STRIKE, fire as fireAt, newDuel, strike as strikeAt } from './dimensions/duel';

export function createNpcs({ id, area: A, solids = [], words = {} }) {
  // ── NPC behaviour ──
  // Anyone placed may carry `ai`: what they do while Morty's about.
  //   wander: [[x, z], …]   walks the points in turn (speed m/s, pause s at each)
  //   watch: r              turns to Morty when he's within r
  //   bark: { r, lines, every }  says one of `lines` when he's within r, at most every `every` s
  //   hunt: { speed, catchR, near?, lose?, until?, always?, line? }  goes for Morty while
  //         the place is hunting (S.hunt(true), or on its own when he's within `near`,
  //         given up past `lose`; `always`: from the start), and tells RmWorld 'caught'
  //         (state.emit) within catchR, with `line` or the place's `caught`; `until`: a
  //         task that, done, ends it
  //         duel: { hp, task, won? }: a fight instead of a catch (./duel.js): within reach he
  //         strikes (the 'punch' clip; RmWorld's 'strike' takes a point off Morty), and
  //         Morty's shots (the area's 'fire' action, F in RmWorld) take his; at nought he
  //         falls (the 'fall' clip), stays down, and `task` is done ('done'), with `won`
  //         said. The duel is told to RmWorld as 'duel' { hp, max } as it goes.
  //   clip: a shared clip looped while standing (Evil Morty's crossed arms)
  //   home: kept where placed between behaviours; `calm` puts everyone back
  const npcs = [];
  let hunting = false;
  const ROOM_PAD = 0.8;
  const clampIn = (o) => {
    o.x = Math.min(A.x1 - ROOM_PAD, Math.max(A.x0 + ROOM_PAD, o.x));
    o.z = Math.min(A.z1 - ROOM_PAD, Math.max(A.z0 + ROOM_PAD, o.z));
  };
  const headingTo = (dx, dz) => Math.atan2(-dz, dx);
  // what's in the way of anyone walking here: the place's solids as circles
  // for the steering's avoid (a box as a row of circles along its long side,
  // each as wide as its short one, so a bench doesn't close the aisle)
  const blocks = solids.flatMap((o) => {
    if (o.r != null) return [{ at: { x: o.x, z: o.z }, r: o.r }];
    const long = Math.max(o.w, o.d);
    const short = Math.min(o.w, o.d);
    const n = Math.max(1, Math.ceil(long / short));
    const alongX = o.w >= o.d;
    return Array.from({ length: n }, (_, i) => {
      const u = n === 1 ? 0 : -long / 2 + short / 2 + (i * (long - short)) / (n - 1);
      return { at: { x: o.x + (alongX ? u : 0), z: o.z + (alongX ? 0 : u) }, r: short / 2 };
    });
  });
  // a step towards `to` for `n`, round the solids and the others (context
  // steering, lib/ai/steer.js): where it's heading, or null if it's stuck
  const steerTo = (n, to, speed, dt) => {
    const g = n.c.group;
    const from = { x: g.position.x, z: g.position.z };
    const ctx = (n.ctx ??= createContext(16));
    ctx.interest.fill(0);
    ctx.danger.fill(0);
    seek(ctx, from, to, 1);
    const vel = { x: Math.cos(n.heading ?? 0) * speed, z: -Math.sin(n.heading ?? 0) * speed };
    for (const b of blocks) avoid(ctx, from, vel, b, 0.45, 2.5);
    separate(
      ctx,
      from,
      npcs.filter((o) => o !== n && o.c.group.visible).map((o) => ({ x: o.c.group.position.x, z: o.c.group.position.z })),
      1.3,
    );
    const { dir, strength } = resolve(ctx, { blend: 0.25 });
    if (strength < 1e-4) return null;
    const l = Math.hypot(dir.x, dir.z) || 1;
    g.position.x += (dir.x / l) * speed * dt;
    g.position.z += (dir.z / l) * speed * dt;
    n.heading = headingTo(dir.x, dir.z);
    return n.heading;
  };
  const turnTo = (c, face, dt, k = 8) => {
    const want = face + Math.PI / 2;
    let diff = want - c.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    c.group.rotation.y += diff * Math.min(1, dt * k);
  };
  const stepNpc = (n, t, dt, state) => {
    const { c, ai } = n;
    const m = state?.morty;
    const done = state?.done ?? [];
    const g = c.group;
    const toM = m ? Math.hypot(m.x - g.position.x, m.z - g.position.z) : Infinity;
    let move = 0;
    const h = ai.hunt;
    const huntOver = h?.until && done.includes(h.until);
    if (h && !huntOver) {
      if (!n.hunting && (hunting || h.always || (h.near != null && toM < h.near))) {
        n.hunting = true;
        // (one who's spotted him on his own says so: RmWorld's word and sound)
        if (!hunting && !h.always && !h.duel) state.emit?.('spotted', { area: id, who: n.id, text: h.spotted ?? words.spotted ?? 'They’ve seen you. Move.' });
      }
      if (n.hunting && !hunting && h.lose != null && toM > h.lose) n.hunting = false;
    } else n.hunting = false;
    if (n.dead) {
      // down for the count: nothing more from him
    } else if (n.hunting && m) {
      if (h.duel && !n.duel) {
        n.duel = newDuel({ hp: h.duel.hp ?? 6, mortyHp: h.duel.mortyHp ?? 3 });
        state.emit?.('duel', { area: id, who: n.id, hp: n.duel.hp, max: n.duel.max, mortyHp: n.duel.mortyHp, mortyMax: n.duel.mortyMax });
      }
      const face = headingTo(m.x - g.position.x, m.z - g.position.z);
      const reach = h.duel ? STRIKE.reach : h.catchR;
      if (toM > reach) {
        const went = steerTo(n, { x: m.x, z: m.z }, Math.min(h.speed, (toM - reach * 0.8) / Math.max(dt, 1e-3)), dt);
        move = went == null ? 0 : Math.min(1, h.speed / 3);
        turnTo(c, went ?? face, dt);
      } else if (h.duel) {
        turnTo(c, face, dt);
        if (!state.fading && t - (n.struckAt ?? -1e9) > STRIKE.every) {
          n.struckAt = t;
          n.duel = strikeAt(n.duel);
          c.play?.('punch', { hold: 0.1 });
          state.emit?.('strike', { area: id, who: n.id, hp: n.duel.hp, max: n.duel.max, mortyHp: n.duel.mortyHp, mortyMax: n.duel.mortyMax, beaten: n.duel.beaten, text: h.line ?? words.caught });
        }
      } else {
        turnTo(c, face, dt);
        if (!state.fading && t - (n.caughtAt ?? -1e9) > 3) {
          n.caughtAt = t;
          state.emit?.('caught', { area: id, who: n.id, text: h.line ?? words.caught });
        }
      }
    } else if (ai.wander?.length) {
      const [tx, tz] = ai.wander[n.i % ai.wander.length];
      const dist = Math.hypot(tx - g.position.x, tz - g.position.z);
      if (n.waitTill > t) {
        if (ai.watch && toM < ai.watch) turnTo(c, headingTo(m.x - g.position.x, m.z - g.position.z), dt, 4);
      } else if (dist < 0.3) {
        n.i++;
        n.waitTill = t + (ai.pause ?? 1.5) * (0.6 + (0.8 * ((n.i * 7919) % 10)) / 10);
      } else {
        const sp = ai.speed ?? 1.1;
        const went = steerTo(n, { x: tx, z: tz }, Math.min(sp, dist / Math.max(dt, 1e-3)), dt);
        move = went == null ? 0 : Math.min(0.5, sp / 2.4);
        if (went != null) turnTo(c, went, dt, 6);
        // (stuck a while against something: on to the next point)
        n.stuck = went == null ? (n.stuck ?? 0) + dt : 0;
        if (n.stuck > 2) {
          n.i++;
          n.stuck = 0;
        }
      }
    } else if (ai.watch && m) {
      if (toM < ai.watch) turnTo(c, headingTo(m.x - g.position.x, m.z - g.position.z), dt, 4);
      else turnTo(c, n.face, dt, 2);
    }
    if (ai.bark && m && toM < ai.bark.r && t > (n.barkAt ?? -1e9) + (ai.bark.every ?? 14) && !state.fading) {
      n.barkAt = t;
      n.barkN = (n.barkN ?? -1) + 1;
      state.emit?.('bark', { area: id, who: n.who ?? n.id, text: ai.bark.lines[n.barkN % ai.bark.lines.length] });
    }
    clampIn(g.position);
    g.position.y = n.y;
    c.update?.(t, move, 0);
  };
  const calmNpcs = () => {
    hunting = false;
    for (const n of npcs) {
      n.hunting = false;
      // (a duel's hunter who's not been beaten gets up and goes home; one who has stays down)
      if (!n.dead) {
        n.duel = null;
        if (n.ai.clip) n.c.play?.(n.ai.clip, { loop: true });
        else n.c.stop?.();
      }
      n.i = 0;
      n.waitTill = 0;
      n.y = n.y0;
      n.c.group.position.set(n.home.x, n.y, n.home.z);
      n.c.group.rotation.y = n.face + Math.PI / 2;
    }
  };

  // a figure that does something: its brain, stepped by step()
  const add = (c, { x, z, y = 0, face = 0, ai, id: nid = c.kind, who = null }) => {
    const n = { c, ai, id: nid, who, home: { x, z }, y, y0: y, face, i: 0, waitTill: 0, hunting: false };
    npcs.push(n);
    if (ai.clip) c.play?.(ai.clip, { loop: true });
    return n;
  };
  const step = (n, t, dt, state) => stepNpc(n, t, dt, state);
  // where everyone is, for the QA scripts
  const list = () => npcs.map((n) => ({ id: n.id, x: +n.c.group.position.x.toFixed(1), z: +n.c.group.position.z.toFixed(1), hunting: n.hunting, visible: n.c.group.visible, hp: n.duel?.hp ?? null, dead: Boolean(n.dead) }));
  // the place's hunters, after Morty (or not)
  const hunt = (on = true) => {
    hunting = on;
    if (!on) for (const n of npcs) n.hunting = false;
  };
      // Morty's shot, from where he stands facing `face`: at the duel's hunter, if he's in the cone
  const fire = ({ x, z, face }) => {
    for (const n of npcs) {
      if (!n.ai.hunt?.duel || !n.hunting || n.dead || !n.c.group.visible) continue;
      n.duel ??= newDuel({ hp: n.ai.hunt.duel.hp ?? 6, mortyHp: n.ai.hunt.duel.mortyHp ?? 3 });
      n.duel = fireAt(n.duel, { x, z }, face, { x: n.c.group.position.x, z: n.c.group.position.z });
      if (n.duel.hit) n.c.play?.(n.duel.down ? 'fall' : 'hit', n.duel.down ? { hold: 1e9 } : { hold: 0 });
      if (n.duel.down) {
        n.dead = true;
        n.hunting = false;
        hunting = false;
      }
      return { hit: n.duel.hit, down: n.duel.down, hp: n.duel.hp, max: n.duel.max, who: n.id, task: n.ai.hunt.duel.task ?? null, won: n.ai.hunt.duel.won ?? null };
    }
    return null;
  }
  return {
    add,
    step,
    calm: calmNpcs,
    hunt,
    fire,
    list,
    npcs,
    get hunting() {
      return hunting;
    },
  };
}
