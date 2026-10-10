// Writes src/lib/land/flight/fixtures/expanse.json: the thirteen Expanse
// rows the flight flies, as expanse/flight/planets.js makes them from the
// generator, so the pure tables' tests run on the same rows without reaching
// up into a world. expanse/flight/planets.test.js fails when the two part:
// re-run this then.
//
//   node scripts/flight-expanse-fixture.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = 'src/lib/land/flight/fixtures/expanse.json';

// src modules use Vite's extensionless imports: loaded through Vite
const { createServer } = await import('vite');
const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { EXPANSE } = await vite.ssrLoadModule('/src/components/expanse/flight/planets.js');
  writeFileSync(`${ROOT}${OUT}`, `${JSON.stringify(EXPANSE, null, 2)}\n`);
  console.log(`wrote ${OUT}: ${EXPANSE.length} rows`);
} finally {
  await vite.close();
}
