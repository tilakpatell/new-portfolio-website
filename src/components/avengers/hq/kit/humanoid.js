// A humanoid built from code, for Ultron's sentries, Chitauri soldiers,
// training bots and the like. Every part is bound wholly to one bone of a
// skeleton ("rigid skinning"), so however many plates, joints and lights a
// figure has, it draws as one mesh per material and still moves limb by limb.
//
// A style supplies the parts for each bone; `poseHumanoid` sets the bones from
// a few numbers (time, gait, aim, recoil, flinch, lean).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { limb, placed, rbox, taper } from './shapes';

// bone: [parent, x, y, z] in metres for a 1.9 m figure, at rest
const BONES = {
  hips: [null, 0, 1.0, 0],
  spine: ['hips', 0, 0.12, 0],
  chest: ['spine', 0, 0.2, 0],
  neck: ['chest', 0, 0.3, 0],
  head: ['neck', 0, 0.08, 0],
  shoulderL: ['chest', 0.23, 0.22, 0],
  elbowL: ['shoulderL', 0, -0.3, 0],
  handL: ['elbowL', 0, -0.27, 0],
  shoulderR: ['chest', -0.23, 0.22, 0],
  elbowR: ['shoulderR', 0, -0.3, 0],
  handR: ['elbowR', 0, -0.27, 0],
  thighL: ['hips', 0.1, -0.05, 0],
  kneeL: ['thighL', 0, -0.44, 0],
  footL: ['kneeL', 0, -0.44, 0],
  thighR: ['hips', -0.1, -0.05, 0],
  kneeR: ['thighR', 0, -0.44, 0],
  footR: ['kneeR', 0, -0.44, 0],
};
const NAMES = Object.keys(BONES);
// styles built to other proportions move some joints
const BONES_FOR = {
  // Hulk: shoulders and hips far wider, a short thick neck, a head sunk
  // between the trapezius
  hulk: {
    hips: [null, 0, 0.95, 0],
    chest: ['spine', 0, 0.21, 0],
    neck: ['chest', 0, 0.36, 0.03],
    head: ['neck', 0, 0.06, 0.02],
    shoulderL: ['chest', 0.37, 0.25, 0],
    elbowL: ['shoulderL', 0, -0.33, 0],
    handL: ['elbowL', 0, -0.3, 0],
    shoulderR: ['chest', -0.37, 0.25, 0],
    elbowR: ['shoulderR', 0, -0.33, 0],
    handR: ['elbowR', 0, -0.3, 0],
    thighL: ['hips', 0.15, -0.06, 0],
    kneeL: ['thighL', 0, -0.42, 0],
    footL: ['kneeL', 0, -0.42, 0],
    thighR: ['hips', -0.15, -0.06, 0],
    kneeR: ['thighR', 0, -0.42, 0],
    footR: ['kneeR', 0, -0.42, 0],
  },
  // Natasha: narrower shoulders and a slimmer frame, long legs
  widow: {
    hips: [null, 0, 1.0, 0],
    spine: ['hips', 0, 0.11, 0],
    chest: ['spine', 0, 0.19, 0],
    neck: ['chest', 0, 0.27, 0],
    head: ['neck', 0, 0.08, 0],
    shoulderL: ['chest', 0.185, 0.2, 0],
    elbowL: ['shoulderL', 0, -0.28, 0],
    handL: ['elbowL', 0, -0.25, 0],
    shoulderR: ['chest', -0.185, 0.2, 0],
    elbowR: ['shoulderR', 0, -0.28, 0],
    handR: ['elbowR', 0, -0.25, 0],
    thighL: ['hips', 0.09, -0.05, 0],
    kneeL: ['thighL', 0, -0.45, 0],
    footL: ['kneeL', 0, -0.45, 0],
    thighR: ['hips', -0.09, -0.05, 0],
    kneeR: ['thighR', 0, -0.45, 0],
    footR: ['kneeR', 0, -0.45, 0],
  },
};

