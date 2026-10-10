// The stack pages stay true: each has the template's headings in order, and
// every file it names still exists. A page that names a file that moved fails
// here, in the same run as the code that moved it. The helpers live in this
// file because a docs test has no module of its own to import from.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(DIR, '../..');
const TEMPLATE = readFileSync(join(DIR, '_template.md'), 'utf8');

const headings = (markdown) => markdown.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.trim());

// the template's ## headings must appear in the page in the same order; the
// first one out of place is named
export function headingsOk(markdown, template = TEMPLATE) {
  const page = headings(markdown);
  let at = 0;
  for (const h of headings(template)) {
    const i = page.indexOf(h, at);
    if (i < 0) return { ok: false, missing: h };
    at = i + 1;
  }
  return { ok: true, missing: null };
}

// backticked paths under src/ or scripts/: a file with an extension the site
// writes, or a folder ending in /
const PATH = /`((?:src|scripts)\/[^`\s*<>]*?(?:\.(?:js|jsx|mjs|css|json|md)|\/))`/g;
export const pathsIn = (markdown) => [...new Set([...markdown.matchAll(PATH)].map((m) => m[1]))];

export const missingPaths = (markdown, root = ROOT) => pathsIn(markdown).filter((p) => !existsSync(join(root, p)));

const pages = readdirSync(DIR).filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== '_template.md');

describe('the stack pages', () => {
  it('the template passes its own headings check', () => {
    expect(headingsOk(TEMPLATE)).toEqual({ ok: true, missing: null });
  });

  for (const page of pages) {
    describe(page, () => {
      const md = readFileSync(join(DIR, page), 'utf8');
      it('has the template’s seven headings, in order', () => {
        expect(headingsOk(md), page).toEqual({ ok: true, missing: null });
      });
      it('opens with the version line', () => {
        const first = md.split('\n').slice(1).find((l) => l.trim());
        expect(first?.startsWith('**Version**'), page).toBe(true);
      });
      it('names only files that exist', () => {
        expect(missingPaths(md).map((p) => `${page}: ${p}`)).toEqual([]);
      });
    });
  }

  it('the index names every package in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const index = readFileSync(join(DIR, 'README.md'), 'utf8');
    const block = index.split('<!-- census:start -->')[1]?.split('<!-- census:end -->')[0] ?? '';
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(names.filter((n) => !block.includes(`| \`${n}\` |`))).toEqual([]);
  });

  it('every page written is linked from the index', () => {
    const index = readFileSync(join(DIR, 'README.md'), 'utf8');
    const linked = new Set([...index.matchAll(/\]\(([\w-]+\.md)\)/g)].map((m) => m[1]));
    expect(pages.filter((p) => !linked.has(p))).toEqual([]);
  });
});

describe('the checks catch what they are for', () => {
  it('a page naming a file that does not exist fails, naming the page and the path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stack-page-'));
    const page = join(dir, 'temp.md');
    writeFileSync(page, '# temp\n\nSee `src/lib/three/nowhere.js`, `src/lib/three/` and `scripts/health.mjs`, but not `src/*.js`.\n');
    const md = readFileSync(page, 'utf8');
    expect(pathsIn(md)).toEqual(['src/lib/three/nowhere.js', 'src/lib/three/', 'scripts/health.mjs']);
    expect(missingPaths(md).map((p) => `temp.md: ${p}`)).toEqual(['temp.md: src/lib/three/nowhere.js']);
  });

  it('a page with its headings out of order fails, naming the first one missing', () => {
    const [first, second, ...rest] = headings(TEMPLATE);
    const md = ['# x', second, first, ...rest].join('\n\n');
    expect(headingsOk(md)).toEqual({ ok: false, missing: second });
  });
});
