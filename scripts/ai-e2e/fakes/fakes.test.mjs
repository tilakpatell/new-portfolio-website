// The stand-ins the contract tests run the pipelines with: each sits behind
// a seam the real pipeline already has, so what is tested is the real
// orchestration with only the engine swapped.
import { NodeIO } from '@gltf-transform/core';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { png } from './png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, 'engine.mjs');
const sha = (f) => createHash('sha1').update(readFileSync(f)).digest('hex');
const tmp = () => mkdtempSync(join(tmpdir(), 'ai-e2e-'));
const engine = (args, env = {}) => spawnSync(process.execPath, [ENGINE, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
const triangles = async (file) => {
  const doc = await new NodeIO().read(file);
  return doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + p.getIndices().getCount() / 3, 0), 0);
};

// the env each test sets, put back after it
let saved;
beforeEach(() => {
  saved = { ...process.env };
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});

describe('the fake engine (subprocesses, up to 10 s)', () => {
  const picture = (dir, name, byte = 0) => {
    const file = join(dir, name);
    const p = png(8, 8, () => [byte, 128, 128, 255]);
    writeFileSync(file, p);
    return file;
  };
  it('makes the same textured GLB from the same picture, byte for byte', () => {
    const dir = tmp();
    const a = picture(dir, 'a.png');
    expect(engine([a, join(dir, '1.glb')]).status).toBe(0);
    expect(engine([a, join(dir, '2.glb')]).status).toBe(0);
    expect(sha(join(dir, '1.glb'))).toBe(sha(join(dir, '2.glb')));
  });
  it('makes a different one when the picture changes by a byte, or the seed does', () => {
    const dir = tmp();
    engine([picture(dir, 'a.png', 0), join(dir, 'a.glb')]);
    engine([picture(dir, 'b.png', 1), join(dir, 'b.glb')]);
    engine([join(dir, 'a.png'), join(dir, 'c.glb'), '--seed', '2']);
    expect(sha(join(dir, 'a.glb'))).not.toBe(sha(join(dir, 'b.glb')));
    expect(sha(join(dir, 'a.glb'))).not.toBe(sha(join(dir, 'c.glb')));
  });
  it('is a box of a dozen triangles with one 64² texture, or as many triangles as asked', async () => {
    const dir = tmp();
    const a = picture(dir, 'a.png');
    engine([a, join(dir, 'box.glb')]);
    expect(await triangles(join(dir, 'box.glb'))).toBe(12);
    const doc = await new NodeIO().read(join(dir, 'box.glb'));
    expect(doc.getRoot().listTextures().map((t) => t.getSize())).toEqual([[64, 64]]);
    engine([a, join(dir, 'big.glb'), '--tris', '30000']);
    expect(await triangles(join(dir, 'big.glb'))).toBeGreaterThanOrEqual(30000);
    engine([a, join(dir, 'env.glb')], { GEN3D_FAKE_TRIS: '500' });
    expect(await triangles(join(dir, 'env.glb'))).toBeGreaterThanOrEqual(500);
  });
  it('fails when told to, leaving half a file, as a crashed engine does', () => {
    const dir = tmp();
    const a = picture(dir, 'a.png');
    const r = engine([a, join(dir, 'x.glb'), '--fail-at', 'generate']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/fake engine: failing at generate/);
    engine([a, join(dir, 'whole.glb')]);
    expect(statSync(join(dir, 'x.glb')).size).toBeLessThan(statSync(join(dir, 'whole.glb')).size);
    expect(engine([a, join(dir, 'y.glb')], { GEN3D_FAKE_FAIL_AT: 'generate' }).status).toBe(1);
    // a failure meant for another step leaves this one alone
    expect(engine([a, join(dir, 'z.glb')], { GEN3D_FAKE_FAIL_AT: 'bake' }).status).toBe(0);
  });
  it('writes down how it was called, for the tests that ask which pictures it saw', () => {
    const dir = tmp();
    const a = picture(dir, 'a.png');
    const log = join(dir, 'calls.jsonl');
    engine([a, join(dir, 'o.glb'), '--seed', '7', '--left', a], { GEN3D_FAKE_LOG: log });
    const [call] = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(call.tool).toBe('engine');
    expect(call.argv).toEqual([a, join(dir, 'o.glb'), '--seed', '7', '--left', a]);
  });
});

