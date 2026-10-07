// The people aboard the Death Star as figures: a model rigged by Meshy on
// the site’s shared 24-bone skeleton, walked on Rick’s idle, walk and run
// (borrowed: src/lib/three/clips.js), flinching, falling, kneeling and
// taunting on the troops’ combat clips (public/models/galaxy/troops/
// clip-*.glb, made on the clone’s rig) and firing, taking a shot and
// punching on the shared Meshy clips (public/games/meshy/clips-*.glb).
// Every clip is retargeted from its own rig’s hips to the figure’s, and
// all but the falls are turned to face the way the walk does (Meshy’s
// idle stands side-on, a fighter’s stance). The figure turns its chest
// and head to where it aims, and holds its gun in its right hand pointed
// that way. Models from other worlds are loaded by URL, never imported. A
// model that doesn’t load stands in as a plain capsule, so nobody vanishes.
//
//   PEOPLE                 kind → { url, tall }: the heroes and the stormtrooper
//   GUNS                   the guns a figure can hold: e11, dl44, dh17, a280
//   gait(speed) → { idle, walk, run, pace, runPace }   the clips’ weights (summing to one) and paces
//   playerKind({ side, hero, armour }) → kind   who the player is drawn as
//   loadPerson(kind, { tall, tint, renderer }) → Promise<person>
//     kind: a PEOPLE key, or a model’s path; tall: metres (the kind’s own otherwise); tint: a colour
//     multiplied into its materials
//     person: { object, kind, tall, play(name, { loop, fade }), setAim(yaw, pitch, raised), hold(gun),
//       update(dt, speed?), dispose() }
//     object: feet at its origin, facing −z, so object.rotation.y = −yaw faces yaw
//     play: hit, die, dieFwd, dieBlown, kneel, taunt, shoot, shot, punch over the walk (a fall holds
//       its last frame; anything else fades back); idle, walk, run or null back to the walk alone
//     setAim: the aim’s turn (+ to the right) and tilt (+ up) from where it faces; `raised` false
//       carries the gun low
//     update: speed in m/s picks the gait; without it, how far the object moved since the last update

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RICK_HIPS, borrowClips, faceForward, heading, retarget } from '../../../../lib/three/clips';
import { loadGltf } from '../../../../lib/three/gltf';
import { BODY } from '../rules/walker';

export const PEOPLE = {
  luke: { url: '/models/galaxy/crew/luke.glb', tall: 1.72 },
  han: { url: '/models/galaxy/crew/han.glb', tall: 1.85 },
  leia: { url: '/models/galaxy/crew/leia.glb', tall: 1.5 },
  obiwan: { url: '/models/galaxy/crew/obiwan.glb', tall: 1.82 },
  stormtrooper: { url: '/models/galaxy/troops/stormtrooper.glb', tall: 1.83, gloss: true },
};
const HEROES = ['luke', 'han', 'leia', 'obiwan'];

const WALKS = ['idle', 'walk', 'run'];
const TROOP_CLIPS = ['hit', 'die', 'dieFwd', 'dieBlown', 'kneel', 'taunt'];
const MESHY_CLIPS = ['shoot', 'shot', 'punch'];
const FALLS = new Set(['die', 'dieFwd', 'dieBlown']);

const AIM = { yaw: 1.1, pitch: 0.9, chase: 12 }; // how far the chest and head turn and tilt, and how fast they follow
const SPINE = ['Spine', 'Spine01', 'Spine02']; // each takes a share of the turn, the neck and head the rest
const SHARE = { spine: 0.18, neck: 0.16, head: 0.3 };
const LOW = 0.75; // how far down a gun carried low points
const JUMP = 3; // metres moved in one update that are a teleport, not a stride

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function gait(speed) {
  const s = Math.max(0, speed || 0);
  const moving = smooth(0.05, BODY.walk, s);
  const run = moving * smooth(BODY.walk, BODY.run, s);
  return {
    idle: 1 - moving,
    walk: moving - run,
    run,
    // the walk’s steps paced to the ground, so the feet don’t skate
    pace: clamp(s / BODY.walk, 0.6, 1.4),
    runPace: clamp(s / BODY.run, 0.7, 1.3),
  };
}

export function playerKind({ side, hero, armour = false } = {}) {
  if (side === 'imperial' || armour) return 'stormtrooper';
  return HEROES.includes(hero) ? hero : 'luke';
}

// ── the clips ──

