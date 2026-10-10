import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LANDINGS } from './landings';
import { biomeAt, viewOf } from './biomes';

// (what prefetch asks for, with nothing fetched: the loader and the kit's
// scans stood in for, and Middle-earth's builders an empty file)
vi.mock('../../../lib/three/gltf', () => ({ loadGltf: vi.fn(async () => null) }));
vi.mock('../../galaxy/surface/kit', () => ({ LOOKS: { a: {} }, scanOf: () => true, loadScan: vi.fn(), createKit: vi.fn() }));
vi.mock('./middleearth.js', () => ({}));

const me = LANDINGS.middleearth;
const mordor = viewOf(me, biomeAt({ ...me, biomes: me.biomes.filter((b) => b.id === 'mordor') }, [0, 0, 0]));
const file = (u) => u.split('/').pop();

// (a fresh furnish.js each time: what it's asked for is kept in the module)
let prefetch;
let loadGltf;
let loadScan;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  ({ prefetch } = await import('./furnish'));
  ({ loadGltf } = await import('../../../lib/three/gltf'));
  ({ loadScan } = await import('../../galaxy/surface/kit'));
});
const asked = () => loadGltf.mock.calls.map(([url]) => file(url));

describe('prefetch, a view at a time', () => {
  it("fetches only the landing's own view by default: the Shire's four, not Mordor's rocks", () => {
    prefetch('middleearth', me);
    expect(asked().sort()).toEqual(['flowers.glb', 'grass.glb', 'mushrooms.glb', 'trees.glb']);
    expect(loadScan).toHaveBeenCalledTimes(1);
  });

  it("adds only Mordor's rocks for its view, and the scans aren't asked for again", () => {
    prefetch('middleearth', me);
    const before = loadGltf.mock.calls.length;
    prefetch('middleearth', me, { view: mordor });
    expect(asked().slice(before)).toEqual(['rocks.glb']);
    expect(loadScan).toHaveBeenCalledTimes(1);
  });

  it('asks for a view once', () => {
    prefetch('middleearth', me, { view: mordor });
    const before = loadGltf.mock.calls.length;
    prefetch('middleearth', me, { view: mordor });
    prefetch('middleearth', me, { view: { ...mordor } });
    expect(loadGltf.mock.calls.length).toBe(before);
    expect(loadScan).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing on a planet with no builders', () => {
    prefetch('nowhere', me);
    expect(loadGltf).not.toHaveBeenCalled();
    expect(loadScan).not.toHaveBeenCalled();
  });
});
