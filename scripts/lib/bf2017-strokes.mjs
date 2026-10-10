// A hero's lightsaber combat as Star Wars Battlefront II (2017) has it,
// measured from the game's own clips into a stroke table: each strike in the
// game's chain with its contact window, the way it cuts and the plane it
// sweeps, its root travel and its way back to the guard; the blocks by the
// side they turn a stroke to, the reactions to being blocked, the staggers,
// the dodges, the dash and the jump attack, the defeat. The table is data
// the site's combat rules read (src/components/galaxy/surface/stanceFromTable.js):
// nothing in it is typed by hand but the generic names a hero's set falls
// back on. Pure: three.js objects and arrays in, numbers and names out; the
// fetch and the files are scripts/bf2017-strokes.mjs's.
//
// The blade's tip is timed on the game's weapon socket: Wep_Root (under
// Spine2) carries the hilt, and the game models its hilts up the socket's +y
// with the grip at its origin, so the tip is the socket plus a blade's
// length along its +y (measured on Luke's guard, L_Luke_Stand_Idle_01: +y
// at 0.76, 0.64, 0.13, up and across). The window is ual-bake.mjs's
// contactWindow over that tip, carried by the clip's root travel (a thrust
// lands with the lunge, the blade still in the hands), counting only the
// frames where the tip is before the hips on the way the figure goes (+z,
// its root's way), and the frame before it too (a frame's speed is from the
// one before), and none inside the clip's first key: the game blends into a
// strike, so its first key is the guard and its second already the wind-up,
// a jump as fast as the cut that a window counting it lands on (ual-bake's
// rule, 0.15 m along +z, does: Luke's Strike1 at [0.05, 0.093]; along the
// hips' own facing does worse, the game's guard holding them 50° to 170°
// round). `settle` is when the blade comes to rest after the cut: the game
// holds the pose there for the chain's next input, so the clip runs on.
//
//   classify(name) → { hero, kind, index, variant, dir? }  (kind: strike | return | block | blocked | stagger | dodge |
//                    dash | jump | force | defeat | locomotion | other)
//   rigOf(doc) → { scene, objs }: a clip document's skeleton (gltf-transform) as three.js objects at rest
//   clipOf(anim) → { name, channels, end, traj, extras }: its channels by node name, the trajectory kept apart
//   measure(clip, rig, { fps, blade, ahead }) → { duration, contact, settle, dir, plane, root, tipPath ([t, x, y, z, ahead?]) }
//   tableFor(hero, clips) → the stroke table (clips: [{ name, site?, duration?, contact?, dir?, plane?, root? }])
//   settleAfter(rows, after, end) → seconds
//   AHEAD, BLADE, GENERIC, SETTLE

import * as THREE from 'three';
import { contactWindow, rootTravel } from '../ual-bake.mjs';

export const BLADE = 1; // metres out of the socket the tip is timed at (ual-bake's: a blade's length)
export const AHEAD = 0; // metres before the hips (along +z) the tip must be for a frame to count toward the window
export const SETTLE = 2; // m/s: the tip slower than this for a tenth of a second after the cut is at rest
// the game's helpers no measure reads, moved apart from the body: the
// trajectory carries the figure (root travel, measured on its own), the rest
// are cameras and targets
const DROP = /^(Reference|AITrajectory|Trajectory|TrajectoryEnd|CameraBase|CameraJoint|Camera3pDefPos_Rig|Camera3p_Rig|TrajChildDummy|TrajChildDummyCam|Wep_Aim_Target_Rig|Connect|ConnectEnd|Ground)$/;
const TRAJ = 'AITrajectory';
const PATHS = {
  translation: 'position',
  rotation: 'quaternion',
  scale: 'scale',
};

