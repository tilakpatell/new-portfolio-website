import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { BODY, SOCKETS } from './walrusRig';
import { clipsFor, loadWalrusClips, loadWalrusFigure } from './walrus';

// (the clip library watched: nothing of it may reach a figure on the game's skeleton)
const asked = vi.hoisted(() => []);
vi.mock('./clipLibrary', async (orig) => ({ ...(await orig()), forFigure: (n) => (asked.push(n), Promise.resolve(null)), loadClip: (n) => (asked.push(n), Promise.resolve(null)) }));

// a body on the game's skeleton: its bones under one root, a Spine1 among them
function walrusBody(names = BODY.concat(Object.values(SOCKETS))) {
  const root = new THREE.Group();
  const bones = names.map((n, i) => {
    const b = new THREE.Bone();
    b.name = n;
    b.position.y = i * 0.04;
    return b;
  });
  bones.slice(1).forEach((b) => bones[0].add(b));
  root.add(bones[0]);
  return root;
}
const quat = (name) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
const clip = (name, tracks) => new THREE.AnimationClip(name, 1, tracks);
// a loader that hands back a scene, as three's would
const loaderOf = (scene, animations = []) => ({ loadAsync: async () => ({ scene, animations }) });

describe('the shared clips on one body', () => {
  it('keeps the tracks the body has a bone for, and drops a clip with none', () => {
    const body = walrusBody();
    const clips = new Map([
      ['idle', clip('idle', [quat('Hips'), quat('Nope')])],
      ['ghost', clip('ghost', [new THREE.VectorKeyframeTrack('Nope.position', [0], [0, 0, 0])])],
    ]);
    const got = clipsFor(body, clips);
    expect(got.ghost).toBeUndefined();
    // (and the names that fall back to an idle stand on it)
    expect(got.kneel.tracks).toEqual(got.idle.tracks);
    expect(got.idle.tracks.map((t) => t.name)).toEqual(['Hips.quaternion']);
    // (the library's own copy is left alone, for the next body)
    expect(clips.get('idle').tracks).toHaveLength(2);
  });
  it('answers every fallback name with the clip it falls back to', () => {
    const got = clipsFor(walrusBody(), new Map([
      ['hit.chest', clip('hit.chest', [quat('Spine1')])],
      ['die', clip('die', [quat('Hips')])],
    ]));
    expect(got['hit.head'].tracks).toEqual(got['hit.chest'].tracks);
    for (const n of ['die.fwd', 'die.back', 'die.blown']) expect(got[n].tracks).toEqual(got.die.tracks);
    expect(got['aim.pistol']).toBeUndefined();
  });
  it('gives a fallback its own copy, so playing it never stops the clip it stands for', () => {
    const got = clipsFor(walrusBody(), new Map([['idle', clip('idle', [quat('Hips')])]]));
    expect(got.roll).not.toBe(got.idle);
    expect(got.roll.tracks).toEqual(got.idle.tracks);
    const mixer = new THREE.AnimationMixer(walrusBody());
    expect(mixer.clipAction(got.roll)).not.toBe(mixer.clipAction(got.idle));
  });
  it('lays an upper-layer clip on the game’s chest and neck', async () => {
    const body = walrusBody();
    const tilt = (n) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, [0, 1], [0.5, 0, 0, 0.866, 0.5, 0, 0, 0.866]);
    const fig = await loadWalrusFigure('/upper.glb', { tall: 1.7, loader: loaderOf(body), clips: new Map([
      ['idle', clip('idle', [quat('Hips')])],
      ['talk', clip('talk', ['Spine1', 'Spine2', 'Neck'].map(tilt))],
    ]) });
    await fig.play('talk', { layer: 'upper', fade: 0 });
    for (let i = 0; i < 5; i++) {
      fig.update(0.1, 0);
      fig.after(0.1, null, { forward: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) });
    }
    for (const n of ['Spine1', 'Spine2', 'Neck']) expect(Math.abs(fig.bones[n].quaternion.x)).toBeGreaterThan(0.1);
    fig.dispose();
  });
});

describe('a figure on the game’s skeleton', () => {
  it('refuses a body on Meshy’s skeleton, naming what it lacks', async () => {
    const meshy = walrusBody(['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head']);
    await expect(loadWalrusFigure('/x.glb', { tall: 1.7, loader: loaderOf(meshy), clips: new Map() })).rejects.toThrow(/Spine1/);
  });
  it('stands at its height, with the game’s sockets and the shared clips', async () => {
    const body = walrusBody();
    const fig = await loadWalrusFigure('/luke.glb', { tall: 1.72, unit: 1, loader: loaderOf(body), clips: new Map([['idle', clip('idle', [quat('Hips')])], ['sit.idle', clip('sit.idle', [quat('Hips')])]]) });
    expect(fig.rig).toBe('walrus');
    expect(fig.sockets.weapon.name).toBe('Wep_Root');
    expect(fig.sockets.handL.name).toBe('IK_Joint_LeftHand');
    expect(fig.bones.Spine1).toBeTruthy();
    expect(fig.anim.actions.idle).toBeTruthy();
    // (a copy: the loaded scene stays the template)
    expect(fig.model).not.toBe(body);
    expect(await fig.play('sword.block')).toBe(false);
    // (a base state whose way in it lacks: never fetched from the library)
    asked.length = 0;
    fig.base('sit.idle');
    await Promise.resolve();
    expect(asked).toEqual([]);
    fig.update(0.016, 0);
    fig.dispose();
  });
  it('loads the clip packs once, by the names inside them', async () => {
    const urls = ['/a.glb', '/b.glb'];
    const loader = { n: 0, loadAsync: async (u) => (loader.n++, { scene: new THREE.Group(), animations: [clip(u === '/a.glb' ? 'idle' : 'walk', [quat('Hips')])] }) };
    const one = await loadWalrusClips(urls, { loader });
    expect([...one.keys()]).toEqual(['idle', 'walk']);
    expect(await loadWalrusClips(urls, { loader })).toBe(one);
    expect(loader.n).toBe(2);
  });
});
