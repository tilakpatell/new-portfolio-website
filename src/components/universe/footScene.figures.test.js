import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { meshyRig, swingClip } from '../../lib/three/meshyRig.fixture';
import { createMeshyCast } from '../rickmorty/portal/meshyCast';
import { loadPartyFigure } from './footScene';
import { METRE } from './foot';

// Every file the figures ask for, made on Meshy's skeleton (the animator's
// fixture): a model is the rig with a body to measure; `<who>-<clip>.glb`
// (Rick's, a cast figure's own, the library's clips-, ual-) that clip.
const loader = vi.hoisted(() => ({
  urls: [],
  load: null,
  loadAsync(url) {
    this.urls.push(url);
    return this.load(url);
  },
}));
vi.mock('../../lib/three/gltf', async (orig) => ({ ...(await orig()), gltfLoader: () => loader }));

const rig = () => {
  const r = meshyRig();
  r.model.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.3).translate(0, 0.9, 0), new THREE.MeshStandardMaterial()));
  return r;
};
const MADE = {
  idle: (r) => r.clips.idle,
  walk: (r) => r.clips.walk,
  run: (r) => r.clips.run,
  wave: (r) => swingClip(r, 'wave', 1.2, (n, t) => (n === 'RightArm' ? -1.2 * Math.sin((Math.PI * t) / 1.2) : 0)),
};
loader.load = async (url) => {
  const name = url.match(/\/[a-z]+-([\w.]+)\.glb$/)?.[1];
  const r = rig();
  if (!name) return { scene: r.model, animations: [] };
  if (!MADE[name]) throw new Error('404');
  return { scene: r.model, animations: [MADE[name](r)] };
};

const DT = 1 / 60;
const FRAME = { forward: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) };
// n frames as footScene draws its people: update, placed, then after
const frames = (fig, n, move = 0, motion = null) => {
  for (let i = 0; i < n; i++) {
    fig.update(DT, move, motion);
    fig.model.updateMatrixWorld(true);
    fig.after?.(DT, motion, FRAME);
  }
};

describe('a crew figure loaded from its own file', () => {
  it('is on an animator, as it was on a mixer, and plays the library’s clips', async () => {
    const fig = await loadPartyFigure({ id: 'luke', name: 'Luke', tall: 1.72, src: { url: '/models/galaxy/crew/luke.glb' } }, null);
    expect(fig.anim).toBeTruthy();
    expect(fig.mixer).toBe(fig.anim.mixer);
    expect(fig.loco).toBe(fig.anim.loco);
    expect(Object.keys(fig.act).sort()).toEqual(['idle', 'run', 'walk']);
    expect(fig.hipsY).toBeGreaterThan(0);
    frames(fig, 30, 0.4, { speed: 1.5 * METRE, side: 0, turn: 0 });
    expect(['idle', 'walk', 'run'].reduce((s, n) => s + fig.act[n].getEffectiveWeight(), 0)).toBeCloseTo(1, 6);
    expect(await fig.play('wave')).toBe(true);
    expect(fig.anim.playing('full')).toBe('wave');
    expect(fig.react('nothing that happens')).toBe(null);
    fig.dispose();
  });
});

