// A kit pack as three's GLTFLoader hands it over, for kit.js's tests in
// Node: family files shaped as Task 1.3's import writes them and as the
// loader parses them (checked against public/kit/naturemega/birch.glb):
//
// - each model a node at the scene's root carrying meshopt's dequantising
//   move and scale (its geometry is in -1…1, so a part drawn without its
//   node's transform is a seventh of the tree), named as the model, with
//   the file's own name in userData.name (the loader takes the dots out of
//   names: `Birch_1.lod1` is `Birch_1lod1`, `Birch_1.lod1` in userData);
// - a mesh of two primitives a Group (the node) holding a Mesh for each,
//   named `<node>_1`, `<node>_2`; a mesh of one the node itself, a Mesh;
// - each primitive's extras.part on its geometry's userData;
// - the _WIND weight as `_wind` (the loader lower-cases custom attributes),
//   one normalised byte a vertex; one of the birches' crowns without it,
//   as the pack's flowers, petals and a plant come;
// - one material object per name per file, a leaf one cut out at 0.3 and
//   two-sided, a bark one's normal map with its green flipped (the loader
//   does that when it derives tangents), everything two-sided as the packs
//   are; the rig's a colour and no map, as the farm animals' are.
//
//   MANIFEST: the pack's index.json for these files; BROWN the rig's colour
//   fakeLoad({ image }) → load(url) → Promise<{ scene, animations, gltf } | null>,
//     as loadGltf: null for a file it hasn't; `load.calls` the URLs asked
//     for, `load.scenes[url]` what each gave; `image` hung on every leaf map

import * as THREE from 'three';

// the rig's colour (a farm animal's coat: its look is its material's colour)
export const BROWN = 0x6b4423;

const tones = [
  [0.4167, 0.0554, 0],
  [0.5303, 0.0706, 0],
];

export const MANIFEST = {
  pack: 'naturemega',
  licence: 'CC0-1.0',
  source: 'Quaternius, Stylized Nature MegaKit (https://quaternius.com)',
  models: {
    Birch_1: { family: 'birch', file: 'birch.glb', parts: ['bark', 'leaves'], tris: 4, tris1: 2, radius: 4.587, height: 13.293, trunk: 0.208, kind: 'tree', tones },
    Birch_2: { family: 'birch', file: 'birch.glb', parts: ['bark', 'leaves'], tris: 4, tris1: 2, radius: 4.242, height: 13.102, trunk: 0.309, kind: 'tree', tones },
    Birch_3: { family: 'birch', file: 'birch-2.glb', parts: ['bark', 'leaves'], tris: 4, tris1: 2, radius: 5.213, height: 12.927, trunk: 0.216, kind: 'tree', tones },
    Fern_1: { family: 'fern', file: 'fern.glb', parts: ['leaves'], tris: 2, tris1: 1, radius: 0.9, height: 0.9, trunk: 0.2, kind: 'plant' },
    Rock_1: { family: 'rock', file: 'rock.glb', parts: ['main'], tris: 2, tris1: 1, radius: 1.2, height: 1.05, trunk: 1, kind: 'rock' },
    Critter: { family: 'critter', file: 'critter.glb', parts: ['main'], tris: 2, tris1: null, radius: 1, height: 1.5, trunk: 0.5, kind: 'character', rig: { bones: 1, clips: { Idle: 1 } } },
  },
  materials: {
    Bark_Birch: { alpha: 'opaque', leaf: false, wind: 'tree', maps: { colour: '1024x1024', normal: '1024x1024' } },
    Leaves_Birch: { alpha: 'mask', leaf: true, wind: 'tree', maps: { colour: '512x512' } },
    Leaves: { alpha: 'mask', leaf: true, wind: 'shrub', maps: { colour: '512x512' } },
    Rocks: { alpha: 'opaque', leaf: false, wind: null, maps: { colour: '1024x1024' } },
    Brown: { alpha: 'opaque', leaf: false, wind: null, maps: {} },
  },
};

// [where the node is, its scale] (birch.glb's own numbers: t.y + s is the
// manifest's height, the top of geometry that reaches y = 1)
const NODES = {
  Birch_1: [[0.211, 6.432, -0.439], 6.861],
  'Birch_1.lod1': [[0.244, 6.471, -0.469], 6.899],
  Birch_2: [[0.456, 6.337, -0.733], 6.765],
  'Birch_2.lod1': [[0.43, 6.411, -0.687], 6.84],
  Birch_3: [[0.833, 6.249, -0.713], 6.678],
  'Birch_3.lod1': [[0.74, 6.256, -0.701], 6.685],
  Fern_1: [[0, 0.4, 0], 0.5],
  'Fern_1.lod1': [[0, 0.41, 0], 0.49],
  Rock_1: [[0, 0.45, 0], 0.6],
  'Rock_1.lod1': [[0, 0.44, 0], 0.61],
};

