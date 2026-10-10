// Where a figure is hit, by the game's capsules: a bones.json set
// (SkeletonCollisionData: a capsule per bone, CapsuleOffset in the bone's
// frame, CapsuleLength along the bone's BoneAxis, CapsuleRadius, the bone's
// AnimationHitReactionType, hi- and low-LOD sets) laid on a figure whose
// skeleton carries the game's bone names (lane 1's heroes: Head, Spine,
// Spine1, Neck, LeftForeArm, …). Each capsule starts at the offset and runs
// its length along the axis (the soldier's forearm, 0.25 m, from elbow to
// wrist; the head's on the head), scaled as the bone's world matrix is.
// A Meshy figure (Spine01, neck, head_end) is not on the game's skeleton:
// it gets hurtbox.js's ten regions from its own bones.
//
//   isGameSkeleton(bones) → bool
//   capsulesOf(bones, set, { lod = 'hi' }) → [{ a, b, r, region, reaction }]
//     bones: { name: { matrixWorld } } (a three.js Bone, or { matrixWorld:
//     { elements: [16, column-major] } }); in bolt.js's body form (a, b
//     the ends, r the radius), `region` the bone, `reaction` the game's
//     hit reaction (HRT_Head, …)
//   regionsOf(bones, regions = hurtbox's REGIONS) → [{ a, b, r, region }]
//   figureCapsules(bones, set, opts) → the game's capsules on the game's
//     skeleton, else regionsOf (what bolt.js and blade.js test against)
//   regionOf(reaction) → 'head' | 'chest' | 'limb' (the damage path's rule)
// Pure: plain arrays, no three.js.

import { REGIONS } from './hurtbox';

const els = (bone) => bone?.matrixWorld?.elements ?? null;

// the point p (in the bone's frame) in the world
function apply(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}

// how much the bone's frame is scaled (its columns' mean length), for the radius
const scaleOf = (m) => (Math.hypot(m[0], m[1], m[2]) + Math.hypot(m[4], m[5], m[6]) + Math.hypot(m[8], m[9], m[10])) / 3;

export function isGameSkeleton(bones) {
  return !!(bones?.Head && bones.Spine && (bones.Spine1 || bones.Spine2 || bones.Neck) && !bones.Spine01 && !bones.head_end);
}

export function capsulesOf(bones, set, { lod = 'hi' } = {}) {
  const out = [];
  for (const c of set?.bones ?? []) {
    if (!(c.radius > 0) || !(lod === 'low' ? c.lowLod : c.hiLod)) continue;
    const m = els(bones[c.bone]);
    if (!m) continue;
    const o = c.offset ?? [0, 0, 0];
    const e = [o[0], o[1], o[2]];
    e[c.axis ?? 0] += c.length ?? 0;
    out.push({ a: apply(m, o), b: apply(m, e), r: c.radius * scaleOf(m), region: c.bone, reaction: c.reaction ?? null });
  }
  return out;
}

export function regionsOf(bones, regions = REGIONS) {
  const out = [];
  for (const [region, { bones: [from, to], r }] of Object.entries(regions)) {
    const ma = els(bones[from]);
    const mb = els(bones[to]);
    if (!ma || !mb) continue;
    out.push({ a: [ma[12], ma[13], ma[14]], b: [mb[12], mb[13], mb[14]], r: r * scaleOf(ma), region });
  }
  return out;
}

export function figureCapsules(bones, set, opts) {
  return set && isGameSkeleton(bones) ? capsulesOf(bones, set, opts) : regionsOf(bones);
}

export function regionOf(reaction) {
  if (reaction === 'HRT_Head') return 'head';
  if (reaction === 'HRT_Body' || reaction === 'HRT_Chest') return 'chest';
  return 'limb';
}