describe('a Rick and Morty figure out of the ship', () => {
  const copOf = async () => {
    const cast = createMeshyCast({ kinds: { cop: { a: 'cop', h: 2.35 } }, rigged: new Set(['cop']) });
    await cast.load(null, ['cop'], { clips: ['idle', 'walk', 'run'] });
    return { cast, fig: await loadPartyFigure({ id: 'cop', name: 'Cop', tall: 1.9, src: { meshy: 'cop' } }, cast) };
  };

  it('walks on the cast’s own animator, never a second over its mixer', async () => {
    const { cast, fig } = await copOf();
    expect(fig.anim).toBeTruthy();
    expect(fig.mixer).toBe(fig.anim.mixer);
    const t0 = fig.mixer.time;
    frames(fig, 10, 0.3, { speed: 1.2 * METRE, side: 0, turn: 0 });
    expect(fig.mixer.time - t0).toBeCloseTo(10 * DT, 9);
    expect(await fig.play('wave')).toBe(true);
    expect(fig.anim.playing('full')).toBe('wave');
    cast.dispose();
  });

  it('crouches in the map’s units, from the cast’s', async () => {
    const { cast, fig } = await copOf();
    const k = fig.model.scale.x;
    frames(fig, 30, 0, { speed: 0, side: 0, turn: 0, down: 1 });
    expect(fig.anim.loco.drop).toBeGreaterThan(0);
    expect(fig.loco.drop).toBeCloseTo(fig.anim.loco.drop * k, 12);
    cast.dispose();
  });
});

describe('a figure built from shapes', () => {
  const han = () => loadPartyFigure({ id: 'han', name: 'Han', tall: 1.85, src: { built: 'han' } }, null);
  const hipOf = (fig) => fig.model.children[0].rotation.x;
  const torsoOf = (fig) => fig.bones.Spine.children[0].position.y;

  it('has nothing to play and nowhere to look, and says so without throwing', async () => {
    const fig = await han();
    expect(fig.anim).toBe(null);
    expect(await fig.play('wave')).toBe(false);
    expect(fig.react('hit', { t: 1 })).toBe(null);
    expect(await fig.base('sit')).toBe('cut');
    expect(() => fig.look({ x: 1, z: 1 })).not.toThrow();
    fig.dispose();
  });

  it('steps by the ground it covers: a stride further on, its legs are where they were, at any pace', async () => {
    const fig = await han();
    const stride = 0.75 * 1.85;
    frames(fig, 30, 0, { speed: 1.8 * METRE, side: 0, turn: 0 });
    const was = hipOf(fig);
    expect(Math.abs(was) + Math.abs(fig.model.children[1].rotation.x)).toBeGreaterThan(0); // (walking)
    frames(fig, 30, 0, { speed: (stride / 0.5) * METRE, side: 0, turn: 0 }); // (a stride in half a second)
    expect(hipOf(fig)).toBeCloseTo(was, 6);
    frames(fig, 60, 0, { speed: (stride / 1) * METRE, side: 0, turn: 0 }); // (and another in a second)
    expect(hipOf(fig)).toBeCloseTo(was, 6);
    fig.dispose();
  });

  it('stands still with its legs still, and breathes, out of step with another', async () => {
    const a = await han();
    const b = await han();
    const torso = [];
    for (let i = 0; i < 240; i++) {
      a.update(DT, 0);
      b.update(DT, 0);
      expect(hipOf(a)).toBe(0);
      torso.push(torsoOf(a));
    }
    expect(Math.max(...torso) - Math.min(...torso)).toBeGreaterThan(0.004);
    expect(Math.abs(torsoOf(a) - torsoOf(b))).toBeGreaterThan(1e-4);
    a.dispose();
    b.dispose();
  });

  it('Artoo rocks only as he rolls, and the probe drifts on its own', async () => {
    const artoo = await loadPartyFigure({ id: 'artoo', name: 'Artoo', tall: 1.09, src: { built: 'artoo' } }, null);
    const body = artoo.model.children.find((o) => o.isGroup);
    frames(artoo, 60, 0);
    expect(body.rotation.z).toBe(0);
    const rocks = [];
    for (let i = 0; i < 60; i++) {
      frames(artoo, 1, 0.3);
      rocks.push(body.rotation.z);
    }
    expect(Math.max(...rocks) - Math.min(...rocks)).toBeGreaterThan(0.02);
    const probe = await loadPartyFigure({ id: 'probe', name: 'Probe', tall: 1, src: { built: 'probe' } }, null);
    expect(() => frames(probe, 10)).not.toThrow();
    artoo.dispose();
    probe.dispose();
  });
});
