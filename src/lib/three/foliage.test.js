import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { faceless, facelessShader, liftNormals, spherifyNormals, WIND, wind, windShader, wrapShader } from './foliage';

const normalAt = (g, i) => new THREE.Vector3().fromBufferAttribute(g.attributes.normal, i);
const posAt = (g, i) => new THREE.Vector3().fromBufferAttribute(g.attributes.position, i);

// a faceted ball: every vertex its face's normal, as a flat-shaded blob has
const faceted = (r = 1) => {
  const g = new THREE.IcosahedronGeometry(r, 1);
  g.computeVertexNormals();
  return g;
};

describe('foliage normals from the volume', () => {
  it('turns a faceted ball’s normals straight out from its centre', () => {
    const g = spherifyNormals(faceted(), { keep: 0 });
    for (let i = 0; i < g.attributes.position.count; i++) {
      const n = normalAt(g, i);
      const p = posAt(g, i).normalize();
      expect(n.distanceTo(p)).toBeLessThan(1e-6);
    }
  });

  it('leans a squashed one’s normals outward from its own middle, wherever it stands', () => {
    const g = faceted().scale(2, 0.5, 2).translate(3, 4, -1);
    spherifyNormals(g, { keep: 0 });
    const c = new THREE.Vector3(3, 4, -1);
    for (let i = 0; i < g.attributes.position.count; i++) {
      const out = posAt(g, i).sub(c);
      expect(normalAt(g, i).dot(out)).toBeGreaterThan(0);
      // (the ellipsoid's own direction: the point scaled back to a unit ball)
      const want = out.clone().multiply(new THREE.Vector3(0.5, 2, 0.5)).normalize();
      expect(normalAt(g, i).distanceTo(want)).toBeLessThan(1e-5);
    }
  });

  it('keeps some of each face’s own normal when asked', () => {
    const g = faceted();
    const before = normalAt(g, 0);
    spherifyNormals(g, { keep: 0.25 });
    const radial = posAt(g, 0).normalize();
    const want = radial.multiplyScalar(0.75).add(before.multiplyScalar(0.25)).normalize();
    expect(normalAt(g, 0).distanceTo(want)).toBeLessThan(1e-6);
  });

  it('takes the centre and size it is given over its own box', () => {
    const g = spherifyNormals(faceted(), { centre: new THREE.Vector3(0, -10, 0), radii: new THREE.Vector3(1, 1, 1), keep: 0 });
    // (seen from far below, every normal points up)
    for (let i = 0; i < g.attributes.position.count; i++) expect(normalAt(g, i).y).toBeGreaterThan(0.99);
  });

  it('gives back the geometry it changed, with normals of unit length', () => {
    const g = faceted();
    expect(spherifyNormals(g)).toBe(g);
    for (let i = 0; i < g.attributes.normal.count; i++) expect(normalAt(g, i).length()).toBeCloseTo(1, 6);
  });
});

describe('blades lit as the ground they stand on', () => {
  it('turns normals up, keeping as much of their own as asked', () => {
    const g = new THREE.ConeGeometry(0.07, 1.4, 3);
    g.computeVertexNormals();
    const own = normalAt(g, 1);
    liftNormals(g, { keep: 0.25 });
    const want = new THREE.Vector3(0, 0.75, 0).add(own.multiplyScalar(0.25)).normalize();
    expect(normalAt(g, 1).distanceTo(want)).toBeLessThan(1e-6);
    liftNormals(g, { keep: 0 });
    expect(normalAt(g, 1).distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-6);
  });
});

// three's chunks where the wrap looks for its line (the two this site lights foliage with)
const CHUNKS = {
  lights_lambert_pars_fragment:
    'void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {\n\tfloat dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tvec3 irradiance = dotNL * directLight.color;\n\treflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}',
  lights_physical_pars_fragment: 'void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal ) {\n\tfloat dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tvec3 irradiance = dotNL * directLight.color;\n}',
};
const LAMBERT = { vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}', fragmentShader: '#include <common>\n#include <lights_lambert_pars_fragment>\nvoid main() {}' };
const STANDARD = { vertexShader: LAMBERT.vertexShader, fragmentShader: '#include <common>\n#include <lights_physical_pars_fragment>\nvoid main() {}' };

