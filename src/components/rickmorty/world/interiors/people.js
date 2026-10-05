// The rooms' people, for ../interiors.js: Rick and the Smiths from the
// Meshy cast (portal/meshyCast.js), loaded once for every room that asks,
// Rick's sat clip for whoever has to sit, and people in shapes, the show's
// way, for the teacher and for anyone whose model won't load.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { BASE, faceForward, heading } from '../../portal/meshyCast';
import { mergeParts } from '../kit';
import { CYL } from './shell';

// The cast (Rick and the Smiths), loaded once for every room that asks;
// whoever doesn't load is drawn in shapes. They only stand (and Jerry sits),
// so no run; the walk stays, as the cast turns the idle (Meshy's stands 41°
// off to one side) and Jerry's sat clip to face the way it does.
export async function needCast(kit, names) {
  const need = kit.need ?? ((n, o) => kit.cast.load(null, n, o));
  try {
    await need(names, { clips: ['idle', 'walk'] });
  } catch {
    /* stand-ins */
  }
}

// A person standing at (x, z), facing `face` (rules.js's heading), `h` tall:
// the Meshy figure for `kind`, or a code-drawn one to `look` (if it won't
// load, or `meshy` is false). Its tick plays the idle.
export function person(R, kind, { x, z, face, h, look, y = 0, meshy = true }) {
  const c = meshy ? R.kit.cast.make(kind) : null;
  let fig;
  if (c) {
    c.group.scale.setScalar(h / c.height);
    fig = { group: c.group, cast: c, hand: c.hand, tick: (t) => c.update(t, 0, 0) };
  } else fig = toonPerson(R, look, h);
  fig.group.position.set(x, y, z);
  fig.group.rotation.y = face + Math.PI / 2;
  R.group.add(fig.group);
  if (fig.tick) R.tick(fig.tick);
  return fig;
}

// Rick's sat clip, for the Smiths who haven't one of their own (the same
// skeleton): turns only, so it keeps the sitter's own proportions. Null if it
// won't load, or takes longer than SIT_WAIT (so a room never waits on it).
const SIT_WAIT = 8000;
let sitClip = null;
export function sitting() {
  sitClip ??= Promise.race([
    new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(`${BASE}/rick-sit.glb`)
      .then((g) => {
        const clip = g.animations[0] ?? null;
        if (clip) clip.tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion'));
        return clip;
      }),
    new Promise((done) => setTimeout(() => done(null), SIT_WAIT)),
  ])
    .catch(() => null)
    .then((clip) => {
      if (!clip) sitClip = null; // (asked again, it tries again)
      return clip;
    });
  return sitClip;
}

// Rick's sat clip for someone else of the cast, turned (as meshyCast turns
// every clip it loads) so its hips face the way the sitter's walk does: ahead
export function facingAhead(c, clip) {
  const own = clip.clone();
  const hips = c.group.getObjectByName('Hips');
  const ref = c.act.walk?.getClip();
  if (!hips?.parent || !ref) return own;
  c.group.updateMatrixWorld(true);
  // up, in the hips' parent's frame within the model
  const rel = c.body.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hips.parent.getWorldQuaternion(new THREE.Quaternion()));
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rel.invert());
  const ahead = heading(ref, up);
  if (ahead != null) faceForward(own, up, ahead);
  return own;
}

