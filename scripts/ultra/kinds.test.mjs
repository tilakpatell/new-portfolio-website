import { describe, expect, it } from 'vitest';
import { commandFor, isBuiltKind, pick, sourceOf } from './kinds.mjs';

const models = {
  hall: { group: 'made', made: 'meshy', hero: true },
  palace: { group: 'made', made: 'meshy', hero: true, lod: true },
  tower: { group: 'made', made: 'meshy' },
  hut: { group: 'desert', uid: 'abc', tris: 3000, tex: 512 },
  walker: { group: 'ice', uid: 'def', hero: true, tris: 40000, tex: 2048 },
  crate: { group: 'common', uid: 'ghi' },
  trooper: { group: 'battlefront', made: 'battlefront' },
  palm: { group: 'edge', uid: 'jkl' },
};
const counts = {
  naboo: { hall: 13, palace: 1, hut: 2, crate: 9 },
  hoth: { walker: 1, crate: 6, palm: 600, trooper: 4 },
  bespin: { tower: 14, hut: 3 },
};

describe('the kinds that get an ultra cut', () => {
  it('are buildings and vehicles: not crates, people, troopers or ground cover', () => {
    expect(isBuiltKind('hall', models.hall)).toBe(true);
    expect(isBuiltKind('crate', models.crate)).toBe(false);
    expect(isBuiltKind('trooper', models.trooper)).toBe(false);
    expect(isBuiltKind('palm', models.palm)).toBe(false);
    expect(isBuiltKind('nothing', undefined)).toBe(false);
  });

  it('are every world’s landmark first (its most-placed hero), then the most-placed, cut to n', () => {
    const picks = pick(counts, models, { n: 3 });
    expect(picks.map((p) => p.kind)).toEqual(['hall', 'walker', 'tower']);
    expect(picks[0]).toEqual({ kind: 'hall', placed: 13, worlds: ['naboo'], role: 'landmark' });
    expect(picks[1].role).toBe('landmark');
    expect(picks[2]).toEqual({ kind: 'tower', placed: 14, worlds: ['bespin'], role: 'placed' });
    // (hut stands on two worlds: counted together, listed once)
    expect(pick(counts, models).find((p) => p.kind === 'hut')).toEqual({ kind: 'hut', placed: 5, worlds: ['naboo', 'bespin'], role: 'placed' });
    expect(pick(counts, models).map((p) => p.kind)).not.toContain('crate');
  });

  it('say where the plain model came from, and the lane whose tasks file holds it', () => {
    const lanes = { 'scripts/meshy-galaxy-buildings-tasks.json': ['hall'], 'scripts/meshy-galaxy-three-tasks.json': ['tower'] };
    expect(sourceOf('hall', models.hall, lanes)).toEqual({ source: 'meshy', lane: 'scripts/meshy-galaxy-buildings-tasks.json', group: 'made' });
    expect(sourceOf('palace', models.palace, lanes)).toEqual({ source: 'meshy', lane: null, group: 'made' });
    // (the great wroshyr's task is Kachirho's, unless a lane remade it under its own name)
    expect(sourceOf('wroshyrgreat', models.palace, { fill: ['kachirho'] })).toEqual({ source: 'meshy', lane: 'fill', group: 'made', task: 'kachirho' });
    expect(sourceOf('wroshyrgreat', models.palace, { fill: ['kachirho'], ultra: ['wroshyrgreat'] })).toEqual({ source: 'meshy', lane: 'ultra', group: 'made' });
    // (a kind in two lanes is the later lane's: its entry takes over the earlier one's)
    expect(sourceOf('hall', models.hall, { fill: ['hall'], ultra: ['hall'] }).lane).toBe('ultra');
    expect(sourceOf('hut', models.hut, lanes)).toEqual({ source: 'sketchfab', lane: null, group: 'desert' });
    expect(sourceOf('ship', { group: 'library', url: '/models/gen3d/x-wing.glb' })).toEqual({ source: 'gen3d', lane: null, group: 'library' });
  });

  it('give the owner the command for the ultra cut', () => {
    expect(commandFor('hall', { source: 'meshy', lane: 'scripts/meshy-galaxy-buildings-tasks.json' })).toBe(
      'MESHY_TASKS=scripts/meshy-galaxy-buildings-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra hall && MESHY_TASKS=scripts/meshy-galaxy-buildings-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra hall',
    );
    expect(commandFor('palace', { source: 'meshy', lane: null })).toMatch(/^MESHY_TASKS=scripts\/meshy-galaxy-buildings-fill-tasks.json /);
    expect(commandFor('wroshyrgreat', { source: 'meshy', lane: 'fill.json', task: 'kachirho' })).toBe(
      'MESHY_TASKS=fill.json node scripts/meshy-galaxy-buildings.mjs models --ultra kachirho && MESHY_TASKS=fill.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra kachirho && mv public/models/galaxy/surface/kachirho.ultra.glb public/models/galaxy/surface/wroshyrgreat.ultra.glb',
    );
    expect(commandFor('hut', { source: 'sketchfab', group: 'desert' })).toBe('node scripts/sketchfab-surface.mjs desert --ultra hut');
    expect(commandFor('x-wing', { source: 'gen3d' })).toContain('ask.mjs gen3d x-wing --faces 300000 --options "tex: 8192  ultra: yes"');
    expect(commandFor('x', { source: 'unknown' })).toBeNull();
  });
});
