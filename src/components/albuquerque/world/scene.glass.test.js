import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gltfLoader } from '../../../lib/three/gltf';
import { SKETCHFAB, loadModel } from './scene';

// A model with transmission makes three draw the whole opaque town again,
// every frame it's in view (Saul's Esteem came with it on its windows). Every
// model in town comes in through loadModel, so a Sketchfab one's glass is
// made plain see-through glass there.

const PUBLIC = new URL('../../../../public', import.meta.url);
const file = (url) => readFileSync(new URL(`.${url}`, `${PUBLIC.href}/`));
const json = (b) => JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + b.readUInt32LE(12))));
const transmissive = (b) => (json(b).materials ?? []).some((m) => m.extensions?.KHR_materials_transmission);
const urlOf = (name) => `/models/sketchfab/${SKETCHFAB[name]}.glb`;

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

const glassy = Object.keys(SKETCHFAB).filter((name) => transmissive(file(urlOf(name))));
// three's loader, reading the files from public/ instead of the network
const real = gltfLoader();
const loader = { loadAsync: (url) => real.parseAsync(bare(file(url)), '') };

describe('glass in Albuquerque', () => {
  it('knows the Sketchfab models that come with transmission', () => {
    expect(glassy).toContain('esteem');
  });

  it('loads every one of them without it, still see-through', async () => {
    for (const name of glassy) {
      const made = new Set(json(file(urlOf(name))).materials.filter((m) => m.extensions?.KHR_materials_transmission).map((m) => m.name));
      const root = await loadModel(loader, name);
      const glass = new Set();
      root.traverse((o) => {
        for (const m of o.material ? [o.material].flat() : []) {
          expect(m.transmission ?? 0, `${name}: ${m.name}`).toBe(0);
          if (made.has(m.name)) glass.add(m);
        }
      });
      expect(glass.size, name).toBeGreaterThan(0);
      for (const m of glass) {
        expect(m.transparent, `${name}: ${m.name}`).toBe(true);
        expect(m.opacity, `${name}: ${m.name}`).toBeLessThan(1);
      }
    }
  }, 60000);

  it('hands back null for a model that never came', async () => {
    expect(await loadModel({ loadAsync: () => Promise.reject(new Error('404')) }, 'esteem')).toBe(null);
  });
});
