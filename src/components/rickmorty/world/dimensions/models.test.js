// Every destination's people, crowd and props have a model on disk, with
// idle and walk clips for the rigged ones: a kind with no file would stand
// nobody there (stage.js leaves a figure that won't load out), and nothing
// else would say so.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESHY, RIGGED, assetUrl } from '../../portal/meshyCast';
import { DESTINATIONS } from './destinations';

describe('the destinations’ models', () => {
  it('are all in public/, clips and all', () => {
    const missing = [];
    for (const d of DESTINATIONS) {
      const kinds = new Set([...d.kinds, ...d.people.map((p) => p.who ?? p.id), ...d.extras.map((e) => e.kind)]);
      for (const k of kinds) {
        const m = MESHY[k];
        if (!m) {
          missing.push(`${d.id}: ${k} is not in the cast`);
          continue;
        }
        const url = assetUrl(m.a);
        if (!existsSync(`public${url}`)) missing.push(`${d.id}: ${url}`);
        if (RIGGED.has(m.a)) for (const c of ['idle', 'walk']) if (!existsSync(`public${url.replace('.glb', `-${c}.glb`)}`)) missing.push(`${d.id}: ${url} has no ${c} clip`);
      }
    }
    expect(missing).toEqual([]);
  });
});
