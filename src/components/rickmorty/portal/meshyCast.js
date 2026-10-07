// Portal panic's cast as modelled for the site with Meshy (scripts/meshy.mjs):
// textured models toon-shaded like everything else, the two-legged ones
// skinned, with idle, walking and running clips blended by how fast they
// move. Anything that doesn't load falls back to the shapes in ./cast.js.
// A cast here has the same face as one from cast.js ({ group, body, … }) plus
// update(t, move, hit), which ./cast.js's animate() hands it to.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toon } from './toon';
import { rimToon } from '../../../lib/three/ink';
import { gltfLoader } from '../../../lib/three/gltf';
import { sharpenMaterial } from '../../../lib/three/textures';
import { borrowClips, faceForward, heading, retarget } from './clips';

// Clips every rigged figure can play besides idle, walk and run: made once
// on one Meshy skeleton (scripts/meshy-rm-local.mjs's `clips`, as
// public/games/meshy/clips-<name>.glb) and retargeted to each figure's hips,
// as Rick's are borrowed (clips.js), then turned to face where the figure's
// walk does. play(c, name) plays one over the figure's idle/walk/run blend:
// once (a hit, a cheer, a shot) or looped (a dance, sitting with the arms
// crossed) till stop(c).
export const SHARED_CLIPS = ['drink', 'cheer', 'wave', 'happy', 'hit', 'fall', 'scared', 'shoot', 'dance', 'punch', 'taunt', 'shot', 'sitcross'];
// (fetched once per loader: the site's one, or a test's own)
const sharedBy = new WeakMap(); // loader → Map(clip name → Promise<clip | null>)
const sharedClip = (name, loader) => {
  if (!sharedBy.has(loader)) sharedBy.set(loader, new Map());
  const shared = sharedBy.get(loader);
  if (!shared.has(name)) {
    shared.set(
      name,
      loader.loadAsync(`${BASE}/clips-${name}.glb`).then(
        (g) => {
          const c = g.animations[0] ?? null;
          const hips = g.scene?.getObjectByName('Hips');
          if (c && hips) c.userData = { ...c.userData, hips: hips.position.y };
          return c;
        },
        () => null,
      ),
    );
  }
  return shared.get(name);
};

export { faceForward, heading } from './clips';

// how much faster a run goes than a walk: a figure with no run clip runs on
// its walk played this much quicker
const RUN_PACE = 1.6;

