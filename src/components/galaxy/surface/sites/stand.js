// Stands of things for the worlds' sites: what a site file uses to put a
// cluster of trees, rocks or shards round a place, one by one.

// a stand of trees (or anything) round a spot: n of them between r0 and r1
// metres out, kinds taken in turn, the same every time (seeded); placed one
// by one rather than scattered, so a stand off the screen isn't drawn
export const grove = (seed, n, r0, r1, kinds, [lo, hi] = [0.85, 1.35]) => {
  let a = seed >>> 0;
  const r = () => (a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296;
  return Array.from({ length: n }, (_, i) => {
    const t = r() * Math.PI * 2;
    const d = Math.sqrt(r0 * r0 + r() * (r1 * r1 - r0 * r0));
    return { kind: kinds[i % kinds.length], at: [Math.cos(t) * d, Math.sin(t) * d], yaw: r() * Math.PI * 2, scale: lo + (hi - lo) * r(), sink: 0.3 };
  });
};
