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
// guns' way: there's no one in it). One just back from being shot down
// (safe, a few seconds) can't be hit or locked on to either, and says so on
// its tag; one whose shots have been landing on you counts as a threat, for
// the lock and the arrows at the edge of the screen.
//
// The hunters after each of them are here too (given a `fleet` to make them
// from and the `kinds` they are): drawn where their pilot says they are,
// flown on between tellings, there for your guns to lock on to and to hit.
// A hit is told to their pilot, whose they are (client.js's hunterHit); one
// that should have finished a hunter takes it off the sky at once, without
// waiting to hear (it's back if its pilot says otherwise).
//
// createPilots(parent, { T, colors, here, fleet, kinds }) → { update(dt, now, client, view),
//   hit(from, to, damage) → { id, at, size } (a pilot) or { id, hunter, kind,
//   at, size, down } (one of the hunters after pilot `id`), targets, count,
//   at(id), dispose() }
// view: { project(x, y, z, out) (to the canvas: out.x, out.y in px and
// out.z, the depth), tags (the element the tags go in), locked (the pilot
// the guns are locked on, whose name the lock shows instead; footOn, the
// planet you're down on, if you are: the crews there have tags of their own) }

import { writeBuild } from '../shipyard/build';
import * as THREE from 'three';
import { disposeTree } from '../../../lib/three/renderer';
import { SHIP_MODELS, buildShip } from '../shipModels';
import { paintById } from '../paint';
import { PARTS_SLOTS, STOCK, STOCK_LOADOUT, partById } from '../outfit';
import { SHIP } from '../ship';
import { sweptHit } from '../targeting';
import { hitRadius } from '../hunterRules';
import { PARKED } from '../foot';
import { WEAPONS, arsenalOf, fan } from '../weapons';
import { POSITIONS } from '../layout';
import { byId } from '../universes';
import { STALE_MS, sample } from './protocol';
import { UNIVERSE } from './where';
import { gltfLoader } from '../../../lib/three/gltf';

const MODELS = { ...SHIP_MODELS, cruiser: '/games/meshy/saucer.glb' }; // (the cruiser the C-137 planet flies; your own is the page's, crew aboard)
const SIZE = 0.3; // across, for the guns and for hits
const HIT_R = 0.22; // how close a bolt must pass to hit
const BOLTS = 24;
const BOLT_LIFE = 1.1;
const TAG_FAR = 140; // map units: no tag past this
const THREAT_MS = 8000; // a pilot whose shot hit you this lately is a threat
const PACK_STALE = 1500; // ms: hunters not heard of for this long are gone
const PACK_AHEAD = 0.4; // seconds, at most, a hunter's flown on from where it was last said to be
const GONE_MS = 2500; // a hunter your shot should have finished stays off the sky this long, unless its pilot says it's down

const loader = gltfLoader();

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

