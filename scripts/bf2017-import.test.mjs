import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dims, triangles } from './lib/surface-model.mjs';

const HILT = 'gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh';
const FIXTURE = 'scripts/fixtures/bf2017';
const PERMISSION = 'From EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project; Star Wars and everything in it belong to Lucasfilm.';
const reader = async () => {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
};
async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), 'bf2017-import-'));
  await writeFile(join(dir, 'bf2017.js'), 'export const MODELS = {};\n');
  await writeFile(join(dir, 'credits.json'), '{}\n');
  return dir;
}
const args = (dir, name, more = []) => ['scripts/bf2017-import.mjs', name, '--root', FIXTURE, '--kind', 'hiltfixture', '--as', 'the fixture hilt', '--out', dir, '--catalog', join(dir, 'bf2017.js'), '--credits', join(dir, 'credits.json'), '--unpacked', join(dir, 'unpacked'), ...more];

describe('the 2017 import', () => {
  it('turns the fixture hilt into the site’s file, row and credit', { timeout: 10000 }, async () => {
    const dir = await scratch();
    const said = execFileSync('node', args(dir, HILT, ['--asis', '--tex', '64', '--maps', '32']), { encoding: 'utf8' });
    expect(said).toMatch(/glb-shot\.mjs/);
    const doc = await (await reader()).read(join(dir, 'surface', 'hiltfixture.glb'));
    const root = doc.getRoot();
    expect(root.listScenes().length).toBe(1);
    const used = root.listExtensionsUsed().map((e) => e.extensionName);
    expect(used).toContain('EXT_meshopt_compression');
    expect(used).toContain('EXT_texture_webp');
    expect(used).not.toContain('KHR_texture_basisu');
    const sizes = root
      .listTextures()
      .map((t) => t.getSize()[0])
      .sort((a, b) => a - b);
    expect(sizes).toEqual([32, 32, 64]);
    const mat = root.listMaterials()[0];
    expect(mat.getBaseColorTexture().getSize()).toEqual([64, 64]);
    expect(mat.getNormalTexture()).toBeTruthy();
    expect(mat.getMetallicRoughnessTexture()).toBeTruthy();
    expect(mat.getExtras()).toEqual({});
    expect(triangles(doc)).toBe(920);
    const manifest = JSON.parse((await readFile(join(FIXTURE, 'web', 'models.jsonl'), 'utf8')).trim());
    const tall = manifest.max[1] - manifest.min[1];
    expect(Math.abs(dims(doc)[1] - tall) / tall).toBeLessThan(0.01);
    const { min } = (await import('./lib/surface-model.mjs')).bounds(doc, root.listScenes()[0]);
    expect(Math.abs(min[1])).toBeLessThan(0.001);
    expect(root.listNodes().some((n) => n.getName() === 'grip')).toBe(true);
    expect(existsSync(join(dir, 'surface', 'hiltfixture.lod1.glb'))).toBe(false);
    const rows = (await readFile(join(dir, 'bf2017.js'), 'utf8')).split('\n').filter((l) => l.startsWith('  hiltfixture: '));
    expect(rows.length).toBe(1);
    expect(rows[0].startsWith("  hiltfixture: { made: 'bf2017'")).toBe(true);
    expect(rows[0]).toContain(`from: '${HILT}'`);
    const credit = JSON.parse(await readFile(join(dir, 'credits.json'), 'utf8'))['surface-hiltfixture'];
    expect(credit.license).toBe('permission');
    expect(credit.permission).toBe(PERMISSION);
    expect(credit.author).toBe('EA DICE');
    expect(credit.file).toBe('/models/galaxy/surface/hiltfixture.glb');
  });

  it('refuses the sequel era, and writes nothing', async () => {
    const dir = await scratch();
    const r = spawnSync('node', args(dir, 'characters/hero/kyloren/x'), { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/sequel-era/);
    expect(readdirSync(dir).sort()).toEqual(['bf2017.js', 'credits.json']);
    expect(await readFile(join(dir, 'bf2017.js'), 'utf8')).toBe('export const MODELS = {};\n');
  });
});
