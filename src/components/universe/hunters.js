// Hunters: the ones who come after you. Fly with Luke or Han and it's the
// Empire (TIE fighters in twos and threes, interceptors, and now and then
// Vader himself in his TIE Advanced, who takes some stopping); fly with Rick
// and it's the Galactic Federation's patrol fighters, or the Council of Ricks,
// out of their portals in their own cruisers, wanting their Rick back.
//
// A pack arrives behind you (or, for the Council, out of portals round you)
// and makes attack runs, as fighters do: each swings out ahead of you, off
// to one side, turns, and comes at you head on, firing when it has you in
// its sights (leading you a little: a cloud of lasers, not a wall, and they
// miss more often than not), screams past and swings out again, the other
// side. Faster than you cruise, slower than you boost; they bank into their
// turns.
// Shoot them down (the tougher ones take a few hits), or outrun them: get
// far enough away for long enough (boosting, or best of all out in deep
// space on the pulse drive) and they give up and peel away. Lasers that
// hit you are the scene's to count against your shields.
//
// A hunter can also be sent after something else (`prey`, a distress call:
// pirates on a freighter), and it shoots at that instead until you deal with
// it, or turns on you if you shoot at it.
//
// createHunters(parent, { small }) → { pack(faction, ship, { prey, size, ace, from }) → points,
//   update(dt, t, ship) → events,
//   hit(from, to) → hit or null, clear(), dispose(), count, active }
// Events: { type: 'hunted', faction, kinds, prey }, { type: 'laser', damage,
// from }, { type: 'escaped', faction } and { type: 'cleared', faction,
// rescued } (rescued: they were after someone else, and you saw them off).
// Everything is in `parent`'s space (the map's).

import * as THREE from 'three';
import { createFleet } from './glbFleet';
import { forward } from './ship';

// who hunts for whom: which kinds come (and how often each), their ace (a
// tougher one who joins now and then), their lasers' colour
export const FACTIONS = {
  empire: { family: 'starwars', kinds: [['tie', 3], ['interceptor', 2]], ace: 'tieadvanced', laser: [0.5, 5.5, 0.9], size: [2, 4] },
  federation: { family: 'rickmorty', kinds: [['patrol', 1]], laser: [0.6, 2.2, 6.5], size: [2, 3] },
  council: { family: 'rickmorty', kinds: [['councilship', 1]], laser: [0.6, 5.5, 4.2], size: [1, 3], portal: true },
  // pirates: what's after someone in distress
  bugs: { family: 'rickmorty', kinds: [['gromflomite', 1]], laser: [0.6, 2.2, 6.5], size: [2, 3] },
};
// size: its biggest dimension in map units; speed: its top speed; accel: how
// hard it changes course; hp: hits it takes; fire: seconds between shots
const KIND = {
  tie: { size: 0.3, speed: 22, accel: 17, hp: 1, fire: [0.8, 1.6] },
  interceptor: { size: 0.32, speed: 25, accel: 20, hp: 1, fire: [0.7, 1.3] },
  tieadvanced: { size: 0.36, speed: 26, accel: 22, hp: 5, fire: [0.45, 0.8] },
  patrol: { size: 0.34, speed: 22, accel: 17, hp: 2, fire: [0.8, 1.5] },
  councilship: { size: 0.42, speed: 24, accel: 19, hp: 3, fire: [0.6, 1.1] },
  gromflomite: { size: 0.3, speed: 20, accel: 16, hp: 1, fire: [0.9, 1.7] },
};
const LASER = { speed: 34, life: 1.1, damage: 12, length: 0.36 };
const LOSE = { far: 48, after: 5 }; // they give up once you're this far away for this long
const SHIP_R = 0.2; // how close a laser must pass you to hit

const between = (rand, a, b) => a + rand() * (b - a);

