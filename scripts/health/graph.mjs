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
// a package is not a node, and import(name) names no one file. Comments are
// blanked out first: an import in one isn't one, and one in an import doesn't
// hide it.
import { readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve as toPath } from 'node:path';

export const isTest = (file) => /\.test\.(js|jsx|mjs)$/.test(file);

const RELATIVE = /^\.\.?(\/|$)/;
// as written, then the extensions src/ leaves off (.js before .jsx, as Vite tries
// them), then a folder's index
const TRY = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];

// import … from '…' and export … from '…', the braces over as many lines as they
// like. A statement starts a line or follows a ; { or }, so the second of two
// imports on one line is read too
export const FROM = /(?<=^|[;{}])\s*(?:import|export)\b[^'"`]*?\bfrom\s*(['"])([^'"\n]+)\1/gm;
// import '…', for its side effects (a stylesheet, a polyfill), at a statement's start too
export const SIDE_EFFECT = /(?<=^|[;{}])\s*import\s*(['"])([^'"\n]+)\1/gm;
// import('…') whose argument is the literal alone, so import('./' + name) isn't './'
export const DYNAMIC = /\bimport\s*\(\s*(['"`])([^'"`$\n]+)\1\s*[,)]/g;
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

// A / opens a regex after one of these, or after a keyword below; after a
// value (a name, a number, a ) ] } or a literal's end) it divides
const BEFORE_REGEX = '([{,;:=!&|?+-*%<>~^';
const KEYWORD = /(?:^|[^\w$.])(?:return|typeof|instanceof|case|do|else|in|of|new|delete|void|throw|yield|await)\s*$/;

// The text with its comments blanked out, so an import written in a comment
// isn't read and a comment written in an import (an apostrophe in its braces,
// Vite's /* @vite-ignore */) doesn't hide it. Spaces take a comment's place and
// its newlines stay, so every line starts where it did. Strings, templates and
// regexes are stepped over whole: the /* in './data/*.json' is a glob, not a
// comment. A '…', "…" or regex ends at its line's end at the latest, so what
// looks like one and isn't (the apostrophe in JSX's <p>Don't</p>) costs a line.
export function uncomment(text) {
  let out = '';
  let kept = 0; // the text before this is in out
  let prev = ''; // the last character of code that isn't a space
  let depth = 0; // how many { are open in code
  const closes = []; // the depth at which each open ${ in a template closes
  // from just inside a template's text: past its closing `, or into its next ${
  const template = (j) => {
    for (; j < text.length; j += 1) {
      if (text[j] === '\\') j += 1;
      else if (text[j] === '`') {
        prev = '`';
        return j + 1;
      } else if (text[j] === '$' && text[j + 1] === '{') {
        depth += 1;
        closes.push(depth);
        prev = '{';
        return j + 2;
      }
    }
    return j;
  };
  // in code, only these can start a comment or a literal or move the depth, so
  // the scan jumps from one to the next rather than reading every character
  const next = /[/'"`{}]/g;
  let i = 0;
  while (i < text.length) {
    next.lastIndex = i;
    const at = next.exec(text)?.index ?? text.length;
    for (let k = at - 1; k >= i; k -= 1) {
      if (!/\s/.test(text[k])) {
        prev = text[k];
        break;
      }
    }
    if (at === text.length) break;
    i = at;
    const c = text[i];
    if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      const end = text[i + 1] === '/' ? text.indexOf('\n', i) : text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : text[i + 1] === '/' ? end : end + 2;
      out += text.slice(kept, i) + text.slice(i, stop).replace(/[^\n]/g, ' ');
      kept = i = stop;
    } else if (c === "'" || c === '"') {
      i = literalEnd(text, i + 1, c);
      prev = c;
    } else if (c === '/' && (!prev || BEFORE_REGEX.includes(prev) || KEYWORD.test(text.slice(Math.max(0, i - 16), i)))) {
      i = literalEnd(text, i + 1, '/');
      prev = '/';
    } else if (c === '`') i = template(i + 1);
    else if (c === '}' && closes.at(-1) === depth) {
      closes.pop();
      depth -= 1;
      i = template(i + 1);
    } else {
      // a division, or a brace of code's own
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      prev = c;
      i += 1;
    }
  }
  return out + text.slice(kept);
}

// from just inside a '…', "…" or /regex/: the index just past its end, or its
// line's end if it doesn't end on that line
function literalEnd(text, j, quote) {
  let inClass = false; // a regex's [ … ], where a / doesn't end it
  for (; j < text.length && text[j] !== '\n'; j += 1) {
    const c = text[j];
    if (c === '\\') j += 1;
    else if (quote === '/' && (c === '[' || c === ']')) inClass = c === '[';
    else if (c === quote && !inClass) return j + 1;
  }
  return j;
}

async function targets(file, text) {
  const code = uncomment(text);
  const out = [];
  for (const re of [FROM, SIDE_EFFECT, DYNAMIC]) for (const [, , spec] of code.matchAll(re)) out.push(...(await resolve(spec, file)));
  for (const [, arg] of code.matchAll(GLOB)) for (const [, , spec] of arg.matchAll(STRING)) out.push(...(await resolve(spec, file)));
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
