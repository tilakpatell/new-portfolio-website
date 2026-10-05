// The street's visitors, for ./street.js: the President's motorcade at the
// Smiths' kerb (the black limo, the President, his Secret Service agent),
// which drives off east once Morty has met him (`done` has 'president'); the
// Galactic Federation's agents at their posts on the sidewalks, turning to
// watch Morty go by; and the Federation's patrol ship over the street,
// wherever ./RmWorld.jsx's sim (./ship.js) has it (`state.fed`), its jets
// glowing and its searchlight on the road below. Meshy models, each with a
// code-drawn stand-in, so a model that won't load never leaves a hole.

import * as THREE from 'three';
import { hot } from '../../../lib/stage3d';
import { LIMO, PEOPLE, present } from './rules';
import { newFedShip } from './ship';
import { fitModel, mergeParts, at } from './kit';
import { makeRoom } from './interiors/shell';
import { toonPerson } from './interiors/people';
import { fadeUp } from './interiors/lab';

const TALL = { president: 1.88, secretservice: 1.84, fedagent: 1.9 };
// in shapes, if their models won't load
const LOOK = {
  president: { skin: 0x5a3a2a, shirt: 0xf4f4f0, coat: 0x1f2a44, pants: 0x1f2a44, shoes: 0x111111, hair: 0x2a2420, tie: 0xa83232 },
  secretservice: { skin: 0xf0c8a0, shirt: 0xf4f4f0, coat: 0x15161a, pants: 0x15161a, shoes: 0x0e0e0e, hair: 0x3a2a1e, tie: 0x111111, glasses: true },
  fedagent: { skin: 0x9fbf6a, shirt: 0xf4f4f0, coat: 0x15161a, pants: 0x15161a, shoes: 0x0e0e0e, hair: 0x9fbf6a, tie: 0x1e5a5a },
};
const SHIP_H = 6.2; // the patrol ship's height, nose to tail it's about as long
const WATCH = 9; // how near Morty comes before an agent turns to watch him
const LEAVE = { accel: 4, top: 16, gone: 8 }; // the motorcade driving off: m/s², m/s, seconds till it's out of sight

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export async function buildVisitors(kit, { roadY = 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'visitors';
  // (the shapes' parts and what they own, as a room has)
  const R = makeRoom(kit, 'visitors');
  const owned = R.owned;
  const noInk = [];

  // the people's models, waited on a while at most
  try {
    const need = kit.need ? kit.need(['president', 'secretservice', 'fedagent'], { clips: ['idle', 'walk', 'sit'] }) : null;
    await Promise.race([need, new Promise((done) => setTimeout(done, 9000))]);
  } catch {
    /* stand-ins */
  }

  // ── the people ──
  const people = PEOPLE.filter((p) => p.area === 'street').map((p) => {
    const kind = p.who ?? p.id;
    const h = TALL[kind];
    const c = kit.cast?.make?.(kind) ?? null;
    let fig;
    if (c) {
      c.group.scale.setScalar(h / c.height);
      fig = { group: c.group, tick: (t) => c.update(t, 0, 0) };
    } else fig = toonPerson(R, LOOK[kind], h);
    fig.group.position.set(p.x, 0, p.z);
    fig.group.rotation.y = p.face + Math.PI / 2;
    group.add(fig.group);
    return { p, fig, face: p.face, watches: kind === 'fedagent' };
  });

  // ── the limo ──
  const limo = new THREE.Group();
  const model = kit.models?.get('limo');
  if (model) {
    // (made nose to -x: turned to face east, along the kerb)
    limo.add(fitModel(model, { x0: LIMO.x - LIMO.d / 2, x1: LIMO.x + LIMO.d / 2, z0: LIMO.z - LIMO.w / 2, z1: LIMO.z + LIMO.w / 2 }, { turn: Math.PI, h: 1.6 }).holder);
  } else limo.add(standInLimo(R, kit));
  limo.position.y = roadY;
  group.add(limo);

  // ── the Federation's patrol ship ──
  const ship = new THREE.Group();
  ship.rotation.order = 'YXZ';
  const body = new THREE.Group();
  ship.add(body);
  const shipModel = kit.models?.get('fedship');
  if (shipModel) {
    const box = new THREE.Box3().setFromObject(shipModel);
    const size = box.getSize(new THREE.Vector3());
    const k = SHIP_H / size.y;
    shipModel.scale.setScalar(k);
    shipModel.position.set(-((box.min.x + box.max.x) / 2) * k, -((box.min.y + box.max.y) / 2) * k, -((box.min.z + box.max.z) / 2) * k);
    body.add(shipModel);
  } else body.add(standInShip(R, kit));
  // its jets: a glow under each engine pod
  const jetMat = R.own(new THREE.SpriteMaterial({ map: R.own(fadeUp(true)), color: hot(0x7dff6a, 1.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const jets = [-1, 1].map((s) => {
    const j = new THREE.Sprite(jetMat);
    j.position.set(s * SHIP_H * 0.27, -SHIP_H * 0.5, SHIP_H * 0.04);
    j.scale.set(0.9, 2.2, 1);
    body.add(j);
    noInk.push(j);
    return j;
  });
  // its searchlight, down onto whatever's below it
  const beam = new THREE.Mesh(
    R.own(new THREE.CylinderGeometry(0.35, 3.2, 1, 24, 1, true).translate(0, -0.5, 0)),
    R.own(new THREE.MeshBasicMaterial({ map: R.own(fadeUp(true)), color: hot(0xdfffe0, 0.35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
  );
  ship.add(beam);
  noInk.push(beam);
  group.add(ship);

  // ── the motorcade's leaving, and where everything is each frame ──
  let gone = null; // when it set off (null: still parked), or Infinity once out of sight
  let first = true;
  let lastYaw = null;
  const fallback = newFedShip();

  return {
    group,
    noInk,
    update(t, dt, state) {
      const done = state?.done ?? [];
      const met = !present({ until: 'president' }, done);
      // met already when the world first drew: no motorcade at all
      if (met && gone == null) gone = first ? -Infinity : t;
      first = false;
      for (const v of people) {
        const here = present(v.p, done);
        v.fig.group.visible = here;
        if (!here) continue;
        v.fig.tick?.(t);
        // an agent turns to watch Morty while he's near, and back to the road after
        if (v.watches && state?.morty && state.area === 'street') {
          const dx = state.morty.x - v.p.x;
          const dz = state.morty.z - v.p.z;
          const want = Math.hypot(dx, dz) < WATCH ? Math.atan2(-dz, dx) : v.p.face;
          v.face += wrap(want - v.face) * Math.min(1, dt * 3);
          v.fig.group.rotation.y = v.face + Math.PI / 2;
        }
      }
      // the limo: parked, driving off east, or gone
      if (gone == null) limo.position.x = 0;
      else {
        const s = t - gone;
        const run = s < LEAVE.top / LEAVE.accel ? 0.5 * LEAVE.accel * s * s : (LEAVE.top * LEAVE.top) / (2 * LEAVE.accel) + LEAVE.top * (s - LEAVE.top / LEAVE.accel);
        limo.position.x = Number.isFinite(run) ? run : 1e4;
        limo.visible = s < LEAVE.gone;
      }
      // the ship
      const f = state?.fed ?? fallback;
      ship.position.set(f.x, f.y, f.z);
      // a lean into its turns
      const turn = lastYaw == null ? 0 : wrap(f.yaw - lastYaw) / Math.max(dt, 1e-3);
      lastYaw = f.yaw;
      ship.rotation.set(0.06, f.yaw, THREE.MathUtils.clamp(-turn * 0.25, -0.3, 0.3));
      body.position.y = Math.sin(t * 1.3) * 0.25;
      jetMat.opacity = 0.75 + Math.sin(t * 23) * 0.15;
      for (const j of jets) j.scale.y = 2 + Math.sin(t * 17 + j.position.x) * 0.25;
      // the searchlight reaches the ground, brighter while it's on the cruiser's tail
      beam.scale.set(1, Math.max(1, f.y - SHIP_H * 0.45 - roadY), 1);
      beam.position.y = -SHIP_H * 0.45;
      beam.material.opacity = f.mode === 'tail' ? 1 : 0.55 + Math.sin(t * 0.7) * 0.1;
    },
    dispose() {
      for (const o of owned) o.dispose?.();
    },
  };
}

// a black car in shapes, long, nose east, two little flags
function standInLimo(R, kit) {
  const parts = [];
  const p = (geo, color, x, y, z, sx, sy, sz) => parts.push({ geo, color, matrix: at(x, y, z, 0, sx, sy, sz) });
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const WHEEL = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14).rotateX(Math.PI / 2);
  p(BOX, 0x121316, LIMO.x, 0.62, LIMO.z, LIMO.d, 0.62, LIMO.w - 0.2);
  p(BOX, 0x1d2a33, LIMO.x - 0.3, 1.12, LIMO.z, LIMO.d * 0.6, 0.42, LIMO.w - 0.36);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(WHEEL, 0x0a0a0c, LIMO.x + sx * (LIMO.d / 2 - 0.9), 0.36, LIMO.z + sz * (LIMO.w / 2 - 0.15), 1, 1, 1);
  for (const sz of [-1, 1]) {
    p(BOX, 0xb0b4b8, LIMO.x + LIMO.d / 2 - 0.5, 1.2, LIMO.z + sz * 0.7, 0.03, 0.4, 0.03);
    p(BOX, 0xd03a3a, LIMO.x + LIMO.d / 2 - 0.62, 1.32, LIMO.z + sz * 0.7, 0.22, 0.14, 0.01);
  }
  const mesh = new THREE.Mesh(R.own(mergeParts(parts)), kit.mats.toon(0xffffff, { vertexColors: true }));
  BOX.dispose();
  WHEEL.dispose();
  mesh.castShadow = true;
  return mesh;
}

// the Federation's ship in shapes: a dark green egg, red lights, two pale engine pods
function standInShip(R, kit) {
  const parts = [];
  const p = (geo, color, x, y, z, sx, sy = sx, sz = sx) => parts.push({ geo, color, matrix: at(x, y, z, 0, sx, sy, sz) });
  const BALL = new THREE.SphereGeometry(0.5, 18, 12);
  const h = SHIP_H;
  p(BALL, 0x2f5a3a, 0, 0, 0, h * 0.68, h, h * 0.78);
  p(BALL, 0xbfe6f0, 0, h * 0.08, h * 0.37, h * 0.1, h * 0.62, h * 0.06);
  for (const s of [-1, 1]) {
    p(BALL, 0xa8c890, s * h * 0.3, -h * 0.32, h * 0.05, h * 0.2, h * 0.3, h * 0.24);
    p(BALL, 0xe03030, s * h * 0.2, h * 0.08, h * 0.33, h * 0.1);
  }
  const mesh = new THREE.Mesh(R.own(mergeParts(parts)), kit.mats.toon(0xffffff, { vertexColors: true }));
  BALL.dispose();
  return mesh;
}
