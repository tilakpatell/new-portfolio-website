import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BODY, SOCKETS } from '../../lib/three/walrusRig.js';

// The files a 2017 figure asks for: its body (no `.lod1` cut of it here) and
// the humanoid pack, an idle in it; and the library watched, which a 2017
// figure must never reach.
const loader = vi.hoisted(() => ({
  urls: [],
  loadAsync(url) {
    this.urls.push(url);
    return this.load(url);
  },
}));
const fetched = vi.hoisted(() => []);
vi.mock('../../lib/three/gltf', async (orig) => ({ ...(await orig()), gltfLoader: () => loader }));
vi.mock('../../lib/detail', async (orig) => ({ ...(await orig()), detailLevel: () => 'low' }));
vi.mock('../../lib/three/clipLibrary', async (orig) => ({ ...(await orig()), loadClip: (n) => (fetched.push(n), Promise.resolve(null)), forFigure: (n) => (fetched.push(n), Promise.resolve(null)) }));

const body = () => {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  root.add(hips);
  for (const n of [...BODY.filter((b) => b !== 'Hips'), 'Neck1', 'HeadEnd', ...Object.values(SOCKETS)]) {
    const b = new THREE.Bone();
    b.name = n;
    b.position.y = n === 'HeadEnd' ? 0.8 : 0;
    hips.add(b);
  }
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.3), new THREE.MeshStandardMaterial()));
  return root;
};
const idle = new THREE.AnimationClip('idle', 1, [new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])]);
loader.load = async (url) => {
  if (url.endsWith('.lod1.glb')) throw new Error('404');
  if (url.includes('clips-humanoid')) return { scene: new THREE.Group(), animations: [idle] };
  if (url.includes('/clips-')) throw new Error('404');
  return { scene: body(), animations: [] };
};

const { loadPartyFigure } = await import('./footScene');

describe('a 2017 hero out on foot', () => {
  const spec = { id: 'luke', name: 'Luke', tall: 1.72, rig: 'walrus', src: { url: '/models/galaxy/bf2017/crew/luke.glb' } };

  it('stands in its full file on a low device when its light cut is missing', async () => {
    const fig = await loadPartyFigure(spec, null);
    expect(fig?.rig).toBe('walrus');
    expect(loader.urls).toContain('/models/galaxy/bf2017/crew/luke.lod1.glb');
    expect(loader.urls).toContain('/models/galaxy/bf2017/crew/luke.glb');
    fig.dispose();
  });

  it('never fetches a library clip for a name its packs lack', async () => {
    const fig = await loadPartyFigure(spec, null);
    fetched.length = 0;
    expect(await fig.play('sword.dash')).toBe(false);
    expect(fig.react('hit', {})).toBeNull();
    fig.base('sit.idle');
    await Promise.resolve();
    expect(fetched).toEqual([]);
    fig.dispose();
  });
});
