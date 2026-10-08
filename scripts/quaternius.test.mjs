import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Document } from '@gltf-transform/core';
import { BUDGETS, KITS, OUT, PACKS, bake, baseName, colliderOf, creditOf, dilate, kitBudget, makeIo, materialFix, parseObj, problems, summary, worldPoints } from './quaternius.mjs';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

describe('a Quaternius material, fixed for the landings', () => {
  it('knows a material by its name, whatever Blender numbered it', () => {
    expect(baseName('DarkWood.009')).toBe('DarkWood');
    expect(baseName('Leaves_NormalTree')).toBe('Leaves_NormalTree');
    expect(baseName('Red')).toBe('Red');
  });

  it('cuts leaves and flowers out, drawn both sides', () => {
    expect(materialFix({ name: 'Leaves_NormalTree', alphaMode: 'MASK', cutoff: 0.2 })).toEqual({ alphaMode: 'MASK', doubleSided: true, cutoff: 0.2 });
    expect(materialFix({ name: 'Flowers', alphaMode: 'MASK', cutoff: 0.2 }).doubleSided).toBe(true);
    // (a blend's sorting and instancing don't mix: cut out instead)
    expect(materialFix({ name: 'Leaves_CherryBlossom', alphaMode: 'BLEND' })).toEqual({ alphaMode: 'MASK', doubleSided: true, cutoff: 0.5 });
    // (grass blades are opaque, but thin: both sides)
    expect(materialFix({ name: 'Grass', alphaMode: 'OPAQUE' })).toEqual({ alphaMode: 'OPAQUE', doubleSided: true, cutoff: null });
  });

  it('makes bark, rock and props opaque and one-sided, whatever the source said', () => {
    expect(materialFix({ name: 'Bark_NormalTree', alphaMode: 'MASK', cutoff: 0.2 })).toEqual({ alphaMode: 'OPAQUE', doubleSided: false, cutoff: null });
    expect(materialFix({ name: 'Rocks', alphaMode: 'OPAQUE' }).doubleSided).toBe(false);
    expect(materialFix({ name: 'MI_Ornaments' }).alphaMode).toBe('OPAQUE');
  });
});

describe('what a Quaternius model may cost', () => {
  const tree = { kind: 'tree' };
  const fine = { tris: 3000, textures: [{ width: 512, height: 512, mime: 'image/webp' }], materials: [{ name: 'Leaves', alphaMode: 'MASK', doubleSided: true }], minY: 0.001 };

  it('passes a model within its budget', () => {
    expect(problems(tree, fine)).toEqual([]);
  });

  it('says what’s wrong with one that isn’t', () => {
    expect(problems(tree, { ...fine, tris: BUDGETS.tree.tris + 1 })[0]).toMatch(/triangles/);
    expect(problems({ kind: 'tree', tris: 2000 }, fine)[0]).toMatch(/over 2000/);
    expect(problems(tree, { ...fine, textures: [{ width: 1024, height: 512, mime: 'image/webp' }] })[0]).toMatch(/over 512/);
    expect(problems(tree, { ...fine, textures: [{ width: 256, height: 256, mime: 'image/png' }] })[0]).toMatch(/not WebP/);
    expect(problems(tree, { ...fine, materials: [{ name: 'Leaves', alphaMode: 'MASK', doubleSided: false }] })[0]).toMatch(/one side/);
    expect(problems(tree, { ...fine, minY: -0.24 })[0]).toMatch(/off the ground/);
    expect(problems({ kind: 'castle' }, fine)[0]).toMatch(/no budget/);
  });

  it('gives every kit a budget, every model a kind, and every prop a body', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      expect(PACKS[kit.pack], name).toBeTruthy();
      expect(kitBudget(kit).bytes, name).toBeGreaterThan(0);
      for (const [node, m] of Object.entries(kit.models)) {
        expect(BUDGETS[m.kind], `${name} ${node}`).toBeTruthy();
        expect(node, 'a node name three.js keeps as it is').toMatch(/^[A-Za-z0-9_]+$/);
        if (m.kind === 'prop') {
          // (the shapes a landing's physics makes: universe/landings/bodies.js)
          expect(['box', 'cylinder', 'ball'], `${node}'s body`).toContain(m.body?.shape);
          expect(m.body.mass, `${node}'s mass`).toBeGreaterThan(0);
          // (a loose one light or middling: a shot sends it, a shove moves it)
          if (!m.body.fixed) expect(m.body.mass, `${node}'s mass`).toBeGreaterThanOrEqual(0.5);
          if (!m.body.fixed) expect(m.body.mass, `${node}'s mass`).toBeLessThanOrEqual(30);
        }
      }
    }
    // (and no model in two kits: a landing names it by its node)
    const nodes = Object.values(KITS).flatMap((k) => Object.keys(k.models));
    expect(new Set(nodes).size).toBe(nodes.length);
  });
});

