import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { dressKit, layKit } from './kitLay';

// a kit as GLTFLoader gives one: a scene whose children are the pieces by
// name, each a mesh at the piece's own origin
function fakeKit() {
  const scene = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ name: 'M_Wall' });
  const floor = new THREE.MeshStandardMaterial({ name: 'M_Floor' });
  for (const name of ['wall_a', 'end_b']) {
    const piece = new THREE.Group();
    piece.name = name;
    piece.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wall), new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), floor));
    scene.add(piece);
  }
  return scene;
}

describe('laying a kit’s pieces', () => {
  it('puts each piece where the layout says, turned and mirrored, sharing the kit’s geometry and materials', () => {
    const kit = fakeKit();
    const laid = layKit(kit, [
      { piece: 'wall_a', at: [20.48, 0, -30.72], yaw: 0, mirror: false },
      { piece: 'wall_a', at: [-20.48, 0, -30.72], yaw: 0, mirror: true },
      { piece: 'end_b', at: [-20.48, 0, -61.44], yaw: Math.PI, mirror: false },
    ]);
    expect(laid.children).toHaveLength(3);
    const [a, b, c] = laid.children;
    expect(a.position.toArray()).toEqual([20.48, 0, -30.72]);
    expect(b.scale.x).toBe(-1);
    expect(c.rotation.y).toBeCloseTo(Math.PI);
    expect(a.children[0].geometry).toBe(kit.children[0].children[0].geometry);
    expect(b.children[0].material).toBe(kit.children[0].children[0].material);
  });

  it('stretches a piece along its width to fill its run, and leaves out the parts in materials it’s told to', () => {
    const laid = layKit(fakeKit(), [{ piece: 'wall_a', at: [0, 0, 0], yaw: 0, stretch: 1.1 }, { piece: 'wall_a', at: [0, 0, 0], mirror: true, stretch: 0.9 }], { skip: ['M_Floor'] });
    expect(laid.children[0].scale.x).toBeCloseTo(1.1);
    expect(laid.children[1].scale.x).toBeCloseTo(-0.9);
    const left = [];
    laid.traverse((o) => o.isMesh && left.push(o.material.name));
    expect(left).toEqual(['M_Wall', 'M_Wall']);
  });

  it('says which pieces it hasn’t got, and lays the rest', () => {
    const laid = layKit(fakeKit(), [{ piece: 'nope', at: [0, 0, 0] }, { piece: 'end_b', at: [0, 0, 0] }]);
    expect(laid.children).toHaveLength(1);
    expect(laid.userData.missing).toEqual(['nope']);
  });

  it('dresses each of the kit’s materials by its name: a colour, a roughness, a scan role', async () => {
    const kit = fakeKit();
    const worn = [];
    const said = await dressKit(kit, { M_Wall: { color: '#cdd9e6', roughness: 0.5, role: 'snow' }, M_Floor: { color: '#8f969e', role: 'concrete' } }, { wear: (m, role) => worn.push([m.name, role]) });
    const [wall, floor] = kit.children[0].children.map((m) => m.material);
    expect(`#${wall.color.getHexString()}`).toBe('#cdd9e6');
    expect(wall.roughness).toBe(0.5);
    expect(`#${floor.color.getHexString()}`).toBe('#8f969e');
    expect(worn.sort()).toEqual([['M_Floor', 'concrete'], ['M_Wall', 'snow']]);
    expect(said).toBe(2);
  });
});
