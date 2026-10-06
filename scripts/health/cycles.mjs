// Import cycles among src/'s modules, tests left out. A module in a loop
// can't load, split off or be lazy-loaded without the rest of the loop.
import { metric } from './context.mjs';
import { graph } from './graph.mjs';

export default async function cycles(ctx) {
  const found = (await graph(ctx)).cycles();
  return metric({
    id: 'cycles',
    label: 'import cycles among src/ modules',
    unit: 'cycles',
    value: found.length,
    detail: found.map((c) => ({ file: c.join(' → '), n: c.length })),
    ordered: true, // the graph's order, shortest loop first: the easiest to cut
  });
}