describe('a model’s collider', () => {
  // a 2 × 1 × 4 m box standing on the ground, its middle over the origin, and a point inside it
  const corners = [];
  for (const x of [-1, 1]) for (const y of [0, 1]) for (const z of [-2, 2]) corners.push(x, y, z);
  const points = [...corners, 0, 0.5, 0];

  it('has its box, its circle on the ground and its hull, in metres', () => {
    const c = colliderOf(points);
    expect(c.half).toEqual([1, 0.5, 2]);
    expect(c.mid).toEqual([0, 0.5, 0]);
    expect(c.radius).toBeCloseTo(Math.hypot(1, 2), 3);
    // (the corners, and not the point inside)
    expect(c.hull).toHaveLength(8);
    expect(c.hull).not.toContainEqual([0, 0.5, 0]);
  });

  it('never keeps more than it’s asked for', () => {
    const many = [];
    for (let i = 0; i < 2000; i++) {
      const a = i * 2.399;
      const y = (i % 50) / 50;
      many.push(Math.cos(a) * (1 + y), y * 3, Math.sin(a) * (1 + y));
    }
    const c = colliderOf(many, { most: 64 });
    expect(c.hull.length).toBeLessThanOrEqual(64);
    expect(c.hull.length).toBeGreaterThan(20);
    expect(colliderOf(many, { most: 16 }).hull.length).toBeLessThanOrEqual(16);
  });
});

describe('a cut-out texture’s hidden colour', () => {
  it('takes its neighbours’ colour under the cut, and leaves the solid texels alone', () => {
    // three texels in a row: green, then two clear ones the painter left white
    const rgba = Uint8Array.from([40, 120, 20, 255, 255, 255, 255, 0, 255, 255, 255, 0]);
    dilate(rgba, 3, 1);
    expect([...rgba.slice(0, 4)]).toEqual([40, 120, 20, 255]);
    expect([...rgba.slice(4, 8)]).toEqual([40, 120, 20, 0]);
    expect([...rgba.slice(8, 12)]).toEqual([40, 120, 20, 0]);
  });

  it('fills a soft edge’s colour from the solid leaf, and what’s far from any leaf with the leaves’ average', () => {
    // a solid green texel, a half-clear one the painter left white, then 30 clear white ones
    const w = 32;
    const rgba = new Uint8Array(w * 4).fill(255);
    rgba.set([40, 120, 20, 255], 0);
    rgba[7] = 128;
    for (let i = 2; i < w; i++) rgba[i * 4 + 3] = 0;
    dilate(rgba, w, 1, { passes: 4 });
    expect([...rgba.slice(4, 8)]).toEqual([40, 120, 20, 128]);
    expect([...rgba.slice(20, 24)]).toEqual([40, 120, 20, 0]);
    expect([...rgba.slice((w - 1) * 4, w * 4)]).toEqual([40, 120, 20, 0]);
  });

  it('leaves a texture with nothing solid in it as it was', () => {
    const rgba = Uint8Array.from([255, 255, 255, 0, 255, 255, 255, 0]);
    dilate(rgba, 2, 1);
    expect([...rgba]).toEqual([255, 255, 255, 0, 255, 255, 255, 0]);
  });
});

describe('an OBJ, read', () => {
  it('gives each material its triangles, a fan for a face of more sides, and leaves stray lines out', () => {
    const obj = ['v 0 0 0', 'v 1 0 0', 'v 1 1 0', 'v 0 1 0', 'vn 0 0 1', 'usemtl Wood.011', 'f 1//1 2//1 3//1 4//1', 'l 1 3', 'usemtl Red', 'f -4//1 -3//1 -2//1'].join('\n');
    const [wood, red] = parseObj(obj);
    expect(wood.material).toBe('Wood.011');
    expect(wood.positions).toHaveLength(2 * 3 * 3);
    expect([...wood.positions.slice(9, 18)]).toEqual([0, 0, 0, 1, 1, 0, 0, 1, 0]);
    expect([...wood.normals.slice(0, 3)]).toEqual([0, 0, 1]);
    // (negative indices count back from the last vertex)
    expect([...red.positions]).toEqual([0, 0, 0, 1, 0, 0, 1, 1, 0]);
  });
});