// `here` is the place they're drawn in: the universe map, unless it's one
// of the galaxy's systems (a function, read each frame: the galaxy's page
// stays up from one system to the next)
export function createPilots(parent, { T = {}, colors = {}, here = UNIVERSE, fleet = null, kinds = {} } = {}) {
  const place = typeof here === 'function' ? here : () => here;
  const ships = new Map(); // peer id → { kind, loadout, model, tag, at, vel, shown, ally }
  // the hunters after the others: `${peer id}:${hunter id}` → { owner, hunter,
  // kind, type, model, at, prev, vel, hp, hurt, hitAt, goneUntil, seen, target }
  const ghosts = new Map();
  const spare = {}; // kind → hunter models not in use
  let tick = 0; // which update this is (a hunter not told of in it has gone)
  let clock = 0; // `now`, as of the last update
  const aim = new THREE.Vector3();
  const takeModel = (kind) => {
    const drawn = kinds[kind]?.model ?? kind; // (drawn as another kind, as hunters.js's are)
    // a built stand-in waiting here gives way once the model is in (as hunters.js's do)
    if (fleet.loaded(drawn) && spare[kind]?.length && !spare[kind][spare[kind].length - 1].model) for (const m of spare[kind].splice(0)) m.dispose();
    const model = spare[kind]?.pop() ?? fleet.make(drawn);
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1);
    parent.add(model.group);
    return model;
  };
  const dropGhost = (key, g) => {
    g.model.group.removeFromParent();
    (spare[g.kind] ??= []).push(g.model);
    ghosts.delete(key);
  };
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

  // (hull: their garage build, or null for their stock ship)
  const hullKey = (b) => (b ? writeBuild(b).join() : '');
  const build = (id, kind, tags, hull = null) => {
    const model = buildShip(kind, T, { build: hull });
    model.group.visible = false;
    parent.add(model.group);
    const url = hull ? null : MODELS[kind]; // (a garage build is whole as it is)
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
    return { kind, hull: hullKey(hull), loadout: STOCK_LOADOUT, model, tag, name: '', at: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), shown: false, parked: false, under: null, ally: false, safe: false, threat: 0, tagOn: null, tagName: null };
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
  // their shot as it came in, as it is: a blaster bolt, a spread's fan of
  // five, or a heavy round (big, slow, glowing in its ship's colour)
  const one = (s, v, k, life, color) => {
    const b = bolts.find((m) => !m.visible) ?? bolts[0];
    b.material = matFor(color);
    b.scale.set(k, k, 1 + (k - 1) * 0.4);
    b.position.set(...s.p);
    b.userData.v.set(...v);
    b.userData.life = life;
    const [vx, vy, vz] = v;
    b.rotation.set(Math.atan2(vy, Math.hypot(vx, vz)), Math.atan2(-vx, -vz), 0);
    b.visible = true;
  };
  const fireBolt = (s) => {
    const k = partById('guns', s.guns)?.bolt ?? 1; // (a fusion cannon's are bigger)
    const color = boltColor(s.kind, s.paint);
    if (s.w === WEAPONS.heavy.code) {
      one(s, s.v, 4, BOLT_LIFE * WEAPONS.heavy.life, arsenalOf(s.kind).heavy);
      return;
    }
    if (s.w === WEAPONS.spread.code) {
      const speed = Math.hypot(...s.v) || 1;
      for (const d of fan(s.v.map((x) => x / speed), WEAPONS.spread.count, WEAPONS.spread.cone)) one(s, [d[0] * speed, d[1] * speed, d[2] * speed], k * WEAPONS.spread.scale, BOLT_LIFE * WEAPONS.spread.life, color);
      return;
    }
    one(s, s.v, k, BOLT_LIFE, color);
  };

  const spot = { x: 0, y: 0, z: 0 };
  let live = 0;

  return {
    // where everyone is now; their tags; their shots on their way
    update(dt, now, client, view) {
      let busy = false;
      live = 0;
      tick += 1;
      clock = now;
      const peers = client?.peers ?? new Map();
      const at = place();
      const away = (p) => (p.where ?? UNIVERSE) !== at; // (somewhere else: gone off into a world, or another system)
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
        if (sh && (sh.kind !== p.kind || sh.hull !== hullKey(p.build))) {
          drop(sh);
          sh = null;
        }
        if (!sh) {
          sh = build(p.id, p.kind, view?.tags ?? null, p.build ?? null);
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
        sh.name = p.name; // (for the lock's bracket, whether or not their tag's showing)
        sh.ally = p.ally === 'ally';
        sh.safe = on && Boolean(s.safe);
        sh.threat = on && !sh.ally && now - p.hitAt < THREAT_MS ? 1 : 0;
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
          if (down) view.project(g.position.x, g.position.y, g.position.z, spot);
          else view.project(s.x, s.y + 0.16, s.z, spot);
          show = spot.z > 0.3 && spot.z < TAG_FAR;
        }
        if (show !== sh.tagOn) {
          sh.tagOn = show;
          tag.toggleAttribute('data-on', show);
        }
        if (!show) continue;
        if (sh.tagName !== p.name) {
          sh.tagName = p.name;
          tag.firstChild.textContent = p.name;
        }
        tag.toggleAttribute('data-ally', sh.ally);
        tag.toggleAttribute('data-safe', sh.safe);
        tag.toggleAttribute('data-hurt', !down && s.shield < 99.5);
        tag.style.setProperty('--shield', ((down ? 100 : s.shield) / 100).toFixed(2));
        tag.style.transform = `translate3d(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px, 0)`;
      }
      // the hunters after them: where each pilot last said, flown on from there
      if (fleet) {
        for (const p of peers.values()) {
          const pack = p.hunters;
          if (!pack || p.blocked || !p.kind || !p.name || away(p) || now - pack.at > PACK_STALE) continue;
          const ahead = Math.min(PACK_AHEAD, (now - pack.at) / 1000);
          for (const e of pack.list) {
            const type = kinds[e.kind];
            if (!type) continue; // (not one this place has)
            const key = `${p.id}:${e.id}`;
            let g = ghosts.get(key);
            aim.set(e.x + e.vx * ahead, e.y + e.vy * ahead, e.z + e.vz * ahead);
            if (!g) {
              g = { owner: p.id, hunter: e.id, kind: e.kind, type, model: takeModel(e.kind), at: aim.clone(), prev: aim.clone(), vel: new THREE.Vector3(), hp: e.hp, told: e.hp, hurt: 0, hitAt: -Infinity, goneUntil: -Infinity, seen: tick, target: null };
              g.target = { id: `h:${key}`, owner: p.id, hunter: e.id, at: g.at, vel: g.vel, size: type.size, kind: e.kind, hp: e.hp, hpMax: Math.max(type.hp, e.hp), threat: 0 };
              ghosts.set(key, g);
            } else {
              // on along its way, and eased onto where it's said to be
              g.prev.copy(g.at);
              g.at.addScaledVector(g.vel, dt).lerp(aim, 1 - Math.exp(-dt * 8));
            }
            g.seen = tick;
            g.vel.set(e.vx, e.vy, e.vz);
            // (a hit of yours its pilot has taken off it is no longer owed)
            if (e.hp < g.told) g.hurt = Math.max(0, g.hurt - (g.told - e.hp));
            g.told = e.hp;
            if (now - g.hitAt > 1200) g.hurt = 0;
            g.hp = Math.max(0, e.hp - g.hurt);
            g.target.hp = g.hp;
            const mg = g.model.group;
            mg.visible = now >= g.goneUntil;
            if (!mg.visible) continue;
            busy = true;
            mg.position.copy(g.at);
            if (g.vel.lengthSq() > 1e-6) {
              parent.updateWorldMatrix(true, false); // (lookAt is in the world, and the map turns: the map's point is carried into it)
              mg.lookAt(parent.localToWorld(aim.copy(g.at).add(g.vel)));
            }
            mg.scale.setScalar(type.size * g.model.fit);
            g.model.update(now / 1000);
          }
        }
        for (const [key, g] of ghosts) if (g.seen !== tick) dropGhost(key, g);
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

    // a bolt of yours from `from` to `to` this frame, worth `damage` on a
    // hunter: the pilot it hit (not an ally, nor one just back), if any: {
    // id, at, size }; or the hunter after one of them: { id (its pilot),
    // hunter, kind, at, size, down (that should have finished it) }. Tested
    // against the whole way each went in its last frame, as it was drawn (one
    // crossing the bolt's path between two frames is still hit), the nearest
    // along the bolt first
    hit(from, to, damage = 1) {
      let hit = null;
      let ghost = null;
      let first = Infinity;
      for (const [id, sh] of ships) {
        if (!sh.shown || sh.ally || sh.safe) continue;
        const k = sweptHit(from, to, sh.prev, sh.at, HIT_R);
        if (k !== null && k < first) {
          first = k;
          hit = { id, at: sh.at.clone(), size: SIZE };
        }
      }
      for (const g of ghosts.values()) {
        if (clock < g.goneUntil) continue;
        const k = sweptHit(from, to, g.prev, g.at, hitRadius(g.type));
        if (k !== null && k < first) {
          first = k;
          ghost = g;
        }
      }
      if (!ghost) return hit;
      ghost.hurt += damage;
      ghost.hitAt = clock;
      const down = ghost.told - ghost.hurt <= 0;
      if (down) {
        ghost.goneUntil = clock + GONE_MS;
        ghost.model.group.visible = false;
      }
      return { id: ghost.owner, hunter: ghost.hunter, kind: ghost.kind, at: ghost.at.clone(), size: ghost.type.size, down };
    },

    // what the guns can lock on to: everyone in view who isn't an ally (or
    // just back), and the hunters after any of them
    get targets() {
      const out = [];
      for (const [id, sh] of ships) if (sh.shown && !sh.ally && !sh.safe) out.push({ id: `p:${id}`, peer: id, at: sh.at, vel: sh.vel, size: SIZE, kind: sh.kind, loadout: sh.loadout, name: sh.name, threat: sh.threat });
      for (const g of ghosts.values()) if (clock >= g.goneUntil) out.push(g.target);
      return out;
    },
    // how many there are about: the pilots flying, and the hunters after them
    get count() {
      return live + ghosts.size;
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
      for (const [key, g] of ghosts) dropGhost(key, g);
      for (const list of Object.values(spare)) for (const m of list.splice(0)) m.dispose();
      for (const p of cache.values()) p.then((scene) => scene && disposeTree(scene));
      cache.clear();
      for (const b of bolts) b.removeFromParent();
      boltGeo.dispose();
      for (const m of boltMats.values()) m.dispose();
    },
  };
}
