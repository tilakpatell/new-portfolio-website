// A loaded model's physical nodes become bodies and vanish: the drawing
// half of lib/physics/fromModel.js, on a Group built in Node.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { collidersOf } from './colliders';

const close = (a, b) => Array.from(a).forEach((v, i) => expect(v).toBeCloseTo(b[i], 5));
const box = () => new THREE.BoxGeometry(1, 1, 1);
const mat = new THREE.MeshBasicMaterial();

describe('collidersOf', () => {
  it('a crate_physical_dynamic with a cuboid child is one sleeping dynamic body, and isn’t drawn', () => {
    const root = new THREE.Group();
    const look = new THREE.Mesh(box(), mat);
    look.name = 'crate';
    const crate = new THREE.Mesh(box(), mat);
    crate.name = 'crate_physical_dynamic';
    crate.position.set(0, 0.5, 0);
    const cuboid = new THREE.Mesh(box(), mat);
    cuboid.name = 'cuboid';
    crate.add(cuboid);
    root.add(look, crate);
    const { bodies, hidden } = collidersOf(root);
    expect(bodies).toHaveLength(1);
    const [b] = bodies;
    expect(b.name).toBe('crate_physical_dynamic');
    expect(b.object).toBe(crate);
    expect(b.desc.type).toBe('dynamic');
    expect(b.desc.sleeping).toBe(true);
    close(b.desc.position, [0, 0.5, 0]);
    close(b.desc.colliders[0].args, [0.5, 0.5, 0.5]);
    expect(crate.visible).toBe(false);
    expect(look.visible).toBe(true);
    expect(hidden).toBe(1);
  });

  it('a barrel_physical with no child is one fixed cuboid round its own box', () => {
    const root = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2), mat);
    barrel.name = 'barrel_physical';
    root.add(barrel);
    const [b] = collidersOf(root).bodies;
    expect(b.desc.type).toBe('fixed');
    expect(b.desc.colliders[0].shape).toBe('cuboid');
    close(b.desc.colliders[0].args, [0.4, 0.6, 0.4]);
  });

  it('places a body relative to the model’s root, not the world, and takes its mass from userData', () => {
    const root = new THREE.Group();
    root.position.set(100, 0, 0); // (where the model stands isn't the body's business)
    const shelf = new THREE.Group();
    shelf.position.set(2, 0, 0);
    const pot = new THREE.Object3D();
    pot.name = 'pot_physical_dynamic';
    pot.userData.mass = 3;
    pot.position.set(0, 1, 0);
    const ball = new THREE.Object3D();
    ball.name = 'ball';
    ball.scale.setScalar(0.5);
    pot.add(ball);
    shelf.add(pot);
    root.add(shelf);
    root.updateMatrixWorld(true);
    const [b] = collidersOf(root).bodies;
    close(b.desc.position, [2, 1, 0]);
    expect(b.desc.mass).toBe(3);
    close(b.desc.colliders[0].args, [0.25]);
  });

  it('a hull takes its geometry’s points', () => {
    const root = new THREE.Group();
    const rock = new THREE.Object3D();
    rock.name = 'rock_physical_dynamic';
    const hull = new THREE.Mesh(new THREE.TetrahedronGeometry(1), mat);
    hull.name = 'hull';
    hull.scale.setScalar(2);
    rock.add(hull);
    root.add(rock);
    const [b] = collidersOf(root).bodies;
    const c = b.desc.colliders[0];
    expect(c.shape).toBe('hull');
    const geo = hull.geometry.attributes.position;
    expect(c.args[0].length).toBe(geo.count * 3);
    close(c.args[0].slice(0, 3), [geo.getX(0) * 2, geo.getY(0) * 2, geo.getZ(0) * 2]);
  });

  it('a model with no physical node gives nothing and hides nothing', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(box(), mat));
    expect(collidersOf(root)).toEqual({ bodies: [], hidden: 0 });
  });
});
