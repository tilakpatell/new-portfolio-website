// Leviathans: now and then (director.js) something enormous passes.
//
// - Purrgil, for the Star Wars crews: a pod of three to five space whales,
//   each a long body with a pale belly, four tentacles trailing and a pair
//   of flukes, swimming past at their own pace on a convoy's lane (lanes.js)
//   with a slow wave down their bodies and their tentacles swaying.
// - A Cromulon, for Rick's: a giant stone head drifts in from one side,
//   stops facing you, and says what it always says (its jaw works while the
//   crew's lines run), then drifts off.
// Nothing hurts them: a bolt into one is a hit the scene can mention
// (`hit`), and that's all. One pass at a time (`busy`).
//
// createLeviathans(parent, { small }) → { pass(ship, family, rand) → 'purrgil' | 'cromulon' | null,
//   update(dt, t, camera) → busy, hit(from, to) → boolean, busy, dispose() }
// Everything is in `parent`'s space (the map's).

import * as THREE from 'three';
import { bezier, convoyLane, laneLength, tangent } from './lanes';
import { forward } from './ship';

const POD_MAX = 5;
const PURRGIL_SPEED = 2.2; // map units a second
const PURRGIL_LENGTH = 6; // the lead's, map units
const CROMULON = { far: 40, near: 24, ahead: 45, stop: 20, come: 6, talkFrom: 2.5, talkTo: 7, leave: 9, drift: 3, gone: 90 };

const { PI, sin, cos } = Math;

// how close a segment from a to b passes the point c, at the nearest
const segmentDistance = (a, b, c) => {
  const ab = b.clone().sub(a);
  const l2 = ab.lengthSq();
  const t = l2 > 1e-9 ? Math.min(1, Math.max(0, c.clone().sub(a).dot(ab) / l2)) : 0;
  return a.clone().addScaledVector(ab, t).distanceTo(c);
};

