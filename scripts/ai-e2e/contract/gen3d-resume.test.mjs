// Tier 1: a failed run picks up where it stopped. Each step's output keeps
// a key of what it was made from, and a step whose inputs haven't changed is
// reused (scripts/gen3d/README.md): tested with the fake engine, whose
// output really is the same bytes for the same inputs.
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FIXTURES, sandbox } from './repo.mjs';

const REF = join(FIXTURES, 'x-wing-ref.png');
const ARGS = (picture) => ['xw', '--image', picture, '--what', 'an X-wing starfighter', '--faces', '4000', '--seed', '1', '--no-judge'];
const log = (box) => readFileSync(join(box.cache, 'xw', 'make.log'), 'utf8');

describe('resuming a run (subprocesses, up to 10 s)', () => {
  it('reuses the raw model and the bake when nothing they were made from changed', async () => {
    const box = sandbox();
    expect((await box.make(ARGS(REF))).status).toBe(0);
    expect((await box.make(ARGS(REF))).status).toBe(0);
    expect(box.fakes('engine')).toHaveLength(1);
    expect(box.fakes('blender')).toHaveLength(1);
    expect(log(box)).toMatch(/raw model from the last run \(fake\)/);
    expect(log(box)).toMatch(/baked model from the last run/);
  });

  it('starts again at the bake when the last run died there', async () => {
    const box = sandbox();
    const dead = await box.make(ARGS(REF), { GEN3D_FAKE_FAIL_AT: 'bake' });
    expect(dead.status).not.toBe(0);
    expect(dead.err).toMatch(/blender exited 1/);
    expect((await box.make(ARGS(REF))).status).toBe(0);
    expect(box.fakes('engine')).toHaveLength(1);
    expect(box.fakes('blender')).toHaveLength(2);
    expect(log(box)).toMatch(/raw model from the last run/);
    expect(log(box)).toMatch(/baked to 4000 faces in/);
  });

  it('makes everything again with --fresh', async () => {
    const box = sandbox();
    await box.make(ARGS(REF));
    await box.make([...ARGS(REF), '--fresh']);
    expect(box.fakes('engine')).toHaveLength(2);
    expect(box.fakes('blender')).toHaveLength(2);
  });

  it('makes everything again when the picture changes by one pixel', async () => {
    const box = sandbox();
    const mine = join(box.dir, 'mine.png');
    copyFileSync(REF, mine);
    await box.make(ARGS(mine));
    const { data, info } = await sharp(mine).raw().toBuffer({ resolveWithObject: true });
    data[(info.width * 200 + 200) * info.channels] ^= 0xff; // one pixel, inside the subject so the trim keeps it
    await sharp(data, { raw: info }).png().toFile(join(box.dir, 'changed.png'));
    copyFileSync(join(box.dir, 'changed.png'), mine);
    await box.make(ARGS(mine));
    expect(box.fakes('engine')).toHaveLength(2);
    expect(box.fakes('blender')).toHaveLength(2);
  });
});
