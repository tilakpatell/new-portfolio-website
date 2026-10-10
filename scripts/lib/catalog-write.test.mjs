import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalogueLine, writeCatalogueLine, writeCredit } from './catalog-write.mjs';

const MODELS = `// a group
export const MODELS = {
  snowtrooper: { made: 'battlefront', as: 'the snowtroopers', metres: 1.83, along: 'y', yaw: 0, tris: 8000, tex: 1024 },
  clone: { made: 'battlefront', as: 'the clone troopers', metres: 1.83, along: 'y', yaw: 0, tris: 8000, tex: 1024 },
};
`;

describe('the catalogue and credit writers', () => {
  it('writes a line the way the catalogue files are written', () => {
    expect(catalogueLine('hilt', { made: 'bf2017', as: 'the hilt', metres: 0.28, ultra: { tris: 900, tex: 2048 } })).toBe("  hilt: { made: 'bf2017', as: 'the hilt', metres: 0.28, ultra: { tris: 900, tex: 2048 } },");
    expect(catalogueLine('x', { as: 'Luke’s, the one, with commas', rig: true, ultraUrl: '/a.glb', list: [1, 'b'] })).toBe("  x: { as: 'Luke’s, the one, with commas', rig: true, ultraUrl: '/a.glb', list: [1, 'b'] },");
    expect(catalogueLine('y', { as: "it's" })).toBe("  y: { as: 'it\\'s' },");
    // (the old importer's line, unchanged)
    expect(catalogueLine('snowtrooper', { made: 'battlefront', as: 'the snowtroopers', metres: 1.83, along: 'y', yaw: 0, tris: 8000, tex: 1024 })).toBe(MODELS.split('\n')[2]);
  });

  it('appends a new kind, and replaces an old one where it is', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'catalog-'));
    const file = join(dir, 'g.js');
    await writeFile(file, MODELS);
    await writeCatalogueLine(file, 'hilt', { made: 'bf2017', as: 'the hilt' });
    await writeCatalogueLine(file, 'snowtrooper', { made: 'battlefront', as: 'new' });
    const lines = (await readFile(file, 'utf8')).split('\n');
    expect(lines[2]).toBe("  snowtrooper: { made: 'battlefront', as: 'new' },");
    expect(lines[4]).toBe("  hilt: { made: 'bf2017', as: 'the hilt' },");
    expect(lines[5]).toBe('};');
    const empty = join(dir, 'e.js');
    await writeFile(empty, '// none yet\nexport const MODELS = {};\n');
    await writeCatalogueLine(empty, 'hilt', { as: 'a' });
    expect(await readFile(empty, 'utf8')).toBe("// none yet\nexport const MODELS = {\n  hilt: { as: 'a' },\n};\n");
  });

  it('adds a credit and keeps the keys sorted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'credits-'));
    const file = join(dir, 'c.json');
    await writeFile(file, JSON.stringify({ b: { title: 'b' }, d: { title: 'd' } }));
    await writeCredit(file, 'c', { title: 'c' });
    expect(Object.keys(JSON.parse(await readFile(file, 'utf8')))).toEqual(['b', 'c', 'd']);
    expect((await readFile(file, 'utf8')).endsWith('}\n')).toBe(true);
  });
});
