// Portal panic's cast as modelled for the site with Meshy (scripts/meshy.mjs):
// textured models toon-shaded like everything else, the two-legged ones
// skinned, with idle, walking and running clips blended by how fast they
// move. Anything that doesn't load falls back to the shapes in ./cast.js.
// A cast here has the same face as one from cast.js ({ group, body, … }) plus
// update(t, move, hit), which ./cast.js's animate() hands it to.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toon } from './toon';

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
const paint = (map, extra = {}) => toon(0xffffff, { map, gradientMap: lightRamp(), ...extra });

export const BASE = '/games/meshy';

// game kind → the model, how tall it stands in the arena (world units; a
// little over the shapes' sizes, as slim figures read smaller from above)
export const MESHY = {
  rick: { a: 'rick', h: 2.35 },
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
};
const RIGGED = new Set(['rick', 'morty', 'meeseeks', 'gromflomite', 'gazorpian', 'cop', 'evilmorty', 'summer', 'beth', 'jerry']);
const C137_PEOPLE = new Set(['summer', 'beth', 'jerry']);
// and the set pieces round the arenas (the C-137 Smiths load with their own world)
export const MESHY_ASSETS = [...new Set(Object.values(MESHY).map((m) => m.a).filter((a) => !C137_PEOPLE.has(a))), 'cruiser', 'garage'];

// a Morty clone's shirt: the yellow of Morty's texture swapped for another colour
function shirted(map, shirt) {
  const m = paint(map);
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
  return m;
}

// `kinds` and `rigged`: another game's table and its skinned models (the
// Citadel's, rickmorty/citadel/people.js); Portal panic's by default
export function createMeshyCast({ kinds = MESHY, rigged = RIGGED } = {}) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const assets = new Map(); // name → { scene, height, offset, clips }
  const owned = [];

  const clipOf = async (url) => {
    try {
      const g = await loader.loadAsync(url);
      return g.animations[0] ?? null;
    } catch {
      return null;
    }
  };

  const loadOne = async (name, want = ['idle', 'walk', 'run']) => {
    try {
      const gltf = await loader.loadAsync(`${BASE}/${name}.glb`);
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
      const clips = {};
      if (rigged.has(name)) {
        const got = await Promise.all(want.map((c) => clipOf(`${BASE}/${name}-${c}.glb`)));
        want.forEach((c, i) => {
          clips[c] = got[i];
        });
        const hips = scene.getObjectByName('Hips');
        if (hips?.parent && clips.walk) {
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
          const ahead = heading(clips.walk, up);
          if (ahead != null) for (const [n, c] of Object.entries(clips)) if (c && n !== 'walk') faceForward(c, up, ahead);
        }
      }
      assets.set(name, { scene, height: size.y, offset, clips, rigged: rigged.has(name) });
    } catch {
      /* this one stays as shapes */
    }
  };

  // load every model (or just `names`, with just the `clips` named: idle,
  // walk, run, or sit for the cruiser's seats);
  // onEach(k) as each one lands
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
      c.hand = model.getObjectByName('RightHand') ?? model.getObjectByName('mixamorig:RightHand') ?? null;
    }
    c.update = (t, move, hit) => update(c, t, move, hit);
    return c;
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
  };

  return { load, make, prop, dispose };
}

// Meshy's idle stands turned off to one side, like a fighter's stance: turn
// a clip's hips about the up axis (`up`, in the hips' parent's space) so its
// mean heading matches `target` (the walk's, which faces ahead).
const hipsTrack = (clip) => clip?.tracks.find((t) => /^hips\.quaternion$/i.test(t.name));
export function heading(clip, up) {
  const v = hipsTrack(clip)?.values;
  if (!v) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < v.length; i += 4) {
    // the twist about `up`: 2·atan2(q.xyz · up, q.w)
    const a = 2 * Math.atan2(v[i] * up.x + v[i + 1] * up.y + v[i + 2] * up.z, v[i + 3]);
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  return Math.atan2(sy, sx);
}
export function faceForward(clip, up, target) {
  const v = hipsTrack(clip)?.values;
  const now = heading(clip, up);
  if (!v || now == null) return;
  const fix = new THREE.Quaternion().setFromAxisAngle(up, target - now);
  const q = new THREE.Quaternion();
  for (let i = 0; i < v.length; i += 4) {
    q.set(v[i], v[i + 1], v[i + 2], v[i + 3]).premultiply(fix);
    v[i] = q.x;
    v[i + 1] = q.y;
    v[i + 2] = q.z;
    v[i + 3] = q.w;
  }
}

const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// Idle, walking and running by speed (move 0…1); the rest by hand: Pickle
// Rick hops, Cronenbergs wobble, the Cromulon bobs; a hit squashes.
function update(c, t, move, hit) {
  const dt = c.last == null ? 0 : Math.min(0.1, Math.max(0, t - c.last));
  c.last = t;
  if (c.mixer) {
    const run = smooth(0.55, 0.9, move);
    const idle = 1 - smooth(0.05, 0.35, move);
    const walk = Math.max(0, 1 - run - idle);
    c.act.idle?.setEffectiveWeight(idle);
    c.act.walk?.setEffectiveWeight(walk);
    c.act.run?.setEffectiveWeight(run);
    const pace = 0.75 + move * 0.45;
    if (c.act.walk) c.act.walk.timeScale = pace;
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