// Each style: (add) => adds parts as add(bone, material, geometry, placement).
// Limbs hang down (−y) from their joint; the figure faces +z.
const STYLES = {
  // Ultron's sentries: polished silver, slim, a long head with a red stare
  ultron(add) {
    // hips and waist
    add('hips', 'body', rbox(0.3, 0.14, 0.19, 0.04), { p: [0, -0.02, 0] });
    add('hips', 'dark', rbox(0.34, 0.05, 0.21, 0.02), { p: [0, 0.05, 0] });
    for (let i = 0; i < 3; i++) add('spine', 'dark', new THREE.CylinderGeometry(0.105 - i * 0.004, 0.11 - i * 0.004, 0.05, 18), { p: [0, 0.03 + i * 0.065, 0] });
    // the chest: a tapered shell, plates over it, the light in the middle
    add('chest', 'body', taper(rbox(0.42, 0.3, 0.23, 0.07), 0.72, 1), { p: [0, 0.14, 0] });
    for (const s of [-1, 1]) {
      add('chest', 'body', rbox(0.17, 0.13, 0.05, 0.025), { p: [s * 0.095, 0.2, 0.11], r: [-0.12, 0, s * -0.12] });
      add('chest', 'dark', rbox(0.04, 0.2, 0.05, 0.015), { p: [s * 0.19, 0.12, 0.06], r: [0, 0, s * 0.2] });
    }
    add('chest', 'glow', new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20), { p: [0, 0.16, 0.135], r: [Math.PI / 2, 0, 0] });
    add('chest', 'dark', new THREE.TorusGeometry(0.045, 0.01, 8, 24), { p: [0, 0.16, 0.13] });
    add('chest', 'body', rbox(0.2, 0.07, 0.16, 0.03), { p: [0, 0.31, -0.02] }); // collar
    // neck and head
    add('neck', 'dark', new THREE.CylinderGeometry(0.045, 0.055, 0.12, 14), { p: [0, 0.03, 0] });
    const skull = new THREE.SphereGeometry(0.1, 24, 18);
    add('head', 'body', skull, { p: [0, 0.13, -0.005], s: [0.95, 1.35, 1.08] });
    add('head', 'body', rbox(0.15, 0.09, 0.15, 0.04), { p: [0, 0.05, 0.02] }); // jaw
    add('head', 'dark', rbox(0.17, 0.035, 0.12, 0.012), { p: [0, 0.13, 0.03] }); // brow ridge band
    for (const s of [-1, 1]) add('head', 'glow', rbox(0.045, 0.014, 0.02, 0.006), { p: [s * 0.04, 0.135, 0.1], r: [0, s * -0.25, s * 0.22] });
    add('head', 'glow', rbox(0.06, 0.008, 0.02, 0.003), { p: [0, 0.06, 0.098] }); // mouth
    add('head', 'dark', rbox(0.03, 0.12, 0.08, 0.012), { p: [0, 0.22, -0.03] }); // crest
    // arms
    for (const [sh, el, ha, s] of [
      ['shoulderL', 'elbowL', 'handL', 1],
      ['shoulderR', 'elbowR', 'handR', -1],
    ]) {
      add(sh, 'dark', new THREE.SphereGeometry(0.06, 16, 12));
      add(sh, 'body', rbox(0.13, 0.09, 0.15, 0.04), { p: [s * 0.02, 0.03, 0], r: [0, 0, s * -0.35] }); // pauldron
      add(sh, 'body', limb(0.05, 0.28, 0.042), { p: [0, -0.29, 0] });
      add(el, 'dark', new THREE.SphereGeometry(0.042, 14, 10));
      add(el, 'body', limb(0.045, 0.25, 0.036), { p: [0, -0.255, 0] });
      add(ha, 'dark', rbox(0.07, 0.09, 0.035, 0.012), { p: [0, -0.05, 0] });
      add(ha, 'body', rbox(0.072, 0.05, 0.03, 0.01), { p: [0, -0.115, 0.004] });
      add(ha, 'glow', new THREE.CylinderGeometry(0.018, 0.018, 0.01, 14), { p: [0, -0.06, 0.02], r: [Math.PI / 2, 0, 0] }); // palm
    }
    // legs, with a thruster in each foot
    for (const [th, kn, ft] of [
      ['thighL', 'kneeL', 'footL'],
      ['thighR', 'kneeR', 'footR'],
    ]) {
      add(th, 'dark', new THREE.SphereGeometry(0.065, 14, 10));
      add(th, 'body', limb(0.07, 0.42, 0.055), { p: [0, -0.43, 0] });
      add(kn, 'dark', new THREE.SphereGeometry(0.05, 14, 10));
      add(kn, 'body', rbox(0.07, 0.07, 0.05, 0.02), { p: [0, 0, 0.04] });
      add(kn, 'body', limb(0.055, 0.42, 0.04), { p: [0, -0.43, 0] });
      add(ft, 'body', taper(rbox(0.08, 0.06, 0.2, 0.025), 1, 0.85), { p: [0, -0.02, 0.03] });
      add(ft, 'glow', new THREE.CylinderGeometry(0.025, 0.03, 0.02, 14), { p: [0, -0.055, 0] });
    }
  },

  // Stark's training bots: white shells over black joints, a blue visor
  bot(add) {
    add('hips', 'shell', rbox(0.3, 0.15, 0.2, 0.05), { p: [0, -0.02, 0] });
    for (let i = 0; i < 2; i++) add('spine', 'dark', new THREE.CylinderGeometry(0.1, 0.11, 0.08, 16), { p: [0, 0.05 + i * 0.09, 0] });
    add('chest', 'shell', taper(rbox(0.42, 0.32, 0.24, 0.09), 0.78, 1), { p: [0, 0.15, 0] });
    add('chest', 'dark', rbox(0.2, 0.08, 0.04, 0.02), { p: [0, 0.2, 0.12] });
    add('chest', 'visor', rbox(0.12, 0.025, 0.02, 0.008), { p: [0, 0.21, 0.135] });
    add('neck', 'dark', new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), { p: [0, 0.03, 0] });
    add('head', 'shell', rbox(0.2, 0.22, 0.22, 0.08), { p: [0, 0.12, 0] });
    add('head', 'dark', rbox(0.18, 0.07, 0.04, 0.02), { p: [0, 0.13, 0.1] });
    add('head', 'visor', rbox(0.16, 0.035, 0.02, 0.01), { p: [0, 0.13, 0.115] });
    for (const [sh, el, ha, sd] of [
      ['shoulderL', 'elbowL', 'handL', 1],
      ['shoulderR', 'elbowR', 'handR', -1],
    ]) {
      add(sh, 'shell', new THREE.SphereGeometry(0.075, 16, 12), { p: [sd * 0.01, 0, 0] });
      add(sh, 'dark', limb(0.045, 0.28, 0.04), { p: [0, -0.29, 0] });
      add(sh, 'shell', limb(0.058, 0.18, 0.05), { p: [0, -0.24, 0] });
      add(el, 'dark', new THREE.SphereGeometry(0.04, 12, 10));
      add(el, 'shell', limb(0.05, 0.22, 0.042), { p: [0, -0.24, 0] });
      add(ha, 'dark', rbox(0.07, 0.1, 0.04, 0.015), { p: [0, -0.05, 0] });
    }
    for (const [th, kn, ft] of [
      ['thighL', 'kneeL', 'footL'],
      ['thighR', 'kneeR', 'footR'],
    ]) {
      add(th, 'shell', limb(0.075, 0.4, 0.06), { p: [0, -0.42, 0] });
      add(kn, 'dark', new THREE.SphereGeometry(0.05, 12, 10));
      add(kn, 'shell', limb(0.06, 0.4, 0.045), { p: [0, -0.42, 0] });
      add(ft, 'dark', rbox(0.09, 0.07, 0.2, 0.025), { p: [0, -0.02, 0.035] });
    }
  },

  // a training dummy in an orange jumpsuit: the hostage
  hostage(add) {
    add('hips', 'suit', rbox(0.3, 0.16, 0.2, 0.06), { p: [0, -0.02, 0] });
    add('spine', 'suit', new THREE.CylinderGeometry(0.12, 0.13, 0.22, 16), { p: [0, 0.1, 0] });
    add('chest', 'suit', taper(rbox(0.4, 0.32, 0.23, 0.1), 0.85, 1), { p: [0, 0.14, 0] });
    add('chest', 'dark', rbox(0.3, 0.12, 0.02, 0.01), { p: [0, 0.16, 0.12] }); // a vest
    add('neck', 'skin', new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), { p: [0, 0.03, 0] });
    add('head', 'skin', new THREE.SphereGeometry(0.11, 20, 16), { p: [0, 0.12, 0], s: [0.92, 1.12, 1] });
    for (const [sh, el, ha] of [
      ['shoulderL', 'elbowL', 'handL'],
      ['shoulderR', 'elbowR', 'handR'],
    ]) {
      add(sh, 'suit', limb(0.06, 0.3, 0.05), { p: [0, -0.3, 0] });
      add(el, 'suit', limb(0.05, 0.25, 0.042), { p: [0, -0.255, 0] });
      add(ha, 'skin', rbox(0.06, 0.09, 0.035, 0.015), { p: [0, -0.05, 0] });
    }
    for (const [th, kn, ft] of [
      ['thighL', 'kneeL', 'footL'],
      ['thighR', 'kneeR', 'footR'],
    ]) {
      add(th, 'suit', limb(0.08, 0.42, 0.065), { p: [0, -0.43, 0] });
      add(kn, 'suit', limb(0.065, 0.42, 0.05), { p: [0, -0.43, 0] });
      add(ft, 'dark', rbox(0.09, 0.07, 0.2, 0.025), { p: [0, -0.02, 0.035] });
    }
  },

  // Captain America: the navy suit with its star and stripes, leather straps,
  // gloves and boots, the winged helmet with the A
  cap(add) {
    add('hips', 'suit', rbox(0.32, 0.17, 0.21, 0.06), { p: [0, -0.02, 0] });
    add('hips', 'leather', rbox(0.35, 0.06, 0.23, 0.02), { p: [0, 0.07, 0] }); // belt
    add('hips', 'silver', rbox(0.06, 0.045, 0.02, 0.01), { p: [0, 0.07, 0.118] }); // buckle
    for (const sd of [-1, 1]) add('hips', 'leather', rbox(0.06, 0.07, 0.05, 0.015), { p: [sd * 0.12, 0.06, 0.1] }); // pouches
    // the striped midriff: red and white down the front
    add('spine', 'suit', new THREE.CylinderGeometry(0.125, 0.135, 0.22, 18), { p: [0, 0.1, -0.005] });
    for (let i = -3; i <= 3; i++) add('spine', i % 2 ? 'white' : 'red', rbox(0.034, 0.22, 0.03, 0.008), { p: [i * 0.034, 0.1, 0.118 - Math.abs(i) * 0.012], r: [0, i * 0.12, 0] });
    add('chest', 'suit', taper(rbox(0.44, 0.33, 0.25, 0.1), 0.8, 1), { p: [0, 0.15, 0] });
    // the star
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.032 : 0.075;
      if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    add('chest', 'white', new THREE.ExtrudeGeometry(star, { depth: 0.012, bevelEnabled: false }), { p: [0, 0.2, 0.124] });
    for (const sd of [-1, 1]) {
      add('chest', 'leather', rbox(0.05, 0.02, 0.26, 0.008), { p: [sd * 0.13, 0.31, 0], r: [0, 0, sd * -0.2] }); // shoulder straps
      add('chest', 'leather', rbox(0.04, 0.16, 0.018, 0.006), { p: [sd * 0.13, 0.24, 0.12], r: [0, 0, sd * 0.25] });
    }
    add('neck', 'suit', new THREE.CylinderGeometry(0.052, 0.06, 0.12, 14), { p: [0, 0.03, 0] });
    // head: the helmet over the top, the face below it
    add('head', 'skin', new THREE.SphereGeometry(0.098, 20, 16), { p: [0, 0.1, 0.01], s: [0.9, 1.12, 1] });
    add('head', 'helmet', new THREE.SphereGeometry(0.112, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58), { p: [0, 0.13, -0.005], s: [0.95, 1.05, 1.05] });
    add('head', 'helmet', rbox(0.2, 0.06, 0.12, 0.03), { p: [0, 0.075, -0.05] }); // its back
    const A = new THREE.Shape();
    A.moveTo(-0.022, -0.024);
    A.lineTo(-0.006, 0.026);
    A.lineTo(0.006, 0.026);
    A.lineTo(0.022, -0.024);
    A.lineTo(0.011, -0.024);
    A.lineTo(0.006, -0.008);
    A.lineTo(-0.006, -0.008);
    A.lineTo(-0.011, -0.024);
    A.closePath();
    add('head', 'white', new THREE.ExtrudeGeometry(A, { depth: 0.008, bevelEnabled: false }), { p: [0, 0.175, 0.098], r: [-0.35, 0, 0] });
    for (const sd of [-1, 1]) add('head', 'white', rbox(0.012, 0.04, 0.05, 0.004), { p: [sd * 0.108, 0.15, 0.01], r: [0.4, 0, 0] }); // wings
    for (const [sh, el, ha, sd] of [
      ['shoulderL', 'elbowL', 'handL', 1],
      ['shoulderR', 'elbowR', 'handR', -1],
    ]) {
      add(sh, 'suit', new THREE.SphereGeometry(0.075, 16, 12), { p: [sd * 0.01, -0.01, 0] });
      add(sh, 'suit', limb(0.064, 0.3, 0.055), { p: [0, -0.3, 0] });
      add(el, 'suit', limb(0.053, 0.25, 0.045), { p: [0, -0.255, 0] });
      add(el, 'leather', limb(0.056, 0.13, 0.05), { p: [0, -0.255, 0] }); // gauntlet cuff
      add(ha, 'leather', rbox(0.07, 0.1, 0.045, 0.018), { p: [0, -0.055, 0] });
    }
    for (const [th, kn, ft] of [
      ['thighL', 'kneeL', 'footL'],
      ['thighR', 'kneeR', 'footR'],
    ]) {
      add(th, 'suit', limb(0.085, 0.43, 0.068), { p: [0, -0.44, 0] });
      add(kn, 'suit', limb(0.066, 0.42, 0.05), { p: [0, -0.43, 0] });
      add(kn, 'leather', limb(0.064, 0.24, 0.055), { p: [0, -0.43, 0] }); // boot
      add(ft, 'leather', rbox(0.095, 0.075, 0.23, 0.03), { p: [0, -0.02, 0.04] });
    }
  },

  // Thor: dark scaled armour, the six silver discs, a silver collar for the
  // cape, bare forearms in silver vambraces, the hair and the beard
  thor(add) {
    add('hips', 'armour', taper(rbox(0.34, 0.2, 0.23, 0.06), 1.08, 1), { p: [0, -0.03, 0] });
    add('hips', 'silver', rbox(0.36, 0.05, 0.25, 0.02), { p: [0, 0.07, 0] }); // belt
    for (const sd of [-1, 1]) add('hips', 'armour', taper(rbox(0.15, 0.28, 0.05, 0.02), 1, 1.2), { p: [sd * 0.09, -0.2, 0.1], r: [0.15, 0, sd * 0.05] }); // the skirt's front panels
    add('spine', 'armour', new THREE.CylinderGeometry(0.13, 0.14, 0.22, 18), { p: [0, 0.1, 0] });
    add('chest', 'armour', taper(rbox(0.48, 0.34, 0.27, 0.1), 0.8, 1), { p: [0, 0.15, 0] });
    for (const sd of [-1, 1])
      for (let i = 0; i < 3; i++) {
        add('chest', 'silver', new THREE.CylinderGeometry(0.038, 0.038, 0.016, 20), { p: [sd * 0.085, 0.27 - i * 0.085, 0.135 - i * 0.008], r: [Math.PI / 2 - 0.12, 0, 0] });
        add('chest', 'armour', new THREE.TorusGeometry(0.038, 0.007, 6, 20), { p: [sd * 0.085, 0.27 - i * 0.085, 0.142 - i * 0.008], r: [-0.12, 0, 0] });
      }
    add('chest', 'silver', rbox(0.34, 0.05, 0.2, 0.02), { p: [0, 0.33, -0.01] }); // collar
    for (const sd of [-1, 1]) {
      add('chest', 'silver', new THREE.CylinderGeometry(0.05, 0.05, 0.02, 20), { p: [sd * 0.2, 0.31, 0.06], r: [Math.PI / 2, 0, 0] }); // cape clasps
      add('chest', 'armour', rbox(0.14, 0.08, 0.2, 0.04), { p: [sd * 0.24, 0.3, -0.01], r: [0, 0, sd * -0.3] }); // pauldrons
    }
    add('neck', 'skin', new THREE.CylinderGeometry(0.055, 0.065, 0.12, 14), { p: [0, 0.03, 0] });
    add('head', 'skin', new THREE.SphereGeometry(0.105, 22, 18), { p: [0, 0.11, 0.01], s: [0.9, 1.12, 1] });
    // the hair swept back off the face, long down the back, and the beard
    add('head', 'hair', new THREE.SphereGeometry(0.116, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), { p: [0, 0.13, -0.025], r: [-0.55, 0, 0], s: [0.96, 1.02, 1.1] });
    add('head', 'hair', taper(rbox(0.2, 0.3, 0.08, 0.035), 1.2, 0.85), { p: [0, 0.02, -0.08], r: [0.12, 0, 0] });
    for (const sd of [-1, 1]) add('head', 'hair', taper(rbox(0.05, 0.22, 0.09, 0.02), 1.3, 0.8), { p: [sd * 0.095, 0.04, -0.03] });
    add('head', 'beard', taper(rbox(0.13, 0.07, 0.05, 0.025), 0.55, 1), { p: [0, 0.02, 0.08] });
    add('head', 'skin', new THREE.SphereGeometry(0.02, 8, 6), { p: [0, 0.1, 0.105] }); // the nose
    for (const sd of [-1, 1]) add('head', 'boot', new THREE.SphereGeometry(0.011, 8, 6), { p: [sd * 0.035, 0.125, 0.095] }); // eyes
    for (const [sh, el, ha, sd] of [
      ['shoulderL', 'elbowL', 'handL', 1],
      ['shoulderR', 'elbowR', 'handR', -1],
    ]) {
      add(sh, 'armour', new THREE.SphereGeometry(0.085, 16, 12), { p: [sd * 0.01, -0.01, 0] });
      add(sh, 'armour', limb(0.072, 0.3, 0.062), { p: [0, -0.3, 0] });
      add(el, 'skin', limb(0.058, 0.25, 0.048), { p: [0, -0.255, 0] });
      add(el, 'silver', limb(0.062, 0.15, 0.054), { p: [0, -0.255, 0] }); // vambrace
      add(ha, 'skin', rbox(0.08, 0.1, 0.05, 0.02), { p: [0, -0.055, 0] });
    }
    for (const [th, kn, ft] of [
      ['thighL', 'kneeL', 'footL'],
      ['thighR', 'kneeR', 'footR'],
    ]) {
      add(th, 'armour', limb(0.09, 0.43, 0.072), { p: [0, -0.44, 0] });
      add(kn, 'armour', limb(0.07, 0.42, 0.055), { p: [0, -0.43, 0] });
      add(kn, 'boot', limb(0.068, 0.26, 0.058), { p: [0, -0.43, 0] });
      add(ft, 'boot', rbox(0.1, 0.08, 0.24, 0.03), { p: [0, -0.02, 0.04] });
    }
  },

  // a Chitauri soldier: grey hide under bronze-dark plates, a long helmeted
  // head with two blue eyes, a staff rifle in the right hand
  chitauri(add) {
    add('hips', 'armour', taper(rbox(0.3, 0.15, 0.2, 0.04), 1.1, 1), { p: [0, -0.02, 0] });
    for (let i = 0; i < 3; i++) add('spine', 'skin', new THREE.TorusGeometry(0.1 - i * 0.006, 0.03, 8, 18), { p: [0, 0.03 + i * 0.065, 0], r: [Math.PI / 2, 0, 0] });
    add('spine', 'skin', new THREE.CylinderGeometry(0.09, 0.1, 0.2, 14), { p: [0, 0.1, 0] });
    add('chest', 'armour', taper(rbox(0.4, 0.3, 0.24, 0.08), 0.72, 1), { p: [0, 0.14, 0.01] });
    for (let i = 0; i < 3; i++) add('chest', 'skin', rbox(0.3 - i * 0.04, 0.025, 0.05, 0.01), { p: [0, 0.04 + i * 0.06, 0.12], r: [0.2, 0, 0] }); // ribs
    add('chest', 'glow', new THREE.SphereGeometry(0.022, 10, 8), { p: [0, 0.2, 0.135] });
    add('chest', 'armour', rbox(0.22, 0.1, 0.2, 0.04), { p: [0, 0.3, -0.06], r: [-0.4, 0, 0] }); // the hump
    add('neck', 'skin', new THREE.CylinderGeometry(0.04, 0.05, 0.14, 12), { p: [0, 0.04, 0.02], r: [0.35, 0, 0] });
    add('head', 'skin', new THREE.SphereGeometry(0.09, 18, 14), { p: [0, 0.09, 0.03], s: [0.85, 0.95, 1.45] });
    add('head', 'armour', taper(rbox(0.16, 0.1, 0.26, 0.04), 1, 0.7, { axis: 'z' }), { p: [0, 0.13, 0.04] }); // helmet
    add('head', 'armour', rbox(0.11, 0.06, 0.1, 0.02), { p: [0, 0.05, 0.14], r: [0.3, 0, 0] }); // the jaw plate
    for (const sd of [-1, 1]) {
      add('head', 'glow', new THREE.SphereGeometry(0.014, 8, 6), { p: [sd * 0.04, 0.1, 0.16] });
      add('head', 'armour', rbox(0.02, 0.07, 0.14, 0.008), { p: [sd * 0.085, 0.14, -0.02], r: [0.3, 0, 0] }); // fins
    }
    for (const [sh, el, ha, sd] of [
      ['shoulderL', 'elbowL', 'handL', 1],
      ['shoulderR', 'elbowR', 'handR', -1],
    ]) {
      add(sh, 'armour', rbox(0.13, 0.09, 0.14, 0.04), { p: [sd * 0.02, 0.02, 0], r: [0, 0, sd * -0.3] });
      add(sh, 'skin', limb(0.045, 0.3, 0.038), { p: [0, -0.3, 0] });
      add(el, 'skin', limb(0.04, 0.26, 0.032), { p: [0, -0.265, 0] });
      add(el, 'armour', limb(0.046, 0.14, 0.04), { p: [0, -0.2, 0] }); // bracer
      add(ha, 'skin', rbox(0.06, 0.09, 0.035, 0.012), { p: [0, -0.05, 0] });
    }
    // the rifle, along the forearm: a long barrel, a blade, the glowing muzzle
    add('handR', 'armour', new THREE.CylinderGeometry(0.022, 0.026, 0.95, 8), { p: [0, -0.2, 0.03] });
    add('handR', 'armour', rbox(0.05, 0.18, 0.07, 0.015), { p: [0, -0.07, 0.03] });
    add('handR', 'armour', taper(rbox(0.012, 0.22, 0.05, 0.004), 1, 0.2), { p: [0, -0.62, 0.03] });
    add('handR', 'glow', new THREE.SphereGeometry(0.03, 10, 8), { p: [0, -0.67, 0.03] });
    for (const [th, kn, ft] of [
      ['thighL', 'kneeL', 'footL'],
      ['thighR', 'kneeR', 'footR'],
    ]) {
      add(th, 'skin', limb(0.065, 0.43, 0.05), { p: [0, -0.44, 0] });
      add(th, 'armour', rbox(0.13, 0.22, 0.08, 0.03), { p: [0, -0.2, 0.05] }); // thigh plate
      add(kn, 'skin', limb(0.05, 0.42, 0.035), { p: [0, -0.43, 0] });
      add(kn, 'armour', rbox(0.09, 0.26, 0.06, 0.02), { p: [0, -0.18, 0.04] }); // greave
      add(ft, 'armour', taper(rbox(0.08, 0.06, 0.22, 0.02), 1, 0.7, { axis: 'z' }), { p: [0, -0.02, 0.05] });
    }
  },

  // a brute: a Chitauri built heavier, with a tower shield on the left arm
  brute(add) {
    STYLES.chitauri(add);
    add('shoulderL', 'armour', rbox(0.24, 0.14, 0.24, 0.06), { p: [0.04, 0.04, 0], r: [0, 0, -0.4] });
    add('shoulderR', 'armour', rbox(0.24, 0.14, 0.24, 0.06), { p: [-0.04, 0.04, 0], r: [0, 0, 0.4] });
    add('chest', 'armour', rbox(0.46, 0.2, 0.08, 0.04), { p: [0, 0.2, 0.13] });
    // the shield: a tall curved plate on the forearm, its face forward
    add('elbowL', 'shield', taper(rbox(0.62, 0.95, 0.06, 0.03), 0.85, 1.05), { p: [-0.05, -0.18, 0.22], r: [-0.05, 0, 0] });
    add('elbowL', 'glow', rbox(0.05, 0.6, 0.012, 0.004), { p: [-0.05, -0.18, 0.256] });
  },

  // Cull Obsidian: huge, hide like cooled rock, a fanged helmet, a shield of
  // a gauntlet on the left arm and the anchor-blade on the right
  cull(add) {
    add('hips', 'armour', taper(rbox(0.42, 0.2, 0.28, 0.06), 1.1, 1), { p: [0, -0.02, 0] });
    add('spine', 'skin', new THREE.CylinderGeometry(0.17, 0.16, 0.24, 16), { p: [0, 0.1, 0] });
    add('chest', 'skin', taper(rbox(0.6, 0.38, 0.34, 0.12), 0.75, 1.05), { p: [0, 0.15, 0] });
    add('chest', 'armour', rbox(0.5, 0.14, 0.3, 0.05), { p: [0, 0.3, -0.02] });
    for (const sd of [-1, 1]) add('chest', 'armour', rbox(0.26, 0.16, 0.3, 0.06), { p: [sd * 0.3, 0.32, 0], r: [0, 0, sd * -0.35] });
    add('chest', 'glow', rbox(0.2, 0.012, 0.01, 0.003), { p: [0, 0.1, 0.17] }); // the cracks glow
    add('neck', 'skin', new THREE.CylinderGeometry(0.08, 0.1, 0.1, 12), { p: [0, 0.02, 0.02] });
    add('head', 'skin', new THREE.SphereGeometry(0.12, 18, 14), { p: [0, 0.08, 0.04], s: [1, 0.9, 1.2] });
    add('head', 'armour', taper(rbox(0.22, 0.12, 0.26, 0.04), 1, 0.8, { axis: 'z' }), { p: [0, 0.14, 0.02] });
    for (const sd of [-1, 1]) {
      add('head', 'glow', new THREE.SphereGeometry(0.016, 8, 6), { p: [sd * 0.05, 0.1, 0.165] });
      add('head', 'armour', taper(rbox(0.025, 0.12, 0.025, 0.006), 1, 0.3), { p: [sd * 0.05, -0.0, 0.15], r: [0.3, 0, 0] }); // tusks
    }
    for (const [sh, el, ha, sd] of [
      ['shoulderL', 'elbowL', 'handL', 1],
      ['shoulderR', 'elbowR', 'handR', -1],
    ]) {
      add(sh, 'skin', limb(0.1, 0.32, 0.085), { p: [0, -0.32, 0] });
      add(el, 'skin', limb(0.085, 0.27, 0.07), { p: [0, -0.275, 0] });
      add(ha, 'skin', rbox(0.12, 0.13, 0.08, 0.03), { p: [0, -0.06, 0] });
      if (sd > 0) add(el, 'shield', taper(rbox(0.5, 0.6, 0.1, 0.04), 0.9, 1.1), { p: [0, -0.18, 0.12] }); // the gauntlet
    }
    // the anchor-blade on its chain
    add('handR', 'armour', new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), { p: [0, -0.4, 0.05] });
    add('handR', 'armour', taper(rbox(0.5, 0.32, 0.07, 0.02), 0.4, 1), { p: [0, -0.85, 0.05] });
    add('handR', 'glow', rbox(0.4, 0.015, 0.075, 0.004), { p: [0, -0.86, 0.05] });
    for (const [th, kn, ft] of [
      ['thighL', 'kneeL', 'footL'],
      ['thighR', 'kneeR', 'footR'],
    ]) {
      add(th, 'skin', limb(0.12, 0.44, 0.1), { p: [0, -0.45, 0] });
      add(kn, 'skin', limb(0.1, 0.42, 0.075), { p: [0, -0.43, 0] });
      add(kn, 'armour', rbox(0.17, 0.28, 0.1, 0.03), { p: [0, -0.2, 0.06] });
      add(ft, 'armour', rbox(0.15, 0.09, 0.28, 0.03), { p: [0, -0.02, 0.06] });
    }
  },
};

