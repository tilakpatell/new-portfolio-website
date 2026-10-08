// Captain Jack Sparrow's body at the Black Pearl's helm (./Tide3D.js stands
// him there): on an animator (lib/three/animator.js) with his own idle as
// its idle and the clip library's for the rest (his figure is Meshy's,
// rigged on the library's skeleton), his hands on a wheel turned with the
// helm (lib/three/ik.js), off it for what he does (./jack.js: the rum, a
// shout for the guns, a hit, the kraken, a fist for a ship gone down), his
// head on what's just happened or where she's heading, and his middle held
// up against her roll. A figure with no clip of its own plays it on a plain
// mixer, as it always has.
//
//   makeWheel(tall) → { group, spin, axle, radius, turn(wheel), grip(side, out) }:
//     a ship's wheel sized to a captain `tall` high; group stands on the
//     deck, its axle along its x, its helmsman on its +x side facing −x
//     (his left its +z); turn(wheel) puts it over (radians, + to starboard);
//     grip('left' | 'right', out) → where that hand holds it (world)
//   WHEEL_AHEAD: how far ahead of the captain's feet the wheel stands, a
//     share of his height
//   createCaptain(figure, src, { wheel, seed }) → { anim, down, update(dt,
//     { rudder, ahead }), hear(event, pearl, place) → reaction | null, dispose() }
//     src: the loaded model ({ root, clips }); ahead: a world point he looks
//     toward when nothing else has his eye; place({ x, y }, out) → out: a
//     point on the sea (rules.js's x and y) in the world, where he looks

import * as THREE from 'three';
import { createAnimator } from '../../../lib/three/animator';
import { reach, rotateWorld } from '../../../lib/three/ik';
import { createReactions } from '../../../lib/ai/react';
import { seeded } from '../../../lib/seeded';
import { JACK_FIDGETS, JACK_REACTIONS, helmTo, jackHears, rank } from './jack';

const METRE = 1 / 1.78; // of the captain's height
export const WHEEL_AHEAD = 0.34 * METRE;
const AXLE = 1.0; // metres, the axle off the deck
const RIM = 0.34; // the rim's radius
const SPOKE = 0.46; // the handles' ends
const GRIP = (55 * Math.PI) / 180; // each hand this far from the top
const FOLLOW = 0.3; // how far round the hands go with the wheel (they slip the rest)

export function makeWheel(tall = 1.78) {
  const u = tall * METRE;
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.72, metalness: 0.04 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3e, roughness: 0.35, metalness: 0.85 });
  const group = new THREE.Group();
  const spin = new THREE.Group();
  spin.position.y = AXLE * u;
  group.add(spin);
  const meshes = [];
  const add = (parent, geo, mat, f) => {
    const m = new THREE.Mesh(geo, mat);
    f?.(m);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };
  // the rim in the wheel's plane (its y–z), the axle along x
  add(spin, new THREE.TorusGeometry(RIM * u, 0.022 * u, 8, 36).rotateY(Math.PI / 2), wood);
  add(spin, new THREE.CylinderGeometry(0.075 * u, 0.075 * u, 0.07 * u, 14).rotateZ(Math.PI / 2), brass);
  const spokeGeo = new THREE.CylinderGeometry(0.012 * u, 0.016 * u, SPOKE * u, 6).translate(0, (SPOKE * u) / 2, 0);
  const handleGeo = new THREE.CylinderGeometry(0.02 * u, 0.014 * u, 0.1 * u, 8).translate(0, (SPOKE - 0.05) * u, 0);
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) * Math.PI) / 4; // (none straight up: the view over it stays clear)
    add(spin, spokeGeo, wood, (m) => (m.rotation.x = a));
    add(spin, handleGeo, wood, (m) => (m.rotation.x = a));
  }
  // the post it turns on, forward of it, and the axle into it
  add(group, new THREE.BoxGeometry(0.12 * u, AXLE * u + 0.08 * u, 0.16 * u).translate(-0.11 * u, ((AXLE + 0.08) * u) / 2, 0), wood);
  add(spin, new THREE.CylinderGeometry(0.025 * u, 0.025 * u, 0.12 * u, 8).rotateZ(Math.PI / 2).translate(-0.06 * u, 0, 0), brass);
  let angle = 0; // the wheel's own turn (+ starboard)
  const p = new THREE.Vector3();
  return {
    group,
    spin,
    axle: AXLE * u,
    radius: RIM * u,
    turn(wheel) {
      angle = wheel;
      spin.rotation.x = -wheel; // (clockwise, as he sees it, is a turn about −x)
    },
    grip(side, out = new THREE.Vector3()) {
      const a = (side === 'left' ? GRIP : -GRIP) - FOLLOW * angle;
      p.set(0, AXLE * u + RIM * u * Math.cos(a), RIM * u * Math.sin(a));
      group.updateWorldMatrix(true, false);
      return out.copy(p).applyMatrix4(group.matrixWorld);
    },
    dispose() {
      const geos = new Set(meshes.map((m) => m.geometry));
      for (const g of geos) g.dispose();
      wood.dispose();
      brass.dispose();
    },
  };
}