describe('the fake engine behind generate.mjs (subprocesses, up to 10 s)', () => {
  it('is what GEN3D_ENGINE=fake picks, through the same generate() the pipeline calls', async () => {
    const dir = tmp();
    const a = join(dir, 'a.png');
    writeFileSync(a, png(8, 8, () => [9, 9, 9, 255]));
    process.env.GEN3D_ENGINE = 'fake';
    const { generate } = await import('../../gen3d/generate.mjs');
    const r = await generate(a, join(dir, 'raw.glb'), { seed: 3 });
    expect(r.engine).toBe('fake');
    expect(existsSync(join(dir, 'raw.glb'))).toBe(true);
  });
});

describe('the fake concept picture (subprocesses, up to 10 s)', () => {
  it('draws four candidates that differ, one per seed', async () => {
    const dir = tmp();
    process.env.GEN3D_PICTURE = 'fake';
    const { picture } = await import('../../gen3d/picture.mjs');
    const files = [];
    for (const seed of [1, 2, 3, 4]) {
      const out = join(dir, `concept-${seed}.png`);
      await picture('an X-wing', out, { seed });
      files.push(out);
    }
    expect(new Set(files.map(sha)).size).toBe(4);
    expect(readFileSync(files[0]).subarray(1, 4).toString()).toBe('PNG');
    // the size the real one draws at, so prepare.mjs and the engines see what they would
    expect(readFileSync(files[0]).readUInt32BE(16)).toBe(1024);
  });
});

describe('the fake Blender (subprocesses, up to 10 s)', () => {
  it('bakes by copying, and the bake step keeps its key as it would', async () => {
    const dir = tmp();
    const raw = join(dir, 'raw.glb');
    writeFileSync(raw, 'glTF-ish');
    process.env.BLENDER = join(HERE, 'blender.mjs');
    const { bake, blender } = await import('../../gen3d/bake.mjs');
    const { once } = await import('../../gen3d/steps.mjs');
    expect(blender()).toEqual({ kind: 'windows', exe: process.env.BLENDER });
    const out = join(dir, 'baked.glb');
    const r = await once(out, 'k1', () => bake(raw, out, { faces: 8000 }));
    expect(r.reused).toBe(false);
    expect(readFileSync(out, 'utf8')).toBe('glTF-ish');
    expect(readFileSync(`${out}.key`, 'utf8')).toBe('k1');
    expect((await once(out, 'k1', () => bake(raw, out))).reused).toBe(true);
  });
  it('fails when the fakes are told to fail at the bake', async () => {
    const dir = tmp();
    writeFileSync(join(dir, 'raw.glb'), 'x');
    process.env.BLENDER = join(HERE, 'blender.mjs');
    process.env.GEN3D_FAKE_FAIL_AT = 'bake';
    const { bake } = await import('../../gen3d/bake.mjs');
    await expect(bake(join(dir, 'raw.glb'), join(dir, 'b.glb'))).rejects.toThrow(/blender exited 1/);
  });
});

