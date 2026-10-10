// One art a world (docs/health/RULES.md): a world that reaches both a toon
// ramp and a scan draws two kinds of picture in one frame. Each folder of
// the looks’ roster (src/components/worlds/looks.js) counts once when the
// files its scenes reach (src/runtime/shadingClosure.js’s closure) hold a
// ramp (MeshToonMaterial or a gradientMap) and a scan (the core kit,
// lib/three/core; the CC0 library, lib/cc0; or lib/hdri’s loadPbr). The
// number falls as the Phase 2 lanes pick one art a world, and the ratchet
// keeps it down.
// Design: docs/superpowers/specs/2026-10-08-one-feel-site-wide-design.md.
//
//   artMix({ root, folders }) → { value, items: [{ folder, scan, ramp }] }
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { importsOf, resolveImport } from '../../src/runtime/shadingClosure.js';
import { LOOK_FOLDERS } from '../../src/components/worlds/looks.js';
import { metric } from './context.mjs';
import { uncomment } from './graph.mjs';

const RAMP = /\bMeshToonMaterial\b|\bgradientMap\b/;
// the infrastructure that names a ramp’s slot to guard every texture a
// material holds, not to draw with one
export const EXEMPT = ['src/lib/three/frameGuard.js'];
const CODE = /\.(m?js|jsx)$/;
const TEST = /\.test\.(m?js|jsx)$/;

// a scan is one of these files reached by an import (lib/hdri only for its
// scanned sets: its skies are light, not paint)
const SCANS = [
  { file: 'src/lib/three/core.js' },
  { file: 'src/lib/cc0.js' },
  { file: 'src/lib/hdri.js', names: /\bloadPbr\b/ },
];

// a folder’s own scene files, down to (not into) a folder with its own entry
function sources(dir, own) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        if (!own.has(p) && !name.startsWith('__')) walk(p);
      } else if (CODE.test(name) && !TEST.test(name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// the import statements of a source that name a specifier (for what they pull in)
const statementsOf = (source, spec) => source.split(/;|\n(?=\s*import\b)/).filter((s) => s.includes(`'${spec}'`) || s.includes(`"${spec}"`));

export function artMix({ root, folders = LOOK_FOLDERS }) {
  const components = join(root, 'src/components');
  const own = new Set(folders.map((f) => join(components, f.folder)));
  const cache = new Map();
  const read = (p) => {
    if (!cache.has(p)) cache.set(p, readFileSync(p, 'utf8'));
    return cache.get(p);
  };
  const found = new Map();
  const exists = (p) => {
    if (!found.has(p)) found.set(p, existsSync(p));
    return found.get(p);
  };
  const fs = { read, exists };
  // what each file imports, resolved once for the whole site: the worlds
  // share most of lib, and walking it again for every entry of every
  // folder made this the slowest metric in the table
  const edges = new Map();
  const next = (file) => {
    if (!edges.has(file)) edges.set(file, importsOf(read(file)).map((spec) => resolveImport(file, spec, fs)).filter(Boolean));
    return edges.get(file);
  };
  const rel = (p) => relative(root, p).split('\\').join('/');
  const items = [];
  for (const { folder } of folders) {
    const dir = join(components, folder);
    if (!existsSync(dir)) continue;
    // one walk from all of the folder's entries: the union of each entry's
    // closure (src/runtime/shadingClosure.js), reached once
    const reached = new Set();
    const todo = sources(dir, own);
    while (todo.length) {
      const file = todo.pop();
      if (reached.has(file) || TEST.test(file)) continue;
      reached.add(file);
      for (const to of next(file)) if (!reached.has(to)) todo.push(to);
    }
    let ramp = null;
    let scan = null;
    for (const file of [...reached].sort()) {
      const source = read(file);
      if (!ramp && !EXEMPT.includes(rel(file)) && RAMP.test(uncomment(source))) ramp = rel(file);
      if (!scan) {
        for (const spec of importsOf(source)) {
          const to = resolveImport(file, spec, fs);
          const hit = to && SCANS.find((s) => rel(to) === s.file);
          if (hit && (!hit.names || statementsOf(source, spec).some((st) => hit.names.test(st)))) {
            scan = rel(file);
            break;
          }
        }
      }
      if (ramp && scan) break;
    }
    if (ramp && scan) items.push({ folder, scan, ramp });
  }
  return { value: items.length, items };
}

export default async function artMixMetric(ctx) {
  const { items } = artMix({ root: ctx.root });
  return metric({ id: 'art-mix', label: 'worlds that wear a scan and a toon ramp at once', unit: 'worlds', detail: items.map((it) => ({ file: `src/components/${it.folder}`, n: 1, scan: it.scan, ramp: it.ramp })) });
}
