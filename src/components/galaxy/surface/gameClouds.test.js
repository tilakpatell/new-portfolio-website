import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CARDS, cardPlacements, cloudsWanted, createGameClouds } from './gameClouds';

const site = (clouds) => ({ sky: { suns: [{ az: 0.4, el: 0.7 }], clouds } });
const models = Object.fromEntries(CARDS.map((c) => [c, { url: `/${c.slice(5)}.glb` }]));
// a card as the import makes one: a strip 240 m wide, 55 tall
const card = () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(240, 55, 20), new THREE.MeshBasicMaterial()));
  return { scene };
};

describe('the game’s clouds in a world’s sky', () => {
  it('are wanted only where the clouds row asks, and only on high and ultra (Review Focus 4)', () => {
    expect(cloudsWanted(site({ cover: 0.5 }), 'ultra')).toBeNull();
    expect(cloudsWanted(site(null), 'ultra')).toBeNull();
    expect(cloudsWanted(site({ game: true }), 'low')).toBeNull();
    expect(cloudsWanted(site({ game: true }), 'mid')).toBeNull();
    expect(cloudsWanted(site({ game: true, color: '#fff' }), 'high')).toMatchObject({ n: 12, color: '#fff' });
    expect(cloudsWanted(site({ game: { n: 6 } }), 'ultra').n).toBe(6);
    expect(createGameClouds(site({ game: true }), { level: 'low', models, load: card })).toBeNull();
  });

  it('spreads the cards round the ring, the same every visit, each shape in turn', () => {
    const want = cloudsWanted(site({ game: true }), 'high');
    const a = cardPlacements(want, 3);
    expect(a).toEqual(cardPlacements(want, 3));
    expect(a).toHaveLength(12);
    expect(new Set(a.map((p) => p.shape))).toEqual(new Set([0, 1, 2]));
    for (const p of a) expect(p.el).toBeGreaterThanOrEqual(want.el[0]);
  });

  it('draws one instanced mesh a card shape, behind everything, following you', async () => {
    const clouds = createGameClouds(site({ game: true }), { level: 'high', models, load: card });
    await clouds.ready;
    const meshes = clouds.group.children.filter((o) => o.isInstancedMesh);
    expect(meshes).toHaveLength(3);
    expect(meshes.reduce((n, m) => n + m.count, 0)).toBe(12);
    for (const m of meshes) expect(m.material.depthWrite).toBe(false);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 2, -3);
    clouds.update(camera, 10);
    expect(clouds.group.position.toArray()).toEqual([5, 2, -3]);
    clouds.dispose();
  });

  it('draws nothing while no card is published', () => {
    expect(createGameClouds(site({ game: true }), { level: 'high', models: {}, load: card })).toBeNull();
  });
});
