// A lit lightsaber in a figure's right hand. A rigged figure holds it in
// its own hand (bladeInHand): the hilt a child of the RightHand bone, set in
// the grip gunplay.js works out from the hand, held at guard in both hands
// and swung in a stance's strokes by saber.js, as yours is: activity.js's
// duellists (duellists.js) fence with it, and what its strokes hit is what
// its blade sweeps. One that isn't rigged holds it where the hand of a
// figure that tall hangs (heldBlade), the blade up and a little forward,
// held out: actors.js's standing Jedi and Sith (a life entry's `blade`),
// who hold it lit and never fight with it.
//
// heldBlade({ color, hilt }, tall) → { arm (add it to the figure's holder),
//   gun, owned (to dispose) }
// bladeInHand(fig, { color, hilt }, { parent, stance, who }) → { gun, gp,
//   saber, stand(dt, now, move), pose(dt, now, { forward, up, me, dir,
//   targets, hit }) (what its strokes may hit, as saber.js's update has them),
//   out(dt, now, { forward, up }) (in pose's place, going down), swing(now,
//   { heavy }), block(on), light(on), busy, lit, dispose() }, or
//   null for a figure with no hand bone to hold it (heldBlade's arm then).
//   fig: { model, bones?, hipsY?, after? }, in a holder already in the
//   scene; parent: where the blade's trail is drawn. Each frame, as the
//   party's are: the figure's update, stand (the body under the blade, for
//   a figure that lays its own bones after its clips), its after, then
//   pose (the arms on the hilt, the chest and head toward `dir`, the blade
//   at guard or through its stroke). Lit when it's made.

import * as THREE from 'three';
import { buildGun, createGunplay } from '../../universe/gunplay';
import { createSaber, dress } from './saber';

export function heldBlade({ color = '#ff3b3b', hilt = null } = {}, tall = 1.8) {
  const owned = [];
  const gun = buildGun('saber', owned);
  dress(gun, color, hilt);
  const blade = gun.getObjectByName('blade');
  if (blade) {
    blade.visible = true;
    blade.scale.y = 1;
  }
  const arm = new THREE.Group();
  arm.position.set(-0.19 * tall, 0.47 * tall, 0.08 * tall);
  arm.add(gun);
  gun.rotation.set(-0.35, 0, -0.2);
  // (the arm's rest: the blade up and a little forward; a duellist's swings
  // turn it from here, activity.js)
  arm.rotation.set(-0.2, 0, 0.25);
  return { arm, gun, owned };
}

const GUARD_AIM = 0.75; // how far up gunplay holds the hilt while it's lit (the party's)

export function bladeInHand(fig, { color = '#ff3b3b', hilt = null } = {}, { parent = null, stance = 'single', who = null } = {}) {
  if (!fig?.model?.getObjectByName('RightHand')?.isBone) return null;
  fig.model.updateMatrixWorld(true);
  const gp = createGunplay({ model: fig.model, bones: fig.bones, sockets: fig.sockets }, 'saber', { unit: 1, who });
  if (!gp) return null;
  // (its strokes are clips on the figure: played on its animator where it has one, the arms laid by saber.js)
  const saber = createSaber(gp, { color, hilt, stance, parent, fig });
  saber.light(true);
  return {
    gun: gp.gun,
    gp,
    saber,
    get busy() {
      return saber.busy;
    },
    get lit() {
      return saber.lit;
    },
    stand: (dt, now, move = 0) => saber.stand(dt, now, move),
    pose(dt, now, { forward, up, me = null, dir = null, targets = [], hit = null }) {
      gp.set(dt, { aim: saber.lit ? GUARD_AIM : 0, look: dir ? 1 : 0, dir, forward, up });
      saber.update(dt, now, { forward, up, me, targets, hit });
    },
    // going down: put out, and the arms left to the clip it falls on (the
    // stroke it was in played out, the blade drawn back in)
    out(dt, now, { forward, up }) {
      saber.light(false);
      saber.block(false);
      saber.update(dt, now, { forward, up, me: null, targets: [] });
    },
    swing: (now, opts) => saber.swing(now, opts),
    block: (on) => saber.block(on),
    light: (on) => saber.light(on),
    dispose() {
      saber.dispose();
      gp.dispose();
    },
  };
}
