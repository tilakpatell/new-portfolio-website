// Every kit pack as committed (public/kit/<pack>/, written by
// scripts/kit/import.mjs) held to the kit's rules: its manifest's credit
// said, every model's file there, each file and tree within BUDGET
// (checkManifest, scripts/kit/manifest.mjs, whose numbers these are), the
// pack's GLBs in all within its PACK_BUDGET where it has one (the nature
// megakit's 12 MiB), and no GLB in the folder that no model is in (a file
// left from an older import, which an install would never fetch but the
// site would still serve). Run after an import: `node scripts/kit-check.mjs`
// prints each pack's models, files and size, then anything wrong, and exits
// 1 if anything is. The manual is scripts/kit/README.md.
//
//   orphans(manifest, names: string[]) → string[]   (the GLBs among names no model's file is)
//   checkPack(dir) → { pack, models, files: { [glb]: bytes }, index: bytes, errors: string[] }

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUDGET, PACK_BUDGET, byName, checkManifest } from './kit/manifest.mjs';

const MIB = 1048576;
const isGlb = (f) => f.toLowerCase().endsWith('.glb');

export function orphans(manifest, names) {
  const used = new Set(Object.values(manifest.models ?? {}).map((m) => m.file));
  return names.filter((f) => isGlb(f) && !used.has(f)).sort(byName);
}

// One pack's folder: its manifest against the files beside it. A folder
// with no manifest, or one that isn't JSON, is an error of its own.
export function checkPack(dir) {
  const pack = basename(dir);
  const names = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());
  const files = Object.fromEntries(names.filter(isGlb).map((f) => [f, statSync(join(dir, f)).size]));
  const result = { pack, models: 0, files, index: 0, errors: [] };
  const index = join(dir, 'index.json');
  if (!existsSync(index)) return { ...result, errors: [`${pack}: no index.json`] };
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(index, 'utf8'));
  } catch (e) {
    return { ...result, errors: [`${pack}: index.json is not JSON (${e.message})`] };
  }
  if (!manifest.models || typeof manifest.models !== 'object') return { ...result, errors: [`${pack}: index.json has no models`] };
  const total = Object.values(files).reduce((n, b) => n + b, 0);
  const cap = PACK_BUDGET[pack];
  return {
    ...result,
    models: Object.keys(manifest.models).length,
    index: statSync(index).size,
    errors: [
      ...(manifest.pack === pack ? [] : [`${pack}: its manifest says it is ${JSON.stringify(manifest.pack)}`]),
      ...checkManifest(manifest, files).map((e) => `${pack}: ${e}`),
      ...orphans(manifest, names).map((f) => `${pack}: ${f} is no model's file`),
      ...(cap != null && total > cap ? [`${pack}: ${(total / MIB).toFixed(2)} MiB of GLBs in all, over ${cap / MIB} MiB`] : []),
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kit = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'kit');
  const dirs = existsSync(kit) ? readdirSync(kit, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(byName) : [];
  if (!dirs.length) {
    console.log(`kit check: no packs in ${kit}`);
    process.exit(1);
  }
  const packs = dirs.map((d) => checkPack(join(kit, d)));
  const mib = (bytes) => (bytes / MIB).toFixed(2);
  for (const p of packs) {
    const sizes = Object.entries(p.files);
    const bytes = sizes.reduce((n, [, b]) => n + b, 0);
    const [big, most] = sizes.reduce((a, b) => (b[1] > a[1] ? b : a), ['-', 0]);
    console.log(
      `${p.pack.padEnd(12)} ${String(p.models).padStart(4)} models in ${String(sizes.length).padStart(3)} files  ${mib(bytes).padStart(6)}${PACK_BUDGET[p.pack] ? ` of ${PACK_BUDGET[p.pack] / MIB}` : ''} MiB` +
        `  (largest ${big} ${mib(most)} of ${mib(BUDGET.file)} MiB; manifest ${Math.round(p.index / 1024)} KiB)`,
    );
  }
  const errors = packs.flatMap((p) => p.errors);
  for (const e of errors) console.log(`  ${e}`);
  const total = packs.reduce((n, p) => n + Object.values(p.files).reduce((a, b) => a + b, 0), 0);
  const models = packs.reduce((n, p) => n + p.models, 0);
  console.log(`kit check: ${packs.length} packs, ${models} models, ${mib(total)} MiB, ${errors.length ? `${errors.length} wrong` : 'clean'}`);
  if (errors.length) process.exit(1);
}
