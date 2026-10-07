// The people of the worlds made with Meshy (scripts/meshy-galaxy.mjs:
// public/models/galaxy/crew/), each rigged on a humanoid skeleton and
// walked with Rick's clips, borrowed (universe/footScene.js's rigCopy);
// Jabba stands still, as he was made. A figure kind with one of these is
// that model; one without is built (figures.js).
//
// The galaxy's soldiers are here too (scripts/meshy-troopers.mjs:
// public/models/galaxy/troops/): the Battlefront II remaster's clones,
// droids and troopers, rigged with Meshy onto the same skeleton, with six
// clips of their own for a fight (a flinch, three ways to die, kneeling
// behind cover, a chest-pound), made on the clone's rig. A Wookiee is
// Chewie's model, a little bigger or smaller and his fur a shade darker
// or greyer (`variant`).
//
// Each model is loaded once and every figure of it is a copy that shares
// what it's made of (a beach full of clones is one clone in memory).
//
// crewFigure(kind, variant) → { model (in metres), tall, bones, update(dt,
// move, motion?), after(dt, motion, frame), pose(name), dispose } or null.
// pose: 'kneel' | 'taunt' (held till another), 'hit' (a flinch, over in
// a moment, on top of whatever it's doing), 'die' | 'dieFwd' | 'dieBlown'
// (down, and stays down), or null (back on its feet). motion: as
// locomotion.js has it, speeds in metres a second.

import * as THREE from 'three';
import { rigCopy } from '../../universe/footScene';
import { METRE } from '../../universe/foot';
import { gltfLoader } from '../../../lib/three/gltf';
import { RICK_HIPS, borrowClips, faceForward, heading, retarget } from '../../rickmorty/portal/clips';
import { cloneModel, loadGlb } from './placer';

const TROOPS = '/models/galaxy/troops';
// a figure's file: its own `url`, or its name's in the crew's folder
export const fileOf = (c) => c.url ?? `/models/galaxy/crew/${c.name}.glb`;
// kind → { model's name or file, how tall, still (not rigged), tints (variants of its colour) }
export const CREW = {
  han: { name: 'han', tall: 1.85 },
  // (Luke and Leia are Sketchfab figures, rigged with Meshy onto the same skeleton)
  luke: { url: '/models/galaxy/crew/luke.glb', tall: 1.72 },
  leia: { url: '/models/galaxy/crew/leia.glb', tall: 1.5 },
  chewie: { url: '/models/cockpit/chewie.glb', tall: 2.28 }, // (the cockpits' own, whom the Falcon's party walks)
  greedo: { name: 'greedo', tall: 1.73 },
  gamorrean: { name: 'gamorrean', tall: 1.8 },
  bobafett: { name: 'bobafett', tall: 1.83 },
  bith: { name: 'bith', tall: 1.8 },
  ahsoka: { name: 'ahsoka', tall: 1.85 },
  hutt: { name: 'jabba', tall: 1.8, still: true },
  // the soldiers (catalog/battlefront.js has their heights)
  clone: { url: `${TROOPS}/clone.glb`, tall: 1.83 },
  battledroid: { url: `${TROOPS}/battledroid.glb`, tall: 1.91 },
  superdroid: { url: `${TROOPS}/superdroid.glb`, tall: 1.93 },
  stormtrooper: { url: `${TROOPS}/stormtrooper.glb`, tall: 1.83 },
  snowtrooper: { url: `${TROOPS}/snowtrooper.glb`, tall: 1.83 },
  hothtrooper: { url: `${TROOPS}/hothtrooper.glb`, tall: 1.78 },
  sandtrooper: { url: `${TROOPS}/sandtrooper.glb`, tall: 1.83 },
  scouttrooper: { url: `${TROOPS}/scouttrooper.glb`, tall: 1.83 },
  shoretrooper: { url: `${TROOPS}/shoretrooper.glb`, tall: 1.83 },
  deathtrooper: { url: `${TROOPS}/deathtrooper.glb`, tall: 1.9 },
  // any Wookiee: Chewie's model (Chewbacca himself is variant 0)
  wookiee: { url: '/models/cockpit/chewie.glb', tall: 2.2, tints: true },
};
export const TROOP_KINDS = ['clone', 'battledroid', 'superdroid', 'stormtrooper', 'snowtrooper', 'hothtrooper', 'sandtrooper', 'scouttrooper', 'shoretrooper', 'deathtrooper'];