// A person in shapes, the show's way (a big round head, dot eyes), merged
// into one mesh: { h, skin, shirt, pants, shoes, hair, style, moustache,
// coat, sleeves, belt }. Faces +z; stands on y = 0.
export function toonPerson(R, look, h = 1.8) {
  const {
    skin = 0xf2c9a0,
    shirt = 0xf2d23c,
    pants = 0x3b4a6b,
    shoes = 0x2a221e,
    hair = 0x3a2a1e,
    style = 'short',
    moustache = null,
    coat = null,
    sleeves = 'long',
    belt = null,
    tie = null,
    glasses = false,
    sit = false,
  } = look ?? {};
  const parts = [];
  // sat, everything from the hips up is lower, on a seat 0.45 m up
  const drop = sit ? 0.3 : 0;
  const leg = R.frame(0, 0, 0, { list: parts });
  const f = R.frame(0, 0, 0, { list: parts, y: -drop });
  // legs and shoes
  for (const s of [-1, 1]) {
    if (sit) {
      leg.cyl(pants, s * 0.1, 0.5, 0.2, 0.08, 0.44, Math.PI / 2, 0);
      leg.cyl(pants, s * 0.1, 0.07, 0.42, 0.075, 0.45);
      leg.box(shoes, s * 0.1, 0, 0.46, 0.13, 0.08, 0.27);
    } else {
      leg.cyl(pants, s * 0.1, 0.07, 0, 0.075, 0.76);
      leg.box(shoes, s * 0.1, 0, 0.04, 0.13, 0.08, 0.27);
    }
  }
  // body
  f.part(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), shirt, 0, 1.06, 0, 0, 1, 1, 0.72);
  if (belt != null) f.cyl(belt, 0, 0.8, 0, 0.205, 0.06, 0, 0, CYL).cyl(0xc9a64a, 0, 0.8, 0.15, 0.03, 0.06, Math.PI / 2);
  if (coat != null) {
    f.part(new THREE.CapsuleGeometry(0.215, 0.5, 4, 12), coat, 0, 0.98, -0.01, 0, 1, 1, 0.74);
    f.box(coat, 0, 0.42, -0.02, 0.4, 0.42, 0.3);
    f.box(shirt, 0, 1.0, 0.145, 0.14, 0.42, 0.02);
  }
  if (tie != null) f.box(tie, 0, 0.92, 0.152, 0.06, 0.42, 0.015);
  f.cyl(skin, 0, 1.36, 0, 0.06, 0.12);
  // arms: sleeves and hands
  for (const s of [-1, 1]) {
    const sl = coat ?? shirt;
    if (sleeves === 'short' && coat == null) {
      f.part(new THREE.CapsuleGeometry(0.068, 0.12, 4, 8), sl, s * 0.27, 1.26, 0, 0, 1, 1, 1, 0, s * 0.18);
      f.part(new THREE.CapsuleGeometry(0.052, 0.36, 4, 8), skin, s * 0.3, 0.98, sit ? 0.13 : 0.02, 0, 1, 1, 1, sit ? -0.6 : 0, s * 0.12);
    } else if (sit) f.part(new THREE.CapsuleGeometry(0.062, 0.42, 4, 8), sl, s * 0.27, 1.06, 0.12, 0, 1, 1, 1, -0.55, s * 0.08);
    else f.part(new THREE.CapsuleGeometry(0.062, 0.48, 4, 8), sl, s * 0.29, 1.06, 0.01, 0, 1, 1, 1, 0, s * 0.15);
    f.ball(skin, s * (sit ? 0.25 : 0.34), sit ? 0.86 : 0.77, sit ? 0.3 : 0.03, 0.06);
  }
  // the head: round, big, with dot eyes and a nose
  const hy = 1.6;
  f.ball(skin, 0, hy, 0, 0.18, 1.08);
  f.ball(skin, 0, hy - 0.03, 0.17, 0.035);
  for (const s of [-1, 1]) {
    f.ball(0xffffff, s * 0.065, hy + 0.035, 0.15, 0.048);
    f.ball(0x111111, s * 0.065, hy + 0.035, 0.193, 0.014);
    f.ball(skin, s * 0.18, hy, 0, 0.035);
    if (glasses) f.part(new THREE.TorusGeometry(0.05, 0.008, 6, 16), 0x222222, s * 0.065, hy + 0.035, 0.19);
  }
  f.box(0x6b3a2e, 0, hy - 0.1, 0.162, 0.07, 0.012, 0.01);
  if (moustache != null) f.part(new THREE.CapsuleGeometry(0.022, 0.09, 4, 8), moustache, 0, hy - 0.066, 0.175, 0, 1, 1, 0.8, 0, Math.PI / 2);
  // hair
  if (style === 'short' || style === 'side') {
    f.ball(hair, 0, hy + 0.06, -0.02, 0.19, 0.78);
    f.box(hair, 0, hy + 0.08, 0.1, 0.3, 0.09, 0.1, 0, -0.35);
    for (const s of [-1, 1]) f.box(hair, s * 0.165, hy - 0.04, -0.03, 0.05, 0.16, 0.22);
  } else if (style === 'spiky') {
    f.ball(hair, 0, hy + 0.04, -0.03, 0.185, 0.7);
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + (i / 8) * 2.4;
      f.part(new THREE.ConeGeometry(0.06, 0.24, 6), hair, Math.sin(a) * 0.17, hy + 0.1 + Math.cos(a) * 0.05, -0.08 - Math.cos(a) * 0.06, 0, 1, 1, 1, -0.9, -a * 0.9);
    }
  } else if (style === 'pony' || style === 'bob') {
    f.ball(hair, 0, hy + 0.05, -0.02, 0.195, 0.85);
    f.box(hair, 0, hy + 0.1, 0.11, 0.3, 0.08, 0.08, 0, -0.4);
    if (style === 'pony') f.part(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), hair, 0, hy + 0.06, -0.24, 0, 1, 1, 1, 0.9);
    else for (const s of [-1, 1]) f.box(hair, s * 0.17, hy - 0.1, -0.02, 0.06, 0.3, 0.26);
  }
  const geo = R.own(mergeParts(parts));
  const group = new THREE.Group();
  const body = new THREE.Mesh(geo, R.kit.mats.toon(0xffffff, { vertexColors: true }));
  body.castShadow = true;
  body.receiveShadow = true;
  body.scale.setScalar(h / 1.8);
  group.add(body);
  const seed = Math.random() * 10;
  return {
    group,
    body,
    tick(t) {
      body.scale.y = (h / 1.8) * (1 + Math.sin(t * 2.1 + seed) * 0.008);
      body.rotation.z = Math.sin(t * 0.7 + seed) * 0.015;
    },
  };
}

