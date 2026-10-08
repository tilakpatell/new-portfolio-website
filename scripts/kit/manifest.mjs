// A kit pack's manifest, public/kit/<pack>/index.json: what each model is,
// which family file holds it, its parts and size, and each material by name,
// so the loader (src/lib/three/kit.js) and the placers know a model without
// opening its GLB, and the check (scripts/kit-check.mjs) can hold every file
// to its budget. scripts/kit/import.mjs gathers the numbers and writes it;
// the reading of them is here, pure, and tested (manifest.test.mjs).
// Schema: docs/superpowers/specs/2026-10-08-kit-worlds-design.md, "The kit
// pipeline", and scripts/kit/README.md.
//
//   buildManifest(pack, families, { title }) → { pack, licence, source, models, materials }
//     families: [{ family, file, models, materials }]
//       models: [{ name, positions, parts: [{ part, material, tris, tris1? }], rig? }]
//       materials: { [name]: { leaf, wind, worn?, maps: { colour: [w, h], normal?: [w, h] }, pixels?: { rgba, w, h } } }
//   checkManifest(manifest, files: { [file]: bytes }) → string[]   (empty when clean)
//   sortByName(object) → object   (its keys in name order)
//   BUDGET = { file, tree, lod1 }

import { boundsOf, kindOf, tonesOf } from './lib.mjs';

// What a kit file may cost: a family GLB's bytes, a tree's triangles, and
// its LOD1's share of them (the spec's budgets; any other model's LOD1 need
// only be no heavier than the model: a petal of 13 triangles can't lose 60 %).
export const BUDGET = { file: 1.5 * 1048576, tree: 15000, lod1: 0.4 };

// The kinds a material bends with in the wind (foliage.js's WIND): anything
// a tree wears sways as a tree, its bark with its crown; low growing things
// as a shrub; the rest stands still.
const SHRUBS = new Set(['bush', 'grass', 'plant', 'flower']);

const round = (x, places) => Number(x.toFixed(places));
const size = ([w, h]) => `${w}x${h}`;
// (models and materials by name, so a partial import's merge reads the same)
export const sortByName = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

// The manifest of the families just imported. A model's kind is its family's
// (kindOf), or a character when it carries a rig; its footprint and trunk
// come from its positions (boundsOf); a tree or a bush takes its two far
// tones from the leaf map its biggest leaf part wears (tonesOf). A material
// shared by several families is described once: a mask when it is a leaf,
// bending as the tallest thing that wears it, but only if its geometry
// carries the wind weight (`wind`: the parts painted with _WIND). `worn`
// adds the kinds of models in the pack that wear it but are not imported
// this time, so a family imported on its own bends as it did with the rest.
export function buildManifest(pack, families, { title = pack } = {}) {
  const defs = {};
  const kinds = {};
  const models = {};
  for (const { family, file, models: list, materials } of families) {
    Object.assign(defs, materials);
    for (const model of list) {
      const kind = model.rig ? 'character' : kindOf(model.name, pack);
      const { radius, height, trunk } = boundsOf(model.positions);
      const entry = {
        family,
        file,
        parts: model.parts.map((p) => p.part),
        tris: model.parts.reduce((n, p) => n + p.tris, 0),
        tris1: model.parts.some((p) => p.tris1 == null) ? null : model.parts.reduce((n, p) => n + p.tris1, 0),
        radius: round(radius, 3),
        height: round(height, 3),
        trunk: round(trunk, 3),
        kind,
      };
      const crown = model.parts.filter((p) => p.part === 'leaves').sort((a, b) => b.tris - a.tris)[0];
      const pixels = crown && materials[crown.material]?.pixels;
      if ((kind === 'tree' || kind === 'bush') && pixels) {
        entry.tones = tonesOf(pixels.rgba, pixels.w, pixels.h).map((c) => c.map((x) => round(x, 4)));
      }
      if (model.rig) entry.rig = model.rig;
      models[model.name] = entry;
      for (const p of model.parts) (kinds[p.material] ??= new Set()).add(kind);
    }
  }

  const materials = {};
  for (const name of Object.keys(defs).sort()) {
    if (!kinds[name]) continue;
    const { leaf, wind, maps } = defs[name];
    const worn = new Set([...kinds[name], ...(defs[name].worn ?? [])]);
    materials[name] = {
      alpha: leaf ? 'mask' : 'opaque',
      leaf: Boolean(leaf),
      wind: !wind ? null : worn.has('tree') ? 'tree' : [...worn].some((k) => SHRUBS.has(k)) ? 'shrub' : null,
      maps: Object.fromEntries(Object.entries(maps).map(([slot, wh]) => [slot, size(wh)])),
    };
  }
  return { pack, licence: 'CC0-1.0', source: `Quaternius, ${title} (https://quaternius.com)`, models: sortByName(models), materials };
}

// What is wrong with a manifest and the files beside it: the credit unsaid,
// a model whose file is missing, a file over budget, a tree too heavy, a
// tree's LOD1 that saves too little, any LOD1 heavier than its model.
export function checkManifest(manifest, files) {
  const errors = [];
  if (manifest.licence !== 'CC0-1.0') errors.push(`${manifest.pack}: the licence is not CC0-1.0`);
  if (!manifest.source) errors.push(`${manifest.pack}: no source credited`);
  const used = new Set();
  for (const [name, m] of Object.entries(manifest.models)) {
    if (!(m.file in files)) errors.push(`${name}: its file ${m.file} is missing`);
    else used.add(m.file);
    if (m.kind === 'tree' && m.tris > BUDGET.tree) errors.push(`${name}: a tree of ${m.tris} tris, over ${BUDGET.tree}`);
    if (m.kind === 'tree' && m.tris1 != null && m.tris1 > BUDGET.lod1 * m.tris) {
      errors.push(`${name}: LOD1 ${m.tris1} of ${m.tris} tris (${Math.round((100 * m.tris1) / m.tris)} %), over ${100 * BUDGET.lod1} %`);
    }
    if (m.tris1 != null && m.tris1 > m.tris) errors.push(`${name}: LOD1 ${m.tris1} of ${m.tris} tris, more than the model`);
  }
  for (const file of [...used].sort()) {
    const mb = files[file] / 1048576;
    if (files[file] > BUDGET.file) errors.push(`${file}: ${mb.toFixed(1)} MB, over ${BUDGET.file / 1048576} MB`);
  }
  return errors;
}
