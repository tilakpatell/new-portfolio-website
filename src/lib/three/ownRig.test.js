import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { figureLoaderFor } from '../../components/galaxy/surface/crewList';
import { clearGLTFCache } from './gltfCache';
import { loadOwnRigBody, ownPackUrl } from './ownRig';
import { loadWalrusBody } from './walrus';

// a droid's skeleton: Root → Pelvis → Spine → Head, and Pelvis → LeftLeg
function droid() {
  const scene = new THREE.Group();
  const bone = (name, parent) => {
    const b = Object.assign(new THREE.Bone(), { name });
    parent.add(b);
    return b;
  };
  const root = bone('Root', scene);
  const pelvis = bone('Pelvis', root);
  bone('Head', bone('Spine', pelvis));
  bone('LeftLeg', pelvis);
  return scene;
}
const q = (bone) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0.1, 0, 0.995]);
const loaderOf = (files) => ({ loadAsync: async (url) => files[url] ?? null });

afterEach(() => clearGLTFCache());

describe('a 2017 figure on a skeleton of its own', () => {
  const files = {
    '/b1.glb': { scene: droid(), animations: [] },
    [ownPackUrl('b1')]: { scene: new THREE.Group(), animations: [new THREE.AnimationClip('walk', 1, [q('Pelvis'), q('Tail')]), new THREE.AnimationClip('idle', 1, [q('Head')])] },
  };

  it('plays its rig’s pack, filtered to the bones it has, and finds its bones by the row’s names', async () => {
    const { clips, bones, model } = await loadOwnRigBody('/b1.glb', { rig: 'b1', bones: { hips: 'Pelvis' }, loader: loaderOf(files) });
    expect(Object.keys(clips)).toEqual(expect.arrayContaining(['idle', 'walk']));
    expect(clips.walk.tracks.map((t) => t.name)).toContain('Pelvis.quaternion');
    expect(clips.walk.tracks.map((t) => t.name)).not.toContain('Tail.quaternion');
    expect(bones.hips.name).toBe('Pelvis');
    expect(bones.hips).toBe(model.getObjectByName('Pelvis'));
  });

  it('refuses a body without a bone its row names, naming it', async () => {
    await expect(loadOwnRigBody('/b1.glb', { rig: 'b1', bones: { hips: 'Hips' }, loader: loaderOf(files) })).rejects.toThrow(/Hips/);
  });

  it('refuses a rig with no pack, and a statue', async () => {
    await expect(loadOwnRigBody('/b1.glb', { rig: 'nobody', loader: loaderOf(files) })).rejects.toThrow(/no pack/);
    const statue = { '/rock.glb': { scene: new THREE.Group().add(new THREE.Mesh()), animations: [] }, [ownPackUrl('b1')]: files[ownPackUrl('b1')] };
    await expect(loadOwnRigBody('/rock.glb', { rig: 'b1', loader: loaderOf(statue) })).rejects.toThrow(/no skeleton/);
  });

  it('is handed the droids the walrus loader refuses: a row says which', async () => {
    // (the game's humanoid loader will not take a body without Wep_Root and the rest)
    await expect(loadWalrusBody('/b1.glb', { packs: [], loader: loaderOf(files) })).rejects.toThrow(/not on the game's skeleton/);
    expect(figureLoaderFor({ rig: 'own' })).toBe('own');
    expect(figureLoaderFor({ rig: 'walrus' })).toBe('walrus');
  });
});