// Hulk: built on the bones in BONES_FOR.hulk. Muscle laid over muscle, the
// trapezius rising to the ears, fists like anvils, purple trousers torn off
// below the knee, bare feet. Materials: skin, pants, hair, dark.
STYLES.hulk = (add) => {
  const ball = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
  // the pelvis, in the trousers, the waistband rolled
  add('hips', 'pants', taper(rbox(0.46, 0.24, 0.31, 0.1), 1, 1.05), { p: [0, -0.03, 0] });
  add('hips', 'pants', new THREE.TorusGeometry(0.2, 0.035, 8, 24), { p: [0, 0.08, 0], r: [Math.PI / 2, 0, 0], s: [1.12, 0.8, 1] });
  for (const sd of [-1, 1]) add('hips', 'pants', ball(0.15), { p: [sd * 0.1, -0.07, -0.1], s: [1, 1.05, 0.9] }); // seat
  // the belly and the obliques
  add('spine', 'skin', taper(rbox(0.42, 0.26, 0.3, 0.12), 0.96, 1.08), { p: [0, 0.1, 0.01] });
  for (let i = 0; i < 3; i++)
    for (const sd of [-1, 1]) add('spine', 'skin', ball(0.058, 10, 8), { p: [sd * 0.055, 0.03 + i * 0.075, 0.15], s: [1, 0.75, 0.45] }); // abs
  for (const sd of [-1, 1]) add('spine', 'skin', ball(0.12, 12, 10), { p: [sd * 0.17, 0.1, 0.02], s: [0.7, 1.1, 1.1] });
  // the chest: a barrel, pecs over it, lats flaring at the back
  add('chest', 'skin', taper(rbox(0.66, 0.42, 0.42, 0.16), 0.74, 1), { p: [0, 0.18, 0] });
  for (const sd of [-1, 1]) {
    add('chest', 'skin', ball(0.17, 18, 14), { p: [sd * 0.13, 0.25, 0.13], s: [1.1, 0.75, 0.55] }); // pecs
    add('chest', 'skin', ball(0.2, 16, 12), { p: [sd * 0.24, 0.13, -0.08], s: [0.65, 1.2, 0.85], r: [0, 0, sd * 0.25] }); // lats
    add('chest', 'skin', ball(0.16, 16, 12), { p: [sd * 0.14, 0.33, -0.05], s: [1.25, 0.6, 1] }); // trapezius
    add('chest', 'skin', ball(0.11, 12, 10), { p: [sd * 0.12, 0.2, -0.17], s: [1, 1.2, 0.6] }); // the back, either side of the spine
  }
  add('chest', 'skin', taper(rbox(0.3, 0.16, 0.24, 0.08), 1.2, 0.6), { p: [0, 0.39, -0.03] }); // where the traps meet the neck
  // a short, thick neck
  add('neck', 'skin', new THREE.CylinderGeometry(0.1, 0.13, 0.14, 16), { p: [0, 0.03, 0] });
  // the head, small for the body: a heavy brow, a wide jaw, black hair
  add('head', 'skin', ball(0.11, 20, 16), { p: [0, 0.1, 0.01], s: [0.95, 1.05, 1.08] });
  add('head', 'skin', rbox(0.17, 0.09, 0.15, 0.04), { p: [0, 0.03, 0.04] }); // jaw
  add('head', 'skin', rbox(0.17, 0.035, 0.06, 0.015), { p: [0, 0.135, 0.09], r: [-0.25, 0, 0] }); // brow
  add('head', 'dark', rbox(0.12, 0.012, 0.02, 0.005), { p: [0, 0.035, 0.115] }); // the set mouth
  for (const sd of [-1, 1]) {
    add('head', 'dark', ball(0.013, 8, 6), { p: [sd * 0.04, 0.11, 0.1] });
    add('head', 'skin', ball(0.025, 8, 6), { p: [sd * 0.105, 0.09, 0], s: [0.5, 1, 0.8] }); // ears
  }
  add('head', 'hair', new THREE.SphereGeometry(0.122, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), { p: [0, 0.12, -0.01], s: [1, 0.9, 1.08] });
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 2.2;
    add('head', 'hair', new THREE.ConeGeometry(0.03, 0.08, 6), { p: [Math.sin(a) * 0.08, 0.19, 0.04 + Math.cos(a) * 0.04], r: [0.6, 0, -a * 0.5] }); // the fringe, spiked forward
  }
  for (const [sh, el, ha, sd] of [
    ['shoulderL', 'elbowL', 'handL', 1],
    ['shoulderR', 'elbowR', 'handR', -1],
  ]) {
    add(sh, 'skin', ball(0.16, 18, 14), { p: [sd * 0.03, 0.0, 0], s: [1, 0.95, 1.05] }); // deltoid
    add(sh, 'skin', limb(0.13, 0.34, 0.11, 16), { p: [0, -0.34, 0] }); // upper arm
    add(sh, 'skin', ball(0.11, 14, 10), { p: [0, -0.15, 0.06], s: [0.9, 1.4, 0.9] }); // biceps
    add(sh, 'skin', ball(0.1, 14, 10), { p: [0, -0.16, -0.06], s: [0.95, 1.5, 0.85] }); // triceps
    add(el, 'skin', ball(0.1, 12, 10));
    add(el, 'skin', limb(0.12, 0.3, 0.085, 16), { p: [0, -0.3, 0] }); // forearm, thick at the elbow
    add(el, 'skin', ball(0.1, 12, 10), { p: [0, -0.08, 0.02], s: [1.1, 1.3, 1] });
    // a fist like an anvil
    add(ha, 'skin', rbox(0.17, 0.17, 0.14, 0.05), { p: [0, -0.08, 0.01] });
    add(ha, 'skin', rbox(0.17, 0.06, 0.06, 0.025), { p: [0, -0.13, 0.07] }); // knuckles
    add(ha, 'skin', rbox(0.05, 0.09, 0.06, 0.02), { p: [sd * 0.09, -0.07, 0.05], r: [0.3, 0, 0] }); // thumb
  }
  for (const [th, kn, ft] of [
    ['thighL', 'kneeL', 'footL'],
    ['thighR', 'kneeR', 'footR'],
  ]) {
    add(th, 'pants', limb(0.17, 0.44, 0.13, 16), { p: [0, -0.44, 0] });
    add(th, 'pants', ball(0.14, 14, 10), { p: [0, -0.2, 0.06], s: [1, 1.5, 0.9] }); // quads
    add(kn, 'skin', ball(0.1, 12, 10));
    // the trousers, torn off just below the knee: a ragged hem
    const hem = new THREE.CylinderGeometry(0.14, 0.15, 0.2, 14, 2, true);
    const p = hem.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.05) p.setY(i, p.getY(i) - 0.04 - Math.abs(Math.sin(i * 2.7)) * 0.07);
    hem.computeVertexNormals();
    add(kn, 'pants', hem, { p: [0, -0.06, 0] });
    add(kn, 'skin', limb(0.115, 0.42, 0.085, 14), { p: [0, -0.42, 0] }); // shin
    add(kn, 'skin', ball(0.1, 12, 10), { p: [0, -0.14, -0.06], s: [0.9, 1.5, 0.9] }); // calf
    // bare feet
    add(ft, 'skin', rbox(0.15, 0.09, 0.3, 0.04), { p: [0, -0.02, 0.06] });
    for (let t = 0; t < 4; t++) add(ft, 'skin', ball(0.022, 8, 6), { p: [-0.045 + t * 0.03, -0.035, 0.205] });
  }
};