// a Wookiee's fur, by variant: as made, then darker, greyer, redder
export const TINTS = ['#ffffff', '#b89c84', '#c4beb8', '#d0a888'];
export const tintOf = (variant) => TINTS[((variant % TINTS.length) + TINTS.length) % TINTS.length];

// the fight's clips (made on the clone's rig) and which play once and stay
export const COMBAT = ['hit', 'die', 'dieFwd', 'dieBlown', 'kneel', 'taunt'];
const ONCE = new Set(['hit', 'die', 'dieFwd', 'dieBlown', 'taunt']);
export const DEATHS = ['die', 'dieFwd', 'dieBlown'];
const HIT = 0.45; // seconds a flinch takes

// How much of each of the fight's clips a figure shows, eased each frame
// toward the pose it's in (pure: the figure's weights). st: { name, w:
// { clip: weight }, hit (seconds into a flinch, or −1) }. Returns the share
// left for walking and standing.
export function weighPoses(st, dt) {
  const fast = DEATHS.includes(st.name) ? 14 : 8;
  let sum = 0;
  for (const n of COMBAT) {
    if (n === 'hit') continue;
    const want = st.name === n ? 1 : 0;
    const w = st.w[n] ?? 0;
    st.w[n] = w + (want - w) * (1 - Math.exp(-dt * fast));
    if (st.w[n] < 1e-3 && !want) st.w[n] = 0;
    sum += st.w[n];
  }
  if (st.hit >= 0) {
    st.hit += dt;
    st.w.hit = st.hit < HIT ? 0.7 * Math.sin((st.hit / HIT) * Math.PI) * (1 - Math.min(1, sum)) : 0;
    if (st.hit >= HIT) st.hit = -1;
  } else st.w.hit = 0;
  sum += st.w.hit;
  return Math.max(0, 1 - sum);
}

// idle, walking and running by how fast (move 0…1), at the clips' own pace
function blend(act, move) {
  const smooth = (a, b, x) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  const run = smooth(0.55, 0.9, move);
  const idle = 1 - smooth(0.04, 0.3, move);
  act.idle?.setEffectiveWeight(idle);
  act.walk?.setEffectiveWeight(Math.max(0, 1 - run - idle));
  act.run?.setEffectiveWeight(run);
  const pace = 0.8 + move * 0.4;
  if (act.walk) act.walk.timeScale = pace;
  if (act.run) act.run.timeScale = pace;
}

// ── loading, once a file ──
const templates = new Map(); // url → Promise<{ scene, clips, tinted } | null>
function template(url) {
  if (!templates.has(url))
    templates.set(
      url,
      Promise.all([gltfLoader().loadAsync(url), borrowClips()]).then(
        ([gltf, clips]) => (gltf?.scene ? { scene: gltf.scene, clips, tinted: new Map() } : null),
        () => {
          templates.delete(url);
          return null;
        },
      ),
    );
  return templates.get(url);
}
let combat = null; // Promise<{ name: clip | null }>
export function combatClips() {
  combat ??= Promise.all(
    COMBAT.map((n) =>
      gltfLoader()
        .loadAsync(`${TROOPS}/clip-${n}.glb`)
        .then(
          (g) => {
            const c = g.animations[0] ?? null;
            // (retargeted from the clone's own hips, not Rick's)
            if (c) c.userData = { ...c.userData, hips: g.scene?.getObjectByName('Hips')?.position.y ?? RICK_HIPS };
            return c;
          },
          () => null,
        ),
    ),
  ).then((list) => Object.fromEntries(COMBAT.map((n, i) => [n, list[i]])));
  return combat;
}

