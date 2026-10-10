// The physics rulebooks from the Battlefront II (2017) records: the game's
// numbers, each with where it was read, for the site's own solver to run on
// (the design: docs/superpowers/specs/2026-10-10-bf2017-physics-design.md).
// Lane P1 writes the soldier's (`soldierRow`, `soldierRulebook`); lanes P2
// and P3 add their builders here as named exports beside it.
//
// An EBX dump is one asset as JSON: { name, type, guid, root, objects },
// `objects[root]` the asset's own object, every other object reached by
// `{ $ref: i }` (an index into `objects`) and another asset by
// `{ $asset: name }`. `loadAsset` and `deref` are the forty lines lane 0's
// `scripts/lib/bf2017-ebx.mjs` will own; swap them for its exports when it
// is on main (and `SEQUEL` for its `isSequel`).
//
// A CharacterPhysicsData record: the body (Mass, PhysicalRadius,
// MaxAscendAngle, SlideAngle, the ground rays, the swim depths, the jump
// penalty), `Poses` (CharacterPoseData: Height, StepHeight, EyePosition,
// TransitionTimes by PoseType), `States` (OnGround, Jump, InAir, Falling,
// Parachute, Swimming, Climbing, AnimationControlled, Sliding: each its own
// numbers and `PoseInfo`, a CharacterStatePoseInfo per pose: Velocity, the
// SpeedModifier's four constants, the gains, the sprint, the shallow water).
// The walk is OnGround's PoseInfo, not AnimationControlled's (the design's
// survey read the latter: 5.0 and × 1.5; the ground's is 3.8 and × 1.57).
//
// Every number in a row has a `<key>_source` sibling naming
// `<asset>#<Type>.<Property.Path>` (lane 0's rule; the path starts at the
// object of that type the row reads it from); a value the data does not
// give is `{ …, source: 'hand' }` with a line in src/data/bf2017/physics/NOTES.md.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

// the thirteen CharacterPhysicsData records the survey found
export const SOLDIER_RECORDS = [
  'Gameplay/Characters/DefaultSoldierPhysics',
  'Gameplay/Characters/DefaultSoldierPhysics_AI',
  'Gameplay/Characters/DefaultSoldierPhysics_B1Droid',
  'Gameplay/Characters/Heroes/DefaultHeroPhysics',
  'Gameplay/Characters/Heroes/DefaultHeroPhysics_Crouch',
  'Gameplay/Characters/Heroes/DefaultHeroPhysics_Tall',
  'Gameplay/Characters/Heroes/DefaultHeroPhysics_Crouch_Tall',
  'Gameplay/Characters/Heroes/BBHeroPhysics',
  'Gameplay/Characters/Heroes/Droideka/DroidekaPhysics',
  'Gameplay/Characters/AI/Creature/DefaultPillioCreaturePhysics',
  'Gameplay/Kits/Hero/Maul/MaulHeroPhysics',
  'Gameplay/Kits/Hero/Yoda/YodaPhysics',
  'Addons/Mode3/Gameplay/Kits/Specials/Ewok/EwokPhysics',
];

// lane 0's sequel-era names (its Global Constraints), until its isSequel is on main
const SEQUEL = /NewEra|FirstOrder|Resistance|Jakku|Takodana|StarKiller|Crait|Resurgent|Kylo|Rey|Finn|Phasma|BB9E|ep7|ep9/i;
export const isSequel = (name) => SEQUEL.test(name);

// the site's jump where the record gives none (a hero's jump is its ability's; a creature has no jump state)
export const HAND_JUMP = 5.4;

// one asset from <root>/data/<name>.json or .json.gz; null when neither is there
export function loadAsset(root, name) {
  const base = join(root, 'data', name);
  if (existsSync(`${base}.json`)) return JSON.parse(readFileSync(`${base}.json`, 'utf8'));
  if (existsSync(`${base}.json.gz`)) return JSON.parse(gunzipSync(readFileSync(`${base}.json.gz`)).toString('utf8'));
  return null;
}

export const rootOf = (asset) => asset.objects[asset.root];
export function deref(asset, v) {
  if (!v || typeof v !== 'object' || !Number.isInteger(v.$ref)) return null;
  return asset.objects[v.$ref] ?? null;
}

