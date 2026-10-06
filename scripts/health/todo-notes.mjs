// TODO, FIXME and HACK under src/: promises in comments. The site's rule is
// that a comment says why; a promise goes in the backlog instead.
import { metric } from './context.mjs';

const RE = /\b(TODO|FIXME|HACK)\b/g;

export default async function todoNotes(ctx) {
  const detail = [];
  let total = 0;
  for (const p of ctx.src) {
    const n = ((await ctx.read(p)).match(RE) ?? []).length;
    if (!n) continue;
    total += n;
    detail.push({ file: ctx.rel(p), n });
  }
  return metric({ id: 'todo-notes', label: 'TODO / FIXME / HACK notes', unit: 'notes', value: total, detail });
}
