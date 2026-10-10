// The AI rulebook (ai.json), from `AI/BattleAI/**` and the difficulty and
// instant-action settings. The bots' decisions are code in the game's
// executable; what the data holds is their tuning: how far a soldier engages,
// how long it suppresses, where cover is good (scored queries), how bursts are
// paced (firing patterns), how accuracy falls with range (difficulty curves).
//
// Most of these tables are read whole: a group is its numbers by dotted path
// with one `_source` for the object they came from, so lane 1 can read any
// value the game tunes without this module naming each.
//
// A firing pattern's `Pattern` is a 64-bit mask, one bit a frame, fire on a
// set bit, least significant first; it is read from the record's text as a
// BigInt (JSON.parse would round it), signed as the export writes it (-1 is
// all 64 bits), trimmed after the highest set bit.

import { deref, follow, loadText, numbersOf, objectsOf, rootOf, shortName } from './bf2017-ebx.mjs';
import { indexOf } from './bf2017-rulebook.mjs';

const where = (asset, obj) => `${asset.name}#${obj.$type}`;

// An object's numbers, flat by path, with its source.
export function group(asset, obj, depth = 4) {
  if (!obj) return null;
  return { ...Object.fromEntries(numbersOf(obj, { depth })), _source: where(asset, obj) };
}

const lowerFirst = (s) => s[0].toLowerCase() + s.slice(1);
const named = (root, re) => [...indexOf(root).keys()].filter((n) => re.test(n)).sort();

export function patternBits(mask) {
  const bits = [];
  for (let v = BigInt.asUintN(64, BigInt(mask)); v > 0n; v >>= 1n) bits.push((v & 1n) === 1n);
  return bits;
}

function tacticsRow(root, name) {
  const asset = follow(root, name);
  const t = asset && rootOf(asset);
  if (!t) return null;
  const src = (path) => `${asset.name}#SoldierTactics.${path}`;
  const row = {};
  if (t.EngageSettings) row.engage = { distance: t.EngageSettings.DistanceToTarget, suppression: t.EngageSettings.SuppressionValue, _source: src('EngageSettings') };
  if (t.WeaponSuppressionSettings) {
    const w = t.WeaponSuppressionSettings;
    row.suppression = { value: w.SuppressionValue, time: w.ContinuousSuppressionTime, area: w.SuppressionAreaSize, _source: src('WeaponSuppressionSettings') };
  }
  if (t.VehicleSuppressionSettings) {
    const v = t.VehicleSuppressionSettings;
    row.vehicleSuppression = { distance: v.SuppressionDistance, reevaluate: v.ReevaluateCoverDistance, _source: src('VehicleSuppressionSettings') };
  }
  for (const [k, v] of Object.entries(t)) {
    if (k.startsWith('$') || k === 'Name' || ['EngageSettings', 'WeaponSuppressionSettings', 'VehicleSuppressionSettings'].includes(k)) continue;
    const obj = deref(asset, v);
    if (obj) row[lowerFirst(k)] = group(asset, obj);
    else if (v && typeof v === 'object' && !v.$asset && numbersOf(v).length) row[lowerFirst(k)] = { ...Object.fromEntries(numbersOf(v)), _source: src(k) };
  }
  return row;
}

function templateRow(root, name) {
  const asset = follow(root, name);
  const t = asset && rootOf(asset);
  if (!t) return null;
  return {
    targetLostTime: t.TargetLostTime,
    alertPropagationSpeed: t.AlertPropagationSpeed,
    fireHeightOffset: t.FireHeightOffset,
    _source: where(asset, t),
    tactics: t.Tactics?.$asset ? shortName(t.Tactics.$asset) : null,
    melee: t.SoldierMeleeType ?? null,
    projectile: group(asset, deref(asset, t.Projectile)),
    meleeSettings: group(asset, deref(asset, t.Melee)),
    loco: group(asset, deref(asset, t.PhysicsLocoSettings)),
  };
}

// A weapon's AI data: its own numbers and each object it points at, by key.
function weaponRow(root, name) {
  const asset = follow(root, name);
  const w = asset && rootOf(asset);
  if (!w) return null;
  const row = { class: w.FiringWeaponClass ?? null, ...group(asset, w, 2) };
  for (const [k, v] of Object.entries(w)) {
    const obj = deref(asset, v);
    if (obj) row[lowerFirst(k)] = group(asset, obj);
  }
  return row;
}

function patternsOf(root, name) {
  const text = loadText(root, name);
  if (!text) return [];
  const asset = JSON.parse(text);
  const masks = [...text.matchAll(/"Pattern":(-?\d+)/g)].map((m) => m[1]);
  const list = objectsOf(asset, 'FiringPatternCollectionData').flatMap((c) => c.Patterns ?? []);
  return list.map((p, i) => ({
    id: p.Id,
    weapon: String(p.WeaponClass ?? '').replace(/^WeaponClass_/, ''),
    intensity: String(p.Intensity ?? '').replace(/^IntensityClass_/, ''),
    delay: p.Delay,
    single: Boolean(p.SingleShot),
    mask: masks[i],
    bits: patternBits(masks[i] ?? '0'),
    _source: `${name}#FiringPatternCollectionData.Patterns.${i}`,
  }));
}

