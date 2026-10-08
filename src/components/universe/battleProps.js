// What a battle's plan lays out in the open, drawn (battleStages.js puts
// it in the battle; battleScene.js draws the rest): shield-projector
// satellites, orbital defence platforms, data beacons and uplinks, comms
// relays and jammers, gravity wells, a planet's ion cannon, a frigate's
// shield projector, the droid control relay, a boarded ship's engines; and
// a ring round each zone to hold, shown while it's the stage that's on, in
// the colour of whoever's to hold it, brighter the further it's got. All
// built in code from a few shared shapes (no assets to fetch), a handful of
// draws each, and each one's hidden once it's down.
//
// createProps(parent) → { show(objectives), update(dt, t, battle, youTeam),
//   hide(), dispose() }. Everything is in `parent`'s space (the map's).

import * as THREE from 'three';

const METAL = { color: '#7d828c', roughness: 0.55, metalness: 0.6 };
const DARK = { color: '#3c4048', roughness: 0.8, metalness: 0.3 };
const HOLD = new THREE.Color('#ffb347');
const KEEP = new THREE.Color('#7cc8ff');

export function createProps(parent) {
  const metal = new THREE.MeshStandardMaterial(METAL);
  const dark = new THREE.MeshStandardMaterial(DARK);
  const glow = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), toneMapped: false });
  const glows = { blue: glow([0.8, 1.6, 3.4]), red: glow([3.2, 0.7, 0.4]), amber: glow([3.2, 1.8, 0.5]), violet: glow([1.8, 0.8, 3.4]), green: glow([0.7, 3, 1.1]) };
  // the shapes, each a unit across, scaled to the objective
  const geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    panel: new THREE.BoxGeometry(1, 0.04, 0.6),
    ball: new THREE.SphereGeometry(0.5, 14, 10),
    dome: new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    hex: new THREE.CylinderGeometry(0.5, 0.5, 0.18, 6),
    rod: new THREE.CylinderGeometry(0.06, 0.06, 1, 6),
    can: new THREE.CylinderGeometry(0.22, 0.28, 0.6, 10),
    dish: new THREE.SphereGeometry(0.5, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3),
    ring: new THREE.TorusGeometry(1, 0.012, 6, 64),
  };
  const mesh = (g, m, [x = 0, y = 0, z = 0] = [], [sx = 1, sy = sx, sz = sx] = [], rot = null) => {
    const o = new THREE.Mesh(geo[g], m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    if (rot) o.rotation.set(...rot);
    return o;
  };
  // each kind, built a unit across (its group's scaled to the objective's size)
  const BUILD = {
    // a body, two panels out to its sides, the projector glowing under it
    satellite: () => [mesh('box', metal, [0, 0, 0], [0.5, 0.4, 0.5]), mesh('panel', dark, [-0.75, 0, 0]), mesh('panel', dark, [0.75, 0, 0]), mesh('ball', glows.blue, [0, -0.3, 0], [0.28])],
    // a six-sided deck, a tower on it, guns round its rim
    platform: () => [mesh('hex', metal, [0, 0, 0], [1, 1, 1]), mesh('can', dark, [0, 0.3, 0], [0.6]), mesh('ball', glows.red, [0, 0.55, 0], [0.12]), ...[0, 1, 2].map((i) => mesh('box', dark, [Math.cos((i * Math.PI * 2) / 3) * 0.38, 0.12, Math.sin((i * Math.PI * 2) / 3) * 0.38], [0.12, 0.1, 0.2]))],
    // a buoy with a light that blinks (update)
    beacon: () => [mesh('can', metal, [0, 0, 0], [0.8, 1, 0.8]), mesh('ball', glows.amber, [0, 0.42, 0], [0.3])],
    // a mast with two dishes and a light on top
    relay: () => [mesh('rod', metal, [0, 0, 0], [1, 1.6, 1]), mesh('dish', metal, [0.18, 0.35, 0], [0.5], [0, 0, -Math.PI / 2]), mesh('dish', metal, [-0.18, 0.05, 0], [0.4], [0, 0, Math.PI / 2]), mesh('ball', glows.red, [0, 0.82, 0], [0.12])],
    // a gravity well: a dome, lit from inside
    well: () => [mesh('dome', glows.violet, [0, 0, 0], [1, 0.7, 1], [Math.PI, 0, 0]), mesh('hex', dark, [0, 0.02, 0], [1.1, 0.4, 1.1])],
    // an ion cannon: a dome and its barrel to the sky
    cannon: () => [mesh('dome', metal, [0, 0, 0], [1, 0.8, 1]), mesh('can', dark, [0, 0.45, 0.1], [0.5, 1.2, 0.5], [-0.5, 0, 0]), mesh('ball', glows.blue, [0, 0.75, 0.35], [0.14])],
    // a shield projector on a frigate's back
    projector: () => [mesh('dome', metal, [0, 0, 0], [1, 0.6, 1]), mesh('ball', glows.blue, [0, 0.25, 0], [0.3])],
    // the droid control relay: a sphere bristling with antennae
    droidrelay: () => [mesh('ball', dark, [0, 0, 0], [0.7]), ...[0, 1, 2, 3, 4].map((i) => mesh('rod', metal, [Math.cos(i * 1.26) * 0.35, 0.35, Math.sin(i * 1.26) * 0.35], [1, 0.7, 1], [Math.sin(i * 1.26) * 0.6, 0, -Math.cos(i * 1.26) * 0.6])), mesh('ball', glows.green, [0, 0.45, 0], [0.16])],
    // a boarded ship's engines: their glow, picked out
    engines: () => [mesh('ball', glows.amber, [0, 0, 0], [0.6])],
  };
  const items = []; // { o, group, ring, mat, blink }

  const add = (o) => {
    if (o.zone) {
      // a ring round it each way, the zone's size
      const mat = new THREE.MeshBasicMaterial({ color: HOLD.clone(), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const ring = new THREE.Group();
      ring.add(mesh('ring', mat, [0, 0, 0], [1], [Math.PI / 2, 0, 0]), mesh('ring', mat, [0, 0, 0], [1]));
      ring.scale.setScalar(o.zone);
      ring.userData.zone = o.key;
      ring.visible = false;
      parent.add(ring);
      items.push({ o, ring, mat });
    }
    const build = BUILD[o.kind];
    if (!o.free || !build) return;
    const group = new THREE.Group();
    group.add(...build());
    group.scale.setScalar(o.r * 2);
    group.userData.prop = o.key;
    parent.add(group);
    items.push({ o, group, blink: o.kind === 'beacon' ? group.children[1] : null });
  };

  return {
    show(objectives = []) {
      this.hide();
      for (const o of objectives) add(o);
    },
    // where each is now, whether it's still standing, and the zone of the stage that's on, ringed
    update(dt, t, battle, youTeam = null) {
      for (const it of items) {
        const { o } = it;
        if (it.group) {
          it.group.visible = o.alive;
          it.group.position.set(o.pos.x, o.pos.y, o.pos.z);
          if (it.blink) it.blink.visible = Math.sin(t * 5) > -0.2;
        }
        if (it.ring) {
          const on = o.alive && (battle.isOpen ? battle.isOpen(o) : o.phase === battle.phase);
          it.ring.visible = on;
          if (!on) continue;
          it.ring.position.set(o.pos.x, o.pos.y, o.pos.z);
          it.ring.rotation.y = t * 0.2;
          // (the holders' colour, brighter the more of it's held)
          it.mat.color.copy(youTeam === null || youTeam === battle.attacker ? HOLD : KEEP);
          it.mat.opacity = 0.35 + 0.5 * (1 - o.hp / o.hpMax) + 0.1 * Math.sin(t * 3);
        }
      }
    },
    hide() {
      for (const it of items) {
        it.group?.removeFromParent();
        it.ring?.removeFromParent();
        it.mat?.dispose();
      }
      items.length = 0;
    },
    dispose() {
      this.hide();
      for (const g of Object.values(geo)) g.dispose();
      for (const m of [metal, dark, ...Object.values(glows)]) m.dispose();
    },
  };
}
