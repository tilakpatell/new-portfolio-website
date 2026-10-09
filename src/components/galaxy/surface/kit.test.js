import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import SCANS from '../../../../public/cc0/galaxy/index.json';
import { KIT_ROLES, createKit } from './kit';

// (canvases that take every call and draw nothing: the kit paints its stand-ins)
beforeAll(() => {
  const g = { addColorStop() {} };
  const canvas = { width: 0, height: 0 };
  canvas.getContext = () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => g), set: () => true });
  globalThis.document = { createElement: () => ({ ...canvas, getContext: canvas.getContext }) };
});
afterAll(() => delete globalThis.document);

describe('the kit', () => {
  it('blows its plants and cloth in the world’s wind, and not its stone', () => {
    const kit = createKit({ seed: 1, scans: false, wind: { angle: Math.PI / 2 } });
    for (const name of ['fronds', 'foliage', 'cloth', 'strands']) {
      const u = kit.mats[name].userData.wind;
      expect(u, name).toBeTruthy();
      expect(typeof kit.mats[name].onBeforeCompile, name).toBe('function');
      expect(u.uWindDir.value.x, name).toBeCloseTo(0, 5);
      expect(u.uWindDir.value.y, name).toBeCloseTo(1, 5);
    }
    expect(kit.mats.stone.userData.wind).toBeUndefined();
    kit.dispose();
  });

  it('maps every solid role onto a core role with a scan', () => {
    for (const [name, role] of Object.entries(KIT_ROLES)) expect(SCANS[role], name).toBeTruthy();
    for (const name of ['paint', 'metal', 'stone', 'rock', 'adobe', 'bark', 'wood', 'concrete', 'tiles', 'deck', 'sand', 'snow', 'mud']) expect(KIT_ROLES[name], name).toBeTruthy();
  });

  it('wears each role’s scan at its real size once the scans are in, in place of the picture by its UVs', async () => {
    const tex = new THREE.Texture();
    const kit = createKit({ seed: 1, load: () => Promise.resolve({ map: tex, normalMap: tex }) });
    await kit.ready;
    const m = kit.mats.stone;
    expect(m.userData.core.uCoreScale.value).toBeCloseTo(1 / SCANS.stone.metres, 6);
    expect(m.map).toBe(null);
    expect(kit.mats.glow.userData.core).toBeUndefined();
    kit.dispose();
  });

  it('keeps its stand-ins, kept, when the scans come after', async () => {
    const tex = new THREE.Texture();
    const coming = [];
    const kit = createKit({ seed: 1, load: () => new Promise((resolve) => coming.push(() => resolve({ map: tex, normalMap: tex }))) });
    const map = kit.mats.stone.map;
    kit.keep();
    for (const arrive of coming) arrive();
    await kit.ready;
    expect(kit.mats.stone.map).toBe(map);
    expect(kit.mats.stone.userData.core).toBeUndefined();
    kit.dispose();
  });

  it('gives a moving thing twins dressed by their own UVs, so the grain goes with it', async () => {
    const tex = new THREE.Texture();
    const kit = createKit({ seed: 1, load: () => Promise.resolve({ map: tex, normalMap: tex }) });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BufferGeometry(), kit.mats.paint), new THREE.Mesh(new THREE.BufferGeometry(), kit.mats.glow));
    expect(kit.moving(g)).toBe(1);
    await kit.ready;
    const twin = g.children[0].material;
    expect(twin).not.toBe(kit.mats.paint);
    expect(twin.userData.core).toBeUndefined();
    expect(twin.map).toBe(tex);
    expect(g.children[1].material).toBe(kit.mats.glow);
    kit.dispose();
  });
});

describe('the kit’s pictures', () => {
  it('are painted once a seed for the page: another kit of the seed has its own copies, on the same paint', () => {
    const made = () => {
      let n = 0;
      const was = globalThis.document.createElement;
      globalThis.document.createElement = (...a) => {
        n += 1;
        return was(...a);
      };
      return () => {
        globalThis.document.createElement = was;
        return n;
      };
    };
    let count = made();
    const a = createKit({ seed: 4242, scans: false });
    expect(count()).toBeGreaterThan(0);
    count = made();
    const b = createKit({ seed: 4242, scans: false });
    expect(count()).toBe(0);
    for (const name of ['paint', 'metal', 'needles', 'foliage', 'fronds', 'broadleaf', 'strands']) {
      expect(b.mats[name].map, name).not.toBe(a.mats[name].map);
      expect(b.mats[name].map.source, name).toBe(a.mats[name].map.source);
    }
    a.dispose();
    b.dispose();
  });

  it('leave its numbers as they were: a kit made again of a seed hands its builders the same ones', () => {
    const first = createKit({ seed: 5151, scans: false });
    const again = createKit({ seed: 5151, scans: false });
    const draw = (k) => Array.from({ length: 6 }, () => k.rand());
    expect(draw(again)).toEqual(draw(first));
    first.dispose();
    again.dispose();
  });

  it('are freed with each kit as its own copies: the paint stays for the next', () => {
    const a = createKit({ seed: 6363, scans: false });
    const b = createKit({ seed: 6363, scans: false });
    const freed = [];
    b.mats.paint.map.addEventListener('dispose', () => freed.push('b'));
    a.dispose();
    expect(freed).toEqual([]);
    const c = createKit({ seed: 6363, scans: false });
    expect(c.mats.paint.map.source).toBe(b.mats.paint.map.source);
    b.dispose();
    c.dispose();
  });
});
