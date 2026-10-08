import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { RM_DYES, createRmFigures, dyeOf } from './cast';

// a cast figure as portal/meshyCast.js's make gives one: its group, its
// height in the cast's units, its update and its calls
const castFigure = () => {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.8, 1), new THREE.MeshStandardMaterial({ color: 0x888888 }));
  group.add(mesh);
  return { group, mesh, height: 2.8, update: vi.fn(), after: vi.fn(), play: vi.fn(() => Promise.resolve(true)), stop: vi.fn(), release: vi.fn() };
};

describe('the planets’ people, from the Meshy cast', () => {
  it('is nobody when the cast has no figure for the kind, so the actors’ own stand-in stands', async () => {
    const { figure } = createRmFigures({ make: () => null });
    expect(await figure('gazorpian', {}, 0)).toBeNull();
  });

  it('is nobody for a kind that isn’t one of the cast’s rigged people', async () => {
    const make = vi.fn(castFigure);
    const { figure } = createRmFigures({ make });
    expect(await figure('rock', {}, 0)).toBeNull();
    expect(await figure('gazorpgate', {}, 0)).toBeNull();
    expect(make).not.toHaveBeenCalled();
  });

  it('loads the kind’s model into the cast before it makes one', async () => {
    const order = [];
    const cast = { load: vi.fn(async () => order.push('load')), make: vi.fn(() => (order.push('make'), castFigure())) };
    await createRmFigures(cast).figure('marsha', {}, 2);
    expect(cast.load).toHaveBeenCalledWith(null, ['marsha']);
    expect(order).toEqual(['load', 'make']);
    expect(cast.make).toHaveBeenCalledWith('marsha', 2, expect.objectContaining({ tall: 2.3 }));
  });

  it('wraps a cast figure in the shape the surface’s people take, in metres', async () => {
    const c = castFigure();
    const fig = await createRmFigures({ make: () => c }).figure('gazorpian', {}, 0);
    expect(fig.tall).toBe(2.8);
    for (const call of ['update', 'play', 'stop', 'base', 'look', 'react', 'dispose']) expect(typeof fig[call], call).toBe('function');
    expect(fig.anim).toBeNull();
    expect(fig.model.children).toContain(c.group);
    // (its motion handed on in the cast's units, its bones laid over once it's placed)
    fig.update(0.05, 0.5, { speed: 1.4, side: 0, turn: 0 });
    expect(c.update).toHaveBeenCalledWith(0, 0.5, 0, expect.objectContaining({ dt: 0.05, after: false, motion: expect.objectContaining({ speed: 1.4 }) }));
    expect(c.after).toHaveBeenCalled();
    fig.dispose();
    expect(c.release).toHaveBeenCalled();
  });

  it('dyes a figure whose life entry asks: each of its materials, keeping its light and shade', async () => {
    const c = castFigure();
    const own = c.mesh.material;
    const fig = await createRmFigures({ make: () => c }).figure('gazorpian', { dye: 0x3a6ad8 }, 0);
    expect(fig.tall).toBe(2.8);
    expect(c.mesh.material).not.toBe(own);
    expect(typeof c.mesh.material.onBeforeCompile).toBe('function');
    const shader = { uniforms: {}, fragmentShader: 'void main() {\n#include <map_fragment>\n}' };
    c.mesh.material.onBeforeCompile(shader);
    expect(shader.uniforms.uDye.value.getHex()).toBe(0x3a6ad8);
    // (the dyed copy is the figure's own, freed with it)
    const gone = vi.spyOn(c.mesh.material, 'dispose');
    fig.dispose();
    expect(gone).toHaveBeenCalled();
  });

  it('dyes by a named set, a colour each of the entry’s figures in turn', () => {
    expect(dyeOf({ dye: 'purger' }, 0)).toBe(RM_DYES.purger[0]);
    expect(dyeOf({ dye: 'purger' }, 6)).toBe(RM_DYES.purger[6 % RM_DYES.purger.length]);
    expect(dyeOf({ dye: 'gearpolice' }, 3)).toBe(RM_DYES.gearpolice);
    expect(dyeOf({ dye: [1, 2] }, 3)).toBe(2);
    expect(dyeOf({}, 0)).toBeNull();
    expect(RM_DYES.purger).toHaveLength(5);
    expect(RM_DYES.birdfolk).toHaveLength(3);
  });

  it('dyes a set piece of a person (the gear police) from its model, when the entry asks', async () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const model = new THREE.Group().add(mesh);
    const modelFigure = vi.fn(async () => ({ model, tall: 1.8, update() {}, dispose() {} }));
    const { figure } = createRmFigures({ make: () => null }, { modelFigure });
    expect(await figure('gearperson-a', {}, 0)).toBeNull();
    const fig = await figure('gearperson-a', { dye: 'gearpolice' }, 0);
    expect(modelFigure).toHaveBeenCalledWith('gearperson-a', expect.any(Object));
    expect(fig.tall).toBe(1.8);
    const shader = { uniforms: {}, fragmentShader: '#include <map_fragment>' };
    mesh.material.onBeforeCompile(shader);
    expect(shader.uniforms.uDye.value.getHex()).toBe(RM_DYES.gearpolice);
  });
});