// one fetch a clip for every figure (loadGltf caches the file), its rig’s
// hips height kept with it so a figure can be scaled from it
const extras = new Map();
function clipFrom(url) {
  if (!extras.has(url)) {
    extras.set(
      url,
      loadGltf(url, { prepare: false }).then((g) => {
        const clip = g?.animations?.[0] ?? null;
        const hips = g?.scene?.getObjectByName('Hips');
        if (clip && hips) clip.userData = { ...clip.userData, hips: hips.position.y };
        return clip;
      }),
    );
  }
  return extras.get(url);
}

async function allClips() {
  const names = [...TROOP_CLIPS, ...MESHY_CLIPS];
  const urls = [...TROOP_CLIPS.map((n) => `/models/galaxy/troops/clip-${n}.glb`), ...MESHY_CLIPS.map((n) => `/games/meshy/clips-${n}.glb`)];
  const [rick, got] = await Promise.all([borrowClips(WALKS), Promise.all(urls.map(clipFrom))]);
  return { ...rick, ...Object.fromEntries(names.map((n, i) => [n, got[i]])) };
}

// ── the guns ──

// Each gun in metres, its grip at the origin and its muzzle towards −z: the
// parts as [shape, size, place, finish], where a 'rod' runs along z.
const GUNS = {
  // the E-11: a short black carbine, its finned shroud, the scope on top, the magazine out to the left
  e11: [
    ['box', [0.05, 0.07, 0.3], [0, 0.04, -0.1], 'dark'],
    ['rod', [0.024, 0.24], [0, 0.045, -0.36], 'dark'],
    ['rod', [0.013, 0.15], [0, 0.095, -0.12], 'grey'],
    ['box', [0.03, 0.1, 0.045], [0, -0.03, 0], 'dark'],
    ['box', [0.14, 0.025, 0.03], [-0.08, 0.035, -0.12], 'grey'],
    ['box', [0.02, 0.02, 0.22], [0, 0.085, 0.06], 'grey'],
  ],
  // the DL-44: Han’s heavy pistol, its scope, the flash hider at the muzzle
  dl44: [
    ['box', [0.04, 0.06, 0.2], [0, 0.04, -0.06], 'dark'],
    ['rod', [0.017, 0.12], [0, 0.04, -0.21], 'dark'],
    ['rod', [0.024, 0.04], [0, 0.04, -0.28], 'grey'],
    ['rod', [0.011, 0.1], [0, 0.085, -0.06], 'grey'],
    ['box', [0.03, 0.1, 0.04], [0, -0.03, 0], 'dark'],
  ],
  // the DH-17: the Tantive’s troopers’ pistol, short and plain
  dh17: [
    ['box', [0.04, 0.06, 0.22], [0, 0.04, -0.07], 'dark'],
    ['rod', [0.016, 0.09], [0, 0.045, -0.22], 'grey'],
    ['box', [0.03, 0.1, 0.04], [0, -0.03, 0], 'dark'],
    ['box', [0.02, 0.07, 0.025], [0, -0.04, -0.1], 'grey'],
  ],
  // the A280: a long rifle with a stock to the shoulder
  a280: [
    ['box', [0.05, 0.075, 0.42], [0, 0.04, -0.14], 'dark'],
    ['rod', [0.02, 0.32], [0, 0.05, -0.5], 'grey'],
    ['box', [0.04, 0.09, 0.26], [0, 0.0, 0.18], 'dark'],
    ['box', [0.03, 0.1, 0.045], [0, -0.03, 0], 'dark'],
    ['rod', [0.013, 0.16], [0, 0.1, -0.16], 'grey'],
  ],
};
export const GUN_KINDS = Object.keys(GUNS);

function makeGun(kind, finish) {
  const spec = GUNS[kind];
  if (!spec) return null;
  const by = { dark: [], grey: [] };
  for (const [shape, size, [x, y, z], mat] of spec) {
    const g = shape === 'box' ? new THREE.BoxGeometry(...size) : new THREE.CylinderGeometry(size[0], size[0], size[1], 10).rotateX(Math.PI / 2);
    by[mat].push(g.translate(x, y, z));
  }
  const group = new THREE.Group();
  group.name = `gun-${kind}`;
  for (const [mat, geos] of Object.entries(by)) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    group.add(new THREE.Mesh(merged, finish[mat]));
  }
  return group;
}

// ── turning bones in the world ──

const _pq = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _v = new THREE.Vector3();
// turn a bone about an axis given in the world (its parent’s turn undone, the turn made, the parent’s put back)
function turnWorld(bone, axis, angle) {
  if (!bone?.parent || Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(_pq);
  _dq.setFromAxisAngle(axis, angle);
  const local = _pq.clone().invert().multiply(_dq).multiply(_pq);
  bone.quaternion.premultiply(local);
}

// ── a person ──

function finishes() {
  return {
    dark: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.45, metalness: 0.6 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x4d5258, roughness: 0.4, metalness: 0.7 }),
  };
}

