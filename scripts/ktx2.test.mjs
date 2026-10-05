import { describe, expect, it } from 'vitest';
import { encodeArgs, gpuBytes, roleOf, verdict } from './ktx2.mjs';

describe('what a GLB texture is for', () => {
  it('reads the role off the material slots it hangs from', () => {
    expect(roleOf(['baseColorTexture'])).toBe('color');
    expect(roleOf(['emissiveTexture'])).toBe('color');
    expect(roleOf(['normalTexture'])).toBe('normal');
    expect(roleOf(['occlusionTexture', 'metallicRoughnessTexture'])).toBe('arm');
    expect(roleOf(['clearcoatTexture'])).toBe('other');
    expect(roleOf([])).toBe('other');
  });
});

describe('the encoder’s arguments', () => {
  it('encodes colour in sRGB and everything else in linear space, UASTC by default', () => {
    expect(encodeArgs({ role: 'color' })).toEqual(['-ktx2', '-mipmap', '-uastc', '-uastc_level', '2', '-uastc_rdo_l', '1', '-ktx2_zstandard_level', '18']);
    expect(encodeArgs({ role: 'normal' })).toContain('-linear');
    expect(encodeArgs({ role: 'arm' })).toContain('-linear');
  });
  it('switches to ETC1S when asked, at the given quality', () => {
    const args = encodeArgs({ role: 'color', etc1s: true, quality: 255 });
    expect(args).toContain('-q');
    expect(args[args.indexOf('-q') + 1]).toBe('255');
    expect(args).not.toContain('-uastc');
  });
});

describe('GPU memory with mipmaps', () => {
  it('counts a 1K map as 5.3 MB of RGBA, 1.3 MB of UASTC, 0.7 MB of ETC1S', () => {
    expect(gpuBytes(1024, 1024, 'rgba') / 1048576).toBeCloseTo(5.33, 1);
    expect(gpuBytes(1024, 1024, 'uastc') / 1048576).toBeCloseTo(1.33, 1);
    expect(gpuBytes(1024, 1024, 'etc1s') / 1048576).toBeCloseTo(0.67, 1);
  });
});

describe('whether a map earns its bytes', () => {
  const base = { role: 'color', mime: 'image/webp', before: 200 * 1024, gpuBefore: 5.3e6, gpuAfter: 1.3e6, psnr: 40, width: 1024 };
  it('converts when GPU memory falls, the download stays close and the quality holds', () => {
    expect(verdict({ ...base, after: 220 * 1024 })).toBe('convert');
    expect(verdict({ ...base, after: 240 * 1024 })).toBe('convert');
  });
  it('keeps the WebP when the download would grow much, or the encode is too lossy', () => {
    expect(verdict({ ...base, after: 600 * 1024 })).toBe('keep');
    expect(verdict({ ...base, after: 220 * 1024, psnr: 30 })).toBe('keep');
  });
  it('sends a JPEG normal map back to its source rather than re-encoding what JPEG left', () => {
    expect(verdict({ ...base, role: 'normal', mime: 'image/jpeg', after: 1200 * 1024, psnr: 36 })).toBe('regenerate from source as UASTC (JPEG normals)');
    expect(verdict({ ...base, role: 'normal', mime: 'image/jpeg', after: 220 * 1024, psnr: 36 })).toBe('convert');
  });
  it('flags a big map for its GPU memory', () => {
    expect(verdict({ ...base, width: 2048, after: 1200 * 1024, gpuBefore: 21e6, gpuAfter: 5.3e6 })).toBe('consider (GPU memory)');
  });
});