// A primitive of `tris` triangles spanning -1…1 (the quantised range), its
// weight 0.14 at the foot to 1 at the top unless `wind` is false.
function geometry(part, tris, wind = true) {
  const pos = [];
  for (let i = 0; i < tris; i++) pos.push(-1, -1, i * 0.1, 1, -1, i * 0.1, 0, 1, i * 0.1);
  const g = new THREE.BufferGeometry();
  const n = pos.length / 3;
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(n).fill([0, 0, 1]).flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(n * 2).fill(0.5), 2));
  if (wind) {
    const w = new Uint8Array(n);
    for (let i = 0; i < n; i++) w[i] = pos[i * 3 + 1] > 0 ? 255 : 36;
    g.setAttribute('_wind', new THREE.BufferAttribute(w, 1, true));
  }
  g.userData.part = part;
  return g;
}

// The file's materials, one object a name, as the loader parses them.
function materials(image) {
  const map = (name, img = null) => {
    const t = new THREE.Texture(img ?? undefined);
    t.name = name;
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    return t;
  };
  const std = (name, opts) => Object.assign(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...opts }), { name });
  return {
    Bark_Birch: std('Bark_Birch', { map: map('Bark_Birch'), normalMap: map('Bark_Birch_Normal'), normalScale: new THREE.Vector2(1, -1) }),
    Leaves_Birch: std('Leaves_Birch', { map: map('Leaves_Birch', image), alphaTest: 0.3 }),
    Leaves: std('Leaves', { map: map('Leaves', image), alphaTest: 0.3 }),
    Rocks: std('Rocks', { map: map('Rocks') }),
    Brown: std('Brown', { color: BROWN }),
  };
}

// A model's node: a Group of one Mesh a primitive, or the Mesh itself for
// one primitive, at its dequantising transform.
function node(fileName, prims, mats) {
  const [t, s] = NODES[fileName];
  const name = fileName.replace(/\./g, '');
  const meshes = prims.map(([mat, part, tris, wind], i) => {
    const m = new THREE.Mesh(geometry(part, tris, wind), mats[mat]);
    m.name = prims.length > 1 ? `${name}_${i + 1}` : name;
    return m;
  });
  const n = meshes.length > 1 ? new THREE.Group() : meshes[0];
  if (n !== meshes[0]) n.add(...meshes);
  n.name = name;
  n.userData.name = fileName;
  n.position.set(...t);
  n.scale.setScalar(s);
  return n;
}

// [material, part, triangles, has a weight]
const TREE = (crownWind = true) => [
  ['Bark_Birch', 'bark', 2, true],
  ['Leaves_Birch', 'leaves', 2, crownWind],
];
const TREE1 = (crownWind = true) => [
  ['Bark_Birch', 'bark', 1, true],
  ['Leaves_Birch', 'leaves', 1, crownWind],
];

const FILES = {
  'birch.glb': (m) => [node('Birch_1', TREE(), m), node('Birch_2', TREE(false), m), node('Birch_1.lod1', TREE1(), m), node('Birch_2.lod1', TREE1(false), m)],
  'birch-2.glb': (m) => [node('Birch_3', TREE(), m), node('Birch_3.lod1', TREE1(), m)],
  'fern.glb': (m) => [node('Fern_1', [['Leaves', 'leaves', 2, true]], m), node('Fern_1.lod1', [['Leaves', 'leaves', 1, true]], m)],
  'rock.glb': (m) => [node('Rock_1', [['Rocks', 'main', 2, false]], m), node('Rock_1.lod1', [['Rocks', 'main', 1, false]], m)],
  // (a rig: its armature under the model's node, the skinned mesh in it)
  'critter.glb': (m) => {
    const root = new THREE.Object3D();
    root.name = 'Critter';
    root.userData.name = 'Critter';
    const armature = new THREE.Object3D();
    armature.name = 'CharacterArmature';
    const g = geometry('main', 2, false);
    const n = g.attributes.position.count;
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4));
    const skinned = new THREE.SkinnedMesh(g, m.Brown);
    skinned.name = 'Critter_1';
    const bone = new THREE.Bone();
    bone.name = 'Root';
    armature.add(skinned, bone);
    skinned.bind(new THREE.Skeleton([bone]));
    root.add(armature);
    return [root];
  },
};

export function fakeLoad({ image = null } = {}) {
  const load = (url) => {
    load.calls.push(url);
    const file = FILES[url.split('/').pop()];
    if (!file) return Promise.resolve(null);
    const scene = new THREE.Group();
    scene.add(...file(materials(image)));
    load.scenes[url] = scene;
    return Promise.resolve({ scene, animations: [], gltf: {} });
  };
  load.calls = [];
  load.scenes = {};
  return load;
}
