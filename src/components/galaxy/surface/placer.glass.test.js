import { Buffer } from 'node:buffer';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gltfLoader } from '../../../lib/three/gltf';
import { SURFACE_MODELS, lodUrlFor, modelUrlFor } from './catalog';
import { loadGlb } from './placer';

// A model with transmission makes three draw the whole opaque scene again,
// every frame it's in view (the shuttle's canopy, the ramp's lamp, a pilot's
// visor doubled Yavin's triangles). Every surface model comes in through
// loadGlb, so its glass is made plain see-through glass there.

const PUBLIC = new URL('../../../../public', import.meta.url);
const file = (url) => readFileSync(new URL(`.${url}`, `${PUBLIC.href}/`));
const json = (b) => JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + b.readUInt32LE(12))));
const transmissive = (b) => (json(b).materials ?? []).some((m) => m.extensions?.KHR_materials_transmission);

// the file without its pictures (node can't decode them), the same otherwise
function bare(b) {
  const j = json(b);
  delete j.textures;
  delete j.images;
  delete j.samplers;
  const strip = (o) => {
    for (const k of Object.keys(o)) {
      if (/Texture$/.test(k)) delete o[k];
      else if (o[k] && typeof o[k] === 'object') strip(o[k]);
    }
  };
  for (const m of j.materials ?? []) strip(m);
  let text = JSON.stringify(j);
  while (text.length % 4) text += ' ';
  const head = 20 + b.readUInt32LE(12);
  const rest = b.subarray(head);
  const out = Buffer.alloc(20 + text.length + rest.length);
  out.write('glTF', 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(text.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16); // JSON
  out.write(text, 20);
  rest.copy(out, 20 + text.length);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

// every file the catalogue can load, at any detail
const urls = [...new Set(Object.keys(SURFACE_MODELS).flatMap((k) => [modelUrlFor(k, 'high'), modelUrlFor(k, 'ultra'), lodUrlFor(k)]))].filter((u) => existsSync(new URL(`.${u}`, `${PUBLIC.href}/`)));
const glassy = urls.filter((u) => transmissive(file(u)));

afterEach(() => vi.restoreAllMocks());

describe('glass on the surface', () => {
  it('knows the models that come with transmission', () => {
    // (the snowspeeder is the game's now, its glass plain blended glass: catalog/bf2017-vehicles.js)
    for (const kind of ['yavinspeeder', 'yavinramp', 'rebelpilot']) expect(glassy).toContain(`/models/galaxy/surface/${kind}.glb`);
  });

  it('loads every one of them without it, still see-through', async () => {
    const loader = gltfLoader();
    vi.spyOn(loader, 'loadAsync').mockImplementation((url) => loader.parseAsync(bare(file(url)), ''));
    for (const url of glassy) {
      const gltf = await loadGlb(url);
      const glass = [];
      gltf.scene.traverse((o) => {
        for (const m of o.material ? [o.material].flat() : []) {
          expect(m.transmission ?? 0, `${url}: ${m.name}`).toBe(0);
          if (m.transparent) glass.push(m);
        }
      });
      expect(glass.length, url).toBeGreaterThan(0);
      for (const m of glass) expect(m.opacity, `${url}: ${m.name}`).toBeLessThan(1);
      expect(await loadGlb(url), url).toBe(gltf); // (once, for every copy)
    }
  }, 60000);

  it('has no crew figure carrying it (those load through footScene, which keeps it)', () => {
    const dir = new URL('./models/galaxy/crew/', `${PUBLIC.href}/`);
    const crew = readdirSync(dir).filter((f) => f.endsWith('.glb'));
    expect(crew.length).toBeGreaterThan(0);
    for (const f of crew) expect(transmissive(readFileSync(new URL(f, dir))), f).toBe(false);
  });
});
