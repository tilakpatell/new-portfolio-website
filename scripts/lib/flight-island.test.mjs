import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ISLAND, MIGRATION, apply, check, inIsland, isMarked, markedSpans, referencesIn, removal, withoutDeps } from './flight-island.mjs';

const ROOT = fileURLToPath(new URL('../fixtures/flight-island', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const FILES = walk(ROOT).map((f) => relative(ROOT, f)).sort();
const TEXT = Object.fromEntries(FILES.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]));
// the fixture's own rows: the files in it that carry a marker
const island = { ...ISLAND, rows: ['.github/workflows/ci.yml', 'src/App.jsx', 'src/components/guide/routes.js', 'src/components/worlds/looks.js', 'src/components/worlds/packs.js'] };

// a tree in memory over the fixture: what apply() changes, nothing on disk
function fakeTree() {
  const files = new Map(Object.entries(TEXT));
  return {
    get files() {
      return [...files.keys()].sort();
    },
    read: (f) => files.get(f) ?? null,
    write: (f, t) => files.set(f, t),
    remove: (f) => files.delete(f),
  };
}

describe('the markers', () => {
  it('finds a row, a JSX row and a block', () => {
    const app = TEXT['src/App.jsx'].split('\n');
    expect(markedSpans(app).map((s) => [s.from, s.to])).toEqual([[2, 2], [8, 8]]);
    const routes = TEXT['src/components/guide/routes.js'].split('\n');
    expect(markedSpans(routes)).toEqual([{ from: 2, to: 4, block: true }]);
    expect(isMarked(routes, 3)).toBe(true);
    expect(isMarked(routes, 1)).toBe(false);
    expect(isMarked(routes, 5)).toBe(false);
  });

  it('reads references, not look-alikes', () => {
    expect(referencesIn("'/fly',\n'/universe/fly',\n'/audio/clips/fly-you-fools.mp3',\n[/^\\/fly\\/x$/]").map((r) => r.line)).toEqual([1, 4]);
  });
});

describe('check', () => {
  const r = check({ files: FILES, read: (f) => TEXT[f] ?? null }, island);

  it('finds the one unmarked reference and the one stale marker, and nothing else', () => {
    expect(r.unmarked).toEqual([{ file: 'src/components/tour/brief.js', line: 3, text: "'/fly'," }]);
    expect(r.stale).toEqual([{ file: 'src/components/worlds/looks.js', line: 2, text: "{ folder: 'galaxy', routes: ['/galaxy'] }, // planet flight" }]);
    expect(r.outsideImports).toEqual([]);
    expect(r.crossWorld).toEqual([]);
    expect(r.unlisted).toEqual([]);
    expect(r.missing).toEqual([]);
  });

  it('takes a marked row that uses a name a marked import binds as a reference', () => {
    expect(r.stale.some((s) => s.file === 'src/components/worlds/packs.js')).toBe(false);
  });

  it('reports a world reached past its face, an import into the island, and the inventory’s drift', () => {
    const text = {
      ...TEXT,
      'src/components/expanse/flight/scene.js': "import { SURFACE_MODELS } from '../../galaxy/surface/catalog';\n",
      'src/components/music/scene.js': "import { planetField } from '../../lib/land/flight/field.js'; // planet flight\n",
    };
    const files = [...FILES, 'src/components/music/scene.js'].sort();
    const x = check({ files, read: (f) => text[f] ?? null }, { ...island, rows: [...island.rows, 'src/nowhere.js'] });
    expect(x.crossWorld).toEqual([{ file: 'src/components/expanse/flight/scene.js', line: 1, text: "import { SURFACE_MODELS } from '../../galaxy/surface/catalog';" }]);
    expect(x.outsideImports.map((o) => o.file)).toEqual(['src/components/music/scene.js']);
    expect(x.unlisted).toEqual(['src/components/music/scene.js']);
    expect(x.missing).toEqual(['src/nowhere.js']);
  });
});

describe('removal', () => {
  const plan = removal({ files: FILES, read: (f) => TEXT[f] ?? null }, { date: '2026-10-10', island });

  it('deletes the island’s files and nothing else', () => {
    expect(plan.delete).toEqual(['src/components/expanse/flight/pack.js', 'src/components/expanse/flight/scene.js', 'src/pages/Fly.jsx']);
    expect(plan.delete.every((f) => inIsland(f))).toBe(true);
  });

  it('drops the marked rows, a block as its whole span, and never a decoy', () => {
    const by = Object.fromEntries(plan.dropLines.map((d) => [d.file, d.lines]));
    expect(by['src/App.jsx'].map((l) => l.line)).toEqual([3, 9]);
    expect(by['src/components/guide/routes.js'].map((l) => l.line)).toEqual([3, 4, 5]);
    expect(by['.github/workflows/ci.yml'].map((l) => l.line)).toEqual([5, 6, 7]);
    const dropped = plan.dropLines.flatMap((d) => d.lines.map((l) => l.text));
    for (const decoy of ['Galaxy', 'Music', '/galaxy', '/music', 'flyto-check', '--universe']) expect(dropped.some((t) => t.includes(decoy) && !t.includes('planet flight')), decoy).toBe(false);
  });

  it('writes the migration that drops the four objects, and the decision', () => {
    for (const s of ['get_entities_in_bounding_box', 'damage_entity', 'table if exists public.world_entities', 'table if exists public.planets', 'table if exists public.entity_hits', 'supabase_realtime']) expect(plan.migration).toContain(s);
    expect(plan.migration).toBe(MIGRATION);
    expect(plan.migrationFile).toBe('supabase/migrations/20261010000000_drop_planet_flight.sql');
    expect(plan.decisionFile).toBe('docs/decisions/2026-10-10-planet-flight-retired.md');
    expect(plan.deps).toEqual(['fastnoise-lite']);
    expect(plan.byHand.length).toBeGreaterThan(0);
  });

  it('applies: the decoys byte for byte, the island gone, the dependency out', () => {
    const tree = apply(plan, fakeTree());
    expect(tree.read('src/App.jsx')).toBe(TEXT['src/App.jsx'].split('\n').filter((_, i) => i !== 2 && i !== 8).join('\n'));
    expect(tree.read('src/components/guide/routes.js')).toBe("export const ROUTES = {\n  '/galaxy': { title: 'Galaxy' },\n  '/music': { title: 'Music' },\n};\n");
    expect(tree.read('src/components/tour/brief.js')).toBe(TEXT['src/components/tour/brief.js']);
    expect(tree.read('src/pages/Fly.jsx')).toBeNull();
    expect(JSON.parse(tree.read('package.json')).dependencies).toEqual({ three: '0.180.0' });
    expect(tree.read('supabase/migrations/20261010000000_drop_planet_flight.sql')).toBe(MIGRATION);
  });

  it('keeps package.json’s layout', () => {
    expect(withoutDeps('{\n  "a": 1,\n  "dependencies": { "x": "1", "y": "2" }\n}\n', ['x'])).toBe('{\n  "a": 1,\n  "dependencies": {\n    "y": "2"\n  }\n}\n');
  });
});
