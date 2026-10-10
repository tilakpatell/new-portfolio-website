// A level's material grid (the 2017 game's `MaterialGridData`, one per
// level: data/Levels/MP/<Level>/<Level>/materialgrid_win32) read into the
// rulebook src/data/bf2017/physics/materials.json: for each material index
// the level's shapes use, its physics properties, and for each pair of that
// surface with what struck it (a blaster bolt, a grenade, a soldier's foot)
// the impact effect by speed, the sound, the decal and the footprint.
//
// How the grid is laid out (read off Hoth's, 2026-10-10):
//   - a shape's material slot packs its index in bits 12..19 (the exporter's
//     tool/PhysicsExport.cs; `physics.jsonl` has it as `materials[].index`);
//   - `MaterialIndexMap[index]` is that index's row (256 entries; an index the
//     level never declares maps to row 0, the default's);
//   - `MaterialProperties[row]` the material's own properties (here only
//     `MaterialPropertyPhysicsData` is read), `InteractionGrid[row].Items[col]`
//     a pair's relations, each a `$ref` into the asset's `objects`;
//   - the grid is almost symmetric (330 of 24,649 cells differ on Hoth): a
//     pair is read from the striker's row first, its transpose if empty.
// Material names are not in the data: `name` is a hand column, read off the
// blaster's effect on that surface (FX_Impact_Blaster_Metal → metal), and the
// strikers (`BY`) are named by hand from their effects too
// (FX_Grenade_ThermalDetonator_* → thermal); NOTES.md says so.
//
// pairOf(asset, a, b) → { effects, sound, decal, exitDecal, footprint, terrainDestruction, penetration, at } | null
// physicsOf(asset, index) → { dynamicFriction, staticFriction, restitution, … } | null
// nameFromEffect(effect) → 'metal' | 'snow' | … | null
// materialRulebook(asset, usedIndices, { by, level }) → the rulebook (with `_source`s)
// cutGrid(asset, indices) → a smaller asset holding only those indices' rows (the fixture)

export const GRID = 'MaterialGridData';

// What strikes a surface, by its material index (hand: each named from its
// pairs' effects on Hoth's grid; the projectiles' own blueprints say which
// material they carry, which lane P2's rulebook can confirm).
export const BY = {
  blaster: 5, // FX_Impact_Blaster_<Surface>
  heavy: 37, // FX_Impact_Blaster_<Surface>_M
  strong: 119, // FX_Impact_Blaster_Strong_Generic
  ion: 146, // FX_Impact_Blaster_IoN
  fast: 197, // FX_Impact_Blaster_M_Fast_<Surface>
  bowcaster: 202, // FX_Impact_Bowcaster_<Surface>
  thermal: 145, // FX_Grenade_ThermalDetonator_<Surface>_Explosion
  impactGrenade: 149, // FX_Grenade_ImpactGrenade_<Surface>_Explosion
  saberThrow: 126, // FX_Lightsaber_Saberthrow_Impact
  foot: 3, // FX_FootStep_Soldier_<Surface>
  walkerFoot: 82, // FX_FootStep_ATST_<Surface>_Decal_01
};

const short = (ref) => (ref?.$asset ? ref.$asset.split('/').pop() : null);
const rootOf = (asset) => asset.objects.find((o) => o.$type === GRID) ?? asset.objects[0];
const rowOf = (root, index) => root.MaterialIndexMap?.[index] ?? index;
const cell = (root, a, b) => root.InteractionGrid[rowOf(root, a)]?.Items?.[rowOf(root, b)];
const refsOf = (item) => [...(item?.PhysicsMaterialProperties ?? []), ...(item?.PhysicsPropertyProperties ?? [])];