const POSES = { CharacterPoseType_Stand: 'stand', CharacterPoseType_Crouch: 'crouch', CharacterPoseType_Prone: 'prone' };
const poseOf = (type) => POSES[type] ?? type.replace(/^CharacterPoseType_/, '').toLowerCase();
const STATES = {
  OnGroundStateData: 'onGround',
  JumpStateData: 'jump',
  InAirStateData: 'inAir',
  FallingStateData: 'falling',
  ParachuteStateData: 'parachute',
  SwimmingStateData: 'swimming',
  ClimbingStateData: 'climbing',
  AnimationControlledStateData: 'animation',
  SlidingStateData: 'sliding',
};
const stateOf = (type) => STATES[type] ?? type.replace(/StateData$/, '').replace(/^./, (c) => c.toLowerCase());
const camel = (k) => k.replace(/^[A-Z]+(?=[A-Z][a-z]|$)|^[A-Z]/, (c) => c.toLowerCase());
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// a writer over one asset: put(row, key, value, type, path) sets the value and its source
function writer(name) {
  return (row, key, value, type, path) => {
    if (!finite(value) && !(Array.isArray(value) && value.every(finite))) return;
    row[key] = value;
    row[`${key}_source`] = `${name}#${type}.${path}`;
  };
}

// a CharacterStatePoseInfo: the pose's speed and how it gets there
function poseInfoRow(put, info, type, path) {
  const row = {};
  const at = (p) => `${path}.${p}`;
  put(row, 'velocity', info.Velocity, type, at('Velocity'));
  const m = info.SpeedModifier ?? {};
  put(row, 'forward', m.ForwardConstant, type, at('SpeedModifier.ForwardConstant'));
  put(row, 'back', m.BackwardConstant, type, at('SpeedModifier.BackwardConstant'));
  put(row, 'left', m.LeftConstant, type, at('SpeedModifier.LeftConstant'));
  put(row, 'right', m.RightConstant, type, at('SpeedModifier.RightConstant'));
  put(row, 'accelGain', info.AccelerationGain, type, at('AccelerationGain'));
  put(row, 'decelGain', info.DecelerationGain, type, at('DecelerationGain'));
  put(row, 'turnGain', info.DirectionChangeAccelerationGain, type, at('DirectionChangeAccelerationGain'));
  put(row, 'turnThreshold', info.DirectionChangeThreshold, type, at('DirectionChangeThreshold'));
  put(row, 'sprintGain', info.SprintGain, type, at('SprintGain'));
  put(row, 'sprintMultiplier', info.SprintMultiplier, type, at('SprintMultiplier'));
  put(row, 'water', info.ShallowWaterMultiplier, type, at('ShallowWaterMultiplier'));
  return row;
}

// a state: its own numbers (camel-cased) and its PoseInfo by pose
function stateRow(put, asset, state) {
  const type = state.$type;
  const row = {};
  for (const [k, v] of Object.entries(state)) {
    if (k.startsWith('$') || k === 'PoseInfo') continue;
    put(row, camel(k), v, type, k);
  }
  const poses = {};
  (state.PoseInfo ?? []).forEach((ref, i) => {
    const info = deref(asset, ref);
    if (info) poses[poseOf(info.PoseType)] = poseInfoRow(put, info, type, `PoseInfo[${i}]`);
  });
  if (Object.keys(poses).length) row.poses = poses;
  return row;
}

// a CharacterPoseData: the capsule's height, the step, the eye, the transitions
function poseRow(put, pose, i) {
  const type = 'CharacterPhysicsData';
  const path = (p) => `Poses[${i}].${p}`;
  const row = {};
  put(row, 'height', pose.Height, type, path('Height'));
  put(row, 'step', pose.StepHeight, type, path('StepHeight'));
  const e = pose.EyePosition;
  if (e) put(row, 'eye', [e.x, e.y, e.z], type, path('EyePosition'));
  const transitions = {};
  (pose.TransitionTimes ?? []).forEach((t, k) => put(transitions, poseOf(t.ToPose), t.TransitionTime, type, path(`TransitionTimes[${k}].TransitionTime`)));
  row.transitions = transitions;
  return row;
}