// A cover query: its scored terms (a piecewise curve of score over X, X by
// angle or distance) and its filters, every object but the root.
function queryRow(root, name) {
  const asset = follow(root, name);
  if (!asset) return null;
  // (one source for the query: its terms are its own objects)
  const terms = asset.objects
    .filter((o, i) => i !== asset.root && o)
    .map((o) => {
      if (Array.isArray(o.X)) return { term: o.XStyle ?? o.$type, from: o.FromPosition ?? null, to: o.ToPosition ?? null, x: o.X, score: o.Score };
      // (a curve as its points; a spline's tangents kept, a linear one's are the editor's)
      if (o.$type === 'FloatCurve') {
        const pts = o.Points ?? [];
        const spline = pts.some((pt) => pt.CurveType && pt.CurveType !== 'FloatCurveType_Linear');
        return { term: 'curve', points: pts.map((pt) => [pt.X, pt.Y]), ...(spline ? { spline: true, tangents: pts.map((pt) => [pt.InTangentOffsetX, pt.InTangentOffsetY, pt.OutTangentOffsetX, pt.OutTangentOffsetY]) } : {}) };
      }
      return { term: o.$type, ...Object.fromEntries(numbersOf(o)) };
    });
  return { terms, _source: `${name}#CoverQueryData` };
}

// The difficulty settings: per difficulty and game type, its numbers and the
// float curves its AI data holds (accuracy over distance and the like).
function difficultyOf(root, name) {
  const asset = follow(root, name);
  if (!asset) return {};
  const out = {};
  for (const ref of rootOf(asset).Difficulties ?? []) {
    const d = deref(asset, ref);
    if (!d) continue;
    const curves = {};
    const walk = (v, path, depth) => {
      if (!v || typeof v !== 'object' || depth < 0) return;
      const obj = typeof v.$ref === 'number' ? deref(asset, v) : v;
      if (obj?.$type === 'FloatCurve' || (Array.isArray(obj?.Points) && obj.Points[0]?.X !== undefined)) {
        if (obj.Points?.length) curves[path] = { points: obj.Points.map((p) => [p.X, p.Y]), _source: `${where(asset, obj)}.Points` };
        return;
      }
      if (typeof v.$ref === 'number' && !obj) return;
      for (const [k, x] of Object.entries(obj ?? {})) if (!k.startsWith('$')) walk(x, path ? `${path}.${k}` : k, depth - 1);
    };
    walk(d.AIData, '', 8);
    let key = `${String(d.Difficulty).replace(/^Difficulty_/, '')}:${String(d.GameType).replace(/^PersistenceGameType_/, '')}`;
    if (key in out) key = `${key}:${d.ReadableName || Object.keys(out).length}`;
    out[key] = { ...group(asset, d, 2), name: d.ReadableName || null, curves };
  }
  return out;
}

function instantActionOf(root) {
  const out = {};
  for (const n of named(root, /^Gameplay\/Profiles\/InstantActionParams\/[^/]+$/)) {
    const a = follow(root, n);
    const o = a && rootOf(a);
    if (!o) continue;
    out[shortName(n)] = { items: (o.Items ?? []).map((i) => i.DisplayName ?? null), default: (o.Items ?? []).findIndex((i) => i.Default), default_source: `${n}#${o.$type}.Items` };
  }
  return out;
}

export function aiRulebook(root) {
  const short = (re, fn, key = (n) => shortName(n)) => Object.fromEntries(named(root, re).map((n) => [key(n), fn(root, n)]).filter(([, v]) => v));
  const constants = follow(root, 'AI/BattleAI/Cover/CoverConstants');
  return {
    templates: short(/^AI\/BattleAI\/Templates\/[^/]+_Template$/, templateRow, (n) => shortName(n).replace(/_Template$/, '').toLowerCase()),
    tactics: short(/^AI\/BattleAI\/Tactics\/[^/]+$/, tacticsRow),
    weapons: short(/^AI\/BattleAI\/Weapons\/AI_[^/]+$/, weaponRow),
    patterns: patternsOf(root, 'AI/BattleAI/Weapons/AIFiringPatterns'),
    cover: {
      constants: constants ? group(constants, rootOf(constants), 3) : null,
      zones: Object.fromEntries(named(root, /^AI\/BattleAI\/Cover\/CoverZones\/[^/]+$/).map((n) => {
        const a = follow(root, n);
        if (!a) return [shortName(n), { zones: [], _missing: [`cover zones: ${n}`] }];
        return [shortName(n), { zones: (rootOf(a).Zones ?? []).map((z) => Object.fromEntries(numbersOf(z))), _source: `${n}#CoverZoneDefinition.Zones` }];
      })),
      queries: short(/^AI\/BattleAI\/Cover\/Queries\/[^/]+$/, queryRow),
    },
    difficulty: difficultyOf(root, 'Gameplay/Settings/GameDifficultySettings'),
    instantAction: instantActionOf(root),
  };
}