// What every person does whatever its body: hold a gun, aim it, carry it,
// keep its own clock on how far it has gone.
function personOf({ object, kind, tall, hand, mixer, act, own, bones, owned }) {
  const finish = finishes();
  const aim = { yaw: 0, pitch: 0, wantYaw: 0, wantPitch: 0, raised: true };
  let gun = null;
  let gunKind = null;
  let over = null; // the clip played over the walk: { name, action, fade, hold }
  const fading = new Set();
  const last = new THREE.Vector3().copy(object.position);
  let measured = 0;
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  const _q = new THREE.Quaternion();

  mixer?.addEventListener('finished', (e) => {
    if (!over || e.action !== over.action || over.hold) return;
    over.action.fadeOut(over.fade);
    fading.add(over.action);
    over = null;
  });

  function overWeight() {
    let w = over ? over.action.getEffectiveWeight() : 0;
    for (const a of fading) {
      const k = a.getEffectiveWeight();
      if (k <= 0 || !a.isRunning()) fading.delete(a);
      else w += k;
    }
    return clamp(w, 0, 1);
  }

  function pose(dt) {
    const k = 1 - Math.exp(-dt * AIM.chase);
    aim.yaw += (aim.wantYaw - aim.yaw) * k;
    aim.pitch += (aim.wantPitch - aim.pitch) * k;
    if (!mixer || !bones.Hips) return;
    object.getWorldQuaternion(_q);
    right.set(1, 0, 0).applyQuaternion(_q).applyAxisAngle(up, -aim.yaw);
    for (const n of SPINE) {
      turnWorld(bones[n], up, -aim.yaw * SHARE.spine);
      turnWorld(bones[n], right, aim.pitch * SHARE.spine);
    }
    for (const [n, share] of [['neck', SHARE.neck], ['Head', SHARE.head]]) {
      turnWorld(bones[n], up, -aim.yaw * share);
      turnWorld(bones[n], right, aim.pitch * share);
    }
  }

  function carry() {
    if (!gun) return;
    if (hand) {
      object.worldToLocal(hand.getWorldPosition(_v));
      gun.position.copy(_v);
    } else gun.position.set(0.22, tall * 0.55, -0.15);
    gun.rotation.set(aim.raised ? aim.pitch : -LOW, -aim.yaw, 0, 'YXZ');
  }

  const person = {
    object,
    kind,
    tall,
    play(name, { loop = false, fade = 0.2 } = {}) {
      if (!mixer) return;
      if (name == null || WALKS.includes(name)) {
        if (over) {
          over.action.fadeOut(fade);
          fading.add(over.action);
          over = null;
        }
        return;
      }
      const clip = own[name];
      if (!clip) return;
      if (over?.name === name && loop && over.action.isRunning()) return;
      if (over) {
        over.action.fadeOut(fade);
        fading.add(over.action);
      }
      const action = mixer.clipAction(clip);
      fading.delete(action);
      action.reset();
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      // a one-off holds its last frame, so it can fade back to the walk (a fall stays down)
      action.clampWhenFinished = true;
      action.fadeIn(fade).play();
      over = { name, action, fade, hold: FALLS.has(name) };
    },
    setAim(yaw, pitch, raised = true) {
      aim.wantYaw = clamp(yaw || 0, -AIM.yaw, AIM.yaw);
      aim.wantPitch = clamp(pitch || 0, -AIM.pitch, AIM.pitch);
      aim.raised = raised;
    },
    hold(kind) {
      if (kind === gunKind) return;
      if (gun) {
        gun.removeFromParent();
        gun.traverse((o) => o.geometry?.dispose());
      }
      gunKind = kind ?? null;
      gun = kind ? makeGun(kind, finish) : null;
      if (gun) object.add(gun);
    },
    update(dt, speed) {
      let s = speed;
      if (s === undefined) {
        const moved = Math.hypot(object.position.x - last.x, object.position.z - last.z);
        if (dt > 0 && moved < JUMP) measured += (moved / dt - measured) * (1 - Math.exp(-dt * 10));
        s = measured;
      }
      last.copy(object.position);
      if (mixer) {
        const w = gait(s);
        const free = 1 - overWeight();
        act.idle?.setEffectiveWeight(w.idle * free);
        act.walk?.setEffectiveWeight(w.walk * free);
        act.run?.setEffectiveWeight(w.run * free);
        if (act.walk) act.walk.timeScale = w.pace;
        if (act.run) act.run.timeScale = w.runPace;
        mixer.update(dt);
      }
      pose(dt);
      carry();
    },
    dispose() {
      mixer?.stopAllAction();
      if (mixer) for (const n of Object.keys(own)) if (own[n]) mixer.uncacheClip(own[n]);
      person.hold(null);
      object.removeFromParent();
      for (const m of owned) m.dispose();
      for (const m of Object.values(finish)) m.dispose();
    },
  };
  return person;
}