export function createLeviathans(parent, { small = false } = {}) {
  const made = [];
  const keep = (x) => (made.push(x), x);
  const seg = (big, low) => (small ? low : big);
  const back = keep(new THREE.MeshStandardMaterial({ color: '#4a3f8a', roughness: 0.85, metalness: 0.05 }));
  const belly = keep(new THREE.MeshStandardMaterial({ color: '#b9b4d8', roughness: 0.9 }));
  const eye = keep(new THREE.MeshBasicMaterial({ color: '#7fd8ff', toneMapped: false }));
  const stone = keep(new THREE.MeshStandardMaterial({ color: '#8a8277', roughness: 0.95 }));
  const dark = keep(new THREE.MeshStandardMaterial({ color: '#4e4841', roughness: 1 }));
  const pale = keep(new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.8 }));

  // ── a purrgil, 1 unit long along −z, its nose at −0.5 ──
  const bodyGeo = keep(new THREE.CapsuleGeometry(0.12, 0.52, seg(6, 3), seg(16, 10)).rotateX(PI / 2));
  const bellyGeo = keep(new THREE.CapsuleGeometry(0.085, 0.4, seg(5, 3), seg(12, 8)).rotateX(PI / 2));
  const headGeo = keep(new THREE.SphereGeometry(0.15, seg(16, 10), seg(12, 8)));
  const tailGeo = keep(new THREE.ConeGeometry(0.09, 0.3, seg(10, 6)).rotateX(-PI / 2));
  const flukeGeo = keep(new THREE.BoxGeometry(0.34, 0.025, 0.14));
  const tentacleGeo = keep(new THREE.CylinderGeometry(0.008, 0.03, 0.55, seg(6, 4)).translate(0, -0.275, 0).rotateX(-PI / 2));
  const eyeGeo = keep(new THREE.SphereGeometry(0.022, 8, 6));
  const purrgil = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, back);
    const under = new THREE.Mesh(bellyGeo, belly);
    under.position.set(0, -0.06, 0.02);
    const head = new THREE.Mesh(headGeo, back);
    head.position.set(0, 0.01, -0.36);
    head.scale.set(1, 0.9, 1.1);
    const tail = new THREE.Mesh(tailGeo, back);
    tail.position.set(0, 0, 0.5);
    tail.rotation.x = PI;
    const flukes = new THREE.Mesh(flukeGeo, back);
    flukes.position.set(0, 0, 0.62);
    const tentacles = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      const tn = new THREE.Mesh(tentacleGeo, belly);
      tn.position.set(cos(a) * 0.09, sin(a) * 0.07 - 0.02, 0.3);
      tn.userData.phase = i * 1.7;
      tentacles.push(tn);
    }
    const eyes = [-1, 1].map((s) => {
      const e = new THREE.Mesh(eyeGeo, eye);
      e.position.set(s * 0.11, 0.03, -0.42);
      return e;
    });
    g.add(body, under, head, tail, flukes, ...tentacles, ...eyes);
    g.visible = false;
    return { group: g, tentacles, flukes, back: 0, side: 0, rise: 0, scale: 1, phase: 0 };
  };
  const pod = { group: new THREE.Group(), members: Array.from({ length: POD_MAX }, purrgil), on: false, n: 0, pts: null, len: 1, t: 0 };
  for (const m of pod.members) pod.group.add(m.group);
  parent.add(pod.group);

  // ── the Cromulon, a head 1 tall ──
  const headBox = keep(new THREE.BoxGeometry(0.8, 1, 0.66));
  const faceBox = keep(new THREE.BoxGeometry(0.7, 0.72, 0.1));
  const browBox = keep(new THREE.BoxGeometry(0.74, 0.1, 0.2));
  const socketBox = keep(new THREE.BoxGeometry(0.2, 0.16, 0.1));
  const eyeBall = keep(new THREE.SphereGeometry(0.06, seg(12, 8), seg(8, 6)));
  const jawBox = keep(new THREE.BoxGeometry(0.7, 0.26, 0.54).translate(0, -0.13, 0.2));
  const cromulon = (() => {
    const g = new THREE.Group();
    const skull = new THREE.Mesh(headBox, stone);
    const face = new THREE.Mesh(faceBox, dark);
    face.position.set(0, 0.08, -0.33);
    const brow = new THREE.Mesh(browBox, stone);
    brow.position.set(0, 0.3, -0.38);
    const sockets = [-1, 1].map((s) => {
      const so = new THREE.Mesh(socketBox, dark);
      so.position.set(s * 0.2, 0.17, -0.37);
      const ball = new THREE.Mesh(eyeBall, pale);
      ball.position.set(s * 0.2, 0.17, -0.4);
      return [so, ball];
    });
    const jaw = new THREE.Mesh(jawBox, stone);
    jaw.position.set(0, -0.28, -0.4);
    g.add(skull, face, brow, ...sockets.flat(), jaw);
    g.visible = false;
    return { group: g, jaw, on: false, age: 0, from: new THREE.Vector3(), stop: new THREE.Vector3(), away: new THREE.Vector3() };
  })();
  parent.add(cromulon.group);

  const p = [0, 0, 0];
  const d = [0, 0, 0];
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const look = new THREE.Vector3();
  const a3 = new THREE.Vector3();

  return {
    // something passes: by `family` ('starwars', 'rickmorty' or 'both'),
    // the pod or the head; null while one's already going, or when
    // there's no room for the pod's lane
    pass(ship, family, rand = Math.random) {
      if (pod.on || cromulon.on) return null;
      const kind = family === 'starwars' ? 'purrgil' : family === 'rickmorty' ? 'cromulon' : rand() < 0.5 ? 'purrgil' : 'cromulon';
      if (kind === 'purrgil') {
        const pts = convoyLane(ship, rand);
        if (!pts) return null;
        pod.pts = pts;
        pod.len = laneLength(pts);
        pod.t = 0;
        pod.n = 3 + Math.floor(rand() * 3);
        let behind = 0;
        pod.members.forEach((m, i) => {
          m.group.visible = i < pod.n;
          m.scale = i === 0 ? PURRGIL_LENGTH : PURRGIL_LENGTH * (0.75 + rand() * 0.25);
          m.group.scale.setScalar(m.scale);
          m.back = behind;
          behind += m.scale * (1.3 + rand() * 0.6);
          m.side = i === 0 ? 0 : (rand() - 0.5) * 10;
          m.rise = i === 0 ? 0 : (rand() - 0.5) * 5;
          m.phase = rand() * PI * 2;
        });
        pod.on = true;
        return 'purrgil';
      }
      const [fx, fz] = forward(ship.heading);
      const side = rand() < 0.5 ? -1 : 1;
      const rx = -fz * side;
      const rz = fx * side;
      cromulon.from.set(ship.x + fx * CROMULON.ahead + rx * CROMULON.far, ship.y + 2, ship.z + fz * CROMULON.ahead + rz * CROMULON.far);
      cromulon.stop.set(ship.x + fx * CROMULON.stop + rx * CROMULON.near, ship.y + 1.5, ship.z + fz * CROMULON.stop + rz * CROMULON.near);
      cromulon.away.set(rx + fx * 0.3, 0.05, rz + fz * 0.3).normalize();
      look.set(ship.x, ship.y, ship.z);
      cromulon.age = 0;
      cromulon.on = true;
      cromulon.group.scale.setScalar(9);
      cromulon.group.position.copy(cromulon.from);
      cromulon.group.lookAt(look);
      cromulon.group.rotateY(PI); // (its face is on its −z side)
      cromulon.jaw.rotation.x = 0;
      cromulon.group.visible = true;
      return 'cromulon';
    },

    get busy() {
      return pod.on || cromulon.on;
    },

    update(dt, t) {
      let busy = false;
      if (pod.on) {
        busy = true;
        pod.t += (dt * PURRGIL_SPEED) / pod.len;
        let anyLeft = false;
        for (let i = 0; i < pod.n; i++) {
          const m = pod.members[i];
          const ti = pod.t - m.back / pod.len;
          if (ti < 0) {
            m.group.visible = false;
            anyLeft = true;
            continue;
          }
          if (ti > 1) {
            m.group.visible = false;
            continue;
          }
          anyLeft = true;
          m.group.visible = true;
          bezier(pod.pts, ti, p);
          tangent(pod.pts, ti, d);
          dir.set(d[0], d[1], d[2]).normalize();
          right.crossVectors(dir, up).normalize();
          pos.set(p[0], p[1], p[2]).addScaledVector(right, m.side).addScaledVector(up, m.rise);
          // the slow wave down the body: a nod and a sway that run along the pod
          const w = t * 0.9 + m.phase;
          pos.addScaledVector(up, sin(w) * 0.6);
          m.group.position.copy(pos);
          m.group.lookAt(a3.copy(pos).addScaledVector(dir, -1)); // (lookAt points +z at the target: the nose is −z)
          m.group.rotateX(sin(w) * 0.08);
          m.group.rotateZ(sin(w * 0.7) * 0.06);
          m.flukes.rotation.x = sin(w * 1.3) * 0.2;
          for (const tn of m.tentacles) {
            tn.rotation.x = 0.12 + 0.18 * sin(t * 1.3 + tn.userData.phase + m.phase);
            tn.rotation.y = 0.14 * sin(t * 0.9 + tn.userData.phase * 1.3);
          }
        }
        if (!anyLeft) {
          pod.on = false;
          for (const m of pod.members) m.group.visible = false;
        }
      }
      if (cromulon.on) {
        busy = true;
        cromulon.age += dt;
        const age = cromulon.age;
        const g = cromulon.group;
        if (age < CROMULON.come) {
          const k = age / CROMULON.come;
          const e = 1 - (1 - k) ** 3;
          g.position.lerpVectors(cromulon.from, cromulon.stop, e);
        } else if (age > CROMULON.leave) {
          g.position.addScaledVector(cromulon.away, dt * CROMULON.drift);
          g.rotateY(dt * 0.05);
        }
        // the talking: the jaw opens and shuts four times
        let open = 0;
        if (age > CROMULON.talkFrom && age < CROMULON.talkTo) {
          const k = (age - CROMULON.talkFrom) / (CROMULON.talkTo - CROMULON.talkFrom);
          open = Math.max(0, sin(k * PI * 4)) * 0.45;
        }
        cromulon.jaw.rotation.x = -open;
        if (age > CROMULON.leave && g.position.distanceTo(cromulon.stop) > CROMULON.gone) {
          cromulon.on = false;
          g.visible = false;
        }
      }
      return busy;
    },

    // a bolt from `from` to `to` (Vector3s, map space) into one of them
    hit(from, to) {
      if (pod.on) {
        for (let i = 0; i < pod.n; i++) {
          const m = pod.members[i];
          if (!m.group.visible) continue;
          if (segmentDistance(from, to, m.group.position) < m.scale * 0.16) return true;
        }
      }
      if (cromulon.on && segmentDistance(from, to, cromulon.group.position) < 4.5) return true;
      return false;
    },

    dispose() {
      pod.group.removeFromParent();
      cromulon.group.removeFromParent();
      for (const x of made) x.dispose();
    },
  };
}
