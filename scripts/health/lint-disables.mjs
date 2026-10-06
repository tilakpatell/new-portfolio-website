// eslint-disable comments under src/ and scripts/: each one a rule we
// stopped enforcing somewhere.
import { metric } from './context.mjs';

const RE = /eslint-disable(?:-next-line|-line)?\b/g;

export default async function lintDisables(ctx) {
  const detail = [];
  let total = 0;
  // the measure's own files talk about the comment without having one
  for (const p of [...ctx.src, ...ctx.scripts].filter((f) => !ctx.rel(f).startsWith('scripts/health/'))) {
    const n = ((await ctx.read(p)).match(RE) ?? []).length;
    if (!n) continue;
    total += n;
    detail.push({ file: ctx.rel(p), n });
  }
  return metric({ id: 'lint-disables', label: 'eslint-disable comments', unit: 'comments', value: total, detail });
}
