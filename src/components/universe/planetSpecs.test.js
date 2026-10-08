// Every body on the universe map, built as it was before its shared shape
// became data (planetSpecs.js): each one built against a fake texture set
// (every map a 1×1 texture named for itself, so the record says which map
// sits where) on several tiers and sets, and written down three levels deep
// and more: each child's name, type, geometry (its parameters and a sum of
// its vertices), material (its scalars, which map is in which slot, its
// hooks' cache keys and the shader they make), and where it is, once as
// built and once running (its models mounted, picked, two moments on).
// planetSpecs.fixture.json was recorded from the builders before the
// refactor; the test compares the build now with it.
//
//   UPDATE=1 npx vitest run src/components/universe/planetSpecs.test.js   (re-records)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MAP_NAMES } from './planetMaps';
import { MOONS, UNIVERSES } from './universes';

const FIXTURE = resolve('src/components/universe/planetSpecs.fixture.json');
const FANDOMS = UNIVERSES.filter((u) => u.kind !== 'core').map((u) => u.id);
const OTHERS = [...UNIVERSES.filter((u) => u.kind === 'core'), ...MOONS].map((u) => u.id);

// (the builders paint on canvases: a canvas that takes every call and draws
// nothing, its own each time so it keeps its size)
const stubCanvas = () => {
  const gradient = { addColorStop() {} };
  const make = () => {
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    return canvas;
  };
  vi.stubGlobal('document', { createElement: make });
};

// (a station's torches flicker by Math.random: the same stream for every build)
const seeded = () => {
  let s = 0x2545f491;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return s / 4294967296;
  };
};

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const vec = (v) => v.toArray().map(r4);
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};
const sum = (arr, w = 1) => {
  if (!arr) return null;
  let a = 0;
  for (let i = 0; i < arr.length; i++) a += arr[i] * ((i % 7) + w);
  return r4(a);
};

const texName = (t) => {
  if (!t) return null;
  if (!t.isTexture) return typeof t;
  const kind = t.name || (t.isCanvasTexture ? `canvas ${t.image?.width}x${t.image?.height}` : t.isDataTexture ? `data ${t.image?.width}x${t.image?.height}` : t.constructor.name);
  const extra = [];
  if (t.repeat.x !== 1 || t.repeat.y !== 1) extra.push(`repeat ${t.repeat.x},${t.repeat.y}`);
  if (t.magFilter === THREE.NearestFilter) extra.push('nearest');
  return [kind, ...extra].join(' ');
};

const value = (v, depth = 0) => {
  if (v == null) return v ?? null;
  if (typeof v === 'number') return r4(v);
  if (typeof v === 'boolean' || typeof v === 'string') return v;
  if (v.isTexture) return texName(v);
  if (v.isColor) return v.getHexString();
  if (v.isVector2 || v.isVector3 || v.isVector4 || v.isQuaternion || v.isMatrix3 || v.isMatrix4) return vec(v);
  if (Array.isArray(v)) return depth > 2 ? 'array' : v.map((x) => value(x, depth + 1));
  if (ArrayBuffer.isView(v)) return sum(v);
  return typeof v;
};

const uniforms = (u) => (u ? Object.fromEntries(Object.keys(u).sort().map((k) => [k, value(u[k]?.value)])) : undefined);

const MAT_KEYS = ['color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'opacity', 'transparent', 'side', 'alphaTest', 'depthWrite', 'depthTest', 'blending', 'flatShading', 'toneMapped', 'visible', 'premultipliedAlpha', 'normalScale', 'sheen', 'sheenRoughness', 'sheenColor', 'vertexColors', 'wireframe', 'sizeAttenuation', 'size'];
const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap', 'bumpMap', 'lightMap', 'envMap', 'displacementMap'];

// what three would hand the material's hooks, and what they make of it
const compiled = (m) => {
  if (!Object.hasOwn(m, 'onBeforeCompile')) return undefined;
  const lib = m.isMeshPhysicalMaterial ? THREE.ShaderLib.physical : m.isMeshBasicMaterial ? THREE.ShaderLib.basic : THREE.ShaderLib.standard;
  const shader = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, defines: {} };
  m.onBeforeCompile(shader, {});
  return { vs: hash(shader.vertexShader), fs: hash(shader.fragmentShader), uniforms: uniforms(shader.uniforms) };
};

// (a material's scalars where they differ from a new one of its kind)
const fresh = new Map();
const defaults = (m) => {
  if (!fresh.has(m.type)) fresh.set(m.type, new m.constructor());
  return fresh.get(m.type);
};
const material = (m) => {
  const out = { type: m.type };
  if (m.name) out.name = m.name;
  const base = defaults(m);
  for (const k of MAT_KEYS) if (m[k] !== undefined && JSON.stringify(value(m[k])) !== JSON.stringify(value(base[k]))) out[k] = value(m[k]);
  const maps = {};
  for (const s of SLOTS) if (m[s]) maps[s] = texName(m[s]);
  out.maps = maps;
  if (Object.hasOwn(m, 'customProgramCacheKey')) out.key = m.customProgramCacheKey();
  out.userData = Object.fromEntries(Object.keys(m.userData).sort().map((k) => [k, typeof m.userData[k] === 'object' && m.userData[k] ? uniforms(m.userData[k]) : value(m.userData[k])]));
  if (m.isShaderMaterial) {
    out.uniforms = uniforms(m.uniforms);
    out.defines = m.defines;
    out.shader = hash(m.vertexShader + m.fragmentShader);
  }
  out.compiled = compiled(m);
  return out;
};

