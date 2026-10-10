import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { checkWalrus } from '../src/lib/three/walrusRig.js';

const reader = async () => {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
};

describe('the game’s skeleton, as committed', () => {
  it('is Walrus_HumanMale whole: the body, the fingers and the sockets, and no mesh', async () => {
    const doc = await (await reader()).read('public/models/galaxy/bf2017/walrus.glb');
    const root = doc.getRoot();
    const names = root.listNodes().map((n) => n.getName());
    expect(checkWalrus(names)).toEqual({ ok: true, missing: [] });
    expect(names.length).toBeGreaterThanOrEqual(248);
    expect(root.listScenes()[0].getName()).toBe('Walrus_HumanMale');
    expect(root.listMeshes()).toHaveLength(0);
  });
});
