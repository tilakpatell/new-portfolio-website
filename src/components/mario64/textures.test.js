import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AREAS, buildArea } from './courses/index';
import { MATS, setUrl } from './textures';

const PUBLIC = fileURLToPath(new URL('../../../public/', import.meta.url));

describe('the material table', () => {
  const used = new Set();
  for (const id of Object.keys(AREAS)) {
    const { built } = buildArea(id);
    for (const mat of built.meshes.keys()) used.add(mat);
    for (const t of built.terrains) for (const mat of t.mats) used.add(mat);
  }

  it.each([...used])('has %s, made of something that exists', (mat) => {
    const m = MATS[mat];
    expect(m, `no MATS entry for ${mat}`).toBeDefined();
    if (m.set) {
      for (const map of ['color', 'normal', 'arm']) {
        expect(existsSync(join(PUBLIC, setUrl(m.set, map, false))), `${m.set} ${map}`).toBe(true);
        expect(existsSync(join(PUBLIC, setUrl(m.set, map, true))), `${m.set} ${map} small`).toBe(true);
      }
    } else expect(m.color ?? m.canvas).toBeDefined();
  });

  it('points a set at its files, small ones for phones', () => {
    expect(setUrl('grass', 'color', false)).toBe('/hq/tex/grass/color.webp');
    expect(setUrl('grass', 'normal', true)).toBe('/hq/tex/grass/normal-512.jpg');
  });
});