describe('the fake gh (subprocesses, up to 10 s)', () => {
  const fake = (fixtures = {}) => {
    const dir = tmp();
    for (const [name, value] of Object.entries(fixtures)) writeFileSync(join(dir, `${name}.json`), JSON.stringify(value));
    process.env.GH_BIN = join(HERE, 'gh.mjs');
    process.env.GH_LOG = join(dir, 'gh.json');
    process.env.GH_FIXTURES = dir;
    return () => JSON.parse(readFileSync(process.env.GH_LOG, 'utf8'));
  };
  it('answers from its fixtures and writes down every call', async () => {
    const calls = fake({ 'pr-list': [], 'pr-create': 'https://github.com/o/r/pull/9' });
    const { pullRequest } = await import('../../desktop/lib.mjs');
    const url = pullRequest(tmp(), { branch: 'gen3d/x', title: 'T', body: 'B' });
    expect(url).toBe('https://github.com/o/r/pull/9');
    expect(calls()).toEqual([
      ['pr', 'list', '--head', 'gen3d/x', '--state', 'open', '--json', 'url', '--limit', '1'],
      ['pr', 'create', '--base', 'main', '--head', 'gen3d/x', '--title', 'T', '--body', 'B'],
    ]);
  });
  it('edits the open pull request rather than opening a second', async () => {
    const calls = fake({ 'pr-list': [{ url: 'https://github.com/o/r/pull/3' }] });
    const { pullRequest } = await import('../../desktop/lib.mjs');
    expect(pullRequest(tmp(), { branch: 'b', title: 'T', body: 'B' })).toBe('https://github.com/o/r/pull/3');
    expect(calls()[1]).toEqual(['pr', 'edit', 'https://github.com/o/r/pull/3', '--title', 'T', '--body', 'B']);
  });
  it('makes the labels a pipeline sets that the repository lacks', async () => {
    const calls = fake({ 'label-list': [{ name: 'gen3d' }, { name: 'gen3d:failed' }] });
    const { ensureLabels } = await import('../../desktop/jobs.mjs');
    ensureLabels({ label: 'gen3d' });
    const made = calls().filter((c) => c[1] === 'create').map((c) => c[2]);
    expect(made).toEqual(['gen3d:running', 'gen3d:waiting']);
  });
  it('answers gh api by the path asked', () => {
    fake({ api: { 'repos/o/r/issues/1': { number: 1, title: 'x-wing' } } });
    const out = execFileSync(process.execPath, [process.env.GH_BIN, 'api', 'repos/o/r/issues/1'], { encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual({ number: 1, title: 'x-wing' });
  });
});

describe('the fake judge', () => {
  const script = (entries) => {
    const dir = tmp();
    const file = join(dir, 'judge.json');
    writeFileSync(file, JSON.stringify(entries));
    process.env.GEN3D_JUDGE = 'fake';
    process.env.GEN3D_JUDGE_SCRIPT = file;
    return { calls: () => JSON.parse(readFileSync(join(dir, 'calls.json'), 'utf8')) };
  };
  it('is the backend GEN3D_JUDGE=fake picks', async () => {
    script([]);
    const { which } = await import('../../gen3d/vlm.mjs');
    expect(which()).toBe('fake');
  });
  it('answers judge() from the script, in turn, and writes down what it was asked', async () => {
    const s = script([{ match: 'four sides', reply: ['{"score": 4, "problems": ["squat"], "fix": "a side view"}', '{"score": 9, "problems": []}'] }]);
    const { judge } = await import('../../gen3d/vlm.mjs');
    expect(await judge('an X-wing', 'sheet.png')).toEqual({ score: 4, problems: ['squat'], fix: 'a side view', ok: false });
    expect((await judge('an X-wing', 'sheet.png')).score).toBe(9);
    // the last reply holds once the list runs out
    expect((await judge('an X-wing', 'sheet.png')).score).toBe(9);
    expect(s.calls()).toHaveLength(3);
    expect(s.calls()[0].images).toEqual(['sheet.png']);
    expect(s.calls()[0].prompt).toMatch(/It is meant to be an X-wing/);
  });
  it('answers pick() for each candidate, and the best is the highest', async () => {
    script([{ match: 'b.png', reply: '{"score": 2}' }, { match: 'faithfully', reply: ['{"score": 5}', '{"score": 2}', '{"score": 8}'] }]);
    const { pick } = await import('../../gen3d/vlm.mjs');
    const r = await pick('an X-wing', ['a.png', 'b.png', 'c.png']);
    expect(r.scores.map((s) => s.score)).toEqual([5, 2, 2]);
    expect(r.best).toBe(0);
  });
  it('refuses a prompt its script has no answer for, quoting the prompt', async () => {
    script([{ match: 'nothing like this', reply: '{}' }]);
    const { ask } = await import('../../gen3d/vlm.mjs');
    await expect(ask('Is this an X-wing? Answer as JSON', [])).rejects.toThrow(/no scripted reply for "Is this an X-wing\? Answer as JSON"/);
  });
});