// The pair of material `a` (struck) with `b` (striking): the striker's row
// first, then the transpose. `at` says which cell it came from.
export function pairOf(asset, a, b) {
  const root = rootOf(asset);
  const O = asset.objects;
  for (const [r, c] of [
    [b, a],
    [a, b],
  ]) {
    const item = cell(root, r, c);
    const refs = refsOf(item);
    if (!refs.length) continue;
    const out = { effects: [], sound: null, decal: null, exitDecal: null, footprint: null, terrainDestruction: null, penetration: null, at: [rowOf(root, r), rowOf(root, c)] };
    let useful = false;
    for (const ref of refs) {
      const o = O[ref.$ref];
      if (!o) continue;
      switch (o.$type) {
        case 'MaterialRelationEffectData':
          for (const e of o.ImpactEffects ?? []) {
            const effect = short(e.Effect);
            if (effect) out.effects.push({ min: e.MinSpeed, max: e.MaxSpeed, effect });
          }
          break;
        case 'MaterialRelationSoundData':
          out.sound = short(o.ImpactSound) ?? short(o.ImpactSoundEvent) ?? out.sound;
          break;
        case 'MaterialRelationDecalData':
          out.decal = short(o.Decal);
          out.exitDecal = short(o.ExitDecal);
          break;
        case 'MaterialRelationFootPrintData':
          out.footprint = short(o.DecalParticleEffect);
          break;
        case 'MaterialRelationTerrainDestructionData':
          out.terrainDestruction = short(o.DynamicDecalTemplate);
          break;
        case 'MaterialRelationDamageData':
          out.penetration = o.DamagePenetrationMultiplier ?? null;
          continue; // (every cell has one: not on its own a reason to keep the pair)
        default:
          continue;
      }
      useful = true;
    }
    if (useful && (out.effects.length || out.sound || out.decal || out.footprint || out.terrainDestruction)) return out;
  }
  return null;
}

export function physicsOf(asset, index) {
  const root = rootOf(asset);
  const props = root.MaterialProperties?.[rowOf(root, index)];
  for (const ref of refsOf(props)) {
    const o = asset.objects[ref.$ref];
    if (o?.$type !== 'MaterialPropertyPhysicsData') continue;
    return {
      dynamicFriction: o.DynamicFriction,
      staticFriction: o.StaticFriction,
      restitution: o.Restitution,
      dynamicFrictionModifier: o.DynamicFrictionModifier,
      staticFrictionModifier: o.StaticFrictionModifier,
      resistance: o.Resistance,
    };
  }
  return null;
}

// A surface's name from what a blaster bolt does to it (hand rule):
// FX_Impact_Blaster_Metal_WeakSpot → 'metal weakspot', _FFloor_PineDry → 'pine floor'.
export function nameFromEffect(effect) {
  const m = /^FX_Impact_Blaster_(.+)$/.exec(effect ?? '');
  if (!m) return null;
  return m[1]
    .replace(/^FFloor_?/, 'Floor_')
    .split('_')
    .filter(Boolean)
    .map((w) => w.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase())
    .join(' ')
    .replace(/^floor (.+)$/, '$1 floor')
    .replace(/pine dry/, 'pine');
}

