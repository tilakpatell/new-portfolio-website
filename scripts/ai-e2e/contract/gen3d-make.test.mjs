// Tier 1: make.mjs end to end with the fake engine, picture, Blender and
// judge: what lands in public/ (three cuts within budget, a credit), what
// lands in the cache (result.json, the sheet, the log) and what each
// option changes.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cutsFor, triangles } from '../../gen3d/budget.mjs';
import { layout } from '../../gen3d/judge.mjs';
import { FIXTURES, sandbox } from './repo.mjs';

const REF = join(FIXTURES, 'x-wing-ref.png');
let io;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
});
const cut = (box, name, suffix) => join(box.out, 'public', 'models', 'gen3d', `${name}${suffix}.glb`);
const sizeOf = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];

describe('make.mjs with every engine faked (subprocesses, up to 10 s)', () => {
  it('makes three cuts within the budget asked for, credits the model and keeps its outcome', async () => {
    const box = sandbox();
    const r = await box.make(['xw', '--image', REF, '--what', 'an X-wing starfighter', '--faces', '8000', '--seed', '1'], { GEN3D_FAKE_TRIS: '20000' });
    expect(r.status, r.err).toBe(0);
    const want = cutsFor(8000);
    for (const [tier, c] of Object.entries(want)) {
      const doc = await io.read(cut(box, 'xw', c.suffix));
      const tris = triangles(doc);
      // within the budget, and cut down to it rather than left as made
      expect(tris, tier).toBeLessThanOrEqual(c.faces * 1.05);
      expect(tris, tier).toBeGreaterThan(c.faces * 0.5);
    }
    const credits = JSON.parse(readFileSync(join(box.out, 'public', 'games', 'credits.json'), 'utf8'));
    expect(credits['gen3d/xw'].name).toMatch(/^an X-wing starfighter, made for this site/);
    const result = JSON.parse(readFileSync(join(box.cache, 'xw', 'result.json'), 'utf8'));
    expect(result).toMatchObject({ name: 'xw', what: 'an X-wing starfighter', seed: 1, verdict: { score: 9, ok: true } });
    expect(Object.keys(result.cuts)).toEqual(['hq', 'mid', 'lo']);
    // the sheet: the raw model's row and the web cut's, four views each
    const { width, height } = layout(2);
    expect(sizeOf(readFileSync(join(box.cache, 'xw', 'sheet.png')))).toEqual([width, height]);
    const log = readFileSync(join(box.cache, 'xw', 'make.log'), 'utf8');
    for (const step of [/raw model with fake/, /baked to 8000 faces/, /hq: \d+ triangles/, /mid: \d+ triangles/, /lo: \d+ triangles/, /judge: .*sheet\.png/, /verdict: 9\/10/]) expect(log).toMatch(step);
  });

  it('makes a fourth cut, .ultra, when asked, the bake at its size and the others as before', async () => {
    const box = sandbox();
    const r = await box.make(['xu', '--image', REF, '--what', 'an X-wing starfighter', '--faces', '20000', '--ultra', '--no-judge'], { GEN3D_FAKE_TRIS: '30000' });
    expect(r.status, r.err).toBe(0);
    const want = cutsFor(20000, undefined, { ultra: true });
    expect(Object.keys(want)).toEqual(['ultra', 'hq', 'mid', 'lo']);
    for (const [tier, c] of Object.entries(want)) {
      const tris = triangles(await io.read(cut(box, 'xu', c.suffix)));
      expect(tris, tier).toBeLessThanOrEqual(c.faces * 1.05);
      expect(tris, tier).toBeGreaterThan(c.faces * 0.5);
    }
    expect(readFileSync(join(box.cache, 'xu', 'make.log'), 'utf8')).toMatch(/baked to 20000 faces/);
    // and without it, no fourth cut
    const plain = sandbox();
    expect((await plain.make(['xp2', '--image', REF, '--what', 'x', '--faces', '8000', '--no-judge'])).status).toBe(0);
    expect(existsSync(cut(plain, 'xp2', '.ultra'))).toBe(false);
  });

  it('caps every cut’s texture at the size asked for', async () => {
    const box = sandbox();
    const r = await box.make(['tex', '--image', REF, '--what', 'a box', '--faces', '8000', '--tex', '512', '--no-judge'], { GEN3D_FAKE_TEX: '1024' });
    expect(r.status, r.err).toBe(0);
    for (const c of Object.values(cutsFor(8000, 512))) {
      const doc = await io.read(cut(box, 'tex', c.suffix));
      for (const t of doc.getRoot().listTextures()) {
        expect(t.getMimeType()).toBe('image/webp');
        expect(Math.max(...t.getSize())).toBeLessThanOrEqual(512);
      }
    }
  });

  it('draws concept pictures from a prompt and keeps the one the judge likes best', async () => {
    const box = sandbox();
    const r = await box.make(['xp', '--prompt', 'an X-wing starfighter', '--candidates', '3', '--faces', '4000', '--no-judge']);
    expect(r.status, r.err).toBe(0);
    expect(box.fakes('picture')).toHaveLength(3);
    expect(box.judged().map((c) => c.images[0])).toEqual([1, 2, 3].map((i) => join(box.cache, 'xp', `concept-${i}.png`)));
    expect(readFileSync(join(box.cache, 'xp', 'make.log'), 'utf8')).toMatch(/picked concept 1: 8 8 8 of 10/);
  });

  it('writes nothing under the repository’s own public/ when GEN3D_OUT is set', async () => {
    const box = sandbox();
    await box.make(['only-out', '--image', REF, '--what', 'a box', '--faces', '4000', '--no-judge']);
    expect(existsSync(cut(box, 'only-out', ''))).toBe(true);
    expect(existsSync(join(box.root, 'public', 'models', 'gen3d', 'only-out.glb'))).toBe(false);
  });
});
