// A battle at the front, drawn (battle.js fights it; front.js says when it's
// near). The capital ships and the fighters are galaxy/models.js's slots:
// the Sketchfab models where they've come, their built stand-ins till then,
// and each its LOD past a few dozen of its own lengths (so sixty-odd
// fighters cost about a draw each). The rest is battleFx.js's: the bolts,
// the engine glows, the defender's shield, the markers over the objectives
// and the fires where they've gone. The explosions are the galaxy's
// flashes (galaxy/fx.js).
//
// When the defender's flagship goes, a chain of explosions runs down it,
// and then it breaks in two: two copies of its model, each cut by a
// clipping plane through its middle (the renderer's localClippingEnabled),
// drifting apart and rolling away from each other, burning along the break.
//
// createBattleScene(parent, { models, small, reduced, metres }) → { show(battle,
//   war), hide(), update(dt, t, camera, camLocal, events, youTeam) → busy,
//   halves, dispose() }
// Everything is in `parent`'s space (the map's).

import * as THREE from 'three';
import { createFlashes } from '../galaxy/fx';
import { createBoltDraw, createFires, createGlows, createMarkers, createShield } from './battleFx';

const NAMES = { shieldgen: 'Shield generator', bridge: 'Bridge', reactor: 'Reactor' };
const METRES = 40; // a map unit, in metres (an X-wing's about a third of a unit; the galaxy's is 53)
const far = (a, b, metres = METRES) => {
  const m = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * metres;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`;
};
const ATTACK = '#ffb347';
const DEFEND = '#7cc8ff';

export function createBattleScene(parent, { models, small = false, reduced = false, metres = METRES } = {}) {
  const flashes = createFlashes(parent, { count: small ? 40 : 96 });
  const bolts = createBoltDraw(parent, { count: 320 });
  const glows = createGlows(parent, { count: 96 });
  const shield = createShield(parent);
  const markers = createMarkers(parent);
  const fires = createFires(parent);
  const slots = new Map(); // a ship (battle.js's fighter or capital) → its slot
  const halves = []; // the broken flagship's two halves
  let battle = null;
  let war = null;
  let chain = 0; // seconds to the next explosion down a dying ship
  const basis = new THREE.Matrix4();
  const vx = new THREE.Vector3();
  const vy = new THREE.Vector3();
  const vz = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const pt = new THREE.Vector3();

  // a slot turned to fly along `fwd`, its top toward `up`, banked by `bank`
  const orient = (holder, fwd, up, bank = 0) => {
    vz.set(fwd.x, fwd.y, fwd.z).normalize();
    vx.crossVectors(vy.set(up.x, up.y, up.z), vz);
    if (vx.lengthSq() < 1e-8) vx.set(1, 0, 0);
    vx.normalize();
    vy.crossVectors(vz, vx);
    if (bank) {
      // rolled about the nose (into the turn)
      const c = Math.cos(bank);
      const s = Math.sin(bank);
      tmp.copy(vx).multiplyScalar(c).addScaledVector(vy, s);
      vy.multiplyScalar(c).addScaledVector(vx, -s);
      vx.copy(tmp);
    }
    basis.makeBasis(vx, vy, vz);
    holder.quaternion.setFromRotationMatrix(basis);
  };

  const slotFor = (ship, kind, size) => {
    let s = slots.get(ship);
    if (!s) {
      s = models.slot(kind, size);
      parent.add(s.holder);
      slots.set(ship, s);
    }
    return s;
  };

  const colourOf = (b) => {
    const side = war.sides[b.team];
    return b.kind === 'turbo' ? side.turbo : b.kind === 'flak' ? [side.laser[0] * 0.8 + 1.2, side.laser[1] * 0.6 + 0.8, side.laser[2] * 0.4 + 0.2] : side.laser;
  };

  // a random point on a capital's hull (one of its spheres' surfaces)
  const onHull = (cap, out) => {
    const sp = cap.spheres[Math.floor(Math.random() * cap.spheres.length)];
    tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    return out.set(sp.c.x + tmp.x * sp.r, sp.c.y + tmp.y * sp.r * 0.6, sp.c.z + tmp.z * sp.r);
  };

  // the flagship broken in two: its model copied twice, each cut by a plane
  // through the middle and drifting off its own way
  const breakUp = (cap, slot) => {
    const fwd = new THREE.Vector3(cap.fwd.x, cap.fwd.y, cap.fwd.z);
    for (const sign of [1, -1]) {
      const g = slot.holder.clone(true);
      const plane = new THREE.Plane();
      const owned = [];
      g.traverse((o) => {
        if (!o.isMesh) return;
        const swap = (m) => {
          const n = m.clone();
          n.clippingPlanes = [plane];
          n.side = THREE.DoubleSide; // (the inside shows through the cut)
          owned.push(n);
          return n;
        };
        o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      });
      parent.add(g);
      const axis = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      halves.push({ g, plane, sign, owned, vel: fwd.clone().multiplyScalar(0.5 * sign).add(new THREE.Vector3(0, -0.12 * sign, 0)), axis, spin: 0.035 * sign, cut: new THREE.Vector3(cap.pos.x, cap.pos.y, cap.pos.z), size: cap.size });
    }
    slot.holder.visible = false;
    // fire along the break
    for (let i = 0; i < 5; i++) fires.add({ x: cap.pos.x + (Math.random() - 0.5) * cap.size * 0.2, y: cap.pos.y + (Math.random() - 0.5) * cap.size * 0.05, z: cap.pos.z + (Math.random() - 0.5) * cap.size * 0.2 }, cap.size * 0.05);
    flashes.at(pt.set(cap.pos.x, cap.pos.y, cap.pos.z), { size: cap.size * 0.6, life: 2.6, color: [2.8, 1.4, 0.5], bright: 1.4 });
  };
  const moveHalves = (dt) => {
    for (const h of halves) {
      h.g.position.addScaledVector(h.vel, dt);
      h.g.rotateOnWorldAxis(h.axis, h.spin * dt);
      h.cut.addScaledVector(h.vel, dt);
      // the plane in the world, through the half's own cut, keeping its own side
      h.g.updateMatrixWorld(true);
      vz.set(0, 0, 1).transformDirection(h.g.matrixWorld).multiplyScalar(h.sign);
      parent.localToWorld(pt.copy(h.cut));
      h.plane.setFromNormalAndCoplanarPoint(vz, pt);
    }
  };

  const onEvent = (e) => {
    if (e.type === 'down') flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: 1.5, life: 0.9 });
    else if (e.type === 'arrive') flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: 0.9, life: 0.45, color: [0.7, 1.0, 2.2] });
    else if (e.type === 'impact') {
      flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: e.size * (e.shield ? 0.8 : 1.2), life: e.shield ? 0.5 : 0.8, color: e.shield ? [0.5, 1.2, 2.6] : [2.6, 1.3, 0.4] });
      if (e.shield) shield.hit(e.at);
    } else if (e.type === 'shield') shield.drop();
    else if (e.type === 'sub') {
      flashes.at(pt.set(e.at.x, e.at.y, e.at.z), { size: 6, life: 1.6, bright: 1.3 });
      fires.add(e.at, 1.2);
    } else if (e.type === 'capital') {
      const cap = battle.capitals.find((c) => c.id === e.id);
      const slot = cap && slots.get(cap);
      if (!cap || !slot) return;
      if (cap.role === 'flagship' && cap.team === battle.defender) breakUp(cap, slot);
      else {
        flashes.at(pt.set(cap.pos.x, cap.pos.y, cap.pos.z), { size: cap.size * 0.7, life: 2, bright: 1.3 });
        slot.holder.visible = false;
      }
    }
  };

  return {
    show(b, w) {
      this.hide();
      battle = b;
      war = w;
      models.want([...new Set([...b.capitals.map((c) => c.kind), ...b.fighters.map((f) => f.kind)])]);
      for (const cap of b.capitals) {
        const s = slotFor(cap, cap.kind, cap.size);
        s.holder.position.set(cap.pos.x, cap.pos.y, cap.pos.z);
        orient(s.holder, cap.fwd, cap.up);
      }
      for (const f of b.fighters) slotFor(f, f.kind, f.size);
      const flag = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
      if (flag && b.phase === 1) shield.show(flag, null);
    },

    hide() {
      for (const s of slots.values()) models.drop(s);
      slots.clear();
      for (const h of halves) {
        h.g.removeFromParent();
        for (const m of h.owned) m.dispose();
      }
      halves.length = 0;
      shield.hide();
      markers.hide();
      fires.clear();
      bolts.sync([], colourOf);
      glows.begin();
      glows.end();
      battle = null;
    },

    get halves() {
      return halves.length;
    },

    // events: what battle.update said this frame; youTeam: the side you fly
    // for (null: not joined yet)
    update(dt, t, camera, camLocal, events = [], youTeam = null) {
      if (!battle) return false;
      for (const e of events) onEvent(e);
      // the capital ships (riding a little at anchor), and a dying one's explosions
      chain -= dt;
      for (const cap of battle.capitals) {
        const s = slots.get(cap);
        if (!s || !s.holder.visible) continue;
        const bob = reduced ? 0 : Math.sin(t * 0.3 + cap.id) * 0.15;
        s.holder.position.set(cap.pos.x, cap.pos.y + bob, cap.pos.z);
        if (cap.dying > 0 && chain <= 0) flashes.at(onHull(cap, pt), { size: 1.5 + Math.random() * cap.size * 0.08, life: 0.9 + Math.random() * 0.6 });
      }
      if (chain <= 0) chain = 0.12;
      // the fighters, and their engines
      glows.begin();
      for (const f of battle.fighters) {
        const s = slots.get(f);
        if (!s) continue;
        s.holder.visible = f.alive;
        if (!f.alive) continue;
        s.holder.position.set(f.pos.x, f.pos.y, f.pos.z);
        orient(s.holder, f.fwd, { x: 0, y: 1, z: 0 }, f.bank);
        const c = war.sides[f.team].laser;
        glows.add({ x: f.pos.x - f.fwd.x * f.size * 0.55, y: f.pos.y - f.fwd.y * f.size * 0.55, z: f.pos.z - f.fwd.z * f.size * 0.55 }, [c[0] * 0.35 + 0.5, c[1] * 0.35 + 0.35, c[2] * 0.35 + 0.25], f.size * 0.4);
      }
      // (a glow's size in map units: the canvas's height over the view's height a unit off)
      const high = typeof window !== 'undefined' ? window.innerHeight : 800;
      glows.end(camera?.isPerspectiveCamera ? high / (2 * Math.tan((camera.fov * Math.PI) / 360)) : 600);
      bolts.sync(battle.bolts, colourOf, camLocal);
      flashes.update(dt, camera);
      shield.update(dt, t);
      fires.update(dt, t);
      moveHalves(dt);
      // the objectives of the phase, marked (to destroy, if you attack; to
      // hold, if you defend), and the attacker's flagship for a defender
      const list = [];
      if (youTeam !== null && !battle.over) {
        const flag = battle.capitals.find((c) => c.team === battle.defender && c.role === 'flagship');
        const attack = youTeam === battle.attacker;
        let n = 0;
        for (const sub of flag?.subs ?? []) {
          if (!sub.alive || sub.phase !== battle.phase) continue;
          // (the two generators sit close: the second's card hangs under its point, not over it)
          list.push({ key: sub.id, pos: sub.pos, title: `${attack ? 'Destroy' : 'Defend'}: ${NAMES[sub.kind]}`, sub: far(sub.pos, camLocal, metres), hp: sub.hp / sub.hpMax, colour: attack ? ATTACK : DEFEND, under: n++ % 2 === 1 });
        }
        if (!attack) {
          const theirs = battle.capitals.find((c) => c.team === battle.attacker && c.role === 'flagship' && c.alive);
          if (theirs) list.push({ key: 'their-flag', pos: { x: theirs.pos.x, y: theirs.pos.y + theirs.size * 0.15, z: theirs.pos.z }, title: 'Destroy: their flagship', sub: far(theirs.pos, camLocal, metres), hp: theirs.hull / theirs.hullMax, colour: ATTACK });
        }
      }
      markers.sync(list);
      models.update?.(t);
      return true;
    },

    dispose() {
      this.hide();
      flashes.dispose();
      bolts.dispose();
      glows.dispose();
      shield.dispose();
      markers.dispose();
      fires.dispose();
    },
  };
}