// what a hero's set falls back on where it has nothing of its own: the
// game's generic humanoid (A_HM_*), never a clip from another library
export const GENERIC = {
  dodges: {
    back: 'A_HM_Rifle_Dodge_Back_01',
    front: 'A_HM_Rifle_Dodge_Front_01',
    left: 'A_HM_Rifle_Dodge_Left_01',
    right: 'A_HM_Rifle_Dodge_Right_01',
  },
  staggers: {
    front: ['A_HM_Rifle_Stagger_Bwd_01'],
    back: ['A_HM_Rifle_Stagger_Fwd_01'],
  },
  defeat: 'A_HM_Death_Stand_Front_Melee_02',
};

const num = (s) => (s == null ? 1 : Number(s));
const low = (s) => s.toLowerCase();

// ── names ──

export function classify(name) {
  const m = /^(?:A|L|C|P)_([A-Za-z]+)_(.*)$/.exec(name);
  const hero = m ? low(m[1]) : null;
  const rest = m ? m[2] : name;
  const out = (kind, more = {}) => ({
    hero,
    kind,
    index: more.index ?? 1,
    variant: more.variant ?? 1,
    ...(more.dir ? { dir: more.dir } : {}),
  });
  let r;
  // (a return names its strike: Strike3_V2_BackToIdle, Strike4_V2_BackToIdle 1, Strike1_BackToIdle_02)
  if ((r = /AttackLoop_Strike(\d+)(?:_V(\d+))?_BackToIdle/.exec(rest))) return out('return', { index: num(r[1]), variant: num(r[2]) });
  // (Grievous's carry a take after them: Strike3_01)
  if ((r = /AttackLoop_Strike(\d+)(?:_V(\d+))?(?:_\d\d)?$/.exec(rest))) return out('strike', { index: num(r[1]), variant: num(r[2]) });
  if ((r = /LightAttack_Blocked_(?:(?:Left|Right)_)?(\d+)/.exec(rest))) return out('blocked', { index: num(r[1]) });
  if (/Choke|Force|MindTrick|RagePowerUp|CatchSaber|Lightning/.test(rest)) return out('force');
  if ((r = /Block(?:Saber)?_(?:Swing)?(Left|Right)(?:_(\d+))?/.exec(rest))) return out('block', { dir: low(r[1]), variant: num(r[2]) });
  if ((r = /Block_Stagger(?:_Fwd)?(?:_(\d+))?/.exec(rest))) return out('block', { variant: num(r[1]) });
  // (Luke's Stagger_Front is the others' Stagger_Bwd: hit from the front, a step back)
  if ((r = /^Stagger_(Front|Bwd|Back|Fwd)(?:_(\d+))?$/.exec(rest)))
    return out('stagger', {
      dir: r[1] === 'Front' || r[1] === 'Bwd' ? 'front' : 'back',
      variant: num(r[2]),
    });
  if ((r = /Dodge_(Back|Front|Left|Right)(?:_(\d+))?/.exec(rest))) return out('dodge', { dir: low(r[1]), variant: num(r[2]) });
  if (/SaberDash|^Dash_/.test(rest)) return out('dash');
  if (/Jump_SaberAttack/.test(rest)) return out('jump');
  if (/^Defeated/.test(rest)) return out('defeat');
  if (/(Stand_)?(Walk|Run|Sprint|TinySteps|Idle|IdleLoop)|StandTurn|Stand_Turn|Jump_Fwd/.test(rest)) return out('locomotion');
  return out('other');
}

// ── the skeleton and a clip, read ──

export function rigOf(doc) {
  const objs = new Map();
  const make = (n) => {
    const o = new THREE.Object3D();
    o.name = n.getName();
    o.position.fromArray(n.getTranslation());
    o.quaternion.fromArray(n.getRotation());
    o.scale.fromArray(n.getScale());
    objs.set(o.name, o);
    for (const c of n.listChildren()) o.add(make(c));
    return o;
  };
  const scene = new THREE.Group();
  for (const n of doc.getRoot().listScenes()[0].listChildren()) scene.add(make(n));
  scene.updateMatrixWorld(true);
  return { scene, objs };
}

