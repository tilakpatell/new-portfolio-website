// What every destination's builder (./<id>.js) starts from: the room kit
// (../interiors/shell.js's makeRoom) with the place's box from
// ./destinations.js, and
//   - outdoors, a sky (../sky.js) and a painted ground running out past the box;
//   - indoors, a floor, a ceiling and four walls round the box;
//   - the portal home, swirling where the place's way back is;
//   - its people and things from the Meshy cast, fetched once the place is
//     up (so the portal's swirl never waits on them) and left out if one
//     won't load: never a person in shapes (the plan's rule).
//
// stage(kit, id, opts) → { R, d, A, cx, cz, P(dx, dz) (a spot in the world
// from the place's middle), figure(kind, at), people(), done(light, update),
// hunt(on), calm() } (and the NPC behaviour below: anyone placed with `ai`)

import * as THREE from 'three';
import { makeSky } from '../sky';
import { BOX, ceilings, makeRoom, tiledPaint, wallLine } from '../interiors/shell';
import { at, speckle } from '../kit';
import { RIGGED } from '../../portal/meshyCast';
import { destinationById } from './destinations';
import { avoid, createContext, resolve, seek, separate } from '../../../../lib/ai/steer';
import { STRIKE, fire as fireAt, newDuel, strike as strikeAt } from './duel';

// a speckled paint for a floor or the ground
export const specks = (base, specks, seed = 7, n = 1600, size = 2) => (g, w, h) => speckle(g, w, h, { base, specks, n, size, seed });

