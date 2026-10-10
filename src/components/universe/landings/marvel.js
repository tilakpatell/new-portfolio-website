// Down on Marvel's planet: Avengers HQ, upstate, on the compound's lawn.
// The Quinjet is the compound world's own (avengers/compound/models.js);
// Thor, the Hulk, Natasha and the Iron Man armour are its
// Sketchfab people (CC BY, avengers/world/people.js), playing their idles;
// the Infinity Gauntlet is the planet's own model (universe/marvel.glb:
// landings.js names it), and the lawn's trees and the street furniture
// are Quaternius's. Here are the rest: the compound's main building and its
// tower with the A on it, the pad, and the flags.

import * as THREE from 'three';
import { box, part } from '../../galaxy/surface/kit';
import { buildQuinjet } from '../../avengers/compound/models';
import { loadPerson, person } from '../../avengers/world/people';
import { centredClips, rigOf } from '../../avengers/world/borrow';
import { createLook } from '../../avengers/world/castBody';
import { faceStep } from './face';
import { AVENGERS_MODELS } from '../../avengers/people/models';
import { sharpen } from '../../../lib/three/textures';

const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

// the A in its ring, white on `ground` (a canvas, square)
function logo(ground = null, ink = '#ffffff', size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  if (ground) {
    x.fillStyle = ground;
    x.fillRect(0, 0, size, size);
  }
  const s = size / 256;
  x.strokeStyle = ink;
  x.fillStyle = ink;
  x.lineWidth = 16 * s;
  x.beginPath();
  x.arc(128 * s, 128 * s, 96 * s, 0.12 * Math.PI, 1.62 * Math.PI);
  x.stroke();
  // the A, its right leg running out through the ring
  x.beginPath();
  x.moveTo(70 * s, 210 * s);
  x.lineTo(132 * s, 40 * s);
  x.lineTo(166 * s, 40 * s);
  x.lineTo(166 * s, 236 * s);
  x.lineTo(136 * s, 236 * s);
  x.lineTo(136 * s, 178 * s);
  x.lineTo(106 * s, 178 * s);
  x.lineTo(96 * s, 210 * s);
  x.closePath();
  x.fill();
  x.globalCompositeOperation = 'destination-out';
  x.beginPath();
  x.moveTo(114 * s, 152 * s);
  x.lineTo(136 * s, 88 * s);
  x.lineTo(136 * s, 152 * s);
  x.closePath();
  x.fill();
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a flat square with the logo on it, facing +z (or up, `flat`)
function logoPlane(k, w, { ground = null, ink = '#ffffff', glow = false, flat = false } = {}) {
  const tex = k.own(logo(ground, ink));
  const mat = k.own(glow ? new THREE.MeshBasicMaterial({ map: tex, transparent: !ground, color: hot('#ffffff', 2.2), toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, transparent: !ground, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
  const m = new THREE.Mesh(k.own(new THREE.PlaneGeometry(w, w)), mat);
  if (flat) m.rotation.x = -Math.PI / 2;
  return m;
}

export const PROPS = {
  // the main building: two long white storeys with a band of dark glass,
  // a glass-fronted middle, and the tower over it with the A lit on its face
  hq(k) {
    const white = '#e6e7e3';
    const glass = '#1d2733';
    const parts = [];
    for (const side of [-1, 1]) {
      parts.push(part(box(26, 9, 14), { at: [side * 17, 0, 0], color: white, to: 'stone' }));
      parts.push(part(box(25.6, 2.2, 14.1), { at: [side * 17, 5.4, 0], color: glass, to: 'glass' }));
      parts.push(part(box(25.6, 1.8, 14.1), { at: [side * 17, 1.4, 0], color: glass, to: 'glass' }));
      parts.push(part(box(26.4, 0.4, 14.4), { at: [side * 17, 9, 0], color: '#9aa0a6', to: 'metal' }));
    }
    // the middle, glass all the way up, and the tower
    parts.push(part(box(9, 12, 16), { color: glass, to: 'glass' }));
    parts.push(part(box(9.4, 0.5, 16.4), { at: [0, 12, 0], color: '#9aa0a6', to: 'metal' }));
    parts.push(part(box(6, 26, 6), { at: [0, 0, -3], color: white, to: 'stone' }));
    parts.push(part(box(6.4, 0.6, 6.4), { at: [0, 26, -3], color: '#9aa0a6', to: 'metal' }));
    parts.push(part(box(0.2, 6, 0.2), { at: [0, 26.6, -3], color: '#cfd3d6', to: 'metal' }));
    const object = k.build(parts, { name: 'hq' });
    const a = logoPlane(k, 5, { glow: true });
    a.position.set(0, 21, 0.02);
    object.add(a);
    return { object, solids: [{ box: [-17, 0, 13, 7] }, { box: [17, 0, 13, 7] }, { box: [0, 0, 4.5, 8] }] };
  },

  // the landing pad, the A painted on it, and the Quinjet parked on it
  pad(k) {
    const parts = [part(new THREE.CylinderGeometry(13, 13, 0.12, 40).translate(0, 0.06, 0), { color: '#a9aba8', to: 'stone' }), part(new THREE.TorusGeometry(11.6, 0.18, 4, 48).rotateX(Math.PI / 2).translate(0, 0.13, 0), { color: '#f2c94a', to: 'paint' })];
    const object = k.build(parts, { name: 'pad', shadows: false });
    const a = logoPlane(k, 12, { ink: '#f4f4f0', flat: true });
    a.position.y = 0.14;
    object.add(a);
    const mats = {
      body: k.own(new THREE.MeshStandardMaterial({ color: 0x5d6774, metalness: 0.65, roughness: 0.36 })),
      panel: k.own(new THREE.MeshStandardMaterial({ color: 0x7a8490, metalness: 0.55, roughness: 0.45 })),
      glass: k.own(new THREE.MeshStandardMaterial({ color: 0x0f1a28, metalness: 0.3, roughness: 0.05 })),
      dark: k.own(new THREE.MeshStandardMaterial({ color: 0x1b1f25, metalness: 0.6, roughness: 0.5 })),
      glow: k.own(new THREE.MeshBasicMaterial({ color: hot(0x8fd8ff, 0.2), toneMapped: false })),
    };
    const jet = buildQuinjet(mats);
    jet.group.scale.setScalar(0.8);
    jet.group.position.y = 0.12;
    jet.group.rotation.y = 0.5;
    object.add(jet.group);
    return { object, solids: [{ box: [0, 0, 2.4, 11, 0.5] }, { box: [0, 0, 9, 2.2, 0.5] }] };
  },

  // the Infinity Gauntlet (the landing's model) on a plinth, its stones lit
  async monument(k) {
    const object = k.build([part(box(2.6, 1.2, 2.6), { color: '#d8d6cf', to: 'stone' }), part(box(3, 0.2, 3), { color: '#bdbab2', to: 'stone' })], { name: 'monument' });
    const gauntlet = k.specs?.gauntlet ? await k.models.get(k.specs.gauntlet) : null;
    if (gauntlet) {
      gauntlet.position.y = 1.2;
      object.add(gauntlet);
    }
    const light = new THREE.PointLight('#ffd76a', 0.8, 8, 2);
    light.position.set(0, 4, 1.4);
    object.add(light);
    return { object, solids: [{ box: [0, 0, 1.5, 1.5] }] };
  },

  // a flagpole, the Avengers' flag on it
  flag(k) {
    const object = k.build([part(new THREE.CylinderGeometry(0.06, 0.08, 9, 8).translate(0, 4.5, 0), { color: '#cfd3d6', to: 'metal' })], { name: 'flag' });
    const cloth = logoPlane(k, 1.8, { ground: '#2c4a8a' });
    cloth.material.side = THREE.DoubleSide;
    cloth.scale.set(1.5, 1, 1);
    cloth.position.set(1.4, 8, 0);
    object.add(cloth);
    return {
      object,
      solids: [{ circle: [0, 0, 0.12] }],
      update(t) {
        cloth.rotation.y = Math.sin(t * 1.3) * 0.18;
      },
    };
  },

  // one of the team, at their real height, idling (Thor, the Hulk, Natasha,
  // the Iron Man armour): each from its own moment of its idle, and turned
  // to you as you come up (face.js's faceStep), their head on you too
  // (castBody's createLook; the armour stands as it is). The idles are
  // borrow.js's centred ones: Thor's and Natasha's stand a metre off their
  // spot, so turning them swung them round in an arc.
  async hero(k, { who = 'thor' } = {}) {
    const template = await loadPerson(AVENGERS_MODELS[who]);
    const p = person({ ...template, clips: centredClips(template) });
    const idle = p.actions.idle?.getClip().duration ?? 0;
    p.play('idle', { speed: 0.9, from: idle ? Math.random() * idle : 0 });
    p.root.userData.shared = true; // (its geometry and textures are the loader's cache's)
    const object = new THREE.Group();
    const turn = new THREE.Group();
    turn.add(p.root);
    object.add(turn);
    const face = {};
    const alive = who !== 'ironman';
    const rig = alive ? rigOf(p.model) : null;
    const look = rig?.bones.head ? createLook(rig.bones.head, rig.bones.neck ?? null) : null;
    const ahead = new THREE.Vector3();
    return {
      object,
      solids: [{ circle: [0, 0, who === 'hulk' ? 0.7 : 0.4] }],
      update(t, dt, ctx) {
        look?.restore();
        const { seen } = alive ? faceStep(face, object, turn, ctx, dt, { rate: who === 'hulk' ? 2 : 3 }) : { seen: false };
        p.update(dt);
        if (!look) return;
        turn.getWorldDirection(ahead); // (they face +z: the way they're turned, in the world)
        look.update(dt, Math.atan2(ahead.x, ahead.z), seen ? ctx.me : null, object);
      },
    };
  },
};