// a copy's materials swapped for the variant's tint (made once a variant, shared by the copies wearing it)
function tint(model, tpl, variant) {
  const color = tintOf(variant);
  if (color === TINTS[0]) return;
  if (!tpl.tinted.has(color)) tpl.tinted.set(color, new Map());
  const made = tpl.tinted.get(color);
  const c = new THREE.Color(color);
  const own = (m) => {
    if (!made.has(m)) {
      const t = m.clone();
      t.color?.multiply(c);
      made.set(m, t);
    }
    return made.get(m);
  };
  model.traverse((o) => {
    if (o.isMesh && o.material) o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
  });
}

// the fight's clips on a figure's mixer: each retargeted to its hips and
// turned to face the way its walk does
function posesFor(fig, clips) {
  const hips = fig.model.getObjectByName('Hips');
  if (!hips || !fig.mixer) return null;
  fig.model.updateMatrixWorld(true);
  const up = hips.parent ? new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert()) : new THREE.Vector3(0, 1, 0);
  const ahead = fig.act?.walk ? heading(fig.act.walk.getClip(), up) : null;
  const act = {};
  for (const n of COMBAT) {
    const c = clips[n];
    if (!c) continue;
    const own = retarget(c, hips.position.y, c.userData?.hips ?? RICK_HIPS);
    if (ahead != null) faceForward(own, up, ahead);
    const a = fig.mixer.clipAction(own);
    if (ONCE.has(n)) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    a.setEffectiveWeight(0);
    a.play();
    act[n] = a;
  }
  const st = { name: null, w: {}, hit: -1 };
  return {
    set(name) {
      if (name === 'hit') {
        if (DEATHS.includes(st.name)) return;
        st.hit = 0;
        act.hit?.reset().play();
        return;
      }
      if (name === st.name) return;
      st.name = name ?? null;
      if (name && act[name]) act[name].reset().play();
    },
    get name() {
      return st.name;
    },
    weigh(dt) {
      const k = weighPoses(st, dt);
      for (const n of ['idle', 'walk', 'run']) fig.act[n]?.setEffectiveWeight(fig.act[n].getEffectiveWeight() * k);
      for (const n of COMBAT) act[n]?.setEffectiveWeight(st.w[n] ?? 0);
    },
  };
}

export async function crewFigure(kind, variant = 0) {
  const c = CREW[kind];
  if (!c) return null;
  if (c.still) {
    const gltf = await loadGlb(fileOf(c));
    if (!gltf) return null;
    const model = cloneModel(gltf);
    const body = new THREE.Group();
    body.add(model);
    let t = Math.random() * 10;
    return {
      model: body,
      tall: c.tall,
      // (breathing)
      update(dt) {
        t += dt;
        model.scale.set(1 + Math.sin(t * 1.1) * 0.012, 1 + Math.sin(t * 1.1) * 0.018, 1);
      },
      pose() {},
      dispose() {},
    };
  }
  const [tpl, fight] = await Promise.all([template(fileOf(c)), combatClips().catch(() => ({}))]);
  if (!tpl) return null;
  const fig = rigCopy(tpl.scene, tpl.clips, c.tall);
  if (c.tints) tint(fig.model, tpl, variant);
  const poses = posesFor(fig, fight);
  const model = new THREE.Group();
  model.scale.setScalar(1 / METRE);
  model.add(fig.model);
  model.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return {
    model,
    tall: c.tall,
    bones: fig.bones,
    rigged: true,
    update(dt, move, motion) {
      // (motion's speeds in metres a second; the clips' strides in the model's units)
      if (motion && fig.loco) fig.loco.update(dt, { move, ...motion, speed: (motion.speed ?? 0) * METRE, side: (motion.side ?? 0) * METRE });
      else blend(fig.act, move);
      poses?.weigh(dt);
      fig.mixer.update(dt);
    },
    after: (dt, motion, frame) => fig.after?.(dt, motion, frame),
    pose: (name) => poses?.set(name),
    get posed() {
      return poses?.name ?? null;
    },
    dispose: () => fig.dispose(),
  };
}
