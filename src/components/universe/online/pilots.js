// Everyone else flying the universe map, drawn: each pilot's ship (the one
// they picked, the same models as your own, in the paint job and with the
// parts they fitted in the hangar: outfit.js), moved smoothly between the
// poses that come in (protocol.js's sample), with their callsign over it
// (a DOM tag, like the planets' names, set as text only) and their shields
// under it once they've taken a hit; and their shots, as bolts. Your own
// bolts are tested against them here (hit), and the ones who aren't your
// allies are there for the guns to lock on to (targets). A pilot whose crew
// are out walking on a planet (peer.foot) has their ship sat on the ground
// where they came down, the way footScene.js parks yours (and out of the
// guns' way: there's no one in it).
//
// createPilots(parent, { T, colors }) → { update(dt, now, client, view),
//   hit(from, to), targets, count, at(id), dispose() }
// view: { project(x, y, z, out) (to the canvas: out.x, out.y in px and
// out.z, the depth), tags (the element the tags go in), locked (the pilot
// the guns are locked on, whose name the lock shows instead; footOn, the
// planet you're down on, if you are: the crews there have tags of their own) }

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { disposeTree } from '../../../lib/three/renderer';
import { SHIP_MODELS, buildShip } from '../shipModels';
import { paintById } from '../paint';
import { PARTS_SLOTS, STOCK, STOCK_LOADOUT, partById } from '../outfit';
import { SHIP } from '../ship';
import { sweptHit } from '../targeting';
import { PARKED } from '../foot';
import { POSITIONS } from '../layout';
import { byId } from '../universes';
import { STALE_MS, sample } from './protocol';
import { UNIVERSE } from './where';

const MODELS = { ...SHIP_MODELS, cruiser: '/games/meshy/saucer.glb' }; // (the cruiser the C-137 planet flies; your own is the page's, crew aboard)
const SIZE = 0.3; // across, for the guns and for hits
const HIT_R = 0.22; // how close a bolt must pass to hit
const BOLTS = 24;
const BOLT_LIFE = 1.1;
const TAG_FAR = 140; // map units: no tag past this

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// how far a ship's lowest point is below its middle, flying size (it sits
// that much off the ground, parked, scaled up by PARKED)
const box = new THREE.Box3();
const part = new THREE.Box3();
function underside(model) {
  const g = model.group;
  const keep = { p: g.position.clone(), q: g.quaternion.clone(), s: g.scale.clone(), r: model.pivot.rotation.clone() };
  g.position.set(0, 0, 0);
  g.quaternion.identity();
  g.scale.setScalar(1);
  model.pivot.rotation.set(0, 0, 0);
  g.updateMatrixWorld(true);
  box.makeEmpty();
  const shown = (o) => {
    for (let q = o; q && q !== g; q = q.parent) if (!q.visible) return false;
    return true;
  };
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry || !shown(o)) return; // (not the stand-in, once the model's in)
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  g.position.copy(keep.p);
  g.quaternion.copy(keep.q);
  g.scale.copy(keep.s);
  model.pivot.rotation.copy(keep.r);
  return box.isEmpty() ? 0.05 : -box.min.y;
}
const frame = new THREE.Matrix4();
const N = new THREE.Vector3();
const F = new THREE.Vector3();
const R = new THREE.Vector3();

