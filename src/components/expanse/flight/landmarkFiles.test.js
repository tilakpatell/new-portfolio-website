import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { PLANETS, planetSpecOf } from '../../../lib/land/flight/planetSpec';
import { WORLD_MB } from '../../worlds/worlds';
import { PACK } from './pack';
import { landmarkFiles } from './landmarkFiles';

const pub = (u) => new URL(`../../../../public${u}`, import.meta.url);
const kits = Object.fromEntries(['naturemega', 'space'].map((p) => [p, JSON.parse(readFileSync(pub(`/kit/${p}/index.json`), 'utf8'))]));
const mb = (urls) => urls.reduce((n, u) => n + statSync(pub(u)).size, 0) / 1e6;
// what the flight fetches besides its landmarks (worlds.js's own line): the scans and Coruscant's models
const BASE_MB = 5;

describe('landmarkFiles', () => {
  it('names only files that are there', () => {
    for (const { id } of PLANETS) for (const u of landmarkFiles(planetSpecOf(id), { kits })) expect(() => statSync(pub(u)), `${id}: ${u}`).not.toThrow();
  });

  it('keeps the flight’s download over the heaviest planet’s, measured', () => {
    const heaviest = Math.max(...PLANETS.map(({ id }) => mb(landmarkFiles(planetSpecOf(id), { kits }))));
    expect(heaviest).toBeGreaterThan(1);
    expect(WORLD_MB['/fly']).toBeGreaterThanOrEqual(BASE_MB + heaviest);
    // (and not far over it: a figure that's grown stale says so)
    expect(WORLD_MB['/fly']).toBeLessThan(BASE_MB + heaviest + 2);
  });

  it('lists every file in the install’s pack, at every level', () => {
    const listed = new Set(PACK.urls);
    for (const { id } of PLANETS) for (const level of ['low', 'mid', 'high']) for (const u of landmarkFiles(planetSpecOf(id), { kits, level })) expect(listed.has(u), `${id} ${level}: ${u}`).toBe(true);
  });

  it('leaves the kit clutter out on low', () => {
    const low = landmarkFiles(planetSpecOf('endor'), { kits, level: 'low' });
    expect(low.some((u) => u.endsWith('tallthick.glb'))).toBe(false);
    expect(landmarkFiles(planetSpecOf('endor'), { kits }).some((u) => u.endsWith('tallthick.glb'))).toBe(true);
  });
});