const geometry = (g) => {
  if (!g) return undefined;
  const params = g.parameters ? Object.fromEntries(Object.entries(g.parameters).filter(([, v]) => typeof v !== 'object' || Array.isArray(v)).map(([k, v]) => [k, value(v)])) : undefined;
  const a = g.attributes;
  return { type: g.type, params, count: a.position?.count, index: g.index?.count ?? null, position: sum(a.position?.array), normal: sum(a.normal?.array, 2), uv: sum(a.uv?.array, 3), color: sum(a.color?.array, 4), groups: g.groups.length };
};

const node = (o) => {
  const out = { name: o.name, type: o.type, position: vec(o.position) };
  const turn = [o.rotation.x, o.rotation.y, o.rotation.z].map(r4);
  if (turn.some(Boolean)) out.rotation = turn;
  if (o.scale.x !== 1 || o.scale.y !== 1 || o.scale.z !== 1) out.scale = vec(o.scale);
  if (!o.visible) out.visible = false;
  if (o.renderOrder) out.renderOrder = o.renderOrder;
  if (o.frustumCulled === false) out.frustumCulled = false;
  if (o.geometry) out.geometry = geometry(o.geometry);
  if (o.material) out.material = [].concat(o.material).map(material);
  if (o.isInstancedMesh) out.instances = { count: o.count, matrix: sum(o.instanceMatrix.array), colour: sum(o.instanceColor?.array) };
  if (Object.keys(o.userData).length) out.userData = Object.fromEntries(Object.entries(o.userData).map(([k, v]) => [k, value(v)]));
  if (o.children.length) out.children = o.children.map(node);
  return out;
};

const fakeMaps = () => Object.fromEntries(MAP_NAMES.map((n) => {
  const t = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  t.name = n;
  return [n, t];
}));

// (the colour maps themselves, the ones a world's other maps hang on)
const COLOUR = new Set(['music', 'middleearth', 'transformers', 'marvel', 'breakingbad', 'office', 'rickmorty', 'caribbean', 'invincible', 'earth']);
const SETS = {
  high: () => ({ T: fakeMaps(), tier: 'high', key: { value: new THREE.Vector3(0, 1, 0) } }),
  low: () => ({ T: fakeMaps(), tier: 'low' }),
  small: () => ({ T: { ...fakeMaps(), small: true }, tier: 'mid' }),
  bare: () => ({ T: {}, tier: 'high' }),
  // every map but the colour maps: what a world does with half a set
  partial: () => ({ T: Object.fromEntries(Object.entries(fakeMaps()).filter(([n]) => !COLOUR.has(n))), tier: 'ultra' }),
};
const SPOTS = [undefined, 'rival', 'mario', 'plant', 'cruiser', 'escort1', 'escort2'];

async function record(id) {
  const { buildPlanet } = await import('./planets');
  const { byId } = await import('./universes');
  const out = {};
  for (const [set, make] of Object.entries(SETS)) {
    const rand = seeded();
    const spy = vi.spyOn(Math, 'random').mockImplementation(rand);
    const { T, tier, key = null } = make();
    const p = buildPlanet(byId(id), T, { sun: [0.3, 0.5, 0.8], tier, key });
    const built = node(p.group);
    const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 1e6);
    camera.position.set(300, 120, 500);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const mounted = SPOTS.map((spot) => p.mount(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), new THREE.MeshBasicMaterial()), spot));
    p.update(1, camera, true);
    p.setState({ hover: false, selected: true });
    p.update(2.7, camera, true);
    p.light(new THREE.Color(0.5, 0.4, 0.25), 1.5);
    p.near(2);
    out[set] = { keys: Object.keys(p), nearGeometry: typeof p.nearGeometry, surface: p.surface === p.body, mounted, built, running: node(p.group) };
    spy.mockRestore();
  }
  return out;
}

describe('every body on the map, built as before (planetSpecs.fixture.json)', () => {
  const got = {};
  beforeAll(async () => {
    stubCanvas();
    for (const id of [...FANDOMS, ...OTHERS]) got[id] = await record(id);
    // (one line a body, so a change shows which)
    if (process.env.UPDATE) writeFileSync(FIXTURE, `{\n${Object.entries(got).map(([id, v]) => `${JSON.stringify(id)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`);
  });
  afterAll(() => vi.unstubAllGlobals());
  const want = () => {
    expect(existsSync(FIXTURE), 'the fixture: record it with UPDATE=1 from the builders as they were').toBe(true);
    return JSON.parse(readFileSync(FIXTURE, 'utf8'));
  };

  it('pins all twelve fandoms and every station and moon', () => {
    expect(FANDOMS).toHaveLength(12);
    expect(Object.keys(want()).sort()).toEqual([...FANDOMS, ...OTHERS].sort());
  });

  it('builds every fandom as before', () => {
    const fixture = want();
    for (const id of FANDOMS) for (const set of Object.keys(SETS)) expect(got[id][set], `${id} (${set})`).toEqual(fixture[id][set]);
  });

  it('builds every station and Rick and Morty moon as before', () => {
    const fixture = want();
    for (const id of OTHERS) for (const set of Object.keys(SETS)) expect(got[id][set], `${id} (${set})`).toEqual(fixture[id][set]);
  });
});

describe('the specs', () => {
  it('name only maps the loader loads, for the twelve fandoms', async () => {
    const { SPECS } = await import('./planetSpecs');
    expect(Object.keys(SPECS).sort()).toEqual([...FANDOMS].sort());
    for (const [id, spec] of Object.entries(SPECS)) for (const k of spec.maps) expect(MAP_NAMES, `${id} ${k}`).toContain(k === 'colour' ? (spec.base ?? id) : `${spec.base ?? id}-${k}`);
  });
});