// an accessor's values as numbers: a quantised one (a pack's turns are
// normalized shorts, meshopt's) back to its float range, as glTF defines it
const MAXOF = {
  Int8Array: 127,
  Uint8Array: 255,
  Int16Array: 32767,
  Uint16Array: 65535,
};
export function valuesOf(accessor) {
  const a = accessor.getArray();
  const max = accessor.getNormalized() ? MAXOF[a.constructor.name] : null;
  return max ? Array.from(a, (v) => Math.max(v / max, -1)) : Array.from(a);
}

export function clipOf(anim) {
  const channels = [];
  let traj = null;
  let end = 0;
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode()?.getName();
    const path = ch.getTargetPath();
    if (!node || !PATHS[path]) continue;
    const s = ch.getSampler();
    const times = valuesOf(s.getInput());
    const values = valuesOf(s.getOutput());
    end = Math.max(end, times.at(-1) ?? 0);
    if (node === TRAJ && path === 'translation') traj = { times, values };
    if (!DROP.test(node)) channels.push({ node, path, times, values });
  }
  return {
    name: anim.getName(),
    channels,
    end,
    traj,
    extras: anim.getExtras() ?? {},
  };
}

// ── a clip, measured ──

// the tip (and the socket) through the clip, in place, at `fps`
function tipRows(clip, rig, { fps, blade, ahead, from = 0 }) {
  const tracks = clip.channels
    .filter((c) => rig.objs.has(c.node))
    .map((c) => new (c.path === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack)(`${c.node}.${PATHS[c.path]}`, c.times, c.values));
  const { scene, objs } = rig;
  const wep = objs.get('Wep_Root');
  const hips = objs.get('Hips');
  if (!wep || !hips) throw new Error('not the game’s rig: no Wep_Root or Hips');
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(new THREE.AnimationClip(clip.name ?? 'm', clip.end, tracks)).play();
  const rows = [];
  const q = new THREE.Quaternion();
  // (the way a cut goes is read in the figure's own frame: +z where the clip
  // starts, turned as the hips turn from there)
  let fwdLocal = null;
  const fwd = new THREE.Vector3();
  for (let f = 0, n = Math.round(clip.end * fps); f <= n; f++) {
    action.time = Math.min(clip.end, f / fps);
    mixer.update(0);
    scene.updateMatrixWorld(true);
    const base = wep.getWorldPosition(new THREE.Vector3());
    const tip = new THREE.Vector3(0, 1, 0).applyQuaternion(wep.getWorldQuaternion(q)).multiplyScalar(blade).add(base);
    const h = hips.getWorldPosition(new THREE.Vector3());
    fwdLocal ??= new THREE.Vector3(0, 0, 1).applyQuaternion(hips.getWorldQuaternion(new THREE.Quaternion()).invert());
    fwd.copy(fwdLocal).applyQuaternion(hips.getWorldQuaternion(q)).setY(0).normalize();
    const rel = tip.clone().sub(h);
    // (+x is the figure's left when it faces +z: the left of its facing is up × forward)
    const left = new THREE.Vector3(fwd.z, 0, -fwd.x);
    rows.push({
      t: action.time,
      hand: tip.toArray(),
      base: base.toArray(),
      body: [rel.dot(left), rel.y, rel.dot(fwd)],
      ahead: action.time > from + 1e-6 && rel.z > ahead,
    });
  }
  // (a frame's speed is from the frame before: it counts only when both do,
  // so a tip coming round into the front doesn't bring its run-up with it)
  for (let i = rows.length - 1; i > 0; i--) rows[i].ahead = rows[i].ahead && rows[i - 1].ahead;
  action.stop();
  mixer.uncacheRoot(scene);
  // (back to rest, so the next clip starts from the skeleton, not this one's end)
  for (const [, o] of objs) {
    const r = o.userData.rest;
    o.position.copy(r.p);
    o.quaternion.copy(r.q);
    o.scale.copy(r.s);
  }
  return rows;
}