// Natasha Romanoff, on the bones in BONES_FOR.widow: the black suit with
// grey side panels and a silver zip, the gunmetal belt with the red
// hourglass, a pistol on the right thigh, the Widow's Bite on both wrists,
// and shoulder-length auburn hair, parted and swept to one side. Materials:
// suit, trim, belt, metal, red, skin, dark, hair, bite (glowing), boot.
STYLES.widow = (add) => {
  const ball = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
  // pelvis, hips filled out round the leg joints
  add('hips', 'suit', taper(rbox(0.28, 0.2, 0.19, 0.085), 1.04, 0.9), { p: [0, -0.035, 0] });
  for (const sd of [-1, 1]) add('hips', 'suit', ball(0.082, 16, 12), { p: [sd * 0.088, -0.07, 0], s: [1, 1.05, 1] });
  add('hips', 'belt', rbox(0.3, 0.036, 0.205, 0.014), { p: [0, 0.045, 0] });
  add('hips', 'metal', new THREE.CylinderGeometry(0.03, 0.03, 0.014, 20), { p: [0, 0.045, 0.105], r: [Math.PI / 2, 0, 0] });
  add('hips', 'red', new THREE.ConeGeometry(0.016, 0.024, 3), { p: [0, 0.057, 0.113], r: [0, 0, Math.PI] }); // the hourglass
  add('hips', 'red', new THREE.ConeGeometry(0.016, 0.024, 3), { p: [0, 0.033, 0.113] });
  for (const sd of [-1, 1]) add('hips', 'belt', rbox(0.045, 0.05, 0.035, 0.01), { p: [sd * 0.12, 0.03, 0.08] }); // pouches
  // waist and torso
  add('spine', 'suit', new THREE.CylinderGeometry(0.097, 0.112, 0.2, 18), { p: [0, 0.09, 0] });
  add('spine', 'suit', ball(0.11, 16, 12), { p: [0, 0.0, 0], s: [1.15, 0.6, 0.85] });
  add('chest', 'suit', taper(rbox(0.32, 0.3, 0.2, 0.095), 0.8, 1), { p: [0, 0.13, 0] });
  for (const sd of [-1, 1]) add('chest', 'suit', ball(0.062, 14, 10), { p: [sd * 0.055, 0.135, 0.068], s: [1, 0.88, 0.72] });
  add('chest', 'metal', rbox(0.008, 0.28, 0.012, 0.003), { p: [0, 0.15, 0.104] }); // the zip
  for (const sd of [-1, 1]) {
    add('chest', 'trim', rbox(0.02, 0.25, 0.17, 0.008), { p: [sd * 0.145, 0.125, 0], r: [0, 0, sd * 0.14] }); // grey side panels
    add('chest', 'suit', ball(0.07, 14, 10), { p: [sd * 0.15, 0.25, -0.005], s: [1, 0.8, 1] }); // shoulder caps
  }
  add('chest', 'suit', new THREE.CylinderGeometry(0.05, 0.066, 0.08, 16), { p: [0, 0.29, 0] }); // high collar
  add('neck', 'skin', new THREE.CylinderGeometry(0.035, 0.041, 0.09, 12), { p: [0, 0.035, 0] });
  // the face
  add('head', 'skin', ball(0.084, 22, 18), { p: [0, 0.1, 0.01], s: [0.88, 1.12, 1] });
  add('head', 'skin', rbox(0.095, 0.05, 0.08, 0.025), { p: [0, 0.045, 0.03] }); // jaw
  add('head', 'skin', ball(0.012, 8, 6), { p: [0, 0.092, 0.092] }); // nose
  for (const sd of [-1, 1]) add('head', 'dark', ball(0.008, 8, 6), { p: [sd * 0.028, 0.112, 0.08] });
  // the hair: a full crown, a soft mass behind, locks falling to the
  // shoulders, curtains either side of the face, the fringe swept across
  add('head', 'hair', ball(0.098, 24, 18), { p: [0, 0.13, -0.012], s: [1.0, 0.98, 1.06] });
  add('head', 'hair', ball(0.098, 20, 16), { p: [0, 0.07, -0.05], s: [1.06, 1.2, 0.8] });
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + (i / 6) * 2.4;
    add('head', 'hair', ball(0.048, 12, 10), { p: [Math.sin(a) * 0.085, -0.025 - Math.abs(Math.cos(a)) * 0.012, -Math.cos(a) * 0.062 - 0.02], s: [0.72, 1.85, 0.58], r: [-0.18 * Math.cos(a), 0, Math.sin(a) * 0.25] });
  }
  // either side of the face, behind the cheekbones
  for (const sd of [-1, 1]) add('head', 'hair', ball(0.05, 12, 10), { p: [sd * 0.085, 0.05, -0.012], s: [0.46, 1.6, 0.9], r: [0, 0, sd * -0.1] });
  // the fringe: parted on her right, swept up and across to the left
  add('head', 'hair', ball(0.058, 14, 10), { p: [0.028, 0.185, 0.045], s: [1.35, 0.42, 0.8], r: [0.35, 0, -0.32] });
  for (const [sh, el, ha, sd] of [
    ['shoulderL', 'elbowL', 'handL', 1],
    ['shoulderR', 'elbowR', 'handR', -1],
  ]) {
    add(sh, 'suit', ball(0.054, 14, 10), { p: [sd * 0.004, -0.005, 0] });
    add(sh, 'suit', limb(0.05, 0.28, 0.041), { p: [0, -0.28, 0] });
    add(el, 'suit', ball(0.041, 12, 10));
    add(el, 'suit', limb(0.042, 0.24, 0.032), { p: [0, -0.24, 0] });
    add(el, 'trim', limb(0.044, 0.12, 0.037), { p: [0, -0.235, 0] }); // gauntlet
    add(el, 'bite', new THREE.TorusGeometry(0.04, 0.0075, 6, 22), { p: [0, -0.2, 0], r: [Math.PI / 2, 0, 0] }); // Widow's Bite
    add(el, 'bite', rbox(0.024, 0.012, 0.032, 0.004), { p: [0, -0.16, 0.037] });
    add(ha, 'trim', rbox(0.052, 0.085, 0.032, 0.013), { p: [0, -0.045, 0] });
  }
  for (const [th, kn, ft] of [
    ['thighL', 'kneeL', 'footL'],
    ['thighR', 'kneeR', 'footR'],
  ]) {
    add(th, 'suit', limb(0.084, 0.45, 0.056), { p: [0, -0.45, 0] });
    add(kn, 'suit', ball(0.054, 12, 10));
    add(kn, 'suit', limb(0.057, 0.44, 0.037), { p: [0, -0.44, 0] });
    add(kn, 'boot', limb(0.058, 0.3, 0.043), { p: [0, -0.44, 0] });
    add(ft, 'boot', taper(rbox(0.075, 0.068, 0.2, 0.026), 1, 0.85, { axis: 'z' }), { p: [0, -0.02, 0.035] });
  }
  // the pistol on her right thigh
  add('thighR', 'trim', rbox(0.055, 0.13, 0.065, 0.016), { p: [-0.075, -0.17, 0.005] });
  add('thighR', 'belt', rbox(0.03, 0.06, 0.042, 0.01), { p: [-0.08, -0.08, 0.0] });
};

