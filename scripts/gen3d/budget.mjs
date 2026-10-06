// What a model must satisfy to go on the site: the triangle budget it was
// asked for, and a size cap. Pure, so it can be tested without the native
// modules web.mjs needs to make one.

// 4 MB: a hero model at 60k triangles with a 2048 colour map and half-size normal and metal-rough
// maps; what a phone on the site can take a few of in a scene, not dozens (props go smaller)
export const MAX_BYTES = 4 * 1024 * 1024;

export const triangles = (doc) => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);

// The problems with a result, as sentences; none means it may ship.
export function check({ tris, after, bytes }) {
  const problems = [];
  if (after > tris * 1.05) problems.push(`${Math.round(after)} triangles, over the budget of ${tris}`);
  if (bytes > MAX_BYTES) problems.push(`${(bytes / 1024).toFixed(0)} KB, over ${MAX_BYTES / 1024} KB`);
  return problems;
}