// Meshy's textures carry their own shading, so the light steps stay lighter
// than the shapes' (a third of the way down at most, not two thirds)
let ramp = null;
const lightRamp = () => {
  if (ramp) return ramp;
  ramp = new THREE.DataTexture(new Uint8Array([165, 165, 165, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
};
// and a soft rim of cool light round their edges, which lifts them off the
// street and the sky as the show's back light does; their textures kept
// sharp at a glancing angle
const RIM = { color: 0xdff6ff, power: 3, strength: 0.3 };
const lit = (m) => {
  sharpenMaterial(m);
  return rimToon(m, RIM);
};
const flat = (map, extra = {}) => toon(0xffffff, { map, gradientMap: lightRamp(), ...extra });
const paint = (map, extra = {}) => lit(flat(map, extra));

export const BASE = '/games/meshy';
// An asset: one of Portal panic’s cast by name (its file in BASE, or in the
// folder FOLDERS gives it, its clips beside it), or a figure of the site’s
// from elsewhere by its whole path (Albuquerque’s Walt and Jesse, for the
// wardrobe), which has no clips of its own and walks on Rick’s, borrowed
// (clips.js).
// (a figure that is someone else's model, rigged by Meshy, is credited in
// src/data/modelCredits.json by its file: FOUND)
export const assetUrl = (name) => (name.startsWith('/') ? name : (FOUND[name] ?? `${FOLDERS[name] ?? BASE}/${name}.glb`));
const ownClips = (name) => !name.startsWith('/');

// game kind → the model, how tall it stands in the arena (world units; a
// little over the shapes' sizes, as slim figures read smaller from above)
export const MESHY = {
  rick: { a: 'rick', h: 2.35, fidget: 'drink' },
  morty: { a: 'morty', h: 1.95 },
  pickle: { a: 'pickle', h: 1.35 },
  meeseeks: { a: 'meeseeks', h: 2.2 },
  ally: { a: 'meeseeks', h: 1.6 },
  gromflomite: { a: 'gromflomite', h: 2.3 },
  cronenberg: { a: 'cronenberg', h: 1.45 },
  blob: { a: 'cronenberg', h: 0.75 },
  gazorpian: { a: 'gazorpian', h: 2.8 },
  cop: { a: 'cop', h: 2.35 },
  mortyclone: { a: 'morty', h: 1.95, shirts: [0xf3d84b, 0x7fc77a, 0xe0795a, 0xa98ad8, 0x63b5d9, 0xf0a0c0] },
  snowball: { a: 'snowball', h: 3.7 },
  bigcronenberg: { a: 'cronenberg', h: 3.9 },
  cromulon: { a: 'cromulon', h: 9.5 },
  evilmorty: { a: 'evilmorty', h: 1.95 },
  summer: { a: 'summer', h: 1.6 },
  beth: { a: 'beth', h: 1.68 },
  jerry: { a: 'jerry', h: 1.78 },
  president: { a: 'president', h: 1.88 },
  fedagent: { a: 'fedagent', h: 1.9 },
  general: { a: 'general', h: 1.82 },
  secretservice: { a: 'secretservice', h: 1.84 },
  goldenfold: { a: 'goldenfold', h: 1.8 },
  principal: { a: 'principal', h: 1.7 },
  jessica: { a: 'jessica', h: 1.62 },
  brad: { a: 'brad', h: 1.85 },
  tammy: { a: 'tammy', h: 1.62 },
  ethan: { a: 'ethan', h: 1.72 },
  tinyrick: { a: 'tinyrick', h: 1.6 },
  // Total Rickall's (rickmorty/world/interiors/rickall.js): the parasites who
  // are rigged figures, Mr. Poopybutthole (his hat and all; he has a sat clip
  // too, for the Smiths' couch), and the parasites who are props, which stand
  // still and live with the C-137 world's models (FOLDERS). The ghost is
  // Ghost in a Jar without his jar, which the living room makes.
  pencilvester: { a: 'pencilvester', h: 1.6 },
  sleepygary: { a: 'sleepygary', h: 1.78 },
  hamurai: { a: 'hamurai', h: 1.8 },
  amishcyborg: { a: 'amishcyborg', h: 1.78 },
  mrbeauregard: { a: 'mrbeauregard', h: 1.85 },
  cousinnicky: { a: 'cousinnicky', h: 1.8 },
  frankenstein: { a: 'frankenstein', h: 2.1 },
  poopybutthole: { a: 'poopybutthole', h: 1.5 },
  reversegiraffe: { a: 'reversegiraffe', h: 2.3 },
  ghostinajar: { a: 'ghostinajar', h: 0.45 },
  photographyraptor: { a: 'photographyraptor', h: 1.3 },
  tinkles: { a: 'tinkles', h: 0.8 },
  babywizard: { a: 'babywizard', h: 0.7 },
  mrsrefrigerator: { a: 'mrsrefrigerator', h: 1.8 },
  // the rest of the family's, in their places (rickmorty/world/rules.js's
  // PEOPLE): each loads when its room is first walked into; Snuffles is a
  // prop, asleep on his dog bed
  spacebeth: { a: 'spacebeth', h: 1.68 },
  drwong: { a: 'drwong', h: 1.72 },
  nancy: { a: 'nancy', h: 1.6 },
  tricia: { a: 'tricia', h: 1.62 },
  diane: { a: 'diane', h: 1.68 },
  snuffles: { a: 'snuffles', h: 0.45 },
  // the multiverse's destinations (rickmorty/world/dimensions/): their
  // people, rigged; their props and creatures; the crowd's copies, as made
  squanchy: { a: 'squanchy', h: 1.15 },
  birdperson: { a: 'birdperson', h: 2.0 },
  phoenixperson: { a: 'phoenixperson', h: 2.05 },
  unity: { a: 'unity', h: 1.75 },
  marsha: { a: 'marsha', h: 2.3 },
  mortyjr: { a: 'mortyjr', h: 2.0 },
  krombopulos: { a: 'krombopulos', h: 1.9 },
  vance: { a: 'vance', h: 1.85 },
  supernova: { a: 'supernova', h: 1.85 },
  alanrails: { a: 'alanrails', h: 2.0 },
  millionants: { a: 'millionants', h: 1.9 },
  crocubot: { a: 'crocubot', h: 1.9 },
  noobnoob: { a: 'noobnoob', h: 1.1 },
  'vindicators-ship': { a: 'vindicators-ship', h: 0.9 },
  'squanchy-house': { a: 'squanchy-house', h: 9 },
  'birdperson-house': { a: 'birdperson-house', h: 14 },
  kingjellybean: { a: 'kingjellybean', h: 2.2 },
  zeep: { a: 'zeep', h: 1.8 },
  kyle: { a: 'kyle', h: 1.7 },
  xenonbloom: { a: 'xenonbloom', h: 1.9 },
  poncho: { a: 'poncho', h: 1.75 },
  annie: { a: 'annie', h: 1.62 },
  needful: { a: 'needful', h: 1.85 },
  arthricia: { a: 'arthricia', h: 1.6 },
  flippynips: { a: 'flippynips', h: 1.5 },
  scroopy: { a: 'scroopy', h: 1.4 },
  gearhead: { a: 'gearhead', h: 1.8 },
  thirstystep: { a: 'thirstystep', h: 8 },
  giant: { a: 'giant', h: 9 },
  stairgoblin: { a: 'stairgoblin', h: 0.9 },
  hepatitis: { a: 'hepatitis', h: 2.6 },
  gonorrhoea: { a: 'gonorrhoea', h: 3 },
  tuberculosis: { a: 'tuberculosis', h: 2.8 },
  plague: { a: 'plague', h: 2.2 },
  ecoli: { a: 'ecoli', h: 1.4 },
  'needful-shop': { a: 'needful-shop', h: 5 },
  nebulon: { a: 'nebulon', h: 2.05 },
  storylord: { a: 'storylord', h: 1.95 },
  ticketsguy: { a: 'ticketsguy', h: 1.75 },
  rickprime: { a: 'rickprime', h: 2.35 },
  evilrick: { a: 'evilrick', h: 2.35 },
  hemorrhage: { a: 'hemorrhage', h: 2.2 },
  scaryterry: { a: 'scaryterry', h: 2.1 },
  jaguar: { a: 'jaguar', h: 2.0 },
  mrspancakes: { a: 'mrspancakes', h: 1.85 },
  agencyguard: { a: 'agencyguard', h: 1.9 },
  sewerrat: { a: 'sewerrat', h: 0.55 },
  frundles: { a: 'frundles', h: 0.5 },
  frundlesman: { a: 'frundlesman', h: 1.85 },
  frundlesdog: { a: 'frundlesdog', h: 0.9 },
  frundleshouse: { a: 'frundleshouse', h: 7 },
  cornvelious: { a: 'cornvelious', h: 2.3 },
  'deathstalker-a': { a: 'deathstalker-a', h: 1.85 },
  'deathstalker-b': { a: 'deathstalker-b', h: 1.75 },
  armothy: { a: 'armothy', h: 2.6 },
  brainalyzer: { a: 'brainalyzer', h: 2.2 },
  antsjohnson: { a: 'antsjohnson', h: 1.85 },
  babylegs: { a: 'babylegs', h: 1.3 },
  regularlegs: { a: 'regularlegs', h: 1.85 },
  mrsneezy: { a: 'mrsneezy', h: 1.8 },
  gazorpazorpfield: { a: 'gazorpazorpfield', h: 1.5 },
  shmlo: { a: 'shmlo', h: 1.9 },
  trunkperson: { a: 'trunkperson', h: 1.85 },
  lilbits: { a: 'lilbits', h: 1.1 },
  tophatjones: { a: 'tophatjones', h: 1.6 },
  realfakedoors: { a: 'realfakedoors', h: 2.1 },
  simman: { a: 'simman', h: 1.8 },
  poptart: { a: 'poptart', h: 1.6 },
  toasterhouse: { a: 'toasterhouse', h: 3.8 },
  omegadevice: { a: 'omegadevice', h: 3.4 },
  primedrone: { a: 'primedrone', h: 0.9 },
  tommy: { a: 'tommy', h: 1.8 },
  nimbus: { a: 'nimbus', h: 1.95 },
  atlantean: { a: 'atlantean', h: 1.85 },
  miles: { a: 'miles', h: 1.85 },
  'froopy-a': { a: 'froopy-a', h: 1.1 },
  'froopy-b': { a: 'froopy-b', h: 1.9 },
  heistotron: { a: 'heistotron', h: 4.2 },
  'heister-a': { a: 'heister-a', h: 1.8 },
  'heister-b': { a: 'heister-b', h: 1.78 },
  fart: { a: 'fart', h: 1.8 },
  'snake-a': { a: 'snake-a', h: 0.9 },
  'snake-b': { a: 'snake-b', h: 0.9 },
  snakeastronaut: { a: 'snakeastronaut', h: 1.2 },
  snakerocket: { a: 'snakerocket', h: 6 },
  glexo: { a: 'glexo', h: 1.85 },
  glipglop: { a: 'glipglop', h: 1.8 },
  risotto: { a: 'risotto', h: 1.9 },
  watert: { a: 'watert', h: 1.9 },
  nuptiamachine: { a: 'nuptiamachine', h: 2.2 },
  mytholog: { a: 'mytholog', h: 2.4 },
  shrimply: { a: 'shrimply', h: 1.4 },
  gloopnurse: { a: 'gloopnurse', h: 1.4 },
  'resortguest-a': { a: 'resortguest-a', h: 1.7 },
  'resortguest-b': { a: 'resortguest-b', h: 1.95 },
  dirlycar: { a: 'dirlycar', h: 1.4 },
  icet: { a: 'icet', h: 2.4 },
  ...Object.fromEntries(
    [
      ['jerry-robe', 1.75],
      ['jerry-golf', 1.75],
      ['jerry-tux', 1.75],
      ['jerry-track', 1.75],
      ['jerry-gown', 1.75],
      ['jerry-cardigan', 1.8],
      ['magdalian-a', 1.55],
      ['magdalian-b', 1.55],
      ['magdalian-c', 1.6],
      ['plutonian-a', 1.35],
      ['plutonian-b', 1.35],
      ['gearperson-a', 1.8],
      ['gearperson-b', 1.8],
      ['zigerion', 1.95],
      ['zigerion-b', 1.95],
      ['zigerion-c', 1.95],
    ].map(([a, h]) => [a, { a, h }]),
  ),
};
const RICKALL_FIGURES = ['pencilvester', 'sleepygary', 'hamurai', 'amishcyborg', 'mrbeauregard', 'cousinnicky', 'frankenstein', 'poopybutthole'];
const RICKALL_PROPS = ['reversegiraffe', 'ghostinajar', 'photographyraptor', 'tinkles', 'babywizard', 'mrsrefrigerator'];
const FAMILY_FIGURES = ['spacebeth', 'drwong', 'nancy', 'tricia', 'diane'];
const FAMILY_PROPS = ['snuffles'];
const DEST_FIGURES = ['vance', 'supernova', 'alanrails', 'millionants', 'crocubot', 'noobnoob', 'squanchy', 'birdperson', 'phoenixperson', 'unity', 'marsha', 'mortyjr', 'krombopulos', 'kingjellybean', 'zeep', 'kyle', 'xenonbloom', 'poncho', 'annie', 'needful', 'arthricia', 'flippynips', 'scroopy', 'gearhead', 'nebulon', 'storylord', 'ticketsguy', 'rickprime', 'tommy', 'nimbus', 'atlantean', 'miles', 'glexo', 'glipglop', 'risotto', 'watert', 'evilrick', 'hemorrhage', 'cornvelious', 'scaryterry', 'jaguar', 'frundlesman'];
const DEST_PROPS = ['vindicators-ship', 'squanchy-house', 'birdperson-house', 'zigerion', 'thirstystep', 'giant', 'stairgoblin', 'hepatitis', 'gonorrhoea', 'tuberculosis', 'plague', 'ecoli', 'needful-shop', 'jerry-robe', 'jerry-golf', 'jerry-tux', 'jerry-track', 'jerry-gown', 'jerry-cardigan', 'magdalian-a', 'magdalian-b', 'magdalian-c', 'plutonian-a', 'plutonian-b', 'gearperson-a', 'gearperson-b', 'zigerion-b', 'zigerion-c', 'simman', 'poptart', 'toasterhouse', 'omegadevice', 'primedrone', 'froopy-a', 'froopy-b', 'heistotron', 'heister-a', 'heister-b', 'fart', 'snake-a', 'snake-b', 'snakeastronaut', 'snakerocket', 'nuptiamachine', 'mytholog', 'shrimply', 'gloopnurse', 'resortguest-a', 'resortguest-b', 'dirlycar', 'icet', 'deathstalker-a', 'deathstalker-b', 'armothy', 'brainalyzer', 'antsjohnson', 'babylegs', 'regularlegs', 'mrsneezy', 'gazorpazorpfield', 'shmlo', 'trunkperson', 'lilbits', 'tophatjones', 'realfakedoors', 'mrspancakes', 'agencyguard', 'sewerrat', 'frundles', 'frundlesdog', 'frundleshouse'];
export const RIGGED = new Set(['rick', 'morty', 'meeseeks', 'gromflomite', 'gazorpian', 'cop', 'evilmorty', 'summer', 'beth', 'jerry', 'president', 'fedagent', 'general', 'secretservice', 'goldenfold', 'principal', 'jessica', 'brad', 'tammy', 'ethan', 'tinyrick', ...RICKALL_FIGURES, ...FAMILY_FIGURES, ...DEST_FIGURES]);
// the models not in the cast's own folder, by name: where they are
// (and Mortytown's two shopfronts, rickmorty/citadel/district.js)
const MORTYTOWN_PROPS = ['mortymart', 'creepymorty'];
// the cast's figures found on Sketchfab rather than made, by their files
export const FOUND = { krombopulos: '/games/meshy/krombopulos.glb' };
export const FOLDERS = Object.fromEntries([...RICKALL_PROPS, ...FAMILY_PROPS, ...MORTYTOWN_PROPS, ...DEST_PROPS].map((a) => [a, '/models/c137/rm']));
const SCHOOL = ['goldenfold', 'principal', 'jessica', 'brad', 'tammy', 'ethan', 'tinyrick'];
const C137_PEOPLE = new Set(['summer', 'beth', 'jerry', 'president', 'fedagent', 'general', 'secretservice', ...SCHOOL, ...RICKALL_FIGURES, ...RICKALL_PROPS, ...FAMILY_FIGURES, ...FAMILY_PROPS, ...DEST_FIGURES, ...DEST_PROPS]);
// and the set pieces round the arenas (the C-137 world's people load with their own world)
export const MESHY_ASSETS = [...new Set(Object.values(MESHY).map((m) => m.a).filter((a) => !C137_PEOPLE.has(a))), 'cruiser', 'garage'];

// a Morty clone's shirt: the yellow of Morty's texture swapped for another colour
function shirted(map, shirt) {
  const m = flat(map);
  m.userData.shirt = { value: new THREE.Color(shirt) };
  m.onBeforeCompile = (s) => {
    s.uniforms.shirt = m.userData.shirt;
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float yellow = smoothstep(0.12, 0.3, min(c.r, c.g) - c.b) * step(0.25, c.g);
        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(c, shirt * (lum / 0.62), yellow);
      }`).replace('void main() {', 'uniform vec3 shirt;\nvoid main() {');
  };
  m.customProgramCacheKey = () => 'shirted';
  return lit(m);
}

// A skinned mesh's bounds don't follow its pose, so it's drawn whether
// it's in view or not. This culls it within a sphere round the whole
// figure, standing `height` tall in `frame` (its feet at frame's origin):
// centred half way up, four fifths of its height across, room for any pose
// its clips put it in. The sphere is set in the mesh's own space, whatever
// the rig's units (its node is often scaled to centimetres, and its
// positions quantized, so the geometry's own bounds are no guide).
export function cullWithin(mesh, frame, height) {
  frame.updateMatrixWorld(true);
  const toMesh = mesh.matrixWorld.clone().invert().multiply(frame.matrixWorld);
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height / 2, 0), height * 0.8).applyMatrix4(toMesh);
  mesh.frustumCulled = true;
}

// `kinds` and `rigged`: another game's table and its skinned models (the
// Citadel's, rickmorty/citadel/people.js); Portal panic's by default.
// `cull`: figures out of view aren’t drawn (a world with a lot of them);
// `loader`: another GLTFLoader (a test’s)
export function createMeshyCast({ kinds = MESHY, rigged = RIGGED, cull = false, loader: given = null } = {}) {
  const loader = given ?? gltfLoader();
  const assets = new Map(); // name → { scene, height, offset, clips, rigged, hipsY, up, asking, faced }
  const models = new Map(); // name → Promise<asset | null>: each model fetched once, however many ask
  const owned = [];

  const clipOf = async (url) => {
    try {
      const g = await loader.loadAsync(url);
      return g.animations[0] ?? null;
    } catch {
      return null;
    }
  };

  // the model itself, painted and measured, with no clips yet (null if it
  // won't load)
  const loadModel = async (name) => {
    try {
      const gltf = await loader.loadAsync(assetUrl(name));
      const scene = gltf.scene;
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const src = o.material;
        o.material = paint(src.map ?? null);
        if (!src.map) o.material.color.copy(src.color ?? new THREE.Color(1, 1, 1));
        owned.push(o.geometry, o.material);
        if (src.map) owned.push(src.map);
        src.dispose();
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
      });
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const offset = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      const hips = scene.getObjectByName('Hips');
      // (up, in the space the hips turn in: Meshy's armatures come turned over)
      const up = hips?.parent ? new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert()) : null;
      return { scene, height: size.y, offset, clips: {}, rigged: rigged.has(name), hipsY: hips?.position.y ?? null, up, asking: new Map(), faced: new Set() };
    } catch {
      return null; /* this one stays as shapes */
    }
  };

  // one of a figure's clips: its own, beside it, or Rick's, borrowed
  const fetchClip = async (name, src, c) => {
    if (ownClips(name)) return clipOf(`${BASE}/${name}-${c}.glb`);
    if (src.hipsY == null) return null;
    // (Rick’s, made for his hips, scaled to this figure’s: copies, so his own stay as they are)
    const rick = (await borrowClips([c], { loader }))[c];
    return retarget(rick, src.hipsY, rick?.userData.hips);
  };

  // the clips in `want` a figure hasn't been asked for yet, fetched and
  // added (each once, however many ask at a time; one that isn't there is
  // kept as null, so it isn't asked for again), and every clip but the walk
  // turned to face where the walk does, once there's a walk to face by
  const addClips = async (name, src, want) => {
    if (!src.rigged) return;
    for (const c of want) {
      if (c in src.clips || src.asking.has(c)) continue;
      src.asking.set(
        c,
        fetchClip(name, src, c).then((clip) => {
          src.clips[c] = clip;
          src.asking.delete(c);
        }),
      );
    }
    await Promise.all(want.map((c) => src.asking.get(c)));
    const ahead = src.up ? heading(src.clips.walk, src.up) : null;
    if (ahead == null) return;
    for (const [c, clip] of Object.entries(src.clips)) {
      if (!clip || c === 'walk' || src.faced.has(c)) continue;
      faceForward(clip, src.up, ahead);
      src.faced.add(c);
    }
  };

  // a figure, with at least the clips in `want`: its model fetched the first
  // time it's asked for, and a later ask for clips the first didn't name
  // adding them to it (a figure that didn't load is tried again next time)
  const loadOne = async (name, want = ['idle', 'walk', 'run']) => {
    if (!models.has(name)) {
      const p = loadModel(name);
      models.set(name, p);
      p.then((src) => {
        if (!src && models.get(name) === p) models.delete(name);
      });
    }
    const p = models.get(name);
    const src = await p;
    if (!src) return;
    await addClips(name, src, want);
    if (models.get(name) === p) assets.set(name, src); // (unless the cast's been disposed meanwhile)
  };

  // load every model (or just `names`, with just the `clips` named: idle,
  // walk, run, or sit for the cruiser's seats; asked again with more, the
  // figure gets those too); onEach(k) as each one lands
  const load = async (onEach, names = MESHY_ASSETS, { clips } = {}) => {
    let done = 0;
    await Promise.all(
      names.map((n) =>
        loadOne(n, clips).then(() => {
          done += 1;
          onEach?.(done / names.length);
        }),
      ),
    );
  };

  // a figure for a game kind, or null to use the shapes
  const make = (kind, variant = 0) => {
    const spec = kinds[kind];
    const src = spec && assets.get(spec.a);
    if (!src) return null;
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const model = src.rigged ? cloneSkinned(src.scene) : src.scene.clone();
    const k = spec.h / src.height;
    model.scale.setScalar(k);
    model.position.copy(src.offset).multiplyScalar(k);
    body.add(model);
    if (cull)
      model.traverse((o) => {
        if (o.isSkinnedMesh) cullWithin(o, group, spec.h);
        else if (o.isMesh) o.frustumCulled = true;
      });
    if (spec.shirts) {
      const shirt = spec.shirts[variant % spec.shirts.length];
      model.traverse((o) => {
        if (o.isMesh && o.material.map) {
          o.material = shirted(o.material.map, shirt);
          owned.push(o.material);
        }
      });
    }
    const c = { kind, group, body, bodyY: 0, height: spec.h, meshy: true, last: null, legs: null, arms: null, gun: null };
    if (src.rigged) {
      const mixer = new THREE.AnimationMixer(model);
      const act = {};
      for (const [name, clip] of Object.entries(src.clips)) {
        if (!clip) continue;
        const a = mixer.clipAction(clip);
        a.play();
        a.setEffectiveWeight(name === 'idle' ? 1 : 0);
        a.time = Math.random() * clip.duration; // not all in step
        act[name] = a;
      }
      c.mixer = mixer;
      c.act = act;
      c.hipsY = src.hipsY;
      c.up = src.up;
      c.hand = model.getObjectByName('RightHand') ?? model.getObjectByName('mixamorig:RightHand') ?? null;
      // (a figure that fidgets: Rick's flask, every so often while he stands)
      if (spec.fidget) c.fidget = { clip: spec.fidget, next: 6 + Math.random() * 14 };
    }
    c.update = (t, move, hit, opts) => update(c, t, move, hit, opts);
    c.play = (clip, opts) => play(c, clip, opts);
    c.stop = (fade) => stop(c, fade);
    return c;
  };

  // one of the shared clips on a figure, once (`hold` seconds at its last
  // frame, then back to the blend) or looped till stop(c); resolves when
  // it's playing, false if the figure can't (not rigged, or no such clip).
  // Asked for again while it plays (a punch chain), it starts over where it
  // stands, at the weight it has; another clip fades it out, and one still
  // fading from before is let go at once, so nothing's left at part weight.
  const play = async (c, name, { loop = false, hold = 0, fade = 0.2, speed = 1 } = {}) => {
    if (!c.mixer) return false;
    if (!c.act[name]) {
      const raw = await sharedClip(name, loader);
      if (!raw || !c.mixer) return false;
      if (!c.act[name]) {
        // (the figure's own copy: retargeted to its hips, and turned to face
        // where its walk does, as its own clips are)
        const clip = c.hipsY != null && raw.userData.hips ? retarget(raw, c.hipsY, raw.userData.hips) : raw.clone();
        const ahead = c.up ? heading(c.act.walk?.getClip(), c.up) : null;
        if (ahead != null) faceForward(clip, c.up, ahead);
        const a = c.mixer.clipAction(clip);
        a.setEffectiveWeight(0);
        c.act[name] = a;
      }
    }
    const a = c.act[name];
    const set = (w) => {
      a.timeScale = speed;
      a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      a.setEffectiveWeight(w);
    };
    const o = c.oneShot;
    if (o?.name === name) {
      a.reset();
      set(o.w);
      Object.assign(o, { loop, hold, fade, ended: null });
      return true;
    }
    // (the clip fading out asked for again comes back from where it's got to)
    let w = 0;
    const f = c.fadingOut;
    if (f) {
      c.fadingOut = null;
      if (f.name === name) w = f.w;
      else {
        f.a.setEffectiveWeight(0);
        f.a.stop();
      }
    }
    stop(c, fade);
    a.reset();
    set(w);
    a.play();
    c.oneShot = { a, name, loop, hold, fade, ended: null, w };
    return true;
  };
  const stop = (c, fade = 0.2) => {
    if (!c.oneShot) return;
    c.oneShot.fading = fade;
    c.fadingOut = c.oneShot;
    c.oneShot = null;
  };

  // a set piece standing `h` tall on y = 0, centred; its geometry and
  // materials stay the loader's (marked shared, so a dimension's clean-up
  // leaves them be)
  const prop = (name, h) => {
    const src = assets.get(name);
    if (!src) return null;
    const g = new THREE.Group();
    const model = src.scene.clone();
    const k = h / src.height;
    model.scale.setScalar(k);
    model.position.copy(src.offset).multiplyScalar(k);
    model.traverse((o) => {
      if (o.isMesh) o.userData.shared = true;
    });
    g.add(model);
    return g;
  };

  const dispose = () => {
    for (const o of owned) o.dispose?.();
    owned.length = 0;
    assets.clear();
    models.clear();
  };

  return { load, make, prop, dispose, play, stop };
}

const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// Idle, walking and running by speed (move 0…1); the rest by hand: Pickle
// Rick hops, Cronenbergs wobble, the Cromulon bobs; a hit squashes. The
// frame's step is `dt` when the caller gives it (a figure updated only now
// and then, or on a clock of its own), else the time since the last update;
// a tenth of a second at most either way, so a tab come back to doesn't leap.
function update(c, t, move, hit, { dt: given = null } = {}) {
  const dt = Math.min(0.1, Math.max(0, given ?? (c.last == null ? 0 : t - c.last)));
  c.last = t;
  if (c.mixer) {
    // a clip played over the blend: up over `fade`, held, and down again
    const o = c.oneShot;
    if (o) {
      o.w = Math.min(1, o.w + dt / Math.max(0.01, o.fade));
      o.a.setEffectiveWeight(o.w);
      if (!o.loop) {
        if (o.ended == null && !o.a.isRunning()) o.ended = t;
        if (o.ended != null && t - o.ended >= o.hold) c.stop(o.fade);
      }
    }
    const f = c.fadingOut;
    if (f) {
      f.w = Math.max(0, f.w - dt / Math.max(0.01, f.fading));
      f.a.setEffectiveWeight(f.w);
      if (f.w <= 0) {
        f.a.stop();
        c.fadingOut = null;
      }
    }
    const over = Math.max(c.oneShot?.w ?? 0, c.fadingOut?.w ?? 0);
    if (c.fidget && !c.oneShot && !c.fadingOut && move < 0.05) {
      if (t > c.fidget.next) {
        c.fidget.next = t + 14 + Math.random() * 20;
        c.play(c.fidget.clip).catch(() => {});
      }
    } else if (c.fidget && move >= 0.05) c.fidget.next = Math.max(c.fidget.next, t + 4);
    let run = smooth(0.55, 0.9, move) * (1 - over);
    let idle = (1 - smooth(0.05, 0.35, move)) * (1 - over);
    let walk = Math.max(0, (1 - over) - run - idle);
    // a clip the figure hasn't got hands its weight down, the run's to the
    // walk and the walk's to the idle, so the three always come to the whole
    // and nothing blends toward the bind pose; a run on the walk is a walk
    // played faster, by how much of it is the run's
    let hurry = 0;
    if (!c.act.run) {
      walk += run;
      hurry = walk > 0 ? run / walk : 0;
      run = 0;
    }
    if (!c.act.walk) {
      idle += walk;
      walk = 0;
    }
    c.act.idle?.setEffectiveWeight(idle);
    c.act.walk?.setEffectiveWeight(walk);
    c.act.run?.setEffectiveWeight(run);
    const pace = 0.75 + move * 0.45;
    if (c.act.walk) c.act.walk.timeScale = pace * (1 + (RUN_PACE - 1) * hurry);
    if (c.act.run) c.act.run.timeScale = pace;
    c.mixer.update(dt);
    c.body.position.y = 0;
  } else if (c.kind === 'pickle') {
    c.body.position.y = Math.abs(Math.sin(t * 9)) * 0.3 * move;
    c.body.rotation.z = Math.sin(t * 9) * 0.22 * move;
  } else if (c.kind === 'cromulon') {
    c.body.position.y = Math.sin(t * 0.9) * 0.25;
    c.body.rotation.z = Math.sin(t * 0.6) * 0.04;
  } else {
    // things that lurch: a wobble while they go, a slow breath while they don't
    const w = Math.sin(t * 7) * move;
    c.body.position.y = Math.abs(w) * 0.08 + Math.sin(t * 2.1) * 0.02;
    c.body.rotation.z = w * 0.08;
  }
  const breathe = c.mixer ? 0 : Math.sin(t * 2.1) * 0.015;
  c.body.scale.set(1 + hit * 0.2 + breathe, 1 - hit * 0.22 - breathe, 1 + hit * 0.2 + breathe);
}
