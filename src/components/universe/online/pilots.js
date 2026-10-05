// Everyone else flying the universe map, drawn: each pilot's ship (the one
// they picked, the same models as your own), moved smoothly between the
// poses that come in (protocol.js's sample), with their callsign over it
// (a DOM tag, like the planets' names, set as text only) and their shields
// under it once they've taken a hit; and their shots, as bolts. Your own
// bolts are tested against them here (hit), and the ones who aren't your
// allies are there for the guns to lock on to (targets).
//
// createPilots(parent, { T, colors }) → { update(dt, now, client, view),
//   hit(from, to), targets, count, at(id), dispose() }
// view: { project(x, y, z, out) (to the canvas: out.x, out.y in px and
// out.z, the depth), tags (the element the tags go in), locked (the pilot
// the guns are locked on, whose name the lock shows instead) }

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { disposeTree } from '../../../lib/three/renderer';
import { SHIP_MODELS, buildShip } from '../shipModels';
import { SHIP } from '../ship';
import { sweptHit } from '../targeting';
import { sample } from './protocol';
import { UNIVERSE } from './where';

const MODELS = { ...SHIP_MODELS, cruiser: '/games/meshy/saucer.glb' }; // (the cruiser the C-137 planet flies; your own is the page's, crew aboard)
const SIZE = 0.3; // across, for the guns and for hits
const HIT_R = 0.22; // how close a bolt must pass to hit
const BOLTS = 24;
const BOLT_LIFE = 1.1;
const TAG_FAR = 140; // map units: no tag past this

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export function createPilots(parent, { T = {}, colors = {} } = {}) {
  const ships = new Map(); // peer id → { kind, model, tag, at, vel, shown, ally }
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
        if (!model.mount(copy)) copy.removeFromParent();
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
    return { kind, model, tag, name: '', at: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), shown: false, ally: false, tagOn: null };
  };

  // bolts from the others' guns: only drawn (a hit is the shooter's to call)
  const boltGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.28, 6).rotateX(Math.PI / 2);
  const boltMats = new Map();
  const matFor = (kind) => {
    if (!boltMats.has(kind)) boltMats.set(kind, new THREE.MeshBasicMaterial({ color: new THREE.Color(colors[kind] ?? '#ff4a3d').multiplyScalar(4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    return boltMats.get(kind);
  };
  const bolts = Array.from({ length: BOLTS }, () => {
    const m = new THREE.Mesh(boltGeo, matFor(null));
    m.visible = false;
    m.rotation.order = 'YXZ';
    m.userData = { life: 0, v: new THREE.Vector3() };
    parent.add(m);
    return m;
  });
  const fireBolt = (s) => {
    const b = bolts.find((m) => !m.visible) ?? bolts[0];
    b.material = matFor(s.kind);
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
        const s = sample(p.snaps, now);
        const on = Boolean(s && !s.hidden);
        const was = sh.shown;
        sh.shown = on;
        sh.ally = p.ally === 'ally';
        const g = sh.model.group;
        g.visible = on;
        if (on) {
          live += 1;
          busy = true;
          g.position.set(s.x, s.y, s.z);
          g.rotation.set(s.pitch, s.heading, -s.bank, 'YXZ'); // (any way round: loops, rolls, upside down)
          sh.model.setThrottle(Math.min(1, Math.abs(s.speed) / SHIP.cruise) * (s.boost ? 1 : 0.7));
          sh.model.update(now / 1000);
          // where it was last frame too (just come into view, it hasn't come from anywhere)
          if (was) sh.prev.copy(sh.at);
          else sh.prev.set(s.x, s.y, s.z);
          sh.at.set(s.x, s.y, s.z);
          sh.vel.set(-Math.sin(s.heading) * Math.cos(s.pitch) * s.speed, s.vy, -Math.cos(s.heading) * Math.cos(s.pitch) * s.speed);
        }
        // the tag over them
        const tag = sh.tag;
        if (!tag) continue;
        let show = on && view.locked !== p.id;
        if (show) {
          view.project(s.x, s.y + 0.16, s.z, place);
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
        tag.toggleAttribute('data-hurt', s.shield < 99.5);
        tag.style.setProperty('--shield', (s.shield / 100).toFixed(2));
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
      for (const [id, sh] of ships) if (sh.shown && !sh.ally) out.push({ id: `p:${id}`, peer: id, at: sh.at, vel: sh.vel, size: SIZE, kind: sh.kind, name: sh.name });
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