// A HYDRA trooper: charcoal fatigues, a black plate carrier, a helmet over a
// balaclava and goggles that catch the light red, the red armband, and a
// rifle at the low ready with a torch under the barrel (the torch shows what
// he can see). Materials: cloth, gear, helmet, lens (glowing), metal, red,
// torch (glowing).
STYLES.hydra = (add) => {
  const ball = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
  add('hips', 'cloth', taper(rbox(0.32, 0.18, 0.21, 0.06), 1.05, 1), { p: [0, -0.03, 0] });
  for (const sd of [-1, 1]) add('hips', 'cloth', ball(0.09, 14, 10), { p: [sd * 0.1, -0.07, 0] });
  add('hips', 'gear', rbox(0.35, 0.05, 0.23, 0.015), { p: [0, 0.05, 0] });
  for (const sd of [-1, 1]) add('hips', 'gear', rbox(0.07, 0.08, 0.06, 0.015), { p: [sd * 0.13, 0.0, 0.085] });
  add('spine', 'cloth', new THREE.CylinderGeometry(0.125, 0.135, 0.22, 16), { p: [0, 0.1, 0] });
  add('chest', 'cloth', taper(rbox(0.44, 0.33, 0.25, 0.1), 0.8, 1), { p: [0, 0.15, 0] });
  // the plate carrier and its pouches
  add('chest', 'gear', taper(rbox(0.38, 0.3, 0.29, 0.06), 0.9, 1), { p: [0, 0.13, 0.005] });
  for (let i = 0; i < 3; i++) add('chest', 'gear', rbox(0.085, 0.1, 0.05, 0.015), { p: [(i - 1) * 0.095, 0.05, 0.155] });
  add('chest', 'gear', rbox(0.045, 0.1, 0.04, 0.012), { p: [0.16, 0.24, 0.1] }); // radio
  add('chest', 'red', rbox(0.065, 0.065, 0.012, 0.01), { p: [-0.09, 0.22, 0.15] }); // the patch
  add('chest', 'gear', rbox(0.3, 0.2, 0.06, 0.03), { p: [0, 0.16, -0.16] }); // back plate
  add('neck', 'cloth', new THREE.CylinderGeometry(0.05, 0.058, 0.11, 14), { p: [0, 0.03, 0] });
  // head: balaclava, helmet, goggles
  add('head', 'gear', ball(0.098, 20, 16), { p: [0, 0.1, 0.01], s: [0.92, 1.1, 1] });
  add('head', 'helmet', new THREE.SphereGeometry(0.118, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), { p: [0, 0.125, -0.005], s: [1, 1, 1.08] });
  add('head', 'helmet', new THREE.TorusGeometry(0.112, 0.012, 6, 28), { p: [0, 0.12, -0.005], r: [Math.PI / 2, 0, 0], s: [1, 1.08, 1] });
  add('head', 'lens', rbox(0.15, 0.04, 0.03, 0.012), { p: [0, 0.112, 0.088] });
  add('head', 'gear', rbox(0.21, 0.022, 0.2, 0.008), { p: [0, 0.112, -0.005] }); // goggle strap
  for (const [sh, el, ha, sd] of [
    ['shoulderL', 'elbowL', 'handL', 1],
    ['shoulderR', 'elbowR', 'handR', -1],
  ]) {
    add(sh, 'cloth', ball(0.075, 16, 12), { p: [sd * 0.01, -0.01, 0] });
    add(sh, 'cloth', limb(0.062, 0.3, 0.054), { p: [0, -0.3, 0] });
    add(el, 'cloth', limb(0.052, 0.25, 0.045), { p: [0, -0.255, 0] });
    add(el, 'cloth', ball(0.05, 10, 8));
    add(el, 'gear', ball(0.052, 10, 8), { p: [0, 0, -0.022], s: [1, 0.8, 1] }); // elbow pad
    add(ha, 'gear', rbox(0.07, 0.1, 0.045, 0.018), { p: [0, -0.055, 0] });
  }
  add('shoulderL', 'red', new THREE.CylinderGeometry(0.066, 0.066, 0.06, 16, 1, true), { p: [0, -0.12, 0] }); // armband
  for (const [th, kn, ft] of [
    ['thighL', 'kneeL', 'footL'],
    ['thighR', 'kneeR', 'footR'],
  ]) {
    add(th, 'cloth', limb(0.085, 0.43, 0.068), { p: [0, -0.44, 0] });
    add(kn, 'cloth', ball(0.066, 12, 10));
    add(kn, 'gear', ball(0.064, 10, 8), { p: [0, 0, 0.035], s: [1, 1, 0.7] }); // knee pad
    add(kn, 'cloth', limb(0.064, 0.42, 0.05), { p: [0, -0.43, 0] });
    add(kn, 'gear', limb(0.062, 0.22, 0.056), { p: [0, -0.43, 0] }); // boot
    add(ft, 'gear', rbox(0.095, 0.075, 0.23, 0.03), { p: [0, -0.02, 0.04] });
  }
  add('thighR', 'gear', rbox(0.06, 0.14, 0.07, 0.018), { p: [-0.08, -0.16, 0] }); // holster
  // the rifle, carried across the chest at the low ready, muzzle forward
  const rifle = (mat, geo, p, r = [0, 0, 0]) => add('chest', mat, geo, { p: [-0.05 + p[0], -0.02 + p[1], 0.06 + p[2]], r });
  rifle('metal', rbox(0.05, 0.08, 0.34, 0.012), [0, 0, 0.22]); // receiver
  rifle('metal', new THREE.CylinderGeometry(0.014, 0.014, 0.26, 10), [0, 0.012, 0.5], [Math.PI / 2, 0, 0]); // barrel
  rifle('gear', rbox(0.056, 0.06, 0.18, 0.02), [0, 0.0, 0.45]); // handguard
  rifle('metal', rbox(0.04, 0.13, 0.05, 0.01), [0, -0.09, 0.2], [0.25, 0, 0]); // magazine
  rifle('gear', rbox(0.045, 0.09, 0.16, 0.015), [0, -0.02, 0.0]); // stock
  rifle('metal', rbox(0.03, 0.035, 0.09, 0.008), [0, 0.065, 0.24]); // sight
  rifle('metal', new THREE.CylinderGeometry(0.02, 0.02, 0.07, 12), [0.0, -0.045, 0.5], [Math.PI / 2, 0, 0]); // torch body
  rifle('torch', new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), [0.0, -0.045, 0.537], [Math.PI / 2, 0, 0]); // its lens
};

