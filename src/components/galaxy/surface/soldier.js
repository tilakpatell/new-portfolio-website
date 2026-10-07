// One soldier on a world, drawn: its figure (crew.js's rigged model where
// the kind has one, actors.js's anyFigure otherwise), the gun its kind
// carries in its hand (universe/gunplay.js), brought up and aimed at what
// it's firing at and kicking with each shot, walking on clips paced to the
// ground it covers (locomotion.js), kneeling, flinching, pounding its chest
// and going down on the fight's clips. A figure without a rig (a built one,
// a catalogue model) carries no gun and tips over when it falls. Shared by
// the battles on the worlds (skirmishScene.js) and the galactic assaults
// (missions/assaultScene.js).
//
// createSoldier({ parent, kind, variant, kit, warm, scale, gun }) → {
//   holder, ready (once its figure's in), tall,
//   update(dt, { x, y, z, yaw, move (0…1), speed (m/s), kneel, taunt, aim
//     (0…1), at ([x, y, z] it's aiming at, or null) }),
//   flinch(), fall(clip), rise(), muzzle() → [x, y, z] a shot leaves from
//   (and the gun's kick), or null, dispose() }

import * as THREE from 'three';
import { anyFigure } from './actors';
import { createGunplay } from '../../universe/gunplay';

// what each kind carries (gunplay.js's GUNS)
export const SOLDIER_GUNS = {
  clone: 'dc15',
  battledroid: 'e5',
  superdroid: 'wrist',
  wookiee: 'bowcaster',
  stormtrooper: 'e11',
  snowtrooper: 'e11',
  sandtrooper: 'dlt19',
  shoretrooper: 'e11',
  deathtrooper: 'e11',
  scouttrooper: 'pistol',
  hothtrooper: 'a280',
  rebel: 'a280',
};
export const gunOf = (kind) => SOLDIER_GUNS[kind] ?? 'e11';

const V = THREE.Vector3;
const UP = new V(0, 1, 0);
const TIP = 0.35; // seconds a figure with no clip to fall on takes to tip over
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createSoldier({ parent, kind, variant = 0, kit = null, warm = (o) => Promise.resolve(o), scale = 1, gun = gunOf(kind) }) {
  const holder = new THREE.Group();
  holder.visible = false;
  parent.add(holder);
  let fig = null;
  let gp = null;
  let gone = false;
  let dead = false;
  let down = 0;
  let posed = null;
  let flinch = 0;
  let prevYaw = null;
  const fwd = new V();
  const dir = new V();
  const ready = anyFigure(kind, { variant }, kit)
    .then((f) => {
      if (!f || gone) return false;
      f.model.scale.multiplyScalar(scale);
      holder.add(f.model);
      fig = f;
      // (a gun only in a rigged hand: the built figures and the catalogue's statues carry none)
      if (f.rigged && gun) {
        holder.updateMatrixWorld(true);
        gp = createGunplay(f, gun, { unit: 1 });
      }
      return warm(holder).then(() => true);
    })
    .catch(() => false);

  return {
    holder,
    ready,
    get loaded() {
      return Boolean(fig);
    },
    get tall() {
      return (fig?.tall ?? 1.8) * scale;
    },
    update(dt, s) {
      holder.position.set(s.x, s.y, s.z);
      if (!fig) return;
      const rigged = Boolean(fig.pose && fig.rigged);
      if (!dead) {
        holder.rotation.set(0, s.yaw, 0);
        const pose = s.taunt ? 'taunt' : s.kneel ? 'kneel' : null;
        if (pose !== posed) {
          fig.pose?.(pose);
          posed = pose;
        }
      } else {
        down += dt;
        // (no clip to fall on: tipped over backwards)
        if (!rigged) holder.rotation.x = -Math.min(Math.PI / 2, (down / TIP) * (Math.PI / 2));
      }
      if (flinch > 0 && !rigged) {
        flinch -= dt;
        holder.rotation.z = Math.sin(flinch * 60) * flinch * 0.3;
      } else if (!dead) holder.rotation.z = 0;
      const turn = prevYaw == null || dt <= 0 ? 0 : wrap(s.yaw - prevYaw) / dt;
      prevYaw = s.yaw;
      const motion = { speed: dead ? 0 : (s.speed ?? 0), side: 0, turn: dead ? 0 : turn };
      fig.update(dt, dead ? 0 : (s.move ?? 0), rigged ? motion : undefined);
      if (!gp) return;
      holder.updateMatrixWorld(true);
      fwd.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
      let aimAt = null;
      if (s.at && !dead) {
        // (from about the shoulders)
        dir.set(s.at[0] - s.x, s.at[1] - (s.y + (fig.tall ?? 1.8) * scale * 0.78), s.at[2] - s.z);
        if (dir.lengthSq() > 1e-6) aimAt = dir.normalize();
      }
      gp.set(dt, { aim: dead ? 0 : (s.aim ?? 0), dir: aimAt, forward: fwd, up: UP });
    },
    flinch() {
      if (dead) return;
      flinch = 0.25;
      fig?.pose?.('hit');
    },
    fall(clip = 'die') {
      if (dead) return;
      dead = true;
      down = 0;
      posed = clip;
      fig?.pose?.(clip);
    },
    rise() {
      dead = false;
      down = 0;
      posed = null;
      flinch = 0;
      fig?.pose?.(null);
      holder.rotation.set(0, holder.rotation.y, 0);
    },
    get dead() {
      return dead;
    },
    get down() {
      return down;
    },
    // where a shot leaves from: the muzzle, the gun kicking (null with no gun in hand)
    muzzle() {
      if (!gp || !holder.visible) return null;
      const r = gp.fire();
      return [r.muzzle.x, r.muzzle.y, r.muzzle.z];
    },
    dispose() {
      gone = true;
      gp?.dispose();
      fig?.dispose?.();
      holder.removeFromParent();
    },
  };
}
