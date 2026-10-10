import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { clipsFor, loadOwnRigFigure, paceOf, pickBase } from './ownRig';
import { RIG_SET } from './rigSets';

// a walker's body as the loader gets it: a skinned box on a two-bone leg,
// the game's names on its bones
function body({ root = 'Hips' } = {}) {
  const hips = new THREE.Bone();
  hips.name = root;
  const foot = new THREE.Bone();
  foot.name = 'LeftFrontFoot';
  foot.position.y = -1;
  hips.add(foot);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4));
  geo.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(
      new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : 1)),
      4,
    ),
  );
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  const scene = new THREE.Group();
  scene.add(hips, mesh);
  mesh.bind(new THREE.Skeleton([hips, foot]));
  return { scene, animations: [] };
}

// a pack: the AT-AT's clips by the game's names, one track on a bone the
// body hasn't (the pack's skeleton is the rig's whole, a body may be less)
function pack() {
  const clip = (name, extra = {}) => {
    const c = new THREE.AnimationClip(name, 2, [new THREE.VectorKeyframeTrack('Hips.position', [0, 2], [0, 0, 0, 0, 0.1, 0]), new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0, 2], [0, 0, 0, 1, 0, 0, 0, 1])]);
    c.userData = { travel: 0, duration: 2, ...extra };
    return c;
  };
  const set = RIG_SET('atat');
  return {
    animations: [clip(set.idle), clip(set.walk, { travel: 4 }), clip(set['walk.back'], { travel: 4 }), clip(set.die), clip(set['die.cable'])],
  };
}

const opts = (more = {}) => ({
  rig: 'atat',
  packs: ['clips-atat.glb'],
  load: async () => body(more),
  loadPack: async () => pack(),
});

describe('a figure on a rig of its own', () => {
  it('keeps only the tracks for bones the body has', () => {
    const [c] = clipsFor(pack().animations, (b) => b === 'Hips');
    expect(c.tracks.map((t) => t.name)).toEqual(['Hips.position']);
    expect(c.userData.duration).toBe(2);
  });

  it('walks forward, walks back, stands', () => {
    const set = RIG_SET('atat');
    expect(pickBase({ speed: 1.2 }, 0, set)).toBe('walk');
    expect(pickBase({ speed: -0.5 }, 0, set)).toBe('walk.back');
    expect(pickBase({ speed: 0.01 }, 0, set)).toBe('idle');
    expect(pickBase(null, 0.6, set)).toBe('walk');
  });

  it('paces a walk to the ground it covers, so its feet stay planted', () => {
    const clip = { duration: 2, userData: { travel: 4, duration: 2 } };
    expect(paceOf(2, clip)).toBeCloseTo(1);
    expect(paceOf(1, clip)).toBeCloseTo(0.5);
    expect(paceOf(100, clip)).toBe(2);
    expect(paceOf(1, { duration: 1, userData: {} })).toBe(1);
  });

  it('refuses a body without the bone its row hangs it from, and says which', async () => {
    await expect(loadOwnRigFigure('atat.glb', opts({ root: 'Pelvis' }))).rejects.toThrow(/Hips/);
  });

  it('is a figure in crew.js’s shape, on its own rig', async () => {
    const fig = await loadOwnRigFigure('atat.glb', opts());
    for (const k of ['model', 'tall', 'anim', 'bones', 'play', 'stop', 'base', 'update', 'look', 'react', 'dispose']) expect(fig[k], k).toBeDefined();
    expect(fig.rig).toBe('own');
    expect(fig.bones.Hips.isBone).toBe(true);
    fig.update(0.1, 0, { speed: 2 });
    expect(fig.anim.mixer.existingAction(fig.anim.clips.find((c) => c.name === RIG_SET('atat').walk)).isRunning()).toBe(true);
    fig.dispose();
  });

  it('falls by the tow cable’s death when the cable brought it down, and stays down', async () => {
    const fig = await loadOwnRigFigure('atat.glb', opts());
    expect(fig.react('down', { cable: true })).toEqual({ clip: 'die.cable' });
    expect(fig.react('down', {})).toBeNull();
    expect(await fig.play('walk')).toBe(false);
    fig.dispose();
  });

  it('fires by the rig’s own shot where it has one, and says when it hasn’t', async () => {
    const atat = await loadOwnRigFigure('atat.glb', opts());
    expect(atat.react('fire', {})).toBe(false);
    atat.dispose();
    const droid = { ...opts(), rig: 'droideka', loadPack: async () => ({ animations: [new THREE.AnimationClip(RIG_SET('droideka').idle, 1, []), new THREE.AnimationClip(RIG_SET('droideka').fire, 0.6, [new THREE.VectorKeyframeTrack('Hips.position', [0, 0.6], [0, 0, 0, 0, 0.1, 0])])] }) };
    const fig = await loadOwnRigFigure('droideka.glb', droid);
    expect(fig.react('fire', {})).toBe(true);
    fig.dispose();
  });
});
