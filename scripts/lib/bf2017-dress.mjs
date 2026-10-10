// The maps a bare material wears (the fifth design, lane O). Many of the
// drop's meshes name no texture at all: their shader preset binds the maps
// (the roots' `SS_ForestBase_Roots_01`, the clouds' `SS_ForestBase_
// BackdropCloud_01`), and neither the GLB nor the export's material dump
// (web/materials.jsonl) carries that binding; the presets' records are not
// uploaded. The maps themselves are in the drop, named for the shader's
// stem (`T_ForestBase_Roots_01_C`, `T_MS_ForestBase_Fern_01_C`) or kept in
// its folder, so a bare material is dressed by the shader's name: its
// colour map, and the normal beside it, from what the bucket holds.
//
//   stemOf(shader) → 'ForestBase_Roots_01' ('Objects/…/SS_ForestBase_Roots_01')
//   dressingOf(materials, { names, uploaded }) → { 'shader:<shader>': [{ slot,
//     name }] } for each material of the dump's row with no textures whose
//     maps resolve; `names` the drop's texture names (textures.jsonl),
//     `uploaded(name, slot)` whether the bucket holds the map as the import
//     reads it (a colour map's KTX2; a normal's derived `__normal` KTX2)
//   textureArg(dressing) → the same as the import's --textures text

const COLOUR = ['_c', '_cs', '_ca', '_cn', '_cnsa', '_cw'];
const NORMAL = ['_n', '_ns', '_nm', '_nam', '_noh', '_na', '_nom'];
const PREFIXES = ['t_', 't_ms_'];

export const stemOf = (shader) =>
  String(shader ?? '')
    .split('/')
    .pop()
    .replace(/^(SS|SP|MS|SH)_/i, '');

const folderOf = (path) => path.slice(0, path.lastIndexOf('/')).toLowerCase();
const baseOf = (path) => path.slice(path.lastIndexOf('/') + 1).toLowerCase();

// the drop's texture names, by their last segment and by their folder
function indexNames(names) {
  const byBase = new Map();
  const byFolder = new Map();
  for (const n of names) {
    const b = baseOf(n);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(n);
    const f = folderOf(n);
    if (!byFolder.has(f)) byFolder.set(f, []);
    byFolder.get(f).push(n);
  }
  return { byBase, byFolder };
}

// a stem and its shorter forms, longest first: a preset named for its
// mesh (`MS_KashyyykBase_TreeGiant_01_Roots_01`) binds the base's maps
// (`T_KashyyykBase_Roots_01_C`), so words are dropped from its middle,
// its first word and its last kept
export function stemsOf(stem) {
  const words = stem.replace(/^MS_/i, '').split('_');
  const out = [stem, words.join('_')];
  for (let i = 1; i < words.length - 1; i++) for (let j = words.length - 1; j > i; j--) out.push([...words.slice(0, i), ...words.slice(j)].join('_'));
  return [...new Set(out)].filter((s) => /[a-z]/i.test(s));
}

// the first of a stem's maps, by suffix, that the bucket holds
function byStem(index, stem, suffixes, uploaded) {
  for (const form of stemsOf(stem)) {
    const s = form.toLowerCase();
    for (const suffix of suffixes)
      for (const prefix of PREFIXES)
        for (const n of index.byBase.get(`${prefix}${s}${suffix}`) ?? []) if (uploaded(n, 'color')) return n;
  }
  return null;
}

// (the stem's last word, its subject: `Roots`, `SandRough`)
const subjectOf = (stem) =>
  stem
    .split('_')
    .filter((w) => /[a-z]/i.test(w))
    .pop()
    ?.toLowerCase() ?? '';

// the normal beside a colour map: its own stem with a normal's suffix
function normalBeside(index, colour, uploaded) {
  const stem = baseOf(colour).replace(new RegExp(`(${COLOUR.join('|')})$`), '');
  for (const suffix of NORMAL) for (const n of index.byBase.get(`${stem}${suffix}`) ?? []) if (folderOf(n) === folderOf(colour) && uploaded(n, 'normal')) return n;
  return null;
}

const isColour = (n) => COLOUR.some((s) => baseOf(n).endsWith(s));

export function dressingOf(materials, { names, uploaded = () => true }) {
  const index = names?.byBase ? names : indexNames(names);
  const out = {};
  for (const m of materials ?? []) {
    if (!m?.shader || Object.keys(m.textures ?? {}).length) continue;
    const stem = stemOf(m.shader);
    // (the stem's own map first; else a colour map of the same subject kept in the shader's folder)
    const subject = subjectOf(stem);
    const colour = byStem(index, stem, COLOUR, uploaded) ?? (index.byFolder.get(folderOf(m.shader)) ?? []).filter((n) => isColour(n) && subject && baseOf(n).includes(subject)).find((n) => uploaded(n, 'color')) ?? null;
    if (!colour) continue;
    const normal = normalBeside(index, colour, uploaded);
    out[`shader:${m.shader}`] = [{ slot: 'color', name: colour }, ...(normal ? [{ slot: 'normal', name: normal }] : [])];
  }
  return out;
}

export const indexTextures = indexNames;

export const textureArg = (dressing) =>
  Object.entries(dressing)
    .map(([key, maps]) => `${key}=${maps.map((m) => `${m.slot}:${m.name}`).join(',')}`)
    .join(';');
