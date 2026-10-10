import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWaterSurface, waterMesh, waterShader, waterlineShader } from './river';
import { createLandMap } from './landmap';
import { createWind } from './wind';
import { CELL, N, makeCell } from '../land/cell';
import { landSpec } from '../land/spec';
import { fieldAt } from '../land/layers';
import { riversNear } from '../land/rivers';

const spec = landSpec('seven');
const LAMBERT = { vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag };

// a cell a river runs through, above the sea
function riverCell() {
  for (let cz = -8; cz < 24; cz++)
    for (let cx = -8; cx < 24; cx++)
      for (const r of riversNear(spec, cx, cz)) {
        const p = r.points;
        for (let i = 0; i < p.length; i += 5) {
          const lx = p[i] - cx * CELL;
          const lz = p[i + 1] - cz * CELL;
          if (lx > 4 && lx < 60 && lz > 4 && lz < 60 && fieldAt(spec, p[i], p[i + 1]) > spec.sea + 1) return makeCell(spec, cx, cz);
        }
      }
  return null;
}

describe('waterMesh', () => {
  it('draws a river cell’s water, no triangle touching a dry vertex', () => {
    const cell = riverCell();
    const m = waterMesh(cell);
    expect(m).not.toBeNull();
    expect(m.indices.length).toBeGreaterThan(0);
    expect(m.indices.length % 3).toBe(0);
    for (const i of m.indices) expect(Number.isNaN(cell.water[i])).toBe(false);
    // (vertex i at (i mod 65, i div 65), at its water level)
    const i = m.indices[0];
    expect(m.positions[i * 3]).toBe(i % N);
    expect(m.positions[i * 3 + 1]).toBe(cell.water[i]);
    expect(m.positions[i * 3 + 2]).toBe(Math.floor(i / N));
  });

  it('is null for a dry cell', () => {
    const dry = { water: new Float32Array(N * N).fill(NaN) };
    expect(waterMesh(dry)).toBeNull();
  });
});

describe('the shaders', () => {
  it('is his water: the shore past B 0.17, the bands in the shallows, scrolled by the wind along the flow', () => {
    const out = waterShader(LAMBERT);
    expect(out.swapped).toBe(true);
    expect(out.fragmentShader).toContain('step(0.17');
    expect(out.fragmentShader).toContain('uWindTime');
    expect(out.fragmentShader).toContain('landMask(');
    expect(out.fragmentShader).not.toContain('uOpaque');
    expect(waterShader(LAMBERT, { blur: true }).fragmentShader).toContain('uOpaque');
  });

  it('puts his white waterline on what crosses it', () => {
    const out = waterlineShader(LAMBERT);
    expect(out.swapped).toBe(true);
    expect(out.fragmentShader).toContain('0.013');
    expect(out.fragmentShader).toContain('uWaterLevel');
  });

  it('leaves odd shaders alone', () => {
    const odd = { vertexShader: 'void main(){}', fragmentShader: 'void main(){}' };
    expect(waterShader(odd).swapped).toBe(false);
    expect(waterlineShader(odd).swapped).toBe(false);
  });
});

describe('createWaterSurface', () => {
  it('has a mesh a wet cell, none for a dry one, and blurs on high', () => {
    const map = createLandMap({ radius: 1, palette: spec.palette });
    const wind = createWind();
    const water = createWaterSurface({ map, wind, tier: 'high' });
    expect(water.blur).toBe(true);
    const cell = riverCell();
    water.set(cell.cx, cell.cz, cell);
    water.set(99, 99, { water: new Float32Array(N * N).fill(NaN) });
    expect(water.group.children).toHaveLength(1);
    const mesh = water.group.children[0];
    expect(mesh.position.x).toBe(cell.cx * CELL);
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.renderOrder).toBe(1);
    water.drop(cell.cx, cell.cz);
    expect(water.group.children).toHaveLength(0);
    expect(createWaterSurface({ map, wind, tier: 'mid' }).blur).toBe(false);
    water.setOpaque(null);
    water.dispose();
    map.dispose();
    wind.dispose();
  });
});
