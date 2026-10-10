// The game's detail normals (lane E0; lane V found the GLBs lack them): a
// material's tiling second normal (materials.jsonl's `DetailNS`,
// `NormalDetail`, `DetailNormal` or `NormalmapDetail`, at its
// `NormalDetailScalar` or `Detail_Tiling`, its `NormalDetail_Intensity`),
// listed per pack mesh and material for the level's loader, which lays it
// over the normal map on high and ultra (levelDetail.js). Pure.
//
//   detailOf(material) → { tex, tiling: [u, v], strength } | null
//   detailsJson(meshes, records) → { meshes: { <index>: [{ material, tex,
//     tiling, strength }] }, sources: { slug: texture name } }
//     (records: materials.jsonl's rows by mesh, `models/` and `.glb` off)

const KEYS = ['DetailNS', 'NormalDetail', 'DetailNormal', 'NormalmapDetail'];
const TILING = ['NormalDetailScalar', 'Detail_Tiling', 'DetailTiling'];

export function detailOf(m) {
  const key = KEYS.find((k) => m.textures?.[k]);
  if (!key) return null;
  const t = TILING.map((k) => m.vectors?.[k]).find(Boolean);
  const u = t?.[0] || 1;
  const v = t?.[1] || u;
  return { tex: m.textures[key], tiling: [u, v], strength: m.vectors?.NormalDetail_Intensity?.[0] ?? 1 };
}

export const meshKey = (name) => String(name).replace(/^models\//, '').replace(/\.glb$/, '').toLowerCase();
const slugOf = (tex) => String(tex).split('/').pop().toLowerCase();

export function detailsJson(meshes, records) {
  const out = {};
  const sources = {};
  meshes.forEach((m, i) => {
    const rec = records.get(meshKey(m.name));
    const list = (rec?.materials ?? []).flatMap((mat, material) => {
      const d = detailOf(mat);
      if (!d || !(d.tiling[0] > 0)) return [];
      sources[slugOf(d.tex)] = d.tex;
      return [{ material, tex: `tex/detail/${slugOf(d.tex)}.ktx2`, tiling: d.tiling, strength: d.strength }];
    });
    if (list.length) out[i] = list;
  });
  return { meshes: out, sources: Object.fromEntries(Object.entries(sources).sort()) };
}
