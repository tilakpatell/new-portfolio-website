import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { assetUrl, createMeshyCast, cullWithin, FOLDERS } from './meshyCast';

// a skinned figure 1.8 m tall, as a Meshy rig arrives: its mesh under a
// node scaled to the rig's centimetres, its positions in those units
function figure() {
  const geo = new THREE.BoxGeometry(50, 180, 30).translate(0, 90, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4));
  const root = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  const rig = new THREE.Group();
  rig.scale.setScalar(0.01);
  rig.add(root, mesh);
  mesh.bind(new THREE.Skeleton([root]));
  const group = new THREE.Group();
  group.add(rig);
  group.updateMatrixWorld(true);
  return { group, mesh };
}
const frustumAt = (x, z) => {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  cam.position.set(x, 1.2, z);
  cam.lookAt(x, 1.0, z - 5);
  cam.updateMatrixWorld();
  return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
};

describe('a Meshy figure’s culling', () => {
  it('culls a skinned figure within a sphere round the whole figure, whatever its rig’s units', () => {
    const { group, mesh } = figure();
    cullWithin(mesh, group, 1.8);
    expect(mesh.frustumCulled).toBe(true);
    const world = mesh.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
    expect(world.center.y).toBeCloseTo(0.9, 5);
    expect(world.radius).toBeCloseTo(1.8 * 0.8, 5);
  });
  it('is seen in front of the camera, close or off to one side, and not behind it', () => {
    const { group, mesh } = figure();
    cullWithin(mesh, group, 1.8);
    const f = frustumAt(0, 5);
    for (const [x, z, seen] of [
      [0, 0, true],
      [0, 3.6, true],
      [2.2, 1, true],
      [0, 8, false],
    ]) {
      group.position.set(x, 0, z);
      group.updateMatrixWorld(true);
      expect(f.intersectsObject(mesh), `${x},${z}`).toBe(seen);
    }
  });
});

describe('a figure of the site’s own in the cast', () => {
  it('names Portal panic’s cast by name and anyone else by their whole path', () => {
    expect(assetUrl('rick')).toBe('/games/meshy/rick.glb');
    expect(assetUrl('/models/albuquerque/walt.glb')).toBe('/models/albuquerque/walt.glb');
    expect(assetUrl(Object.keys(FOLDERS)[0])).toBe(`${Object.values(FOLDERS)[0]}/${Object.keys(FOLDERS)[0]}.glb`);
  });

  // a rig as Meshy’s come: the hips `hipsY` up under a node scaled to centimetres
  const rig = (hipsY) => {
    const hips = new THREE.Bone();
    hips.name = 'Hips';
    hips.position.y = hipsY;
    const geo = new THREE.BoxGeometry(50, 180, 30).translate(0, 90, 0);
    const n = geo.attributes.position.count;
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4));
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
    const armature = new THREE.Group();
    armature.scale.setScalar(0.01);
    armature.add(hips, mesh);
    mesh.bind(new THREE.Skeleton([hips]));
    const scene = new THREE.Group();
    scene.add(armature);
    return scene;
  };
  const rickClip = (name) => new THREE.AnimationClip(name, 1, [new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0], [0, 0, 0, 1]), new THREE.VectorKeyframeTrack('Hips.position', [0], [0, 90, 0])]);

  it('loads one by its path and walks it on Rick’s clips, scaled to its hips', async () => {
    const urls = [];
    const loader = {
      async loadAsync(url) {
        urls.push(url);
        return url.includes('/rick-') ? { scene: rig(93.3), animations: [rickClip(url)] } : { scene: rig(98), animations: [] };
      },
    };
    const WALT = '/models/albuquerque/walt.glb';
    const cast = createMeshyCast({ kinds: { walt: { a: WALT, h: 1.79 } }, rigged: new Set([WALT]), loader });
    await cast.load(null, [WALT], { clips: ['idle', 'walk'] });
    expect(urls).toEqual(expect.arrayContaining([WALT, '/games/meshy/rick-idle.glb', '/games/meshy/rick-walk.glb']));
    expect(urls.some((u) => u.includes('walt-'))).toBe(false); // (he has no clips of his own to look for)
    const f = cast.make('walt');
    expect(f.meshy).toBe(true);
    expect(Object.keys(f.act).sort()).toEqual(['idle', 'walk']);
    const hips = f.act.walk.getClip().tracks.find((t) => t.name === 'Hips.position');
    expect(hips.values[1]).toBeCloseTo((90 * 98) / 93.3, 4);
    cast.dispose();
  });
});
