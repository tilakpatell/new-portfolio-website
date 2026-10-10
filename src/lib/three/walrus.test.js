import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { clearGLTFCache } from './gltfCache';
import { clipsFor, loadWalrusBody, loadWalrusPacks, packUrls, socketsOf } from './walrus';
import { BODY, SOCKETS } from './walrusRig.js';

// a body by name: the game's (BODY and the sockets) or Meshy's
function body(names) {
  const root = new THREE.Group();
  let at = root;
  for (const n of names) {
    const b = new THREE.Bone();
    b.name = n;
    at.add(b);
    at = n === 'Hips' ? b : at;
  }
  return root;
}
const clip = (name, tracks, userData = {}) => Object.assign(new THREE.AnimationClip(name, 1, tracks), { userData });
const q = (bone, w = 1) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 1], [0, 0, 0, 1, 0, Math.sqrt(1 - w * w), 0, w]);
// a stand-in loader: a url → a glTF with these clips and that scene's extras
const loaderOf = (packs) => ({ loadAsync: async (url) => (packs[url] ? { scene: Object.assign(new THREE.Group(), { userData: packs[url].userData ?? {} }), animations: packs[url].animations } : null) });

afterEach(() => clearGLTFCache());

describe('a figure on the game’s skeleton', () => {
  it('plays only the tracks its bones take, and drops a clip with none left', () => {
    const b = body([...BODY, 'Wep_Root']);
    const set = clipsFor(b, new Map([
      ['idle', clip('idle', [q('Hips'), q('LeftArm_Phys_01')])],
      ['cape', clip('cape', [q('Cape_Phys_01')])],
    ]));
    expect(Object.keys(set)).toEqual(expect.arrayContaining(['idle']));
    expect(set.cape).toBeUndefined();
    expect(set.idle.tracks.map((t) => t.name)).toEqual(['Hips.quaternion']);
  });

  it('puts a bone another clip moves back to rest in a clip that leaves it alone', () => {
    const b = body(BODY);
    const set = clipsFor(b, new Map([
      ['walk', clip('walk', [q('Hips'), q('LeftArm', 0.8)])],
      ['idle', clip('idle', [q('Hips')])],
    ]));
    const arm = set.idle.tracks.find((t) => t.name === 'LeftArm.quaternion');
    expect(arm).toBeTruthy();
    expect(Array.from(arm.values.slice(0, 4))).toEqual([0, 0, 0, 1]);
  });

  it('names the fallback for a role the pack lacks, and keeps a clip’s extras', () => {
    const set = clipsFor(body(BODY), new Map([['hit.chest', clip('hit.chest', [q('Spine')], { root: [[0, 0, 0]] })]]));
    expect(set['hit.head']).toBe(set['hit.chest']);
    expect(set['hit.chest'].userData.root).toEqual([[0, 0, 0]]);
  });

  it('finds the sockets by the game’s names', () => {
    const s = socketsOf(body([...BODY, ...Object.values(SOCKETS)]));
    expect(s.weapon.name).toBe('Wep_Root');
    expect(s.handL.name).toBe('IK_Joint_LeftHand');
  });

  it('merges packs, a later one’s clip over an earlier one’s, and makes the aliases', async () => {
    const loader = loaderOf({
      '/a.glb': { animations: [clip('idle', [q('Hips')]), clip('walk', [q('Hips')])] },
      '/b.glb': { animations: [clip('idle', [q('Spine')]), clip('die', [q('Spine')])], userData: { aliases: { 'die.fwd': 'die' } } },
    });
    const m = await loadWalrusPacks(['/a.glb', '/b.glb', '/missing.glb'], { loader });
    expect(m.get('idle').tracks[0].name).toBe('Spine.quaternion');
    expect(m.get('walk')).toBeTruthy();
    expect(m.get('die.fwd').name).toBe('die.fwd');
  });

  it('refuses a body on Meshy’s skeleton, saying what the game’s has', async () => {
    const meshy = body(['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head']);
    const loader = { loadAsync: async (url) => (url === '/meshy.glb' ? { scene: meshy, animations: [] } : null) };
    await expect(loadWalrusBody('/meshy.glb', { packs: [], loader })).rejects.toThrow(/Spine1/);
  });

  it('loads the humanoid pack first and a hero’s over it', () => {
    expect(packUrls('luke')).toEqual(['/models/galaxy/bf2017/clips-humanoid.glb', '/models/galaxy/bf2017/clips-luke.glb']);
    expect(packUrls()).toEqual(['/models/galaxy/bf2017/clips-humanoid.glb']);
  });
});
