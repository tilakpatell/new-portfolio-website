import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// An import that leaves off its extension must find the same file on every
// disk. Vite tries .js before .jsx, so where Harmonium.jsx and harmonium.js
// sit side by side, an import of music/Harmonium is Harmonium.jsx on Linux (and
// so CI and the deploy) but harmonium.js on a case-blind disk (macOS,
// Windows): the build fails there, or a lazy page loads the wrong module. Such
// an import names its extension. Every relative import under src is read.

const ROOT = fileURLToPath(new URL('./', import.meta.url));
const EXTENSIONS = ['', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']; // as written, then Vite's, in its order
const IMPORT = /(?:\bfrom|\bimport(?:Actual)?|[mM]ock)\s*\(?\s*['"](\.\.?\/[^'"\n]+)['"]/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.m?jsx?$/.test(name)) out.push(p);
  }
  return out;
}

// The file a relative import finds, on a disk that minds case or one that doesn't.
function find(specifier, from, caseBlind) {
  const want = resolve(dirname(from), specifier.replace(/\?.*$/, ''));
  const dir = dirname(want);
  const name = caseBlind ? basename(want).toLowerCase() : basename(want);
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  for (const ext of EXTENSIONS) {
    const hit = names.find((n) => (caseBlind ? n.toLowerCase() : n) === name + ext && statSync(join(dir, n)).isFile());
    if (hit) return join(dir, hit);
  }
  return null;
}

describe('an import finds the same file on every disk', () => {
  it('tells the two apart where a case-blind disk finds another file, so the check is live', () => {
    const music = join(ROOT, 'pages/Music.jsx');
    expect(find('../components/music/Harmonium', music, false)).toBe(join(ROOT, 'components/music/Harmonium.jsx'));
    expect(find('../components/music/Harmonium', music, true)).toBe(join(ROOT, 'components/music/harmonium.js'));
    expect(find('../components/music/Harmonium.jsx', music, true)).toBe(join(ROOT, 'components/music/Harmonium.jsx'));
  });

  it('names its extension where it must', () => {
    const bad = [];
    for (const file of walk(ROOT)) {
      for (const [, specifier] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
        if (find(specifier, file, false) !== find(specifier, file, true)) bad.push(`${relative(ROOT, file)}: '${specifier}'`);
      }
    }
    expect(bad).toEqual([]);
  });
});