// Build a figure. `materials` has a material for each key the style uses
// (ultron: body, dark, glow; bot: shell, dark, visor; hostage: suit, dark,
// skin; cap: suit, red, white, leather, silver, skin, helmet; thor: armour,
// silver, skin, hair, beard, boot; chitauri: armour, skin, glow; brute and cull:
// armour, skin, glow, shield). `scale` grows it from 1.9 m.
// A game can bring its own figure: `style` a function like the ones in STYLES,
// and `joints` any bones moved from where BONES has them.
export function buildHumanoid({ style = 'ultron', materials, scale = 1, joints } = {}) {
  // the bones, at rest
  const bones = {};
  for (const name of NAMES) {
    const [parent, x, y, z] = joints?.[name] ?? BONES_FOR[style]?.[name] ?? BONES[name];
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x * scale, y * scale, z * scale);
    bones[name] = b;
    if (parent) bones[parent].add(b);
  }
  const root = new THREE.Group();
  root.add(bones.hips);
  root.updateMatrixWorld(true);
  const list = NAMES.map((n) => bones[n]);
  const skeleton = new THREE.Skeleton(list);

  // the parts, each in its bone's space, carried into the figure's space
  const byMat = {};
  const add = (bone, mat, geo, place) => {
    const g = placed(geo, place);
    g.scale(scale, scale, scale);
    g.applyMatrix4(bones[bone].matrixWorld);
    const n = g.attributes.position.count;
    const idx = NAMES.indexOf(bone);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? idx : 0)), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
    (byMat[mat] ??= []).push(g.index ? g.toNonIndexed() : g);
  };
  (typeof style === 'function' ? style : STYLES[style])(add);

  const meshes = {};
  for (const [key, geos] of Object.entries(byMat)) {
    for (const g of geos) for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(a)) g.deleteAttribute(a);
    const geo = mergeGeometries(geos, false);
    const mesh = new THREE.SkinnedMesh(geo, materials[key]);
    mesh.name = key;
    mesh.castShadow = key !== 'glow';
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.bind(skeleton, new THREE.Matrix4());
    root.add(mesh);
    meshes[key] = mesh;
  }
  const rest = Object.fromEntries(NAMES.map((n) => [n, bones[n].position.clone()]));
  return { root, bones, meshes, skeleton, scale, rest, height: 1.9 * scale };
}

