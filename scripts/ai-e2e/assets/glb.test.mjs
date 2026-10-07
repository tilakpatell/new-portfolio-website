// What a shipped GLB is, read the way the site's loader would: the numbers
// the asset tests hold every model to.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspect } from './glb.mjs';
import { REPO } from '../contract/repo.mjs';

const XWING = (suffix) => join(REPO, 'public', 'models', 'gen3d', `x-wing${suffix}.glb`);

describe('inspecting a GLB', () => {
  it('counts the X-wing’s triangles, cut by cut, and reads its size on disk', async () => {
    const [hq, mid, lo] = await Promise.all(['.hq', '', '.lo'].map((s) => inspect(XWING(s))));
    expect(hq.tris).toBeGreaterThan(mid.tris);
    expect(mid.tris).toBeGreaterThan(lo.tris);
    expect(mid.tris).toBeGreaterThan(1000);
    expect(mid.bytes).toBeGreaterThan(100 * 1024);
  });
  it('reads its textures as WebP with their sizes, its extensions, its one scene and its meshopt compression', async () => {
    const m = await inspect(XWING(''));
    expect(m.textures.length).toBeGreaterThan(0);
    for (const t of m.textures) {
      expect(t.mime).toBe('image/webp');
      expect(t.w).toBeGreaterThan(0);
      expect(t.h).toBeGreaterThan(0);
    }
    expect(m.extensions).toContain('EXT_texture_webp');
    expect(m.meshopt).toBe(true);
    expect(m.scenes).toBe(1);
  });
  it('gives the bounding box in metres, as [x, y, z] sizes', async () => {
    const { bbox } = await inspect(XWING(''));
    expect(bbox).toHaveLength(3);
    for (const v of bbox) expect(v).toBeGreaterThan(0);
    // a fighter: wider and longer than it is tall
    expect(bbox[1]).toBeLessThan(Math.max(bbox[0], bbox[2]));
  });
});