describe('a Quaternius model, baked', () => {
  it('moves a mesh two nodes share once for each, not by both', async () => {
    const doc = new Document();
    const buffer = doc.createBuffer();
    const position = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buffer);
    const mesh = doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', position));
    const scene = doc.createScene();
    for (const x of [2, 10]) scene.addChild(doc.createNode().setMesh(mesh).setTranslation([x, 0, 0]));
    await bake(doc);
    const xs = [...worldPoints(doc)].filter((_, i) => i % 3 === 0).sort((a, b) => a - b);
    expect(xs).toEqual([2, 2, 3, 10, 10, 11]);
  });
});

describe('a Quaternius credit', () => {
  it('names the pack, the file and Quaternius, CC0', () => {
    expect(creditOf('naturemega', 'CommonTree_3.gltf', '/models/quaternius/nature/trees.glb')).toEqual({ source: 'https://quaternius.com', id: 'CommonTree_3', name: 'Stylized Nature MegaKit: CommonTree_3', authors: ['Quaternius'], license: 'CC0 1.0', use: 'In public/models/quaternius/nature/trees.glb, a kit of them (scripts/quaternius.mjs)' });
    expect(creditOf('space', 'Items/GLTF/Pickup_Crate.gltf').id).toBe('Pickup_Crate');
  });
});

// the models as committed: each as the manifest says, within its budget
describe('the imported Quaternius models', async () => {
  const manifestFile = join(PUBLIC, OUT, 'manifest.json');
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
  const credits = JSON.parse(readFileSync(join(PUBLIC, 'games', 'credits.json'), 'utf8'));
  const io = await makeIo();
  const read = new Map();
  const of = (url) => {
    if (!read.has(url)) read.set(url, summary(io, join(PUBLIC, url)));
    return read.get(url);
  };
  const byNode = Object.fromEntries(Object.values(KITS).flatMap((k) => Object.entries(k.models)));

  it('has every kit’s every model', () => {
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(byNode).sort());
  });

  for (const [name, entry] of Object.entries(manifest)) {
    it(`${name}: there, within budget, cut-outs both sides, on the ground, credited`, async () => {
      expect(existsSync(join(PUBLIC, entry.url)), entry.url).toBe(true);
      const sum = await of(entry.url);
      const own = sum.models[entry.node];
      expect(own, `${entry.url} has ${entry.node}`).toBeTruthy();
      expect(own.tris).toBe(entry.tris);
      expect(problems(byNode[name], own)).toEqual([]);
      expect(entry.collider.hull.length).toBeLessThanOrEqual(64);
      expect(Math.abs(entry.metres[1] - entry.collider.half[1] * 2)).toBeLessThan(0.01);
      expect(credits[`quaternius/${name}`]?.license).toBe('CC0 1.0');
      expect(credits[`quaternius/${name}`]?.use).toContain(`public${entry.url}`);
    });
  }

  // (a cut-out map's colour under its cut is its edge's, pushed out: not
  // black, which a far-off mip would blend into the leaf)
  it('keeps each cut-out map’s colour under its cut', async () => {
    const sharp = (await import('sharp')).default;
    for (const url of new Set(Object.values(manifest).map((e) => e.url))) {
      const doc = await io.read(join(PUBLIC, url));
      for (const m of doc.getRoot().listMaterials()) {
        if (m.getAlphaMode() === 'OPAQUE' || !m.getBaseColorTexture()) continue;
        const data = await sharp(Buffer.from(m.getBaseColorTexture().getImage())).ensureAlpha().raw().toBuffer();
        let clear = 0;
        let black = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i + 3] < 10) {
            clear++;
            if (data[i] + data[i + 1] + data[i + 2] < 30) black++;
          }
        expect(black / (clear || 1), `${url} ${m.getName()}`).toBeLessThan(0.05);
      }
    }
  });

  it('keeps each kit within its budget', async () => {
    for (const [kit, k] of Object.entries(KITS)) {
      const url = `/${OUT}/${kit}.glb`;
      if (!existsSync(join(PUBLIC, url))) continue;
      expect((await of(url)).bytes, kit).toBeLessThanOrEqual(kitBudget(k).bytes);
    }
  });
});
