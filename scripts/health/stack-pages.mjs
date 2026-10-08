// The packages in package.json with no row in the stack index
// (docs/stack/README.md, between its census markers). A dependency has a
// page (docs/health/RULES.md), so a new one fails the check until it is
// given one, rather than the docs finding out a year later.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { metric } from './context.mjs';

export const INDEX = 'docs/stack/README.md';

export default async function stackPages(ctx) {
  // neither file is a source file, so neither is in ctx.src: read them here
  const pkg = JSON.parse(await readFile(join(ctx.root, 'package.json'), 'utf8').catch(() => '{}'));
  const index = await readFile(join(ctx.root, INDEX), 'utf8').catch(() => '');
  // only the generated block counts: a package named in the prose has no row
  const block = index.split('<!-- census:start -->')[1]?.split('<!-- census:end -->')[0] ?? '';
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).sort();
  const detail = names.filter((n) => !block.includes(`| \`${n}\` |`)).map((n) => ({ file: INDEX, n: 1, note: n }));
  return metric({ id: 'stack-pages', label: 'packages with no page in docs/stack', unit: 'packages', detail });
}
