import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LOOK, createHouse, houseShader } from './house';

// three's chunks as this version has them (the lines the rewrite looks for)
const CHUNKS = {
  fog_fragment: '#ifdef USE_FOG\n\t#ifdef FOG_EXP2\n\t\tfloat fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );\n\t#else\n\t\tfloat fogFactor = smoothstep( fogNear, fogFar, vFogDepth );\n\t#endif\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif',
};

const SHADER = {
  vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <opaque_fragment>\n#include <tonemapping_fragment>\n#include <fog_fragment>\n}',
};

// a stand-in for three's compile: the material's hook run on its shader
const compiled = (material, kind = 'meshlambert') => {
  const sh = { vertexShader: THREE.ShaderChunk[`${kind}_vert`], fragmentShader: THREE.ShaderChunk[`${kind}_frag`], uniforms: {} };
  material.onBeforeCompile(sh, null);
  return sh;
};

describe('the house look in the shader', () => {
  it('turns shade into the look’s colour after three’s own light, before the output', () => {
    const out = houseShader(SHADER, {}, CHUNKS);
    expect(out.swapped.look).toBe(true);
    const fs = out.fragmentShader;
    expect(fs).toContain('uniform vec3 uLookShadow;');
    // (the look sits just before the output line, after everything that lit the point)
    expect(fs.indexOf('uLookShadow, ')).toBeLessThan(fs.indexOf('#include <opaque_fragment>'));
    expect(fs).toContain('outgoingLight = mix(');
    // (emissive is kept out of the litness and added back as it was)
    expect(fs).toContain('totalEmissiveRadiance');
    // (no division by nothing for a black albedo)
    expect(fs).toContain('max(lookLuma(lkAlbedo * uLookRef), 1e-4)');
    // (metals keep their own light)
    expect(fs).toMatch(/#ifdef STANDARD[\s\S]*metalnessFactor/);
  });

  it('colours the fog as the sky along the view ray', () => {
    const out = houseShader(SHADER, {}, CHUNKS);
    expect(out.swapped.fog).toBe(true);
    const fs = out.fragmentShader;
    expect(fs).not.toContain('#include <fog_fragment>');
    expect(fs).toContain('houseSky(');
    expect(fs).toContain('transpose(mat3(viewMatrix))');
    // (three's own fog factor, linear or exponential, is kept)
    expect(fs).toContain('smoothstep( fogNear, fogFar, vFogDepth )');
  });

  it('leaves the fog alone when asked, or when the chunk isn’t what it expects', () => {
    expect(houseShader(SHADER, { fog: false }, CHUNKS).fragmentShader).toContain('#include <fog_fragment>');
    const odd = houseShader(SHADER, {}, { fog_fragment: 'something else' });
    expect(odd.swapped.fog).toBe(false);
    expect(odd.fragmentShader).toContain('#include <fog_fragment>');
    expect(odd.swapped.look).toBe(true);
  });

  it('leaves a shader with no output line alone', () => {
    const plain = { vertexShader: SHADER.vertexShader, fragmentShader: '#include <common>\nvoid main() { gl_FragColor = vec4(1.0); }' };
    const out = houseShader(plain, { fog: false }, CHUNKS);
    expect(out.swapped.look).toBe(false);
    expect(out.fragmentShader).toBe(plain.fragmentShader);
  });

  it('works against the chunks three actually ships', () => {
    for (const kind of ['meshlambert', 'meshphong', 'meshtoon', 'meshphysical']) {
      const out = houseShader({ vertexShader: THREE.ShaderChunk[`${kind}_vert`], fragmentShader: THREE.ShaderChunk[`${kind}_frag`] }, {}, THREE.ShaderChunk);
      expect(out.swapped, kind).toEqual({ look: true, fog: true });
    }
  });
});

describe('a world’s house', () => {
  it('patches every lit material under a root once, and nothing unlit', () => {
    const house = createHouse();
    const lambert = new THREE.MeshLambertMaterial();
    const standard = new THREE.MeshStandardMaterial();
    const basic = new THREE.MeshBasicMaterial();
    const shader = new THREE.ShaderMaterial();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BufferGeometry(), lambert), new THREE.Mesh(new THREE.BufferGeometry(), [standard, basic]), new THREE.Mesh(new THREE.BufferGeometry(), shader));
    // (the same material twice, and a second adopt, still patch once)
    root.add(new THREE.Mesh(new THREE.BufferGeometry(), lambert));
    expect(house.adopt(root)).toBe(2);
    expect(house.adopt(root)).toBe(0);
    expect(lambert.userData.house).toBe(house.uniforms);
    expect(standard.userData.house).toBe(house.uniforms);
    expect(basic.userData.house).toBeUndefined();
    expect(shader.userData.house).toBeUndefined();
  });

  it('chains a hook the material already had, and shares one set of uniforms', () => {
    const house = createHouse();
    const m = new THREE.MeshStandardMaterial();
    let ran = 0;
    m.onBeforeCompile = (sh) => {
      ran += 1;
      sh.uniforms.uMine = { value: 1 };
    };
    m.customProgramCacheKey = () => 'mine';
    house.adopt(new THREE.Mesh(new THREE.BufferGeometry(), m));
    const sh = compiled(m, 'meshphysical');
    expect(ran).toBe(1);
    expect(sh.uniforms.uMine).toBeDefined();
    expect(sh.uniforms.uLookShadow).toBe(house.uniforms.uLookShadow);
    expect(sh.fragmentShader).toContain('uniform vec3 uLookShadow;');
    expect(m.customProgramCacheKey()).toBe('mine|house');
  });

  it('skips what asks to be left as it is', () => {
    const house = createHouse();
    const m = new THREE.MeshLambertMaterial();
    m.userData.noHouse = true;
    expect(house.adopt(new THREE.Mesh(new THREE.BufferGeometry(), m))).toBe(0);
  });

  it('makes new materials already in the look', () => {
    const house = createHouse();
    const m = house.material({ color: 0x55aa33 });
    expect(m.isMeshLambertMaterial).toBe(true);
    expect(m.color.getHex()).toBe(0x55aa33);
    expect(compiled(m).fragmentShader).toContain('uLookShadow');
  });

  it('takes its full light from the world’s sun and sky', () => {
    const house = createHouse();
    const sun = new THREE.DirectionalLight(0xffffff, Math.PI);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, Math.PI);
    house.light({ sun, hemi });
    // (three's Lambert divides by pi: a white sun and sky of pi each give 1 and 1)
    expect(house.uniforms.uLookRef.value.r).toBeCloseTo(2, 5);
    house.light({ sun: null, hemi: null });
    expect(house.uniforms.uLookRef.value.r).toBeGreaterThan(0);
  });

  it('takes a look, whole or in part', () => {
    const house = createHouse({ edge: [0.2, 0.7] });
    expect(house.uniforms.uLookEdge.value.toArray()).toEqual([0.2, 0.7]);
    expect(house.uniforms.uLookMix.value).toBe(LOOK.mix);
    house.set({ shadow: 0xff0000, mix: 0.5 });
    expect(house.uniforms.uLookShadow.value.getHex()).toBe(0xff0000);
    expect(house.uniforms.uLookMix.value).toBe(0.5);
    expect(house.uniforms.uLookEdge.value.toArray()).toEqual([0.2, 0.7]);
    // (a colour given as a THREE.Color is copied, not kept)
    const c = new THREE.Color(0x00ff00);
    house.set({ fogLow: c });
    expect(house.uniforms.uLookFogLow.value).not.toBe(c);
    expect(house.uniforms.uLookFogLow.value.getHex()).toBe(0x00ff00);
  });

  it('sets the sky its fog is coloured by', () => {
    const house = createHouse();
    house.sky({ low: new THREE.Color(0x112233), high: new THREE.Color(0x445566), sunDir: new THREE.Vector3(0, 2, 0), halo: new THREE.Color(0.5, 0.4, 0.3) });
    expect(house.uniforms.uLookFogLow.value.getHex()).toBe(0x112233);
    expect(house.uniforms.uLookFogHigh.value.getHex()).toBe(0x445566);
    expect(house.uniforms.uLookSunDir.value.toArray()).toEqual([0, 1, 0]);
    expect(house.uniforms.uLookHalo.value.r).toBeCloseTo(0.5, 5);
  });

  it('uses one tone mapper, exposed to put mid-grey where ACES had it', () => {
    const house = createHouse();
    expect(house.toneMapping).toBe(THREE.NeutralToneMapping);
    expect(house.exposure).toBe(LOOK.exposure);
    expect(createHouse({ exposure: 1.1 }).exposure).toBe(1.1);
  });
});