const set = (b, x = 0, y = 0, z = 0) => b.rotation.set(x, y, z);

// Pose a figure. `mode`: 'hover' (Ultron's float), 'walk', 'run', 'idle'.
// `aim` (0..1) raises the right arm to point forward; `recoil` kicks it;
// `flinch` jolts the body back; `lean` tilts forward; `phase` offsets the gait.
export function poseHumanoid(h, { t = 0, mode = 'hover', aim = 0, recoil = 0, flinch = 0, lean = 0, phase = 0, speed = 1 } = {}) {
  const b = h.bones;
  const k = t * speed + phase;
  if (mode === 'hover') {
    const bob = Math.sin(k * 1.6);
    b.hips.position.y = h.rest.hips.y + bob * 0.03 * h.scale;
    set(b.hips, 0.05 + lean * 0.3, 0, 0);
    set(b.spine, 0.03, Math.sin(k * 0.7) * 0.06, 0);
    set(b.chest, -flinch * 0.5, 0, 0);
    set(b.neck, 0, 0, 0);
    set(b.head, 0.05 - flinch * 0.3, Math.sin(k * 0.9) * 0.15, 0);
    // legs hang, a little bent, slightly apart, swaying
    set(b.thighL, 0.12 + bob * 0.05, 0, 0.05);
    set(b.thighR, 0.05 - bob * 0.05, 0, -0.05);
    set(b.kneeL, 0.45 + bob * 0.06, 0, 0);
    set(b.kneeR, 0.35 - bob * 0.06, 0, 0);
    set(b.footL, 0.35, 0, 0);
    set(b.footR, 0.3, 0, 0);
    // arms down and out, ready
    set(b.shoulderL, 0.1 + Math.sin(k * 1.3) * 0.05, 0, 0.35);
    set(b.elbowL, -0.35, 0, 0);
    set(b.handL, 0, 0, 0);
  } else {
    // a walking (or running) gait
    const run = mode === 'run' ? 1 : 0;
    const amp = mode === 'idle' ? 0 : 0.45 + run * 0.35;
    const s = Math.sin(k * (5 + run * 3));
    const c = Math.cos(k * (5 + run * 3));
    b.hips.position.y = h.rest.hips.y - Math.abs(c) * 0.04 * amp * h.scale;
    set(b.hips, 0.05 + lean * 0.4 + run * 0.15, s * 0.08 * amp, 0);
    set(b.spine, 0.04 + run * 0.08, -s * 0.12 * amp, 0);
    set(b.chest, -flinch * 0.5, 0, 0);
    set(b.neck, 0, 0, 0);
    set(b.head, -run * 0.15 - flinch * 0.3, 0, 0);
    set(b.thighL, -s * amp * 0.9, 0, 0.03);
    set(b.thighR, s * amp * 0.9, 0, -0.03);
    set(b.kneeL, Math.max(0, c) * amp * 1.3 + 0.05, 0, 0);
    set(b.kneeR, Math.max(0, -c) * amp * 1.3 + 0.05, 0, 0);
    set(b.footL, Math.max(0, s) * 0.3 * amp, 0, 0);
    set(b.footR, Math.max(0, -s) * 0.3 * amp, 0, 0);
    set(b.shoulderL, s * amp * 0.8, 0, 0.1);
    set(b.elbowL, -0.3 - run * 0.9, 0, 0);
    set(b.handL, 0, 0, 0);
  }
  // the right arm: at rest it mirrors the left; aiming raises it forward
  const restX = mode === 'hover' ? 0.1 + Math.sin(k * 1.3 + 1) * 0.05 : -Math.sin(k * 5) * 0.4;
  const ax = restX * (1 - aim) + (-Math.PI / 2 + 0.1) * aim - recoil * 0.5;
  set(b.shoulderR, ax, -0.1 * aim, (mode === 'hover' ? -0.35 : -0.1) * (1 - aim));
  set(b.elbowR, -0.35 * (1 - aim) - recoil * 0.3, 0, 0);
  set(b.handR, aim * 0.2, 0, 0);
}
