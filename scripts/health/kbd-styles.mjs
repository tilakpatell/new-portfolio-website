// Key caps drawn outside the house one: CSS rules whose selector styles a
// <kbd> or a "*-kbd" class anywhere but src/index.css, where the site's one
// .kbd lives (spec 5.1, rule 3). Lower is better: each world or surface that
// draws its own cap is one more way to say "press this".
//
// The health context lists only scripts, so this walks src/ for .css itself.
// The world HUD kit's cap lives in src/index.css beside the house one.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { metric } from './context.mjs';

const HOUSE = 'src/index.css';
const SKIP = new Set(['node_modules', 'dist', '.git']);

async function cssUnder(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (SKIP.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await cssUnder(p, out);
    else if (entry.name.endsWith('.css')) out.push(p);
  }
  return out;
}

// a <kbd> as an element, or a class that ends in "kbd" (.kbd, .palette-kbd)
const CAP = /(^|[\s>+~,(])kbd(?![\w-])|\.[\w-]*kbd(?![\w-])/;

// how many rules in a stylesheet draw a cap: each `selectors { … }` block
// whose selectors name one (inner blocks of an @media count on their own)
export function capRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let n = 0;
  for (const m of text.matchAll(/([^{}]+)\{[^{}]*\}/g)) if (CAP.test(m[1].trim())) n++;
  return n;
}

export default async function kbdStyles(ctx) {
  const detail = [];
  let total = 0;
  for (const p of (await cssUnder(join(ctx.root, 'src'))).sort()) {
    const file = ctx.rel(p);
    if (file === HOUSE) continue;
    const n = capRules(await ctx.read(p));
    if (!n) continue;
    total += n;
    detail.push({ file, n });
  }
  return metric({ id: 'kbd-styles', label: 'Key-cap rules outside the house .kbd', unit: 'rules', value: total, detail });
}