const sub = (a, b) => a.map((v, i) => v - b[i]);
const round = (v, k = 3) => +v.toFixed(k);

// the way a cut goes inside its window, as the site's DIRS name it: down
// from overhead ('up'), up from below ('rise'), or from a side (the
// figure's own, by the hips' facing, so a strike that turns the body still
// reads as it cuts: a tip moving to its left cuts from the right)
export function strokeDir(rows, [t0, t1]) {
  const inside = rows.filter((r) => r.t >= t0 && r.t <= t1);
  const span = inside.length > 1 ? inside : rows;
  const [dx, dy] = sub(span.at(-1).body, span[0].body);
  if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? 'up' : 'rise';
  return dx > 0 ? 'right' : 'left';
}

// the plane the blade sweeps in its window: the normal of the turn from
// frame to frame of the blade (tip less socket), summed
export function sweepPlane(rows, [t0, t1]) {
  const inside = rows.filter((r) => r.t >= t0 && r.t <= t1);
  const n = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 1; i < inside.length; i++) {
    a.fromArray(sub(inside[i - 1].hand, inside[i - 1].base));
    b.fromArray(sub(inside[i].hand, inside[i].base));
    n.add(a.clone().cross(b));
  }
  if (n.lengthSq() < 1e-9) return [0, 0, 0];
  return n
    .normalize()
    .toArray()
    .map((v) => round(v, 2));
}

// a root row's travel at t, between the rows (metres, the clip's +x and +z)
function travelAt(root, t) {
  if (!root?.length) return [0, 0];
  const i = root.findIndex((r) => r[0] >= t);
  if (i < 0) return root.at(-1).slice(1);
  if (i === 0) return root[0].slice(1);
  const [ta, xa, za] = root[i - 1];
  const [tb, xb, zb] = root[i];
  const k = (t - ta) / Math.max(1e-6, tb - ta);
  return [xa + (xb - xa) * k, za + (zb - za) * k];
}

// the clip's first key after its start (the header says why none before it counts)
function firstKey(clip) {
  const seconds = clip.channels.map((c) => c.times[1]).filter((t) => t > 0);
  return seconds.length ? Math.min(...seconds) : 0;
}

// when the blade comes to rest after the window: the first frame of a tenth
// of a second slower than SETTLE (the clip's end if it never does)
export function settleAfter(rows, after, end) {
  const speed = (i) => Math.hypot(...rows[i].hand.map((v, j) => v - rows[i - 1].hand[j])) / Math.max(1e-6, rows[i].t - rows[i - 1].t);
  const hold = Math.max(1, Math.round(0.1 / Math.max(1e-6, rows[1]?.t - rows[0]?.t || 1)));
  for (let i = 1; i < rows.length - hold; i++) {
    if (rows[i].t < after) continue;
    let still = true;
    for (let k = 0; k < hold && still; k++) still = speed(i + k) < SETTLE;
    if (still) return round(Math.max(after, rows[i - 1].t));
  }
  return round(end);
}

export function measure(clip, rig, { fps = 30, blade = BLADE, ahead = AHEAD } = {}) {
  for (const [, o] of rig.objs)
    o.userData.rest ??= {
      p: o.position.clone(),
      q: o.quaternion.clone(),
      s: o.scale.clone(),
    };
  // (the trajectory's travel where the clip has it; a pack's clip carries it measured, in its extras)
  let root = null;
  if (clip.traj) {
    const tr = clip.traj;
    root = rootTravel(tr.times.map((t, i) => ({ t, at: tr.values.slice(i * 3, i * 3 + 3) })));
  } else if (clip.extras?.root) root = clip.extras.root;
  if (root && !root.some(([, x, z]) => Math.hypot(x, z) > 0.01)) root = null;
  const rows = tipRows(clip, rig, { fps, blade, ahead, from: firstKey(clip) });
  // the tip where it goes, the body's travel with it: a thrust's blade moves
  // little in the hands, and lands with the lunge
  const moving = rows.map((r) => {
    const [x, z] = travelAt(root, r.t);
    return { ...r, hand: [r.hand[0] + x, r.hand[1], r.hand[2] + z] };
  });
  const contact = contactWindow(moving);
  return {
    duration: round(clip.end),
    contact,
    settle: settleAfter(moving, contact[1], clip.end),
    dir: strokeDir(rows, contact),
    plane: sweepPlane(rows, contact),
    root: root && root.map(([t, x, z]) => [round(t), round(x), round(z)]),
    tipPath: rows.map((r) => [round(r.t), ...r.hand.map((v) => round(v)), r.ahead ? 1 : 0]),
  };
}

