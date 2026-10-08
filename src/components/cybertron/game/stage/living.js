// What moves on a stage besides the fighting: a robot set on a roof or a
// rock to watch the place (Soundwave), its head on you while you're in its
// sight and sweeping slowly round what it overlooks when you're not; and a
// big flyer going over (Predaking, as a dragon), its wings beating and then
// gliding, its legs tucked back, its tail swaying behind it, its jaws
// opening now and then. Each on the frame's own time, not a frame's worth.
//
//   watcher(figure, { range, seed }) → (t, dt, sim): a bots.js figure
//   flyer(model, { seed }) → (t) → { lift }: a rigged model's bones turned
//     for its flight (nothing, for a model without them); lift (metres) the
//     rise and fall each beat gives it, for the caller to add

import * as THREE from 'three';
import { rotateWorld } from '../../../../lib/three/ik';
import { wingBeat } from '../bodies';

const EYES = 8.4; // (where to look on Optimus: his head, as tall as he stands)

export function watcher(f, { range = 230, seed = 0 } = {}) {
  const at = new THREE.Vector3();
  return (t, dt, sim) => {
    if (!f) return;
    const p = sim?.player;
    const g = f.group.position;
    const near = p && !p.dead && Math.hypot(p.x - g.x, p.z - g.z) < range;
    if (near) at.set(p.x, p.y + (p.mode === 'vehicle' ? 2.6 : EYES), p.z);
    else {
      // looking out over the place, slowly one way and the other
      const a = f.group.rotation.y + Math.sin(t * 0.11 + seed) * 0.8;
      at.set(g.x + Math.sin(a) * 80, g.y - 12, g.z + Math.cos(a) * 80);
    }
    f.look?.(at);
    f.update(dt);
  };
}

const named = (m) => {
  const bones = [];
  m.traverse((o) => o.isBone && bones.push(o));
  // (a node's name loses its dots as it's loaded: wing.l.001 is wingl001)
  return (re) => bones.filter((b) => re.test(b.name));
};
const bump = (k) => (k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0);

export function flyer(m, { seed = 0 } = {}) {
  const find = named(m);
  const wing = (side) => [find(new RegExp(`^wing\\.?${side}_\\d+$`, 'i')), find(new RegExp(`^wing\\.?${side}\\.?001_\\d+$`, 'i')), find(new RegExp(`^wing\\.?${side}\\.?002_\\d+$`, 'i'))].map((l) => l[0]).filter(Boolean);
  const L = wing('l');
  const R = wing('r');
  const legs = find(/^(front|back)leg\.?[lr]_\d+$/i);
  const tail = find(/^Bone\.?0(0[7-9]|1[0-3])_\d+$/i);
  const neck = find(/^Bone\.?00[1-5]_\d+$/i);
  const jaw = find(/^jaw_\d+$/i)[0] ?? null;
  const all = [...L, ...R, ...legs, ...tail, ...neck, ...(jaw ? [jaw] : [])];
  const rest = all.map((b) => b.quaternion.clone());
  const q = new THREE.Quaternion();
  const F = new THREE.Vector3();
  const U = new THREE.Vector3();
  const S = new THREE.Vector3();
  const AMP = [0.5, 0.22, 0.16]; // root to tip: the tips trailing a little
  return (t) => {
    if (!L.length && !R.length) return { lift: 0 };
    all.forEach((b, i) => b.quaternion.copy(rest[i]));
    m.updateWorldMatrix(true, false);
    m.getWorldQuaternion(q);
    F.set(0, 0, 1).applyQuaternion(q);
    U.set(0, 1, 0).applyQuaternion(q);
    S.set(1, 0, 0).applyQuaternion(q); // (its left)
    const w = wingBeat(t, { seed });
    // each segment a beat behind the one before, so the wing waves; held
    // a little down from how it's modelled through the beat
    for (const [side, chain] of [
      [1, L],
      [-1, R],
    ])
      chain.forEach((b, k) => {
        const f = k ? wingBeat(t - 0.11 * k, { seed }).flap : w.flap;
        rotateWorld(b, F, side * (f * AMP[k] - (k ? 0 : 0.12 * w.env)));
      });
    for (const b of legs) rotateWorld(b, S, 0.55); // (tucked back for flight)
    tail.forEach((b, i) => {
      rotateWorld(b, U, Math.sin(t * 1.15 - i * 0.6 + seed) * 0.055);
      rotateWorld(b, S, -w.lift * 0.025);
    });
    neck.forEach((b) => {
      rotateWorld(b, U, Math.sin(t * 0.43 + seed) * 0.045);
      rotateWorld(b, S, w.lift * 0.02);
    });
    // now and then a roar
    if (jaw) rotateWorld(jaw, S, 0.42 * bump((((t + seed * 3) % 13) + 13) % 13 / 1.7));
    return { lift: w.lift * 1.4 };
  };
}
