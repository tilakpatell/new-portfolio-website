import { describe, expect, it } from 'vitest';
import { blobPlacement, bounceShader, floorShadowShader, maskWeights } from './grounding';

// three's chunks as this version has them (the line the rewrite looks for)
const CHUNKS = {
  lights_fragment_begin: 'IncidentLight directLight;\n#pragma unroll_loop_start\nfor ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\tdirectionalLight = directionalLights[ i ];\n\tgetDirectionalLightInfo( directionalLight, directLight );\n\tRE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n}\n#pragma unroll_loop_end\n',
};

const SHADER = {
  vertexShader: '#include <common>\nvoid main() {\n#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <worldpos_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <clipping_planes_fragment>\n#include <lights_fragment_begin>\n#include <aomap_fragment>\nvec3 outgoingLight = vec3(1.0);\n#include <opaque_fragment>\n}',
};

const TIMES = [
  { tod: 0.245, channel: 3 },
  { tod: 0.262, channel: 0 },
  { tod: 0.5, channel: 1 },
  { tod: 0.71, channel: 2 },
  { tod: 0.76, channel: 3 },
];

describe('the floor read from its masks', () => {
  it('cuts the sun, the sky and tints the dark, each where three works it out', () => {
    const out = floorShadowShader(SHADER, { areas: 2 }, CHUNKS);
    expect(out.swapped).toEqual({ sun: true, sky: true, shade: true });
    expect(out.fragmentShader).toContain('getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= gSun;');
    expect(out.fragmentShader).toContain('reflectedLight.indirectDiffuse *= gSky;');
    expect(out.fragmentShader).toContain('mix(uShade * outgoingLight, outgoingLight, 0.4 + 0.6 * min(gSun, gV.y))');
    expect(out.fragmentShader).not.toContain('#include <lights_fragment_begin>');
    // (the material's own occlusion map, if any, still applies first)
    expect(out.fragmentShader).toContain('#include <aomap_fragment>');
  });

  it('reads each mask by a fixed index, one block per area', () => {
    const out = floorShadowShader(SHADER, { areas: 3 }, CHUNKS);
    expect(out.fragmentShader).toContain('uniform sampler2D uMask[3];');
    expect(out.fragmentShader).toContain('texture2D(uMask[0], uv)');
    expect(out.fragmentShader).toContain('texture2D(uMask[2], uv)');
    expect(out.fragmentShader).not.toContain('uMask[i]');
    expect(out.fragmentShader).not.toContain('texture2D(uMask[3], uv)');
  });

  it('adds a world position that follows instancing', () => {
    const out = floorShadowShader(SHADER, { areas: 1 }, CHUNKS);
    expect(out.vertexShader).toContain('varying vec3 vGroundPos;');
    expect(out.vertexShader).toMatch(/#ifdef USE_INSTANCING\s+gp = instanceMatrix \* gp;/);
    expect(out.vertexShader).toContain('vGroundPos = (modelMatrix * gp).xyz;');
  });

  it('leaves the sun alone when its line has moved', () => {
    const out = floorShadowShader(SHADER, { areas: 1 }, { lights_fragment_begin: 'something else entirely' });
    expect(out.swapped.sun).toBe(false);
    expect(out.fragmentShader).toContain('#include <lights_fragment_begin>');
    expect(out.swapped.sky).toBe(true);
  });

  it('shares its varying with the bounce, whichever comes first', () => {
    const a = bounceShader(floorShadowShader(SHADER, { areas: 1 }, CHUNKS));
    const b = floorShadowShader(bounceShader(SHADER), { areas: 1 }, CHUNKS);
    for (const out of [a, b]) {
      expect(out.vertexShader.match(/varying vec3 vGroundPos;/g)).toHaveLength(1);
      expect(out.fragmentShader.match(/varying vec3 vGroundPos;/g)).toHaveLength(1);
      expect(out.vertexShader.match(/varying vec3 vGroundN;/g)).toHaveLength(1);
    }
  });

  it('works against the chunks three actually ships', async () => {
    const THREE = await import('three');
    const lambert = { vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader };
    const standard = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    for (const sh of [lambert, standard]) {
      const out = floorShadowShader(sh, { areas: 4 }, THREE.ShaderChunk);
      expect(out.swapped).toEqual({ sun: true, sky: true, shade: true });
      expect(bounceShader(sh).swapped.bounce).toBe(true);
    }
  });
});

describe('the bounce off the floor', () => {
  it('tints toward the floor colour by height and by how much a face looks down', () => {
    const out = bounceShader(SHADER);
    expect(out.fragmentShader).toContain('outgoingLight = mix(outgoingLight, uBounceColor, bD * bA);');
    expect(out.fragmentShader).toContain('(vGroundPos.y - (uBounceFloor)) / uBounceHeight');
    expect(out.vertexShader).toContain('vec3 gn = objectNormal;');
    expect(out.vertexShader).toContain('gn = mat3(instanceMatrix) * gn;');
  });

  it('stands each instance on its own foot when asked', () => {
    const out = bounceShader(SHADER, { base: true });
    expect(out.vertexShader).toContain('vGroundBase = (modelMatrix * gb).y;');
    expect(out.fragmentShader).toContain('vGroundBase + uBounceFloor');
  });

  it('uses the plain normal where a shader has no objectNormal', () => {
    const out = bounceShader({ vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <worldpos_vertex>\n}', fragmentShader: SHADER.fragmentShader });
    expect(out.vertexShader).toContain('vec3 gn = normal;');
  });
});

describe('the time of day between the masks', () => {
  it('is the named time itself at a named time', () => {
    expect(maskWeights(0.5, TIMES)).toEqual([1, 2, 0]);
    expect(maskWeights(0.262, TIMES)).toEqual([0, 1, 0]);
  });

  it('blends the two either side', () => {
    const [a, b, t] = maskWeights(0.605, TIMES);
    expect([a, b]).toEqual([1, 2]);
    expect(t).toBeCloseTo(0.5, 6);
  });

  it('has no sun at night, and brings it in as the sun comes up', () => {
    expect(maskWeights(0.93, TIMES)).toEqual([3, 3, expect.any(Number)]);
    expect(maskWeights(0.1, TIMES).slice(0, 2)).toEqual([3, 3]);
    const [a, b, t] = maskWeights(0.2535, TIMES);
    expect([a, b]).toEqual([3, 0]);
    expect(t).toBeCloseTo(0.5, 6);
  });

  it('goes round midnight', () => {
    const times = [
      { tod: 0.2, channel: 0 },
      { tod: 0.8, channel: 1 },
    ];
    const [a, b, t] = maskWeights(0.9, times);
    expect([a, b]).toEqual([1, 0]);
    expect(t).toBeCloseTo(0.25, 6);
    const [a2, b2, t2] = maskWeights(-0.1, times);
    expect([a2, b2]).toEqual([1, 0]);
    expect(t2).toBeCloseTo(0.25, 6);
    expect(maskWeights(1.5, times)[0]).toBe(maskWeights(0.5, times)[0]);
  });

  it('falls back to the sky alone with nothing named', () => {
    expect(maskWeights(0.4, [])).toEqual([3, 3, 0]);
    expect(maskWeights(0.4, [{ tod: 0.5, channel: 1 }])).toEqual([1, 1, 0]);
  });
});

describe('a blob under a moving thing', () => {
  const noon = { x: 0, y: 1, z: 0 };
  const low = { x: 0.6, y: 0.2, z: 0.0 };

  it('sits right under it on the ground', () => {
    const b = blobPlacement(low, { x: 5, z: -3 }, 0, 0);
    expect(b).toEqual({ x: 5, z: -3, alpha: 1, scale: 1 });
  });

  it('slides away from the sun as it rises, further for a low sun', () => {
    const high = blobPlacement(noon, { x: 0, z: 0 }, 1, 0);
    expect(high.x).toBeCloseTo(0, 9);
    const b = blobPlacement(low, { x: 0, z: 0 }, 1, 0);
    expect(b.x).toBeCloseTo(-3, 9); // away from a sun to the east (+x)
    expect(b.z).toBeCloseTo(0, 9);
    expect(b.scale).toBeCloseTo(1.15, 9);
  });

  it('fades as it rises and as it tips, gone by 3 m or on its side', () => {
    expect(blobPlacement(noon, { x: 0, z: 0 }, 1.5, 0).alpha).toBeCloseTo(0.25, 9);
    expect(blobPlacement(noon, { x: 0, z: 0 }, 3, 0).alpha).toBe(0);
    expect(blobPlacement(noon, { x: 0, z: 0 }, 6, 0).alpha).toBe(0);
    expect(blobPlacement(noon, { x: 0, z: 0 }, 0, 0.5).alpha).toBeCloseTo(0.25, 9);
    expect(blobPlacement(noon, { x: 0, z: 0 }, 0, 1).alpha).toBe(0);
  });

  it('never runs off to the horizon under a setting sun', () => {
    const b = blobPlacement({ x: 1, y: 0.01, z: 0 }, { x: 0, z: 0 }, 1, 0);
    expect(b.x).toBeCloseTo(-1 / 0.08, 6);
  });

  it('takes nonsense as standing still', () => {
    const b = blobPlacement(noon, { x: 1, z: 2 }, Number.NaN, Number.NaN);
    expect(b).toEqual({ x: 1, z: 2, alpha: 1, scale: 1 });
  });

  it('fills the object it is given', () => {
    const out = {};
    expect(blobPlacement(noon, { x: 0, z: 0 }, 0, 0, out)).toBe(out);
  });
});
