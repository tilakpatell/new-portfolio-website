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
    // (the way it blows, for the models that sway in it too: surface/nature.js)
    expect(kit.windAngle).toBe(Math.PI / 2);
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
