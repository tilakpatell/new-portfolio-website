// The files a module reaches, and the GLSL in them. Pure, with the file
// system passed in ({ read(path) → string, exists(path) → boolean }), so
// shading.test.js can check a 'nodes' module's whole closure and not its
// folder alone: a world's GLSL may all be in lib/three, files away from
// its module, and WebGPURenderer throws on it on the first frame all the
// same.
//
// importsOf(source) → string[]       specifiers: import … from, export … from, import '…', import('…')
// resolveImport(from, spec, { exists }) → path | null   relative only: the path, .js, .jsx, /index.js, /index.jsx
// closure(entry, { read, exists }) → Set<path>          every code file reached, tests left out
// glslSites(source) → string[]       the forbidden names it uses, comments stripped first
//
// (An import whose path is built at run time, import(`./${x}.js`), can't be
// followed: nothing under src does it for a world's materials.)

import { dirname, join } from 'node:path';

const FROM = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g;
const BARE = /\bimport\s*['"]([^'"]+)['"]/g;
const DYNAMIC = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// what WebGPURenderer can't run: GLSL materials, shader patches, and the
// classic post chain
export const FORBIDDEN = ['RawShaderMaterial', 'ShaderMaterial', 'onBeforeCompile', 'EffectComposer', 'ShaderPass', 'UnrealBloomPass', 'RenderPass', 'OutputPass'];

export function importsOf(source) {
  const out = [];
  for (const re of [FROM, BARE, DYNAMIC]) for (const m of source.matchAll(re)) out.push(m[1]);
  return out;
}

const CODE = /\.(m?js|jsx)$/;
const TEST = /\.test\.(m?js|jsx)$/;

export function resolveImport(from, spec, { exists }) {
  if (!spec.startsWith('.')) return null; // a package: three and the like are not ours to check
  const base = join(dirname(from), spec.split('?')[0]);
  for (const p of [base, `${base}.js`, `${base}.jsx`, join(base, 'index.js'), join(base, 'index.jsx')]) {
    if (CODE.test(p) && exists(p)) return p;
  }
  return null;
}

export function closure(entry, { read, exists }) {
  const seen = new Set();
  const todo = [entry];
  while (todo.length) {
    const file = todo.pop();
    if (seen.has(file) || TEST.test(file)) continue;
    seen.add(file);
    for (const spec of importsOf(read(file))) {
      const next = resolveImport(file, spec, { exists });
      if (next && !seen.has(next)) todo.push(next);
    }
  }
  return seen;
}

// Comments are cut with a small regex, not a parser: a `//` inside a
// string would cut the rest of its line too, so a GLSL string holding
// `// ShaderMaterial` loses that one word. That costs nothing here: the
// file that builds the material still says `new ShaderMaterial`. (`://`
// is left alone, so a URL in a string doesn't eat its line.)
const COMMENTS = /\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/.*$/gm;

export function glslSites(source) {
  const code = source.replace(COMMENTS, '$1');
  return FORBIDDEN.filter((name) => new RegExp(`\\b${name}\\b`).test(code));
}
