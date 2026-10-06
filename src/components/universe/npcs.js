// The named characters, drawn: each one's ship from the fleet (the same
// built models and loaded ones the traffic and the hunters fly), turned the
// way it's going and banked into its turns, and its shots as short bright
// tracers from it to whatever it fired at. What each does is npcRules.js's
// (plain rules, tested); who they are is npcs/index.js's. The scene voices
// their events and puts their hits where they land.
//
// createNpcs(parent, { fleet, rand }) → { add(npc, at) → id | null,
//   update(dt, t, world) → events (npcRules.js's), hit(from, to, damage) →
//   { id, kind, at (a Vector3), size, down } | null, targets, live, count,
//   clear(), dispose() }
// Everything is in `parent`'s space (the map's).

import * as THREE from 'three';
import { createFleet } from './glbFleet';
import { createBrains } from './npcRules';
import { sweptHit } from './targeting';

const TRACER = { speed: 60, length: 0.4 }; // map units a second; how long one's drawn

export function createNpcs(parent, { fleet = createFleet(), rand = Math.random } = {}) {
  const brains = createBrains({ rand });
  const views = new Map(); // id → { model, prev, bank }
  const look = new THREE.Vector3();
  const tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, TRACER.length, 5).rotateX(Math.PI / 2);
  const mats = new Map(); // colour → material
  const matFor = (rgb) => {
    const key = rgb.join(',');
    if (!mats.has(key)) mats.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    return mats.get(key);
  };
  const tracers = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(tracerGeo, matFor([5, 5, 5]));
    m.visible = false;
    m.frustumCulled = false;
    m.userData = { from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, len: 1 };
    parent.add(m);
    return m;
  });
  const drop = (id) => {
    const v = views.get(id);
    if (!v) return;
    v.model.group.removeFromParent();
    v.model.dispose();
    views.delete(id);
  };

  return {
    // a character comes in at `at` ({ x, y, z }); its number, or null
    add(npc, at) {
      const id = brains.add(npc, at);
      if (id === null) return null;
      fleet.want([npc.ship]);
      // (a delegated one, a wingman or a bounty hunter, is the wing's or the hunt's to draw)
      if (npc.brain !== 'wingman' && npc.brain !== 'bounty') {
        const model = fleet.make(npc.ship);
        model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1);
        parent.add(model.group);
        views.set(id, { model, prev: { ...at }, bank: 0, npc });
      }
      return id;
    },

    update(dt, t, world) {
      for (const me of brains.live) {
        const v = views.get(me.n);
        if (v) {
          v.prev.x = me.pos.x;
          v.prev.y = me.pos.y;
          v.prev.z = me.pos.z;
        }
      }
      const { events } = brains.update(dt, world);
      parent.updateWorldMatrix(true, false);
      const alive = new Set(brains.live.map((m) => m.n));
      for (const id of [...views.keys()]) if (!alive.has(id)) drop(id);
      for (const me of brains.live) {
        const v = views.get(me.n);
        if (!v) continue;
        const g = v.model.group;
        g.position.set(me.pos.x, me.pos.y, me.pos.z);
        const { x, y, z } = me.vel;
        if (x * x + y * y + z * z > 0.04) {
          // (banked into the turn: how fast the way it's going swings round)
          const yaw = Math.atan2(x, z);
          const turn = v.yaw === undefined ? 0 : Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw)) / Math.max(dt, 1e-3);
          v.yaw = yaw;
          v.bank += (Math.max(-1, Math.min(1, turn * 0.4)) - v.bank) * Math.min(1, dt * 3);
          g.lookAt(parent.localToWorld(look.set(me.pos.x + x, me.pos.y + y, me.pos.z + z)));
          g.rotateZ(-v.bank);
        }
        g.scale.setScalar((v.npc.size ?? 0.4) * v.model.fit);
        v.model.update(t);
      }
      // the shots, as tracers flying from the shooter to what it fired at
      for (const e of events) {
        if (e.type !== 'shot') continue;
        const m = tracers.find((o) => !o.visible) ?? tracers[0];
        const npc = views.get(e.n)?.npc;
        m.material = matFor(npc?.bolt ?? [5, 5, 5]);
        m.userData.from.set(e.from.x, e.from.y, e.from.z);
        m.userData.to.set(e.to.x, e.to.y, e.to.z);
        // (one that misses goes on past, a little wide)
        if (!e.hit) m.userData.to.add(look.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(2.5));
        m.userData.len = Math.max(0.5, m.userData.from.distanceTo(m.userData.to));
        m.userData.t = 0;
        m.visible = true;
      }
      for (const m of tracers) {
        if (!m.visible) continue;
        const d = m.userData;
        d.t += (dt * TRACER.speed) / d.len;
        if (d.t >= 1) {
          m.visible = false;
          continue;
        }
        m.position.lerpVectors(d.from, d.to, d.t);
        m.lookAt(parent.localToWorld(look.copy(d.to)));
      }
      return events;
    },

    // a shot of yours from `from` to `to` this frame: the one it hit, if any
    // (an enemy's only: the guns don't shoot friends on purpose)
    hit(from, to, damage = 1) {
      let best = null;
      let first = Infinity;
      for (const c of brains.targets) {
        const v = views.get(c.id);
        if (!v) continue;
        const k = sweptHit(from, to, v.prev, c.at, c.size * 0.9 + 0.12);
        if (k !== null && k < first) {
          first = k;
          best = c;
        }
      }
      if (!best) return null;
      const r = brains.hit(best.id, damage);
      return r && { ...r, at: new THREE.Vector3(r.at.x, r.at.y, r.at.z) };
    },
    remove: (id) => {
      brains.remove(id);
      drop(id);
    },

    get targets() {
      return brains.targets;
    },
    get live() {
      return brains.live;
    },
    get count() {
      return brains.live.length;
    },
    clear() {
      for (const me of [...brains.live]) brains.remove(me.n);
      for (const id of [...views.keys()]) drop(id);
      for (const m of tracers) m.visible = false;
    },
    dispose() {
      this.clear();
      for (const m of tracers) m.removeFromParent();
      tracerGeo.dispose();
      for (const m of mats.values()) m.dispose();
    },
  };
}