// ── the table ──

const variantOrder = (a, b) => a.c.index - b.c.index || a.c.variant - b.c.variant;

export function tableFor(hero, clips) {
  const all = clips.map((k) => ({ k, c: classify(k.name) })).filter(({ c }) => c.hero === null || c.hero === low(hero) || c.hero === 'hm');
  const of = (kind, f = () => true) => all.filter(({ c }) => c.kind === kind && f(c)).sort(variantOrder);
  const returns = of('return');
  const strikes = of('strike').map(({ k, c }) => {
    const back = returns.find(({ c: r }) => r.index === c.index && r.variant === c.variant);
    return {
      name: k.name,
      ...(k.site ? { site: k.site } : {}),
      index: c.index,
      variant: c.variant,
      duration: k.duration ?? null,
      contact: k.contact ?? null,
      settle: k.settle ?? null,
      dir: k.dir ?? null,
      plane: k.plane ?? null,
      root: k.root ?? null,
      return: back ? back.k.name : null,
      returnDuration: back?.k.duration ?? null,
      ...(back?.k.site ? { returnSite: back.k.site } : {}),
    };
  });
  const names = (kind, f) => of(kind, f).map(({ k }) => k.name);
  // a block turns a stroke to one side; a hero without the side blocks with what it has
  const anyBlock = names('block', (c) => !c.dir)[0] ?? names('block')[0] ?? names('blocked')[0] ?? null;
  const side = (d) => {
    const own = names('block', (c) => c.dir === d);
    return own.length ? own : anyBlock ? [anyBlock] : [];
  };
  const blocked = [1, 2, 3, 4, 5, 6].map((i) => names('blocked', (c) => c.index === i)[0] ?? names('blocked')[0] ?? anyBlock);
  const staggers = {
    front: names('stagger', (c) => c.dir === 'front'),
    back: names('stagger', (c) => c.dir === 'back'),
  };
  if (!staggers.front.length) staggers.front = GENERIC.staggers.front;
  if (!staggers.back.length) staggers.back = GENERIC.staggers.back;
  const dodges = Object.fromEntries(['back', 'front', 'left', 'right'].map((d) => [d, names('dodge', (c) => c.dir === d)[0] ?? GENERIC.dodges[d]]));
  const one = (kind) => {
    const hit = of(kind)[0];
    return hit
      ? {
          name: hit.k.name,
          ...(hit.k.site ? { site: hit.k.site } : {}),
          duration: hit.k.duration ?? null,
          contact: hit.k.contact ?? null,
          dir: hit.k.dir ?? null,
          root: hit.k.root ?? null,
        }
      : null;
  };
  return {
    hero: low(hero),
    strikes,
    blocks: { left: side('left'), right: side('right'), any: anyBlock },
    blocked,
    staggers,
    dodges,
    dash: one('dash'),
    jump: one('jump'),
    defeat: names('defeat')[0] ?? GENERIC.defeat,
    idle: all.find(({ k, c }) => c.kind === 'locomotion' && /Stand_Idle_01$|StandIdle_01$|Stand_IdleLoop_01$/.test(k.name))?.k.name ?? null,
  };
}
