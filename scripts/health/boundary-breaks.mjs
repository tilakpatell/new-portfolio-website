// Imports that cross a line docs/health/RULES.md draws: lib or the runtime
// reaching up into the components, one world reaching into another's insides,
// anything but App.jsx mounting a page. Each ties together two things the
// architecture keeps apart, so neither can be split, lazy-loaded or deleted
// on its own.
import { dirname } from 'node:path';
import { metric } from './context.mjs';
import { graph } from './graph.mjs';

// A world is a folder under src/components that draws a scene: a *World.jsx
// or a scene.js somewhere inside it. These folders draw one and still aren't
// worlds, being shared pieces or a classic page's 3D, so 'worlds are islands'
// doesn't hold an import into or out of them
const NOT_WORLDS = ['cockpit', 'contact', 'hyperspace3d', 'mist', 'peace', 'projects', 'travel'];
// and these are worlds whose scene files are named otherwise
const ALSO_WORLDS = ['caribbean', 'deathstar'];

const SCENE = /^src\/components\/([^/]+)\/(?:.+\/)?(?:[^/]*World\.jsx|scene\.js)$/;

// the worlds among repo-relative files, by folder name
export function worlds(files) {
  const found = new Set(ALSO_WORLDS);
  for (const f of files) {
    const [, name] = f.match(SCENE) ?? [];
    if (name && !NOT_WORLDS.includes(name)) found.add(name);
  }
  return found;
}

// The lines, in order. An import breaks the first rule whose from and to it
// matches and whose unless doesn't excuse it, and counts once whatever else
// it breaks. unless gets each side's first capture, the import's target and
// the worlds.
export const RULES = [
  { from: /^src\/lib\//, to: /^src\/(components|pages)\//, why: 'lib knows no page' },
  { from: /^src\/runtime\//, to: /^src\/(components|pages)\//, why: 'the runtime knows no world' },
  // world a comes into world b only by b's own index.js or shared/, not an
  // index.js further in. A folder that isn't a world is no island, either way
  {
    from: /^src\/components\/([^/]+)\//,
    to: /^src\/components\/([^/]+)\//,
    unless: (a, b, to, known) =>
      a === b || !known.has(a) || !known.has(b) || to === `src/components/${b}/index.js` || to.startsWith(`src/components/${b}/shared/`),
    why: 'worlds are islands',
  },
  { from: /^src\/(?!App\.jsx)/, to: /^src\/pages\//, why: 'only App.jsx mounts a page' },
];

export default async function boundaryBreaks(ctx) {
  const g = await graph(ctx);
  const known = worlds(g.files);
  const detail = [];
  for (const { from, to } of g.edges) {
    // a test goes beside its file (RULES.md), so importing it crosses nothing
    if (g.isTest(from) && dirname(from) === dirname(to)) continue;
    const rule = RULES.find((r) => {
      const a = from.match(r.from);
      const b = to.match(r.to);
      return a && b && !r.unless?.(a[1], b[1], to, known);
    });
    if (rule) detail.push({ file: `${from} → ${to}`, n: 1, note: rule.why });
  }
  return metric({
    id: 'boundary-breaks',
    label: 'imports across a line docs/health/RULES.md draws',
    unit: 'imports',
    value: detail.length,
    detail,
  });
}