// one CharacterPhysicsData asset as the soldier's row (spec §2)
export function soldierRow(asset) {
  const name = asset.name;
  const put = writer(name);
  const r = rootOf(asset);
  const T = 'CharacterPhysicsData';
  const row = { id: name.split('/').pop() };
  put(row, 'mass', r.Mass, T, 'Mass');
  put(row, 'radius', r.PhysicalRadius, T, 'PhysicalRadius');
  put(row, 'ascend', r.MaxAscendAngle, T, 'MaxAscendAngle');
  put(row, 'slide', r.SlideAngle, T, 'SlideAngle');
  put(row, 'slideSpeed', r.SlideSpeedCondition, T, 'SlideSpeedCondition');
  put(row, 'pushWeight', r.PushableObjectWeight, T, 'PushableObjectWeight');
  row.jumpPenalty = {};
  put(row.jumpPenalty, 'time', r.JumpPenaltyTime, T, 'JumpPenaltyTime');
  put(row.jumpPenalty, 'factor', r.JumpPenaltyFactor, T, 'JumpPenaltyFactor');
  row.rays = {};
  put(row.rays, 'groundStart', r.RayStartHeightOnGround, T, 'RayStartHeightOnGround');
  put(row.rays, 'groundEnd', r.RayEndHeightOnGround, T, 'RayEndHeightOnGround');
  put(row.rays, 'airStart', r.RayStartHeightInAir, T, 'RayStartHeightInAir');
  put(row.rays, 'airEnd', r.RayEndHeightInAir, T, 'RayEndHeightInAir');
  put(row.rays, 'movingSpeed', r.SpeedForMovingRayCasts, T, 'SpeedForMovingRayCasts');
  row.ladder = {};
  put(row.ladder, 'angle', r.LadderAcceptAngle, T, 'LadderAcceptAngle');
  put(row.ladder, 'pitch', r.LadderAcceptAnglePitch, T, 'LadderAcceptAnglePitch');
  row.poses = {};
  (r.Poses ?? []).forEach((ref, i) => {
    const p = deref(asset, ref);
    if (p) row.poses[poseOf(p.PoseType)] = poseRow(put, p, i);
  });
  row.states = {};
  for (const ref of r.States ?? []) {
    const s = deref(asset, ref);
    if (s) row.states[stateOf(s.$type)] = stateRow(put, asset, s);
  }
  const swim = row.states.swimming ?? (row.states.swimming = {});
  put(swim, 'enter', r.EnterSwimStateDepth, T, 'EnterSwimStateDepth');
  put(swim, 'exit', r.ExitSwimStateDepth, T, 'ExitSwimStateDepth');
  // the jump: the record's height when it gives one, else the site's speed
  const jump = row.states.jump ?? (row.states.jump = {});
  if (!(jump.jumpHeight > 0)) jump.fallback = { speed: HAND_JUMP, source: 'hand' };
  return row;
}

// the thirteen records, read from <root>/data; the sequel era refused, the missing listed
export function soldierRulebook(root, names = SOLDIER_RECORDS) {
  const rows = {};
  const refused = [];
  const missing = [];
  for (const name of names) {
    if (isSequel(name)) {
      refused.push(name);
      continue;
    }
    const asset = loadAsset(root, name);
    if (!asset || rootOf(asset)?.$type !== 'CharacterPhysicsData') {
      missing.push(name);
      continue;
    }
    const row = soldierRow(asset);
    rows[row.id] = row;
  }
  return { default: 'DefaultSoldierPhysics', rows, refused, missing };
}

// paths of numeric leaves with neither a `_source` sibling nor `source: 'hand'`
// on an ancestor (copied into src/data/bf2017/physics/rulebook.test.js, which
// imports nothing from scripts)
export function checkSources(json, path = '', hand = false) {
  const bad = [];
  if (!json || typeof json !== 'object') return bad;
  const isHand = hand || json.source === 'hand';
  for (const [k, v] of Object.entries(json)) {
    if (k.endsWith('_source')) continue;
    const here = path ? `${path}.${k}` : k;
    const numeric = finite(v) || (Array.isArray(v) && v.length && v.every(finite));
    if (numeric) {
      if (!isHand && !Array.isArray(json) && typeof json[`${k}_source`] !== 'string') bad.push(here);
    } else if (v && typeof v === 'object') bad.push(...checkSources(v, here, isHand));
  }
  return bad;
}
