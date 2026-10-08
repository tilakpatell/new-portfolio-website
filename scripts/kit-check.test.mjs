import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPack, orphans } from './kit-check.mjs';

// a pack of two models in one family file, credited as the import writes it
const manifest = (pack = 'tiny') => ({
  pack,
  licence: 'CC0-1.0',
  source: 'Quaternius, Tiny Kit (https://quaternius.com)',
  models: {
    Rock_1: { family: 'rock', file: 'rock.glb', tris: 10, tris1: 4, kind: 'rock' },
    Rock_2: { family: 'rock', file: 'rock.glb', tris: 12, tris1: 5, kind: 'rock' },
  },
  materials: {},
});

let dirs = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
// a pack folder of these files ({ name: bytes | text })
function folder(pack, files) {
  const root = mkdtempSync(join(tmpdir(), 'kit-check-'));
  dirs.push(root);
  const dir = join(root, pack);
  mkdirSync(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), typeof body === 'number' ? Buffer.alloc(body) : body);
  return dir;
}

describe('a kit pack’s orphans', () => {
  it('are the GLBs in its folder that no model’s file is, in name order', () => {
    expect(orphans(manifest(), ['rock.glb', 'index.json'])).toEqual([]);
    expect(orphans(manifest(), ['rock.glb', 'rock-2.glb', 'index.json', 'Birch.GLB', 'notes.txt'])).toEqual(['Birch.GLB', 'rock-2.glb']);
  });
});

describe('checking a kit pack’s folder', () => {
  it('is clean when the manifest and its files agree', () => {
    const dir = folder('tiny', { 'index.json': JSON.stringify(manifest()), 'rock.glb': 2048 });
    const p = checkPack(dir);
    expect(p).toMatchObject({ pack: 'tiny', models: 2, files: { 'rock.glb': 2048 }, errors: [] });
    expect(p.index).toBeGreaterThan(0);
  });

  it('flags a GLB no model is in, a missing file and a manifest of another pack, each with the pack named', () => {
    const m = manifest('other');
    m.models.Tree_1 = { family: 'tree', file: 'tree.glb', tris: 10, tris1: 4, kind: 'tree' };
    const dir = folder('tiny', { 'index.json': JSON.stringify(m), 'rock.glb': 2048, 'rock-2.glb': 1024, 'readme.txt': 'kept' });
    const { errors } = checkPack(dir);
    expect(errors).toEqual([
      expect.stringMatching(/^tiny: .*"other"/),
      expect.stringMatching(/^tiny: Tree_1.*tree\.glb.*missing/),
      expect.stringMatching(/^tiny: rock-2\.glb is no model's file/),
    ]);
  });

  it('flags a folder with no manifest, or one that is not JSON', () => {
    expect(checkPack(folder('bare', { 'rock.glb': 10 })).errors).toEqual(['bare: no index.json']);
    expect(checkPack(folder('torn', { 'index.json': '{ "pack":' })).errors).toEqual([expect.stringMatching(/^torn: index\.json is not JSON/)]);
  });

  it('is clean on every pack committed in public/kit', () => {
    const kit = join(import.meta.dirname, '..', 'public', 'kit');
    const packs = readdirSync(kit, { withFileTypes: true }).filter((d) => d.isDirectory());
    expect(packs.length).toBeGreaterThan(0);
    for (const d of packs) expect(checkPack(join(kit, d.name)).errors, d.name).toEqual([]);
  });
});