export function stage(kit, id, { ground, groundTile = 4, floor, floorTile = 2, wall = 0xd8d0c0, wallH = null, ceiling = 0xe9e0cc, skirt = 0x5e4734, dado = null } = {}) {
  const d = destinationById(id);
  const A = d.area;
  const R = makeRoom(kit, id);
  const { x: cx, z: cz } = d.centre;
  const P = (dx, dz) => [cx + dx, cz + dz];
  let sky = null;

  if (d.kind === 'outdoor') {
    sky = makeSky(560, d.sky);
    R.group.add(sky.dome);
    R.noInk.push(sky.dome);
    // the ground, out well past the box to the horizon's fog
    const mat = tiledPaint(kit.mats, `c137-${id}-ground`, 256, groundTile, ground ?? specks('#7a9a52', ['#6a8a46', '#8aaa5e']), { color: 0xffffff });
    R.tiled.add(BOX, mat, at(cx, -0.05, cz, 0, A.x1 - A.x0 + 260, 0.1, A.z1 - A.z0 + 260));
  } else {
    const H = d.ceiling;
    const mat = tiledPaint(kit.mats, `c137-${id}-floor`, 256, floorTile, floor ?? specks('#bfb6a6', ['#b0a796', '#cbc3b4']), { color: 0xffffff });
    R.tiled.add(BOX, mat, at(cx, -0.05, cz, 0, A.x1 - A.x0 + 0.4, 0.1, A.z1 - A.z0 + 0.4));
    ceilings(R, [[A.x0 - 0.2, A.x1 + 0.2, A.z0 - 0.2, A.z1 + 0.2]], H, ceiling);
    const w = { color: wall, skirt, h: wallH ?? H, ...(dado && { dado }) };
    const F = R.fixed;
    wallLine(R, F, [A.x0, A.z0 - 0.2], [A.x0, A.z1 + 0.2], { ...w, into: [1, 0] });
    wallLine(R, F, [A.x1, A.z0 - 0.2], [A.x1, A.z1 + 0.2], { ...w, into: [-1, 0] });
    wallLine(R, F, [A.x0 - 0.2, A.z0], [A.x1 + 0.2, A.z0], { ...w, into: [0, 1] });
    wallLine(R, F, [A.x0 - 0.2, A.z1], [A.x1 + 0.2, A.z1], { ...w, into: [0, -1] });
  }

  // ── the portal home, turned to the camera, shrinking away while the camera's on it ──
  const portalMat = R.own(kit.portal());
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 3.3), portalMat);
  portal.position.set(d.back.x, 1.75, d.back.z);
  R.add(portal, { ink: false });
  R.tick((t, dt, state, camera) => {
    if (!camera) return;
    const pd = Math.hypot(camera.position.x - portal.position.x, camera.position.z - portal.position.z);
    portal.rotation.y = Math.atan2(camera.position.x - portal.position.x, camera.position.z - portal.position.z);
    portalMat.uniforms.open.value = Math.min(1, Math.max(0, (pd - 2.2) / 2.4));
    portalMat.uniforms.t.value = t;
  });

  // ── the cast ──
  const fetched = new Map();
  const load = (kinds) => {
    const key = kinds.join(',');
    if (!fetched.has(key)) {
      const clips = kinds.some((k) => RIGGED.has(k)) ? ['idle', 'walk'] : [];
      fetched.set(
        key,
        kit.need(kinds, { clips }).catch(() => null),
      );
    }
    return fetched.get(key);
  };
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
  const blocks = d.solids.flatMap((o) => {
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
      if (!n.hunting && (hunting || h.always || (h.near != null && toM < h.near))) n.hunting = true;
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
          state.emit?.('strike', { area: id, who: n.id, hp: n.duel.hp, max: n.duel.max, mortyHp: n.duel.mortyHp, mortyMax: n.duel.mortyMax, beaten: n.duel.beaten, text: h.line ?? d.caught });
        }
      } else {
        turnTo(c, face, dt);
        if (!state.fading && t - (n.caughtAt ?? -1e9) > 3) {
          n.caughtAt = t;
          state.emit?.('caught', { area: id, who: n.id, text: h.line ?? d.caught });
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

  // one of the cast at (x, z) facing `face`, `h` tall (its own height if not
  // given), gone once `until` is done and till `after` is (`when(state)`, if
  // given, says instead); with `ai`, someone who does something (above);
  // null if it won't load
  const make = (kind, { x, z, face = 0, h = null, y = 0, until = null, after = null, when = null, onPlace = null, ai = null, id = kind, who = null }) => {
    const c = kit.cast?.make?.(kind);
    if (!c) return null;
    if (h) c.group.scale.setScalar(h / c.height);
    c.group.position.set(x, y, z);
    c.group.rotation.y = face + Math.PI / 2;
    R.group.add(c.group);
    const n = ai ? { c, ai, id, who, home: { x, z }, y, y0: y, face, i: 0, waitTill: 0, hunting: false } : null;
    if (n) npcs.push(n);
    if (ai?.clip) c.play?.(ai.clip, { loop: true });
    R.tick((t, dt, state) => {
      const done = state?.done ?? [];
      c.group.visible = when ? when(state) : (!until || !done.includes(until)) && (!after || done.includes(after));
      if (!c.group.visible) return;
      if (n) stepNpc(n, t, dt, state);
      else c.update?.(t, 0, 0);
    });
    onPlace?.(c);
    return c;
  };
  const placed = [];
  // things to place once their models are in: [kind, at] pairs (`at.onPlace(c)`: told when it's stood)
  const figure = (kind, spot) => placed.push([kind, spot]);
  // the place's people and its crowd, from ./destinations.js (`extras`:
  // what the crowd stands with, as `when` for a crowd that runs off; `who`:
  // more for a person by id, say a `when` of their own)
  const people = ({ extras = {}, who = {} } = {}) => {
    for (const p of d.people) figure(p.who ?? p.id, { x: p.x, z: p.z, y: p.y ?? 0, face: p.face, until: p.until, after: p.after, ai: p.ai ?? null, id: p.id, who: d.say[p.id]?.who ?? null, ...(who[p.id] ?? {}) });
    for (const [i, e] of d.extras.entries()) figure(e.kind, { x: e.x, z: e.z, y: e.y ?? 0, face: e.face, h: e.h ?? null, ai: e.ai ?? null, id: `${e.kind}-${i}`, ...extras });
  };

  const done = (light, update) => {
    const area = R.build({
      light,
      update: (t, dt, state, camera) => {
        sky?.update(t, camera);
        update?.(t, dt, state, camera);
      },
    });
    // the cast, fetched behind the scenes and stood in place as each arrives
    const kinds = [...new Set(placed.map(([k]) => k))];
    if (kinds.length)
      kit.track(
        Promise.all(kinds.map((k) => load([k]))).then(() => {
          for (const [k, spot] of placed) make(k, spot);
        }),
      );
    // (every place settles when Morty leaves it: its hunters go home. A
    // builder adds its own actions to these.)
    // (`npcs`: where everyone is, for the QA scripts)
    area.actions = {
      calm: calmNpcs,
      npcs: () => npcs.map((n) => ({ id: n.id, x: +n.c.group.position.x.toFixed(1), z: +n.c.group.position.z.toFixed(1), hunting: n.hunting, visible: n.c.group.visible, hp: n.duel?.hp ?? null, dead: Boolean(n.dead) })),
      // Morty's shot, from where he stands facing `face`: at the duel's hunter, if he's in the cone
      fire: ({ x, z, face }) => {
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
      },
    };
    return area;
  };
  // the place's hunters, after Morty (or not)
  const hunt = (on = true) => {
    hunting = on;
    if (!on) for (const n of npcs) n.hunting = false;
  };

  return { R, d, A, cx, cz, P, figure, people, done, hunt, npcs, calm: calmNpcs };

}
