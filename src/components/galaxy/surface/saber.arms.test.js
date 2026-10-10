import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

// (the clip library watched: a 2017 figure's saber must never fetch from it)
const fetched = [];
vi.mock('../../../lib/three/clipLibrary', async (orig) => ({ ...(await orig()), loadClip: (n) => (fetched.push(n), Promise.resolve(null)) }));
const { meshyRig } = await import('../../../lib/three/meshyRig.fixture');
const { createGunplay } = await import('../../universe/gunplay');
const { ARMS, createSaber } = await import('./saber');

describe('the bones a stroke lays over the arms', () => {
  it('names the game’s spine as well as Meshy’s', () => {
    for (const n of ['Spine1', 'Spine2', 'Neck', 'Spine02', 'Spine01', 'Spine', 'RightHand', 'LeftHand']) expect(ARMS).toContain(n);
  });
});

describe('a saber in the hands of a figure on the game’s skeleton', () => {
  const armed = (fig) => {
    const rig = meshyRig();
    new THREE.Group().add(rig.model);
    const gp = createGunplay({ model: rig.model, bones: rig.bones }, 'saber', { unit: 1 });
    return createSaber(gp, { stance: 'single', fig: { bones: rig.bones, hipsY: rig.hipsY, ...fig } });
  };
  it('strokes with the figure’s own clips and never fetches the library’s', () => {
    fetched.length = 0;
    const saber = armed({ rig: 'walrus', clips: {} });
    // (a peer's packet naming a stroke it hasn't: still not fetched)
    saber.light(true);
    saber.swing(1, { clip: 'sword.a' });
    saber.dispose();
    expect(fetched).toEqual([]);
  });
  it('while anyone else’s still fetches them', () => {
    fetched.length = 0;
    armed({}).dispose();
    expect(fetched.length).toBeGreaterThan(0);
  });
});
