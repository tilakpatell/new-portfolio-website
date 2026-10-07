// What a model must satisfy to go on the site: the triangle budget it was
// asked for, and a size cap. Pure, so it can be tested without the native
// modules web.mjs needs to make one.
//
// Three cuts of every model, one for each of the site's detail levels
// (lib/device: a phone, a laptop, a desktop with a graphics card), picked at
// load by src/lib/three/gen3d.js. The bake is made at the top one and the
// others simplified from it, so all three share one atlas layout.

export const TIERS = {
  hq: { suffix: '.hq', faces: 120000, tex: 4096, bytes: 10 * 1024 * 1024, detail: ['ultra', 'high'] },
  mid: { suffix: '', faces: 60000, tex: 2048, bytes: 4 * 1024 * 1024, detail: ['mid'] },
  lo: { suffix: '.lo', faces: 20000, tex: 1024, bytes: 1.5 * 1024 * 1024, detail: ['low'] },
};
export const MAX_BYTES = TIERS.mid.bytes;

// The three cuts for a model asked to be smaller than the default top cut
// (a rock at 4000 faces, a character at 30000): each tier scaled by the same
// share, its texture no bigger than asked. The default asks give TIERS.
export function cutsFor(faces = TIERS.hq.faces, tex = TIERS.hq.tex) {
  const share = Math.min(1, faces / TIERS.hq.faces);
  return Object.fromEntries(Object.entries(TIERS).map(([t, c]) => [t, { ...c, faces: Math.max(300, Math.round(c.faces * share)), tex: Math.min(c.tex, tex) }]));
}

export const triangles = (doc) => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);

// The problems with a result, as sentences; none means it may ship.
export function check({ tris, after, bytes, max = MAX_BYTES }) {
  const problems = [];
  if (after > tris * 1.05) problems.push(`${Math.round(after)} triangles, over the budget of ${tris}`);
  if (bytes > max) problems.push(`${(bytes / 1024).toFixed(0)} KB, over ${max / 1024} KB`);
  return problems;
}

// The file a detail level loads: hq for a desktop's, the plain one for a
// laptop's, lo for a phone's (the same table as src/lib/three/gen3d.js).
export const fileFor = (name, detail) => `${name}${(Object.values(TIERS).find((t) => t.detail.includes(detail)) ?? TIERS.mid).suffix}.glb`;
