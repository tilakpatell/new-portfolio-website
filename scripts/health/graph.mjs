// The import graph of src/: which file imports which. Built once a run and
// shared by the metrics that read it (cycles, boundary-breaks). Hand-rolled,
// no parser: a regex finds each import and resolve() finds the file on disk.
//
//   const g = await graph(ctx);   // memoised on ctx.graph
//   g.files      every source under src/, tests included: repo-relative, sorted
//   g.edges      [{ from, to }], one for each file a source imports, repo-relative
//                ('src/lib/view.js' -> 'src/components/universe/universes.js'),
//                sorted by from then to, no repeats; to may be a .json, a .css or
//                any other file on disk
//   g.isTest(f)  true for a *.test.js / .jsx / .mjs. A test is a source, so its
//                imports are edges (a test can break a boundary too)
//   g.cycles()   the loops among the sources that aren't tests, shortest first
//
// What counts as an import: import … from '…', export … from '…', import '…',
// import('…') with a string literal, and import.meta.glob('…') or (['…', …]),
// an edge to every file a pattern matches. Only a relative specifier resolves:
// a package is not a node, and import(name) names no one file.
import { readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve as toPath } from 'node:path';

export const isTest = (file) => /\.test\.(js|jsx|mjs)$/.test(file);

const RELATIVE = /^\.\.?(\/|$)/;
// as written, then the extensions src/ leaves off (.js before .jsx, as Vite tries
// them), then a folder's index
const TRY = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];

// import … from '…' and export … from '…', the braces over as many lines as they like
const FROM = /^\s*(?:import|export)\b[^'"`]*?\bfrom\s*(['"])([^'"\n]+)\1/gm;
// import '…', for its side effects (a stylesheet, a polyfill)
const SIDE_EFFECT = /^\s*import\s*(['"])([^'"\n]+)\1/gm;
// import('…') whose argument is the literal alone, so import('./' + name) isn't './'
const DYNAMIC = /\bimport\s*\(\s*(['"`])([^'"`$\n]+)\1\s*[,)]/g;
// import.meta.glob's first argument, a pattern or a list of them. A '!' pattern
// isn't relative and so is left out: a glob that excludes may count an edge too many
const GLOB = /\bimport\.meta\.glob\s*\(\s*(\[[^\]]*\]|(['"`])[^'"`\n]+\2)/g;
const STRING = /(['"`])([^'"`\n]+)\1/g;

const isFile = (p) => stat(p).then((s) => s.isFile(), () => false);

// The files a specifier written in `from` names: none for a package or a
// miss, one for an import, every match for a glob. Absolute paths, sorted.
export async function resolve(specifier, from) {
  const spec = specifier.replace(/\?.*$/, ''); // ?raw, ?url, ?worker
  if (!RELATIVE.test(spec)) return [];
  const parts = spec.split('/');
  const wild = parts.findIndex((s) => s.includes('*'));
  if (wild >= 0) return [...new Set(await expand(toPath(dirname(from), ...parts.slice(0, wild)), parts.slice(wild)))].sort();
  const base = toPath(dirname(from), spec);
  for (const ext of TRY) if (await isFile(base + ext)) return [base + ext];
  return [];
}

// A glob's matches under dir: * within one folder, ** across any number of them
// (none included)
async function expand(dir, [seg, ...rest]) {
  if (seg === undefined) return (await isFile(dir)) ? [dir] : [];
  const names = await readdir(dir).catch(() => []);
  if (seg === '**') {
    const out = await expand(dir, rest);
    for (const name of names) out.push(...(await expand(join(dir, name), [seg, ...rest])));
    return out;
  }
  const re = new RegExp(`^${seg.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);
  const out = [];
  for (const name of names) if (re.test(name)) out.push(...(await expand(join(dir, name), rest)));
  return out;
}

async function targets(file, text) {
  const out = [];
  for (const re of [FROM, SIDE_EFFECT, DYNAMIC]) for (const [, , spec] of text.matchAll(re)) out.push(...(await resolve(spec, file)));
  for (const [, arg] of text.matchAll(GLOB)) for (const [, , spec] of arg.matchAll(STRING)) out.push(...(await resolve(spec, file)));
  return out;
}

// Tarjan's strongly connected components: files that can each reach the
// other. Every component of two or more files is a cycle, listed from its
// alphabetically first file along its imports (a walk that visits each file
// once, so a tangle of several loops is one row). Shortest first, the easiest
// to cut; ties alphabetical.
function loops(next) {
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const found = [];
  let n = 0;
  const visit = (v) => {
    index.set(v, n);
    low.set(v, n++);
    stack.push(v);
    onStack.add(v);
    for (const w of next.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) !== index.get(v)) return;
    const group = new Set();
    let w;
    do {
      w = stack.pop();
      onStack.delete(w);
      group.add(w);
    } while (w !== v);
    if (group.size > 1) found.push(walk(group, next));
  };
  for (const v of next.keys()) if (!index.has(v)) visit(v);
  return found.sort((a, b) => a.length - b.length || (a[0] < b[0] ? -1 : 1));
}

function walk(group, next) {
  const seen = new Set();
  const go = (v) => {
    seen.add(v);
    for (const w of next.get(v)) if (group.has(w) && !seen.has(w)) go(w);
  };
  go([...group].sort()[0]);
  return [...seen];
}

async function build(ctx) {
  const next = new Map(); // from → its imports, sorted; ctx.src is sorted, so the keys are too
  for (const p of ctx.src) {
    const to = [...new Set((await targets(p, await ctx.read(p))).map(ctx.rel))].sort();
    if (to.length) next.set(ctx.rel(p), to);
  }
  const edges = [...next].flatMap(([from, to]) => to.map((t) => ({ from, to: t })));
  return {
    files: ctx.src.map(ctx.rel),
    edges,
    isTest,
    cycles: () => {
      const source = new Map();
      for (const [from, to] of next) if (!isTest(from)) source.set(from, to.filter((t) => !isTest(t)));
      return loops(source);
    },
  };
}

export async function graph(ctx) {
  ctx.graph ??= build(ctx);
  return ctx.graph;
}
