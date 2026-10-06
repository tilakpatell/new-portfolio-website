// Files under src/ over the ceiling, and every file over the warning line
// in the detail, so the steward sees what's about to cross.
import { metric } from './context.mjs';

export const CEILING = 1500;
export const WARN = 800;

export default async function bigFiles(ctx) {
  const detail = [];
  for (const p of ctx.src) {
    if (/\.test\.(js|jsx)$/.test(p)) continue;
    const n = (await ctx.read(p)).split('\n').length;
    if (n > WARN) detail.push({ file: ctx.rel(p), n });
  }
  return metric({
    id: 'big-files',
    label: `source files over ${CEILING} lines`,
    unit: 'files',
    value: detail.filter((d) => d.n > CEILING).length,
    detail,
    note: `detail lists every file over ${WARN} lines`,
  });
}