describe('light that wraps round a leaf', () => {
  it('lets the sun reach past the edge of a lambert leaf, and through it from behind', () => {
    const out = wrapShader(LAMBERT, {}, CHUNKS);
    expect(out.swapped).toEqual({ wrap: true });
    expect(out.fragmentShader).toContain('float dotNLWrap = saturate( ( dot( geometryNormal, directLight.direction ) + uWrap ) / ( 1.0 + uWrap ) );');
    expect(out.fragmentShader).toContain('reflectedLight.directDiffuse += ( dotNLWrap - dotNL ) * directLight.color * BRDF_Lambert( material.diffuseColor );');
    // (the cosine three goes on with, for the specular, is the true one)
    expect(out.fragmentShader).toContain('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );');
    expect(out.fragmentShader).toContain('uBackScatter * saturate( dot( - geometryNormal, directLight.direction ) )');
    expect(out.fragmentShader).toContain('uniform float uWrap;');
    expect(out.fragmentShader).not.toContain('#include <lights_lambert_pars_fragment>');
  });

  it('does the same for a standard material', () => {
    const out = wrapShader(STANDARD, {}, CHUNKS);
    expect(out.swapped).toEqual({ wrap: true });
    expect(out.fragmentShader).toContain('+ uWrap ) / ( 1.0 + uWrap )');
  });

  it('leaves a shader alone where three has moved the line', () => {
    const out = wrapShader(LAMBERT, {}, { lights_lambert_pars_fragment: 'nothing like it' });
    expect(out.swapped).toEqual({ wrap: false });
    expect(out.fragmentShader).toContain('#include <lights_lambert_pars_fragment>');
  });

  it('finds its line in the chunks three ships', async () => {
    for (const lib of ['lambert', 'standard']) {
      const out = wrapShader({ vertexShader: THREE.ShaderLib[lib].vertexShader, fragmentShader: THREE.ShaderLib[lib].fragmentShader }, {}, THREE.ShaderChunk);
      expect(out.swapped.wrap).toBe(true);
    }
  });
});

describe('a card lit the same on both faces', () => {
  it('drops the turn of the normal on the back face, and nothing else', () => {
    const fs = 'void main() {\n#include <normal_fragment_begin>\n}';
    const out = facelessShader({ vertexShader: '', fragmentShader: fs });
    expect(out.swapped.faceless).toBe(true);
    expect(out.fragmentShader).not.toContain('normal *= faceDirection;');
    expect(out.fragmentShader).toContain('vec3 normal = normalize( vNormal );');
  });

  it('leaves a shader without the chunk alone', () => {
    const out = facelessShader({ vertexShader: '', fragmentShader: 'void main() {}' });
    expect(out.swapped.faceless).toBe(false);
    expect(out.fragmentShader).toBe('void main() {}');
  });

  it('chains after a hook already on the material, once, under its own cache key', () => {
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    const seen = [];
    m.onBeforeCompile = () => seen.push('before');
    faceless(m);
    faceless(m);
    const sh = { vertexShader: '', fragmentShader: '#include <normal_fragment_begin>', uniforms: {} };
    m.onBeforeCompile(sh);
    expect(seen).toEqual(['before']);
    expect(sh.fragmentShader).not.toContain('normal *= faceDirection;');
    expect(m.customProgramCacheKey().endsWith('|faceless')).toBe(true);
  });
});