// The rulebook for one level. `usedIndices` the material indices its shapes
// use (the default's is always in); `by` the strikers.
export function materialRulebook(asset, usedIndices, { by = BY, level = null } = {}) {
  const root = rootOf(asset);
  const name = asset.name ?? root.Name ?? 'materialgrid';
  const src = (path) => `${name}#${GRID}.${path}`;
  const def = root.DefaultMaterialIndex ?? 0;
  const surfaces = [...new Set([def, ...usedIndices])].sort((x, y) => x - y);
  const book = {
    level,
    from: name,
    default: def,
    default_source: src('DefaultMaterialIndex'),
    by: { source: 'hand', ...by },
    materials: {},
    pairs: {},
  };
  for (const i of surfaces) {
    const row = rowOf(root, i);
    const blaster = pairOf(asset, i, by.blaster ?? BY.blaster);
    const fromEffect = blaster?.effects[0]?.effect ?? null;
    const physics = physicsOf(asset, i);
    let called = nameFromEffect(fromEffect) ?? (i === def ? 'default' : 'unnamed');
    // (a generic puff on a surface whose scorch is metal's: generic metal)
    const decal = /^Decal_([A-Za-z]+)_Blaster$/.exec(blaster?.decal ?? '')?.[1]?.toLowerCase();
    if (called === 'generic' && decal && decal !== 'concrete') called = `generic ${decal}`;
    const m = { row, row_source: src(`MaterialIndexMap[${i}]`), name: called, nameFrom: [fromEffect, blaster?.decal].filter(Boolean).join(' + ') || null, nameSource: 'hand' };
    if (physics) {
      m.physics = {};
      for (const [k, v] of Object.entries(physics)) {
        m.physics[k] = v;
        m.physics[`${k}_source`] = src(`MaterialProperties[${row}].MaterialPropertyPhysicsData.${k[0].toUpperCase()}${k.slice(1)}`);
      }
    }
    book.materials[i] = m;
    for (const [who, j] of Object.entries(by)) {
      const p = pairOf(asset, i, j);
      if (!p) continue;
      const at = `InteractionGrid[${p.at[0]}].Items[${p.at[1]}]`;
      const pair = { by: who };
      if (p.effects.length)
        pair.effects = p.effects.map((e, k) => ({
          effect: e.effect,
          min: e.min,
          min_source: src(`${at}.MaterialRelationEffectData.ImpactEffects[${k}].MinSpeed`),
          max: e.max,
          max_source: src(`${at}.MaterialRelationEffectData.ImpactEffects[${k}].MaxSpeed`),
        }));
      for (const k of ['sound', 'decal', 'exitDecal', 'footprint', 'terrainDestruction']) if (p[k]) pair[k] = p[k];
      if (p.penetration != null && p.penetration !== 1) {
        pair.penetration = p.penetration;
        pair.penetration_source = src(`${at}.MaterialRelationDamageData.DamagePenetrationMultiplier`);
      }
      book.pairs[`${i},${j}`] = pair;
    }
  }
  return book;
}

// The material indices a level's meshes use: the `physics.jsonl` records
// named by the map manifest's meshes (models/<path>_mesh.glb →
// <path>_physics_win32, case aside), each record's declared slots.
// → [[index, records declaring it]] most first.
export function usedIndicesOf(manifest, records) {
  const want = new Set((manifest.meshes ?? []).map((m) => `${m.file.toLowerCase().replace(/^models\//, '').replace(/_mesh\.glb$/, '')}_physics_win32`));
  const count = new Map();
  for (const r of records) {
    if (!want.has((r.res ?? r.name ?? '').toLowerCase())) continue;
    for (const i of new Set((r.materials ?? []).map((m) => m.index))) count.set(i, (count.get(i) ?? 0) + 1);
  }
  return [...count].sort((x, y) => y[1] - x[1] || x[0] - y[0]);
}

// The fixture: the asset cut to the rows of `indices` (the map kept, every
// other index pointing at the default's row, as an undeclared index does),
// each kept cell's relations re-numbered into a short `objects`.
export function cutGrid(asset, indices) {
  const root = rootOf(asset);
  const keep = [...new Set([root.DefaultMaterialIndex ?? 0, ...indices])];
  const rows = [...new Set(keep.map((i) => rowOf(root, i)))].sort((x, y) => x - y);
  const newRow = new Map(rows.map((r, k) => [r, k]));
  const objects = [null];
  const seen = new Map();
  const take = (ref) => {
    if (!seen.has(ref.$ref)) {
      seen.set(ref.$ref, objects.length);
      objects.push(asset.objects[ref.$ref]);
    }
    return { $ref: seen.get(ref.$ref) };
  };
  const item = (it) => ({ PhysicsMaterialProperties: (it?.PhysicsMaterialProperties ?? []).map(take), PhysicsPropertyProperties: (it?.PhysicsPropertyProperties ?? []).map(take) });
  const cut = {
    $type: GRID,
    Name: root.Name,
    DefaultMaterial: root.DefaultMaterial,
    DefaultMaterialIndex: root.DefaultMaterialIndex,
    MaterialIndexMap: root.MaterialIndexMap.map((r, i) => (keep.includes(i) ? newRow.get(r) : 0)),
    MaterialProperties: rows.map((r) => item(root.MaterialProperties[r])),
    InteractionGrid: rows.map((r) => ({ Items: rows.map((c) => item(root.InteractionGrid[r].Items[c])) })),
  };
  objects[0] = cut;
  return { name: asset.name, type: asset.type, root: 0, cut: { from: asset.name, indices: keep }, objects };
}
