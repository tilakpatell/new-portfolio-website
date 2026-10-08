// How often each world places each kind that has a model (placer.js's
// put and scatter): every thing, place thing and zone thing counts one (a
// cluster counts each member), every scatter its `n`. Prints JSON:
// { world: { kind: count } }. Run: node scripts/ultra/counts.mjs
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { SITES, siteOf } = await vite.ssrLoadModule('/src/components/galaxy/surface/sites/index.js');
  const { SURFACE_MODELS } = await vite.ssrLoadModule('/src/components/galaxy/surface/catalog/index.js');
  const out = {};
  for (const id of Object.keys(SITES)) {
    const site = siteOf(id);
    const n = {};
    const add = (kind, k = 1) => {
      const m = SURFACE_MODELS[kind];
      if (!m) return;
      if (m.cluster) for (const [member] of m.cluster) add(member, k);
      else n[kind] = (n[kind] ?? 0) + k;
    };
    for (const t of [...site.things_all, ...site.zones.flatMap((z) => z.things)]) if (!t.url && t.model !== false) add(t.kind);
    for (const s of site.scatter) if (s.model !== false) add(s.kind, s.n ?? 1);
    out[id] = n;
  }
  console.log(JSON.stringify(out, null, 1));
} finally {
  await vite.close();
}