export function createPilots(parent, { T = {}, colors = {} } = {}) {
  const ships = new Map(); // peer id → { kind, loadout, model, tag, at, vel, shown, ally }
  const cache = new Map(); // url → Promise<scene | null>
  let disposed = false;

  const modelFor = (url) => {
    if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then((g) => g.scene).catch(() => null));
    return cache.get(url);
  };

  // a ship's own parts go with it; the models it shares with the others stay
  const drop = (sh) => {
    sh.model.group.removeFromParent();
    sh.model.dispose();
    const shared = [];
    sh.model.group.traverse((o) => o.userData.shared && shared.push(o));
    for (const o of shared) o.removeFromParent();
    disposeTree(sh.model.group);
    sh.tag?.remove();
  };

  const build = (id, kind, tags) => {
    const model = buildShip(kind, T);
    model.group.visible = false;
    parent.add(model.group);
    const url = MODELS[kind];
    if (url) {
      modelFor(url).then((scene) => {
        const sh = ships.get(id);
        if (!scene || disposed || sh?.model !== model) return;
        const copy = scene.clone(true);
        copy.traverse((o) => (o.userData.shared = true));
        model.dress(copy, { clone: true }); // (its own materials, for its own paint)
        if (!model.mount(copy)) copy.removeFromParent();
        else sh.under = null; // (sits differently now: measured again)
      });
    }
    let tag = null;
    if (tags) {
      tag = document.createElement('span');
      tag.className = 'universe-tag';
      const name = document.createElement('b');
      const bar = document.createElement('i');
      tag.append(name, bar);
      tags.append(tag);
    }
    return { kind, loadout: STOCK_LOADOUT, model, tag, name: '', at: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), shown: false, parked: false, under: null, ally: false, tagOn: null };
  };

  // bolts from the others' guns: only drawn (a hit is the shooter's to call)
  const boltGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.28, 6).rotateX(Math.PI / 2);
  const boltMats = new Map(); // by colour: the ship's own, or its paint job's
  const matFor = (color) => {
    if (!boltMats.has(color)) boltMats.set(color, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    return boltMats.get(color);
  };
  const boltColor = (kind, paint) => paintById(paint).bolt ?? colors[kind] ?? '#ff4a3d';
  const bolts = Array.from({ length: BOLTS }, () => {
    const m = new THREE.Mesh(boltGeo, matFor(boltColor(null, STOCK)));
    m.visible = false;
    m.rotation.order = 'YXZ';
    m.userData = { life: 0, v: new THREE.Vector3() };
    parent.add(m);
    return m;
  });
  const fireBolt = (s) => {
    const b = bolts.find((m) => !m.visible) ?? bolts[0];
    b.material = matFor(boltColor(s.kind, s.paint));
    const k = partById('guns', s.guns)?.bolt ?? 1; // (a fusion cannon's are bigger)
    b.scale.set(k, k, 1 + (k - 1) * 0.4);
    b.position.set(...s.p);
    b.userData.v.set(...s.v);
    b.userData.life = BOLT_LIFE;
    const [vx, vy, vz] = s.v;
    b.rotation.set(Math.atan2(vy, Math.hypot(vx, vz)), Math.atan2(-vx, -vz), 0);
    b.visible = true;
  };

  const place = { x: 0, y: 0, z: 0 };
  let live = 0;

  return {
    // where everyone is now; their tags; their shots on their way
    update(dt, now, client, view) {
      let busy = false;
      live = 0;
      const peers = client?.peers ?? new Map();
      const away = (p) => p.where && p.where !== UNIVERSE; // (gone off into a world: no ship out here)
      for (const [id, sh] of ships) {
        const p = peers.get(id);
        if (!p || p.blocked || !p.kind || away(p)) {
          drop(sh);
          ships.delete(id);
        }
      }
      for (const p of peers.values()) {
        if (p.blocked || !p.kind || !p.name || away(p)) continue;
        let sh = ships.get(p.id);
        if (sh && sh.kind !== p.kind) {
          drop(sh);
          sh = null;
        }
        if (!sh) {
          sh = build(p.id, p.kind, view?.tags ?? null);
          ships.set(p.id, sh);
        }
        if (sh.loadout !== p.loadout) {
          // (what they fitted: a new loadout's a new object, so only then)
          const was = sh.loadout;
          sh.loadout = p.loadout;
          if (was.paint !== p.loadout.paint) sh.model.paint(paintById(p.loadout.paint));
          if (PARTS_SLOTS.some((slot) => was[slot] !== p.loadout[slot])) sh.model.outfit(p.loadout); // (in the paint it wears)
        }
        const s = sample(p.snaps, now);
        // down on a planet, their crew out: parked where they came down
        const down = p.foot && now - p.foot.at < STALE_MS && POSITIONS[p.foot.planet] ? p.foot : null;
        const on = Boolean(s && !s.hidden) && !down;
        const was = sh.shown;
        sh.shown = on;
        sh.ally = p.ally === 'ally';
        const g = sh.model.group;
        g.visible = on || Boolean(down);
        if (down && !sh.parked) sh.model.park?.(true);
        if (!down && sh.parked) sh.model.park?.(false);
        sh.parked = Boolean(down);
        if (down) {
          busy = true;
          sh.under ??= underside(sh.model);
          const k = PARKED[sh.kind] ?? 1;
          const [cx, cy, cz] = POSITIONS[down.planet];
          const lift = byId(down.planet).size + sh.under * k + 0.001;
          N.set(...down.ship.n);
          F.set(...down.ship.f);
          g.position.set(cx + N.x * lift, cy + N.y * lift, cz + N.z * lift);
          frame.makeBasis(R.crossVectors(F, N), N, F.negate());
          g.quaternion.setFromRotationMatrix(frame);
          g.scale.setScalar(k);
          sh.model.pivot.rotation.set(0, 0, 0);
          sh.model.setThrottle(0);
          sh.model.update(now / 1000);
        } else if (on) {
          live += 1;
          busy = true;
          g.scale.setScalar(1);
          g.position.set(s.x, s.y, s.z);
          g.rotation.set(s.pitch, s.heading, -s.bank, 'YXZ'); // (any way round: loops, rolls, upside down)
          sh.model.setThrottle(Math.min(1, Math.abs(s.speed) / SHIP.cruise) * (s.boost ? 1 : 0.7));
          sh.model.update(now / 1000);
          sh.model.drive(dt, { throttle: Math.min(1, Math.abs(s.speed) / SHIP.cruise), boost: s.boost });
          // where it was last frame too (just come into view, it hasn't come from anywhere)
          if (was) sh.prev.copy(sh.at);
          else sh.prev.set(s.x, s.y, s.z);
          sh.at.set(s.x, s.y, s.z);
          sh.vel.set(-Math.sin(s.heading) * Math.cos(s.pitch) * s.speed, s.vy, -Math.cos(s.heading) * Math.cos(s.pitch) * s.speed);
        }
        // the tag over them
        const tag = sh.tag;
        if (!tag) continue;
        // (parked, over the ship, unless you're down there with them: their crew have tags then)
        let show = (on && view.locked !== p.id) || (down && view.footOn !== down.planet);
        if (show) {
          if (down) view.project(g.position.x, g.position.y, g.position.z, place);
          else view.project(s.x, s.y + 0.16, s.z, place);
          show = place.z > 0.3 && place.z < TAG_FAR;
        }
        if (show !== sh.tagOn) {
          sh.tagOn = show;
          tag.toggleAttribute('data-on', show);
        }
        if (!show) continue;
        if (sh.name !== p.name) {
          sh.name = p.name;
          tag.firstChild.textContent = p.name;
        }
        tag.toggleAttribute('data-ally', sh.ally);
        tag.toggleAttribute('data-hurt', !down && s.shield < 99.5);
        tag.style.setProperty('--shield', ((down ? 100 : s.shield) / 100).toFixed(2));
        tag.style.transform = `translate3d(${place.x.toFixed(1)}px, ${place.y.toFixed(1)}px, 0)`;
      }
      // their shots
      for (const s of client?.takeShots() ?? []) fireBolt(s);
      for (const b of bolts) {
        if (!b.visible) continue;
        const d = b.userData;
        d.life -= dt;
        if (d.life <= 0) {
          b.visible = false;
          continue;
        }
        busy = true;
        b.position.addScaledVector(d.v, dt);
      }
      return busy;
    },

    // a bolt of yours from `from` to `to` this frame: the pilot it hit (not
    // an ally), if any: { id, at, size }. Tested against the whole way each
    // ship went in its last frame, as it was drawn (one crossing the bolt's
    // path between two frames is still hit), the nearest along the bolt first
    hit(from, to) {
      let hit = null;
      let first = Infinity;
      for (const [id, sh] of ships) {
        if (!sh.shown || sh.ally) continue;
        const k = sweptHit(from, to, sh.prev, sh.at, HIT_R);
        if (k !== null && k < first) {
          first = k;
          hit = { id, at: sh.at.clone(), size: SIZE };
        }
      }
      return hit;
    },

    // what the guns can lock on to: everyone in view who isn't an ally
    get targets() {
      const out = [];
      for (const [id, sh] of ships) if (sh.shown && !sh.ally) out.push({ id: `p:${id}`, peer: id, at: sh.at, vel: sh.vel, size: SIZE, kind: sh.kind, loadout: sh.loadout, name: sh.name });
      return out;
    },
    get count() {
      return live;
    },
    // where a pilot was last drawn (for the pop as they go down)
    at(id) {
      const sh = ships.get(id);
      return sh?.shown ? sh.at.clone() : null;
    },

    dispose() {
      disposed = true;
      for (const sh of ships.values()) drop(sh);
      ships.clear();
      for (const p of cache.values()) p.then((scene) => scene && disposeTree(scene));
      cache.clear();
      for (const b of bolts) b.removeFromParent();
      boltGeo.dispose();
      for (const m of boltMats.values()) m.dispose();
    },
  };
}
