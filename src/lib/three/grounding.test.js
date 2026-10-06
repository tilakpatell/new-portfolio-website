import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SHADE_TINT, blobPlacement, bounce, bounceShader, floorShadow, floorShadowShader, maskWeights, setFloorTime, shadeTint, standIn } from './grounding';

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
    expect(out.fragmentShader).toContain('outgoingLight *= mix(vec3(1.0), uShadeTint, uShadeMix * (1.0 - min(gSun, gV.y)));');
    expect(out.fragmentShader).toContain('uniform vec3 uShadeTint;');
    expect(out.fragmentShader).toContain('uniform float uShadeMix;');
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

describe('the colour a shadow goes', () => {
  // linear luminance, as the shader sees the colour
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  it('keeps the shade’s hue at the brightness asked for', () => {
    const shade = new THREE.Color(0x5a3420);
    const t = shadeTint(shade, 0.75);
    expect(lum(t)).toBeCloseTo(0.75, 6);
    expect(t.r / t.g).toBeCloseTo(shade.r / shade.g, 6);
    expect(t.g / t.b).toBeCloseTo(shade.g / shade.b, 6);
    // (warm: more red than green, more green than blue)
    expect(t.r).toBeGreaterThan(t.g);
    expect(t.g).toBeGreaterThan(t.b);
  });

  it('leaves the colour it was given alone', () => {
    const shade = new THREE.Color(0x5a3420);
    const before = shade.getHex();
    shadeTint(shade, 0.75);
    expect(shade.getHex()).toBe(before);
  });

  it('softens the hue toward grey by the saturation asked for, at the same brightness', () => {
    const shade = new THREE.Color(0x5a3420);
    const full = shadeTint(shade, 0.45, 1);
    const soft = shadeTint(shade, 0.45, 0.6);
    const grey = shadeTint(shade, 0.45, 0);
    expect(lum(soft)).toBeCloseTo(0.45, 6);
    expect([grey.r, grey.g, grey.b].map((v) => +v.toFixed(6))).toEqual([0.45, 0.45, 0.45]);
    expect(soft.r).toBeCloseTo(0.45 + (full.r - 0.45) * 0.6, 6);
    expect(soft.b).toBeCloseTo(0.45 + (full.b - 0.45) * 0.6, 6);
    // (still warm)
    expect(soft.r).toBeGreaterThan(soft.g);
    expect(soft.g).toBeGreaterThan(soft.b);
  });

  it('takes black as no tint at all', () => {
    const t = shadeTint(new THREE.Color(0x000000), 0.75);
    expect([t.r, t.g, t.b]).toEqual([0.75, 0.75, 0.75]);
  });
});

describe('the floor’s shade through the day', () => {
  const bake = () => ({ areas: [{ texture: null, x0: 0, z0: 0, w: 10, d: 10 }], times: TIMES, shade: 0x5a3420 });
  const uniformsOf = (b) => floorShadow(new THREE.MeshStandardMaterial(), b).userData.floorShadow;

  it('tints the shadows fully while the sun lights the floor, and not at all at night', () => {
    const b = bake();
    const u = uniformsOf(b);
    setFloorTime(b, 0.5, 1);
    expect(u.uShadeMix.value).toBeCloseTo(SHADE_TINT.mix, 9);
    setFloorTime(b, 0.93, 0);
    expect(u.uShadeMix.value).toBe(0);
  });

  it('tints them by as much as a low sun lights it', () => {
    const b = bake();
    const u = uniformsOf(b);
    setFloorTime(b, 0.262, 0.4);
    expect(u.uShadeMix.value).toBeCloseTo(SHADE_TINT.mix * 0.4, 9);
    // (and a share past the ends is held to them)
    setFloorTime(b, 0.262, 3);
    expect(u.uShadeMix.value).toBeCloseTo(SHADE_TINT.mix, 9);
  });

  it('takes the sun as full where nobody says', () => {
    const b = bake();
    const u = uniformsOf(b);
    setFloorTime(b, 0.5);
    expect(u.uShadeMix.value).toBeCloseTo(SHADE_TINT.mix, 9);
    expect(u.uMaskMix.value.toArray()).toEqual([1, 2, 0]);
  });
});

describe('the bounce off a floor of any height', () => {
  it('reads the floor\'s height under each point from the baked mask, else the one height it was given', () => {
    const out = bounceShader(SHADER, { mask: true });
    expect(out.fragmentShader).toContain('uniform sampler2D uBounceMask;');
    expect(out.fragmentShader).toContain('uniform vec4 uBounceRect;');
    expect(out.fragmentShader).toContain('uniform vec2 uBounceRange;');
    expect(out.fragmentShader).toContain('gFloor(vGroundPos)');
    // (no floor baked there: G and B both 0, and the uniform height stands)
    expect(out.fragmentShader).toMatch(/v < 0\.5\)\s*return uBounceFloor;/);
  });

  it('takes the mask\'s texture, place and range as uniforms', () => {
    const mask = { areas: [{ texture: new THREE.Texture(), x0: -10, z0: -20, w: 40, d: 50 }], range: [-2, 8] };
    const m = bounce(new THREE.MeshStandardMaterial(), { color: 0x808080, mask });
    const u = m.userData.bounce;
    expect(u.uBounceMask.value).toBe(mask.areas[0].texture);
    expect(u.uBounceRect.value.toArray()).toEqual([-10, -20, 1 / 40, 1 / 50]);
    expect(u.uBounceRange.value.toArray()).toEqual([-2, 8]);
    expect(m.customProgramCacheKey()).toContain('bounce:0:mask');
  });
});

describe('a mover standing in the baked shade', () => {
  it('has the sun cut and the sky dimmed less than the floor, with no tint of its own', () => {
    const out = floorShadowShader(SHADER, { areas: 1, mover: true }, CHUNKS);
    expect(out.swapped.sun).toBe(true);
    expect(out.swapped.shade).toBe(false);
    expect(out.fragmentShader).toContain('mix(0.7, 1.0, gV.y)');
    expect(out.fragmentShader).not.toContain('uShadeTint, uShadeMix');
  });

  it('marks its material, with a program of its own', () => {
    const bake = { areas: [{ texture: new THREE.Texture(), x0: 0, z0: 0, w: 10, d: 10 }], times: [{ tod: 0.5, channel: 0 }] };
    const m = standIn(new THREE.MeshStandardMaterial(), bake);
    expect(m.userData.standIn).toBeTruthy();
    expect(m.customProgramCacheKey()).toContain('standIn:1');
    // (the floor of the same bake keeps its own uniforms: a mover doesn't take its tint)
    const f = floorShadow(new THREE.MeshStandardMaterial(), bake);
    expect(f.userData.floorShadow).not.toBe(m.userData.standIn);
    expect(m.userData.standIn.uMask).toBe(f.userData.floorShadow.uMask);
  });
});

describe('the bounce on a shader with no world position of its own', () => {
  it('works it out after the projection, as a matcap has no worldpos chunk', () => {
    const matcapLike = { vertexShader: '#include <common>\nvoid main() {\n#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>\n}', fragmentShader: SHADER.fragmentShader };
    const out = bounceShader(matcapLike);
    expect(out.vertexShader).toContain('vGroundPos = (modelMatrix * gp).xyz;');
    expect(out.vertexShader.indexOf('vGroundPos =')).toBeGreaterThan(out.vertexShader.indexOf('#include <project_vertex>'));
  });
});
