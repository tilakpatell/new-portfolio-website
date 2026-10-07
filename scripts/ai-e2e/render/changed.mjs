// Whether a pull request needs the render tier: it touches a model or the
// code that draws one. CI's AI job asks, and installs a browser only then.
//
//   node scripts/ai-e2e/render/changed.mjs   prints true or false (and sets `render` in GITHUB_OUTPUT)
//
// The files are what the pull request's merge commit changes against its
// first parent, main (CI checks it out two commits deep for that).

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DRAWS = [/^public\/models\//, /^src\/lib\/three\//, /^scripts\/glb-shot\.mjs$/, /^scripts\/preview\/glb-shot\.html$/, /^scripts\/ai-e2e\/render\//];

export const touches = (files) => files.some((f) => DRAWS.some((d) => d.test(f)));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = String(execFileSync('git', ['diff', '--name-only', 'HEAD^1', 'HEAD'], { encoding: 'utf8' })).split('\n').filter(Boolean);
  const render = touches(files);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `render=${render}\n`);
  console.log(render);
}