export function createHunters(parent, { small = false, fleet = createFleet() } = {}) {
  const rand = Math.random;
  const pool = {}; // kind → models not in use
  const live = []; // hunters in flight
  const packs = []; // { faction, members, lost, said }
  const lasers = [];
  const laserGeo = new THREE.CylinderGeometry(0.009, 0.009, LASER.length, 5).rotateX(Math.PI / 2);
  const laserMats = Object.fromEntries(
    Object.entries(FACTIONS).map(([id, f]) => [id, new THREE.MeshBasicMaterial({ color: new THREE.Color(...f.laser), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })]),
  );
  for (let i = 0; i < (small ? 16 : 28); i++) {
    const m = new THREE.Mesh(laserGeo, laserMats.empire);
    m.visible = false;
    m.frustumCulled = false;
    m.userData = { v: new THREE.Vector3(), life: 0, at: null };
    parent.add(m);
    lasers.push(m);
  }

  const take = (kind) => {
    // a built stand-in waiting in the pool gives way once the model is here
    if (fleet.loaded(kind) && pool[kind]?.length && !pool[kind][pool[kind].length - 1].model) for (const m of pool[kind].splice(0)) m.dispose();
    const model = pool[kind]?.pop() ?? fleet.make(kind);
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1);
    parent.add(model.group);
    return model;
  };
  const give = (kind, model) => {
    model.group.removeFromParent();
    (pool[kind] ??= []).push(model);
  };
  const pick = (list) => {
    const total = list.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [k, w] of list) if ((r -= w) <= 0) return k;
    return list[list.length - 1][0];
  };

  const tmp = new THREE.Vector3();
  const want = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const look = new THREE.Vector3();
  const you = new THREE.Vector3();
  const yourVel = new THREE.Vector3();

  // where a pack comes from: behind you, spread out, a little above and
  // below; or, for the Council, from portals opening ahead of you, where you
  // can see them
  function entry(ship, i, n, portal, from) {
    const [fx, fz] = forward(ship.heading);
    // out of a hangar (a Star Destroyer's belly): one after another, spread a little
    if (from) return new THREE.Vector3(from.x + (rand() - 0.5) * 3, from.y - i * 0.6, from.z + (rand() - 0.5) * 3);
    if (portal) {
      const a = ship.heading + (i - (n - 1) / 2) * 0.32;
      const [px, pz] = forward(a);
      const d = 9 + i * 1.5;
      return new THREE.Vector3(ship.x + px * d, ship.y + 0.6 + (i % 2 ? 1 : -0.4), ship.z + pz * d);
    }
    const back = 26 + i * 2.5;
    const side = (i - (n - 1) / 2) * 2.2;
    return new THREE.Vector3(ship.x - fx * back - fz * side, ship.y + (rand() - 0.5) * 3, ship.z - fz * back + fx * side);
  }

  return {
    // a pack of hunters after you (or after `prey`: { position, quaternion }
    // of something else, e.g. a freighter in distress). Returns the points
    // they came in at (the scene opens a portal or flashes a jump at each)
    pack(faction, ship, { prey = null, size, ace = rand() < 0.22, from = null } = {}) {
      const f = FACTIONS[faction];
      if (!f || !ship) return [];
      const n = size ?? Math.round(between(rand, f.size[0], f.size[1] + 0.49));
      const kinds = Array.from({ length: n }, () => pick(f.kinds));
      if (f.ace && ace) kinds[0] = f.ace;
      const pack = { faction, members: [], lost: 0, fade: 0, prey, wasPrey: Boolean(prey), kinds };
      const points = [];
      kinds.forEach((kind, i) => {
        const type = KIND[kind];
        const model = take(kind);
        const pos = entry(ship, i, n, f.portal && !from, from);
        points.push(pos.clone());
        const [fx, fz] = forward(ship.heading);
        const h = {
          kind,
          type,
          model,
          pack,
          pos,
          vel: new THREE.Vector3(fx, 0, fz).multiplyScalar(type.speed * 0.8),
          hp: type.hp,
          mode: 'set', // swinging out ahead to come round ('set'), or coming at you ('run')
          side: i % 2 ? 1 : -1,
          out: 10 + rand() * 6,
          wide: 3 + rand() * 5,
          high: (rand() - 0.5) * 3,
          cool: between(rand, 1.2, 2.4), // a moment before the first shot
          bank: 0,
          grow: f.portal ? 0 : 1,
          alive: true,
        };
        pack.members.push(h);
        live.push(h);
      });
      packs.push(pack);
      return points;
    },

    // ship: yours ({ x, y, z, heading, speed, vy }) or null (not flying:
    // they all leave)
    update(dt, t, ship) {
      const events = [];
      if (ship) {
        you.set(ship.x, ship.y, ship.z);
        const [fx, fz] = forward(ship.heading);
        yourVel.set(fx * ship.speed, ship.vy || 0, fz * ship.speed);
      }
      for (const pack of [...packs]) {
        // what they were after has gone (the freighter got away): you'll do
        if (pack.prey && !pack.prey.parent) pack.prey = null;
        if (pack.gone) pack.fade += dt;
        const alive = pack.members.filter((h) => h.alive);
        if (!alive.length) {
          if (!pack.gone) events.push({ type: 'cleared', faction: pack.faction, rescued: pack.wasPrey });
          packs.splice(packs.indexOf(pack), 1);
          continue;
        }
        if (!pack.said && ship) {
          pack.said = true;
          events.push({ type: 'hunted', faction: pack.faction, kinds: pack.kinds, prey: pack.wasPrey });
        }
        // too far away for long enough: they give up
        const near = ship ? Math.min(...alive.map((h) => h.pos.distanceTo(you))) : Infinity;
        pack.lost = near > LOSE.far ? pack.lost + dt : 0;
        if ((pack.lost > LOSE.after || !ship || (pack.prey === null && pack.wasPrey && !pack.angry)) && !pack.gone) {
          pack.gone = true;
          pack.fade = 0;
          if (ship && !pack.wasPrey) events.push({ type: 'escaped', faction: pack.faction });
        }
      }

      for (const h of [...live]) {
        const { type, pos, vel } = h;
        const gone = h.pack.gone;
        const prey = !gone && h.pack.prey && !h.pack.angry ? h.pack.prey.position : null;
        const center = prey ?? (ship && !gone ? you : null);
        if (center) {
          // the way the target is heading (yours, or along the prey's nose)
          if (prey) look.set(0, 0, 1).applyQuaternion(h.pack.prey.quaternion);
          else look.set(-Math.sin(ship.heading), 0, -Math.cos(ship.heading));
          const toward = aim.copy(center).sub(pos);
          const gap = toward.length();
          if (h.mode === 'set') {
            // out ahead of the target and off to one side, a little above or below
            want.copy(center).addScaledVector(look, h.out).add(tmp.set(-look.z * h.side * h.wide, h.high, look.x * h.side * h.wide));
            if (want.distanceTo(pos) < 3.5) h.mode = 'run';
          } else {
            // at the target, head on (aiming a little ahead of it)
            want.copy(center).addScaledVector(look, Math.min(4, gap * 0.25));
            // past it, or about to hit it: swing out again, the other side
            if (gap < 1.6 || (gap < 9 && vel.dot(toward) < 0)) {
              h.mode = 'set';
              h.side = -h.side;
              h.out = 10 + rand() * 6;
              h.wide = 3 + rand() * 5;
              h.high = (rand() - 0.5) * 3;
            }
          }
          want.sub(pos);
          const dist = want.length();
          want.multiplyScalar(dist > 1e-4 ? type.speed / dist : 0);
        } else {
          // leaving: on the way it's going, faster, climbing away
          want.copy(vel).setLength(type.speed * 1.2);
          want.y += 3;
        }
        // steer toward the velocity it wants
        aim.copy(want).sub(vel);
        const steer = type.accel * dt;
        if (aim.lengthSq() > steer * steer) aim.setLength(steer);
        const before = tmp.copy(vel);
        vel.add(aim);
        pos.addScaledVector(vel, dt);
        // bank into the turn
        const turn = before.x * vel.z - before.z * vel.x;
        h.bank += (THREE.MathUtils.clamp(turn * 0.04, -1, 1) - h.bank) * Math.min(1, dt * 4);
        h.grow = Math.min(1, h.grow + dt * 2.2);
        const g = h.model.group;
        g.position.copy(pos);
        if (vel.lengthSq() > 1e-6) g.lookAt(look.copy(pos).add(vel));
        g.rotateZ(-h.bank);
        g.scale.setScalar(type.size * h.model.fit * Math.max(0.001, h.grow) * (gone ? Math.max(0.001, 1 - h.pack.fade / 2.5) : 1));
        h.model.update(t);
        if (gone) {
          if (h.pack.fade > 2.5 || !ship) {
            h.alive = false;
            give(h.kind, h.model);
            live.splice(live.indexOf(h), 1);
          }
          continue;
        }
        // firing: when the target is in its sights and in range
        h.cool -= dt;
        const target = prey ?? (ship ? you : null);
        if (target && h.cool <= 0) {
          aim.copy(target).sub(pos);
          const d = aim.length();
          const fwd = look.copy(vel).normalize();
          if (d < 16 && d > 0.6 && fwd.dot(aim.divideScalar(d)) > 0.93) {
            h.cool = between(rand, type.fire[0], type.fire[1]);
            // leading the target a little, and not quite true
            const lead = prey ? 0 : d / LASER.speed;
            aim.copy(target).addScaledVector(prey ? tmp.set(0, 0, 0) : yourVel, lead * 0.7).sub(pos).normalize();
            aim.x += (rand() - 0.5) * 0.09;
            aim.y += (rand() - 0.5) * 0.07;
            aim.z += (rand() - 0.5) * 0.09;
            aim.normalize();
            const m = lasers.find((l) => !l.visible) ?? lasers[0];
            m.material = laserMats[h.pack.faction];
            m.position.copy(pos).addScaledVector(aim, type.size * 0.6);
            m.lookAt(look.copy(m.position).add(aim));
            m.userData.v.copy(aim).multiplyScalar(LASER.speed + vel.length() * 0.5);
            m.userData.life = LASER.life;
            m.userData.at = prey ? 'prey' : 'you';
            m.visible = true;
          }
        }
      }

      // lasers: on their way, and into you (a laser covers more ground in a
      // frame than you are wide, so it's the stretch it crossed that counts)
      for (const m of lasers) {
        if (!m.visible) continue;
        const u = m.userData;
        u.life -= dt;
        if (u.life <= 0) {
          m.visible = false;
          continue;
        }
        tmp.copy(m.position);
        m.position.addScaledVector(u.v, dt);
        if (ship && u.at === 'you') {
          // nearest point on the stretch to you
          aim.copy(m.position).sub(tmp);
          const len2 = aim.lengthSq() || 1;
          const k = THREE.MathUtils.clamp(want.copy(you).sub(tmp).dot(aim) / len2, 0, 1);
          if (tmp.addScaledVector(aim, k).distanceTo(you) < SHIP_R) {
            m.visible = false;
            events.push({ type: 'laser', damage: LASER.damage, from: m.position.clone() });
          }
        }
      }
      return events;
    },

    // a shot of yours from `from` to `to` this frame: the hunter it hit, if
    // any: { kind, at, size, down } (down: it's destroyed; otherwise it took
    // the hit and comes on)
    hit(from, to) {
      aim.copy(to).sub(from);
      const len2 = aim.lengthSq() || 1;
      for (const h of live) {
        if (!h.alive || h.pack.gone) continue;
        const k = THREE.MathUtils.clamp(tmp.copy(h.pos).sub(from).dot(aim) / len2, 0, 1);
        if (want.copy(from).addScaledVector(aim, k).distanceTo(h.pos) > h.type.size * 0.75 + 0.08) continue;
        h.hp -= 1;
        h.pack.angry = true; // pirates turn on you once you shoot at them
        if (h.hp > 0) return { kind: h.kind, at: h.pos.clone(), size: h.type.size, down: false };
        h.alive = false;
        give(h.kind, h.model);
        live.splice(live.indexOf(h), 1);
        return { kind: h.kind, at: h.pos.clone(), size: h.type.size, down: true };
      }
      return null;
    },

    // everyone gone at once (you were shot down, or changed ship)
    clear() {
      for (const h of live) give(h.kind, h.model);
      live.length = 0;
      packs.length = 0;
      for (const m of lasers) m.visible = false;
    },

    get count() {
      return live.length;
    },
    // a pack still after you (not leaving)
    get active() {
      return packs.some((p) => !p.gone && !p.prey && p.members.some((h) => h.alive)) || packs.some((p) => p.angry && !p.gone);
    },
    // for checking from a browser
    get packs() {
      return packs.map((p) => ({ faction: p.faction, gone: Boolean(p.gone), prey: Boolean(p.prey), alive: p.members.filter((h) => h.alive).map((h) => h.kind) }));
    },

    dispose() {
      this.clear();
      for (const list of Object.values(pool)) for (const m of list) m.dispose();
      laserGeo.dispose();
      for (const m of Object.values(laserMats)) m.dispose();
      for (const m of lasers) m.removeFromParent();
    },
  };
}