describe('the wind', () => {
  it('bends a tree from its foot, each instance in its own phase, by one clock', () => {
    const out = windShader(LAMBERT, { kind: 'tree' });
    expect(out.swapped).toEqual({ wind: true });
    expect(out.vertexShader).toContain('uniform float uWindTime;');
    expect(out.vertexShader).toMatch(/#ifdef USE_INSTANCING\s+wBase = instanceMatrix\[3\]\.xyz;/);
    // (the bend grows with height, as the square of it)
    expect(out.vertexShader).toContain('float wBend = wH * wH;');
    // after three's own begin_vertex, so it moves what three would draw
    expect(out.vertexShader.indexOf('#include <begin_vertex>')).toBeLessThan(out.vertexShader.indexOf('wBend'));
  });

  it('says so when there is no begin_vertex to follow', () => {
    expect(windShader({ vertexShader: 'void main() {}', fragmentShader: '' }, { kind: 'shrub' }).swapped).toEqual({ wind: false });
  });
});

// a kit tree's own weight, per vertex: near 0 at the foot of its trunk, 1 in
// its crown (the GLB's _WIND, which three's loader lower-cases to _wind)
describe('the wind, weighted per vertex', () => {
  const hooked = (opts) => {
    const m = wind(new THREE.MeshLambertMaterial(), opts);
    const sh = { vertexShader: LAMBERT.vertexShader, fragmentShader: LAMBERT.fragmentShader, uniforms: {} };
    m.onBeforeCompile(sh);
    return { m, sh };
  };

  it('scales the bend and the flutter by the weight, declared once before main', () => {
    const out = windShader(LAMBERT, { weight: '_wind' });
    expect(out.swapped).toEqual({ wind: true });
    const vs = out.vertexShader;
    expect(vs).toContain('attribute float _wind;');
    expect(vs.split('attribute float _wind;')).toHaveLength(2);
    expect(vs.indexOf('#include <common>')).toBeLessThan(vs.indexOf('attribute float _wind;'));
    expect(vs.indexOf('attribute float _wind;')).toBeLessThan(vs.indexOf('void main()'));
    // (a trunk's foot neither sways nor flutters)
    expect(vs).toContain('float wBend = wH * wH * _wind;');
    expect(vs).toMatch(/float wFlutter = [^;]* \* uWindLeafAmp \* wH \* _wind;/);
  });

  it('reads the attribute by the name it is given', () => {
    const vs = windShader(LAMBERT, { weight: 'aSway' }).vertexShader;
    expect(vs).toContain('attribute float aSway;');
    expect(vs).toContain('float wBend = wH * wH * aSway;');
    expect(vs).toMatch(/\* uWindLeafAmp \* wH \* aSway;/);
    expect(vs).not.toContain('_wind');
  });

  it('does not declare the attribute again where the shader has it already', () => {
    const own = { ...LAMBERT, vertexShader: LAMBERT.vertexShader.replace('#include <common>', '#include <common>\nattribute float _wind;') };
    const vs = windShader(own, { weight: '_wind' }).vertexShader;
    expect(vs.split('attribute float _wind;')).toHaveLength(2);
    expect(vs).toContain('float wBend = wH * wH * _wind;');
  });

  it('without a weight, writes just the shader it always has', () => {
    const plain = windShader(LAMBERT);
    expect(plain.swapped).toEqual({ wind: true });
    expect(plain.vertexShader).not.toContain('attribute float');
    expect(plain.vertexShader).not.toContain('* _wind');
    for (const opts of [{}, { weight: null }, { weight: undefined }, { kind: 'tree' }]) expect(windShader(LAMBERT, opts)).toEqual(plain);
    // (the weight adds its attribute and its two factors, and nothing else)
    const weighted = windShader(LAMBERT, { weight: '_wind' }).vertexShader;
    expect(weighted.replace('\nattribute float _wind;', '').replaceAll(' * _wind', '')).toBe(plain.vertexShader);
  });

  it('finds its anchors in the chunks three ships', () => {
    for (const vertexShader of [THREE.ShaderChunk.meshlambert_vert, THREE.ShaderLib.standard.vertexShader]) {
      const out = windShader({ vertexShader, fragmentShader: '' }, { weight: '_wind' });
      expect(out.swapped).toEqual({ wind: true });
      const vs = out.vertexShader;
      expect(vs.split('attribute float _wind;')).toHaveLength(2);
      expect(vs.indexOf('attribute float _wind;')).toBeLessThan(vs.indexOf('void main()'));
      expect(vs.indexOf('#include <begin_vertex>')).toBeLessThan(vs.indexOf('float wBend = wH * wH * _wind;'));
      expect(vs).toMatch(/\* uWindLeafAmp \* wH \* _wind;/);
    }
  });

  it('passes the weight through the material hook, under its own cache key', () => {
    const { m, sh } = hooked({ kind: 'tree', weight: '_wind' });
    expect(sh.vertexShader).toBe(windShader(LAMBERT, { weight: '_wind' }).vertexShader);
    expect(m.customProgramCacheKey().endsWith('|wind|w:_wind')).toBe(true);
    // (the weight is a name, not one of WIND's numbers: those are the tree's)
    expect(m.userData.wind.uWindStrength.value).toBe(WIND.tree.strength);
    expect(Object.keys(sh.uniforms).sort()).toEqual(['uWindDir', 'uWindHeight', 'uWindLeaf', 'uWindLeafAmp', 'uWindStrength', 'uWindTime', 'uWindTrunk']);
  });

  it('without a weight, keeps the hook and the cache key it had', () => {
    const { m, sh } = hooked({ kind: 'shrub' });
    expect(sh.vertexShader).toBe(windShader(LAMBERT).vertexShader);
    expect(m.customProgramCacheKey().endsWith('|wind')).toBe(true);
    expect(m.customProgramCacheKey()).not.toContain('|w:');
  });

  it('refuses a weight that is not a GLSL name', () => {
    for (const bad of ['', '1wind', 'a-b', 'w x', '_wind; void main() {}', 7, {}]) {
      expect(() => wind(new THREE.MeshLambertMaterial(), { weight: bad })).toThrow(TypeError);
      expect(() => windShader(LAMBERT, { weight: bad })).toThrow(TypeError);
    }
  });
});