// A Meshy figure rigged: scaled to `tall` from its skeleton at rest (the top
// of the head to the toes), its feet on the origin, turned to face −z.
function rig(model, clips, kind, tall, tint, gloss) {
  const owned = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // (a skinned mesh's bounds don't follow its pose)
    const swap = (m) => {
      const c = m.clone();
      // Meshy’s colours carry their own shading: matte, but armour keeps a plastic sheen
      c.roughness = gloss ? 0.42 : 0.85;
      c.metalness = 0;
      if (tint != null) c.color?.multiply(new THREE.Color(tint));
      owned.push(c);
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
  });
  model.updateMatrixWorld(true);
  const y = (n) => bones[n]?.getWorldPosition(new THREE.Vector3()).y;
  const top = y('head_end') ?? y('Head');
  const toes = Math.min(y('LeftToeBase') ?? 0, y('RightToeBase') ?? 0);
  const box = new THREE.Box3().setFromObject(model);
  const height = top != null ? top - toes : box.getSize(new THREE.Vector3()).y;
  const k = tall / Math.max(height, 1e-6);
  model.scale.multiplyScalar(k);
  model.position.y -= (top != null ? toes : box.min.y) * k;

  const hips = bones.Hips;
  const hipsY = hips?.position.y ?? RICK_HIPS;
  const own = {};
  for (const [n, clip] of Object.entries(clips)) own[n] = clip ? retarget(clip, hipsY, clip.userData?.hips ?? RICK_HIPS) : null;
  if (hips?.parent && own.walk) {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
    const ahead = heading(own.walk, up);
    if (ahead != null) for (const [n, c] of Object.entries(own)) if (c && n !== 'walk' && !FALLS.has(n)) faceForward(c, up, ahead);
  }
  const animated = Object.values(own).some(Boolean);
  const mixer = animated ? new THREE.AnimationMixer(model) : null;
  const act = {};
  for (const n of WALKS) {
    if (!mixer || !own[n]) continue;
    const a = mixer.clipAction(own[n]);
    a.play();
    a.setEffectiveWeight(n === 'idle' ? 1 : 0);
    act[n] = a;
  }
  const turn = new THREE.Group();
  turn.rotation.y = Math.PI; // (Meshy’s figures face +z)
  turn.add(model);
  const object = new THREE.Group();
  object.name = `person-${kind}`;
  object.add(turn);
  return personOf({ object, kind, tall, hand: bones.RightHand ?? null, mixer, act, own, bones, owned });
}

// a plain capsule and head for a model that didn’t load: white for a trooper, grey for anyone else
function standIn(kind, tall, tint) {
  const color = new THREE.Color(kind === 'stormtrooper' ? 0xe6e8ea : 0x8a8f96);
  if (tint != null) color.multiply(new THREE.Color(tint));
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const head = tall * 0.13;
  const r = tall * 0.12;
  const object = new THREE.Group();
  object.name = `person-${kind}`;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.1, tall - head * 2 - r * 2), 4, 10), mat);
  body.position.y = (tall - head * 2) / 2;
  const top = new THREE.Mesh(new THREE.SphereGeometry(head, 12, 10), mat);
  top.position.y = tall - head;
  object.add(body, top);
  const person = personOf({ object, kind, tall, hand: null, mixer: null, act: {}, own: {}, bones: {}, owned: [mat] });
  const dispose = person.dispose;
  person.dispose = () => {
    body.geometry.dispose();
    top.geometry.dispose();
    dispose();
  };
  return person;
}

export async function loadPerson(kind, { tall, tint = null, renderer = null } = {}) {
  const who = PEOPLE[kind] ?? (typeof kind === 'string' && kind.startsWith('/') ? { url: kind, tall: BODY.h } : PEOPLE.stormtrooper);
  const height = tall ?? who.tall;
  const [gltf, clips] = await Promise.all([loadGltf(who.url, { renderer, fresh: true }), allClips().catch(() => ({}))]);
  if (!gltf?.scene) return standIn(kind, height, tint);
  return rig(gltf.scene, clips, kind, height, tint, Boolean(who.gloss));
}
