// ./people.js's figures on clips, in Node: a synthetic Meshy figure (the
// animator's fixture) skinned and handed out by a loader of our own, with
// its walk, run, idle and the library's clips the same way.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { meshyRig, swingClip } from '../../lib/three/meshyRig.fixture';
import { preload } from '../../lib/three/clipLibrary';
import { loadPeople } from './people';

const rig = meshyRig();
// a figure as a .glb has it: the rig, and a skinned mesh on its bones
const figure = () => {
  const r = meshyRig();
  const bones = Object.values(r.bones);
  const geo = new THREE.BoxGeometry(0.4, 1.8, 0.3, 1, 6, 1).translate(0, 0.9, 0);
  const n = geo.attributes.position.count;
  const hips = bones.indexOf(r.bones.Hips);
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 ? 0 : hips)), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 ? 0 : 1)), 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
  r.model.add(mesh);
  r.model.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  return r.model;
};
// a clip file: a scene with the hips as the clips were made on, and the clip
const clipFile = (clip) => {
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  hips.position.y = rig.hipsY;
  const scene = new THREE.Group();
  scene.add(hips);
  return { scene, animations: [clip] };
};
// sat: the hips down and back; standing: as at rest
const sitting = (name, from, to) => swingClip(rig, name, 1, (n, t) => (n.endsWith('UpLeg') ? -1.4 * (from + (to - from) * t) : n.endsWith('Leg') ? 1.4 * (from + (to - from) * t) : 0), { hips: (t) => -38 * (from + (to - from) * t) });
const CLIPFILES = {
  'rick-walk': rig.clips.walk,
  'rick-run': rig.clips.run,
  'rick-idle': rig.clips.idle,
  'ual-idle.calm': rig.clips.idle,
  'ual-sit.enter': sitting('sit.enter', 0, 1),
  'ual-sit.exit': sitting('sit.exit', 1, 0),
  'clips-wave': swingClip(rig, 'wave', 1.2, (n, t) => (n === 'RightArm' ? -2 * Math.sin(Math.PI * t) : 0)),
  'ual-talk': swingClip(rig, 'talk', 2, (n, t) => (n === 'LeftForeArm' ? 0.4 * Math.sin(3 * t) : 0)),
};
const loader = {
  asked: [],
  async loadAsync(url) {
    this.asked.push(url);
    if (url.includes('/models/')) return { scene: figure(), animations: [] };
    const name = url.split('/').pop().replace(/\.glb$/, '');
    if (!CLIPFILES[name]) throw new Error(`no ${url}`);
    return clipFile(CLIPFILES[name]);
  },
};
const SPEC = { id: 'tester', model: '/models/office/cast/tester.glb', height: 1.8 };
const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('people on clips', () => {
  it('stands on an animator when asked, and as before when not', async () => {
    const cast = await loadPeople([SPEC], null, { clips: true, loader });
    expect(cast.clips).toBe(true);
    const on = cast.person(SPEC, { pose: 'stand', anim: true, idle: true });
    expect(on.anim).toBeTruthy();
    expect(on.bob()).toBe(0);
    const off = cast.person(SPEC, { pose: 'stand', idle: true });
    expect(off.anim).toBeNull();
    // (a figure off clips does what it always did)
    off.walk(true);
    for (let i = 0; i < 30; i++) off.update(i / 60, 1 / 60);
    expect(off.bob()).toBeGreaterThan(0);
    expect(await off.play('wave')).toBe('cut');
    expect(off.react('greet', {})).toBeNull();
    // and a sitter never stands on clips
    expect(cast.person(SPEC, { pose: 'sit', anim: true }).anim).toBeNull();
    cast.dispose();
  });

  it('paces its feet to how far the scene moves it: walking forward, standing still', async () => {
    const cast = await loadPeople([SPEC], null, { clips: true, loader });
    const p = cast.person(SPEC, { pose: 'stand', anim: true });
    const dt = 1 / 60;
    for (let i = 0; i < 120; i++) {
      p.group.position.z += 1.2 * dt;
      p.group.updateMatrixWorld(true);
      p.update(i * dt, dt);
    }
    expect(p.motion.speed).toBeCloseTo(1.2, 1);
    expect(p.anim.actions.walk.getEffectiveWeight()).toBeGreaterThan(0.5);
    for (let i = 0; i < 120; i++) p.update(2 + i * dt, dt);
    expect(p.motion.speed).toBeCloseTo(0, 2);
    expect(p.anim.actions.idle.getEffectiveWeight()).toBeGreaterThan(0.9);
    cast.dispose();
  });

  it('copies of one person don’t breathe in step', async () => {
    const cast = await loadPeople([SPEC], null, { clips: true, loader });
    const a = cast.person(SPEC, { pose: 'stand', anim: true });
    const b = cast.person(SPEC, { pose: 'stand', anim: true });
    expect(a.anim.actions.idle.time).not.toBeCloseTo(b.anim.actions.idle.time, 3);
    cast.dispose();
  });

  it('gets up out of a chair, sits down into one and stays there, and lets go of it at once', async () => {
    await preload(['sit.enter', 'sit.exit', 'wave', 'talk'], { loader });
    const cast = await loadPeople([SPEC], null, { clips: true, loader });
    const p = cast.person(SPEC, { pose: 'stand', anim: true });
    const hips = p.group.getObjectByName('Hips');
    const standing = hips.getWorldPosition(new THREE.Vector3()).y;
    p.update(0, 1 / 60);
    p.rise();
    await flush();
    expect(p.anim.playing('full')).toBe('sit.exit');
    p.update(1 / 60, 1 / 60);
    p.group.updateMatrixWorld(true);
    // (sat at first: the hips well down)
    expect(hips.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(standing - 0.1);
    for (let i = 0; i < 90; i++) p.update(i / 60, 1 / 60);
    expect(p.anim.playing('full')).toBeNull();
    p.sit();
    await flush();
    for (let i = 0; i < 150; i++) p.update(i / 60, 1 / 60);
    expect(p.anim.playing('full')).toBe('sit.enter');
    p.stand();
    expect(p.anim.playing('full')).toBeNull();
    cast.dispose();
  });

  it('waves on the clip library’s wave, its legs its own, and talks for a line', async () => {
    await preload(['wave', 'talk'], { loader });
    const cast = await loadPeople([SPEC], null, { clips: true, loader });
    const p = cast.person(SPEC, { pose: 'stand', anim: true });
    p.wave();
    await flush();
    expect(p.anim.playing('upper')).toBe('wave');
    expect(p.anim.playing('full')).toBeNull();
    const r = p.say(1.5, new THREE.Vector3(0, 1.6, 3));
    expect(r).toMatchObject({ clip: 'talk', layer: 'upper' });
    await flush();
    expect(p.anim.playing('upper')).toBe('talk');
    // (let go once the line's said)
    for (let i = 0; i < 120; i++) p.update(i / 60, 1 / 60);
    expect(p.anim.playing('upper')).toBeNull();
    cast.dispose();
  });
});
