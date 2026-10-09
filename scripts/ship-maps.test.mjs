import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downscale, localContrast, rewrite, fitSize, roleOf } from './ship-maps.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, 'ship-maps', 'fixtures', 'line.png');

// A 64 × 64 mid grey with two dark lines two texels wide down it. A panel
// line falls anywhere on the grid, so one starts on an odd column (halving
// the picture splits it across two texels: where a plain resize averages it
// into mud) and one on an even (it lands on one texel).
const GREY = 140;
const DARK = 40;
const LINES = [[15, 16], [46, 47]];
async function makeLine() {
  const w = 64;
  const px = Buffer.alloc(w * w * 3, GREY);
  for (let y = 0; y < w; y++)
    for (const x of LINES.flat()) px.fill(DARK, (y * w + x) * 3, (y * w + x) * 3 + 3);
  return sharp(px, { raw: { width: w, height: w, channels: 3 } }).png().toBuffer();
}

// How dark the lines are, on average, as a share of how dark they were:
// the grey less the darkest texel near each line, along the middle row.
async function lineDepth(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const k = info.width / 64;
  const y = info.height >> 1;
  const depths = LINES.map(([a, b]) => {
    let min = 255;
    for (let x = Math.floor((a - 2) * k); x <= Math.ceil((b + 2) * k); x++) min = Math.min(min, data[(y * info.width + x) * info.channels]);
    return (GREY - min) / (GREY - DARK);
  });
  return depths.reduce((s, d) => s + d, 0) / depths.length;
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

let tmp;
beforeAll(async () => {
  if (!existsSync(FIXTURE)) {
    mkdirSync(dirname(FIXTURE), { recursive: true });
    await sharp(await makeLine()).toFile(FIXTURE);
  }
  tmp = await mkdtemp(join(tmpdir(), 'ship-maps-'));
});
afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe('downscale', () => {
  it('keeps a panel line’s contrast within a fifth when it sharpens', async () => {
    const src = await readFile(FIXTURE);
    expect(await lineDepth(src)).toBe(1);
    const after = await lineDepth(await downscale(src, { size: 32, sharpen: { radius: 1.5, amount: 0.6 } }));
    expect(Math.abs(after - 1)).toBeLessThanOrEqual(0.2);
  });

  it('loses more than a fifth of it without the sharpen, so the sharpen is doing the work', async () => {
    const src = await readFile(FIXTURE);
    const after = await lineDepth(await downscale(src, { size: 32, sharpen: null }));
    expect(1 - after).toBeGreaterThan(0.2);
  });

  it('fits the long side and never enlarges', () => {
    expect(fitSize(1024, 1024, 512)).toEqual([512, 512]);
    expect(fitSize(1008, 189, 512)).toEqual([512, 96]);
    expect(fitSize(300, 200, 512)).toEqual([300, 200]);
  });
});

describe('localContrast', () => {
  it('is nought on a flat map and grows with fine detail', async () => {
    const flat = await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 90, g: 90, b: 90 } } }).png().toBuffer();
    expect(await localContrast(flat)).toBe(0);
    expect(await localContrast(await readFile(FIXTURE))).toBeGreaterThan(0.02);
  });
});

describe('roleOf', () => {
  it('names a texture by the slot it fills', () => {
    expect(roleOf(['baseColorTexture'])).toBe('albedo');
    expect(roleOf(['normalTexture'])).toBe('normal');
    expect(roleOf(['metallicRoughnessTexture'])).toBe('mr');
    expect(roleOf(['occlusionTexture'])).toBe('mr');
    expect(roleOf(['emissiveTexture'])).toBe('albedo');
  });
});

describe('rewrite', () => {
  async function tinyGlb() {
    const doc = new Document();
    doc.createExtension(EXTTextureWebP).setRequired(true);
    doc.createBuffer();
    const img = await sharp(await makeLine()).webp().toBuffer();
    const a = doc.createTexture('albedo').setImage(new Uint8Array(img)).setMimeType('image/webp');
    const n = doc.createTexture('normal').setImage(new Uint8Array(img)).setMimeType('image/webp');
    doc.createMaterial('hull').setBaseColorTexture(a).setNormalTexture(n);
    const file = join(tmp, 'tiny.glb');
    await new NodeIO().registerExtensions([EXTTextureWebP]).write(file, doc);
    return file;
  }

  it('changes nothing with check, and reports each texture', async () => {
    const file = await tinyGlb();
    const hash = sha(await readFile(file));
    const out = await rewrite(file, { albedo: 32, normal: 32, mr: 16, check: true });
    expect(sha(await readFile(file))).toBe(hash);
    expect(out.before).toHaveLength(2);
    expect(out.after).toHaveLength(2);
    expect(out.after.map((t) => t.w)).toEqual([32, 32]);
    expect(out.before[0].contrast).toBeGreaterThan(0);
  });

  it('writes the smaller maps without check', async () => {
    const file = await tinyGlb();
    const out = await rewrite(file, { albedo: 32, normal: 32, mr: 16 });
    const meta = await Promise.all(
      (await new NodeIO().registerExtensions([EXTTextureWebP]).read(file)).getRoot().listTextures().map((t) => sharp(Buffer.from(t.getImage())).metadata()),
    );
    expect(meta.map((m) => m.width)).toEqual([32, 32]);
    expect(out.bytes.after).toBe((await readFile(file)).byteLength);
  });
});
