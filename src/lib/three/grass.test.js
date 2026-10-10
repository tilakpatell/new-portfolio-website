import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bladeLayout, createGrass, grassGeometry, grassShader } from './grass';
import { createGroundMap } from './groundmap';
import { createWind } from './wind';

describe('where the blades stand', () => {
  it('puts one blade in each cell of a grid over the patch, jittered inside its cell', () => {
    const { centres, rand } = bladeLayout({ side: 4, size: 8, seed: 3 });
    expect(centres).toHaveLength(4 * 4 * 2);
    expect(rand).toHaveLength(16);
    for (let k = 0; k < 16; k++) {
      const ix = k % 4;
      const iz = Math.floor(k / 4);
      const x = centres[k * 2];
      const z = centres[k * 2 + 1];
      // (cells 2 m across, the patch centred on nought)
      expect(x).toBeGreaterThanOrEqual(-4 + ix * 2);
      expect(x).toBeLessThan(-4 + (ix + 1) * 2);
      expect(z).toBeGreaterThanOrEqual(-4 + iz * 2);
      expect(z).toBeLessThan(-4 + (iz + 1) * 2);
      expect(rand[k]).toBeGreaterThanOrEqual(0);
      expect(rand[k]).toBeLessThan(1);
    }
  });

  it('is the same every time for one seed', () => {
    expect(bladeLayout({ side: 3, size: 6, seed: 9 })).toEqual(bladeLayout({ side: 3, size: 6, seed: 9 }));
  });
});

describe('the blades', () => {
  it('are one triangle each: two corners at the root, one at the tip', () => {
    const g = grassGeometry({ side: 3, size: 6 });
    expect(g.attributes.position.count).toBe(9 * 3);
    expect(g.index).toBe(null);
    const p = g.attributes.position;
    // (x: which side of the root, y: how far up the blade)
    expect([p.getX(0), p.getY(0), p.getX(1), p.getY(1), p.getX(2), p.getY(2)]).toEqual([-1, 0, 1, 0, 0, 1]);
    const b = g.attributes.aBlade;
    expect(b.itemSize).toBe(3);
    // (all three corners of a blade share its place and its random)
    expect([b.getX(3), b.getY(3), b.getZ(3)]).toEqual([b.getX(5), b.getY(5), b.getZ(5)]);
  });

  it('are shaped in the vertex shader: wrapped round the centre, on the ground, facing the camera, coloured as the ground', () => {
    const SHADER = {
      vertexShader: '#include <common>\nvoid main() {\n#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\n#include <color_fragment>\n#include <opaque_fragment>\n}',
    };
    const out = grassShader(SHADER);
    expect(out.swapped).toBe(true);
    const vs = out.vertexShader;
    expect(vs).toContain('attribute vec3 aBlade;');
    expect(vs).toContain('mod(aBlade.xy - uGrassCentre');
    expect(vs).toContain('groundHeight(gXz)');
    expect(vs).toContain('groundGrass(gXz)');
    expect(vs).toContain('cameraPosition.xz - gXz');
    expect(vs).toContain('windOffset(gXz)');
    expect(vs).toContain('vGrassColour = groundColour(gXz)');
    // (lit as the ground is: the normal straight up)
    expect(vs).toContain('vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
    const fs = out.fragmentShader;
    expect(fs).toContain('diffuseColor.rgb *= vGrassColour;');
    // (the root counted as shade, before anything after it sees the light)
    expect(fs.indexOf('outgoingLight *= mix(uGrassRoot, 1.0, vGrassTip);')).toBeLessThan(fs.indexOf('#include <opaque_fragment>'));
  });

  it('leave a shader without the lines they look for alone', () => {
    const odd = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
    expect(grassShader(odd).swapped).toBe(false);
  });

  it('works against the chunks three actually ships', () => {
    expect(grassShader({ vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag }).swapped).toBe(true);
  });
});

describe('a patch of grass', () => {
  const ground = () => createGroundMap({ size: 4, area: { x0: -10, z0: -10, w: 20, d: 20 }, paint: (x, z, out) => ((out[0] = 0.2), (out[1] = 0.5), (out[2] = 0.1), 1), height: () => 0 });

  it('is one draw that is never culled, reading its ground and its wind', () => {
    const map = ground();
    const wind = createWind();
    const grass = createGrass({ ground: map, wind, side: 8, size: 4 });
    expect(grass.mesh.isMesh).toBe(true);
    expect(grass.mesh.frustumCulled).toBe(false);
    expect(grass.mesh.castShadow).toBe(false);
    const sh = { vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag, uniforms: {} };
    grass.material.onBeforeCompile(sh, null);
    expect(sh.uniforms.uGroundMap.value).toBe(map.texture);
    expect(sh.uniforms.uWindTime).toBe(wind.uniforms.uWindTime);
    expect(sh.uniforms.uGrassCentre).toBe(grass.uniforms.uGrassCentre);
    grass.dispose();
    wind.dispose();
    map.dispose();
  });

  it('follows the centre it is given', () => {
    const map = ground();
    const wind = createWind();
    const grass = createGrass({ ground: map, wind, side: 4, size: 4 });
    grass.update(new THREE.Vector3(3, 1, -2));
    expect(grass.uniforms.uGrassCentre.value.toArray()).toEqual([3, -2]);
    grass.set({ height: 0.9, root: 0.4 });
    expect(grass.uniforms.uGrassHeight.value).toBe(0.9);
    expect(grass.uniforms.uGrassRoot.value).toBe(0.4);
    grass.dispose();
    wind.dispose();
    map.dispose();
  });
});

describe('grass over the tracks', () => {
  it('lies flat where the wheels went (G × (1 − r))', () => {
    const SHADER = {
      vertexShader: '#include <common>\nvoid main() {\n#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\n#include <color_fragment>\n#include <opaque_fragment>\n}',
    };
    const tracks = { glsl: 'vec4 tracksAt(vec2 xz) { return vec4(0.0); }', uniforms: {} };
    const out = grassShader(SHADER, { tracks });
    expect(out.vertexShader).toContain('vec4 tracksAt(vec2 xz)');
    expect(out.vertexShader).toContain('gGrass *= 1.0 - tracksAt(gXz).r;');
    expect(grassShader(SHADER).vertexShader).not.toContain('tracksAt(');
  });
});