const SIDES = ['Left', 'Right'];
const GLANCE = 2.6; // seconds his eyes stay on what happened

export function createCaptain(figure, src, { wheel = null, seed = 17 } = {}) {
  let anim = null;
  const hips = src.root.getObjectByName('Hips');
  if (src.clips?.[0] && hips?.parent) {
    // (up, in the space the hips turn in, as the source has it unposed)
    src.root.updateMatrixWorld(true);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
    anim = createAnimator(figure, { clips: { idle: src.clips[0] }, hipsY: hips.position.y, up, key: 'caribbean:jack', seed });
    anim.idles({ fidgets: JACK_FIDGETS, every: [9, 17] });
  }
  const mixer = anim ? null : new THREE.AnimationMixer(figure);
  if (mixer && src.clips?.[0]) mixer.clipAction(src.clips[0]).play();
  const reactions = createReactions(JACK_REACTIONS, { rand: seeded(seed * 7 + 3) });
  const bone = (n) => figure.getObjectByName(n);
  const arms = SIDES.map((s) => ({ side: s.toLowerCase(), upper: bone(`${s}Arm`), fore: bone(`${s}ForeArm`), hand: bone(`${s}Hand`) }));
  const middle = bone('Spine01');
  const st = { t: 0, wheel: 0, grip: 0, down: false, now: null, glance: new THREE.Vector3(), glanceFor: 0 };
  const target = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const busy = () => Boolean(anim && (anim.playing('upper') || anim.playing('full')));

  return {
    anim,
    get down() {
      return st.down;
    },
    update(dt, { rudder = 0, ahead = null } = {}) {
      st.t += dt;
      st.wheel = helmTo(st.wheel, st.down ? 0 : rudder, dt);
      wheel?.turn(st.wheel);
      if (!anim) {
        mixer.update(dt);
        return;
      }
      st.glanceFor = Math.max(0, st.glanceFor - dt);
      anim.look(st.glanceFor > 0 ? st.glance : ahead, { yaw: 1.2, pitch: 0.5, rate: 4 });
      anim.locomote({ move: 0, speed: 0, side: 0, turn: 0 });
      anim.update(dt);
      anim.after(dt);
      // his hands on the wheel unless they're busy (eased off and back)
      const want = wheel && !st.down && !busy() ? 1 : 0;
      st.grip += (want - st.grip) * (1 - Math.exp(-dt * 7));
      if (wheel && st.grip > 0.01) {
        figure.getWorldQuaternion(q);
        fwd.set(0, 0, 1).applyQuaternion(q);
        for (const a of arms) {
          wheel.grip(a.side, target);
          // (the elbows down and out to their own side, a little back)
          pole.set(a.side === 'left' ? 0.7 : -0.7, -1, -0.3).applyQuaternion(q);
          reach(a.upper, a.fore, a.hand, target, pole, st.grip);
        }
      }
      // his middle held up against her roll and pitch (the deck tips; he doesn't, so much)
      const deck = figure.parent;
      if (middle && deck?.parent && !st.down) {
        deck.parent.getWorldQuaternion(q);
        rotateWorld(middle, axis.set(1, 0, 0).applyQuaternion(q), -deck.rotation.x * 0.6);
        rotateWorld(middle, axis.set(0, 0, 1).applyQuaternion(q), -deck.rotation.z * 0.4);
      }
    },
    // something's happened (a rules.js event): his part in it, if he has
    // one; `place` puts a point on the sea in the world, for his eyes
    hear(e, pearl, place = null) {
      const m = jackHears(e, pearl);
      if (!m || st.down) return null;
      // (a smaller moment doesn't cut a bigger one still going)
      if (st.now && busy() && anim?.playing(st.now.layer) === st.now.clip && rank(m.event) < st.now.rank) return null;
      const r = reactions.on(m.event, { t: st.t });
      if (!r) return null;
      if (anim) anim.play(r.clip, { layer: r.layer, hold: r.hold === true });
      st.now = { clip: r.clip, layer: r.layer, rank: rank(m.event) };
      if (m.event === 'down') st.down = true;
      const at = m.at && place ? place(m.at, st.glance) : null;
      if (at) st.glanceFor = GLANCE;
      return r;
    },
    dispose() {
      anim?.dispose();
      mixer?.stopAllAction();
      wheel?.dispose();
    },
  };
}
