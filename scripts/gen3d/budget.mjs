// What a model must satisfy to go on the site: the triangle budget it was
// asked for, and a size cap. Pure, so it can be tested without the native
// modules web.mjs needs to make one.
//
// Three cuts of every model, one for each of the site's detail levels
// (lib/device: a phone, a laptop, a desktop with a graphics card), picked at
// load by src/lib/three/gen3d.js. The bake is made at the top one and the
// others simplified from it, so all three share one atlas layout.
//
// A fourth, the ultra cut, is made only for a model asked for it (--ultra,
// or `ultra: yes` on a desktop job): the raw mesh baked at up to 300k faces
// with 8192 maps, for the ultra detail level. The bake is then made at its
// size and the three others come from it. Where a model has no ultra cut,
// ultra loads the hq one.

export const TIERS = {
  hq: { suffix: '.hq', faces: 120000, tex: 4096, bytes: 10 * 1024 * 1024, detail: ['high'] },
  mid: { suffix: '', faces: 60000, tex: 2048, bytes: 4 * 1024 * 1024, detail: ['mid'] },
  lo: { suffix: '.lo', faces: 20000, tex: 1024, bytes: 1.5 * 1024 * 1024, detail: ['low'] },
};
export const ULTRA = { suffix: '.ultra', faces: 300000, tex: 8192, bytes: 24 * 1024 * 1024, detail: ['ultra'] };
export const MAX_BYTES = TIERS.mid.bytes;

// The three cuts for a model asked to be smaller than the default top cut
// (a rock at 4000 faces, a character at 30000): each tier scaled by the same
// share, its texture no bigger than asked. The default asks give TIERS.
// With `ultra`, the ultra cut too (first: the one the bake is made at),
// scaled by the same share.
export function cutsFor(faces = TIERS.hq.faces, tex = TIERS.hq.tex, { ultra = false } = {}) {
  const share = Math.min(1, faces / (ultra ? ULTRA : TIERS.hq).faces);
  const tiers = ultra ? { ultra: ULTRA, ...TIERS } : TIERS;
  return Object.fromEntries(Object.entries(tiers).map(([t, c]) => [t, { ...c, faces: Math.max(300, Math.round(c.faces * share)), tex: Math.min(c.tex, tex) }]));
}

// The --faces a shipped model was asked for, as near as its cuts tell: the
// smallest ask whose three budgets (cutsFor) all fit, never more than the
// top cut's own. The asset tests hold each cut to the budget this gives.
export function inferFaces(tris) {
  const need = Object.entries(TIERS).map(([t, c]) => Math.ceil(((tris[t] ?? 0) / 1.05) * (TIERS.hq.faces / c.faces)));
  return Math.min(TIERS.hq.faces, Math.max(300, ...need));
}

export const triangles = (doc) => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);

// The problems with a result, as sentences; none means it may ship.
export function check({ tris, after, bytes, max = MAX_BYTES }) {
  const problems = [];
  if (after > tris * 1.05) problems.push(`${Math.round(after)} triangles, over the budget of ${tris}`);
  if (bytes > max) problems.push(`${(bytes / 1024).toFixed(0)} KB, over ${max / 1024} KB`);
  return problems;
}

// The file a detail level loads: ultra for a strong card's where the model
// has an ultra cut (hq where not), hq for a desktop's, the plain one for a
// laptop's, lo for a phone's (the same table as src/lib/three/gen3d.js).
export const fileFor = (name, detail, { ultra = false } = {}) => {
  if (detail === 'ultra') return `${name}${(ultra ? ULTRA : TIERS.hq).suffix}.glb`;
  return `${name}${(Object.values(TIERS).find((t) => t.detail.includes(detail)) ?? TIERS.mid).suffix}.glb`;
};
